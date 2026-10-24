import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.resolve('report_assets/round-10');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runAdversaryPass() {
  console.log('================================================================');
  console.log('  PORT OS — PHASE 7: SEC-L ADVERSARY PASS (4 ADVERSARY GOALS)   ');
  console.log('================================================================\n');

  const results = {
    goal1_anonReadRestricted: { pass: false, details: [] },
    goal2_guestMutateServer: { pass: false, details: [] },
    goal3_xssExecution: { pass: false, details: [] },
    goal4_crossOriginAccess: { pass: false, details: [] },
  };

  // ---------------------------------------------------------------------------
  // GOAL 1: As Anonymous, read any file outside public portfolio data
  // ---------------------------------------------------------------------------
  console.log('[ADVERSARY GOAL 1] Attempting to read restricted/secret files as Anonymous...');
  const restrictedPaths = [
    '/api/pc/browse',
    '/api/pc/read?path=C:/Windows/System32/drivers/etc/hosts',
    '/api/items/trash',
    '/api/telemetry/visitors',
    '/data/portfolio.json',
    '/.env.local',
    '/package.json',
    '/.git/config',
  ];

  let goal1BlockedCount = 0;
  for (const p of restrictedPaths) {
    const res = await fetch(`${BASE_URL}${p}`);
    const isBlocked = res.status === 401 || res.status === 403 || res.status === 404;
    results.goal1_anonReadRestricted.details.push({ path: p, status: res.status, blocked: isBlocked });
    if (isBlocked) goal1BlockedCount++;
    console.log(`  - GET ${p} => HTTP ${res.status} (${isBlocked ? 'BLOCKED' : 'EXPOSED'})`);
  }

  results.goal1_anonReadRestricted.pass = goal1BlockedCount === restrictedPaths.length;
  console.log(`  * Goal 1 Result: ${results.goal1_anonReadRestricted.pass ? 'PASS (Adversary Failed to access restricted data)' : 'FAIL'}\n`);

  // ---------------------------------------------------------------------------
  // GOAL 2: As Guest, mutate any file or setting on the server
  // ---------------------------------------------------------------------------
  console.log('[ADVERSARY GOAL 2] Attempting mutating operations on server as Guest...');
  // Log in as guest to get token
  const guestLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'guest', name: 'Adversary Guest', email: 'adversary@evil.test' }),
  });
  const cookieHeader = guestLoginRes.headers.get('set-cookie') || '';
  const guestCookie = (cookieHeader.match(/portfolio_session=([^;]+)/) || [])[1] || '';

  const mutationProbes = [
    { method: 'POST', path: '/api/items', body: { item: { name: 'hacked.txt', kind: 'file' } } },
    { method: 'PUT', path: '/api/items/projects', body: { name: 'Pwned' } },
    { method: 'DELETE', path: '/api/items/projects' },
    { method: 'PUT', path: '/api/settings', body: { general: { ownerName: 'Attacker' } } },
    { method: 'PUT', path: '/api/portfolio', body: { owner: { name: 'Attacker' } } },
    { method: 'PUT', path: '/api/widgets', body: { widgets: [] } },
    { method: 'DELETE', path: '/api/telemetry/visitors' },
  ];

  let goal2BlockedCount = 0;
  for (const m of mutationProbes) {
    const res = await fetch(`${BASE_URL}${m.path}`, {
      method: m.method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `portfolio_session=${guestCookie}`,
      },
      body: JSON.stringify(m.body || {}),
    });

    const isBlocked = res.status === 403 || res.status === 401;
    results.goal2_guestMutateServer.details.push({ method: m.method, path: m.path, status: res.status, blocked: isBlocked });
    if (isBlocked) goal2BlockedCount++;
    console.log(`  - ${m.method} ${m.path} => HTTP ${res.status} (${isBlocked ? 'BLOCKED - 403 Forbidden' : 'MUTATED'})`);
  }

  results.goal2_guestMutateServer.pass = goal2BlockedCount === mutationProbes.length;
  console.log(`  * Goal 2 Result: ${results.goal2_guestMutateServer.pass ? 'PASS (Adversary Failed to mutate server)' : 'FAIL'}\n`);

  // ---------------------------------------------------------------------------
  // GOAL 3: Through any input, execute JavaScript or trigger unexpected network request
  // ---------------------------------------------------------------------------
  console.log('[ADVERSARY GOAL 3] Testing XSS payload corpus injection in headless browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    let dialogTriggered = false;
    let xssExecuted = false;

    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      console.error(`  [CRITICAL ALERT] XSS dialog triggered: ${dialog.message()}`);
      await dialog.dismiss();
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    // Inject XSS corpus into login input fields
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      '"><svg/onload=alert("xss")>',
      'javascript:alert("xss")',
      '{{7*7}}',
      '=cmd|"/c calc"!A0',
    ];

    for (const payload of xssPayloads) {
      await page.waitForSelector('#input-viewer-name');
      await page.evaluate(() => {
        const input = document.getElementById('input-viewer-name');
        if (input) input.value = '';
      });
      await page.type('#input-viewer-name', payload);
      await page.evaluate(() => {
        const input = document.getElementById('input-viewer-email');
        if (input) input.value = 'xss@test.local';
      });
      await page.click('#btn-login-viewer');
      await new Promise(r => setTimeout(r, 200));
    }

    results.goal3_xssExecution.pass = !dialogTriggered && !xssExecuted;
    console.log(`  * Injected ${xssPayloads.length} XSS payloads; Dialogs triggered: ${dialogTriggered ? 'YES (FAIL)' : '0 (PASS)'}`);
    console.log(`  * Goal 3 Result: ${results.goal3_xssExecution.pass ? 'PASS (Zero script execution)' : 'FAIL'}\n`);

  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // GOAL 4: From a second origin, read or write any PORT OS resource
  // ---------------------------------------------------------------------------
  console.log('[ADVERSARY GOAL 4] Testing Cross-Origin Requests from foreign origins...');
  const foreignOrigins = [
    'http://attacker-evil.com',
    'https://phishing-site.xyz',
    'http://localhost:8080',
    'null',
  ];

  let goal4BlockedCount = 0;
  for (const origin of foreignOrigins) {
    const res = await fetch(`${BASE_URL}/api/portfolio`, {
      method: 'PUT',
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ widgets: [] }),
    });

    const isBlocked = res.status === 403 || res.status === 400;
    results.goal4_crossOriginAccess.details.push({ origin, status: res.status, blocked: isBlocked });
    if (isBlocked) goal4BlockedCount++;
    console.log(`  - Mutating PUT with Origin '${origin}' => HTTP ${res.status} (${isBlocked ? 'BLOCKED' : 'ACCEPTED'})`);
  }

  results.goal4_crossOriginAccess.pass = goal4BlockedCount === foreignOrigins.length;
  console.log(`  * Goal 4 Result: ${results.goal4_crossOriginAccess.pass ? 'PASS (Zero cross-origin requests permitted)' : 'FAIL'}\n`);

  // Save report
  const reportPath = path.join(EVIDENCE_DIR, 'adversary-pass-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`=> Adversary Pass Report saved to: ${path.relative(process.cwd(), reportPath)}`);

  const allGoalsPassed = results.goal1_anonReadRestricted.pass &&
                         results.goal2_guestMutateServer.pass &&
                         results.goal3_xssExecution.pass &&
                         results.goal4_crossOriginAccess.pass;

  console.log('================================================================');
  console.log(`  SEC-L ADVERSARY PASS VERIFICATION: ${allGoalsPassed ? 'ALL GOALS REPELLED (PASS)' : 'FAIL'}`);
  console.log('================================================================\n');

  if (!allGoalsPassed) process.exit(1);
}

runAdversaryPass().catch(err => {
  console.error('Fatal error during adversary pass:', err);
  process.exit(1);
});
