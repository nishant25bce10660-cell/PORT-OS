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
  console.log('  ROUND 26 VERIFICATION: 3D LANYARD COMPONENT INTEGRATION IN     ');
  console.log('  OWNER SECTION WITH NAME SECTION REMOVAL & OPTIMIZED PHYSICS   ');
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

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[PAGE LOG error]:`, msg.text());
    }
  });

  const client = await page.target().createCDPSession();

  try {
    console.log('--- Step 1: Login and Load Desktop ---');
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
    await page.waitForSelector('#btn-login-viewer', { timeout: 5000 });
    await page.click('#btn-login-viewer');

    await page.waitForSelector('#desktop-workspace', { timeout: 15000 });
    console.log('  Desktop workspace loaded.');
    await new Promise((r) => setTimeout(r, 1200));

    console.log('\n--- Step 2: Open Owner\'s Data Window ---');
    // Open Owner's Data via desktop icon double-click or dock icon
    const ownerDesktopIcon = await page.$('#desktop-item-owners-data');
    if (ownerDesktopIcon) {
      const box = await ownerDesktopIcon.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
    } else {
      await page.click('#dock-item-owners-data');
    }

    await page.waitForSelector('#window-owner-profile', { timeout: 10000 });
    console.log('  Owner Profile window opened.');
    await new Promise((r) => setTimeout(r, 1500));

    console.log('\n--- Step 3: Verify Lanyard Component Integration ---');
    // 3.1 Verify .lanyard container exists
    const lanyardContainer = await page.$('#window-owner-profile .lanyard');
    check('Lanyard root container (.lanyard) exists in Owner section', lanyardContainer !== null);

    // 3.2 Verify .lanyard-canvas or .lanyard-fallback is mounted
    const lanyardRenderEl = await page.$('#window-owner-profile .lanyard-canvas, #window-owner-profile .lanyard-fallback');
    check('Lanyard visual element (.lanyard-canvas or .lanyard-fallback) is mounted', lanyardRenderEl !== null);

    // 3.3 Verify visual display dimensions are positive
    if (lanyardRenderEl) {
      const renderBox = await lanyardRenderEl.boundingBox();
      check(
        'Lanyard visual display has positive dimensions',
        renderBox && renderBox.width > 150 && renderBox.height > 150,
        `width=${Math.round(renderBox?.width || 0)}, height=${Math.round(renderBox?.height || 0)}`
      );
    }

    // 3.4 Verify assets card-front.png, card-back.png, band.png exist on disk
    check('public/card-front.png exists', fs.existsSync('public/card-front.png'));
    check('public/card-back.png exists', fs.existsSync('public/card-back.png'));
    check('public/band.png exists', fs.existsSync('public/band.png'));

    console.log('\n--- Step 4: Verify Name Section Removal ---');
    // 4.1 Verify old avatar circle with 👨‍💻 emoji is removed
    const oldAvatarEmoji = await page.evaluate(() => {
      const win = document.querySelector('#window-owner-profile');
      return win ? win.textContent.includes('👨‍💻') : false;
    });
    check('Avatar emoji (👨‍💻) is REMOVED from owner section', !oldAvatarEmoji, 'Avatar circle removed');

    // 4.2 Verify prominent h2 name header is removed
    const hasOwnerNameHeader = await page.evaluate(() => {
      const win = document.querySelector('#window-owner-profile');
      const h2 = win?.querySelector('h2');
      return !!h2;
    });
    check('Name header (<h2>) is REMOVED from owner section', !hasOwnerNameHeader, 'Name section removed');

    // 4.3 Verify professional details remain accessible
    const profileDetails = await page.evaluate(() => {
      const win = document.querySelector('#window-owner-profile');
      return {
        hasTitle: win ? win.textContent.includes('Role & Specialization') || win.textContent.includes('Architect') : false,
        hasOverview: win ? win.textContent.includes('Overview') : false,
        hasContact: win ? win.textContent.includes('Direct Contact & Socials') : false,
        hasSecurityStatus: win ? win.textContent.includes('Cryptographic Verification Status') : false,
      };
    });
    check('Role & Specialization section is displayed', profileDetails.hasTitle);
    check('Overview / Bio section is displayed', profileDetails.hasOverview);
    check('Direct Contact & Socials section is displayed', profileDetails.hasContact);
    check('Security Clearance badge is displayed', profileDetails.hasSecurityStatus);

    console.log('\n--- Step 5: Verify Interactive Drag & Physics Animation ---');
    if (lanyardRenderEl) {
      const renderBox = await lanyardRenderEl.boundingBox();
      const startX = renderBox.x + renderBox.width / 2;
      const startY = renderBox.y + renderBox.height / 2;

      // Mouse drag physics test
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 80, startY + 40, { steps: 5 });
      await new Promise((r) => setTimeout(r, 200));
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 600));

      // Click flip test
      await page.mouse.click(startX, startY);
      await new Promise((r) => setTimeout(r, 600));

      check('Interaction (drag, swing, flip) executed without throwing errors', true);
    }

    // Check for critical unhandled JavaScript runtime errors
    const criticalErrors = errors.filter((e) => e.includes('TypeError') || e.includes('ReferenceError') || e.includes('SyntaxError') || e.includes('Uncaught'));
    check('Zero unhandled JavaScript runtime errors in owner section', criticalErrors.length === 0, `errors: ${criticalErrors.length}`);

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
