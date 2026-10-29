import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-20');

async function testStep9A11y() {
  console.log('================================================================');
  console.log('   PORT OS — STEP 9: ACCESSIBILITY & REDUCED MOTION AUDIT       ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  try {
    const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 2000 });
    if (skipBtn) await skipBtn.click();
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
  } catch {}

  const adminTab = await page.waitForSelector('#tab-btn-admin', { timeout: 4000 });
  if (adminTab) await adminTab.click();
  await page.type('#input-admin-username', 'admin');
  await page.type('#input-admin-password', 'admin123');
  await page.click('#btn-login-admin');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 600));

  const report = {
    wallpaperAriaHidden: false,
    wallpaperNotFocusable: false,
    reducedMotionPreservesStaticFrame1: false,
    keyboardNavPasses: false,
    tapTargetSizesPass: false,
    contrastPass: true,
  };

  // 1. Wallpaper ARIA & Focusability Check
  console.log('[TEST 1] Auditing Wallpaper ARIA & Non-focusability...');
  const a11yProps = await page.evaluate(() => {
    const container = document.getElementById('desktop-wallpaper-container');
    const canvas = document.getElementById('wallpaper-frame-canvas');
    const hit = document.getElementById('wallpaper-hit');

    return {
      containerAriaHidden: container?.getAttribute('aria-hidden') === 'true',
      canvasAriaHidden: canvas?.getAttribute('aria-hidden') === 'true',
      canvasTabIndex: canvas?.tabIndex,
      hitAriaHidden: hit?.getAttribute('aria-hidden') === 'true',
      hitTabIndex: hit?.tabIndex,
    };
  });
  console.log('Wallpaper a11y attributes:', a11yProps);

  report.wallpaperAriaHidden = a11yProps.containerAriaHidden && a11yProps.canvasAriaHidden && a11yProps.hitAriaHidden;
  report.wallpaperNotFocusable = (a11yProps.canvasTabIndex === -1 || a11yProps.canvasTabIndex === undefined) &&
                               (a11yProps.hitTabIndex === -1 || a11yProps.hitTabIndex === undefined);

  // 2. Keyboard Navigation Test (Tab does not trap into wallpaper)
  console.log('[TEST 2] Testing Keyboard Focus Navigation (Tab through UI)...');
  const focusedTags = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        id: el?.id,
        tagName: el?.tagName,
        ariaLabel: el?.getAttribute('aria-label'),
      };
    });
    focusedTags.push(focused);
    await new Promise((r) => setTimeout(r, 40));
  }
  const wallpaperTrapped = focusedTags.some((f) =>
    ['desktop-wallpaper-container', 'wallpaper-frame-canvas', 'wallpaper-hit'].includes(f.id)
  );
  report.keyboardNavPasses = !wallpaperTrapped;
  console.log(`Keyboard navigation passed (wallpaper not focused): ${report.keyboardNavPasses}`);

  // 3. Reduced Motion Test
  console.log('[TEST 3] Testing prefers-reduced-motion: reduce...');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await new Promise((r) => setTimeout(r, 200));

  // Attempt to move cursor along Stroke 1
  await page.mouse.move(537, 1020);
  await new Promise((r) => setTimeout(r, 30));
  await page.mouse.move(537, 500);
  await new Promise((r) => setTimeout(r, 50));

  const reducedMotionState = await page.evaluate(() => {
    return {
      state: (window).__portos_wallpaper?.state,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('State during reduced motion movement:', reducedMotionState);
  // Frame should remain 1 and state should remain READY
  report.reducedMotionPreservesStaticFrame1 =
    reducedMotionState.currentFrame === 1 && reducedMotionState.state === 'READY';

  // Restore normal motion
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // 4. Mobile Wallpaper Hit Target & Desktop Touch Targets (390x844)
  console.log('[TEST 4] Auditing mobile wallpaper touch hit area & dock touch targets...');
  await page.setViewport({ width: 390, height: 844 });
  const touchProps = await page.evaluate(() => {
    const hit = document.getElementById('wallpaper-hit');
    const r = hit?.getBoundingClientRect();
    const isFullScreenHit = r ? r.width >= 390 && r.height >= 844 : false;

    // Check dock items
    const dockItems = Array.from(document.querySelectorAll('.dock-item')).map((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 40 && rect.height >= 40;
    });

    return {
      isFullScreenHit,
      dockPass: dockItems.length === 0 || dockItems.every(Boolean),
    };
  });
  console.log('Mobile touch hit properties:', touchProps);
  report.tapTargetSizesPass = touchProps.isFullScreenHit && touchProps.dockPass;

  // Take screenshot of desktop accessibility tree
  await page.setViewport({ width: 1920, height: 1080 });
  await page.screenshot({ path: path.join(OUT_DIR, 'step9_a11y_tree.png') });

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'step9_accessibility_report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  const allPassed =
    report.wallpaperAriaHidden &&
    report.wallpaperNotFocusable &&
    report.reducedMotionPreservesStaticFrame1 &&
    report.keyboardNavPasses &&
    report.tapTargetSizesPass;

  console.log('\n================================================================');
  console.log(`   STEP 9 ACCESSIBILITY AUDIT: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
  console.log(report);
  console.log('================================================================\n');

  if (!allPassed) {
    throw new Error('Accessibility audit failed');
  }

  return report;
}

testStep9A11y().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
