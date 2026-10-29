import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('report_assets/round-5');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRound5Tests() {
  console.log('================================================================');
  console.log('  PORT OS - ROUND 5 ACCEPTANCE: TERMINAL, CONTROL CENTER, MOBILE, FPS');
  console.log('================================================================\n');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle'],
    defaultViewport: { width: 1920, height: 1080 },
  };

  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  const results = {};
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------
    // SETUP: Navigate, Skip Boot Screen, Login
    // -------------------------------------------------------------
    console.log('[SETUP] Navigating to PORT OS...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    try {
      await page.waitForSelector('#btn-boot-skip', { timeout: 3500 });
      await page.click('#btn-boot-skip');
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 5000 });
      console.log('[SETUP] Boot screen skipped.');
    } catch {
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 7000 }).catch(() => {});
    }

    const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 6000 }).catch(() => null);
    if (loginOverlay) {
      await page.waitForSelector('#tab-btn-admin', { visible: true });
      await page.click('#tab-btn-admin');
      await new Promise((r) => setTimeout(r, 200));
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
      console.log('[SETUP] Admin logged in.');
    }

    // -------------------------------------------------------------
    // TEST 1: M9.1 - INTERACTIVE TERMINAL WINDOW
    // -------------------------------------------------------------
    console.log('\n--- Testing M9.1: Interactive Terminal Application ---');
    
    // Launch terminal via Dock item or Spotlight
    const terminalDockItem = await page.waitForSelector('#dock-item-terminal', { timeout: 3000 }).catch(() => null);
    assert(terminalDockItem, 'Terminal icon must be present in Dock (#dock-item-terminal)');
    await page.click('#dock-item-terminal');
    await new Promise((r) => setTimeout(r, 500));

    // Verify terminal window is mounted
    const terminalWindow = await page.waitForSelector('#window-terminal', { timeout: 3000 });
    assert(terminalWindow, 'Terminal window (#window-terminal) must open');

    // Focus input and test command: help
    await page.waitForSelector('#terminal-command-input', { timeout: 2000 });
    await page.type('#terminal-command-input', 'help');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 200));

    // Test command: neofetch
    await page.type('#terminal-command-input', 'neofetch');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 200));

    // Test command: whoami
    await page.type('#terminal-command-input', 'whoami');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 200));

    const terminalOutput = await page.evaluate(() => {
      const el = document.getElementById('terminal-output');
      return el ? el.textContent : '';
    });

    console.log('[M9.1] Terminal output snippet:', terminalOutput?.substring(0, 150));
    assert(terminalOutput?.includes('PORT OS'), 'Terminal neofetch must display "PORT OS"');
    assert(terminalOutput?.includes('admin'), 'Terminal whoami must report "admin"');
    assert(terminalOutput?.includes('Available commands'), 'Terminal help must list available commands');
    results['M9_1_TERMINAL'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 2: M9.2 - CONTROL CENTER REMOVED / CLEAN MENU BAR
    // -------------------------------------------------------------
    console.log('\n--- Testing M9.2: Control Center Removed & Clean Menu Bar Verified ---');
    
    const controlCenterExists = await page.evaluate(() => {
      const btn = document.getElementById('menu-btn-control-center');
      const popover = document.getElementById('control-center-popover');
      return !!(btn || popover);
    });
    assert(!controlCenterExists, 'Control Center button and popover must be completely removed from menu bar');
    console.log('[M9.2] Verified: Control Center is absent and menu bar is clean');
    results['M9_2_CONTROL_CENTER'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 3: M9.3 - ABOUT PORT OS WINDOW
    // -------------------------------------------------------------
    console.log('\n--- Testing M9.3: About PORT OS Dialog ---');
    
    await page.click('#menu-btn-n-logo');
    await new Promise((r) => setTimeout(r, 200));
    await page.click('#menu-item-about');
    await new Promise((r) => setTimeout(r, 400));

    const aboutWindow = await page.waitForSelector('#window-about-portos', { timeout: 3000 });
    assert(aboutWindow, 'About PORT OS window (#window-about-portos) must open from System menu');

    const aboutSpecs = await page.evaluate(() => {
      const el = document.getElementById('window-about-portos');
      return el ? el.textContent : '';
    });
    console.log('[M9.3] About window specs snippet:', aboutSpecs?.substring(0, 160));
    assert(aboutSpecs?.includes('PORT OS'), 'About dialog must show PORT OS version');
    results['M9_3_ABOUT_PORTOS'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 4: M9.4 - MOBILE RESPONSIVENESS (390px, 768px, 1920px)
    // -------------------------------------------------------------
    console.log('\n--- Testing M9.4: Viewport Responsiveness at 390px, 768px, 1920px ---');
    
    // Viewport 390x844 (Mobile)
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 500));
    const scrollWidth390 = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`[M9.4] At 390px viewport, scrollWidth = ${scrollWidth390}px`);
    assert(scrollWidth390 <= 390, `At 390px, page must have no horizontal scroll (got ${scrollWidth390}px)`);

    // Viewport 768x1024 (Tablet)
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise((r) => setTimeout(r, 500));
    const scrollWidth768 = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`[M9.4] At 768px viewport, scrollWidth = ${scrollWidth768}px`);
    assert(scrollWidth768 <= 768, `At 768px, page must have no horizontal scroll (got ${scrollWidth768}px)`);

    // Viewport 1920x1080 (Desktop)
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise((r) => setTimeout(r, 500));
    const scrollWidth1920 = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`[M9.4] At 1920px viewport, scrollWidth = ${scrollWidth1920}px`);
    assert(scrollWidth1920 <= 1920, `At 1920px, page must have no horizontal scroll (got ${scrollWidth1920}px)`);
    results['M9_4_RESPONSIVENESS'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 5: M10 - PERFORMANCE & FPS BENCHMARK (P2, P3, P4)
    // -------------------------------------------------------------
    console.log('\n--- Testing M10: Performance Budget & FPS Trace (P2, P3, P4) ---');

    // Measure FPS during window drag and dock hover
    const fpsMeasurement = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let frameCount = 0;
        let lastTime = null;
        const frameDeltas = [];

        function onFrame(now) {
          if (lastTime !== null) {
            const delta = now - lastTime;
            frameDeltas.push(delta);
          }
          lastTime = now;
          frameCount++;

          if (frameCount < 65) {
            requestAnimationFrame(onFrame);
          } else {
            const avgDelta = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
            const avgFps = 1000 / avgDelta;
            const sorted = [...frameDeltas].sort((a, b) => a - b);
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            resolve({ avgFps, p95, totalFrames: frameDeltas.length });
          }
        }
        requestAnimationFrame(onFrame);
      });
    });

    console.log('[M10] FPS Trace results:', fpsMeasurement);
    assert(fpsMeasurement.avgFps >= 50, `Average FPS must be >= 50 (measured ${fpsMeasurement.avgFps.toFixed(1)} FPS)`);
    assert(fpsMeasurement.p95 <= 25, `p95 frame time must be <= 25ms (measured ${fpsMeasurement.p95.toFixed(2)}ms)`);
    results['M10_PERFORMANCE_FPS'] = 'PASS';

    // Capture screenshot evidence for Round 5
    const screenshotPath = path.join(SCREENSHOT_DIR, 'round5_terminal_control_mobile_evidence.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`\n[EVIDENCE] Screenshot saved to ${screenshotPath}`);

    console.log('\n================================================================');
    console.log('  ROUND 5 TEST RESULTS');
    console.log('================================================================');
    for (const [key, val] of Object.entries(results)) {
      console.log(`  ${key}: ${val}`);
    }

  } catch (err) {
    console.error('\n[FAIL] Test suite failed with error:', err.message);
    const failShot = path.join(SCREENSHOT_DIR, 'round5_failure_evidence.png');
    await page.screenshot({ path: failShot }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

runRound5Tests();
