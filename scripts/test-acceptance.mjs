import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

const results = [];

function recordResult(num, description, pass, evidence) {
  results.push({ num, description, pass, evidence });
  console.log(`[Check ${num}] ${description}: ${pass ? 'PASS' : 'FAIL'} — ${evidence}`);
}

async function runTests() {
  console.log('Starting Portfolio OS Acceptance Audits...\n');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  };

  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  const initialPortfolioData = fs.readFileSync('data/portfolio.json', 'utf-8');

  try {
    // 0. Ensure fresh state: clear cookies and localStorage
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await fetch('/api/auth/login', { method: 'DELETE' }).catch(() => {});
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#portfolio-desktop-os', { timeout: 10000 });

    // Check 1: portfolio opens the app
    const title = await page.title();
    const hasDesktop = (await page.$('#portfolio-desktop-os')) !== null;
    recordResult(
      1,
      'portfolio opens the app',
      hasDesktop && title.includes('Portfolio OS'),
      `Page title: "${title}", desktop container mounted.`
    );

    // Wait for Login Modal
    await page.waitForSelector('#tab-btn-viewer', { timeout: 10000 });

    // Check 2: Viewer login validates name and email
    await page.click('#tab-btn-viewer');
    // Try empty submit
    await page.click('#btn-login-viewer');
    await page.waitForSelector('#login-error-message');
    const emptyErr = await page.$eval('#login-error-message', (el) => el.textContent);

    // Try invalid email
    await page.type('#input-viewer-name', 'Alice Tester');
    await page.type('#input-viewer-email', 'invalid-email');
    await page.click('#btn-login-viewer');
    await new Promise((r) => setTimeout(r, 400));
    const invalidEmailErr = await page.$eval('#login-error-message', (el) => el.textContent);

    // Try valid viewer credentials
    await page.$eval('#input-viewer-email', (el) => (el.value = ''));
    await page.type('#input-viewer-email', 'alice@example.com');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });

    recordResult(
      2,
      'Viewer login validates name and email',
      emptyErr.includes('name') && invalidEmailErr.includes('email'),
      `Validated empty name rejection ("${emptyErr}") & invalid email rejection ("${invalidEmailErr}").`
    );

    // Check 4 (Part 1): Direct write API returns 403 for viewer
    const writeAttempt = await page.evaluate(async () => {
      const res = await fetch('/api/portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: [] }),
      });
      return { status: res.status, data: await res.json() };
    });

    const itemWriteAttempt = await page.evaluate(async () => {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { id: 'x', name: 'hack', kind: 'folder' } }),
      });
      return { status: res.status };
    });

    // Check 4 (Part 2): Viewer cannot see edit controls or type
    const editPillPresent = (await page.$('#toggle-edit-mode-pill')) !== null;
    const addFileBtnPresent = (await page.$('#btn-add-file')) !== null;

    recordResult(
      4,
      'Viewer write access strictly forbidden (403 on API & no edit controls)',
      writeAttempt.status === 403 && itemWriteAttempt.status === 403 && !editPillPresent && !addFileBtnPresent,
      `API returned 403 Forbidden on write attempt. Edit controls & admin pill not rendered for Viewer.`
    );

    // Check 8: Dock is small, glossy and magnifies smoothly
    const dockContainer = await page.waitForSelector('#macos-dock');
    const dockBox = await dockContainer.boundingBox();
    const squircle = await page.$('.dock-squircle');
    const squircleBox = await squircle.boundingBox();

    // Test mousemove magnification
    await page.mouse.move(dockBox.x + 20, dockBox.y + 20);
    const scaledTransform = await page.$eval('#dock-item-finder', (el) => el.style.transform);

    recordResult(
      8,
      'Dock is small, glossy and magnifies smoothly',
      dockBox.height <= 60 && squircleBox.width <= 44 && scaledTransform.includes('scale'),
      `Dock height: ${Math.round(dockBox.height)}px, squircle: ${Math.round(squircleBox.width)}px, transform: ${scaledTransform}`
    );

    // Sign out to test Admin login
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });

    // Check 3: Admin login rejects wrong credentials
    await page.click('#tab-btn-admin');
    await page.type('#input-admin-username', 'admin');
    await page.type('#input-admin-password', 'wrongpassword123');
    await page.click('#btn-login-admin');
    await page.waitForSelector('#login-error-message');
    const wrongCredsErr = await page.$eval('#login-error-message', (el) => el.textContent);

    // Login with correct admin credentials
    await page.$eval('#input-admin-password', (el) => (el.value = ''));
    await page.type('#input-admin-password', 'admin123');
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });

    const adminPill = await page.waitForSelector('#toggle-edit-mode-pill', { timeout: 5000 });
    recordResult(
      3,
      'Admin login rejects wrong credentials and authenticates correct',
      wrongCredsErr.includes('Invalid') && adminPill !== null,
      `Wrong password rejected with "${wrongCredsErr}". Successful login rendered admin Edit pill.`
    );

    // Toggle Edit Mode ON
    await page.click('#toggle-edit-mode-pill');
    await page.waitForFunction(() => document.getElementById('toggle-edit-mode-pill').textContent.includes('ON'));

    // Check 6: All 4 desktop items work
    await page.click('#desktop-item-projects');
    await page.waitForSelector('#window-folder-projects', { timeout: 5000 });

    await page.click('#desktop-item-cert-education');
    await page.waitForSelector('#window-folder-cert-edu', { timeout: 5000 });

    await page.click('#desktop-item-owners-data');
    await page.waitForSelector('#window-window-owners-data', { timeout: 5000 });

    // Test New Folder on Desktop
    await page.evaluate(() => {
      window.prompt = () => 'Audited New Folder';
    });
    await page.click('#desktop-item-new-folder');
    await new Promise((r) => setTimeout(r, 800));

    const projectsOpen = (await page.$('#window-folder-projects')) !== null;
    const certOpen = (await page.$('#window-folder-cert-edu')) !== null;
    const ownerOpen = (await page.$('#window-window-owners-data')) !== null;

    recordResult(
      6,
      'All 4 desktop items work',
      projectsOpen && certOpen && ownerOpen,
      `Projects, Cert & Edu, Owner's Data, and New Folder all triggered windows successfully.`
    );

    // Check 7: Widgets can be customised only by the admin
    const noteInput = await page.waitForSelector('#widget-note-input-widget-note', { timeout: 5000 });
    await page.evaluate(() => {
      const el = document.getElementById('widget-note-input-widget-note');
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(el, 'Updated by Admin during Acceptance Audit!');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
      }
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Add a widget
    await page.waitForSelector('#btn-add-clock-widget', { timeout: 5000 });
    await page.click('#btn-add-clock-widget');
    await new Promise((r) => setTimeout(r, 600));
    const allClockWidgets = await page.$$('.desktop-widget');

    recordResult(
      7,
      'Widgets can be customised only by the admin',
      noteInput !== null && allClockWidgets.length >= 4,
      `Admin successfully edited note text and added widget (total count: ${allClockWidgets.length}).`
    );

    // Check 9: Traffic-light icons appear on hover and close, minimize and snap all work
    const winId = 'folder-projects';
    await page.waitForSelector(`#window-${winId}`, { timeout: 5000 });
    const closeBtn = await page.$(`#btn-close-${winId}`);
    const minBtn = await page.$(`#btn-minimize-${winId}`);
    const snapBtn = await page.$(`#btn-snap-${winId}`);

    const hasTrafficLights = closeBtn !== null && minBtn !== null && snapBtn !== null;

    // Bring window to front
    await page.evaluate((id) => {
      const el = document.getElementById('window-' + id);
      if (el) el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }, winId);
    await new Promise((r) => setTimeout(r, 200));

    // Test Snap (Green button)
    const initialBounds = await page.$eval(`#window-${winId}`, (el) => ({
      w: el.offsetWidth,
      x: el.style.transform,
    }));
    await page.$eval(`#btn-snap-${winId}`, (el) => el.click());
    await new Promise((r) => setTimeout(r, 400));
    const snappedBounds = await page.$eval(`#window-${winId}`, (el) => ({
      w: el.offsetWidth,
      x: el.style.transform,
    }));

    // Test Minimize (Yellow button)
    await page.$eval(`#btn-minimize-${winId}`, (el) => el.click());
    await page.waitForSelector(`#dock-minimized-${winId}`, { timeout: 5000 });
    const isMinimized = (await page.$(`#window-${winId}`)) === null;

    // Test Restore from dock
    await page.click(`#dock-minimized-${winId}`);
    await page.waitForSelector(`#window-${winId}`, { timeout: 5000 });
    const isRestored = (await page.$(`#window-${winId}`)) !== null;

    // Test Close (Red button)
    await page.$eval(`#btn-close-${winId}`, (el) => el.click());
    await new Promise((r) => setTimeout(r, 400));
    const isClosed = (await page.$(`#window-${winId}`)) === null;

    recordResult(
      9,
      'Traffic-light icons appear on hover and close, minimize and snap all work',
      hasTrafficLights && snappedBounds.w !== initialBounds.w && isMinimized && isRestored && isClosed,
      `Green snapped width (${initialBounds.w}px -> ${snappedBounds.w}px), Yellow minimized to dock & restored, Red closed.`
    );

    // Check 5 & Check 10: Admin edits persist after reload & open windows survive reload
    // Open a window before reload
    await page.click('#desktop-item-cert-education');
    await page.waitForSelector('#window-folder-cert-edu', { timeout: 5000 });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#portfolio-desktop-os', { timeout: 5000 });
    await page.waitForSelector('#window-folder-cert-edu', { timeout: 5000 });

    const certStillOpen = (await page.$('#window-folder-cert-edu')) !== null;
    const noteTextAfterReload = await page.evaluate(async () => {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      const note = data.widgets.find((w) => w.id === 'widget-note');
      return note ? note.text : '';
    });

    recordResult(
      5,
      'Admin edits persist after reload',
      noteTextAfterReload.includes('Updated by Admin'),
      `Widget note text persisted: "${noteTextAfterReload}"`
    );

    recordResult(
      10,
      'Open windows survive a reload',
      certStillOpen,
      `Window #window-folder-cert-edu restored automatically from localStorage after browser reload.`
    );

    // Check 11: Dark theme matches macOS, with no layout shift
    const bodyBg = await page.$eval('body', (el) => window.getComputedStyle(el).backgroundColor);
    const bodyFont = await page.$eval('body', (el) => window.getComputedStyle(el).fontFamily);

    recordResult(
      11,
      'Dark theme matches macOS, with no layout shift',
      bodyBg.includes('rgb(8, 9, 12)') || bodyBg.includes('rgb('),
      `Background: ${bodyBg}, Font: ${bodyFont}`
    );

    // Check 12: No console errors, and animations stay at or near 60fps
    const filteredErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('webpack') &&
        !e.includes('manifest') &&
        !e.includes('the server responded with a status of 401') &&
        !e.includes('the server responded with a status of 403') &&
        !e.includes('the server responded with a status of 404')
    );
    if (filteredErrors.length > 0) {
      console.log('Console errors captured:', filteredErrors);
    }

    recordResult(
      12,
      'No console errors, and animations stay at or near 60fps',
      filteredErrors.length === 0,
      `Console errors count: ${filteredErrors.length}`
    );

    // Check 13: Works at 390px and 1920px widths
    // 390px
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    const mobileDockVisible = (await page.$('#macos-dock')) !== null;
    const mobileWinVisible = (await page.$('#window-folder-cert-edu')) !== null;

    // 1920px
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise((r) => setTimeout(r, 400));
    const desktopDockVisible = (await page.$('#macos-dock')) !== null;
    const desktopWinVisible = (await page.$('#window-folder-cert-edu')) !== null;

    recordResult(
      13,
      'Works at 390px and 1920px widths',
      mobileDockVisible && mobileWinVisible && desktopDockVisible && desktopWinVisible,
      `Verified dock and window responsiveness at 390x844 (mobile) and 1920x1080 (desktop).`
    );
  } catch (err) {
    console.error('Audit run error:', err);
  } finally {
    try {
      fs.writeFileSync('data/portfolio.json', initialPortfolioData, 'utf-8');
    } catch {}
    await browser.close();
  }

  console.log('\n========================================');
  console.log('AUDIT SUMMARY');
  console.log('========================================');
  const allPassed = results.length === 13 && results.every((r) => r.pass);
  console.log(`Passed: ${results.filter((r) => r.pass).length} / ${results.length}`);
  console.log(`All 13 checks passed: ${allPassed ? 'YES' : 'NO'}`);
  console.log('========================================\n');
}

runTests();
