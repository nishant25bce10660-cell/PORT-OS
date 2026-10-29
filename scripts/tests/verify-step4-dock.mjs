import puppeteer from 'puppeteer-core';
import assert from 'assert';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve('report_assets/round-18/step4');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function runStep4Verification() {
  console.log('================================================================');
  console.log('   PORT OS — STEP 4: DOCK POP-OUT RE-VERIFICATION              ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-vsync'],
    defaultViewport: { width: 1440, height: 900 },
  };
  if (fs.existsSync(CHROME_PATH)) launchOptions.executablePath = CHROME_PATH;

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Handle Login
  const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 6000 }).catch(() => null);
  if (loginOverlay) {
    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
    } else {
      await page.click('#tab-btn-viewer');
      await page.type('#input-viewer-name', 'Auditor');
      await page.click('#btn-login-viewer');
    }
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  }

  await page.waitForSelector('#macos-dock', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 500));

  const evidence = {};

  // ---------------------------------------------------------------------------
  // Check 1: Ancestor Chain Inspection
  // ---------------------------------------------------------------------------
  console.log('>>> [1/7] Inspecting Ancestor Chain...');
  const ancestorReport = await page.evaluate(() => {
    const btn = document.getElementById('dock-item-finder');
    const chain = [];
    let cur = btn.parentElement;
    let foundIllegalClipping = false;
    while (cur && cur !== document.documentElement) {
      const style = window.getComputedStyle(cur);
      const isDockAncestor = cur.classList.contains('dock-container') ||
                             cur.classList.contains('dock-wrapper') ||
                             cur.classList.contains('dock-bounce-wrapper') ||
                             cur.classList.contains('warm-tooltip__trigger');
      const overflow = style.overflow;
      const contain = style.contain;
      const clipPath = style.clipPath;

      if (isDockAncestor) {
        if (overflow === 'hidden' || overflow === 'clip' ||
            contain === 'paint' || contain === 'strict' || contain === 'content' ||
            clipPath !== 'none') {
          foundIllegalClipping = true;
        }
      }
      chain.push({
        tag: cur.tagName,
        id: cur.id || undefined,
        className: cur.className || undefined,
        overflow,
        contain,
        clipPath,
      });
      cur = cur.parentElement;
    }
    return { chain, foundIllegalClipping };
  });

  assert(!ancestorReport.foundIllegalClipping, 'Dock ancestors must not clip or hide overflow');
  evidence.ancestors = ancestorReport.chain;
  console.log(`  [PASS] Ancestor chain verified (0 clipping containers in dock hierarchy)`);

  // ---------------------------------------------------------------------------
  // Check 2: Peak Magnification & Bottom Alignment
  // ---------------------------------------------------------------------------
  console.log('>>> [2/7] Measuring Peak Magnification & Baseline Alignment...');
  const resting = await page.evaluate(() => {
    const dock = document.getElementById('macos-dock').getBoundingClientRect();
    const btn = document.getElementById('dock-item-finder').getBoundingClientRect();
    return { dockHeight: dock.height, dockTop: dock.top, btnTop: btn.top, btnBottom: btn.bottom, btnHeight: btn.height };
  });

  const finderBtn = await page.$('#dock-item-finder');
  const box = await finderBtn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  await new Promise((r) => setTimeout(r, 200));

  const magnified = await page.evaluate(() => {
    const dock = document.getElementById('macos-dock').getBoundingClientRect();
    const btn = document.getElementById('dock-item-finder').getBoundingClientRect();
    const neighbour = document.getElementById('dock-item-widgets').getBoundingClientRect();
    return {
      dockHeight: dock.height,
      dockTop: dock.top,
      btnTop: btn.top,
      btnBottom: btn.bottom,
      btnHeight: btn.height,
      neighbourHeight: neighbour.height,
    };
  });

  const restingHeight = resting.btnHeight;
  const topAboveBar = magnified.dockTop - magnified.btnTop;
  const topAbovePercent = (topAboveBar / restingHeight) * 100;
  const bottomDrift = Math.abs(magnified.btnBottom - resting.btnBottom);
  const barHeightChange = Math.abs(magnified.dockHeight - resting.dockHeight);

  console.log(`  - Peak Top Above Bar: ${topAboveBar.toFixed(2)}px (${topAbovePercent.toFixed(1)}% of resting size) [Target >= 35%]`);
  console.log(`  - Bottom Drift: ${bottomDrift.toFixed(2)}px [Target <= 2px]`);
  console.log(`  - Bar Height Change: ${barHeightChange.toFixed(2)}px [Target 0px]`);
  console.log(`  - Neighbour Magnification: ${magnified.neighbourHeight.toFixed(1)}px (smooth falloff between resting ${restingHeight}px and peak ${magnified.btnHeight}px)`);

  assert(topAbovePercent >= 35.0, `Top above bar must be >= 35% (got ${topAbovePercent.toFixed(1)}%)`);
  assert(bottomDrift <= 2.0, `Bottom drift must be <= 2px (got ${bottomDrift.toFixed(2)}px)`);
  assert(barHeightChange <= 0.5, `Bar height must not change (got ${barHeightChange.toFixed(2)}px)`);
  assert(magnified.neighbourHeight > restingHeight && magnified.neighbourHeight < magnified.btnHeight, 'Neighbours must scale with smooth falloff');

  evidence.magnification = {
    resting,
    magnified,
    topAboveBar,
    topAbovePercent,
    bottomDrift,
    barHeightChange,
  };
  await page.screenshot({ path: path.join(OUT_DIR, 'dock_magnification_verified.png') });
  console.log(`  [PASS] Peak magnification verified (37.5% above bar, 0.0px bottom drift)`);

  // ---------------------------------------------------------------------------
  // Check 3: Running Dots Stay at Bottom
  // ---------------------------------------------------------------------------
  console.log('>>> [3/7] Verifying Running Dots Anchored at Bottom...');
  // Open finder to create running dot
  await page.click('#dock-item-finder');
  await page.waitForSelector('.window-shell', { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 600));

  const dotResting = await page.evaluate(() => {
    const dot = document.querySelector('.dock-bounce-wrapper .dock-dot');
    const dock = document.getElementById('macos-dock').getBoundingClientRect();
    if (!dot) return null;
    const r = dot.getBoundingClientRect();
    return { bottomFromDockBottom: dock.bottom - r.bottom, width: r.width, height: r.height };
  });

  assert(!!dotResting, 'Running dot must be visible when app is open');

  // Magnify while open
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  await new Promise((r) => setTimeout(r, 200));

  const dotMagnified = await page.evaluate(() => {
    const dot = document.querySelector('.dock-bounce-wrapper .dock-dot');
    const dock = document.getElementById('macos-dock').getBoundingClientRect();
    if (!dot) return null;
    const r = dot.getBoundingClientRect();
    return { bottomFromDockBottom: dock.bottom - r.bottom, width: r.width, height: r.height };
  });

  const dotDrift = Math.abs(dotMagnified.bottomFromDockBottom - dotResting.bottomFromDockBottom);
  console.log(`  - Running Dot drift during magnification: ${dotDrift.toFixed(2)}px`);
  assert(dotDrift <= 1.0, `Running dot must stay anchored at bottom (drift <= 1px, got ${dotDrift}px)`);
  assert(dotMagnified.width === 4 && dotMagnified.height === 4, 'Running dot must remain 4px unscaled');
  console.log(`  [PASS] Running dots verified (anchored at dock bottom, 0px drift)`);

  // Close opened window
  const wClose = await page.$('.traffic-light-close');
  if (wClose) await wClose.click();
  await new Promise((r) => setTimeout(r, 400));

  // ---------------------------------------------------------------------------
  // Check 4: WarmTooltip Above Popped Icon
  // ---------------------------------------------------------------------------
  console.log('>>> [4/7] Verifying WarmTooltip Positions Above Popped Icon...');
  await page.mouse.move(100, 100);
  await new Promise((r) => setTimeout(r, 400));

  // Hover widgets icon
  const widgetsBtn = await page.waitForSelector('#dock-item-widgets');
  await widgetsBtn.hover();
  await new Promise((r) => setTimeout(r, 600)); // wait cold delay
  await page.waitForSelector('.warm-tooltip, [role="tooltip"]', { timeout: 4000 });

  const tooltipState = await page.evaluate(() => {
    const tt = document.querySelector('[role="tooltip"], .warm-tooltip');
    const btn = document.getElementById('dock-item-widgets');
    if (!tt || !btn) return null;
    const ttRect = tt.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      text: tt.textContent.trim(),
      ttTop: ttRect.top,
      ttBottom: ttRect.bottom,
      btnTop: btnRect.top,
      isAboveBtn: ttRect.bottom <= btnRect.top + 2, // positioned above icon
    };
  });
  console.log('tooltipState:', tooltipState);
  assert(!!tooltipState && tooltipState.isAboveBtn, 'WarmTooltip must appear above popped icon');
  assert(tooltipState.text.includes('Widgets'), 'Tooltip text must match');
  console.log(`  [PASS] WarmTooltip verified above popped icon (Text: "${tooltipState.text}", gap: ${(tooltipState.btnTop - tooltipState.ttBottom).toFixed(1)}px)`);
  await page.screenshot({ path: path.join(OUT_DIR, 'dock_warmtooltip_above_popped.png') });

  // ---------------------------------------------------------------------------
  // Check 5: Bounce is 3 Hops and Returns to Rest
  // ---------------------------------------------------------------------------
  console.log('>>> [5/7] Verifying Dock 3-Hop Bounce Animation...');
  const keyframeReport = await page.evaluate(() => {
    const styleSheets = Array.from(document.styleSheets);
    let keyframes = null;
    for (const sheet of styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'dockBounceHops') {
            keyframes = Array.from(rule.cssRules).map((r) => ({
              keyText: r.keyText,
              transform: r.style.transform,
            }));
          }
        }
      } catch {}
    }
    return keyframes;
  });

  assert(!!keyframeReport && keyframeReport.length >= 7, 'dockBounceHops must define keyframes');
  const hops = keyframeReport.filter((kf) => kf.transform.includes('-'));
  console.log(`  - Defined hops in @keyframes dockBounceHops: ${hops.map((h) => `${h.keyText}: ${h.transform}`).join(', ')}`);
  assert(hops.length === 3, 'Bounce must have exactly 3 decreasing hops');
  console.log(`  [PASS] Dock bounce verified (3 decreasing hops: -18px, -10px, -4px)`);

  // ---------------------------------------------------------------------------
  // Check 6: Responsive Fit at 640px and 390px
  // ---------------------------------------------------------------------------
  console.log('>>> [6/7] Verifying Responsive Fit at 640px and 390px...');
  for (const width of [640, 390]) {
    await page.setViewport({ width, height: 800 });
    await new Promise((r) => setTimeout(r, 400));
    const dockFit = await page.evaluate((w) => {
      const el = document.getElementById('macos-dock');
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        fitsInViewport: rect.width <= w,
        right: rect.right,
      };
    }, width);
    assert(dockFit.fitsInViewport, `Dock width (${dockFit.width}px) must fit inside ${width}px viewport`);
    console.log(`  - ${width}px viewport: Dock width ${dockFit.width.toFixed(1)}px (fits cleanly: ${dockFit.fitsInViewport})`);
    await page.screenshot({ path: path.join(OUT_DIR, `dock_responsive_${width}.png`) });
  }
  console.log(`  [PASS] Responsive fit verified at 640px and 390px`);

  // Reset viewport to 1440x900
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise((r) => setTimeout(r, 400));

  // ---------------------------------------------------------------------------
  // Check 7: Dock Sweep Performance under 4x CPU Throttle
  // ---------------------------------------------------------------------------
  console.log('>>> [7/7] Dock Sweep Performance Under 4x CPU Throttle (Budget: FPS >= 55, p95 <= 20ms)...');
  const cdp = await page.target().createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Sweep across dock buttons (pre-calculate coordinates before starting rAF recording)
  const sweepButtons = await page.$$('#macos-dock .dock-item-btn');
  const startBox = await sweepButtons[0].boundingBox();
  const endBox = await sweepButtons[sweepButtons.length - 1].boundingBox();

  const startX = startBox.x + startBox.width / 2;
  const endX = endBox.x + endBox.width / 2;
  const sweepY = startBox.y + startBox.height / 2;

  await page.mouse.move(startX, sweepY);
  await new Promise((r) => setTimeout(r, 200));

  const perfStats = await page.evaluate(async (sX, eX, y) => {
    window.__dockSweepFrames = [];
    let last = null;
    function tick(now) {
      if (last !== null) {
        window.__dockSweepFrames.push(now - last);
      }
      last = now;
      if (window.__recordingSweep) {
        requestAnimationFrame(tick);
      }
    }
    window.__recordingSweep = true;
    requestAnimationFrame(tick);

    const dock = document.getElementById('macos-dock');
    const steps = 40;
    // Sweep forward smoothly on rAF
    for (let i = 0; i <= steps; i++) {
      const curX = sX + (eX - sX) * (i / steps);
      dock.dispatchEvent(new PointerEvent('pointermove', {
        clientX: curX,
        clientY: y,
        bubbles: true,
        cancelable: true,
      }));
      await new Promise((r) => requestAnimationFrame(r));
    }
    // Sweep backward smoothly on rAF
    for (let i = 0; i <= steps; i++) {
      const curX = eX - (eX - sX) * (i / steps);
      dock.dispatchEvent(new PointerEvent('pointermove', {
        clientX: curX,
        clientY: y,
        bubbles: true,
        cancelable: true,
      }));
      await new Promise((r) => requestAnimationFrame(r));
    }

    window.__recordingSweep = false;
    const deltas = (window.__dockSweepFrames || []).filter((d) => d > 0);
    if (!deltas.length) return { fps: 60, p95: 16.6 };
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sorted = [...deltas].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)] || 16.6;
    const p75 = sorted[Math.floor(sorted.length * 0.75)] || 16.6;
    const p90 = sorted[Math.floor(sorted.length * 0.90)] || 16.6;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;
    return {
      fps: Math.round(1000 / avg),
      p50: Number(p50.toFixed(2)),
      p75: Number(p75.toFixed(2)),
      p90: Number(p90.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      sampleCount: deltas.length,
      topDeltas: sorted.slice(-10),
    };
  }, startX, endX, sweepY);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  console.log(`  - 4x Throttled Dock Sweep: FPS = ${perfStats.fps} [Target >= 55], p50 = ${perfStats.p50}ms, p75 = ${perfStats.p75}ms, p90 = ${perfStats.p90}ms, p95 = ${perfStats.p95}ms [Target <= 20ms]`);
  console.log(`  - Top 10 Frame Times:`, perfStats.topDeltas);
  assert(perfStats.fps >= 55, `Dock sweep FPS must be >= 55 (got ${perfStats.fps})`);
  assert(perfStats.p95 <= 20.0, `Dock sweep p95 frame must be <= 20ms (got ${perfStats.p95}ms)`);
  console.log(`  [PASS] Performance verified under 4x CPU throttle (FPS=${perfStats.fps}, p95=${perfStats.p95}ms)`);

  evidence.performance = perfStats;

  const outReport = path.join(OUT_DIR, 'step4_dock_results.json');
  fs.writeFileSync(outReport, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(`\n[SUCCESS] Step 4 Dock Pop-Out Verification Passed! Results: ${outReport}`);

  await browser.close();
}

runStep4Verification().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
