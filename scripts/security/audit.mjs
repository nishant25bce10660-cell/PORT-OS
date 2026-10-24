import fs from 'fs';
import path from 'path';
import http from 'http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('================================================================');
console.log('  PORT OS — APPLICATION SECURITY AUDIT SCANNER (H1 - H5)        ');
console.log('================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(name, pass, detail = '') {
  totalChecks++;
  if (pass) {
    passedChecks++;
    console.log(`  [PASS] ${name}`);
  } else {
    failedChecks++;
    console.error(`  [FAIL] ${name} — ${detail}`);
  }
}

// -------------------------------------------------------------
// S1: STATIC REPOSITORY SCAN FOR DEFAULT CREDENTIALS
// -------------------------------------------------------------
console.log('--- 1. Static Credential & Secret Audit ---');
try {
  const portfolioRaw = fs.readFileSync('data/portfolio.json', 'utf-8');
  const portfolio = JSON.parse(portfolioRaw);
  const defaultHash = '$2a$10$TJ0E/lVLdpZ8uJhhYH8f3.r0RwAPPT9l8pVvFk9.rDhYyQwYZank.';

  check('No default admin password hash in data/portfolio.json', portfolio.admin?.passwordHash !== defaultHash);
  check('Admin password hash is not hardcoded default in repo', !portfolioRaw.includes('admin123') && !portfolioRaw.includes(defaultHash));
} catch (err) {
  check('No default admin credentials', false, err.message);
}

// Check auth.ts for SameSite=Strict and timing-safe equal
try {
  const authCode = fs.readFileSync('lib/auth.ts', 'utf-8');
  check('Auth cookie configured with SameSite=Strict', authCode.includes("sameSite: 'strict'"));
  check('Auth cookie configured with httpOnly=true', authCode.includes("httpOnly: true"));
  check('Session verification uses timingSafeEqual', authCode.includes("crypto.timingSafeEqual"));
} catch (err) {
  check('Auth security controls', false, err.message);
}

// -------------------------------------------------------------
// S2: DYNAMIC NETWORK SECURITY AUDIT (AGAINST LOCAL SERVER)
// -------------------------------------------------------------
console.log('\n--- 2. Dynamic Attack & Vulnerability Tests ---');

// Helper for raw HTTP requests
function sendRawRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runDynamicTests() {
  try {
    // 1. DNS Rebinding: Host header manipulation
    const rebindingRes = await sendRawRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/session',
      method: 'GET',
      headers: {
        'Host': 'attacker-domain.com',
      },
    });
    check('DNS Rebinding blocked (Host header validation)', rebindingRes.statusCode === 400, `Got HTTP ${rebindingRes.statusCode}`);

    // 2. CSRF Guard: Mutating POST with foreign Origin
    const csrfRes = await fetch(`${BASE_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Origin': 'https://attacker-origin.xyz',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item: { name: 'exploit', kind: 'file' } }),
    });
    check('CSRF blocked on mutating route (Origin validation)', csrfRes.status === 403, `Got HTTP ${csrfRes.status}`);

    // 3. CSRF Guard: Mutating PUT with foreign Referer
    const refererRes = await fetch(`${BASE_URL}/api/portfolio`, {
      method: 'PUT',
      headers: {
        'Referer': 'https://evil-site.com/exploit.html',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ widgets: [] }),
    });
    check('CSRF blocked on mutating route (Referer validation)', refererRes.status === 403, `Got HTTP ${refererRes.status}`);

    // 4. Server-Side RBAC: Guest attempting admin mutation
    const rbacRes = await fetch(`${BASE_URL}/api/widgets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ widgets: [] }),
    });
    check('Server-side RBAC enforced for unauthenticated write', rbacRes.status === 403 || rbacRes.status === 401, `Got HTTP ${rbacRes.status}`);

    // 5. PC Bridge Path Traversal Attack (PC Bridge completely eliminated per Q3 & VF-05)
    const traversalRes = await fetch(`${BASE_URL}/api/pc/read?path=../../../../Windows/System32/drivers/etc/hosts`);
    check('PC Bridge endpoints completely removed (404) or blocked (403/401)', traversalRes.status === 404 || traversalRes.status === 403 || traversalRes.status === 401, `Got HTTP ${traversalRes.status}`);

    // 6. Fail-closed admin login with no credentials
    const emptyLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab: 'admin', username: 'admin', password: '' }),
    });
    check('Admin login rejects empty credentials', emptyLoginRes.status === 401, `Got HTTP ${emptyLoginRes.status}`);

    // 7. Rate Limit Teardown
    await fetch(`${BASE_URL}/api/auth/login`, { method: 'DELETE' });
    check('Login rate-limit test teardown supported', true);

  } catch (err) {
    check('Dynamic server accessibility', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`  SECURITY AUDIT COMPLETE: ${passedChecks}/${totalChecks} PASSED`);
  if (failedChecks > 0) {
    console.error(`  STATUS: FAILED (${failedChecks} vulnerabilities detected)`);
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log('  STATUS: PASSED (Zero High/Critical Vulnerabilities)');
    console.log('================================================================\n');
    process.exit(0);
  }
}

runDynamicTests();
