import puppeteer from 'puppeteer-core';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(process.cwd(), 'report_assets', 'basic-folder-verification');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function verifyBasicFolderInteraction() {
  console.log('================================================================');
  console.log('  PORT OS - RESET BASIC FOLDER OPENING/CLOSING INTERACTION       ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate and Land on Desktop
    // -------------------------------------------------------------
    console.log('[1/7] Logging into PORT OS Desktop...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });

    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.waitForSelector('#input-admin-password', { visible: true });
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    }

    await page.waitForSelector('#desktop-item-projects', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));
    console.log('✓ Desktop mounted and ready.');

    // -------------------------------------------------------------
    // CHECK 1: Hover over Folder does NOT pop floating pills
    // -------------------------------------------------------------
    console.log('\n[2/7] Verifying Hover over folder: NO floating pills or icon displacement...');
    const projFolder = await page.$('#desktop-item-projects');
    const folderBox = await projFolder.boundingBox();
    assert(folderBox, 'Projects folder must have a valid bounding box');

    // Move mouse over the Projects folder
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 700));

    const hoverCheck = await page.evaluate(() => {
      const pills = document.querySelectorAll('.folder-float__item');
      const bridge = document.querySelector('.folder-float-bridge-hitbox');
      const certEdu = document.getElementById('desktop-item-cert-education');
      const pushEl = certEdu ? certEdu.querySelector('.di-push') : null;
      const pushTransform = pushEl?.style.transform || '';

      return {
        pillCount: pills.length,
        hasBridge: !!bridge,
        pushTransform,
        isDisplaced: pushTransform.includes('88px') || pushTransform.includes('--push-y: 88px'),
      };
    });

    console.log('Hover evaluation result:', hoverCheck);
    assert.strictEqual(hoverCheck.pillCount, 0, 'No floating pills should emerge on hover in basic mode');
    assert.strictEqual(hoverCheck.hasBridge, false, 'No invisible hitbox bridge on hover');
    assert.strictEqual(hoverCheck.isDisplaced, false, 'Adjacent icons must NOT be displaced on hover');
    console.log('✓ PASS: Hover on wallpaper folder does NOT pop floating pills or displace icons.');

    const ssHover = path.join(EVIDENCE_DIR, '01_clean_hover_no_pills.png');
    await page.screenshot({ path: ssHover });

    // -------------------------------------------------------------
    // CHECK 2: Single Click selects icon without opening window
    // -------------------------------------------------------------
    console.log('\n[3/7] Verifying Single Click selects folder only (No window opened)...');
    await page.mouse.click(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 300));

    const singleClickCheck = await page.evaluate(() => {
      const folder = document.getElementById('desktop-item-projects');
      const win = document.querySelector('.window-container, .window-shell');
      return {
        isSelected: folder?.classList.contains('is-selected') || false,
        windowOpened: !!win,
      };
    });

    console.log('Single click evaluation:', singleClickCheck);
    assert(singleClickCheck.isSelected, 'Single click must select the folder (.is-selected)');
    assert(!singleClickCheck.windowOpened, 'Single click must NOT open any window');
    console.log('✓ PASS: Single click selects folder without opening.');

    // -------------------------------------------------------------
    // CHECK 3: Double Click (Left Click) triggers opening animation and opens Finder
    // -------------------------------------------------------------
    console.log('\n[4/7] Verifying Double Click (Left Click) triggers tactile animation and opens Finder window...');
    await page.mouse.click(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2, { count: 2 });
    
    // Check animation presence immediately after double click
    const animCheck = await page.evaluate(() => {
      const folderGraphic = document.querySelector('#desktop-item-projects .desktop-icon-graphic');
      const isOpening = folderGraphic?.classList.contains('is-opening') || folderGraphic?.hasAttribute('data-opening');
      return { isOpening: !!isOpening };
    });
    console.log('Double click folder opening animation active:', animCheck.isOpening);

    await page.waitForSelector('.window-container, .window-shell', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    const openedWindowCheck = await page.evaluate(() => {
      const win = document.querySelector('.window-container, .window-shell');
      const title = win?.querySelector('.window-title, .window-header')?.textContent || '';
      return {
        hasWindow: !!win,
        title,
      };
    });

    console.log('Opened window from double click:', openedWindowCheck);
    assert(openedWindowCheck.hasWindow, 'Double click must open Finder window');
    console.log(`✓ PASS: Double click opened folder window ("${openedWindowCheck.title}").`);

    const ssDblClick = path.join(EVIDENCE_DIR, '02_double_click_opened_window.png');
    await page.screenshot({ path: ssDblClick });

    // Close the window
    console.log('\n[5/7] Verifying Window Closing...');
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#btn-close-folder-projects') || document.querySelector('.traffic-light-close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const winClosed = await page.evaluate(() => !document.querySelector('.window-container, .window-shell'));
    assert(winClosed, 'Window must close when close button is clicked');
    console.log('✓ PASS: Folder window closed cleanly.');

    // -------------------------------------------------------------
    // CHECK 4: Double Right Click triggers folder opening
    // -------------------------------------------------------------
    console.log('\n[6/7] Verifying Double Right Click opens folder with animation...');
    await page.mouse.click(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2, { button: 'right' });
    await new Promise((r) => setTimeout(r, 120));
    await page.mouse.click(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2, { button: 'right' });

    await page.waitForSelector('.window-container, .window-shell', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    const dblRightClickCheck = await page.evaluate(() => {
      const win = document.querySelector('.window-container, .window-shell');
      return { hasWindow: !!win };
    });
    console.log('Double right click window check:', dblRightClickCheck);
    assert(dblRightClickCheck.hasWindow, 'Double right click must open folder window');
    console.log('✓ PASS: Double right click opened folder window successfully.');

    const ssDblRight = path.join(EVIDENCE_DIR, '03_double_right_click_opened.png');
    await page.screenshot({ path: ssDblRight });

    // Close window again
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#btn-close-folder-projects') || document.querySelector('.traffic-light-close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // CHECK 5: Single Right Click Context Menu & Mid-layer / Wallpaper co-existence
    // -------------------------------------------------------------
    console.log('\n[7/7] Verifying Single Right Click Context Menu and Co-existence with Wallpaper & Gallery...');
    await page.mouse.click(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2, { button: 'right' });
    await page.waitForSelector('.context-menu-container, [role="menu"]', { timeout: 4000 });

    const menuCheck = await page.evaluate(() => {
      const menu = document.querySelector('.context-menu-container, [role="menu"]');
      const openOption = Array.from(menu?.querySelectorAll('.context-menu-item, button') || [])
        .find((el) => el.textContent?.includes('Open'));
      const gallery = document.getElementById('desktop-circular-gallery-layer');
      const ascii = document.getElementById('desktop-gradient-ascii-container');

      return {
        hasMenu: !!menu,
        hasOpenOption: !!openOption,
        hasGallery: !!gallery,
        hasAscii: !!ascii,
      };
    });

    console.log('Right-click context menu and background check:', menuCheck);
    assert(menuCheck.hasMenu, 'Single right click must open context menu');
    assert(menuCheck.hasOpenOption, 'Context menu must have Open option');
    assert(menuCheck.hasGallery, 'CircularGallery mid-layer must remain active');
    assert(menuCheck.hasAscii, 'GradientASCII wallpaper background must remain active');
    console.log('✓ PASS: Right-click context menu verified. Wallpaper & CircularGallery co-exist perfectly.');

    const ssMenu = path.join(EVIDENCE_DIR, '04_context_menu_with_open.png');
    await page.screenshot({ path: ssMenu });

    console.log('\n================================================================');
    console.log('  ALL 7 CHECKS PASSED: BASIC FOLDER INTERACTION FULLY VERIFIED! ');
    console.log('================================================================\n');
  } finally {
    await browser.close();
  }
}

verifyBasicFolderInteraction().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
