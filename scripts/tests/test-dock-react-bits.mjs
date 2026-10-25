import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve('report_assets/dock-react-bits');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runDockReactBitsTests() {
  console.log('================================================================');
  console.log('    PORT OS — REACT BITS DOCK & SPEECH-BUBBLE CALLOUT AUDIT      ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // 1. Setup & Authenticate
    console.log('[STEP 1] Navigating and logging in...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('portos_booted', 'true'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#login-card', { timeout: 5000 });
    await page.type('#input-viewer-name', 'ReactBits Auditor');
    await page.type('#input-viewer-email', 'auditor@reactbits.internal');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await page.waitForSelector('#macos-dock', { timeout: 5000 });
    console.log('Logged in and Dock mounted.');

    // 2. Test Right-Click Speech Bubble Callout Menu
    console.log('\n[STEP 2] Testing Right-Click Speech-Bubble Callout on Finder...');
    const finderBtn = await page.$('#dock-item-finder');
    const fBox = await finderBtn.boundingBox();
    const fCenterX = fBox.x + fBox.width / 2;
    const fCenterY = fBox.y + fBox.height / 2;

    // Right-click on Finder dock icon
    await page.mouse.click(fCenterX, fCenterY, { button: 'right' });
    await page.waitForSelector('.dock-menu', { timeout: 3000 });
    console.log('Speech-bubble callout menu opened via right-click.');

    // Verify SVG speech bubble path and tail
    const menuData = await page.evaluate(() => {
      const menu = document.querySelector('.dock-menu');
      const svg = menu.querySelector('svg');
      const path = svg.querySelector('path');
      const rows = Array.from(menu.querySelectorAll('.dock-menu-row')).map((r) => r.textContent.trim());
      const rect = menu.getBoundingClientRect();
      const pathD = path?.getAttribute('d') || '';
      return {
        hasSvg: !!svg,
        hasPath: !!path,
        hasTailInPath: pathD.includes('L') && pathD.includes('H') && pathD.includes('A'),
        rows,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      };
    });

    console.log(`Menu rendered with SVG tail: ${menuData.hasTailInPath}`);
    console.log(`Menu rows:`, menuData.rows);
    assert(menuData.hasSvg && menuData.hasPath, 'Menu must render SVG background');
    assert(menuData.hasTailInPath, 'SVG path must construct speech-bubble tail pointing to item');
    assert(menuData.rows.some((r) => r.includes('Open Finder')), 'Finder right-click menu must have Open Finder option');

    // Screenshot evidence of callout bubble
    const ss1 = path.join(EVIDENCE_DIR, '01-right-click-speech-bubble.png');
    await page.screenshot({ path: ss1 });
    console.log(`Callout screenshot saved to: ${ss1}`);

    // 3. Test Row Hover & Sliding Highlight Bar
    console.log('\n[STEP 3] Testing Sliding Highlight Bar and Selection Blink...');
    const firstRow = await page.$('.dock-menu-row');
    const rowBox = await firstRow.boundingBox();
    await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await new Promise((r) => setTimeout(r, 120));

    const highlightOpacity = await page.evaluate(() => {
      const highlight = document.querySelector('.dock-menu-highlight');
      return window.getComputedStyle(highlight).opacity;
    });
    console.log(`Highlight pill opacity on hover: ${highlightOpacity}`);
    assert(parseFloat(highlightOpacity) > 0, 'Highlight pill must be visible on hover');

    // Click row and verify window opens and menu closes
    await firstRow.click();
    await new Promise((r) => setTimeout(r, 200));

    const menuClosed = await page.evaluate(() => !document.querySelector('.dock-menu'));
    console.log(`Menu closed after row selection: ${menuClosed}`);
    assert(menuClosed, 'Callout menu must auto-close after row selection');

    // Verify Projects/Finder window opened
    await page.waitForSelector('#window-folder-projects', { timeout: 4000 });
    console.log('Finder/Projects window successfully opened from callout menu action.');

    // 4. Test Auto-Adjustable Window Size Resizing
    console.log('\n[STEP 4] Testing Auto-Adjustable Dock Scaling on Window Resize...');
    // Resize viewport to narrow width (e.g. 640px)
    await page.setViewport({ width: 640, height: 800 });
    await new Promise((r) => setTimeout(r, 300));

    const narrowFitRatio = await page.evaluate(() => {
      const dock = document.getElementById('macos-dock');
      const comp = window.getComputedStyle(dock);
      const scaleVar = comp.getPropertyValue('--dock-scale');
      const rect = dock.getBoundingClientRect();
      return {
        scaleVar: parseFloat(scaleVar),
        dockWidth: rect.width,
        fitsInViewport: rect.right <= 640 && rect.left >= 0,
      };
    });

    console.log(`Narrow viewport fit ratio: ${narrowFitRatio.scaleVar}`);
    console.log(`Dock width at 640px viewport: ${narrowFitRatio.dockWidth}px`);
    console.log(`Dock fits within 640px screen bounds: ${narrowFitRatio.fitsInViewport}`);
    assert(narrowFitRatio.scaleVar < 1, 'Fit ratio must scale down on smaller viewports');
    assert(narrowFitRatio.fitsInViewport, 'Dock must fit within viewport bounds without clipping');

    // Test Right-Click clamped within narrow window bounds
    const narrowTerminalBtn = await page.$('#dock-item-terminal');
    const tBox = await narrowTerminalBtn.boundingBox();
    await page.mouse.click(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { button: 'right' });
    await page.waitForSelector('.dock-menu', { timeout: 3000 });

    const narrowMenuClamped = await page.evaluate(() => {
      const menu = document.querySelector('.dock-menu');
      const rect = menu.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        clamped: rect.left >= 0 && rect.right <= 640,
      };
    });
    console.log(`Callout menu clamped in 640px viewport:`, narrowMenuClamped);
    assert(narrowMenuClamped.clamped, 'Callout menu must clamp within narrow viewport bounds');

    const ss2 = path.join(EVIDENCE_DIR, '02-auto-adjusted-narrow-dock.png');
    await page.screenshot({ path: ss2 });
    console.log(`Narrow dock screenshot saved to: ${ss2}`);

    // Dismiss menu with Escape
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 200));
    const dismissedOnEsc = await page.evaluate(() => !document.querySelector('.dock-menu'));
    assert(dismissedOnEsc, 'Menu must dismiss on Escape key');

    console.log('\n================================================================');
    console.log('       ALL REACT BITS DOCK & CALLOUT TESTS PASSED GREEN!         ');
    console.log('================================================================');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED with error: <<<', err);
    await browser.close();
    process.exit(1);
  }
}

runDockReactBitsTests();
