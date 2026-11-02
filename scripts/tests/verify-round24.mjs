import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

const results = [];

function check(name, passed, details = '') {
  results.push({ name, passed, details });
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${name} ${details ? `(${details})` : ''}`);
  if (!passed) {
    console.error(`    FAILED: ${name}: ${details}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('  ROUND 24 VERIFICATION: REMOVE TERMINAL & SETTINGS FROM HOME    ');
  console.log('  SCREEN AND KEEP THEM PERSISTENT IN THE NAVIGATION BAR         ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[PAGE LOG ${msg.type()}]:`, msg.text());
    }
  });

  try {
    console.log('--- Step 1: Navigate to Home Screen ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Handle Login Modal if shown
    try {
      const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 3000 });
      if (loginOverlay) {
        console.log('  Logging in as Guest Reviewer...');
        const guestAvatar = await page.$('#avatar-select-guest');
        if (guestAvatar) {
          await guestAvatar.click();
          await new Promise((r) => setTimeout(r, 400));
        }
        await page.waitForSelector('#input-viewer-name', { timeout: 3000 });
        await page.type('#input-viewer-name', 'Guest Reviewer');
        await page.type('#input-viewer-email', 'reviewer@example.com');
        await page.click('#btn-login-viewer');
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      // Login overlay not displayed (already authenticated)
    }

    // Handle Lock screen if active
    try {
      const lockScreen = await page.waitForSelector('#lock-screen-unlock-btn', { timeout: 3000 });
      if (lockScreen) {
        console.log('  Unlocking lock screen...');
        await lockScreen.click();
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (e) {
      // No lock screen or already unlocked
    }

    // Wait for desktop workspace
    await page.waitForSelector('#desktop-workspace', { timeout: 15000 });
    console.log('  Desktop workspace loaded.');

    console.log('\n--- Step 2: Verify Desktop Icons (Terminal & Settings Removed) ---');
    const desktopTerminal = await page.$('#desktop-item-terminal');
    check('Desktop item Terminal is ABSENT from home screen', desktopTerminal === null, 'Terminal icon removed from desktop');

    const desktopSettings = await page.$('#desktop-item-settings');
    check('Desktop item Settings is ABSENT from home screen', desktopSettings === null, 'Settings icon removed from desktop');

    // Verify root folders remain on home screen
    const desktopProjects = await page.$('#desktop-item-projects');
    check('Desktop item Projects is PRESENT', desktopProjects !== null, 'Projects folder exists');

    const desktopCert = await page.$('#desktop-item-cert-education');
    check('Desktop item Cert & Education is PRESENT', desktopCert !== null, 'Cert & Education folder exists');

    const desktopOwners = await page.$('#desktop-item-owners-data');
    check('Desktop item Owners Data is PRESENT', desktopOwners !== null, 'Owners Data folder exists');

    console.log('\n--- Step 3: Verify Dock Navigation Bar (Terminal & Settings Present) ---');
    const dockTerminal = await page.$('#dock-item-terminal');
    check('Dock item Terminal is PRESENT in Dock nav bar', dockTerminal !== null, 'Terminal is available in Dock');

    const dockSettings = await page.$('#dock-item-settings');
    check('Dock item Settings is PRESENT in Dock nav bar', dockSettings !== null, 'Settings is available in Dock');

    // Test clicking Dock Terminal
    if (dockTerminal) {
      await dockTerminal.click();
      await new Promise((r) => setTimeout(r, 800));
      const terminalWindow = await page.$('#window-terminal');
      check('Clicking Dock Terminal opens Terminal window', terminalWindow !== null, 'Terminal window opened');

      // Close it if close button exists
      const closeBtn = await page.$('#window-terminal button[aria-label="Close"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // Test clicking Dock Settings
    if (dockSettings) {
      await dockSettings.click();
      await new Promise((r) => setTimeout(r, 800));
      const settingsWindow = await page.$('#window-system-settings');
      check('Clicking Dock Settings opens Settings window', settingsWindow !== null, 'Settings window opened');

      // Close it
      const closeBtn = await page.$('#window-system-settings button[aria-label="Close"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log('\n--- Step 4: Verify Top Menu Bar Navigation (Terminal & Settings Present) ---');
    const topMenuTerminal = await page.$('#menu-item-top-terminal');
    check('Top Menu Bar Terminal item is PRESENT', topMenuTerminal !== null, 'Direct Terminal item on menu strip');

    const topMenuSettings = await page.$('#menu-item-top-settings');
    check('Top Menu Bar Settings item is PRESENT', topMenuSettings !== null, 'Direct Settings item on menu strip');

    // Test clicking top Menu Bar Terminal
    if (topMenuTerminal) {
      await topMenuTerminal.click();
      await new Promise((r) => setTimeout(r, 800));
      const terminalWindow = await page.$('#window-terminal');
      check('Clicking Menu Bar Terminal opens Terminal window', terminalWindow !== null, 'Terminal window opened from menu bar');

      const closeBtn = await page.$('#window-terminal button[aria-label="Close"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // Test clicking top Menu Bar Settings
    if (topMenuSettings) {
      await topMenuSettings.click();
      await new Promise((r) => setTimeout(r, 800));
      const settingsWindow = await page.$('#window-system-settings');
      check('Clicking Menu Bar Settings opens Settings window', settingsWindow !== null, 'Settings window opened from menu bar');

      const closeBtn = await page.$('#window-system-settings button[aria-label="Close"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // Check system dropdown items as well
    const appleMenuBtn = await page.$('#menu-item-apple');
    if (appleMenuBtn) {
      await appleMenuBtn.click();
      await new Promise((r) => setTimeout(r, 300));

      const sysSettingsItem = await page.$('#menu-item-settings');
      check('System Menu dropdown contains System Settings...', sysSettingsItem !== null, 'Settings in dropdown');

      const sysTerminalItem = await page.$('#menu-item-terminal');
      check('System Menu dropdown contains Terminal (portsh)...', sysTerminalItem !== null, 'Terminal in dropdown');

      // Click outside to close menu
      await page.click('#desktop-workspace');
    }

    console.log('\n================================================================');
    const allPassed = results.every((r) => r.passed);
    console.log(`  SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} CHECKS PASSED`);
    console.log(`  OVERALL STATUS: ${allPassed ? 'SUCCESS - ALL GATES PASSED' : 'FAILURE'}`);
    console.log('================================================================\n');

    if (!allPassed) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
