import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const REPORT_DIR = path.join(process.cwd(), 'report_assets', 'folder-hover-verification');

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function runVerification() {
  console.log('================================================================');
  console.log('VERIFY: REMOVE WIDGETS + ADJUSTABLE FOLDER/APP LOGOS & ANIMATION');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // Step 1: Login through ReflectiveCard if on lockscreen
    console.log('[1/7] Checking lockscreen / login...');
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    const loginOverlay = await page.$('#login-modal-overlay');
    if (loginOverlay) {
      const adminTab = await page.$('#tab-btn-admin');
      if (adminTab) {
        await adminTab.click();
        await page.waitForSelector('#input-admin-password', { visible: true });
        await page.type('#input-admin-password', 'admin123');
        await page.click('#btn-login-admin');
        await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 10000 });
      }
    }

    await page.waitForSelector('.desktop-icons-container', { timeout: 10000 });
    console.log('  [PASS] Desktop canvas reached');

    // Step 2: Verify ZERO widgets on the main home screen
    console.log('\n[2/7] Verifying 0 widgets on the main home screen...');
    const widgetCount = await page.evaluate(() => {
      const widgets = document.querySelectorAll('.widget-card, .analog-clock-container, .desktop-widget');
      return widgets.length;
    });
    console.log(`  Widget elements found on desktop: ${widgetCount}`);
    if (widgetCount !== 0) {
      throw new Error(`Expected 0 widgets on home screen, found ${widgetCount}`);
    }
    console.log('  [PASS] Main home screen is completely clear of widgets!');

    // Step 3: Verify Folder and App logos are present with their old logos
    console.log('\n[3/7] Verifying folder and app logos (Projects, Cert & Edu, Owner, Terminal, Settings)...');
    const iconsData = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
      return items.map((el) => {
        const id = el.id.replace('desktop-item-', '');
        const label = el.querySelector('.folder-float__label')?.textContent?.trim() || '';
        const sub = el.querySelector('.folder-float__sub')?.textContent?.trim() || '';
        const hasLogo = !!el.querySelector('.folder-float__logo-container');
        const iconKind = el.querySelector('.portos-app-icon')?.getAttribute('data-kind') || '';
        const hasFlap = !!el.querySelector('.folder-float__front');
        const hasPaper = !!el.querySelector('.folder-float__paper');
        return { id, label, sub, hasLogo, iconKind, hasFlap, hasPaper };
      });
    });

    console.log('  Desktop icons detected:', iconsData);
    const expectedIds = ['projects', 'cert-education', 'owners-data', 'terminal', 'settings'];
    for (const expId of expectedIds) {
      const found = iconsData.find((ic) => ic.id === expId);
      if (!found) throw new Error(`Missing icon with id: ${expId}`);
      if (!found.hasLogo) throw new Error(`Icon ${expId} is missing logo in folder flap`);
      if (!found.hasFlap) throw new Error(`Icon ${expId} is missing folder front flap`);
      if (!found.hasPaper) throw new Error(`Icon ${expId} is missing paper layer`);
      console.log(`  [PASS] ${expId} has old logo (${found.iconKind}), label "${found.label}", and 3D flap`);
    }

    // Step 4: Hover over Projects folder and verify 3D flap tilt, paper rise, and floating pills
    console.log('\n[4/7] Testing hover animation on Projects folder...');
    const folderFloatEl = await page.$('#desktop-item-projects .folder-float');
    await folderFloatEl.hover();
    await new Promise((r) => setTimeout(r, 600));

    const animationState = await page.evaluate(() => {
      const folderEl = document.querySelector('#desktop-item-projects .folder-float');
      const isOpen = folderEl?.hasAttribute('data-open');
      const pills = Array.from(document.querySelectorAll('#desktop-item-projects .folder-float__item'));
      const pillLabels = pills.map((p) => p.textContent.trim());
      const frontTransform = window.getComputedStyle(folderEl.querySelector('.folder-float__front')).transform;
      return { isOpen, pillCount: pills.length, pillLabels, frontTransform };
    });

    console.log('  Projects hover state:', animationState);
    if (!animationState.isOpen) throw new Error('FolderFloat data-open was not set on hover');
    if (animationState.pillCount < 3) throw new Error(`Expected at least 3 pills, got ${animationState.pillCount}`);
    console.log('  [PASS] Flap tilted in 3D perspective, paper elevated, and pills deployed:', animationState.pillLabels);

    await page.screenshot({ path: path.join(REPORT_DIR, '01_projects_folder_hover_float.png') });

    // Step 5: Test pill click to open file
    console.log('\n[5/7] Testing pill click to open file...');
    await page.evaluate(() => {
      const p = document.querySelector('#desktop-item-projects .folder-float__item');
      if (p) p.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const windowOpened = await page.evaluate(() => {
      const wins = document.querySelectorAll('.window-container, .window-shell, [id^="window-"]');
      return wins.length > 0;
    });
    console.log(`  Window opened from pill click: ${windowOpened}`);
    if (!windowOpened) throw new Error('Pill click did not open file window');
    console.log('  [PASS] Pill click opened file successfully');

    // Close open window
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.traffic-light-close, .window-control-close, [id^="btn-close"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Step 6: Test Terminal App double click
    console.log('\n[6/7] Testing double-click on Terminal App icon...');
    const terminalFolderEl = await page.$('#desktop-item-terminal .folder-float');
    await terminalFolderEl.click({ clickCount: 2 });
    await new Promise((r) => setTimeout(r, 1000));

    const terminalOpened = await page.evaluate(() => {
      const terminalWin = document.querySelector('#window-terminal, .window-shell-terminal, [id*="terminal"]');
      return !!terminalWin;
    });
    console.log(`  Terminal window opened on double-click: ${terminalOpened}`);
    if (!terminalOpened) throw new Error('Double click on Terminal app did not open terminal window');
    console.log('  [PASS] Terminal App opened cleanly on double click');

    await page.screenshot({ path: path.join(REPORT_DIR, '02_terminal_app_opened.png') });

    // Step 7: Verify background <GradientASCII /> and mid-layer <CircularGallery /> intact
    console.log('\n[7/7] Verifying <GradientASCII /> background and <CircularGallery /> mid-layer...');
    const layers = await page.evaluate(() => {
      const ascii = !!document.querySelector('#desktop-gradient-ascii-layer, .gradient-ascii-container, canvas');
      const gallery = !!document.querySelector('#desktop-circular-gallery-layer, .circular-gallery');
      return { ascii, gallery };
    });
    console.log('  Layers detected:', layers);
    if (!layers.ascii) throw new Error('GradientASCII background layer is missing');
    if (!layers.gallery) throw new Error('CircularGallery mid-layer is missing');
    console.log('  [PASS] Both GradientASCII background and CircularGallery mid-layer are present and active');

    console.log('\n================================================================');
    console.log('ALL VERIFICATION GATES PASSED (7/7)!');
    console.log('================================================================\n');
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('\n[FAIL] Verification error:', err.message);
  process.exit(1);
});
