import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';

async function testApi() {
  console.log('Testing API host and role restrictions...');

  // 1. Production domain: Admin login must return 403 Forbidden
  const prodAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'x-forwarded-host': 'portos-azure.vercel.app',
      'Content-Type': 'application/json',
      'Origin': 'https://portos-azure.vercel.app',
    },
    body: JSON.stringify({ tab: 'admin', username: 'admin', password: 'password123' }),
  });
  console.log(`[API] Admin login on Vercel host: HTTP ${prodAdminRes.status} (expected 403)`);
  if (prodAdminRes.status !== 403) throw new Error(`Expected 403, got ${prodAdminRes.status}`);

  // 2. Production domain: Guest login must succeed
  const prodGuestRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'x-forwarded-host': 'portos-azure.vercel.app',
      'Content-Type': 'application/json',
      'Origin': 'https://portos-azure.vercel.app',
    },
    body: JSON.stringify({ tab: 'guest', name: 'Vercel Visitor', email: 'visitor@vercel.app' }),
  });
  console.log(`[API] Guest login on Vercel host: HTTP ${prodGuestRes.status} (expected 200)`);
  if (prodGuestRes.status !== 200) throw new Error(`Expected 200, got ${prodGuestRes.status}`);

  // 3. Foreign non-allowed host: DNS rebinding rejected
  const evilRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'x-forwarded-host': 'evil-domain.com',
      'Content-Type': 'application/json',
      'Origin': 'https://evil-domain.com',
    },
    body: JSON.stringify({ tab: 'guest', name: 'Attacker', email: 'attacker@evil.com' }),
  });
  console.log(`[API] Evil host login: HTTP ${evilRes.status} (expected 400)`);
  if (evilRes.status !== 400) throw new Error(`Expected 400, got ${evilRes.status}`);

  console.log('API checks passed!\n');
}

async function testPuppeteer() {
  console.log('Testing UI behavior in Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Clear cookies/session first
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');

  // 1. TEST PRE-LOGIN RIGHT-CLICK SUPPRESSION (ON LOCALHOST)
  await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });

  // Simulate right-click on the lock screen / login modal
  await page.click('#login-modal-overlay', { button: 'right' });
  await new Promise((r) => setTimeout(r, 500));

  // Verify that NO context menu is opened
  const contextMenuPreLogin = await page.$('.context-menu-container, [data-testid="context-menu"], .context-menu');
  console.log(`[UI] Context menu pre-login exists: ${contextMenuPreLogin !== null} (expected false)`);
  if (contextMenuPreLogin !== null) throw new Error('Context menu should NOT be accessible before login!');

  // Verify Owner avatar IS present on localhost
  const ownerAvatarOnLocal = await page.$('#avatar-select-owner');
  console.log(`[UI] Owner avatar on localhost exists: ${ownerAvatarOnLocal !== null} (expected true)`);
  if (!ownerAvatarOnLocal) throw new Error('Owner avatar should be visible on localhost!');

  // 2. TEST GUEST LOGIN FLOW
  console.log('Testing Guest login flow...');
  await page.waitForSelector('#input-viewer-name');
  await page.type('#input-viewer-name', 'Test Guest');
  await page.type('#input-viewer-email', 'testguest@example.com');
  await page.click('#btn-login-viewer');

  // Wait for login modal to fade out and desktop workspace to mount
  await page.waitForSelector('#desktop-workspace', { timeout: 10000 });
  console.log('[UI] Successfully logged in to desktop workspace!');

  // 3. TEST POST-LOGIN RIGHT-CLICK ON DESKTOP
  console.log('Testing Desktop context menu post-login...');
  // Click right button on the desktop background
  const workspace = await page.$('#desktop-workspace');
  const box = await workspace.boundingBox();
  await page.mouse.click(box.x + 300, box.y + 300, { button: 'right' });
  await new Promise((r) => setTimeout(r, 600));

  // Verify desktop context menu opened
  const contextMenuPostLogin = await page.$('.context-menu-container, [data-testid="context-menu"], .context-menu');
  console.log(`[UI] Context menu post-login exists: ${contextMenuPostLogin !== null} (expected true)`);
  if (!contextMenuPostLogin) throw new Error('Context menu SHOULD open on desktop after login!');

  // 4. TEST PRODUCTION DOMAIN SIMULATION (non-localhost)
  console.log('Testing production domain UI simulation (non-localhost)...');
  await client.send('Network.clearBrowserCookies');

  // Launch fresh page with mocked hostname
  const prodPage = await browser.newPage();
  await prodPage.setViewport({ width: 1280, height: 800 });
  await prodPage.evaluateOnNewDocument(() => {
    window.__MOCK_HOSTNAME__ = 'portos-azure.vercel.app';
  });

  await prodPage.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
  await prodPage.waitForSelector('#login-modal-overlay', { timeout: 10000 });

  // On production: Owner avatar must NOT exist
  const ownerAvatarProd = await prodPage.$('#avatar-select-owner');
  console.log(`[UI] Owner avatar on production exists: ${ownerAvatarProd !== null} (expected false)`);
  if (ownerAvatarProd !== null) throw new Error('Owner avatar MUST NOT be visible on production!');

  // On production: Role switch tab must NOT exist
  const roleSwitchProd = await prodPage.$('#login-role-switch');
  console.log(`[UI] Role switch on production exists: ${roleSwitchProd !== null} (expected false)`);
  if (roleSwitchProd !== null) throw new Error('Role switch MUST NOT be visible on production!');

  // On production: Guest avatar must exist
  const guestAvatarProd = await prodPage.$('#avatar-select-guest');
  console.log(`[UI] Guest avatar on production exists: ${guestAvatarProd !== null} (expected true)`);
  if (!guestAvatarProd) throw new Error('Guest avatar MUST be visible on production!');

  await prodPage.close();
  await page.close();

  await browser.close();
  console.log('All browser verification tests passed successfully!');
}

async function main() {
  await testApi();
  await testPuppeteer();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
