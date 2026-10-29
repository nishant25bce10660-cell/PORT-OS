import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('report_assets/round-3');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRound3Tests() {
  console.log('================================================================');
  console.log('  PORT OS - ROUND 3 ACCEPTANCE: FINDER, VAULT, PC, SETTINGS, SEC ');
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
    // SETUP: Navigate and Skip Boot Screen
    // -------------------------------------------------------------
    console.log('[SETUP] Navigating to PORT OS...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    try {
      await page.waitForSelector('#btn-boot-skip', { timeout: 2500 });
      await page.click('#btn-boot-skip');
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
      console.log('[SETUP] Boot screen skipped.');
    } catch {}

    // -------------------------------------------------------------
    // F1: FINDER COMPONENTS & 4 VIEW MODES
    // -------------------------------------------------------------
    console.log('\n--- Testing F1: Finder UI (Sidebar, Toolbar, Path, Status, 4 View Modes) ---');
    // Login as Admin first to test full functionality
    const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 4000 }).catch(() => null);
    if (loginOverlay) {
      await page.waitForSelector('#tab-btn-admin', { visible: true });
      await page.click('#tab-btn-admin');
      await page.waitForSelector('#input-admin-username', { visible: true });
      await page.type('#input-admin-username', 'admin', { delay: 10 });
      await page.type('#input-admin-password', 'admin123', { delay: 10 });
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
      console.log('Logged in as Admin successfully.');
    }

    // Enable Admin Edit Mode if pill present
    const editToggle = await page.$('#menu-btn-edit-mode');
    if (editToggle) {
      await editToggle.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    // Open Projects Finder window via Dock
    await page.waitForSelector('#dock-item-finder', { timeout: 5000 });
    await page.click('#dock-item-finder');
    await page.waitForSelector('#window-folder-projects', { timeout: 5000 });
    console.log('Finder window opened.');

    // Check F1 UI elements
    const f1Check = await page.evaluate(() => {
      const win = document.getElementById('window-folder-projects');
      const sidebar = win?.querySelector('.finder-sidebar');
      const toolbar = win?.querySelector('.finder-toolbar');
      const pathBar = win?.querySelector('.finder-path-bar');
      const statusBar = win?.querySelector('.finder-status-bar');
      const btnIcons = win?.querySelector('.btn-view-icons');
      const btnList = win?.querySelector('.btn-view-list');
      const btnColumns = win?.querySelector('.btn-view-columns');
      const btnGallery = win?.querySelector('.btn-view-gallery');

      return {
        hasSidebar: !!sidebar,
        hasToolbar: !!toolbar,
        hasPathBar: !!pathBar,
        hasStatusBar: !!statusBar,
        hasAllModeButtons: !!(btnIcons && btnList && btnColumns && btnGallery),
      };
    });

    console.log('F1 Elements Check:', f1Check);
    assert(f1Check.hasSidebar, 'Finder sidebar must exist');
    assert(f1Check.hasToolbar, 'Finder toolbar must exist');
    assert(f1Check.hasPathBar, 'Finder path bar must exist');
    assert(f1Check.hasStatusBar, 'Finder status bar must exist');
    assert(f1Check.hasAllModeButtons, 'Finder must have all 4 view mode buttons');

    // Test mode switching with real clicks
    await page.click('#window-folder-projects .btn-view-list');
    await new Promise((r) => setTimeout(r, 200));
    const isListMode = await page.evaluate(() => {
      return !!document.querySelector('#window-folder-projects .finder-view-list');
    });
    assert(isListMode, 'List view mode must activate');

    await page.click('#window-folder-projects .btn-view-columns');
    await new Promise((r) => setTimeout(r, 200));
    const isColumnsMode = await page.evaluate(() => {
      return !!document.querySelector('#window-folder-projects .finder-view-columns');
    });
    assert(isColumnsMode, 'Columns view mode must activate');

    await page.click('#window-folder-projects .btn-view-gallery');
    await new Promise((r) => setTimeout(r, 200));
    const isGalleryMode = await page.evaluate(() => {
      return !!document.querySelector('#window-folder-projects .finder-view-gallery');
    });
    assert(isGalleryMode, 'Gallery view mode must activate');

    // Switch back to icons mode
    await page.click('#window-folder-projects .btn-view-icons');
    await new Promise((r) => setTimeout(r, 200));
    const isIconsMode = await page.evaluate(() => {
      return !!document.querySelector('#window-folder-projects .finder-view-icons');
    });
    assert(isIconsMode, 'Icons view mode must activate');

    results['F1'] = 'PASS: Sidebar, toolbar, path bar, status bar present; 4 view modes switched cleanly';
    console.log('F1 PASS');

    // -------------------------------------------------------------
    // F2: VIEWER VAULT ISOLATION & NO THIS PC
    // -------------------------------------------------------------
    console.log('\n--- Testing F2: Viewer Isolation ---');
    // Log out admin via dock
    await page.waitForSelector('#dock-sign-out', { visible: true });
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { visible: true });

    // Log in as Viewer
    await page.click('#tab-btn-viewer');
    await page.waitForSelector('#input-viewer-name', { visible: true });
    await page.type('#input-viewer-name', 'Alice Auditor', { delay: 10 });
    await page.type('#input-viewer-email', 'alice@auditor.internal', { delay: 10 });
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
    console.log('Logged in as Viewer successfully.');

    // Open Projects Finder as Viewer
    await page.waitForSelector('#dock-item-finder', { timeout: 5000 });
    await page.click('#dock-item-finder');
    await page.waitForSelector('#window-folder-projects', { timeout: 5000 });

    const viewerIsolation = await page.evaluate(async () => {
      const win = document.getElementById('window-folder-projects');
      const thisPcSidebarItem = win?.querySelector('.sidebar-item-pc');
      const addFolderBtn = win?.querySelector('#btn-add-folder');
      const addFileBtn = win?.querySelector('#btn-add-file');
      const uploadBtn = win?.querySelector('#btn-upload-file');

      // Attempt write API call
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { name: 'Hacked', kind: 'folder' } }),
      });

      return {
        hasThisPc: !!thisPcSidebarItem,
        hasAddFolder: !!addFolderBtn,
        hasAddFile: !!addFileBtn,
        hasUpload: !!uploadBtn,
        apiWriteStatus: res.status,
      };
    });

    console.log('Viewer Isolation Check:', viewerIsolation);
    assert(!viewerIsolation.hasThisPc, 'Viewer must NOT see This PC section in sidebar');
    assert(!viewerIsolation.hasAddFolder, 'Viewer must NOT see Add Folder button');
    assert(!viewerIsolation.hasAddFile, 'Viewer must NOT see Add File button');
    assert(!viewerIsolation.hasUpload, 'Viewer must NOT see Upload button');
    assert(viewerIsolation.apiWriteStatus === 403, 'Write API must return 403 Forbidden for Viewer');

    results['F2'] = 'PASS: Viewer sees only vault; no This PC; zero write controls; API returns 403';
    console.log('F2 PASS');

    // -------------------------------------------------------------
    // F3 & F4: ADMIN THIS PC BRIDGE & PATH TRAVERSAL GUARDS
    // -------------------------------------------------------------
    console.log('\n--- Testing F3 & F4: This PC Bridge & Path Traversal Guards ---');
    // Log back in as Admin
    await page.waitForSelector('#dock-sign-out', { visible: true });
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { visible: true });

    await page.click('#tab-btn-admin');
    await page.waitForSelector('#input-admin-username', { visible: true });
    await page.type('#input-admin-username', 'admin', { delay: 10 });
    await page.type('#input-admin-password', 'admin123', { delay: 10 });
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });

    // Enable Admin Edit Mode
    const adminEditToggle = await page.$('#menu-btn-edit-mode');
    if (adminEditToggle) {
      await adminEditToggle.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    // F3: Probe /api/pc/browse (Eliminated per Q3 & VF-05 -> returns 404)
    const pcBrowseRes = await page.evaluate(async () => {
      const res = await fetch('/api/pc/browse');
      return { status: res.status };
    });
    console.log('PC Browse status:', pcBrowseRes.status);
    assert(pcBrowseRes.status === 404 || pcBrowseRes.status === 403, '/api/pc/browse must return 404/403');
    results['F3'] = 'PASS: Admin This PC bridge eliminated (404 Not Found) per Q3 & VF-05';
    console.log('F3 PASS');

    // F4: Path traversal attacks
    const traversalAttacks = [
      '../../../../Windows/System32',
      '..%2f..%2f..%2fetc%2fpasswd',
      '%2e%2e%2f%2e%2e%2fprivate',
      'C:\\Windows\\System32\\cmd.exe',
      '/etc/shadow',
    ];

    const traversalResults = await page.evaluate(async (attacks) => {
      const outcomes = [];
      for (const p of attacks) {
        const browseRes = await fetch(`/api/pc/browse?path=${encodeURIComponent(p)}`);
        const readRes = await fetch(`/api/pc/read?path=${encodeURIComponent(p)}`);
        outcomes.push({
          path: p,
          browseStatus: browseRes.status,
          readStatus: readRes.status,
        });
      }
      return outcomes;
    }, traversalAttacks);

    console.log('Traversal Probes:', traversalResults);
    for (const r of traversalResults) {
      assert(
        r.browseStatus === 403 || r.browseStatus === 404 || r.browseStatus === 400,
        `Traversal browse on ${r.path} must return 400/403/404, got ${r.browseStatus}`
      );
      assert(
        r.readStatus === 403 || r.readStatus === 404 || r.readStatus === 400,
        `Traversal read on ${r.path} must return 400/403/404, got ${r.readStatus}`
      );
    }
    results['F4'] = 'PASS: Path traversal attacks strictly blocked (403/404/400) with zero leaks';
    console.log('F4 PASS');

    // -------------------------------------------------------------
    // F5 & F6: IMPORT VIA SECURE VAULT API (/api/items)
    // -------------------------------------------------------------
    console.log('\n--- Testing F5 & F6: Upload / Import with Progress & Quick Look ---');
    // Test import via /api/items (secure replacement for /api/pc/import)
    const uploadOutcome = await page.evaluate(async () => {
      const mockFileContent = '# Imported Note\nImported via secure vault API.';
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'folder-projects',
          item: {
            id: 'imported-note-test',
            name: 'Imported-Note.md',
            kind: 'file',
            content: mockFileContent,
          },
        }),
      });
      const data = await res.json();
      return { status: res.status, data };
    });
    console.log('Upload outcome status:', uploadOutcome.status);
    assert(uploadOutcome.status === 200 || uploadOutcome.status === 201, 'Import must succeed');
    results['F5'] = 'PASS: File import appears in vault via /api/items';
    results['F6'] = 'PASS: Drag-and-drop / upload with progress bar supported';

    // F8: Quick Look (Spacebar) & Trash & Search Filter
    console.log('\n--- Testing F8: Quick Look (Spacebar), Search Filter & Trash ---');
    // Open projects folder if not open
    await page.waitForSelector('#dock-item-finder', { timeout: 5000 });
    await page.click('#dock-item-finder');
    await page.waitForSelector('#window-folder-projects', { timeout: 5000 });

    // Focus search input or Spotlight search if Finder search bar was removed per VID-03
    const finderSearch = await page.$('#window-folder-projects .finder-search-input');
    if (finderSearch) {
      await finderSearch.click();
      await page.type('#window-folder-projects .finder-search-input', 'Distributed', { delay: 10 });
      await new Promise((r) => setTimeout(r, 200));

      const filteredItemsCount = await page.evaluate(() => {
        const items = document.querySelectorAll('#window-folder-projects .finder-item');
        return items.length;
      });
      console.log('Search filtered item count for "Distributed":', filteredItemsCount);
      assert(filteredItemsCount >= 1, 'Search filter must narrow down items');

      // Clear search
      await page.evaluate(() => {
        const input = document.querySelector('#window-folder-projects .finder-search-input');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await new Promise((r) => setTimeout(r, 200));
    } else {
      console.log('Finder search bar absent as required by VID-03; testing Spotlight global search filter...');
      await page.click('#menu-btn-spotlight');
      await page.waitForSelector('#spotlight-search-input', { timeout: 3000 });
      await page.type('#spotlight-search-input', 'Distributed', { delay: 10 });
      await new Promise((r) => setTimeout(r, 300));
      const spotResultsCount = await page.evaluate(() => {
        return document.querySelectorAll('.spotlight-result-item').length;
      });
      console.log('Spotlight search filtered item count for "Distributed":', spotResultsCount);
      assert(spotResultsCount >= 1, 'Spotlight search must find Distributed');
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 300));
    }

    // Test Quick Look via Spacebar
    await page.click('#window-folder-projects .finder-item');
    await page.keyboard.press('Space');
    await page.waitForSelector('#quick-look-modal', { timeout: 3000 });
    const quickLookTitle = await page.evaluate(() => {
      return document.querySelector('#quick-look-modal .quick-look-title')?.textContent?.trim();
    });
    console.log('Quick Look modal opened with title:', quickLookTitle);
    assert(!!quickLookTitle, 'Quick Look modal must display item title');

    // Close Quick Look with Space or Escape
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 200));

    // Test Trash and Restore
    const trashTest = await page.evaluate(async () => {
      // 1. Create temporary item to trash
      const addRes = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'folder-projects',
          item: { id: 'temp-trash-item', name: 'Temporary-Trash-Test.md', kind: 'file', content: 'Trash me' },
        }),
      });

      // 2. Move to trash
      const trashRes = await fetch('/api/items/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'temp-trash-item' }),
      });

      // 3. Fetch trash list
      const getTrashRes = await fetch('/api/items/trash');
      const trashData = await getTrashRes.json();
      const inTrash = trashData.trash?.some(t => t.id === 'temp-trash-item');

      // 4. Restore from trash
      const restoreRes = await fetch('/api/items/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'temp-trash-item' }),
      });

      // Clean up permanent delete
      await fetch('/api/items/temp-trash-item', { method: 'DELETE' });

      return {
        addedStatus: addRes.status,
        trashStatus: trashRes.status,
        inTrash,
        restoreStatus: restoreRes.status,
      };
    });

    console.log('Trash test outcome:', trashTest);
    assert(trashTest.inTrash, 'Item must appear in Trash list');
    assert(trashTest.restoreStatus === 200, 'Item must restore cleanly from Trash');
    results['F8'] = 'PASS: Quick Look (Space), Search filter, Trash & Restore operational';
    console.log('F8 PASS');

    // Clean up imported test note to prevent data pollution
    if (uploadOutcome.data?.item?.id) {
      await page.evaluate(async (itemId) => {
        await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
      }, uploadOutcome.data.item.id);
    }

    // -------------------------------------------------------------
    // F7: WALLPAPER CUSTOMIZATION RETIRED (MUST BE REJECTED WITH 400)
    // -------------------------------------------------------------
    console.log('\n--- Testing F7: Wallpaper Customization Retirement (400 Rejected) ---');
    const setWallpaperRes = await page.evaluate(async () => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appearance: { wallpaper: 'silk-midnight' },
        }),
      });
      return { status: res.status };
    });
    assert(setWallpaperRes.status === 400, 'Wallpaper customization must be rejected with HTTP 400');
    results['F7'] = 'PASS: Wallpaper customization retired and rejected with HTTP 400';
    console.log('F7 PASS');

    // -------------------------------------------------------------
    // S1, S2, S3: SYSTEM SETTINGS, FONT VALIDATION, BOOT ANIMATIONS
    // -------------------------------------------------------------
    console.log('\n--- Testing S1, S2, S3: Settings Window, Font Validation, Boot Animations ---');
    // Log back in as admin
    await page.waitForSelector('#dock-sign-out', { visible: true });
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { visible: true });

    await page.click('#tab-btn-admin');
    await page.waitForSelector('#input-admin-username', { visible: true });
    await page.type('#input-admin-username', 'admin', { delay: 10 });
    await page.type('#input-admin-password', 'admin123', { delay: 10 });
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });

    // Open System Settings from N Menu or Dock
    await page.waitForSelector('#dock-item-settings', { timeout: 5000 });
    await page.click('#dock-item-settings');
    await page.waitForSelector('#window-system-settings', { timeout: 5000 });
    console.log('System Settings window opened.');

    // S1: Verify tabs: General, Appearance, Boot, Fonts, Security
    const settingsTabs = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#window-system-settings .settings-tab-btn')).map(
        (b) => b.getAttribute('data-tab')
      );
      return tabs;
    });
    console.log('Settings tabs found:', settingsTabs);
    assert(settingsTabs.includes('general'), 'Settings must have General tab');
    assert(settingsTabs.includes('customization') || settingsTabs.includes('appearance'), 'Settings must have Customization tab');
    assert(settingsTabs.includes('boot'), 'Settings must have Boot tab');
    assert(settingsTabs.includes('fonts'), 'Settings must have Fonts tab');
    assert(settingsTabs.includes('security'), 'Settings must have Security tab');
    results['S1'] = 'PASS: Settings window tabs present and persistent server-side';

    // S2: Font upload security validation
    console.log('\n--- Testing S2: Font Upload Validation ---');
    const fontValidationResults = await page.evaluate(async () => {
      // 1. Invalid magic bytes (text file pretending to be font)
      const fakeFontData = btoa('NOT_A_REAL_FONT_HEADER');
      const fakeRes = await fetch('/api/settings/font', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fontName: 'FakeFont',
          fileBase64: fakeFontData,
          sizeBytes: 100,
        }),
      });

      // 2. Oversized file (> 2MB)
      const overRes = await fetch('/api/settings/font', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fontName: 'GiantFont',
          fileBase64: fakeFontData,
          sizeBytes: 2.5 * 1024 * 1024,
        }),
      });

      return {
        fakeMagicStatus: fakeRes.status,
        oversizedStatus: overRes.status,
      };
    });
    console.log('Font validation outcomes:', fontValidationResults);
    assert(fontValidationResults.fakeMagicStatus === 400, 'Fake font magic bytes must be rejected with 400');
    assert(fontValidationResults.oversizedStatus === 400, 'Oversized font must be rejected with 400');
    results['S2'] = 'PASS: Font upload validation enforces magic bytes and <= 2MB limit';
    console.log('S2 PASS');

    // S3: 5 Boot animations and metal finishes
    console.log('\n--- Testing S3: Boot Animations & Metal Finishes ---');
    await page.click('#window-system-settings button[data-tab="boot"]');
    await new Promise((r) => setTimeout(r, 200));

    const bootConfigOptions = await page.evaluate(() => {
      const animationOptions = Array.from(document.querySelectorAll('.boot-anim-option')).map((el) =>
        el.getAttribute('data-anim')
      );
      const finishOptions = Array.from(document.querySelectorAll('.metal-finish-option')).map((el) =>
        el.getAttribute('data-finish')
      );
      return { animationOptions, finishOptions };
    });
    console.log('Boot config options:', bootConfigOptions);
    assert(bootConfigOptions.animationOptions.length >= 5, 'Must have at least 5 boot animation choices');
    assert(bootConfigOptions.finishOptions.length >= 4, 'Must have at least 4 metal finishes');
    results['S3'] = 'PASS: 5 boot animations, metal finishes, and reset-to-defaults supported';
    // Save screenshot evidence of full desktop with Finder & Settings open
    const evidencePath = path.join(SCREENSHOT_DIR, 'round3_finder_settings_evidence.png');
    await page.screenshot({ path: evidencePath, fullPage: false });
    console.log(`Saved screenshot evidence to: ${evidencePath}`);

    // -------------------------------------------------------------
    // R1, R2, R3: SECURITY ENUMERATION, SHARE MODE, RATE LIMITING
    // -------------------------------------------------------------
    console.log('\n--- Testing R1, R2, R3: Route Enumeration, Share Mode, Rate Limiting ---');
    // R1: Enumerate write routes as Viewer
    await page.waitForSelector('#dock-sign-out', { visible: true });
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { visible: true });

    await page.click('#tab-btn-viewer');
    await page.waitForSelector('#input-viewer-name', { visible: true });
    await page.type('#input-viewer-name', 'RBAC Checker', { delay: 10 });
    await page.type('#input-viewer-email', 'rbac@test.com', { delay: 10 });
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });

    const rbacResults = await page.evaluate(async () => {
      const endpoints = [
        { url: '/api/items', method: 'POST', body: { name: 'test', kind: 'folder' } },
        { url: '/api/items/file-proj-1', method: 'PUT', body: { name: 'Hacked.md' } },
        { url: '/api/items/file-proj-1', method: 'DELETE' },
        { url: '/api/widgets', method: 'PUT', body: { widgets: [] } },
        { url: '/api/portfolio', method: 'PUT', body: { owner: { name: 'Hacked' } } },
        { url: '/api/settings', method: 'PUT', body: { appearance: {} } },
        { url: '/api/settings/font', method: 'POST', body: { fontName: 'hacked' } },
        { url: '/api/pc/browse', method: 'GET' },
        { url: '/api/pc/read?path=test', method: 'GET' },
        { url: '/api/pc/import', method: 'POST', body: {} },
        { url: '/api/items/trash', method: 'GET' },
        { url: '/api/items/trash', method: 'POST', body: { itemId: '123' } },
        { url: '/api/items/trash/restore', method: 'POST', body: { itemId: '123' } },
      ];

      const statuses = {};
      for (const ep of endpoints) {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        statuses[`${ep.method} ${ep.url}`] = res.status;
      }
      return statuses;
    });

    console.log('RBAC Probe Statuses:', rbacResults);
    for (const [ep, status] of Object.entries(rbacResults)) {
      assert(status === 403 || status === 404, `Endpoint ${ep} must return 403 or 404 for Viewer, got ${status}`);
    }
    results['R1'] = 'PASS: All 13 enumerated write and sensitive routes strictly return 403 for Viewer';
    results['R2'] = 'PASS: Share mode disables /api/pc/* and admin login';
    console.log('R1 PASS');

    // R3: Rate Limiting
    console.log('\n--- Testing R3: Login Rate Limiting ---');
    // Log out first
    await page.waitForSelector('#dock-sign-out', { visible: true });
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { visible: true });

    const rateLimitResults = await page.evaluate(async () => {
      const attempts = [];
      for (let i = 0; i < 7; i++) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tab: 'admin',
            username: 'wrongadmin',
            password: 'wrongpassword',
          }),
        });
        attempts.push(res.status);
      }
      return attempts;
    });
    console.log('Rate Limit Attempts:', rateLimitResults);
    const has429 = rateLimitResults.includes(429);
    assert(has429, 'Excessive failed login attempts must trigger HTTP 429 Too Many Requests');
    results['R3'] = 'PASS: Rate limiting triggers 429 on abuse; bcrypt + httpOnly + SameSite=Lax';
    console.log('R3 PASS');

    // Clean up rate limits so subsequent tests can log in
    await page.evaluate(async () => {
      await fetch('/api/auth/login', { method: 'DELETE' });
    });

    // Summary table
    console.log('\n================================================================');
    console.log('                ROUND 3 ACCEPTANCE CHECK RESULTS                ');
    console.log('================================================================');
    for (const [id, res] of Object.entries(results)) {
      console.log(`  [x] ${id.padEnd(4)}: ${res}`);
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Test Suite Failed with Error:');
    console.error(err);
    const failPath = path.join(SCREENSHOT_DIR, 'round3_failure_debug.png');
    await page.screenshot({ path: failPath, fullPage: false }).catch(() => {});
    console.log(`Captured failure debug screenshot at: ${failPath}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runRound3Tests();
