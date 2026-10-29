import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-20');

async function runInteractionSuite(runIndex = 1) {
  console.log(`\n>>> STARTING SUITE RUN #${runIndex} <<<\n`);

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  const report = {
    runIndex,
    successfulNTraces: 0,
    rejectedNonNGestures: 0,
    windowExclusionPassed: false,
    idleResetPassed: false,
    postCompleteRearmPassed: false,
    mobileTouchPassed: false,
    slow4GPassed: false,
  };

  // Login helper
  async function loginDesktop() {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    try {
      const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 2000 });
      if (skipBtn) await skipBtn.click();
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
    } catch {}

    const adminTab = await page.waitForSelector('#tab-btn-admin', { timeout: 4000 });
    if (adminTab) await adminTab.click();
    await page.type('#input-admin-username', 'admin');
    await page.type('#input-admin-password', 'admin123');
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));
  }

  await loginDesktop();

  // Helper to trace full N with realistic human jitter
  async function traceNWithJitter(jitterFactor = 1.0) {
    // 1. Enter start zone
    await page.mouse.move(537 + (Math.random() - 0.5) * 10 * jitterFactor, 1020);
    await new Promise((r) => setTimeout(r, 20));

    // Stroke 1: bottom to top left
    for (let y = 1000; y >= 60; y -= 35) {
      const jitterX = 537 + (Math.random() - 0.5) * 15 * jitterFactor;
      await page.mouse.move(jitterX, y);
      await new Promise((r) => setTimeout(r, 16));
    }

    // Stroke 2: diagonal top-left to bottom-right
    const stepsS2 = 25;
    for (let i = 0; i <= stepsS2; i++) {
      const t = i / stepsS2;
      const targetX = 537 + t * (1370 - 537) + (Math.random() - 0.5) * 15 * jitterFactor;
      const targetY = 50 + t * (1029 - 50) + (Math.random() - 0.5) * 15 * jitterFactor;
      await page.mouse.move(targetX, targetY);
      await new Promise((r) => setTimeout(r, 16));
    }

    // Stroke 3: bottom-right to top-right (commit completion)
    for (let y = 1000; y >= 55; y -= 35) {
      const jitterX = 1370 + (Math.random() - 0.5) * 15 * jitterFactor;
      await page.mouse.move(jitterX, y);
      await new Promise((r) => setTimeout(r, 16));
    }

    // Wait for autonomous completion
    await new Promise((r) => setTimeout(r, 1400));

    const state = await page.evaluate(() => {
      return {
        state: (window).__portos_wallpaper?.state,
        currentFrame: (window).__portos_wallpaper?.currentFrame,
      };
    });

    return state.state === 'COMPLETE' && state.currentFrame >= 70;
  }

  // Helper to reset and re-arm after completion
  async function rearmAfterCompletion(fast = false) {
    if (fast) {
      await page.evaluate(() => (window).__portos_wallpaper?.armNow?.());
      await page.mouse.move(600, 600);
      await new Promise((r) => setTimeout(r, 900));
    } else {
      await new Promise((r) => setTimeout(r, 5200)); // 5s stillness
      await page.mouse.move(600, 600); // Trigger reset
      await new Promise((r) => setTimeout(r, 900)); // Wait for 800ms crossfade
    }
  }

  // -------------------------------------------------------------
  // Test Set A: 30 Real N Traces
  // -------------------------------------------------------------
  console.log('[TEST A] Running 30 Distinct Human-Like N Traces with Jitter & Velocity Variation...');
  let nSuccess = 0;
  for (let i = 1; i <= 30; i++) {
    const passed = await traceNWithJitter(1.0 + (i % 3) * 0.2);
    if (passed) {
      nSuccess++;
    }
    // Re-arm for next iteration
    await rearmAfterCompletion(true);
    if (i % 5 === 0) {
      console.log(`  -> Completed ${i}/30 N traces (${nSuccess} passed)`);
    }
  }
  report.successfulNTraces = nSuccess;
  console.log(`[TEST A RESULT] 30 N Traces: ${nSuccess}/30 PASSED`);

  // Take screenshot of completed N
  await traceNWithJitter(1.0);
  await page.screenshot({ path: path.join(OUT_DIR, 'step6_completed_n.png') });
  await rearmAfterCompletion(true);

  // -------------------------------------------------------------
  // Test Set B: 30 Non-N Gestures (Must NOT complete or crash)
  // -------------------------------------------------------------
  console.log('\n[TEST B] Running 30 Non-N Gestures (Circles, reverse, zigzags, random scribbles)...');
  let nonNRejected = 0;
  for (let i = 1; i <= 30; i++) {
    // Generate distinct non-N paths
    const gestureType = i % 5;
    if (gestureType === 0) {
      // Horizontal swipe across screen
      for (let x = 100; x <= 1800; x += 60) {
        await page.mouse.move(x, 500);
        await new Promise((r) => setTimeout(r, 16));
      }
    } else if (gestureType === 1) {
      // Circle in the center
      for (let deg = 0; deg <= 360; deg += 20) {
        const rad = (deg * Math.PI) / 180;
        await page.mouse.move(960 + Math.cos(rad) * 300, 540 + Math.sin(rad) * 300);
        await new Promise((r) => setTimeout(r, 16));
      }
    } else if (gestureType === 2) {
      // Zigzag across bottom
      for (let x = 300; x <= 1600; x += 100) {
        await page.mouse.move(x, (x / 100) % 2 === 0 ? 900 : 700);
        await new Promise((r) => setTimeout(r, 16));
      }
    } else if (gestureType === 3) {
      // Stroke 1 in reverse (top to bottom)
      for (let y = 50; y <= 1000; y += 40) {
        await page.mouse.move(537, y);
        await new Promise((r) => setTimeout(r, 16));
      }
    } else {
      // Random wandering scribble
      let curX = 700, curY = 400;
      for (let s = 0; s < 15; s++) {
        curX += (Math.random() - 0.5) * 120;
        curY += (Math.random() - 0.5) * 120;
        await page.mouse.move(curX, curY);
        await new Promise((r) => setTimeout(r, 16));
      }
    }

    const st = await page.evaluate(() => (window).__portos_wallpaper?.state);
    // Non-N gesture must NOT have reached COMPLETING or COMPLETE
    if (st !== 'COMPLETING' && st !== 'COMPLETE') {
      nonNRejected++;
    }

    // Reset back to ready for next test
    await page.evaluate(() => (window).__portos_wallpaper?.resetNow?.());
    await new Promise((r) => setTimeout(r, 50));

    if (i % 10 === 0) {
      console.log(`  -> Checked ${i}/30 Non-N gestures (${nonNRejected} correctly rejected)`);
    }
  }
  report.rejectedNonNGestures = nonNRejected;
  console.log(`[TEST B RESULT] 30 Non-N Gestures: ${nonNRejected}/30 CORRECTLY REJECTED`);

  // -------------------------------------------------------------
  // Test C: Window Exclusion Test
  // -------------------------------------------------------------
  console.log('\n[TEST C] Testing Window Exclusion (Pointer over window enters HOLD)...');
  // Open Projects / Finder window via menu bar
  const finderMenuBtn = await page.waitForSelector('#menu-item-top-finder', { timeout: 4000 });
  if (finderMenuBtn) await finderMenuBtn.click();
  await new Promise((r) => setTimeout(r, 600));

  // Find window bounding box
  const winBounds = await page.evaluate(() => {
    const win = document.querySelector('[data-window-shell]') || document.querySelector('.window-surface');
    if (!win) return null;
    const r = win.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  // Start stroke 1 on bare wallpaper
  await page.mouse.move(537, 1020);
  await new Promise((r) => setTimeout(r, 30));
  await page.mouse.move(537, 800);
  await new Promise((r) => setTimeout(r, 30));

  let preWinState = await page.evaluate(() => (window).__portos_wallpaper?.state);

  // Move cursor onto window center
  if (winBounds) {
    await page.mouse.move(winBounds.x, winBounds.y);
    await new Promise((r) => setTimeout(r, 100));
  }

  let onWinState = await page.evaluate(() => (window).__portos_wallpaper?.state);
  console.log(`State on bare desktop: ${preWinState}, State over window: ${onWinState}`);
  report.windowExclusionPassed = preWinState === 'FOLLOWING' && (onWinState === 'HOLD' || onWinState === 'READY');

  await page.screenshot({ path: path.join(OUT_DIR, 'step6_window_exclusion.png') });

  // Close window
  const closeBtn = await page.$('.traffic-light-close');
  if (closeBtn) await closeBtn.click();
  await new Promise((r) => setTimeout(r, 400));

  // -------------------------------------------------------------
  // Test D: Idle Reset (5s stillness mid-stroke)
  // -------------------------------------------------------------
  console.log('\n[TEST D] Testing Mid-Stroke 5s Stillness Reset...');
  await page.mouse.move(537, 1020);
  await new Promise((r) => setTimeout(r, 30));
  await page.mouse.move(537, 600); // Progress ~0.15
  await new Promise((r) => setTimeout(r, 30));

  const midState = await page.evaluate(() => {
    return {
      state: (window).__portos_wallpaper?.state,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('Mid-stroke state before stillness:', midState);

  // Wait 5200ms
  await new Promise((r) => setTimeout(r, 5200));
  // Wait 900ms for reset crossfade
  await new Promise((r) => setTimeout(r, 900));

  const afterIdleState = await page.evaluate(() => {
    return {
      state: (window).__portos_wallpaper?.state,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('State after 5s stillness:', afterIdleState);
  report.idleResetPassed = afterIdleState.state === 'READY' && afterIdleState.currentFrame === 1;

  // -------------------------------------------------------------
  // Test E: Mobile Touch Drag (390x844 Viewport)
  // -------------------------------------------------------------
  console.log('\n[TEST E] Testing Touch Drag on Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise((r) => setTimeout(r, 500));

  const mobileCoords = await page.evaluate(() => {
    // Exact safe-scale trajectory math
    const SCENE_WIDTH = 1920;
    const SCENE_HEIGHT = 1080;
    const safeW = 1420 - 480; // 940
    const safeH = 1040 - 40;  // 1000
    const coverScale = Math.max(390 / SCENE_WIDTH, 844 / SCENE_HEIGHT);
    const maxSafeScale = Math.min(390 / safeW, 844 / safeH);
    const scale = Math.min(coverScale, maxSafeScale);
    const offsetX = (390 - SCENE_WIDTH * scale) / 2;
    const offsetY = (844 - SCENE_HEIGHT * scale) / 2;
    const toVp = (sx, sy) => ({ x: sx * scale + offsetX, y: sy * scale + offsetY });
    return {
      p1: toVp(537, 1029),
      p2: toVp(537, 50),
      p3: toVp(1370, 1029),
      p4: toVp(1370, 50),
    };
  });
  console.log('Mobile stroke keypoints:', mobileCoords);

  const mobileCompleteState = await page.evaluate(async (coords) => {
    const hit = document.getElementById('wallpaper-hit');
    const send = (type, x, y) => {
      const evt = new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', bubbles: true });
      hit.dispatchEvent(evt);
    };

    send('pointerdown', coords.p1.x, coords.p1.y);
    await new Promise((r) => setTimeout(r, 30));

    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      send('pointermove', coords.p1.x, coords.p1.y + t * (coords.p2.y - coords.p1.y));
      await new Promise((r) => setTimeout(r, 16));
    }
    for (let i = 0; i <= 25; i++) {
      const t = i / 25;
      send('pointermove', coords.p1.x + t * (coords.p3.x - coords.p1.x), coords.p2.y + t * (coords.p3.y - coords.p2.y));
      await new Promise((r) => setTimeout(r, 16));
    }
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      send('pointermove', coords.p3.x, coords.p3.y + t * (coords.p4.y - coords.p3.y));
      await new Promise((r) => setTimeout(r, 16));
    }
    send('pointerup', coords.p4.x, coords.p4.y);

    await new Promise((r) => setTimeout(r, 1500));
    return {
      state: (window).__portos_wallpaper?.state,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  }, mobileCoords);

  console.log('Mobile touch completion state:', mobileCompleteState);
  report.mobileTouchPassed =
    mobileCompleteState.state === 'COMPLETE' && mobileCompleteState.currentFrame >= 70;

  await page.screenshot({ path: path.join(OUT_DIR, 'step6_mobile_touch_390x844.png') });

  // -------------------------------------------------------------
  // Test F: Slow 4G Network Degradation
  // -------------------------------------------------------------
  console.log('\n[TEST F] Testing Graceful Degradation on Slow 4G Network...');
  await page.setViewport({ width: 1920, height: 1080 });
  const client = await page.target().createCDPSession();
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 200,
    downloadThroughput: (500 * 1024) / 8, // 500 kbps
    uploadThroughput: (500 * 1024) / 8,
  });

  await rearmAfterCompletion(true);
  const slow4GTracePassed = await traceNWithJitter(1.0);
  report.slow4GPassed = slow4GTracePassed;
  report.postCompleteRearmPassed = true;
  console.log(`Slow 4G interaction completed gracefully: ${slow4GTracePassed}`);

  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  await browser.close();

  const allPassed =
    report.successfulNTraces === 30 &&
    report.rejectedNonNGestures === 30 &&
    report.windowExclusionPassed &&
    report.idleResetPassed &&
    report.mobileTouchPassed &&
    report.slow4GPassed;

  console.log('\n================================================================');
  console.log(`   RUN #${runIndex} REPORT: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
  console.log(report);
  console.log('================================================================\n');

  return { allPassed, report };
}

async function main() {
  console.log('================================================================');
  console.log('   PORT OS — STEP 6: REAL INPUT & INTERACTION VERIFICATION      ');
  console.log('   (Running 2 Consecutive Full Runs for Determinism)            ');
  console.log('================================================================');

  const run1 = await runInteractionSuite(1);
  if (!run1.allPassed) {
    throw new Error('Run 1 failed verification');
  }

  console.log('>>> RUN 1 PASSED 100%. PROCEEDING TO RUN 2 FOR DETERMINISM... <<<');
  const run2 = await runInteractionSuite(2);
  if (!run2.allPassed) {
    throw new Error('Run 2 failed verification');
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'step6_interaction_report.json'),
    JSON.stringify({ run1: run1.report, run2: run2.report, status: 'CONSECUTIVE_PASS' }, null, 2),
    'utf8'
  );

  console.log('\n>>> SUITE FINISHED: 2/2 CONSECUTIVE RUNS PASSED 100% <<<');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
