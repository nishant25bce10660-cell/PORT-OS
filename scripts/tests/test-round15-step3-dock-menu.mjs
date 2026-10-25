import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { recordEvidence } from '../evidence-recorder.mjs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-15');

const DOCK_ITEMS = [
  '#dock-item-finder',
  '#dock-item-widgets',
  '#dock-item-settings',
  '#dock-item-terminal',
  '#dock-item-trash',
  '#dock-sign-out',
];

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844 },
];

async function runStep3Test() {
  console.log('================================================================');
  console.log('  PORT OS — ROUND 15 STEP 3: DOCK MENU SYSTEM AUDIT (EXACTLY 1 MENU)');
  console.log('================================================================\n');

  // 1. Source Code Audit: Verify old dock context menu IDs are completely removed
  console.log('--- Checking for Old Dock Menu Leftovers in Source Code ---');
  const pageTsx = fs.readFileSync('app/page.tsx', 'utf8');
  const dockTsx = fs.readFileSync('components/Dock.tsx', 'utf8');

  const oldIds = ['ctx-dock-open', 'ctx-dock-settings', 'ctx-dock-empty-trash', 'ctx-dock-open-trash'];
  let foundOldIds = [];
  for (const id of oldIds) {
    if (pageTsx.includes(id) || dockTsx.includes(id)) {
      foundOldIds.push(id);
    }
  }

  if (foundOldIds.length > 0) {
    throw new Error(`Old dock menu IDs still present in source: ${foundOldIds.join(', ')}`);
  }
  console.log('Source Code Clean: 0 legacy dock context menu IDs found.\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-modal-overlay', { timeout: 6000 });

  // Authenticate as Admin
  await page.click('#tab-btn-admin');
  await page.type('#input-admin-username', 'admin');
  await page.type('#input-admin-password', 'admin123');
  await page.click('#btn-login-admin');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  await page.waitForSelector('#macos-dock', { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 800));

  console.log('Authenticated as Admin. Beginning Dock Menu tests across items & viewports...\n');

  const itemResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.name} ---`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 400));

    for (const selector of DOCK_ITEMS) {
      const itemEl = await page.waitForSelector(selector, { timeout: 4000 });
      const box = await itemEl.boundingBox();
      const clickX = box.x + box.width / 2;
      const clickY = box.y + box.height / 2;

      // Right-click on dock item
      await page.mouse.click(clickX, clickY, { button: 'right' });
      await page.waitForSelector('.dock-menu', { timeout: 2000 });

      // Measure menu count on page
      const menuStatus = await page.evaluate(() => {
        const menus = document.querySelectorAll('[role="menu"]');
        const legacyMenu = document.getElementById('desktop-context-menu');
        const dockMenu = document.querySelector('.dock-menu');
        const rows = Array.from(document.querySelectorAll('.dock-menu-row')).map((r) => r.innerText.trim());

        return {
          totalMenuRoles: menus.length,
          hasLegacyMenu: !!legacyMenu,
          hasDockMenu: !!dockMenu,
          rowCount: rows.length,
          rows,
        };
      });

      console.log(`Item ${selector} at ${vp.name}:`, {
        menuCount: menuStatus.totalMenuRoles,
        hasLegacy: menuStatus.hasLegacyMenu,
        rows: menuStatus.rows.slice(0, 3),
      });

      const passed =
        menuStatus.totalMenuRoles === 1 &&
        !menuStatus.hasLegacyMenu &&
        menuStatus.hasDockMenu &&
        menuStatus.rowCount >= 2;

      itemResults.push({
        viewport: vp.name,
        selector,
        passed,
        menuStatus,
      });

      // Dismiss menu with Escape
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 200));

      const dismissed = await page.evaluate(() => !document.querySelector('.dock-menu'));
      if (!dismissed) {
        // click outside to dismiss
        await page.mouse.click(100, 100);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  // 2. Test Rapid Right-Clicking 20 Times Quickly
  console.log('\n--- Testing Rapid Right-Clicking (20 Rapid Clicks) ---');
  let rapidPass = true;
  for (let i = 0; i < 20; i++) {
    const itemSelector = DOCK_ITEMS[i % DOCK_ITEMS.length];
    const el = await page.$(itemSelector);
    if (el) {
      const b = await el.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: 'right' });
      await new Promise((r) => setTimeout(r, 60)); // rapid 60ms cadence
      const count = await page.evaluate(() => document.querySelectorAll('[role="menu"]').length);
      if (count > 1) {
        rapidPass = false;
        console.error(`Duplicate menu detected during rapid clicks: ${count} menus`);
        break;
      }
    }
  }
  console.log(`Rapid right-click test: ${rapidPass ? 'PASS (Menu count stayed <= 1)' : 'FAIL'}`);

  // 3. Test Shift+F10 Keyboard Trigger
  console.log('\n--- Testing Keyboard ContextMenu Trigger (Shift+F10) ---');
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));

  await page.focus('#dock-item-finder');
  await page.keyboard.down('Shift');
  await page.keyboard.press('F10');
  await page.keyboard.up('Shift');
  await new Promise((r) => setTimeout(r, 250));

  const keyboardMenuStatus = await page.evaluate(() => {
    const dockMenu = document.querySelector('.dock-menu');
    return {
      isOpen: !!dockMenu,
      count: document.querySelectorAll('[role="menu"]').length,
    };
  });
  console.log('Shift+F10 Menu Trigger:', keyboardMenuStatus);
  const keyboardPassed = keyboardMenuStatus.isOpen && keyboardMenuStatus.count === 1;

  // Screenshot
  const ssPath = 'dock_menu_evidence.png';
  await page.screenshot({ path: path.join(OUT_DIR, ssPath) });

  const allPassed = itemResults.every((r) => r.passed) && rapidPass && keyboardPassed;

  recordEvidence(
    'ROUND15_STEP3_DOCK_MENU',
    allPassed,
    'Dock right-click completely eliminates legacy menu, renders exactly 1 speech-bubble DockMenu with merged features across all items and viewports',
    { itemChecks: itemResults.length, rapidPass, keyboardPassed },
    ssPath
  );

  await browser.close();

  if (!allPassed) {
    console.error('\nSTEP 3 FAILED.');
    process.exit(1);
  } else {
    console.log('\nSTEP 3 PASSED: Exactly 1 dock menu verified clean.');
  }
}

runStep3Test().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
