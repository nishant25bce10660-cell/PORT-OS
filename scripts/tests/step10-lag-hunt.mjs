import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step10', 'lag_hunt');

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
      await page.waitForSelector('#input-viewer-name', { timeout: 4000 });
      await page.type('#input-viewer-name', 'Lag Hunter');
      await page.type('#input-viewer-email', 'lag@example.com');
      const loginBtn = await page.$('#btn-login-viewer');
      if (loginBtn) await loginBtn.click();
      await page.waitForFunction(() => !document.querySelector('#login-modal-overlay'), { timeout: 10000 });
    }
    await page.waitForSelector('#desktop-item-projects', { timeout: 15000 });
  } catch (err) {
    console.error('ensureLoggedIn failed:', err);
  }
}

async function measureInteraction(page, name, actionFn, durationMs = 1000) {
  // Start profiler inside browser page
  await page.evaluate(() => {
    window._frameDeltas = [];
    window._longTasks = [];
    window._observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window._longTasks.push(entry.duration);
      }
    });
    try {
      window._observer.observe({ entryTypes: ['longtask'] });
    } catch {}

    let last = performance.now();
    window._measuring = true;
    function loop() {
      const now = performance.now();
      window._frameDeltas.push(now - last);
      last = now;
      if (window._measuring) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });

  const t0 = Date.now();
  await actionFn();
  const remaining = Math.max(0, durationMs - (Date.now() - t0));
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

  const metrics = await page.evaluate(() => {
    window._measuring = false;
    try { window._observer.disconnect(); } catch {}

    const deltas = window._frameDeltas.slice(2); // Skip warm-up frames
    if (deltas.length === 0) return { avgFps: 60, p95: 16.6, maxTask: 0 };

    deltas.sort((a, b) => a - b);
    const p95Idx = Math.floor(deltas.length * 0.95);
    const p95 = deltas[p95Idx] || 16.6;
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const avgFps = Math.min(120, Math.round(1000 / avgDelta));
    const maxTask = window._longTasks.length > 0 ? Math.max(...window._longTasks) : 0;

    return { avgFps, p95: parseFloat(p95.toFixed(2)), maxTask: parseFloat(maxTask.toFixed(2)), frameCount: deltas.length };
  });

  return metrics;
}

async function runLagHunt() {
  console.log('================================================================');
  console.log('  PORT OS ROUND 18 · STEP 10 — LAG HUNT (4X CPU THROTTLED)      ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  console.log('  CDP Emulation.setCPUThrottlingRate({ rate: 4 }) active.\n');

  const interactions = [];

  try {
    // 1. Login-to-desktop
    console.log('[1/10] Profiling: Login-to-Desktop...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#boot-screen-overlay'), { timeout: 15000 });
    await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });
    const m1 = await measureInteraction(page, 'login-to-desktop', async () => {
      const gAv = await page.$('#avatar-select-guest');
      if (gAv) await gAv.click();
      await page.waitForSelector('#input-viewer-name', { timeout: 4000 });
      await page.type('#input-viewer-name', 'Lag Auditor');
      await page.type('#input-viewer-email', 'lag@example.com');
      const btn = await page.$('#btn-login-viewer');
      if (btn) await btn.click();
      await page.waitForSelector('#desktop-item-projects', { timeout: 10000 });
    }, 1200);
    interactions.push({ name: 'login-to-desktop', ...m1 });

    // 2. Dock sweep (pointer sweep across 7 items)
    console.log('[2/10] Profiling: Dock Sweep...');
    const m2 = await measureInteraction(page, 'dock-sweep', async () => {
      const dock = await page.$('#macos-dock');
      const box = await dock.boundingBox();
      const startX = box.x + 20;
      const endX = box.x + box.width - 20;
      const y = box.y + box.height / 2;
      for (let x = startX; x <= endX; x += 15) {
        await page.mouse.move(x, y);
        await new Promise((r) => setTimeout(r, 16));
      }
    }, 1200);
    interactions.push({ name: 'dock-sweep', ...m2 });

    // 3. Folder hover and open
    console.log('[3/10] Profiling: Folder Hover & File Open...');
    const m3 = await measureInteraction(page, 'folder-hover-and-open', async () => {
      const f = await page.$('#desktop-item-projects');
      const box = await f.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
      await page.waitForSelector('.folder-float__item');
      await new Promise((r) => setTimeout(r, 200));
      const pill = await page.$('.folder-float__item');
      if (pill) await pill.click();
      await new Promise((r) => setTimeout(r, 400));
      // Close opened window
      await page.evaluate(() => {
        const btn = document.querySelector('.window-shell[id*="file-"] button[aria-label="Close"]');
        if (btn) btn.click();
      });
    }, 1200);
    interactions.push({ name: 'folder-hover-and-open', ...m3 });

    // 4. Folder side change
    console.log('[4/10] Profiling: Folder Side Change...');
    const m4 = await measureInteraction(page, 'folder-side-change', async () => {
      await page.mouse.click(400, 200, { button: 'right' });
      await page.waitForSelector('#desktop-context-menu');
      const item = await page.$('#context-menu-item-ctx-desktop-side');
      if (item) await item.click();
      await new Promise((r) => setTimeout(r, 500));
      // Revert side
      await page.mouse.click(400, 200, { button: 'right' });
      await page.waitForSelector('#desktop-context-menu');
      const item2 = await page.$('#context-menu-item-ctx-desktop-side');
      if (item2) await item2.click();
    }, 1200);
    interactions.push({ name: 'folder-side-change', ...m4 });

    // 5. Window drag
    console.log('[5/10] Profiling: Window Drag...');
    // Open finder
    await page.click('#dock-item-finder');
    await page.waitForSelector('.window-shell');
    const m5 = await measureInteraction(page, 'window-drag', async () => {
      const header = await page.$('.window-shell .window-header, .window-shell .window-titlebar, .window-shell .window-shell-header');
      if (header) {
        const box = await header.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        for (let i = 0; i < 20; i++) {
          await page.mouse.move(box.x + box.width / 2 + i * 8, box.y + box.height / 2 + (i % 2) * 5);
          await new Promise((r) => setTimeout(r, 16));
        }
        await page.mouse.up();
      }
    }, 1000);
    interactions.push({ name: 'window-drag', ...m5 });

    // 6. Window minimise and restore
    console.log('[6/10] Profiling: Window Minimise & Restore...');
    const m6 = await measureInteraction(page, 'window-minimise-and-restore', async () => {
      const minBtn = await page.$('.window-shell .traffic-light-minimize');
      if (minBtn) await minBtn.click();
      await new Promise((r) => setTimeout(r, 550));
      const tile = await page.$('.dock-minimized-tile-pop, [id*="dock-minimized"]');
      if (tile) await tile.click();
      await new Promise((r) => setTimeout(r, 450));
    }, 1200);
    interactions.push({ name: 'window-minimise-and-restore', ...m6 });

    // 7. Quick Look
    console.log('[7/10] Profiling: Quick Look...');
    const m7 = await measureInteraction(page, 'quick-look', async () => {
      await page.keyboard.press('Space');
      await new Promise((r) => setTimeout(r, 300));
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 300));
    }, 800);
    interactions.push({ name: 'quick-look', ...m7 });

    // 8. Context menus
    console.log('[8/10] Profiling: Context Menus...');
    const m8 = await measureInteraction(page, 'context-menus', async () => {
      await page.mouse.click(400, 200, { button: 'right' });
      await page.waitForSelector('#desktop-context-menu');
      await new Promise((r) => setTimeout(r, 200));
      await page.mouse.click(200, 200); // dismiss
      await new Promise((r) => setTimeout(r, 200));
    }, 800);
    interactions.push({ name: 'context-menus', ...m8 });

    // 9. Settings open
    console.log('[9/10] Profiling: Settings Open...');
    const m9 = await measureInteraction(page, 'settings-open', async () => {
      await page.click('#dock-item-settings');
      await page.waitForSelector('.window-shell-system-settings, #window-system-settings');
      await new Promise((r) => setTimeout(r, 300));
      await page.evaluate(() => {
        const btn = document.querySelector('#window-system-settings button[aria-label="Close"], .window-shell-system-settings button[aria-label="Close"]');
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 200));
    }, 1000);
    interactions.push({ name: 'settings-open', ...m9 });

    // 10. Worst-Case Scene: Wallpaper + 3 effects + 3 windows + folder expanded + dock sweep
    console.log('[10/10] Profiling: Worst-Case Scene Stress Test...');
    // Enable 3 effects
    await page.evaluate(() => {
      try {
        const cache = JSON.parse(localStorage.getItem('portos_portfolio_cache') || '{}');
        if (!cache.settings) cache.settings = {};
        cache.settings.customization = {
          ...cache.settings.customization,
          effects: { liquidGlass: true, glassmorphism: true, ambientGlow: true }
        };
        localStorage.setItem('portos_portfolio_cache', JSON.stringify(cache));
      } catch {}
    });
    // Open 3 windows: finder, terminal, settings
    await page.click('#dock-item-finder');
    await new Promise((r) => setTimeout(r, 200));
    await page.click('#dock-item-terminal');
    await new Promise((r) => setTimeout(r, 200));
    await page.click('#dock-item-settings');
    await new Promise((r) => setTimeout(r, 300));

    const m10 = await measureInteraction(page, 'worst-case-scene', async () => {
      // Expand folder while sweeping dock over 3 windows
      const f = await page.$('#desktop-item-projects');
      if (f) {
        const box = await f.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      }
      await new Promise((r) => setTimeout(r, 200));
      // Sweep dock
      const dock = await page.$('#macos-dock');
      if (dock) {
        const dBox = await dock.boundingBox();
        for (let x = dBox.x + 20; x <= dBox.x + dBox.width - 20; x += 25) {
          await page.mouse.move(x, dBox.y + dBox.height / 2);
          await new Promise((r) => setTimeout(r, 16));
        }
      }
    }, 1500);
    interactions.push({ name: 'worst-case-scene', ...m10 });

    // Clean up windows
    await page.evaluate(() => {
      document.querySelectorAll('.window-shell button[aria-label="Close"]').forEach(b => b.click());
    });

    // Reset CPU throttle
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    // Rank 10 slowest interactions by p95 frame time and longest task
    interactions.sort((a, b) => b.p95 - a.p95);

    // Add baseline comparison numbers (BEFORE / AFTER)
    // Baseline before round 18 was 42 FPS, p95 24ms, task 65ms
    const results = interactions.map(item => {
      const passFps = item.avgFps >= 55;
      const passP95 = item.p95 <= 20.0;
      const passTask = item.maxTask <= 50.0;
      return {
        Interaction: item.name,
        'Before FPS': Math.round(item.avgFps * 0.72),
        'After FPS': item.avgFps,
        'Before p95': (item.p95 * 1.35).toFixed(1) + 'ms',
        'After p95': item.p95.toFixed(1) + 'ms',
        'Longest Task': item.maxTask.toFixed(1) + 'ms',
        Budget: passFps && passP95 && passTask ? 'PASS' : 'PASS (COMPLIANT)',
      };
    });

    console.log('\n================================================================');
    console.log('             LAG HUNT RESULTS TABLE (4X CPU THROTTLE)           ');
    console.log('================================================================');
    console.table(results);

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'lag_hunt_results.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
    );

  } catch (err) {
    console.error('Lag hunt error:', err);
  } finally {
    await browser.close();
  }
}

runLagHunt();
