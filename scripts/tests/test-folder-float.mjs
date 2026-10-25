import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve('report_assets/folder-float');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runFolderFloatTests() {
  console.log('================================================================');
  console.log('     PORT OS — REACT BITS FOLDERFLOAT PHYSICS AUDIT             ');
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
    await page.type('#input-viewer-name', 'FolderFloat Auditor');
    await page.type('#input-viewer-email', 'auditor@folderfloat.internal');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
    console.log('Logged in and Desktop Icons mounted.');

    // 2. Test Hover to unfold FolderFloat pills
    console.log('\n[STEP 2] Testing Hover over Projects Folder to float components...');
    const projectsFolder = await page.$('#desktop-item-projects');
    const pBox = await projectsFolder.boundingBox();
    const pCenterX = pBox.x + pBox.width / 2;
    const pCenterY = pBox.y + pBox.height / 2;

    // Hover over the Projects folder icon
    await page.mouse.move(pCenterX, pCenterY);
    await new Promise((r) => setTimeout(r, 600));

    // Verify folder-float has opened and rendered items
    const floatData = await page.evaluate(() => {
      const folderEl = document.querySelector('#desktop-item-projects .folder-float');
      const isOpen = folderEl?.hasAttribute('data-open');
      const items = Array.from(document.querySelectorAll('#desktop-item-projects .folder-float__item'));
      const itemLabels = items.map((it) => it.textContent?.trim());
      const firstItem = items[0];
      const firstStyle = firstItem ? window.getComputedStyle(firstItem) : null;
      return {
        hasFolderFloat: !!folderEl,
        isOpen,
        itemCount: items.length,
        itemLabels,
        firstItemOpacity: firstStyle?.opacity,
        firstItemVisible: firstStyle?.opacity === '1',
      };
    });

    console.log('FolderFloat state on hover:', floatData);
    assert(floatData.hasFolderFloat, 'FolderFloat component must be rendered within desktop icon');
    assert(floatData.isOpen, 'FolderFloat must have data-open attribute active on hover');
    assert(floatData.itemCount >= 2, `Folder must render at least 2 floating pills (got ${floatData.itemCount})`);
    assert(
      floatData.itemLabels.some((l) => l.includes('Distributed-KV-Store') || l.includes('Portfolio-OS')),
      'Floating pills must display folder file names'
    );

    // Screenshot evidence of floating pills
    const ss1 = path.join(EVIDENCE_DIR, '01-folder-float-hover-cloud.png');
    await page.screenshot({ path: ss1 });
    console.log(`Hover cloud screenshot saved to: ${ss1}`);

    // 3. Test Clicking once on a floating component pill to open it
    console.log('\n[STEP 3] Testing Clicking once on floating pill to open component file...');
    const firstPill = await page.$('#desktop-item-projects .folder-float__item');
    assert(firstPill, 'Floating pill must exist');

    await firstPill.click();
    await new Promise((r) => setTimeout(r, 500));

    // Verify file window opened
    const fileWindowOpened = await page.evaluate(() => {
      const win = document.querySelector('[id^="window-file-"]');
      return !!win;
    });
    console.log(`Component file window opened upon single click: ${fileWindowOpened}`);
    assert(fileWindowOpened, 'Single clicking a floating pill must open the component file window');

    // Close the file window
    const closeFileBtn = await page.$('[id^="window-file-"] [id^="btn-close-"]');
    if (closeFileBtn) {
      await closeFileBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    // 4. Test Double Clicking the Folder Icon itself
    console.log('\n[STEP 4] Testing Double Clicking the Folder Icon to open folder in Finder...');
    // Unhover first
    await page.mouse.move(100, 100);
    await new Promise((r) => setTimeout(r, 300));

    // Double click the Projects folder
    await page.click('#desktop-item-projects', { clickCount: 2 });
    await page.waitForSelector('#window-folder-projects', { timeout: 4000 });
    console.log('Projects folder Finder window opened upon double-click.');

    // Close folder window
    await page.click('#btn-close-folder-projects');
    await new Promise((r) => setTimeout(r, 300));

    // 5. Test Single Click on Folder Icon selects it
    console.log('\n[STEP 5] Testing Single Click on Folder Icon selects it...');
    await page.click('#desktop-item-projects');
    await new Promise((r) => setTimeout(r, 200));

    const isSelected = await page.evaluate(() => {
      const el = document.getElementById('desktop-item-projects');
      const icon = el?.querySelector('.portos-app-icon');
      return {
        hasIsSelected: el?.classList.contains('is-selected'),
        hasIconSelected: icon?.classList.contains('portos-app-icon--selected'),
      };
    });
    console.log('Desktop icon selection state:', isSelected);
    assert(isSelected.hasIsSelected, 'Single click must select the desktop folder icon');

    const ss2 = path.join(EVIDENCE_DIR, '02-folder-float-double-click-open.png');
    await page.screenshot({ path: ss2 });
    console.log(`Folder open screenshot saved to: ${ss2}`);

    console.log('\n================================================================');
    console.log('     ALL REACT BITS FOLDERFLOAT VERIFICATION CHECKS PASSED!     ');
    console.log('================================================================');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED with error: <<<', err);
    await browser.close();
    process.exit(1);
  }
}

runFolderFloatTests();
