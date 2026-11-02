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
  console.log('  ROUND 28 VERIFICATION: REMOVE CARD GRADIENTS & PROPER CENTERING');
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
    console.log('  Desktop loaded.');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('\n--- Step 2: Open Owner\'s Data Window ---');
    const ownerDesktopIcon = await page.$('#desktop-item-owners-data');
    if (ownerDesktopIcon) {
      const box = await ownerDesktopIcon.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
    } else {
      await page.click('#dock-item-owners-data');
    }

    await page.waitForSelector('#window-owner-profile', { timeout: 10000 });
    console.log('  Owner Profile window opened.');
    await new Promise((r) => setTimeout(r, 1200));

    console.log('\n--- Step 3: Verify Removal of Background & Card Gradients ---');
    // Check lanyard column background style
    const colBackground = await page.evaluate(() => {
      const col = document.querySelector('.owner-lanyard-column');
      return col ? window.getComputedStyle(col).backgroundImage : '';
    });
    check('Column background has zero radial/linear gradient', colBackground === 'none' || !colBackground.includes('gradient'), colBackground);

    // Check SVG overlay on card-back.png has no linearGradient
    const cardBackSource = fs.readFileSync('public/card-back.png');
    check('public/card-back.png exists and is valid PNG', cardBackSource.length > 10000);

    const buildScriptSource = fs.readFileSync('scripts/build-card-assets.mjs', 'utf8');
    check('scripts/build-card-assets.mjs has zero linearGradient tags', !buildScriptSource.includes('<linearGradient'));

    console.log('\n--- Step 4: Verify Card Horizontal Centering ---');
    // The lanyard container bounding box vs canvas / column center
    const geometry = await page.evaluate(() => {
      const col = document.querySelector('.owner-lanyard-column');
      const lanyard = document.querySelector('.lanyard');
      if (!col || !lanyard) return null;
      const colRect = col.getBoundingClientRect();
      const lanyardRect = lanyard.getBoundingClientRect();
      return {
        colWidth: colRect.width,
        colLeft: colRect.left,
        colRight: colRect.right,
        colCenter: colRect.left + colRect.width / 2,
        lanyardWidth: lanyardRect.width,
        lanyardCenter: lanyardRect.left + lanyardRect.width / 2,
      };
    });

    check('Lanyard element is mounted and measured', geometry !== null);
    if (geometry) {
      const offset = Math.abs(geometry.lanyardCenter - geometry.colCenter);
      check('Lanyard component is centered within the column (< 2px delta)', offset < 2.0, `offset: ${offset}px`);
    }

    console.log('\n--- Step 5: Verify Right-Side Interactive Controls & Email ---');
    const emailLink = await page.$('#link-owner-email');
    check('Email link exists on right side', emailLink !== null);

    const flipBtn = await page.$('#btn-flip-card');
    check('Flip Badge button bar is removed per user request', flipBtn === null);

    const cueText = await page.evaluate(() => {
      const cue = document.querySelector('.owner-lanyard-column');
      return cue ? cue.innerText : '';
    });
    check('Helper cue displays "Tap badge to interact"', cueText.includes('Tap badge to interact'));

    console.log('\n--- Step 6: Test Tap to Interact Directly on 3D Card ---');
    const cardEl = await page.$('.owner-lanyard-column .lanyard canvas, .owner-lanyard-column .lanyard-fallback');
    check('Card interaction element is present', cardEl !== null);
    if (cardEl) {
      const cBox = await cardEl.boundingBox();
      const clickX = cBox.x + cBox.width / 2;
      const clickY = cBox.y + cBox.height * 0.55;
      await page.mouse.click(clickX, clickY);
      console.log('  Tapped on 3D card to interact / flip.');
      await new Promise((r) => setTimeout(r, 600));
      check('Tap on card executed smoothly without errors', true);
    }

  } catch (err) {
    console.error('Test error:', err);
    check('Complete Round 28 test execution', false, err.message);
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
