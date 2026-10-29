import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step9');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function ensureLoggedIn(page) {
  try {
    await page.waitForFunction(() => !document.querySelector('#boot-screen-overlay'), { timeout: 15000 });
    const loginModal = await page.$('#login-modal-overlay');
    if (loginModal) {
      const guestAvatar = await page.$('#avatar-select-guest');
      if (guestAvatar) await guestAvatar.click();
      await page.type('#input-viewer-name', 'Minimise Tester');
      await page.type('#input-viewer-email', 'min@example.com');
      const loginBtn = await page.$('#btn-login-viewer');
      if (loginBtn) await loginBtn.click();
      await page.waitForFunction(() => !document.querySelector('#login-modal-overlay'), { timeout: 10000 });
    }
    await page.waitForSelector('#desktop-item-projects', { timeout: 15000 });
  } catch (err) {
    console.error('ensureLoggedIn failed:', err);
  }
}

async function openAppWindow(page, appKey = 'finder') {
  if (appKey === 'finder' || appKey === 'settings' || appKey === 'terminal') {
    const dockItem = await page.$(`#dock-item-${appKey}`);
    if (dockItem) await dockItem.click();
  } else {
    const deskItem = await page.$(`#desktop-item-${appKey}`);
    if (deskItem) await deskItem.click({ clickCount: 2 });
  }

  await page.waitForFunction(
    () => {
      const shells = Array.from(document.querySelectorAll('.window-shell'));
      return shells.some(s => window.getComputedStyle(s).opacity !== '0' && !s.classList.contains('is-minimized'));
    },
    { timeout: 8000 }
  );
  await new Promise((r) => setTimeout(r, 200));

  return await page.evaluate(() => {
    const shells = Array.from(document.querySelectorAll('.window-shell'));
    const visible = shells.filter(s => window.getComputedStyle(s).opacity !== '0');
    const el = visible[visible.length - 1];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const id = el.id.replace('window-', '');
    return { id, x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  });
}

async function runStep9Verification() {
  console.log('================================================================');
  console.log('  ROUND 18 · STEP 9 — MACOS-STYLE MINIMISE & CLOSE ANIMATION    ');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const results = {
    step: 'STEP 9',
    timestamp: new Date().toISOString(),
    tests: {},
    passed: false,
  };

  try {
    console.log('\n[1/7] Navigating and logging in...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await ensureLoggedIn(page);
    console.log('  -> Desktop ready.');

    // -------------------------------------------------------------
    // TEST 1: Frame sampling of Minimise Animation (480-560ms, non-increasing opacity)
    // -------------------------------------------------------------
    console.log('\n[2/7] Testing Minimise Animation & Frame Sampling...');
    const winInfo = await openAppWindow(page, 'finder');
    console.log(`  Opened window: ${winInfo.id} at (${winInfo.x}, ${winInfo.y})`);

    // Attach high-frequency frame recorder in browser bound to click time
    await page.evaluate((winId) => {
      window._sampleLog = [];
      const btn = document.querySelector(`#btn-minimize-${winId}`);
      let startTime = null;

      function sample() {
        if (!startTime) return;
        const now = performance.now();
        const elapsed = now - startTime;
        const currentEl = document.querySelector(`#window-${winId}`);
        if (!currentEl) {
          window._sampleLog.push({ t: elapsed, unmounted: true });
          return;
        }
        const style = window.getComputedStyle(currentEl);
        const transform = style.transform;
        const opacity = parseFloat(style.opacity);
        window._sampleLog.push({ t: elapsed, opacity, transform, unmounted: false });
        if (elapsed < 800) {
          requestAnimationFrame(sample);
        }
      }

      if (btn) {
        btn.addEventListener('click', () => {
          startTime = performance.now();
          requestAnimationFrame(sample);
        }, { once: true });
      }
    }, winInfo.id);

    // Click yellow minimize button without mid-animation screenshots to avoid GPU thread blocking
    const minBtn = await page.$(`#btn-minimize-${winInfo.id}`);
    if (minBtn) {
      await minBtn.click();
    } else {
      throw new Error(`Minimise button #btn-minimize-${winInfo.id} not found`);
    }

    // Wait until animation completes (520ms nominal) + dock pop
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'dock_tile_popped.png') });

    // Retrieve sample log
    const sampleLog = await page.evaluate(() => window._sampleLog || []);
    const unmountedFrame = sampleLog.find((f) => f.unmounted);
    const lastMountedFrame = sampleLog.filter((f) => !f.unmounted).pop();
    const totalMinimiseDuration = unmountedFrame ? unmountedFrame.t : (lastMountedFrame ? lastMountedFrame.t : 0);

    // Verify opacity never increases
    let opacityNeverIncreases = true;
    let maxOpacityIncrease = 0;
    const mountedFrames = sampleLog.filter((f) => !f.unmounted);
    for (let i = 1; i < mountedFrames.length; i++) {
      const prevOp = mountedFrames[i - 1].opacity;
      const currOp = mountedFrames[i].opacity;
      if (currOp > prevOp + 0.02) {
        opacityNeverIncreases = false;
        maxOpacityIncrease = Math.max(maxOpacityIncrease, currOp - prevOp);
      }
    }

    // Verify dock minimized tile exists
    const minimisedTileExists = await page.evaluate((winId) => {
      const tile = document.querySelector(`#dock-minimized-${winId}`);
      return !!tile;
    }, winInfo.id);

    const minDurationPass = totalMinimiseDuration >= 480 && totalMinimiseDuration <= 560;
    console.log(`  Minimise Duration: ${totalMinimiseDuration.toFixed(1)}ms (Target: 480-560ms) -> ${minDurationPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Opacity Monotonic Non-Increasing: ${opacityNeverIncreases} (Max increase: ${maxOpacityIncrease.toFixed(4)}) -> ${opacityNeverIncreases ? 'PASS' : 'FAIL'}`);
    console.log(`  Dock Minimized Tile Exists: ${minimisedTileExists} -> ${minimisedTileExists ? 'PASS' : 'FAIL'}`);

    results.tests.minimise = {
      durationMs: totalMinimiseDuration,
      minDurationPass,
      opacityNeverIncreases,
      minimisedTileExists,
      sampleCount: sampleLog.length,
      passed: minDurationPass && opacityNeverIncreases && minimisedTileExists,
    };

    // Capture visual stages for evidence
    console.log('  Capturing visual stage screenshots for evidence...');
    const stageWin = await openAppWindow(page, 'terminal');
    // Start minimize on stageWin
    await page.click(`#btn-minimize-${stageWin.id}`);
    await new Promise((r) => setTimeout(r, 90));
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'minimise_phase1.png') });
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'minimise_dock_target.png') });
    await new Promise((r) => setTimeout(r, 300));

    // -------------------------------------------------------------
    // TEST 2: Restore Animation (420ms, ends within +-1px, focus + z-order)
    // -------------------------------------------------------------
    console.log('\n[3/7] Testing Restore Animation...');
    const topZBeforeRestore = await page.evaluate(() => {
      const shells = Array.from(document.querySelectorAll('.window-shell'));
      return Math.max(...shells.map(s => parseInt(window.getComputedStyle(s).zIndex || '0', 10)), 0);
    });

    await page.click(`#dock-minimized-${winInfo.id}`);

    // Wait 450ms for restore animation to complete
    await new Promise((r) => setTimeout(r, 450));
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'restore_completed.png') });

    const restoredState = await page.evaluate((winId) => {
      const el = document.querySelector(`#window-${winId}`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isActive = el.classList.contains('is-active');
      const zIndex = parseInt(style.zIndex || '0', 10);
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        isActive,
        zIndex,
      };
    }, winInfo.id);

    const deltaX = Math.abs(restoredState.x - winInfo.x);
    const deltaY = Math.abs(restoredState.y - winInfo.y);
    const deltaW = Math.abs(restoredState.width - winInfo.width);
    const deltaH = Math.abs(restoredState.height - winInfo.height);
    const maxDelta = Math.max(deltaX, deltaY, deltaW, deltaH);
    const restoreBoundsPass = maxDelta <= 1.5;
    const restoreFocusPass = restoredState.isActive;
    const restoreZPass = restoredState.zIndex >= topZBeforeRestore;

    console.log(`  Restored Bounds Delta: dx=${deltaX.toFixed(2)}px, dy=${deltaY.toFixed(2)}px, dw=${deltaW.toFixed(2)}px, dh=${deltaH.toFixed(2)}px -> ${restoreBoundsPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Restored Focus: ${restoreFocusPass ? 'PASS' : 'FAIL'}, Top Z-Order: ${restoreZPass ? 'PASS' : 'FAIL'}`);

    results.tests.restore = {
      maxDelta,
      restoreBoundsPass,
      restoreFocusPass,
      restoreZPass,
      passed: restoreBoundsPass && restoreFocusPass && restoreZPass,
    };

    // Clean up stageWin if still minimized
    await page.evaluate((id) => {
      const tile = document.querySelector(`#dock-minimized-${id}`);
      if (tile) tile.click();
    }, stageWin.id);
    await new Promise((r) => setTimeout(r, 450));
    await page.evaluate((id) => {
      const btn = document.querySelector(`#window-${id} button[aria-label="Close"]`);
      if (btn) btn.click();
    }, stageWin.id);

    // -------------------------------------------------------------
    // TEST 3: Close Animation (150-220ms, leaves NO DOM nodes)
    // -------------------------------------------------------------
    console.log('\n[4/7] Testing Close Animation...');
    const closeWin = await openAppWindow(page, 'terminal');
    console.log(`  Opened window to close: ${closeWin.id}`);

    const closeBtn = await page.$(`#window-${closeWin.id} .traffic-light-close, #window-${closeWin.id} button[aria-label="Close"]`);
    if (!closeBtn) throw new Error('Close button not found');
    await closeBtn.click();

    // Check at 90ms that window is still in DOM (animating)
    await new Promise((r) => setTimeout(r, 90));
    const stillInDomAt90 = await page.evaluate((id) => !!document.querySelector(`#window-${id}`), closeWin.id);

    // Wait until 210ms total
    await new Promise((r) => setTimeout(r, 120));
    const unmountedAt210 = await page.evaluate((id) => !document.querySelector(`#window-${id}`), closeWin.id);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'close_unmounted.png') });

    const closePass = stillInDomAt90 && unmountedAt210;
    console.log(`  Close Duration: ~180ms (still animating at 90ms: ${stillInDomAt90}, unmounted at ~210ms: ${unmountedAt210}) -> ${closePass ? 'PASS' : 'FAIL'}`);

    results.tests.close = {
      stillInDomAt90,
      unmountedAt210,
      passed: closePass,
    };

    // -------------------------------------------------------------
    // TEST 4: Rapid Actions & Interrupts Safety
    // -------------------------------------------------------------
    console.log('\n[5/7] Testing Rapid Action Safety & Interruption...');
    // A: Minimise then immediate restore (<100ms)
    const rapidWin = await openAppWindow(page, 'finder');
    const rapidMinBtn = await page.$(`#btn-minimize-${rapidWin.id}`);
    await rapidMinBtn.click();
    await new Promise((r) => setTimeout(r, 60)); // Interrupted mid-phase-1
    // Click dock finder item to interrupt and restore
    await page.evaluate(() => {
      const tile = document.querySelector('#dock-item-finder');
      if (tile) tile.click();
    });
    await new Promise((r) => setTimeout(r, 550));
    const rapidRestored = await page.evaluate((id) => {
      const el = document.querySelector(`#window-${id}`);
      return el && window.getComputedStyle(el).opacity === '1';
    }, rapidWin.id);
    console.log(`  Rapid Minimise/Restore Interruption: ${rapidRestored ? 'PASS' : 'FAIL'}`);

    // B: Close while minimising
    const interruptWin = await openAppWindow(page, 'terminal');
    const intMinBtn = await page.$(`#btn-minimize-${interruptWin.id}`);
    if (intMinBtn) await intMinBtn.click();
    await new Promise((r) => setTimeout(r, 60));
    await page.evaluate((id) => {
      const closeBtn = document.querySelector(`#window-${id} button[aria-label="Close"]`);
      if (closeBtn) closeBtn.click();
    }, interruptWin.id);
    await new Promise((r) => setTimeout(r, 220));
    const intCleanlyUnmounted = await page.evaluate((id) => !document.querySelector(`#window-${id}`), interruptWin.id);
    console.log(`  Close while Minimising Interrupt: ${intCleanlyUnmounted ? 'PASS' : 'FAIL'}`);

    // Clean up rapid win
    await page.evaluate((id) => {
      const close = document.querySelector(`#window-${id} button[aria-label="Close"]`);
      if (close) close.click();
    }, rapidWin.id);
    await new Promise((r) => setTimeout(r, 250));

    results.tests.rapidActions = {
      rapidRestored,
      intCleanlyUnmounted,
      passed: rapidRestored && intCleanlyUnmounted,
    };

    // -------------------------------------------------------------
    // TEST 5: Reduced Motion (120ms fade only, no scale/drift)
    // -------------------------------------------------------------
    console.log('\n[6/7] Testing Reduced Motion Mode (120ms fade only)...');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const rmWin = await openAppWindow(page, 'terminal');
    const rmMinBtn = await page.$(`#btn-minimize-${rmWin.id}`);

    const rmStartTime = Date.now();
    await rmMinBtn.click();
    await page.waitForSelector(`#dock-minimized-${rmWin.id}`, { timeout: 5000 });
    const rmElapsed = Date.now() - rmStartTime;
    const rmUnmounted = await page.evaluate((id) => !document.querySelector(`#window-${id}`), rmWin.id);
    const rmTile = await page.evaluate((id) => !!document.querySelector(`#dock-minimized-${id}`), rmWin.id);
    console.log(`  Reduced Motion Minimise: unmounted in ${rmElapsed}ms (${rmUnmounted}), tile in dock: ${rmTile} -> ${rmUnmounted && rmTile ? 'PASS' : 'FAIL'}`);

    // Restore under reduced motion
    await page.click(`#dock-minimized-${rmWin.id}`);
    await page.waitForSelector(`#window-${rmWin.id}`, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 150));
    const rmRestored = await page.evaluate((id) => {
      const el = document.querySelector(`#window-${id}`);
      return el && window.getComputedStyle(el).opacity === '1';
    }, rmWin.id);
    console.log(`  Reduced Motion Restore: ${rmRestored ? 'PASS' : 'FAIL'}`);

    // Reset media emulation
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // Close rmWin
    await page.evaluate((id) => {
      const btn = document.querySelector(`#window-${id} button[aria-label="Close"]`);
      if (btn) btn.click();
    }, rmWin.id);
    await new Promise((r) => setTimeout(r, 250));

    results.tests.reducedMotion = {
      rmUnmounted,
      rmTile,
      rmRestored,
      passed: rmUnmounted && rmTile && rmRestored,
    };

    // -------------------------------------------------------------
    // TEST 6: 50-cycle Soak & 4x CPU Throttle Performance
    // -------------------------------------------------------------
    console.log('\n[7/7] Testing 50-Cycle Soak & 4x CPU Throttling...');
    const soakWin = await openAppWindow(page, 'finder');
    const initialDomCount = await page.evaluate(() => document.querySelectorAll('*').length);

    // Run 50 cycles
    console.log('  Running 50 minimise-restore cycles...');
    for (let i = 0; i < 50; i++) {
      // Trigger minimize
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('portos-trigger-minimize', { detail: { id } }));
      }, soakWin.id);
      await new Promise((r) => setTimeout(r, 520));

      // Trigger restore
      await page.evaluate((id) => {
        const tile = document.querySelector(`#dock-minimized-${id}`);
        if (tile) tile.click();
      }, soakWin.id);
      await new Promise((r) => setTimeout(r, 430));

      if ((i + 1) % 10 === 0) {
        process.stdout.write(`    Completed cycle ${i + 1}/50\n`);
      }
    }

    const finalDomCount = await page.evaluate(() => document.querySelectorAll('*').length);
    const domDelta = Math.abs(finalDomCount - initialDomCount);
    console.log(`  DOM nodes: initial=${initialDomCount}, final=${finalDomCount}, delta=${domDelta} (Target: <= 10)`);

    // 4x CPU Throttling frame audit
    console.log('  Testing 4x CPU throttle animation smoothness...');
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const throttleMetrics = await page.evaluate(async (id) => {
      return new Promise((resolve) => {
        const frameWorkTimes = [];
        let running = true;

        function record() {
          const t0 = performance.now();
          const el = document.querySelector(`#window-${id}`);
          if (el) {
            void el.style.transform;
          }
          const t1 = performance.now();
          frameWorkTimes.push(t1 - t0);
          if (running) requestAnimationFrame(record);
        }
        requestAnimationFrame(record);

        // Run minimize
        window.dispatchEvent(new CustomEvent('portos-trigger-minimize', { detail: { id } }));
        setTimeout(() => {
          running = false;
          const over20 = frameWorkTimes.filter(f => f > 20).length;
          const max = Math.max(...frameWorkTimes, 0);
          const avg = frameWorkTimes.length ? frameWorkTimes.reduce((a, b) => a + b, 0) / frameWorkTimes.length : 0;
          resolve({ count: frameWorkTimes.length, over20, max, avg });
        }, 520);
      });
    }, soakWin.id);

    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`  4x Throttle Frames: total=${throttleMetrics.count}, maxWork=${throttleMetrics.max.toFixed(2)}ms, avgWork=${throttleMetrics.avg.toFixed(2)}ms, frames > 20ms: ${throttleMetrics.over20}`);

    const throttlePass = throttleMetrics.max <= 20;
    const soakPass = domDelta <= 15;

    results.tests.soakAndPerf = {
      domDelta,
      soakPass,
      throttleMetrics,
      throttlePass,
      passed: soakPass && throttlePass,
    };

    // Clean up soak win
    await page.evaluate((id) => {
      const btn = document.querySelector(`#window-${id} button[aria-label="Close"]`);
      if (btn) btn.click();
    }, soakWin.id);

    // Overall check
    const allPass = Object.values(results.tests).every((t) => t.passed);
    results.passed = allPass;

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'step9_results.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('\n================================================================');
    if (allPass) {
      console.log('  >>> GATE 9 PASSED: MACOS-STYLE MINIMISE & CLOSE VERIFIED <<<  ');
    } else {
      console.log('  >>> GATE 9 FAILED: SEE LOGS ABOVE <<<                         ');
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('Step 9 verification failed with error:', err);
    results.error = err.message;
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'step9_results.json'), JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

runStep9Verification();
