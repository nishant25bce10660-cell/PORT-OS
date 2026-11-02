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
  console.log('  ROUND 31 VERIFICATION: BORDERGLOW IN NAV BAR & ON EVERY LOGO  ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
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
    if (msg.type() === 'error') console.log(`[PAGE ERROR]: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[PAGE UNCAUGHT]: ${err.message}`);
  });

  const client = await page.target().createCDPSession();

  try {
    console.log('--- Step 1: Login & Load Desktop ---');
    await client.send('Network.clearBrowserCookies');

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 15000 });

    const guestAvatar = await page.$('#avatar-select-guest');
    if (guestAvatar) {
      await guestAvatar.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    await page.waitForSelector('#input-viewer-name', { timeout: 5000 });
    await page.type('#input-viewer-name', 'Reviewer');
    await page.type('#input-viewer-email', 'rev@example.com');
    await page.waitForSelector('#btn-login-viewer', { timeout: 5000 });
    await page.click('#btn-login-viewer');

    await page.waitForSelector('#desktop-workspace', { timeout: 15000 });
    console.log('  Desktop workspace loaded.');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('\n--- Step 2: Verify BorderGlow on Navigation Bar Container ---');
    const navBarGlow = await page.$('.nav-bar-border-glow.border-glow-card');
    check('Nav Bar has .nav-bar-border-glow wrapper with BorderGlow card structure', navBarGlow !== null);

    const navBarInner = await page.$('.nav-bar-border-glow .border-glow-inner #portfolio-menubar');
    check('MenuBar #portfolio-menubar is mounted inside BorderGlow', navBarInner !== null);

    const navBarEdgeLight = await page.$('.nav-bar-border-glow > .edge-light');
    check('Nav Bar contains .edge-light element for directional glow', navBarEdgeLight !== null);

    console.log('\n--- Step 3: Verify BorderGlow on Every Logo in Nav Bar ---');
    // 3.1 Geometric "N" logo
    const nLogoGlow = await page.$('.nav-logo-system.border-glow-card');
    check('Geometric "N" system logo has BorderGlow', nLogoGlow !== null);

    // 3.2 Finder logo
    const finderLogoGlow = await page.$('.nav-logo-finder.border-glow-card');
    check('Finder logo item has BorderGlow', finderLogoGlow !== null);

    // 3.3 Terminal logo
    const terminalLogoGlow = await page.$('.nav-logo-terminal.border-glow-card');
    check('Terminal logo item has BorderGlow', terminalLogoGlow !== null);

    // 3.4 Settings logo
    const settingsLogoGlow = await page.$('.nav-logo-settings.border-glow-card');
    check('Settings logo item has BorderGlow', settingsLogoGlow !== null);

    // 3.5 Help logo
    const helpLogoGlow = await page.$('.nav-logo-help.border-glow-card');
    check('Help logo item has BorderGlow', helpLogoGlow !== null);

    // 3.6 Spotlight logo
    const spotlightLogoGlow = await page.$('.nav-logo-spotlight.border-glow-card');
    check('Spotlight Search button has BorderGlow', spotlightLogoGlow !== null);

    // 3.7 User badge logo
    const userLogoGlow = await page.$('.nav-logo-user.border-glow-card');
    check('User Profile badge has BorderGlow', userLogoGlow !== null);

    // 3.8 Clock badge logo
    const clockLogoGlow = await page.$('.nav-logo-clock.border-glow-card');
    check('Clock Date/Time badge has BorderGlow', clockLogoGlow !== null);

    console.log('\n--- Step 4: Verify Dynamic Cursor Proximity & Angle Calculation ---');
    // Hover over nav bar and check custom properties
    await page.mouse.move(300, 14);
    await new Promise((r) => setTimeout(r, 200));

    const navVars = await page.evaluate(() => {
      const el = document.querySelector('.nav-bar-border-glow');
      if (!el) return null;
      return {
        proximity: el.style.getPropertyValue('--edge-proximity'),
        angle: el.style.getPropertyValue('--cursor-angle'),
      };
    });
    check('Nav Bar updates --edge-proximity and --cursor-angle on pointer move', navVars && navVars.proximity !== '' && navVars.angle !== '', JSON.stringify(navVars));

    // Hover over Geometric "N" logo
    const nLogoBox = await nLogoGlow.boundingBox();
    if (nLogoBox) {
      await page.mouse.move(nLogoBox.x + 4, nLogoBox.y + 4);
      await new Promise((r) => setTimeout(r, 200));
      const nVars = await page.evaluate(() => {
        const el = document.querySelector('.nav-logo-system');
        return el ? el.style.getPropertyValue('--edge-proximity') : '';
      });
      check('Geometric "N" logo updates --edge-proximity on pointer move near edge', nVars !== '', `proximity: ${nVars}`);
    }

    console.log('\n--- Step 5: Verify Click Action on Nav Bar Logos ---');
    // Click Terminal logo from nav bar
    if (terminalLogoGlow) {
      await terminalLogoGlow.click();
      console.log('  Clicked Terminal logo in nav bar.');
      await new Promise((r) => setTimeout(r, 1000));
      const terminalWindow = await page.$('#window-terminal');
      check('Clicking Terminal logo opens Terminal window', terminalWindow !== null);
    }

    console.log('\n--- Step 6: Verify Dock Logos also have BorderGlow ---');
    const dockGlowItems = await page.$$('.dock-logo-glow.border-glow-card');
    check('Dock logos are wrapped with BorderGlow (>= 4 items)', dockGlowItems.length >= 4, `count: ${dockGlowItems.length}`);

  } catch (err) {
    console.error('Test error:', err);
    check('Complete Round 31 test suite execution', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('  SUMMARY OF RESULTS:');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`  Passed: ${passedCount}/${results.length}`);
  console.log(`  Verdict: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
  console.log('================================================================');

  if (!allPassed) process.exit(1);
}

main();
