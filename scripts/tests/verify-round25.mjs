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
  console.log('  ROUND 25 VERIFICATION: REMOVE CUSTOMIZATION, BOOT & FONT       ');
  console.log('  MENUS FROM SETTINGS FOR GUEST ONLY (KEPT FOR OWNER/ADMIN)     ');
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

  const client = await page.target().createCDPSession();

  try {
    // =================================================================
    // PART 1: GUEST PERSPECTIVE
    // =================================================================
    console.log('--- PART 1: GUEST / VIEWER PERSPECTIVE ---');
    await client.send('Network.clearBrowserCookies');

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 15000 });

    // Enter as Guest
    const guestAvatar = await page.$('#avatar-select-guest');
    if (guestAvatar) {
      await guestAvatar.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    await page.waitForSelector('#input-viewer-name', { timeout: 5000 });
    await page.type('#input-viewer-name', 'Guest Reviewer');
    await page.type('#input-viewer-email', 'reviewer@example.com');
    await page.click('#btn-login-viewer');

    await page.waitForSelector('#desktop-workspace', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Open System Settings via top menu or dock
    const menuSettings = await page.$('#menu-item-top-settings');
    if (menuSettings) {
      await menuSettings.click();
    } else {
      await page.click('#dock-item-settings');
    }

    await page.waitForSelector('#window-system-settings', { timeout: 10000 });
    console.log('  Settings window opened for Guest.');

    // 1.1 Verify Customization tab button is ABSENT
    const guestCustomizationTab = await page.$('#settings-tab-customization, button[data-tab="customization"]');
    check('Guest Settings: Customization tab button is ABSENT', guestCustomizationTab === null, 'Customization tab removed for guest');

    // 1.2 Verify Boot tab button is ABSENT
    const guestBootTab = await page.$('#settings-tab-boot, button[data-tab="boot"]');
    check('Guest Settings: Boot tab button is ABSENT', guestBootTab === null, 'Boot tab removed for guest');

    // 1.3 Verify Fonts tab button is ABSENT
    const guestFontsTab = await page.$('#settings-tab-fonts, button[data-tab="fonts"]');
    check('Guest Settings: Fonts tab button is ABSENT', guestFontsTab === null, 'Fonts tab removed for guest');

    // 1.4 Verify General tab is PRESENT
    const guestGeneralTab = await page.$('button[data-tab="general"]');
    check('Guest Settings: General tab button is PRESENT', guestGeneralTab !== null, 'General tab present for guest');

    // 1.5 Verify Security tab is PRESENT
    const guestSecurityTab = await page.$('button[data-tab="security"]');
    check('Guest Settings: Security tab button is PRESENT', guestSecurityTab !== null, 'Security tab present for guest');

    // 1.6 Verify Settings right-click context menu for Guest
    const settingsRoot = await page.$('#system-settings-root');
    const settingsBox = await settingsRoot.boundingBox();
    await page.mouse.click(settingsBox.x + 50, settingsBox.y + 15, { button: 'right' });
    await page.waitForSelector('.context-menu', { timeout: 5000 });

    const ctxGuestCustomization = await page.$('#context-menu-item-ctx-settings-customization');
    check('Guest Settings context menu: "Customization & Effects" is ABSENT', ctxGuestCustomization === null);

    const ctxGuestBoot = await page.$('#context-menu-item-ctx-settings-boot');
    check('Guest Settings context menu: "Boot Sequence Settings" is ABSENT', ctxGuestBoot === null);

    const ctxGuestGeneral = await page.$('#context-menu-item-ctx-settings-general');
    check('Guest Settings context menu: "General / System Info" is PRESENT', ctxGuestGeneral !== null);

    const ctxGuestSecurity = await page.$('#context-menu-item-ctx-settings-security');
    check('Guest Settings context menu: "Security & Access Logs" is PRESENT', ctxGuestSecurity !== null);

    // Dismiss context menu
    await page.mouse.click(settingsBox.x + 20, settingsBox.y + 20);
    await new Promise((r) => setTimeout(r, 400));

    // Close Settings window
    const guestCloseBtn = await page.$('#window-system-settings button[aria-label="Close"]');
    if (guestCloseBtn) await guestCloseBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    // 1.7 Verify Dock Settings right-click menu for Guest
    const dockSettings = await page.$('#dock-item-settings');
    const dockBox = await dockSettings.boundingBox();
    await page.mouse.click(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2, { button: 'right' });
    await page.waitForSelector('.dock-menu', { timeout: 5000 });

    const dockCustomizationText = await page.evaluate(() => {
      const menu = document.querySelector('.dock-menu');
      return menu ? menu.textContent.includes('Customization & Effects') : false;
    });
    check('Guest Dock menu: "Customization & Effects" is ABSENT', !dockCustomizationText);

    // Dismiss dock menu
    await page.click('#desktop-workspace');
    await new Promise((r) => setTimeout(r, 500));

    // Sign out
    await page.evaluate(async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
    });
    await client.send('Network.clearBrowserCookies');

    // =================================================================
    // PART 2: OWNER / ADMIN PERSPECTIVE
    // =================================================================
    console.log('\n--- PART 2: OWNER / ADMIN PERSPECTIVE ---');
    await client.send('Network.clearBrowserCookies');

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 15000 });

    // Switch to Owner / Admin tab
    const ownerAvatar = await page.$('#avatar-select-owner');
    if (ownerAvatar) {
      await ownerAvatar.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    await page.waitForSelector('#input-admin-password', { timeout: 5000 });
    await page.type('#input-admin-password', 'Admin123');
    await page.click('#btn-login-admin');

    await page.waitForSelector('#desktop-workspace', { timeout: 15000 });
    console.log('  Admin logged in successfully.');
    await new Promise((r) => setTimeout(r, 1200));

    // Open System Settings
    const adminMenuSettings = await page.$('#menu-item-top-settings');
    if (adminMenuSettings) {
      await adminMenuSettings.click();
    } else {
      await page.click('#dock-item-settings');
    }

    await page.waitForSelector('#window-system-settings', { timeout: 10000 });
    console.log('  Settings window opened for Admin.');

    // 2.1 Verify Customization tab button is PRESENT
    const adminCustomizationTab = await page.$('#settings-tab-customization, button[data-tab="customization"]');
    check('Admin Settings: Customization tab button is PRESENT', adminCustomizationTab !== null, 'Admin can customize system');

    // 2.2 Verify Boot tab button is PRESENT
    const adminBootTab = await page.$('#settings-tab-boot, button[data-tab="boot"]');
    check('Admin Settings: Boot tab button is PRESENT', adminBootTab !== null, 'Admin can configure boot');

    // 2.3 Verify Fonts tab button is PRESENT
    const adminFontsTab = await page.$('#settings-tab-fonts, button[data-tab="fonts"]');
    check('Admin Settings: Fonts tab button is PRESENT', adminFontsTab !== null, 'Admin can manage fonts');

    // 2.4 Verify General and Security tabs are PRESENT
    const adminGeneralTab = await page.$('button[data-tab="general"]');
    check('Admin Settings: General tab button is PRESENT', adminGeneralTab !== null);

    const adminSecurityTab = await page.$('button[data-tab="security"]');
    check('Admin Settings: Security tab button is PRESENT', adminSecurityTab !== null);

    // 2.5 Test clicking Customization tab as Admin
    if (adminCustomizationTab) {
      await adminCustomizationTab.click();
      await new Promise((r) => setTimeout(r, 500));
      const customContent = await page.evaluate(() => {
        const root = document.querySelector('#system-settings-root');
        return root ? root.textContent.includes('System Customization & Personalization') : false;
      });
      check('Admin Settings: Customization panel loads fully', customContent, 'Admin can view and edit customization');
    }

    // 2.6 Test clicking Boot tab as Admin
    if (adminBootTab) {
      await adminBootTab.click();
      await new Promise((r) => setTimeout(r, 500));
      const bootContent = await page.evaluate(() => {
        const root = document.querySelector('#system-settings-root');
        return root ? root.textContent.includes('Boot Experience & Metal Finishes') : false;
      });
      check('Admin Settings: Boot panel loads fully', bootContent, 'Admin can view and edit boot settings');
    }

    // 2.7 Test clicking Fonts tab as Admin
    if (adminFontsTab) {
      await adminFontsTab.click();
      await new Promise((r) => setTimeout(r, 500));
      const fontsContent = await page.evaluate(() => {
        const root = document.querySelector('#system-settings-root');
        return root ? root.textContent.includes('Typography & Custom Fonts') : false;
      });
      check('Admin Settings: Fonts panel loads fully', fontsContent, 'Admin can view and upload custom fonts');
    }

    // 2.8 Verify Settings right-click context menu for Admin
    const adminSettingsRoot = await page.$('#system-settings-root');
    const adminSettingsBox = await adminSettingsRoot.boundingBox();
    await page.mouse.click(adminSettingsBox.x + 50, adminSettingsBox.y + 15, { button: 'right' });
    await page.waitForSelector('.context-menu', { timeout: 5000 });

    const ctxAdminCustomization = await page.$('#context-menu-item-ctx-settings-customization');
    check('Admin Settings context menu: "Customization & Effects" is PRESENT', ctxAdminCustomization !== null);

    const ctxAdminBoot = await page.$('#context-menu-item-ctx-settings-boot');
    check('Admin Settings context menu: "Boot Sequence Settings" is PRESENT', ctxAdminBoot !== null);

    const ctxAdminFonts = await page.$('#context-menu-item-ctx-settings-fonts');
    check('Admin Settings context menu: "Font Management" is PRESENT', ctxAdminFonts !== null);

    // Dismiss context menu
    await page.mouse.click(adminSettingsBox.x + 20, adminSettingsBox.y + 20);
    await new Promise((r) => setTimeout(r, 400));

    // Close Settings window
    const adminCloseBtn = await page.$('#window-system-settings button[aria-label="Close"]');
    if (adminCloseBtn) await adminCloseBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    // 2.9 Verify Dock Settings right-click menu for Admin
    const adminDockSettings = await page.$('#dock-item-settings');
    const adminDockBox = await adminDockSettings.boundingBox();
    await page.mouse.click(adminDockBox.x + adminDockBox.width / 2, adminDockBox.y + adminDockBox.height / 2, { button: 'right' });
    await page.waitForSelector('.dock-menu', { timeout: 5000 });

    const adminDockCustomizationText = await page.evaluate(() => {
      const menu = document.querySelector('.dock-menu');
      return menu ? menu.textContent.includes('Customization & Effects') : false;
    });
    check('Admin Dock menu: "Customization & Effects" is PRESENT', adminDockCustomizationText);

    // Dismiss dock menu
    await page.click('#desktop-workspace');

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
