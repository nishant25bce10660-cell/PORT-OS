import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { recordEvidence } from '../evidence-recorder.mjs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-15');

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
];

async function runStep1Test() {
  console.log('================================================================');
  console.log('  PORT OS — ROUND 15 STEP 1: LOGIN ALIGNMENT & SEMANTICS VERIFICATION');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.name} ---`);
    const page = await browser.newPage();
    await page.setViewport(vp);

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 6000 });
    await page.waitForSelector('.lock-screen-avatars', { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 400));

    // 1. Measure Bounding Rectangles
    const geometry = await page.evaluate(() => {
      const avOwner = document.getElementById('avatar-select-owner')?.getBoundingClientRect();
      const avGuest = document.getElementById('avatar-select-guest')?.getBoundingClientRect();
      const segOwner = document.getElementById('tab-btn-admin')?.getBoundingClientRect();
      const segGuest = document.getElementById('tab-btn-viewer')?.getBoundingClientRect();

      if (!avOwner || !avGuest || !segOwner || !segGuest) return null;

      const avOwnerCenterX = avOwner.left + avOwner.width / 2;
      const avGuestCenterX = avGuest.left + avGuest.width / 2;
      const segOwnerCenterX = segOwner.left + segOwner.width / 2;
      const segGuestCenterX = segGuest.left + segGuest.width / 2;

      return {
        avOwner: { left: avOwner.left, top: avOwner.top, width: avOwner.width, height: avOwner.height, centerX: avOwnerCenterX },
        avGuest: { left: avGuest.left, top: avGuest.top, width: avGuest.width, height: avGuest.height, centerX: avGuestCenterX },
        segOwner: { left: segOwner.left, top: segOwner.top, width: segOwner.width, height: segOwner.height, centerX: segOwnerCenterX },
        segGuest: { left: segGuest.left, top: segGuest.top, width: segGuest.width, height: segGuest.height, centerX: segGuestCenterX },
        deltaOwnerX: Math.abs(avOwnerCenterX - segOwnerCenterX),
        deltaGuestX: Math.abs(avGuestCenterX - segGuestCenterX),
        deltaTopY: Math.abs(avOwner.top - avGuest.top),
      };
    });

    if (!geometry) {
      throw new Error(`Failed to measure geometry at ${vp.name}`);
    }

    console.log(`Owner Center Delta: ${geometry.deltaOwnerX.toFixed(2)}px (allowed <= 1px)`);
    console.log(`Guest Center Delta: ${geometry.deltaGuestX.toFixed(2)}px (allowed <= 1px)`);
    console.log(`Avatar Top Delta: ${geometry.deltaTopY.toFixed(2)}px (allowed <= 1px)`);

    const passedGeometry =
      geometry.deltaOwnerX <= 1.01 &&
      geometry.deltaGuestX <= 1.01 &&
      geometry.deltaTopY <= 1.01 &&
      geometry.avOwner.centerX < geometry.avGuest.centerX &&
      geometry.segOwner.centerX < geometry.segGuest.centerX;

    // 2. Check Visible Wording & Aria-labels
    const labels = await page.evaluate(() => {
      const avOwner = document.getElementById('avatar-select-owner');
      const avGuest = document.getElementById('avatar-select-guest');
      const segOwner = document.getElementById('tab-btn-admin');
      const segGuest = document.getElementById('tab-btn-viewer');

      return {
        avOwnerRole: avOwner?.getAttribute('role'),
        avGuestRole: avGuest?.getAttribute('role'),
        avOwnerText: avOwner?.innerText || '',
        avGuestText: avGuest?.innerText || '',
        segOwnerText: segOwner?.innerText?.trim() || '',
        segGuestText: segGuest?.innerText?.trim() || '',
        segOwnerRole: segOwner?.getAttribute('role'),
        segGuestRole: segGuest?.getAttribute('role'),
      };
    });

    const passedLabels =
      labels.avOwnerRole === 'radio' &&
      labels.avGuestRole === 'radio' &&
      labels.segOwnerRole === 'radio' &&
      labels.segGuestRole === 'radio' &&
      labels.avOwnerText.toUpperCase().includes('OWNER') &&
      labels.avGuestText.toUpperCase().includes('GUEST') &&
      !labels.avGuestText.toUpperCase().includes('VIEWER') &&
      labels.segOwnerText === 'Owner' &&
      labels.segGuestText === 'Guest';

    console.log('Labels check details:', {
      passed: passedLabels,
      labels,
    });

    // 3. Test Interactions & CLS during switching
    await page.evaluate(() => {
      window.__clsScore = 0;
      window.__clsShifts = [];
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__clsScore += entry.value;
            window.__clsShifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput });
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: false });
    });

    // Real click to switch to Owner
    await page.click('#avatar-select-owner');
    await new Promise((r) => setTimeout(r, 300));

    // Real click to switch to Guest
    await page.click('#tab-btn-viewer');
    await new Promise((r) => setTimeout(r, 300));

    const clsResult = await page.evaluate(() => {
      return {
        clsScore: window.__clsScore || 0,
        shifts: window.__clsShifts || [],
      };
    });

    console.log(`Cumulative Layout Shift during switch: ${clsResult.clsScore}`, clsResult.shifts);

    // 4. Test Arrow Key Navigation
    await page.focus('#avatar-select-guest');
    await page.keyboard.press('ArrowLeft');
    await new Promise((r) => setTimeout(r, 250));

    const roleAfterLeftArrow = await page.evaluate(() => {
      const segOwner = document.getElementById('tab-btn-admin');
      const submitBtn = document.getElementById('btn-login-admin');
      return {
        segOwnerChecked: segOwner?.getAttribute('aria-checked') === 'true',
        submitText: submitBtn?.innerText?.trim(),
      };
    });

    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 250));

    const roleAfterRightArrow = await page.evaluate(() => {
      const segGuest = document.getElementById('tab-btn-viewer');
      const submitBtn = document.getElementById('btn-login-viewer');
      return {
        segGuestChecked: segGuest?.getAttribute('aria-checked') === 'true',
        submitText: submitBtn?.innerText?.trim(),
      };
    });

    const passedKeyboard =
      roleAfterLeftArrow.segOwnerChecked &&
      roleAfterLeftArrow.submitText === 'Sign in as Owner' &&
      roleAfterRightArrow.segGuestChecked &&
      roleAfterRightArrow.submitText === 'Enter as Guest';

    console.log('Keyboard & Submit Buttons Check:', {
      passed: passedKeyboard,
      roleAfterLeftArrow,
      roleAfterRightArrow,
    });

    // Screenshot
    const ssName = `login_${vp.name}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, ssName) });

    const vpPassed = passedGeometry && passedLabels && clsResult.clsScore === 0 && passedKeyboard;
    results.push({
      viewport: vp.name,
      passed: vpPassed,
      geometry,
      cls: clsResult.clsScore,
      screenshot: ssName,
    });

    console.log(`[RESULT] ${vp.name}: ${vpPassed ? 'PASS' : 'FAIL'}`);
    await page.close();
  }

  const allPassed = results.every((r) => r.passed);

  recordEvidence(
    'ROUND15_STEP1_LOGIN_ALIGNMENT',
    allPassed,
    'Login avatars and switch perfectly aligned (center diff <= 1px, equal tops), unified labels, radio semantics, CLS=0 across 3 viewports',
    { viewports: results },
    'login_1920x1080.png'
  );

  await browser.close();

  if (!allPassed) {
    console.error('\nSTEP 1 FAILED on one or more viewports.');
    process.exit(1);
  } else {
    console.log('\nSTEP 1 PASSED: All login alignment, geometry and semantics verified green.');
  }
}

runStep1Test().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
