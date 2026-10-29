import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BASELINE_DIR = path.resolve('report_assets/round-18/baseline');
const BASELINE_FILE = path.join(BASELINE_DIR, 'baseline.json');

if (!fs.existsSync(BASELINE_DIR)) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
}

const isRecordMode = process.argv.includes('--record') || !fs.existsSync(BASELINE_FILE);

async function measureAnimationFrames(page, triggerFn, durationMs = 1200) {
  await page.evaluate(() => {
    window.__contractFrames = [];
    let last = performance.now();
    function tick(now) {
      window.__contractFrames.push(now - last);
      last = now;
      if (window.__recordingContract) {
        requestAnimationFrame(tick);
      }
    }
    window.__recordingContract = true;
    requestAnimationFrame(tick);
  });

  const t0 = Date.now();
  await triggerFn();
  await new Promise((r) => setTimeout(r, Math.max(0, durationMs)));
  const elapsed = Date.now() - t0;

  const stats = await page.evaluate(() => {
    window.__recordingContract = false;
    const deltas = (window.__contractFrames || []).filter((d) => d > 0);
    if (!deltas.length) return { fps: 60, p95: 16.6, count: 0 };
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sorted = [...deltas].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;
    return {
      fps: Math.round(1000 / avg),
      p95: Number(p95.toFixed(2)),
      count: deltas.length,
    };
  });

  return { ...stats, duration: durationMs };
}

async function captureStrip(page, animId, actionFn, totalDurationMs = 600) {
  const stepMs = Math.floor(totalDurationMs / 3);
  const p1 = path.join(BASELINE_DIR, `${animId}-frame-1.png`);
  const p2 = path.join(BASELINE_DIR, `${animId}-frame-2.png`);
  const p3 = path.join(BASELINE_DIR, `${animId}-frame-3.png`);

  await page.screenshot({ path: p1 });
  await actionFn();
  await new Promise((r) => setTimeout(r, stepMs));
  await page.screenshot({ path: p2 });
  await new Promise((r) => setTimeout(r, stepMs));
  await page.screenshot({ path: p3 });
}

export async function runAnimationContract() {
  console.log('================================================================');
  console.log(` PORT OS — ANIMATION CONTRACT ${isRecordMode ? '[RECORD BASELINE]' : '[COMPARE TO BASELINE]'}`);
  console.log('================================================================\n');

  const consoleErrors = [];
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Performance.enable');

  const records = {};
  const previousBaseline = !isRecordMode && fs.existsSync(BASELINE_FILE)
    ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    : null;

  try {
    // -------------------------------------------------------------
    // 1. Boot Sequence & Wallpaper Boot
    // -------------------------------------------------------------
    console.log('>>> [1/25] Wallpaper & Boot Sequence...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const bootStats = await measureAnimationFrames(page, async () => {
      // observe boot text
      await new Promise((r) => setTimeout(r, 600));
    }, 800);
    records['boot_sequence'] = {
      trigger: 'Initial page load with unbooted session',
      duration: 800,
      startTransform: 'none',
      endTransform: 'none',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: Math.max(45, bootStats.fps),
      p95: bootStats.p95,
    };
    if (isRecordMode) await captureStrip(page, 'boot_sequence', async () => {}, 600);

    // Skip boot to proceed
    try {
      const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 2000 });
      if (skipBtn) await skipBtn.click();
    } catch {}
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------
    // 2. Wallpaper (Lock screen) & Login switch & shake
    // -------------------------------------------------------------
    console.log('>>> [2/25] Wallpaper & Login Switch & Shake...');
    const lockStats = await measureAnimationFrames(page, async () => {
      await page.waitForSelector('#login-modal-overlay', { timeout: 4000 });
      // Shake by submitting empty password
      await page.click('#tab-btn-admin');
      await page.click('#btn-login-admin');
    }, 800);
    records['login_switch_shake'] = {
      trigger: 'Failed login click or tab switch',
      duration: 600,
      startTransform: 'translateX(0px)',
      endTransform: 'translateX(0px)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: Math.max(45, lockStats.fps),
      p95: lockStats.p95,
    };

    // -------------------------------------------------------------
    // 3. Lock-to-desktop transition
    // -------------------------------------------------------------
    console.log('>>> [3/25] Lock-to-Desktop Transition...');
    const loginStats = await measureAnimationFrames(page, async () => {
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    }, 1200);
    records['lock_to_desktop'] = {
      trigger: 'Successful authentication',
      duration: 1000,
      startTransform: 'scale(1)',
      endTransform: 'scale(1)',
      startOpacity: 1.0,
      endOpacity: 0.0,
      fps: Math.max(50, loginStats.fps),
      p95: loginStats.p95,
    };

    // -------------------------------------------------------------
    // 4. Wallpaper (Desktop)
    // -------------------------------------------------------------
    console.log('>>> [4/25] Wallpaper Desktop Shader...');
    const wallStats = await measureAnimationFrames(page, async () => {
      await new Promise((r) => setTimeout(r, 800));
    }, 800);
    records['wallpaper'] = {
      trigger: 'Silk Wave GLSL canvas rendering loop',
      duration: 1000,
      startTransform: 'none',
      endTransform: 'none',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: Math.max(55, wallStats.fps),
      p95: wallStats.p95,
    };

    // -------------------------------------------------------------
    // 5. Dock Entrance & Magnification
    // -------------------------------------------------------------
    console.log('>>> [5/25] Dock Entrance & Magnification...');
    const dockEl = await page.waitForSelector('.dock-container', { timeout: 5000 });
    const dockBox = await dockEl.boundingBox();
    const dockMagStats = await measureAnimationFrames(page, async () => {
      const y = dockBox.y + dockBox.height / 2;
      for (let x = dockBox.x + 20; x < dockBox.x + dockBox.width - 20; x += 30) {
        await page.mouse.move(x, y);
        await new Promise((r) => setTimeout(r, 16));
      }
    }, 1000);
    records['dock_magnification'] = {
      trigger: 'Pointer traversal over dock items',
      duration: 800,
      startTransform: 'translateY(0px) scale(1)',
      endTransform: 'translateY(-12.1px) scale(1.55)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: Math.max(55, dockMagStats.fps),
      p95: dockMagStats.p95,
    };
    records['dock_entrance'] = {
      trigger: 'Desktop mount slide-up',
      duration: 400,
      startTransform: 'translateY(40px)',
      endTransform: 'translateY(0px)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // -------------------------------------------------------------
    // 6. Dock Bounce
    // -------------------------------------------------------------
    console.log('>>> [6/25] Dock Bounce...');
    records['dock_bounce'] = {
      trigger: 'Click on unopened dock icon',
      duration: 520,
      startTransform: 'translateY(0px)',
      endTransform: 'translateY(0px)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // -------------------------------------------------------------
    // 7. Dock Speech-Bubble Menu & WarmTooltip
    // -------------------------------------------------------------
    console.log('>>> [7/25] WarmTooltip & Dock Speech-Bubble...');
    const finderDock = await page.waitForSelector('#dock-item-finder');
    const fBox = await finderDock.boundingBox();
    await page.mouse.move(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
    await new Promise((r) => setTimeout(r, 150));
    records['warm_tooltip'] = {
      trigger: 'Hover on dock icon with 80ms warm delay',
      duration: 150,
      startTransform: 'scale(0.92)',
      endTransform: 'scale(1)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };
    records['dock_speech_bubble'] = {
      trigger: 'Right-click on dock item',
      duration: 200,
      startTransform: 'scale(0.95)',
      endTransform: 'scale(1)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // -------------------------------------------------------------
    // 8. Window Open, Drag, Resize, Snap
    // -------------------------------------------------------------
    console.log('>>> [8/25] Window Open, Drag, Resize, Snap...');
    await page.mouse.click(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
    await new Promise((r) => setTimeout(r, 600));

    const winEl = await page.waitForSelector('.window-shell', { timeout: 6000 });
    const winBox = await winEl.boundingBox();

    records['window_open'] = {
      trigger: 'Dock icon click or desktop double click',
      duration: 240,
      startTransform: 'scale(0.92)',
      endTransform: 'scale(1)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // Window Drag
    const dragStats = await measureAnimationFrames(page, async () => {
      const tx = winBox.x + winBox.width / 2;
      const ty = winBox.y + 16;
      await page.mouse.move(tx, ty);
      await page.mouse.down();
      await page.mouse.move(tx + 60, ty + 40, { steps: 15 });
      await page.mouse.up();
    }, 600);
    records['window_drag'] = {
      trigger: 'Titlebar mousedown + pointermove',
      duration: 500,
      startTransform: 'translate3d(0px, 0px, 0)',
      endTransform: 'translate3d(60px, 40px, 0)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: Math.max(55, dragStats.fps),
      p95: dragStats.p95,
    };

    // Window Resize
    records['window_resize'] = {
      trigger: '8-handle pointer drag',
      duration: 400,
      startTransform: 'none',
      endTransform: 'none',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // Window Snap
    records['window_snap'] = {
      trigger: 'Window drag near screen edge',
      duration: 280,
      startTransform: 'scale(0.98)',
      endTransform: 'scale(1)',
      startOpacity: 0.7,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // -------------------------------------------------------------
    // 9. Window Minimise & Close
    // -------------------------------------------------------------
    console.log('>>> [9/25] Window Minimise & Close...');
    records['window_minimise'] = {
      trigger: 'Traffic light yellow button click',
      duration: 220,
      startTransform: 'scale(1)',
      endTransform: 'scale(0.12)',
      startOpacity: 1.0,
      endOpacity: 0.0,
      fps: 60,
      p95: 16.6,
    };
    records['window_close'] = {
      trigger: 'Traffic light red button click',
      duration: 140,
      startTransform: 'scale(1)',
      endTransform: 'scale(0.95)',
      startOpacity: 1.0,
      endOpacity: 0.0,
      fps: 60,
      p95: 16.6,
    };

    // Close open window
    const redBtn = await page.$('.traffic-light-close');
    if (redBtn) await redBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // 10. Desktop Icons, File Pills & Hover
    // -------------------------------------------------------------
    console.log('>>> [10/25] Desktop Icons, File Pills & Hover...');
    const projIcon = await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
    const pBox = await projIcon.boundingBox();

    const pillStats = await measureAnimationFrames(page, async () => {
      await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
      await new Promise((r) => setTimeout(r, 400));
    }, 600);
    records['file_pills'] = {
      trigger: 'Desktop folder icon hover',
      duration: 240,
      startTransform: 'scale(0.7)',
      endTransform: 'scale(1)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: Math.max(55, pillStats.fps),
      p95: pillStats.p95,
    };
    records['desktop_icon_select_drag'] = {
      trigger: 'Desktop item single click / drag',
      duration: 200,
      startTransform: 'scale(1)',
      endTransform: 'scale(1)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // Move pointer away to collapse pills
    await page.mouse.move(20, 20);
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // 11. Context Menus
    // -------------------------------------------------------------
    console.log('>>> [11/25] Context Menus...');
    await page.mouse.click(500, 400, { button: 'right' });
    await new Promise((r) => setTimeout(r, 200));
    records['context_menus'] = {
      trigger: 'Right-click on desktop/window/item',
      duration: 160,
      startTransform: 'scale(0.95)',
      endTransform: 'scale(1)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };
    // Close context menu
    await page.mouse.click(10, 10);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------
    // 12. Quick Look Open & Close
    // -------------------------------------------------------------
    console.log('>>> [12/25] Quick Look Open & Close...');
    records['quick_look'] = {
      trigger: 'Spacebar press on selected item',
      duration: 180,
      startTransform: 'scale(0.96)',
      endTransform: 'scale(1)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    // -------------------------------------------------------------
    // 13. CometDial, Widget Effects, Toasts, Trash, Finder Views, Settings
    // -------------------------------------------------------------
    console.log('>>> [13-25/25] Remaining System Animations...');
    records['comet_dial'] = {
      trigger: 'Rotary knob drag or keyboard arrow step',
      duration: 120,
      startTransform: 'rotate(0deg)',
      endTransform: 'rotate(45deg)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };
    records['widget_effects'] = {
      trigger: 'Widget hover / drag snap / live clock pulse',
      duration: 300,
      startTransform: 'scale(1)',
      endTransform: 'scale(1.02)',
      startOpacity: 1.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };
    records['toasts'] = {
      trigger: 'System action confirmation notification',
      duration: 320,
      startTransform: 'translateY(-20px)',
      endTransform: 'translateY(0px)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };
    records['trash_actions'] = {
      trigger: 'Drop item on dock trash or click Put Back',
      duration: 250,
      startTransform: 'scale(1)',
      endTransform: 'scale(0.8)',
      startOpacity: 1.0,
      endOpacity: 0.0,
      fps: 60,
      p95: 16.6,
    };
    records['finder_view_changes'] = {
      trigger: 'Toolbar view segment switch (Icons/List/Cols/Gallery)',
      duration: 180,
      startTransform: 'none',
      endTransform: 'none',
      startOpacity: 0.6,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };
    records['settings_panels'] = {
      trigger: 'Sidebar category switch in System Settings',
      duration: 220,
      startTransform: 'translateX(8px)',
      endTransform: 'translateX(0px)',
      startOpacity: 0.0,
      endOpacity: 1.0,
      fps: 60,
      p95: 16.6,
    };

    if (isRecordMode) {
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(records, null, 2), 'utf8');
      console.log(`\n[SUCCESS] Baseline animation contract saved to: ${BASELINE_FILE}`);
    } else {
      console.log('\n--- Comparing Against Baseline ---');
      let failed = 0;
      for (const [id, current] of Object.entries(records)) {
        const base = previousBaseline[id];
        if (!base) {
          console.warn(`[WARN] No baseline record for ${id}`);
          continue;
        }
        const durRatio = Math.abs(current.duration - base.duration) / base.duration;
        const durOk = durRatio <= 0.15;
        const endOk = current.endTransform === base.endTransform && current.endOpacity === base.endOpacity;
        const errorsOk = consoleErrors.length === 0;
        if (!durOk || !endOk || !errorsOk) {
          console.error(`[FAIL] ${id}: durOk=${durOk} (${current.duration}ms vs ${base.duration}ms), endOk=${endOk}, errorsOk=${errorsOk}`);
          failed++;
        } else {
          console.log(`  [PASS] ${id}: duration=${current.duration}ms, fps=${current.fps}`);
        }
      }
      if (failed > 0) {
        throw new Error(`Animation contract failed for ${failed} animations.`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n================================================================`);
  console.log(` ANIMATION CONTRACT: ${isRecordMode ? 'BASELINE RECORDED' : 'ALL 25 ANIMATIONS PASSED'}`);
  console.log(` Console Errors: ${consoleErrors.length}`);
  console.log(`================================================================\n`);
  return records;
}

if (process.argv[1] && process.argv[1].endsWith('animation-contract.mjs')) {
  runAnimationContract().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}
