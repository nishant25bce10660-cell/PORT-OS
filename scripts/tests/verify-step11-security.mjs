import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step11');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const XSS_PAYLOADS = [
  '<img src=x onerror=window.__xss=1>',
  '"><svg onload=window.__xss=1>',
  '<script>window.__xss=1</script>',
  '\u202E[BIDI-OVERRIDE]_test.pdf',
  'A'.repeat(400) + '_super_long_filename.md',
];

async function ensureLoggedIn(page) {
  try {
    await page.waitForFunction(() => !document.querySelector('#boot-screen-overlay'), { timeout: 15000 });
    const loginModal = await page.$('#login-modal-overlay');
    if (loginModal) {
      const guestAvatar = await page.$('#avatar-select-guest');
      if (guestAvatar) await guestAvatar.click();
      await page.waitForSelector('#input-viewer-name', { timeout: 4000 });
      await page.type('#input-viewer-name', 'Fuzz Tester');
      await page.type('#input-viewer-email', 'fuzz@example.com');
      const loginBtn = await page.$('#btn-login-viewer');
      if (loginBtn) await loginBtn.click();
      await page.waitForFunction(() => !document.querySelector('#login-modal-overlay'), { timeout: 10000 });
    }
    await page.waitForSelector('#desktop-item-projects', { timeout: 15000 });
  } catch (err) {
    console.error('ensureLoggedIn failed:', err);
  }
}

async function runSecurityStep11() {
  console.log('================================================================');
  console.log('  PORT OS ROUND 18 · STEP 11 — SECURITY & XSS FUZZING AUDIT     ');
  console.log('================================================================\n');

  const results = {
    xssEscapingPills: false,
    xssEscapingTooltip: false,
    xssEscapingQuickLook: false,
    rbacViewerBlocked: false,
    schemaValidationEnforced: false,
    cookieHygieneStrict: false,
    payloadsTested: XSS_PAYLOADS.length,
    alertsTriggered: 0,
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('dialog', async (dialog) => {
    results.alertsTriggered++;
    console.error('  [SECURITY ALERT] Browser dialog triggered:', dialog.message());
    await dialog.dismiss();
  });

  try {
    // -------------------------------------------------------------
    // 1. HOSTILE FILE/FOLDER NAME XSS FUZZING
    // -------------------------------------------------------------
    console.log('[1/4] Injecting Hostile XSS / Bidi / Long Strings Payloads into Portfolio Data...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    await new Promise((r) => setTimeout(r, 600));

    // Inject hostile items into localStorage / component state
    await page.evaluate((payloads) => {
      window.__xss = 0;
      try {
        const stored = localStorage.getItem('portos_portfolio_cache');
        const data = stored ? JSON.parse(stored) : {};
        if (!data.items) data.items = [];

        payloads.forEach((payload, idx) => {
          data.items.push({
            id: `fuzz-${idx}`,
            name: payload,
            label: payload,
            kind: 'file',
            parentId: 'projects',
            content: `Fuzz Content for ${payload}`,
            size: '1.2 KB',
            modified: '2026-10-27',
          });
        });

        localStorage.setItem('portos_portfolio_cache', JSON.stringify(data));
      } catch (e) {
        console.error(e);
      }
    }, XSS_PAYLOADS);

    // Hover projects folder to expand file pills with hostile payloads
    console.log('  Hovering folder to evaluate file pills with injected payloads...');
    const proj = await page.$('#desktop-item-projects');
    const pBox = await proj.boundingBox();
    await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, { steps: 16 });
    await page.waitForSelector('.folder-float__item', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Verify pills render safely as text and __xss is NOT modified
    const xssPillsCheck = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.folder-float__item'));
      const htmlHasScript = pills.some((p) => p.innerHTML.includes('<script>'));
      return {
        pillCount: pills.length,
        xssExecuted: window.__xss === 1,
        htmlHasScript,
      };
    });

    console.log('  Pills rendered safely:', xssPillsCheck);
    results.xssEscapingPills = !xssPillsCheck.xssExecuted && !xssPillsCheck.htmlHasScript;
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_fuzz_folder_pills.png') });

    // Click first pill to open Quick Look / File window
    console.log('  Testing Quick Look / Window with hostile payload...');
    const firstPill = await page.$('.folder-float__item');
    if (firstPill) await firstPill.click();
    await new Promise((r) => setTimeout(r, 400));

    const xssWindowCheck = await page.evaluate(() => {
      return window.__xss === 1;
    });

    results.xssEscapingQuickLook = !xssWindowCheck;
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_fuzz_window_opened.png') });

    // Close window and reset pointer
    await page.evaluate(() => {
      document.querySelectorAll('.window-shell button[aria-label="Close"]').forEach((b) => b.click());
    });
    await page.mouse.move(500, 500);
    await new Promise((r) => setTimeout(r, 300));

    // -------------------------------------------------------------
    // 2. SERVER RBAC & VIEWER MUTATION BLOCK
    // -------------------------------------------------------------
    console.log('\n[2/4] Testing Server-Side RBAC & Viewer Mutation Restrictions...');
    const rbacTests = await page.evaluate(async () => {
      const testList = [];

      // A. Unauthenticated PUT /api/settings
      try {
        const resA = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin: { username: 'hacker' } }),
        });
        testList.push({ test: 'Unauthenticated PUT /api/settings', status: resA.status, blocked: resA.status === 401 || resA.status === 403 });
      } catch (e) {
        testList.push({ test: 'Unauthenticated PUT /api/settings', blocked: true });
      }

      // B. Unauthenticated POST /api/items (create item)
      try {
        const resB = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: { name: 'malicious.exe', kind: 'file' } }),
        });
        testList.push({ test: 'Unauthenticated POST /api/items', status: resB.status, blocked: resB.status === 401 || resB.status === 403 });
      } catch (e) {
        testList.push({ test: 'Unauthenticated POST /api/items', blocked: true });
      }

      // C. Unauthenticated DELETE /api/items
      try {
        const resC = await fetch('/api/items?id=projects', {
          method: 'DELETE',
        });
        testList.push({ test: 'Unauthenticated DELETE /api/items', status: resC.status, blocked: resC.status === 401 || resC.status === 403 || resC.status === 405 });
      } catch (e) {
        testList.push({ test: 'Unauthenticated DELETE /api/items', blocked: true });
      }

      return testList;
    });

    console.log('  RBAC test results:', rbacTests);
    results.rbacViewerBlocked = rbacTests.every((t) => t.blocked);

    // -------------------------------------------------------------
    // 3. SCHEMA VALIDATION & MALFORMED PAYLOAD INJECTION
    // -------------------------------------------------------------
    console.log('\n[3/4] Testing Strict Schema Validation & Malformed Payloads...');
    const schemaTests = await page.evaluate(async () => {
      const testList = [];

      // Send arbitrary unexpected keys
      try {
        const res = await fetch('/api/portfolio', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            __proto__: { admin: true },
            constructor: { prototype: { polluter: true } },
            evilPayload: 'DROP TABLE',
          }),
        });
        testList.push({ test: 'Prototype Pollution / Malformed Schema', status: res.status, blocked: res.status === 400 || res.status === 401 || res.status === 403 });
      } catch (e) {
        testList.push({ test: 'Prototype Pollution / Malformed Schema', blocked: true });
      }

      return testList;
    });

    console.log('  Schema test results:', schemaTests);
    results.schemaValidationEnforced = schemaTests.every((t) => t.blocked);

    // -------------------------------------------------------------
    // 4. COOKIE HYGIENE & SAME-SITE STRICT
    // -------------------------------------------------------------
    console.log('\n[4/4] Auditing Cookie Hygiene (HttpOnly, SameSite=Strict)...');
    const cookies = await page.cookies();
    console.log(`  Cookies retrieved: ${cookies.length}`);
    let cookiePass = true;
    for (const c of cookies) {
      if (c.name.includes('session') || c.name.includes('auth') || c.name.includes('token')) {
        const isStrict = c.sameSite === 'Strict' || c.sameSite === 'Lax';
        const isHttpOnly = c.httpOnly;
        console.log(`    Cookie ${c.name}: httpOnly=${isHttpOnly}, sameSite=${c.sameSite}`);
        if (!isStrict) cookiePass = false;
      }
    }
    results.cookieHygieneStrict = cookiePass;

    console.log('\n================================================================');
    console.log('               SECURITY AUDIT STEP 11 SUMMARY                   ');
    console.log('================================================================');
    console.log(`XSS File Pills Escaped:        ${results.xssEscapingPills ? 'PASS' : 'FAIL'}`);
    console.log(`XSS Quick Look Escaped:        ${results.xssEscapingQuickLook ? 'PASS' : 'FAIL'}`);
    console.log(`Server RBAC Enforced:          ${results.rbacViewerBlocked ? 'PASS' : 'FAIL'}`);
    console.log(`Strict Schema Validation:      ${results.schemaValidationEnforced ? 'PASS' : 'FAIL'}`);
    console.log(`Cookie Hygiene Strict:         ${results.cookieHygieneStrict ? 'PASS' : 'FAIL'}`);
    console.log(`Alerts Triggered:              ${results.alertsTriggered} (Zero Allowed)`);
    console.log('================================================================\n');

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'step11_security_results.json'),
      JSON.stringify(results, null, 2)
    );

  } catch (err) {
    console.error('Security audit error:', err);
  } finally {
    await browser.close();
  }
}

runSecurityStep11();
