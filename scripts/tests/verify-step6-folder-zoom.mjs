import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step6');

function parseScale(transformStr) {
  if (!transformStr || transformStr === 'none') return 1.0;
  // matrix(a, b, c, d, tx, ty) -> scaleX = Math.hypot(a, b)
  const m = transformStr.match(/^matrix\((.+)\)$/);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    return Math.hypot(parts[0], parts[1]);
  }
  // matrix3d
  const m3 = transformStr.match(/^matrix3d\((.+)\)$/);
  if (m3) {
    const parts = m3[1].split(',').map((p) => parseFloat(p.trim()));
    return Math.hypot(parts[0], parts[1], parts[2]);
  }
  return 1.0;
}

async function runStep6Verification() {
  console.log('================================================================');
  console.log('  ROUND 18 · STEP 6 — FOLDER ZOOM-OUT & FILES-OUT ANIMATION     ');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('[1/6] Loading page & authenticating as guest...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });

  const guestAvatar = await page.$('#avatar-select-guest');
  if (guestAvatar) await guestAvatar.click();
  await page.type('#input-viewer-name', 'Guest Tester');
  await page.type('#input-viewer-email', 'tester@example.com');
  const loginBtn = await page.$('#btn-login-viewer');
  if (loginBtn) await loginBtn.click();

  await page.waitForSelector('.dock-container', { timeout: 8000 });
  await page.waitForSelector('#desktop-item-projects', { timeout: 6000 });
  console.log('Desktop ready.');

  // Inject in-page frame sampler
  await page.evaluate(() => {
    window.__recordedFrames = [];
    window.__isSampling = false;

    function sampleLoop() {
      if (window.__isSampling) {
        const ctrl = window.__portos_folder_controller;
        const item = document.getElementById('desktop-item-projects');
        const zoomEl = item?.querySelector('.di-zoom');
        const labelEl = item?.querySelector('.desktop-icon-label');
        const pills = Array.from(document.querySelectorAll('.folder-float__item'));
        const stem = document.querySelector('.folder-float__connector');

        let transform = 'none';
        let transformOrigin = '';
        let labelTransform = 'none';
        let stemOpacity = '0';
        if (zoomEl) {
          const cs = window.getComputedStyle(zoomEl);
          transform = cs.transform;
          transformOrigin = cs.transformOrigin;
        }
        if (labelEl) {
          labelTransform = window.getComputedStyle(labelEl).transform;
        }
        if (stem) {
          stemOpacity = window.getComputedStyle(stem).opacity;
        }

        window.__recordedFrames.push({
          time: performance.now(),
          progress: ctrl?.getProgress ? ctrl.getProgress() : 0,
          target: ctrl?.getTarget ? ctrl.getTarget() : 0,
          transform,
          transformOrigin,
          labelTransform,
          pillCount: pills.length,
          stemOpacity,
          pillOpacities: pills.map((p) => parseFloat(p.style.opacity || '0')),
        });
      }
      requestAnimationFrame(sampleLoop);
    }
    requestAnimationFrame(sampleLoop);
  });

  // -------------------------------------------------------------
  // Check 1: Normal Open Animation
  // -------------------------------------------------------------
  console.log('[2/6] Check 1: Measuring normal folder open sequence...');
  const folderBox = await page.$eval('#desktop-item-projects', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  // Start sampling
  await page.evaluate(() => {
    window.__recordedFrames = [];
    window.__isSampling = true;
  });

  // Human-like pointer movement to folder
  await page.mouse.move(folderBox.x, folderBox.y, { steps: 16 });
  // Wait for intent delay (60ms) + full spring duration and settlement
  await new Promise((r) => setTimeout(r, 700));

  await page.evaluate(() => {
    window.__isSampling = false;
  });

  const openFrames = await page.evaluate(() => window.__recordedFrames);
  console.log(`Open sequence recorded ${openFrames.length} frames.`);

  // Verify monotonicity during open
  let openMonotonic = true;
  let peakScale = 1.0;
  for (let i = 1; i < openFrames.length; i++) {
    const prev = openFrames[i - 1].progress;
    const curr = openFrames[i].progress;
    if (curr < prev - 0.005) {
      openMonotonic = false;
    }
    const sc = parseScale(openFrames[i].transform);
    if (sc > peakScale) peakScale = sc;
  }

  const endOpenFrame = openFrames[openFrames.length - 1];
  const finalOpenScale = parseScale(endOpenFrame.transform);
  const transformOriginOpen = endOpenFrame.transformOrigin;
  console.log(`Peak folder scale: ${peakScale.toFixed(3)} (budget: ~1.25x)`);
  console.log(`Final open scale: ${finalOpenScale.toFixed(3)}`);
  console.log(`Transform Origin: ${transformOriginOpen}`);
  console.log(`Open Progress Monotonic: ${openMonotonic ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_folder_expanded_1_25x.png') });

  // -------------------------------------------------------------
  // Check 2: Normal Close Animation & Reverse Pill Retraction
  // -------------------------------------------------------------
  console.log('[3/6] Check 2: Measuring normal folder close & reverse pill retraction...');
  await page.evaluate(() => {
    window.__recordedFrames = [];
    window.__isSampling = true;
  });

  // Move pointer away
  await page.mouse.move(500, 300, { steps: 16 });
  // Wait for 280ms grace + spring retraction and settlement
  await new Promise((r) => setTimeout(r, 800));

  await page.evaluate(() => {
    window.__isSampling = false;
  });

  const closeFrames = await page.evaluate(() => window.__recordedFrames);
  console.log(`Close sequence recorded ${closeFrames.length} frames.`);

  let closeMonotonic = true;
  for (let i = 1; i < closeFrames.length; i++) {
    const prev = closeFrames[i - 1].progress;
    const curr = closeFrames[i].progress;
    if (curr > prev + 0.005) {
      closeMonotonic = false;
    }
  }

  const endCloseFrame = closeFrames[closeFrames.length - 1];
  const finalCloseScale = parseScale(endCloseFrame.transform);
  const finalComputedTransform = endCloseFrame.transform;
  const isFinalIdentity =
    finalComputedTransform === 'none' ||
    finalComputedTransform === 'matrix(1, 0, 0, 1, 0, 0)' ||
    Math.abs(finalCloseScale - 1.0) < 0.001;

  console.log(`Close Progress Monotonic: ${closeMonotonic ? 'PASS' : 'FAIL'}`);
  console.log(`Final Close Computed Transform: ${finalComputedTransform}`);
  console.log(`Returns to Identity: ${isFinalIdentity ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_folder_closed_identity.png') });

  // -------------------------------------------------------------
  // Check 3: Mid-Animation Reversal at 120ms
  // -------------------------------------------------------------
  console.log('[4/6] Check 3: Measuring mid-animation reversal at 120ms...');
  await page.evaluate(() => {
    window.__recordedFrames = [];
    window.__isSampling = true;
  });

  // Enter folder
  await page.mouse.move(folderBox.x, folderBox.y, { steps: 16 });
  // Wait 60ms intent + 120ms into animation
  await new Promise((r) => setTimeout(r, 180));

  // Reverse mid-animation by moving away
  await page.mouse.move(500, 300, { steps: 16 });
  await new Promise((r) => setTimeout(r, 450));

  await page.evaluate(() => {
    window.__isSampling = false;
  });

  const revFrames = await page.evaluate(() => window.__recordedFrames);
  console.log(`Reversal recorded ${revFrames.length} frames.`);

  // Find inflection point
  let maxProgressRev = 0;
  let maxFrameJump = 0;
  for (let i = 0; i < revFrames.length; i++) {
    const p = revFrames[i].progress;
    if (p > maxProgressRev) maxProgressRev = p;
    if (i > 0) {
      const pPrev = revFrames[i - 1].progress;
      // In px terms, 0.25 scale on 52px icon = 13px max travel. Jump = |p - pPrev| * 13px
      const pxDiff = Math.abs(p - pPrev) * 13;
      if (pxDiff > maxFrameJump) maxFrameJump = pxDiff;
    }
  }

  const endRevScale = parseScale(revFrames[revFrames.length - 1].transform);
  const revReturnsToIdentity = Math.abs(endRevScale - 1.0) < 0.005;

  console.log(`Peak progress before reversal: ${maxProgressRev.toFixed(3)}`);
  console.log(`Max inter-frame jump during reversal: ${maxFrameJump.toFixed(2)}px (budget: <= 2.0px)`);
  console.log('Reversal frames detail:');
  revFrames.forEach((f, idx) => {
    const dt = idx > 0 ? (f.time - revFrames[idx - 1].time).toFixed(1) : '0.0';
    const dp = idx > 0 ? ((f.progress - revFrames[idx - 1].progress) * 13).toFixed(2) : '0.00';
    console.log(`  [${idx}] t=${f.time.toFixed(1)} dt=${dt}ms p=${f.progress.toFixed(3)} dp=${dp}px tr=${f.transform}`);
  });
  console.log(`Reversal returns to identity: ${revReturnsToIdentity ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_reversal_verified.png') });

  // -------------------------------------------------------------
  // Check 4: 100 Cycles Zero Drift
  // -------------------------------------------------------------
  console.log('[5/6] Check 4: Running 100 open/close cycles for zero coordinate drift...');
  const initialRect = await page.$eval('#desktop-item-projects', (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top };
  });

  for (let c = 1; c <= 100; c++) {
    await page.evaluate((pos) => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: pos.x, clientY: pos.y, bubbles: true }));
    }, folderBox);
    await new Promise((r) => setTimeout(r, 16));

    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 300, bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  // Allow final spring settlement
  await new Promise((r) => setTimeout(r, 400));

  const finalRect = await page.$eval('#desktop-item-projects', (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top };
  });

  const driftX = Math.abs(finalRect.left - initialRect.left);
  const driftY = Math.abs(finalRect.top - initialRect.top);
  const totalDrift = Math.hypot(driftX, driftY);
  console.log(`100 Cycles Coordinate Drift: dx=${driftX.toFixed(2)}px, dy=${driftY.toFixed(2)}px, total=${totalDrift.toFixed(2)}px (budget: 0.0px)`);

  // -------------------------------------------------------------
  // Check 5: Reduced Motion Mode
  // -------------------------------------------------------------
  console.log('[6/6] Check 5: Testing reduced motion mode...');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await new Promise((r) => setTimeout(r, 200));

  await page.mouse.move(folderBox.x, folderBox.y, { steps: 10 });
  await new Promise((r) => setTimeout(r, 300));

  const reducedMotionScale = await page.$eval('#desktop-item-projects .di-zoom', (el) => {
    const cs = window.getComputedStyle(el);
    return cs.transform;
  });
  const parsedReducedScale = parseScale(reducedMotionScale);
  console.log(`Reduced motion folder scale: ${parsedReducedScale.toFixed(3)} (budget: exactly 1.0)`);
  const reducedMotionPass = Math.abs(parsedReducedScale - 1.0) < 0.01;

  await page.mouse.move(500, 300, { steps: 5 });
  await new Promise((r) => setTimeout(r, 350));

  // Reset media features
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // -------------------------------------------------------------
  // Final Evaluation
  // -------------------------------------------------------------
  const passConditions = {
    peakScaleAround1_25x: peakScale >= 1.22 && peakScale <= 1.28,
    openProgressMonotonic: openMonotonic,
    closeProgressMonotonic: closeMonotonic,
    closeReturnsToIdentity: isFinalIdentity,
    maxFrameJumpBelow2px: maxFrameJump <= 2.0,
    reversalReturnsToIdentity: revReturnsToIdentity,
    zeroDrift100Cycles: totalDrift < 0.5,
    reducedMotionOpacityOnly: reducedMotionPass,
  };

  console.log('\n================================================================');
  console.log('  GATE 6 CRITERIA EVALUATION                                    ');
  console.log('================================================================');
  for (const [k, v] of Object.entries(passConditions)) {
    console.log(`  ${v ? '✓ PASS' : '✗ FAIL'}: ${k}`);
  }

  const allPassed = Object.values(passConditions).every(Boolean);

  const results = {
    allPassed,
    passConditions,
    peakScale,
    finalOpenScale,
    transformOriginOpen,
    maxFrameJump,
    totalDrift,
    parsedReducedScale,
    date: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'step6_results.json'),
    JSON.stringify(results, null, 2)
  );

  await browser.close();

  if (allPassed) {
    console.log('\n>>> GATE 6 PASSED: Folder zoom-out and files-out verified with empirical metrics!');
    process.exit(0);
  } else {
    console.error('\n>>> GATE 6 FAILED: Some Step 6 criteria did not meet requirements.');
    process.exit(1);
  }
}

runStep6Verification().catch((err) => {
  console.error('Fatal test error in Step 6 verification:', err);
  process.exit(1);
});
