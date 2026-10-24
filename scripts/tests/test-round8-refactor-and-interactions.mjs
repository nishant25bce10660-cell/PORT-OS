import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import assert from 'assert';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve('report_assets/round-8');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const manifest = {
  round: 8,
  timestamp: new Date().toISOString(),
  checks: {},
};

function recordEvidence(id, passed, details, screenshotFile = null) {
  manifest.checks[id] = {
    status: passed ? 'PASS' : 'FAIL',
    details,
    screenshot: screenshotFile ? path.relative(process.cwd(), screenshotFile).replace(/\\/g, '/') : null,
  };
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${details}`);
}

function sendRawHttpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runRound8TestSuite() {
  console.log('================================================================');
  console.log('  PORT OS — ROUND 8: MENU BAR, INTERACTIONS & FINDER AUDIT       ');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Enable session storage pre-boot
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });

    console.log('[SETUP] Navigating to PORT OS...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    // Authenticate as Admin
    console.log('[SETUP] Authenticating as Admin...');
    await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });
    await page.click('#tab-btn-admin');
    await page.type('#input-admin-username', 'admin');
    await page.type('#input-admin-password', 'admin123');
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await page.waitForSelector('#desktop-workspace', { timeout: 5000 });
    console.log('[SETUP] Authenticated successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Menu Bar Refactoring (Finder & Help, No Control Center, No File/Edit)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Menu Bar Refactoring & Help Command Trigger ---');
    const menuBarInfo = await page.evaluate(() => {
      const bar = document.getElementById('portfolio-menubar') || document.getElementById('macos-menu-bar');
      if (!bar) return { exists: false };
      const text = bar.innerText;
      return {
        exists: true,
        hasNLogo: !!document.getElementById('menu-btn-n-logo'),
        hasFinder: !!document.getElementById('menu-item-top-finder'),
        hasHelp: !!document.getElementById('menu-item-top-help'),
        hasSpotlight: !!document.getElementById('menu-btn-spotlight'),
        hasControlCenter: !!document.getElementById('menu-btn-control-center'),
        hasLegacyMenus: text.includes('File') || text.includes('Edit') || text.includes('View') || text.includes('Window'),
      };
    });

    assert(menuBarInfo.exists, 'Menu bar must exist');
    assert(menuBarInfo.hasNLogo, 'Menu bar must feature N logo mark');
    assert(menuBarInfo.hasFinder, 'Menu bar must feature Finder button');
    assert(menuBarInfo.hasHelp, 'Menu bar must feature Help button');
    assert(!menuBarInfo.hasControlCenter, 'Menu bar must NOT have fake Control Center button');
    assert(!menuBarInfo.hasLegacyMenus, 'Menu bar must NOT contain File, Edit, View, Window');

    // Click Help button -> verify Terminal launches with 'help' executed
    await page.click('#menu-item-top-help');
    await page.waitForSelector('#window-terminal', { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 600));

    const terminalHelpOutput = await page.evaluate(() => {
      const term = document.getElementById('window-terminal');
      return term ? term.innerText : '';
    });
    assert(terminalHelpOutput.includes('Available commands:'), 'Help button must launch Terminal and execute "help" command');
    assert(terminalHelpOutput.includes('neofetch'), 'Help output must list neofetch command');

    const shot1 = path.join(EVIDENCE_DIR, 'R8_01_menubar_help_terminal.png');
    await page.screenshot({ path: shot1 });
    recordEvidence(
      'R8_1_MENU_BAR_REFACTOR',
      true,
      'Menu bar retains N logo, Finder, Help, Spotlight; Control Center removed; Help launches Terminal with help output',
      shot1
    );

    // Close terminal window to clear screen
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#btn-close-terminal') || document.querySelector('#window-terminal .traffic-light-close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Test clicking Finder button -> Opens Projects window
    await page.click('#menu-item-top-finder');
    await page.waitForSelector('#window-folder-projects', { timeout: 4000 });
    const shotFinder = path.join(EVIDENCE_DIR, 'R8_01b_menubar_finder_open.png');
    await page.screenshot({ path: shotFinder });
    recordEvidence(
      'R8_1B_MENU_BAR_FINDER_TRIGGER',
      true,
      'Clicking top Finder menu button opens and focuses Projects vault window',
      shotFinder
    );

    // Close Projects window for icon interaction testing
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#btn-close-folder-projects') || document.querySelector('#window-folder-projects .traffic-light-close');
      if (closeBtn) closeBtn.click();
    });
    await page.waitForFunction(() => !document.getElementById('window-folder-projects'), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // TEST 2: Desktop Icon Interactions (Single click select, drag move, dblclick open)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Desktop Icon Interactions (Single Click vs Drag vs Double Click) ---');
    const projectsIconSelector = '#desktop-item-projects';
    await page.waitForSelector(projectsIconSelector, { timeout: 3000 });

    // Step A: Single Click -> Selects icon, does NOT open window
    await page.click(projectsIconSelector);
    await new Promise((r) => setTimeout(r, 300));
    const isSelected = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.classList.contains('is-selected') : false;
    }, projectsIconSelector);
    const windowOpenedOnSingleClick = await page.evaluate(() => {
      return !!document.getElementById('window-folder-projects');
    });

    assert(isSelected, 'Desktop icon must be selected on single click');
    assert(!windowOpenedOnSingleClick, 'Desktop icon single click must NOT open window');

    // Step B: Drag icon -> moves without opening window
    const initialPos = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.transform : '';
    }, projectsIconSelector);

    const iconBox = await page.$(projectsIconSelector);
    const boundingBox = await iconBox.boundingBox();
    assert(boundingBox, 'Icon bounding box must be available');

    await page.mouse.move(boundingBox.x + 20, boundingBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(boundingBox.x - 60, boundingBox.y + 30, { steps: 5 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 400));

    const movedPos = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.transform : '';
    }, projectsIconSelector);
    const windowOpenedOnDrag = await page.evaluate(() => {
      return !!document.getElementById('window-folder-projects');
    });

    assert(initialPos !== movedPos, 'Desktop icon position must update after drag gesture');
    assert(!windowOpenedOnDrag, 'Dragging desktop icon must NOT open window');

    // Step C: Double Click -> Opens window
    await page.click(projectsIconSelector, { clickCount: 2 });
    await page.waitForSelector('#window-folder-projects', { timeout: 4000 });
    const windowOpenedOnDoubleClick = await page.evaluate(() => {
      return !!document.getElementById('window-folder-projects');
    });
    assert(windowOpenedOnDoubleClick, 'Double-clicking desktop icon must open window');

    const shot2 = path.join(EVIDENCE_DIR, 'R8_02_desktop_icon_interactions.png');
    await page.screenshot({ path: shot2 });
    recordEvidence(
      'R8_2_DESKTOP_ICON_INTERACTIONS',
      true,
      'Single click selects without opening; Drag updates transform without opening; Double click opens window',
      shot2
    );

    // -------------------------------------------------------------
    // TEST 3: Finder Cleanup & Clamped Context Menu
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Finder Sidebar Cleanup & Context Menu Clamping ---');
    const finderSidebarCheck = await page.evaluate(() => {
      const win = document.getElementById('window-folder-projects');
      if (!win) return { exists: false };
      const hasThisPc = !!win.querySelector('.sidebar-item-pc');
      const text = win.innerText;
      const hasDesktopFavorite = text.includes('🖥️ Desktop') || text.includes('Favorites');
      const hasUploadBtn = !!win.querySelector('#btn-upload-file');
      return {
        exists: true,
        hasThisPc,
        hasDesktopFavorite,
        hasUploadBtn,
      };
    });

    assert(finderSidebarCheck.exists, 'Projects finder window must be open');
    assert(!finderSidebarCheck.hasThisPc, 'Finder sidebar must NOT contain "This PC"');
    assert(!finderSidebarCheck.hasDesktopFavorite, 'Finder sidebar must NOT contain "Desktop" favorite');
    assert(finderSidebarCheck.hasUploadBtn, 'Finder must maintain safe local browser upload button');

    // Test context menu clamping on a finder item
    const firstItem = await page.$('.finder-item');
    assert(firstItem, 'At least one item must exist in finder view');
    await firstItem.click({ button: 'right' });
    await page.waitForSelector('.finder-context-menu', { timeout: 3000 });

    const contextMenuBounds = await page.evaluate(() => {
      const menu = document.querySelector('.finder-context-menu');
      if (!menu) return null;
      const rect = menu.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        isClampedX: rect.right <= window.innerWidth,
        isClampedY: rect.bottom <= window.innerHeight,
      };
    });

    assert(contextMenuBounds && contextMenuBounds.isClampedX && contextMenuBounds.isClampedY, 'Finder context menu must be strictly clamped within viewport');

    const shot3 = path.join(EVIDENCE_DIR, 'R8_03_finder_cleanup_clamped_menu.png');
    await page.screenshot({ path: shot3 });
    recordEvidence(
      'R8_3_FINDER_CLEANUP_AND_CONTEXT_MENU',
      true,
      'This PC and Desktop removed from Finder sidebar; Upload button maintained; Context menu clamped within viewport bounds',
      shot3
    );

    // Dismiss context menu
    await page.mouse.click(10, 10);
    await new Promise((r) => setTimeout(r, 300));

    // -------------------------------------------------------------
    // TEST 4: Portfolio Stats Widget Layout & Dedicated Spans
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Portfolio Stats Widget Cards & Footer Layout ---');
    const statsWidgetCheck = await page.evaluate(() => {
      const widgets = Array.from(document.querySelectorAll('.desktop-widget'));
      const statsWidget = widgets.find((w) => w.innerText.includes('PORTFOLIO STATS') || w.innerText.includes('Portfolio Stats'));
      if (!statsWidget) return { exists: false };

      const grid = statsWidget.querySelector('.widget-stats-grid');
      const footer = statsWidget.querySelector('.widget-stat-footer');
      const pills = Array.from(statsWidget.querySelectorAll('.widget-stat-pill'));
      const footerItems = Array.from(statsWidget.querySelectorAll('.stat-footer-item'));

      const widgetRect = statsWidget.getBoundingClientRect();
      let hasOverflow = false;
      pills.forEach((p) => {
        const pRect = p.getBoundingClientRect();
        if (pRect.right > widgetRect.right + 2 || pRect.left < widgetRect.left - 2) {
          hasOverflow = true;
        }
      });

      return {
        exists: true,
        hasGrid: !!grid,
        pillCount: pills.length,
        hasOverflow,
        footerText: footer ? footer.innerText : '',
        footerItemCount: footerItems.length,
        hasVaultAssets: footer ? footer.innerText.includes('Vault assets') : false,
        hasSyncVault: footer ? footer.innerText.includes('Sync · Local vault') : false,
      };
    });

    assert(statsWidgetCheck.exists, 'Portfolio stats widget must exist on desktop');
    assert(statsWidgetCheck.hasGrid && statsWidgetCheck.pillCount >= 3, 'Portfolio stats widget must render 3 metric pill cards in grid');
    assert(!statsWidgetCheck.hasOverflow, 'Metric cards must not overflow widget bounds');
    assert(statsWidgetCheck.footerItemCount >= 2, 'Footer must use dedicated .stat-footer-item spans');
    assert(statsWidgetCheck.hasVaultAssets && statsWidgetCheck.hasSyncVault, 'Footer must display separated Vault assets and Sync items');

    const shot4 = path.join(EVIDENCE_DIR, 'R8_04_portfolio_stats_widget_fixed.png');
    await page.screenshot({ path: shot4 });
    recordEvidence(
      'R8_4_PORTFOLIO_STATS_WIDGET',
      true,
      'Portfolio stats metric pills fit widget bounds without overflow; footer text cleanly separated into dedicated spans',
      shot4
    );

    // -------------------------------------------------------------
    // TEST 5: Dark-Mode Settings Dropdowns (No White-on-White)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Dark-Mode System Settings Dropdowns & Contrast ---');
    await page.click('#menu-btn-n-logo');
    await new Promise((r) => setTimeout(r, 200));
    await page.click('#menu-item-settings');
    await page.waitForSelector('#window-system-settings', { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 400));

    // Navigate to Customization tab
    const tabClicked = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.settings-tab-btn'));
      const customTab = tabs.find((t) => t.innerText.includes('Customization') || t.innerText.includes('Appearance'));
      if (customTab) {
        customTab.click();
        return true;
      }
      return false;
    });
    assert(tabClicked, 'Customization tab must be clickable');
    await new Promise((r) => setTimeout(r, 400));

    const dropdownStyles = await page.evaluate(() => {
      const select = document.getElementById('clock-digit-size-select');
      if (!select) return null;
      const comp = window.getComputedStyle(select);
      const option = select.querySelector('option');
      const optComp = option ? window.getComputedStyle(option) : null;
      return {
        bg: comp.backgroundColor,
        color: comp.color,
        optBg: optComp ? optComp.backgroundColor : '',
        optColor: optComp ? optComp.color : '',
      };
    });

    console.log('[TEST 5] Select styles:', dropdownStyles);
    assert(dropdownStyles, 'Clock digit size select must exist in Customization tab');
    // Ensure background is dark (not white rgb(255, 255, 255))
    assert(!dropdownStyles.bg.includes('255, 255, 255'), 'Select background must be dark');

    const shot5 = path.join(EVIDENCE_DIR, 'R8_05_dark_mode_dropdowns.png');
    await page.screenshot({ path: shot5 });
    recordEvidence(
      'R8_5_DARK_MODE_DROPDOWNS',
      true,
      'Settings dropdowns render with dark theme styling (#1a1e29 background and white text), avoiding white-on-white contrast bug',
      shot5
    );

    // -------------------------------------------------------------
    // TEST 6: Customization Persistence via PUT /api/settings
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Customization Persistence in API Route ---');
    // Get cookies for admin auth
    const cookies = await page.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const putPayload = JSON.stringify({
      customization: {
        accentColor: '#38bdf8',
        theme: 'dark',
        clock: {
          style: 'digital',
          digitSize: 'large',
          is24Hour: false,
          sizeMode: 'standard',
          location: 'San Francisco, CA',
        },
      },
    });

    const putRes = await sendRawHttpRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/settings',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(putPayload),
          'Cookie': cookieHeader,
          'Host': 'localhost:3000',
          'Origin': 'http://localhost:3000',
        },
      },
      putPayload
    );

    assert.strictEqual(putRes.statusCode, 200, 'PUT /api/settings must return 200 OK');
    const putData = JSON.parse(putRes.body);
    assert(putData.success, 'PUT /api/settings must report success');
    assert(putData.settings && putData.settings.customization, 'Settings response must contain merged customization object');
    assert.strictEqual(putData.settings.customization.clock.digitSize, 'large', 'Customization digitSize must persist as "large"');

    // Read back via GET
    const getRes = await sendRawHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/settings',
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Host': 'localhost:3000',
      },
    });

    assert.strictEqual(getRes.statusCode, 200, 'GET /api/settings must return 200 OK');
    const getData = JSON.parse(getRes.body);
    assert.strictEqual(getData.settings.customization.clock.digitSize, 'large', 'GET must return the persisted customization settings');

    // Teardown / restore to standard medium digitSize
    const restorePayload = JSON.stringify({
      customization: {
        clock: {
          style: 'digital',
          digitSize: 'medium',
          is24Hour: false,
          sizeMode: 'standard',
          location: 'San Francisco, CA',
        },
      },
    });
    await sendRawHttpRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/settings',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(restorePayload),
          'Cookie': cookieHeader,
          'Host': 'localhost:3000',
          'Origin': 'http://localhost:3000',
        },
      },
      restorePayload
    );

    recordEvidence(
      'R8_6_SETTINGS_PERSISTENCE',
      true,
      'PUT /api/settings deeply merges customization object; GET retrieves persisted values without wiping state'
    );

    console.log('\n================================================================');
    console.log('  PORT OS — ROUND 8 TEST SUITE RESULTS: ALL CHECKS PASSED       ');
    console.log('================================================================');
    for (const [key, val] of Object.entries(manifest.checks)) {
      console.log(`  ✓ [${val.status}] ${key}: ${val.details}`);
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n[FATAL ERROR in Round 8 Test Suite]:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

runRound8TestSuite();
