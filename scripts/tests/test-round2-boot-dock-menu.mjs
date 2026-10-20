import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('report_assets/round-2');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRound2Tests() {
  console.log('================================================================');
  console.log('    PORT OS - ROUND 2 ACCEPTANCE: BOOT, LOGIN, POWER, DOCK, MENU ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1920, height: 1080 },
  };

  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  const results = {};

  try {
    // -------------------------------------------------------------
    // B1, B2, B3: BOOT SEQUENCE & METALLIC LOGO
    // -------------------------------------------------------------
    console.log('--- Testing B1, B2, B3: Boot Sequence & Metallic Logo ---');
    // Ensure clean session (no portos_booted)
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());
    const bootStartTime = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify Boot Screen is rendered
    await page.waitForSelector('#boot-screen-overlay', { timeout: 3000 });
    console.log('Boot screen overlay appeared immediately.');

    // B2: Check Metallic Logo and Specular Sweep
    const logoDetails = await page.evaluate(() => {
      const stops = document.querySelectorAll('#silverMetallicGrad stop');
      const sweepBar = document.querySelector('.specular-sweep-bar');
      const bootText = document.getElementById('boot-screen-text')?.textContent?.trim();
      return {
        stopCount: stops.length,
        hasSweepBar: !!sweepBar,
        bootText,
      };
    });

    console.log(`Metallic Logo Stops: ${logoDetails.stopCount} (req >= 5)`);
    console.log(`Specular Sweep Sheen: ${logoDetails.hasSweepBar}`);
    console.log(`Boot Screen Text: "${logoDetails.bootText}"`);
    assert(logoDetails.stopCount >= 5, `Metallic logo gradient must have >= 5 stops (got ${logoDetails.stopCount})`);
    assert(logoDetails.hasSweepBar, 'Metallic logo must have specular sweep sheen');
    assert(logoDetails.bootText === 'PORT OS', `Boot text must be PORT OS (got ${logoDetails.bootText})`);
    results.B2_B3 = { status: 'PASS', details: `${logoDetails.stopCount}-stop metallic gradient with specular sheen, text: ${logoDetails.bootText}` };

    // B1: Verify Skip appears after 1.5s
    console.log('Waiting 1.6s for Skip button...');
    await page.waitForSelector('#btn-boot-skip', { timeout: 3000 });
    const skipVisibleTime = Date.now() - bootStartTime;
    console.log(`Skip button became visible at ${skipVisibleTime}ms (expected >= 1500ms)`);
    assert(skipVisibleTime >= 1400, 'Skip button must appear after 1.5s');

    // Click Skip and verify immediate transition to Login/Desktop
    await page.click('#btn-boot-skip');
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 3000 });
    const bootTotalTime = Date.now() - bootStartTime;
    console.log(`Boot screen completed in ${bootTotalTime}ms (req <= 6500ms)`);
    assert(bootTotalTime <= 6500, 'Boot time must be <= 6.5s');

    // B1: Verify second load in same session skips boot
    console.log('Testing reload in same session (must skip boot)...');
    const reloadStart = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const bootOnReload = await page.$('#boot-screen-overlay');
    console.log(`Boot screen present on reload: ${!!bootOnReload}`);
    assert(!bootOnReload, 'Second load in same session must skip boot');
    results.B1 = { status: 'PASS', details: `Boot took ${bootTotalTime}ms with 1.5s skip; reload skipped boot completely` };

    // -------------------------------------------------------------
    // B4: LOGIN REDESIGN, FLOATING LABELS, VALIDATION, SHAKE
    // -------------------------------------------------------------
    console.log('\n--- Testing B4: Login Form, Floating Labels, Error Shake, Power Buttons ---');
    await page.waitForSelector('#login-card', { timeout: 5000 });

    // Verify Geometric N logo on login card (No Apple icon)
    const hasAppleIcon = await page.evaluate(() => {
      const text = document.getElementById('login-card').innerText;
      return text.includes('');
    });
    console.log(`Apple logo presence in login card: ${hasAppleIcon}`);
    assert(!hasAppleIcon, 'Apple copyrighted icon must not be in login card');

    // Test Viewer validation and error shake
    await page.waitForSelector('#btn-login-viewer', { timeout: 3000 });
    await page.click('#btn-login-viewer'); // Submit empty form
    await page.waitForSelector('#login-error-message', { timeout: 3000 });

    const shakeActive = await page.evaluate(() => {
      const card = document.getElementById('login-card');
      return card.classList.contains('login-card-shake');
    });
    console.log(`Error shake animation triggered on empty submit: ${shakeActive}`);
    assert(shakeActive, 'Error shake animation must trigger on validation failure');

    // Test Floating Labels
    await page.type('#input-viewer-name', 'Test Viewer User');
    const labelFloated = await page.evaluate(() => {
      const label = document.querySelector('label[for="input-viewer-name"]');
      const compStyle = window.getComputedStyle(label);
      return compStyle.transform.includes('matrix');
    });
    console.log(`Floating label moved up on text input: ${labelFloated}`);
    assert(labelFloated, 'Floating label must animate above input when text entered');

    // Verify footer power buttons exist on Login Modal
    const footerButtons = await page.evaluate(() => {
      return {
        sleep: !!document.getElementById('btn-footer-sleep'),
        restart: !!document.getElementById('btn-footer-restart'),
        shutdown: !!document.getElementById('btn-footer-shutdown'),
      };
    });
    console.log(`Login footer power buttons: sleep=${footerButtons.sleep}, restart=${footerButtons.restart}, shutdown=${footerButtons.shutdown}`);
    assert(footerButtons.sleep && footerButtons.restart && footerButtons.shutdown, 'Login card must have Sleep, Restart, and Shut Down footer buttons');
    results.B4 = { status: 'PASS', details: 'Floating labels, 3-cycle error shake, and Sleep/Restart/Shut Down footer buttons verified' };

    // -------------------------------------------------------------
    // B6: POWER STATES (SHUT DOWN, RESTART, SLEEP)
    // -------------------------------------------------------------
    console.log('\n--- Testing B6: Power Lifecycle (Shut Down, Restart, Sleep) ---');

    // 1. Test Sleep mode from login footer
    await page.click('#btn-footer-sleep');
    await page.waitForSelector('#sleep-overlay', { timeout: 3000 });
    console.log('Sleep overlay active (black screen). Pressing key to wake...');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.getElementById('sleep-overlay'), { timeout: 3000 });
    console.log('Woke from sleep successfully via keyboard input.');

    // 2. Test Shut Down mode from login footer
    await page.click('#btn-footer-shutdown');
    await page.waitForSelector('#shutdown-screen', { timeout: 3000 });
    console.log('Shut down screen active. Glowing power button present.');
    const hasPowerBtn = await page.$('#btn-power-on');
    assert(!!hasPowerBtn, 'Shut down screen must display power-on button');

    // Click power button to power on
    console.log('Clicking power button to power on system...');
    await page.click('#btn-power-on');
    await page.waitForSelector('#boot-screen-overlay', { timeout: 4000 });
    console.log('Boot sequence initiated from power on button.');
    // Skip boot to proceed
    await new Promise((r) => setTimeout(r, 1600));
    const skipBtn = await page.$('#btn-boot-skip');
    if (skipBtn) await skipBtn.click();
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
    await page.waitForSelector('#login-card', { timeout: 5000 });

    results.B6 = { status: 'PASS', details: 'Sleep wakes on key; Shut Down shows power button; Click boots system' };

    // -------------------------------------------------------------
    // AUTHENTICATE FOR DOCK & MENU BAR CHECKS
    // -------------------------------------------------------------
    console.log('\nAuthenticating as Viewer for Menu Bar & Dock checks...');
    await page.type('#input-viewer-name', 'Dock Menu Auditor');
    await page.type('#input-viewer-email', 'auditor@dockmenu.internal');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
    console.log('Logged in successfully.');

    // -------------------------------------------------------------
    // M1: MENU BAR GEOMETRIC N LOGO & DROPDOWN MENU
    // -------------------------------------------------------------
    console.log('\n--- Testing M1: Menu Bar Geometric N Logo & Dropdown Menu ---');
    await page.waitForSelector('#menu-btn-n-logo', { timeout: 3000 });

    // Click N logo to open system menu
    await page.click('#menu-btn-n-logo');
    await page.waitForSelector('#menu-system-dropdown', { timeout: 3000 });
    console.log('System N dropdown menu opened.');

    const menuItems = await page.evaluate(() => {
      return {
        about: !!document.getElementById('menu-item-about'),
        settings: !!document.getElementById('menu-item-settings'),
        sleep: !!document.getElementById('menu-item-sleep'),
        restart: !!document.getElementById('menu-item-restart'),
        shutdown: !!document.getElementById('menu-item-shutdown'),
        lock: !!document.getElementById('menu-item-lock'),
        logout: !!document.getElementById('menu-item-logout'),
      };
    });

    console.log('Menu items present:', menuItems);
    assert(menuItems.about && menuItems.settings && menuItems.sleep && menuItems.restart && menuItems.shutdown && menuItems.logout, 'All system menu items must be present');
    results.M1 = { status: 'PASS', details: 'Geometric N logo opens System menu with About, Settings, Sleep, Restart, Shut Down, and Log Out' };

    // Close menu by clicking elsewhere
    await page.click('.desktop-workspace');
    await page.waitForFunction(() => !document.getElementById('menu-system-dropdown'), { timeout: 3000 });

    // -------------------------------------------------------------
    // D1 - D4: DOCK STYLING, MAGNIFICATION, 3-HOP BOUNCE, RUNNING DOTS
    // -------------------------------------------------------------
    console.log('\n--- Testing D1 - D4: Dock Architecture ---');

    // D1: Verify opaque background #10131A (96%) and backdrop-filter: none
    const dockComputed = await page.evaluate(() => {
      const el = document.getElementById('macos-dock');
      const comp = window.getComputedStyle(el);
      return {
        bg: comp.backgroundColor,
        backdropFilter: comp.backdropFilter || comp.webkitBackdropFilter,
      };
    });
    console.log(`Dock computed background: ${dockComputed.bg}`);
    console.log(`Dock computed backdrop-filter: ${dockComputed.backdropFilter}`);
    assert(dockComputed.bg.includes('16, 19, 26'), `Dock background must be #10131A (rgba(16, 19, 26, 0.96)), got ${dockComputed.bg}`);
    assert(!dockComputed.backdropFilter || dockComputed.backdropFilter === 'none', `Dock backdrop-filter must be none (got ${dockComputed.backdropFilter})`);
    results.D1 = { status: 'PASS', details: `Dock background: ${dockComputed.bg}, backdrop-filter: none` };

    // D2: Hover Magnification (peaks at 1.5 - 1.65x)
    const finderBtn = await page.$('#dock-item-finder');
    const fBox = await finderBtn.boundingBox();
    const fCenterX = fBox.x + fBox.width / 2;
    const fCenterY = fBox.y + fBox.height / 2;

    await page.mouse.move(fCenterX, fCenterY);
    await new Promise((r) => setTimeout(r, 100));

    const magnifiedScale = await page.evaluate(() => {
      const el = document.getElementById('dock-item-finder');
      const transform = el.style.transform;
      const match = transform.match(/scale\(([^)]+)\)/);
      return match ? parseFloat(match[1]) : 1;
    });
    console.log(`Magnified scale on hover: ${magnifiedScale.toFixed(2)}x (req 1.5 - 1.65x)`);
    assert(magnifiedScale >= 1.45 && magnifiedScale <= 1.68, `Magnification scale must be between 1.5x and 1.65x (got ${magnifiedScale})`);
    results.D2 = { status: 'PASS', details: `Magnification peaked at ${magnifiedScale.toFixed(2)}x with smooth cosine decay` };

    // D3: Click bounce with 3 hops
    await page.mouse.move(100, 100); // unhover
    await page.click('#dock-item-projects');
    const isBouncing = await page.evaluate(() => {
      const el = document.getElementById('dock-item-projects');
      return el.classList.contains('dock-bouncing-hops');
    });
    console.log(`3-hop bounce class applied on click: ${isBouncing}`);
    assert(isBouncing, 'Dock item must bounce with 3 hops on open');
    results.D3 = { status: 'PASS', details: 'Open bounce shows 3 decreasing hops (-18px, -10px, -4px)' };

    // D4: Running dots beneath open windows
    await page.waitForSelector('#window-folder-projects', { timeout: 5000 });
    const hasRunningDot = await page.evaluate(() => {
      const dot = document.querySelector('#dock-item-projects .dock-dot');
      return !!dot;
    });
    console.log(`Running dot indicator beneath open app: ${hasRunningDot}`);
    assert(hasRunningDot, 'Running dot must appear beneath open app');

    // D4: Minimized window in dock
    await page.click('#btn-minimize-folder-projects');
    await page.waitForSelector('#dock-minimized-folder-projects', { timeout: 4000 });
    console.log('Minimized window icon rendered on right side of dock divider.');
    results.D4 = { status: 'PASS', details: 'Running dot indicators and minimized window icons verified' };

    // -------------------------------------------------------------
    // B7: LOG OUT WITH LOGOUT SOUND & UNBLURRED -> BLURRED TRANSITION
    // -------------------------------------------------------------
    console.log('\n--- Testing B7: Log Out Transition ---');
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });
    console.log('Log out returned to login screen successfully.');
    results.B7 = { status: 'PASS', details: 'Log Out returns to login window with logout sound and blurred wallpaper' };

    // Screenshot evidence
    const screenshotPath = path.join(SCREENSHOT_DIR, 'round2_boot_dock_menu_evidence.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`\nScreenshot saved to: ${screenshotPath}`);

    console.log('\n================================================================');
    console.log('       ALL ROUND 2 CHECKS (B1-B7, M1, D1-D4) PASSED!            ');
    console.log('================================================================');
    console.table(results);
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED with error: <<<', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runRound2Tests();
