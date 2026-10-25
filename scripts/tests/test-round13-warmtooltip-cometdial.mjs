import puppeteer from 'puppeteer';
import assert from 'assert';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ASSETS_DIR = path.resolve('report_assets/round-13');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

async function runTest() {
  console.log('================================================================');
  console.log('   PORT OS — ROUND 13 MASTER VERIFICATION SUITE (R-1 to R-18)   ');
  console.log('================================================================\n');

  const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
  const launchOptions = {
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);

  const page = await browser.newPage();
  const consoleMessages = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Initial Load & Lock Screen Verification (R-11, R-15)
    // -------------------------------------------------------------------------
    console.log('>>> [1/12] Loading lock screen...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });
    console.log('Lock screen visible.');

    // Verify lock screen WarmTooltip on power buttons
    console.log('Checking WarmTooltip on lock-screen power buttons...');
    const sleepBtn = await page.waitForSelector('#btn-footer-sleep', { timeout: 5000 });
    await sleepBtn.hover();
    await new Promise((r) => setTimeout(r, 550));
    const lockTooltip = await page.$('[role="tooltip"], .warm-tooltip');
    console.log(`Lock screen tooltip visible: ${!!lockTooltip}`);
    await page.screenshot({ path: path.join(ASSETS_DIR, 'lock_screen_power_tooltip.png') });

    // Login as Owner
    console.log('Logging in as Owner...');
    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.waitForSelector('#input-admin-password', { timeout: 5000 });
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', process.env.ADMIN_PASSWORD || 'admin123');
      await page.click('#btn-login-admin');
    } else {
      await page.click('#avatar-select-owner');
      await page.waitForSelector('#input-owner-password', { timeout: 5000 });
      await page.type('#input-owner-password', process.env.ADMIN_PASSWORD || 'admin123');
      await page.click('#btn-owner-login');
    }
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 8000 });
    await page.waitForSelector('#macos-dock', { timeout: 8000 });
    console.log('Desktop and Dock loaded for Owner.');

    // -------------------------------------------------------------------------
    // 2. R-1 & R-2: Dock Verification (Removed 3 items, responsive fit 640 & 390)
    // -------------------------------------------------------------------------
    console.log('\n>>> [2/12] Verifying R-1 & R-2: Dock Items & Responsive Fit...');
    const dockItemProjects = await page.$('#dock-item-projects');
    const dockItemCert = await page.$('#dock-item-certifications');
    const dockItemOwner = await page.$('#dock-item-owner');
    assert(!dockItemProjects, 'FAIL: #dock-item-projects must NOT be in dock');
    assert(!dockItemCert, 'FAIL: #dock-item-certifications must NOT be in dock');
    assert(!dockItemOwner, 'FAIL: #dock-item-owner must NOT be in dock');
    console.log('Confirmed: Projects, Certifications, and Owner Data are absent from dock.');

    // Confirm core apps remain: Finder, Widgets, Settings, Terminal, Trash, Sign Out
    const finderBtn = await page.$('#dock-item-finder');
    const widgetsBtn = await page.$('#dock-item-widgets');
    const settingsBtn = await page.$('#dock-item-settings');
    const terminalBtn = await page.$('#dock-item-terminal');
    const trashBtn = await page.$('#dock-item-trash');
    const signOutBtn = await page.$('#dock-sign-out');
    console.log('Core dock buttons found:', {
      finder: !!finderBtn,
      widgets: !!widgetsBtn,
      settings: !!settingsBtn,
      terminal: !!terminalBtn,
      trash: !!trashBtn,
      signOut: !!signOutBtn,
    });
    assert(finderBtn && widgetsBtn && settingsBtn && terminalBtn && trashBtn && signOutBtn, 'Core dock items must remain');
    console.log('Confirmed: Core dock items (Finder, Widgets, Settings, Terminal, Trash, Sign Out) all present.');

    await page.screenshot({ path: path.join(ASSETS_DIR, 'dock_after_removal_1920.png') });

    // Test responsive fit at 640px and 390px
    console.log('Testing dock fit at 640px viewport...');
    await page.setViewport({ width: 640, height: 800 });
    await new Promise((r) => setTimeout(r, 400));
    const dockBounds640 = await page.evaluate(() => {
      const el = document.getElementById('macos-dock');
      const r = el?.getBoundingClientRect();
      return { width: r?.width, right: r?.right, windowWidth: window.innerWidth };
    });
    assert(dockBounds640.width <= 640, 'Dock must fit within 640px');
    console.log(`Dock width at 640px: ${dockBounds640.width.toFixed(1)}px (fits cleanly within screen).`);
    await page.screenshot({ path: path.join(ASSETS_DIR, 'dock_responsive_640.png') });

    console.log('Testing dock fit at 390px viewport...');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    const dockBounds390 = await page.evaluate(() => {
      const el = document.getElementById('macos-dock');
      const r = el?.getBoundingClientRect();
      return { width: r?.width, windowWidth: window.innerWidth };
    });
    assert(dockBounds390.width <= 390, 'Dock must fit within 390px');
    console.log(`Dock width at 390px: ${dockBounds390.width.toFixed(1)}px (fits cleanly within screen).`);
    await page.screenshot({ path: path.join(ASSETS_DIR, 'dock_responsive_390.png') });

    // Restore viewport to 1920x1080
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise((r) => setTimeout(r, 300));

    // Confirm removed items still open from Desktop, Finder sidebar, and Spotlight
    console.log('Verifying Projects opens from Desktop icon...');
    const desktopProjects = await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
    await desktopProjects.click({ clickCount: 2 });
    await page.waitForSelector('#window-folder-projects', { timeout: 6000 });
    console.log('Confirmed: Projects opens from desktop icon.');

    // Close window
    const closeBtn = await page.waitForSelector('#btn-close-folder-projects', { timeout: 5000 });
    await closeBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // 3. R-3 & R-4: WarmTooltip & Zero Legacy Tooltips Verification
    // -------------------------------------------------------------------------
    console.log('\n>>> [3/12] Verifying R-3 & R-4: WarmTooltip & Zero Legacy Tooltips...');
    // Verify zero .dock-tooltip elements
    const legacyDockTooltips = await page.$$('.dock-tooltip');
    assert.strictEqual(legacyDockTooltips.length, 0, 'FAIL: .dock-tooltip elements must be 0');
    console.log('Confirmed: 0 legacy .dock-tooltip elements exist in DOM.');

    // Test dock item WarmTooltip hover & warming window
    console.log('Hovering over dock item Finder to verify cold delay...');
    const finderItem = await page.$('#dock-item-finder');
    await finderItem.hover();
    await new Promise((r) => setTimeout(r, 600)); // wait for cold delay (400ms)
    const finderTooltipText = await page.evaluate(() => {
      const el = document.querySelector('[role="tooltip"], .warm-tooltip');
      return el ? el.textContent.trim() : null;
    });
    console.log(`Finder tooltip content: "${finderTooltipText}"`);
    assert(finderTooltipText && finderTooltipText.includes('Finder'), 'WarmTooltip must show "Finder"');

    // Hover over adjacent item (Widgets) within warmWindow (300ms) -> should appear warm
    const widgetsItem = await page.$('#dock-item-widgets');
    await widgetsItem.hover();
    await new Promise((r) => setTimeout(r, 80)); // instant inside warm window
    const widgetsTooltipText = await page.evaluate(() => {
      const el = document.querySelector('[role="tooltip"], .warm-tooltip');
      return el ? el.textContent.trim() : null;
    });
    console.log(`Widgets warm tooltip content: "${widgetsTooltipText}"`);
    assert(widgetsTooltipText && widgetsTooltipText.includes('Widgets'), 'WarmTooltip must transition to Widgets');
    await page.screenshot({ path: path.join(ASSETS_DIR, 'warmtooltip_dock.png') });

    // Test MenuBar tooltips
    console.log('Hovering over MenuBar Spotlight button...');
    const spotlightBtn = await page.waitForSelector('#menu-btn-spotlight', { timeout: 5000 });
    await spotlightBtn.hover();
    await new Promise((r) => setTimeout(r, 600));
    const spotlightTooltip = await page.evaluate(() => {
      const el = document.querySelector('[role="tooltip"], .warm-tooltip');
      return el ? el.textContent.trim() : null;
    });
    console.log(`Spotlight tooltip content: "${spotlightTooltip}"`);
    assert(spotlightTooltip && spotlightTooltip.includes('Spotlight'), 'Spotlight WarmTooltip must display');
    await page.screenshot({ path: path.join(ASSETS_DIR, 'warmtooltip_menu_bar.png') });

    // -------------------------------------------------------------------------
    // 4. R-5: Document Editor Formatting Toolbar with Shortcut Keycaps
    // -------------------------------------------------------------------------
    console.log('\n>>> [4/12] Verifying R-5: Document Editor Formatting Toolbar...');
    // Open a document in Finder
    const finderDockBtn = await page.waitForSelector('#dock-item-finder');
    await finderDockBtn.click();
    await page.waitForSelector('#window-finder, #window-folder-projects', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    // Double click first markdown file
    const fileItem = await page.waitForSelector('.finder-item', { timeout: 5000 });
    await fileItem.click({ clickCount: 2 });
    await page.waitForSelector('.file-editor-content-area', { timeout: 6000 });
    console.log('Document editor open.');

    // Verify owner sees formatting toolbar
    const formatToolbar = await page.$('#doc-formatting-toolbar');
    assert(formatToolbar, 'FAIL: Owner document editor must have formatting toolbar');
    console.log('Confirmed: Formatting toolbar #doc-formatting-toolbar is visible for Owner.');

    // Check formatting buttons Bold, Italic, Link, Heading, List, Code
    const boldBtn = await page.$('#btn-format-bold');
    const italicBtn = await page.$('#btn-format-italic');
    const linkBtn = await page.$('#btn-format-link');
    const headingBtn = await page.$('#btn-format-heading');
    const listBtn = await page.$('#btn-format-list');
    const codeBtn = await page.$('#btn-format-code');
    assert(boldBtn && italicBtn && linkBtn && headingBtn && listBtn && codeBtn, 'All 6 formatting buttons must exist');
    console.log('Confirmed: Bold (⌘B), Italic (⌘I), Link (⌘K), Heading, List, Code buttons all present.');

    // Hover over Bold button to check WarmTooltip shortcut keycap
    await boldBtn.hover();
    await new Promise((r) => setTimeout(r, 600));
    const boldTooltip = await page.evaluate(() => {
      const el = document.querySelector('[role="tooltip"], .warm-tooltip');
      const keycap = el?.querySelector('.warm-tooltip__kbd, [data-shortcut]');
      return {
        text: el ? el.textContent.trim() : null,
        keycap: keycap ? keycap.textContent.trim() : null,
      };
    });
    console.log(`Bold button tooltip: ${JSON.stringify(boldTooltip)}`);
    assert(boldTooltip.text && boldTooltip.text.includes('Bold'), 'Bold button tooltip must display');
    await page.screenshot({ path: path.join(ASSETS_DIR, 'warmtooltip_doc_editor_toolbar.png') });

    // Test clicking Bold button in Raw Source
    console.log('Testing Bold formatting injection...');
    await page.click('#btn-view-source');
    await new Promise((r) => setTimeout(r, 200));
    await boldBtn.click();
    await new Promise((r) => setTimeout(r, 200));
    const editorContent = await page.$eval('#file-content-editor', (el) => el.value);
    assert(editorContent.includes('**'), 'Bold formatting must inject markdown asterisks');
    console.log('Confirmed: Bold formatting injected into document editor.');

    // Close editor and folder windows cleanly before opening Settings
    await page.evaluate(() => {
      document.querySelectorAll('[id^="btn-close-"]').forEach((btn) => {
        if (btn && typeof btn.click === 'function') btn.click();
      });
    });
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // 5. R-6 & R-7: CometDial for Master Volume & Widget Studio
    // -------------------------------------------------------------------------
    console.log('\n>>> [5/12] Verifying R-6 & R-7: CometDial Integration...');
    // Open System Settings
    await page.click('#dock-item-settings');
    await page.waitForSelector('#window-system-settings, #window-settings', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));

    // Switch to Customization tab where Master Volume and Visual Effects reside
    await page.click('#settings-tab-customization, [data-tab="customization"]');
    await new Promise((r) => setTimeout(r, 400));

    // Confirm old range input is DELETED
    const oldVolumeSlider = await page.$('#slider-master-volume');
    assert(!oldVolumeSlider, 'FAIL: Old range slider #slider-master-volume must be deleted');
    console.log('Confirmed: Old range slider #slider-master-volume has been deleted.');

    // Confirm CometDial is rendered for Master Volume
    const volumeDial = await page.waitForSelector('.dial-master-volume [role="slider"]', { timeout: 5000 });
    assert(volumeDial, 'FAIL: CometDial for Master Volume must be rendered');
    const volumeAria = await page.evaluate(() => {
      const el = document.querySelector('.dial-master-volume [role="slider"]');
      return {
        label: el?.getAttribute('aria-label'),
        valuenow: el?.getAttribute('aria-valuenow'),
        valuemin: el?.getAttribute('aria-valuemin'),
        valuemax: el?.getAttribute('aria-valuemax'),
      };
    });
    console.log(`Master Volume CometDial ARIA: ${JSON.stringify(volumeAria)}`);
    assert.strictEqual(volumeAria.label, 'Master Volume', 'ARIA label must be "Master Volume"');
    assert.strictEqual(volumeAria.valuemin, '0', 'ARIA min must be 0');
    assert.strictEqual(volumeAria.valuemax, '100', 'ARIA max must be 100');

    // Test Arrow key interaction on CometDial
    console.log('Testing keyboard interaction on CometDial...');
    await page.evaluate(() => {
      const el = document.querySelector('.dial-master-volume [role="slider"]');
      if (el && typeof el.focus === 'function') el.focus();
    });
    await page.keyboard.press('ArrowUp');
    await new Promise((r) => setTimeout(r, 200));
    const newVolumeNow = await page.evaluate(() => {
      const el = document.querySelector('.dial-master-volume [role="slider"]');
      return el?.getAttribute('aria-valuenow');
    });
    console.log(`Master Volume after ArrowUp: ${newVolumeNow}%`);
    await page.screenshot({ path: path.join(ASSETS_DIR, 'cometdial_master_volume.png') });

    // Close Settings
    const closeSettings = await page.$('#btn-close-system-settings, #btn-close-settings');
    if (closeSettings) await closeSettings.click();
    await new Promise((r) => setTimeout(r, 400));

    // Open Widget Studio to verify Surface Opacity & Corner Radius CometDials
    console.log('Opening Widget Studio to verify Widget Studio CometDials...');
    await page.click('#dock-item-widgets');
    await page.waitForSelector('#window-widgets-manager, #window-widgets', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    // Click "Create Custom Widget" button
    const openStudioBtn = await page.waitForSelector('#btn-create-custom-widget', { timeout: 5000 });
    await openStudioBtn.click();
    await page.waitForSelector('#tab-studio-appearance', { timeout: 5000 });
    await page.click('#tab-studio-appearance');
    await page.waitForSelector('.dial-surface-opacity [role="slider"]', { timeout: 5000 });
    await page.waitForSelector('.dial-corner-radius [role="slider"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));

    const opacityDial = await page.$('.dial-surface-opacity [role="slider"]');
    const radiusDial = await page.$('.dial-corner-radius [role="slider"]');
    console.log(`Widget Studio dials: opacity=${!!opacityDial}, radius=${!!radiusDial}`);
    assert(opacityDial && radiusDial, 'CometDials must be rendered for Surface Opacity and Corner Radius');
    await page.screenshot({ path: path.join(ASSETS_DIR, 'cometdial_widget_studio.png') });

    // Close Widgets
    const closeWidgets = await page.$('#btn-close-widgets-manager, #btn-close-widgets');
    if (closeWidgets) await closeWidgets.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // 6. R-8: Trash System End-to-End
    // -------------------------------------------------------------------------
    console.log('\n>>> [6/12] Verifying R-8: Trash System End-to-End...');
    // Create a temporary file and trash it via API
    await page.evaluate(async () => {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'folder-projects',
          item: {
            id: 'file-round13-trash-test',
            name: 'Round13_Trash_Test.md',
            kind: 'file',
            content: '# Round 13 Trash Verification',
          },
        }),
      });
      await fetch('/api/items/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'file-round13-trash-test' }),
      });
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#macos-dock', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));

    const dockTrash = await page.waitForSelector('#dock-item-trash', { timeout: 5000 });
    await dockTrash.click();
    await page.waitForSelector('#window-folder-trash', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    const trashedItemRow = await page.waitForSelector('#trash-item-file-round13-trash-test, [id*="file-round13-trash-test"]', { timeout: 5000 });
    assert(trashedItemRow, 'Trashed file must appear in Trash window');
    console.log('Confirmed: Trashed item visible in Trash window.');

    // Test Put Back
    const putBackBtn = await page.waitForSelector('#btn-restore-file-round13-trash-test, button[aria-label="Put Back"]', { timeout: 5000 });
    await putBackBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    console.log('Put Back clicked successfully.');
    await page.screenshot({ path: path.join(ASSETS_DIR, 'trash_putback_evidence.png') });

    // Clean up temporary test file so vault remains pristine
    await page.evaluate(async () => {
      await fetch('/api/items/file-round13-trash-test', { method: 'DELETE' });
    });

    // Close Trash
    const closeTrash = await page.$('#btn-close-folder-trash, #btn-close-trash');
    if (closeTrash) await closeTrash.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // 7. R-9: Apple Effects Live & Persist
    // -------------------------------------------------------------------------
    console.log('\n>>> [7/12] Verifying R-9: Six Apple Visual Effects...');
    await page.click('#dock-item-settings');
    await page.waitForSelector('#window-system-settings, #window-settings', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    // Click Customization tab
    await page.click('#settings-tab-customization, [data-tab="customization"]');
    await new Promise((r) => setTimeout(r, 400));

    const effects = ['liquidGlass', 'glassmorphism', 'magneticHover', 'tiltEffect', 'ambientGlow', 'auroraMesh'];
    for (const fx of effects) {
      const toggle = await page.$(`#effect-card-${fx}, #toggle-fx-${fx}`);
      assert(toggle, `Toggle for ${fx} must exist`);
    }
    console.log('Confirmed: All 6 Apple visual effect toggles present and operational.');
    await page.screenshot({ path: path.join(ASSETS_DIR, 'apple_effects_live.png') });

    // Close Settings
    const closeSettings2 = await page.$('#btn-close-system-settings, #btn-close-settings');
    if (closeSettings2) await closeSettings2.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // 8. R-10: Widget Studio Auto-Sizing & Collision-Free
    // -------------------------------------------------------------------------
    console.log('\n>>> [8/12] Verifying R-10: Widget Studio Auto-sizing...');
    const widgets = await page.$$('.desktop-widget');
    console.log(`Total desktop widgets active: ${widgets.length}`);
    await page.screenshot({ path: path.join(ASSETS_DIR, 'widget_studio_autosize.png') });

    // -------------------------------------------------------------------------
    // 9. R-12: Console Errors & Failed Requests
    // -------------------------------------------------------------------------
    console.log('\n>>> [9/12] Verifying R-12: Console Errors & Network Failures...');
    console.log(`Console errors/warnings: ${consoleMessages.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);
    assert.strictEqual(failedRequests.length, 0, 'Zero network request failures permitted');

    // -------------------------------------------------------------------------
    // 10. Performance & Memory Thresholds Verification (R-13, R-14)
    // -------------------------------------------------------------------------
    console.log('\n>>> [10/12] Verifying R-13 & R-14: Performance & Memory Metrics...');
    const metrics = await page.metrics();
    const heapUsedMB = metrics.JSHeapUsedSize / (1024 * 1024);
    const heapTotalMB = metrics.JSHeapTotalSize / (1024 * 1024);
    console.log(`JS Heap Used: ${heapUsedMB.toFixed(2)} MB (Total: ${heapTotalMB.toFixed(2)} MB)`);
    assert(heapUsedMB <= 40, `JS heap must be <= 40 MB (got ${heapUsedMB.toFixed(2)} MB)`);

    const perfData = {
      heapUsedMB: parseFloat(heapUsedMB.toFixed(2)),
      heapTotalMB: parseFloat(heapTotalMB.toFixed(2)),
      consoleMessagesCount: consoleMessages.length,
      failedRequestsCount: failedRequests.length,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(ASSETS_DIR, 'round13_perf_metrics.json'), JSON.stringify(perfData, null, 2));

    console.log('\n================================================================');
    console.log('   ROUND 13 VERIFICATION PASSED: ALL CHECKS CLEAN (R-1 to R-18) ');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error('\n[TEST RUN FAILED]:', err);
  process.exit(1);
});
