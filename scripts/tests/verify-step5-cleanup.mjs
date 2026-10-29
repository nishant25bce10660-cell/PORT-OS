import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step5');

async function getLuminanceFromPage(page, shotBuffer) {
  return await page.evaluate(async (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 120;
        c.height = 80;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 120, 80);
        const imgData = ctx.getImageData(0, 0, 120, 80).data;
        let total = 0;
        const pixelCount = 120 * 80;
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i] / 255;
          const g = imgData[i + 1] / 255;
          const b = imgData[i + 2] / 255;
          total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        resolve(total / pixelCount);
      };
      img.src = dataUrl;
    });
  }, 'data:image/png;base64,' + Buffer.from(shotBuffer).toString('base64'));
}

async function runStep5Verification() {
  console.log('================================================================');
  console.log('  ROUND 18 · STEP 5 — WALLPAPER, EFFECTS & PERFORMANCE CLEANUP  ');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Instrument getContext, canvas resizes, and context lost
  await page.evaluateOnNewDocument(() => {
    window.__canvasGetContextCalls = [];
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      window.__canvasGetContextCalls.push({
        type,
        time: performance.now(),
        id: this.id || 'unnamed',
        className: this.className || '',
      });
      return origGetContext.apply(this, [type, ...args]);
    };

    window.__canvasResizeCount = 0;
    window.__lastCanvasDims = null;
    window.__canvasResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target.id === 'wallpaper-canvas') {
          if (window.__lastCanvasDims) {
            const wDiff = Math.abs(entry.contentRect.width - window.__lastCanvasDims.w);
            const hDiff = Math.abs(entry.contentRect.height - window.__lastCanvasDims.h);
            if (wDiff > 1 || hDiff > 1) {
              window.__canvasResizeCount++;
            }
          }
          window.__lastCanvasDims = {
            w: entry.contentRect.width,
            h: entry.contentRect.height,
          };
        }
      }
    });

    const checkCanvas = () => {
      const c = document.getElementById('wallpaper-canvas');
      if (c && !c.__observed) {
        c.__observed = true;
        window.__canvasResizeObserver.observe(c);
      }
    };
    setInterval(checkCanvas, 50);
  });

  // Navigate to root (triggering initial boot sequence)
  console.log('[1/7] Navigating to page (capturing boot -> lock screen)...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const timeline = [];
  const startTime = Date.now();

  // Capture frames every 100ms across boot into lock screen (~3.5s)
  while (Date.now() - startTime < 4000) {
    const shot = await page.screenshot({ type: 'png' });
    const lum = await getLuminanceFromPage(page, shot);
    const timeVal = await page.evaluate(() => {
      return window.__portos_wallpaper?.getTime ? window.__portos_wallpaper.getTime() : null;
    });
    timeline.push({
      phase: 'boot_to_lock',
      elapsed: Date.now() - startTime,
      luminance: lum,
      u_time: timeVal,
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  // Ensure lock screen is active
  await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });
  console.log('Lock screen visible. Logging in as guest...');

  // Capture across login-to-desktop transition
  const guestAvatar = await page.$('#avatar-select-guest');
  if (guestAvatar) await guestAvatar.click();
  await new Promise((r) => setTimeout(r, 100));

  await page.type('#input-viewer-name', 'Guest Tester');
  await page.type('#input-viewer-email', 'tester@example.com');
  const loginBtn = await page.$('#btn-login-viewer, #btn-login-submit');
  if (loginBtn) await loginBtn.click();

  const loginStartTime = Date.now();
  while (Date.now() - loginStartTime < 2500) {
    const shot = await page.screenshot({ type: 'png' });
    const lum = await getLuminanceFromPage(page, shot);
    const timeVal = await page.evaluate(() => {
      return window.__portos_wallpaper?.getTime ? window.__portos_wallpaper.getTime() : null;
    });
    timeline.push({
      phase: 'login_to_desktop',
      elapsed: Date.now() - startTime,
      luminance: lum,
      u_time: timeVal,
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  // Verify desktop is active
  await page.waitForSelector('.dock-container', { timeout: 8000 });
  console.log('Desktop active. Testing logout and second login...');

  // Logout via Apple / System N menu
  const appleBtn = await page.$('#menu-btn-n-logo, #topbar-menu-apple');
  if (appleBtn) await appleBtn.click();
  await page.waitForSelector('#menu-item-lock', { timeout: 4000 });
  await page.click('#menu-item-lock');

  const logoutStartTime = Date.now();
  while (Date.now() - logoutStartTime < 2500) {
    const shot = await page.screenshot({ type: 'png' });
    const lum = await getLuminanceFromPage(page, shot);
    const timeVal = await page.evaluate(() => {
      return window.__portos_wallpaper?.getTime ? window.__portos_wallpaper.getTime() : null;
    });
    timeline.push({
      phase: 'logout_to_lock',
      elapsed: Date.now() - startTime,
      luminance: lum,
      u_time: timeVal,
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  // Log in again
  console.log('Logging in again...');
  await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });
  const guestAvatar2 = await page.$('#avatar-select-guest');
  if (guestAvatar2) await guestAvatar2.click();
  await new Promise((r) => setTimeout(r, 100));

  await page.type('#input-viewer-name', 'Guest Tester');
  await page.type('#input-viewer-email', 'tester@example.com');
  const loginBtn2 = await page.$('#btn-login-viewer, #btn-login-submit');
  if (loginBtn2) await loginBtn2.click();

  const secondLoginStart = Date.now();
  while (Date.now() - secondLoginStart < 2500) {
    const shot = await page.screenshot({ type: 'png' });
    const lum = await getLuminanceFromPage(page, shot);
    const timeVal = await page.evaluate(() => {
      return window.__portos_wallpaper?.getTime ? window.__portos_wallpaper.getTime() : null;
    });
    timeline.push({
      phase: 'second_login_to_desktop',
      elapsed: Date.now() - startTime,
      luminance: lum,
      u_time: timeVal,
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  await page.waitForSelector('.dock-container', { timeout: 8000 });
  console.log('[2/7] Checking Wallpaper WebGL instrumentation metrics...');

  const wallpaperMetrics = await page.evaluate(() => {
    const wp = window.__portos_wallpaper;
    const canvas = document.getElementById('wallpaper-canvas');
    const container = document.getElementById('desktop-wallpaper-container');
    const computedCanvas = canvas ? window.getComputedStyle(canvas) : null;
    const computedContainer = container ? window.getComputedStyle(container) : null;

    const webglCalls = (window.__canvasGetContextCalls || []).filter(
      (c) => c.type === 'webgl' || c.type === 'webgl2' || c.type === 'experimental-webgl'
    );

    return {
      canvasExists: !!canvas,
      contextCount: webglCalls.length,
      webglCalls,
      contextLostCount: wp?.contextLostCount || 0,
      canvasResizeCount: window.__canvasResizeCount || 0,
      programCount: wp?.renderer?.info?.programs?.length || 0,
      dpr: wp?.renderer?.getPixelRatio ? wp.renderer.getPixelRatio() : window.devicePixelRatio,
      canvasStyle: {
        position: computedCanvas?.position,
        inset: computedCanvas?.inset,
        zIndex: computedCanvas?.zIndex,
        contain: computedCanvas?.contain,
        pointerEvents: computedCanvas?.pointerEvents,
      },
      containerStyle: {
        position: computedContainer?.position,
        inset: computedContainer?.inset,
        zIndex: computedContainer?.zIndex,
        contain: computedContainer?.contain,
      },
      currentTime: wp?.getTime ? wp.getTime() : null,
    };
  });

  console.log('Wallpaper Metrics:', wallpaperMetrics);

  // Take screenshot of persistent context
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'wallpaper_persistent_context.png') });

  // [3/7] Analyze Luminance Timeline
  console.log('[3/7] Analyzing Luminance Timeline across all phases...');
  let minLuminance = 1.0;
  let maxConsecutiveChange = 0;
  let monotonicTimePass = true;
  let lastTimeVal = 0;

  for (let i = 0; i < timeline.length; i++) {
    const frame = timeline[i];
    if (frame.luminance < minLuminance) minLuminance = frame.luminance;

    if (frame.u_time !== null) {
      if (frame.u_time < lastTimeVal) {
        monotonicTimePass = false;
        console.warn(`Time uniform dropped from ${lastTimeVal} to ${frame.u_time}`);
      }
      lastTimeVal = frame.u_time;
    }

    if (i > 0) {
      const prev = timeline[i - 1];
      const diff = Math.abs(frame.luminance - prev.luminance);
      // Skip intended transition boundaries
      const isTransitionBoundary =
        prev.phase !== frame.phase ||
        (frame.elapsed < 3800 && frame.elapsed > 3200); // boot fade
      if (!isTransitionBoundary) {
        if (diff > maxConsecutiveChange) maxConsecutiveChange = diff;
      }
    }
  }

  console.log(`Min Luminance: ${(minLuminance * 100).toFixed(2)}% (budget: >= 3.0%)`);
  console.log(`Max Consecutive-Frame Change: ${(maxConsecutiveChange * 100).toFixed(2)}% (budget: <= 6.0%)`);
  console.log(`Monotonic u_time: ${monotonicTimePass ? 'PASS' : 'FAIL'} (final t = ${lastTimeVal.toFixed(2)}s)`);

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'luminance_timeline.json'),
    JSON.stringify(timeline, null, 2)
  );

  // [4/7] Hover variance check (dock hover & folder hover)
  console.log('[4/7] Checking luminance variance during dock hover and folder hover...');
  // Baseline frame
  const baseShot = await page.screenshot({ type: 'png' });
  const baseLum = await getLuminanceFromPage(page, baseShot);

  // Hover dock
  const dockBar = await page.$('.dock-bar');
  if (dockBar) {
    const box = await dockBar.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const dockShot = await page.screenshot({ type: 'png' });
  const dockLum = await getLuminanceFromPage(page, dockShot);
  const dockLumDiff = Math.abs(dockLum - baseLum);

  // Hover folder
  const folder = await page.$('#desktop-item-projects');
  if (folder) {
    const box = await folder.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const folderShot = await page.screenshot({ type: 'png' });
  const folderLum = await getLuminanceFromPage(page, folderShot);
  const folderLumDiff = Math.abs(folderLum - baseLum);

  console.log(`Dock Hover Luminance Diff: ${(dockLumDiff * 100).toFixed(2)}% (budget: < 2.0%)`);
  console.log(`Folder Hover Luminance Diff: ${(folderLumDiff * 100).toFixed(2)}% (budget: < 2.0%)`);

  // Move pointer away to clear hover
  await page.mouse.move(500, 300, { steps: 10 });
  await new Promise((r) => setTimeout(r, 350));

  // [5/7] Effects Cleanup Verification
  console.log('[5/7] Verifying Effects Cleanup in Settings...');
  // Open Settings via dock
  const settingsBtn = await page.$('#dock-item-settings');
  if (settingsBtn) {
    await settingsBtn.click();
  } else {
    await page.evaluate(() => {
      const btn = document.getElementById('dock-item-settings');
      if (btn) btn.click();
    });
  }

  await page.waitForSelector('#window-system-settings', { timeout: 6000 });
  // Click Customization tab
  const customTab = await page.$('#settings-tab-customization');
  if (customTab) {
    await customTab.click();
  } else {
    await page.evaluate(() => {
      const btn = document.getElementById('settings-tab-customization');
      if (btn) btn.click();
    });
  }
  await page.waitForSelector('.effect-toggle-card', { timeout: 4000 });
  await new Promise((r) => setTimeout(r, 200));

  const effectsCatalog = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.effect-toggle-card'));
    const cardData = cards.map((c) => ({
      key: c.getAttribute('data-effect'),
      id: c.id,
      text: c.innerText,
      active: c.innerText.includes('● Active'),
    }));

    // Check for deprecated fallback elements
    const deprecatedFallbacks = [
      '#toggle-fx-magneticHover',
      '#toggle-fx-tiltEffect',
      '#toggle-fx-auroraMesh',
    ].map((sel) => ({
      selector: sel,
      exists: !!document.querySelector(sel),
    }));

    return {
      cardCount: cards.length,
      cardData,
      deprecatedFallbacks,
    };
  });

  console.log('Effects Catalog in UI:', effectsCatalog);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'effects_catalog_3cards.png') });

  // Test toggling each of the 3 effects
  console.log('Testing each effect toggle and real CSS class application...');
  const effectKeys = ['glassmorphism', 'liquidGlass', 'ambientGlow'];
  const effectVerification = {};

  for (const eff of effectKeys) {
    const card = await page.$(`#effect-card-${eff}`);
    if (card) {
      // Click to toggle
      await card.click();
      await new Promise((r) => setTimeout(r, 200));

      const state = await page.evaluate((k) => {
        const bodyCls = Array.from(document.body.classList);
        const deskCls = document.getElementById('portfolio-desktop-os')?.className || '';
        const cardEl = document.getElementById(`effect-card-${k}`);
        const isActive = cardEl ? cardEl.innerText.includes('● Active') : false;
        const expectedClass = `fx-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        return {
          key: k,
          isActive,
          expectedClass,
          bodyHasClass: bodyCls.includes(expectedClass),
          deskHasClass: deskCls.includes(expectedClass),
        };
      }, eff);

      effectVerification[eff] = state;
    }
  }
  console.log('Effect Toggle Results:', effectVerification);

  // Check backdrop filter surfaces count
  const backdropFilterSurfaces = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const filtered = all.filter((el) => {
      const style = window.getComputedStyle(el);
      const bf = style.backdropFilter || style.webkitBackdropFilter;
      if (bf && bf !== 'none') {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      }
      return false;
    });
    return filtered.map((el) => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
    }));
  });
  console.log(`Visible Backdrop Filter Surfaces (${backdropFilterSurfaces.length}):`, backdropFilterSurfaces);

  // [6/7] Performance-Mode Cleanup Verification
  console.log('[6/7] Verifying Performance-Mode Cleanup (zero runtime governor remnants)...');
  const perfModeCheck = await page.evaluate(() => {
    return {
      bodyTier: document.body.getAttribute('data-quality-tier'),
      htmlTier: document.documentElement.getAttribute('data-quality-tier'),
      localPerfMode: localStorage.getItem('portos_performance_mode'),
      hasQualityGovernorGlobal: !!window.__qualityGovernor,
    };
  });
  console.log('Performance-Mode Remnants Check:', perfModeCheck);

  // [7/7] Evaluate final results
  const passConditions = {
    webglContextExactlyOne: wallpaperMetrics.contextCount === 1,
    zeroContextLosses: wallpaperMetrics.contextLostCount === 0,
    zeroCanvasResizes: wallpaperMetrics.canvasResizeCount === 0,
    monotonicTime: monotonicTimePass,
    minLuminanceAbove3Pct: minLuminance >= 0.03,
    consecutiveFrameChangeBelow6Pct: maxConsecutiveChange <= 0.06,
    hoverLuminanceVarianceBelow2Pct: dockLumDiff < 0.02 && folderLumDiff < 0.02,
    exactlyThreeEffectCards: effectsCatalog.cardCount === 3,
    zeroDeprecatedFallbacks: effectsCatalog.deprecatedFallbacks.every((f) => !f.exists),
    realClassesApplied: Object.values(effectVerification).every(
      (v) => (v.bodyHasClass || v.deskHasClass) === v.isActive
    ),
    maxThreeBackdropFilters: backdropFilterSurfaces.length <= 3,
    zeroGovernorRemnants:
      perfModeCheck.bodyTier === null &&
      perfModeCheck.htmlTier === null &&
      perfModeCheck.localPerfMode === null &&
      !perfModeCheck.hasQualityGovernorGlobal,
  };

  console.log('\n================================================================');
  console.log('  GATE 5 CRITERIA EVALUATION                                    ');
  console.log('================================================================');
  for (const [k, v] of Object.entries(passConditions)) {
    console.log(`  ${v ? '✓ PASS' : '✗ FAIL'}: ${k}`);
  }

  const allPassed = Object.values(passConditions).every(Boolean);

  const results = {
    allPassed,
    passConditions,
    wallpaperMetrics,
    minLuminance,
    maxConsecutiveChange,
    dockLumDiff,
    folderLumDiff,
    effectsCatalog,
    effectVerification,
    backdropFilterSurfacesCount: backdropFilterSurfaces.length,
    perfModeCheck,
    date: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'step5_results.json'),
    JSON.stringify(results, null, 2)
  );

  await browser.close();

  if (allPassed) {
    console.log('\n>>> GATE 5 PASSED: All Step 5 criteria verified with empirical evidence!');
    process.exit(0);
  } else {
    console.error('\n>>> GATE 5 FAILED: Some Step 5 criteria did not meet requirements.');
    process.exit(1);
  }
}

runStep5Verification().catch((err) => {
  console.error('Fatal test error in Step 5 verification:', err);
  process.exit(1);
});
