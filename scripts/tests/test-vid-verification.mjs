import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function runVerification() {
  console.log('=== PORT OS Continuous Debugging Verification Suite ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });
  const report = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  try {
    // Navigate & authenticate
    console.log('[1/8] Navigating to PORT OS and logging in as Owner...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });
    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.waitForSelector('#input-admin-password', { timeout: 5000 });
      const userInp = await page.$('#input-admin-username');
      if (userInp) await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    }
    await page.waitForSelector('#macos-dock, .dock-container', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 800));

    // -------------------------------------------------------------
    // VID-01: WIDGET GEOMETRY & BOUNDARY CLAMPING
    // -------------------------------------------------------------
    console.log('\n[2/8] Verifying VID-01: Widget Geometry & Viewport Clamping...');
    const vid01_1080p = await page.evaluate(() => {
      const DOCK_CLEARANCE = 72;
      const MENUBAR = 32;
      return Array.from(document.querySelectorAll('.desktop-widget')).map((el) => {
        const r = el.getBoundingClientRect();
        const okTop = r.top >= MENUBAR - 1;
        const okBottom = r.bottom <= window.innerHeight - DOCK_CLEARANCE + 1;
        const okLeft = r.left >= 8 - 1;
        const okRight = r.right <= window.innerWidth - 8 + 1;
        return {
          id: el.id,
          rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) },
          withinBounds: okTop && okBottom && okLeft && okRight,
          styleTop: el.style.top,
          styleLeft: el.style.left,
        };
      });
    });
    console.log('VID-01 (1920x1080):', JSON.stringify(vid01_1080p, null, 2));

    // Test at 1366x768 viewport
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise((r) => setTimeout(r, 600));
    const vid01_768p = await page.evaluate(() => {
      const DOCK_CLEARANCE = 72;
      const MENUBAR = 32;
      return Array.from(document.querySelectorAll('.desktop-widget')).map((el) => {
        const r = el.getBoundingClientRect();
        const okTop = r.top >= MENUBAR - 1;
        const okBottom = r.bottom <= window.innerHeight - DOCK_CLEARANCE + 1;
        const okLeft = r.left >= 8 - 1;
        const okRight = r.right <= window.innerWidth - 8 + 1;
        return {
          id: el.id,
          rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) },
          withinBounds: okTop && okBottom && okLeft && okRight,
        };
      });
    });
    console.log('VID-01 (1366x768):', JSON.stringify(vid01_768p, null, 2));

    const vid01Passed = vid01_1080p.every((w) => w.withinBounds) && vid01_768p.every((w) => w.withinBounds);
    report.tests.vid01 = { pass: vid01Passed, vid01_1080p, vid01_768p };
    console.log(`VID-01 Result: ${vid01Passed ? 'PASS' : 'FAIL'}`);

    // Restore 1920x1080
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------
    // VID-02: DESKTOP FILENAME LABELS & FOLDERFLOAT CLEARANCE
    // -------------------------------------------------------------
    console.log('\n[3/8] Verifying VID-02: Desktop Icons & FolderFloat Pills Clearance...');
    const certItem = await page.$('#desktop-item-cert-education');
    await certItem.hover();
    await new Promise((r) => setTimeout(r, 600));

    const vid02Pills = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.folder-float__item')).map((p) => {
        const r = p.getBoundingClientRect();
        return {
          text: p.innerText.trim(),
          rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        };
      });
      const projRect = document.getElementById('desktop-item-projects')?.getBoundingClientRect();
      const certRect = document.getElementById('desktop-item-cert-education')?.getBoundingClientRect();
      const ownRect = document.getElementById('desktop-item-owners-data')?.getBoundingClientRect();

      // Check overlap between any pill and adjacent desktop icons
      let overlapsIcon = false;
      pills.forEach((p) => {
        // Overlap with projects?
        if (projRect) {
          const overlapProj = !(
            p.rect.x + p.rect.width <= projRect.left ||
            p.rect.x >= projRect.right ||
            p.rect.y + p.rect.height <= projRect.top ||
            p.rect.y >= projRect.bottom
          );
          if (overlapProj) overlapsIcon = true;
        }
        // Overlap with owners-data?
        if (ownRect) {
          const overlapOwn = !(
            p.rect.x + p.rect.width <= ownRect.left ||
            p.rect.x >= ownRect.right ||
            p.rect.y + p.rect.height <= ownRect.top ||
            p.rect.y >= ownRect.bottom
          );
          if (overlapOwn) overlapsIcon = true;
        }
      });

      return {
        pillCount: pills.length,
        pills,
        certRect: { y: Math.round(certRect?.y || 0) },
        projRect: { y: Math.round(projRect?.y || 0) },
        ownRect: { y: Math.round(ownRect?.y || 0) },
        overlapsIcon,
      };
    });
    console.log('VID-02 Pills clearance:', JSON.stringify(vid02Pills, null, 2));

    // Test dragging folder icon dismisses pills
    await page.mouse.move(100, 100);
    await new Promise((r) => setTimeout(r, 400));
    const pillsClosedAfterLeave = await page.evaluate(() => {
      return document.querySelectorAll('.folder-float__item').length === 0;
    });

    const vid02Passed = vid02Pills.pillCount > 0 && !vid02Pills.overlapsIcon && pillsClosedAfterLeave;
    report.tests.vid02 = { pass: vid02Passed, vid02Pills, pillsClosedAfterLeave };
    console.log(`VID-02 Result: ${vid02Passed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // VID-03: FINDER TOOLBAR SEARCH BAR REMOVAL
    // -------------------------------------------------------------
    console.log('\n[4/8] Verifying VID-03: Finder Search Bar Removal & Layout...');
    const projIcon = await page.$('#desktop-item-projects');
    const pBox = await projIcon.boundingBox();
    await page.mouse.click(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, { count: 2 });
    await page.waitForSelector('.window-shell', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));

    const vid03Finder = await page.evaluate(() => {
      const searchInput = document.querySelector('.finder-search-input');
      const toolbar = document.querySelector('.finder-toolbar');
      const navButtons = document.getElementById('btn-finder-back');
      const viewButtons = document.getElementById('btn-view-icons');
      const addFileBtn = document.getElementById('btn-add-file');
      return {
        hasSearchInput: !!searchInput,
        toolbarDisplay: toolbar ? window.getComputedStyle(toolbar).display : null,
        toolbarJustify: toolbar ? window.getComputedStyle(toolbar).justifyContent : null,
        hasNavButtons: !!navButtons,
        hasViewButtons: !!viewButtons,
        hasAddFileBtn: !!addFileBtn,
      };
    });
    console.log('VID-03 Finder Toolbar:', vid03Finder);
    const vid03Passed = !vid03Finder.hasSearchInput && vid03Finder.hasNavButtons && vid03Finder.hasViewButtons && vid03Finder.hasAddFileBtn;
    report.tests.vid03 = { pass: vid03Passed, vid03Finder };
    console.log(`VID-03 Result: ${vid03Passed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // VID-04: FINDER FILENAME LAYOUT & TRUNCATION / TOOLTIPS
    // -------------------------------------------------------------
    console.log('\n[5/8] Verifying VID-04: Finder Filename Layout & WarmTooltip Wrapping...');
    const vid04Files = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.finder-item')).map((el) => {
        const label = el.querySelector('.item-name-label');
        const style = label ? window.getComputedStyle(label) : null;
        return {
          id: el.id,
          text: label?.textContent || '',
          wordBreak: style?.wordBreak,
          overflowWrap: style?.overflowWrap,
          maxWidth: style?.maxWidth,
          boxWidth: Math.round(el.getBoundingClientRect().width),
          hasWarmTooltipParent: !!el.querySelector('[data-warm-tooltip-trigger]') || !!label?.closest('[data-warm-tooltip-trigger]') || !!label?.parentElement?.getAttribute('data-warm-tooltip-trigger'),
        };
      });
      return items;
    });
    console.log('VID-04 File items sample:', JSON.stringify(vid04Files.slice(0, 4), null, 2));
    const vid04Passed = vid04Files.length > 0 && vid04Files.every((f) => f.wordBreak !== 'break-all' && (f.wordBreak === 'break-word' || f.overflowWrap === 'anywhere'));
    report.tests.vid04 = { pass: vid04Passed, vid04Files };
    console.log(`VID-04 Result: ${vid04Passed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // VID-05: WIDGET CONTROLS & POINTER ISOLATION
    // -------------------------------------------------------------
    console.log('\n[6/8] Verifying VID-05: Widget Controls & Pointer Isolation...');
    const vid05Controls = await page.evaluate(() => {
      const handles = Array.from(document.querySelectorAll('.widget-handle')).map((h) => {
        return {
          id: h.id,
          action: h.getAttribute('data-action'),
          tabIndex: h.tabIndex,
          ariaLabel: h.getAttribute('aria-label'),
        };
      });
      return handles;
    });
    console.log('VID-05 Widget Handles:', vid05Controls);
    const vid05Passed = vid05Controls.length >= 6 && vid05Controls.every((h) => h.tabIndex === 0 && h.ariaLabel);
    report.tests.vid05 = { pass: vid05Passed, vid05Controls };
    console.log(`VID-05 Result: ${vid05Passed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // VID-06 & VID-07: VISUAL EFFECTS & SETTINGS PERSISTENCE
    // -------------------------------------------------------------
    console.log('\n[7/8] Verifying VID-06 & VID-07: Visual Effects & Settings Persistence...');
    // Enable liquidGlass, glassmorphism, ambientGlow via PUT /api/settings
    const saveRes = await page.evaluate(async () => {
      const putRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customization: {
            effects: {
              liquidGlass: true,
              glassmorphism: true,
              ambientGlow: true,
            },
          },
        }),
      });
      return { status: putRes.status, ok: putRes.ok };
    });
    console.log('PUT /api/settings response:', saveRes);

    // Reload page to verify persistence and body classList synchronization
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.dock-container', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    const effectsState = await page.evaluate(() => {
      const bodyCls = Array.from(document.body.classList);
      const desktopCls = document.getElementById('portfolio-desktop-os')?.className || '';
      const widget = document.querySelector('.desktop-widget');
      const widgetComputed = widget ? window.getComputedStyle(widget) : null;
      return {
        bodyClassList: bodyCls,
        desktopClasses: desktopCls,
        hasLiquidGlass: bodyCls.includes('fx-liquid-glass') || desktopCls.includes('fx-liquid-glass'),
        hasGlassmorphism: bodyCls.includes('fx-glassmorphism') || desktopCls.includes('fx-glassmorphism'),
        hasAmbientGlow: bodyCls.includes('fx-ambient-glow') || desktopCls.includes('fx-ambient-glow'),
        widgetTop: widget?.style.top,
        widgetLeft: widget?.style.left,
        widgetPerspective: widgetComputed?.perspective,
      };
    });
    console.log('Effects state after reload:', effectsState);

    // Verify GET /api/settings retains other sub-properties
    const getSettings = await page.evaluate(async () => {
      const res = await fetch('/api/settings');
      return await res.json();
    });
    const effectsInApi = getSettings.settings?.customization?.effects;
    console.log('Persisted effects in API:', effectsInApi);

    const vid06Passed = effectsState.hasLiquidGlass && effectsState.hasGlassmorphism && effectsState.hasAmbientGlow;
    const vid07Passed = effectsInApi.liquidGlass === true && effectsInApi.glassmorphism === true && effectsInApi.ambientGlow === true;
    report.tests.vid06 = { pass: vid06Passed, effectsState };
    report.tests.vid07 = { pass: vid07Passed, effectsInApi };
    console.log(`VID-06 Result: ${vid06Passed ? 'PASS' : 'FAIL'}`);
    console.log(`VID-07 Result: ${vid07Passed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // VID-08: WINDOW CONTROLS & TOOLTIPS
    // -------------------------------------------------------------
    console.log('\n[8/8] Verifying VID-08: Window Traffic Light Controls...');
    // Open Finder again to test window traffic lights
    const projIcon2 = await page.$('#desktop-item-projects');
    const pBox2 = await projIcon2.boundingBox();
    await page.mouse.click(pBox2.x + pBox2.width / 2, pBox2.y + pBox2.height / 2, { count: 2 });
    await page.waitForSelector('.window-shell', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));

    const vid08Controls = await page.evaluate(() => {
      const win = document.querySelector('.window-shell');
      const closeBtn = win?.querySelector('.traffic-light-close');
      const minBtn = win?.querySelector('.traffic-light-minimize');
      const maxBtn = win?.querySelector('.traffic-light-maximize');
      return {
        windowId: win?.id,
        closeLabel: closeBtn?.getAttribute('aria-label'),
        minLabel: minBtn?.getAttribute('aria-label'),
        maxLabel: maxBtn?.getAttribute('aria-label'),
      };
    });
    console.log('VID-08 Controls:', vid08Controls);
    const vid08Passed = vid08Controls.closeLabel === 'Close' && vid08Controls.minLabel === 'Minimize' && vid08Controls.maxLabel.includes('Zoom');
    report.tests.vid08 = { pass: vid08Passed, vid08Controls };
    console.log(`VID-08 Result: ${vid08Passed ? 'PASS' : 'FAIL'}`);

    // Save final report
    fs.writeFileSync('scripts/tests/verification-results.json', JSON.stringify(report, null, 2));
    console.log('\nAll tests completed. Summary:');
    for (const [key, val] of Object.entries(report.tests)) {
      console.log(`- ${key.toUpperCase()}: ${val.pass ? 'PASSED' : 'FAILED'}`);
    }
  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
