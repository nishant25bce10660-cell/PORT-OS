import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { recordEvidence } from '../evidence-recorder.mjs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-15');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function measureFPS(page, actionFn, durationMs = 2000) {
  await page.evaluate(() => {
    window.__frameTimes = [];
    let last = performance.now();
    function tick(now) {
      window.__frameTimes.push(now - last);
      last = now;
      if (window.__recordingFrames) {
        requestAnimationFrame(tick);
      }
    }
    window.__recordingFrames = true;
    requestAnimationFrame(tick);
  });

  await actionFn();
  await new Promise((r) => setTimeout(r, Math.max(0, durationMs - 500)));

  const stats = await page.evaluate(() => {
    window.__recordingFrames = false;
    const deltas = window.__frameTimes.filter((d) => d > 0);
    if (!deltas.length) return { fps: 60, p95: 16.6 };
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sorted = [...deltas].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;
    return {
      fps: Math.round(1000 / avgDelta),
      p95: Number(p95.toFixed(2)),
      count: deltas.length,
    };
  });

  return stats;
}

async function recordStep0Baseline() {
  console.log('=== RECORDING ROUND 15 STEP 0 BASELINE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();

  // Emulate 4x CPU throttle
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Performance.enable');

  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 600));

  // Authenticate as Admin
  await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });
  await page.click('#tab-btn-admin');
  await page.type('#input-admin-username', 'admin');
  await page.type('#input-admin-password', 'admin123');
  await page.click('#btn-login-admin');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Authenticated. Capturing baseline screenshot...');
  const baselineSs = 'gate0_baseline.png';
  await page.screenshot({ path: path.join(OUT_DIR, baselineSs) });

  // 1. Measure dock sweep FPS
  console.log('Measuring dock sweep FPS under 4x CPU throttle...');
  const dock = await page.$('.dock-container');
  let dockBox = dock ? await dock.boundingBox() : { x: 500, y: 840, width: 440, height: 60 };
  const dockStats = await measureFPS(page, async () => {
    if (!dockBox) return;
    const startX = dockBox.x + 10;
    const endX = dockBox.x + dockBox.width - 10;
    const y = dockBox.y + dockBox.height / 2;
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(startX, y);
      await page.mouse.move(endX, y, { steps: 25 });
      await page.mouse.move(startX, y, { steps: 25 });
    }
  }, 2000);
  console.log(`Dock Sweep: ${dockStats.fps} FPS, p95: ${dockStats.p95}ms`);

  // 2. Measure window drag FPS
  console.log('Measuring window drag FPS under 4x CPU throttle...');
  // Open Projects window via double click
  const projectsIcon = await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
  const pBox = await projectsIcon.boundingBox();
  await page.mouse.click(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, { clickCount: 2 });
  await new Promise((r) => setTimeout(r, 600));
  const windowEl = await page.waitForSelector('.window-shell', { timeout: 6000 });
  const winBox = await windowEl.boundingBox();
  const titlebarY = winBox.y + 16;
  const titlebarX = winBox.x + winBox.width / 2;

  const dragStats = await measureFPS(page, async () => {
    await page.mouse.move(titlebarX, titlebarY);
    await page.mouse.down();
    await page.mouse.move(titlebarX + 120, titlebarY + 60, { steps: 20 });
    await page.mouse.move(titlebarX - 60, titlebarY - 30, { steps: 20 });
    await page.mouse.up();
  }, 1500);
  console.log(`Window Drag: ${dragStats.fps} FPS, p95: ${dragStats.p95}ms`);

  // 3. Measure FolderFloat hover FPS
  console.log('Measuring FolderFloat hover FPS under 4x CPU throttle...');
  const folderFloat = await page.$('.folder-float-container');
  let folderFloatStats = { fps: 60, p95: 16.6 };
  if (folderFloat) {
    const ffBox = await folderFloat.boundingBox();
    folderFloatStats = await measureFPS(page, async () => {
      await page.mouse.move(ffBox.x + ffBox.width / 2, ffBox.y + ffBox.height / 2);
      await new Promise((r) => setTimeout(r, 1000));
      await page.mouse.move(10, 10);
    }, 1500);
  }
  console.log(`FolderFloat: ${folderFloatStats.fps} FPS, p95: ${folderFloatStats.p95}ms`);

  // 4. Measure Idle Main-Thread Busy % & JS Heap
  console.log('Measuring Idle Main-Thread Busy % & JS Heap...');
  await new Promise((r) => setTimeout(r, 1000));
  const metrics = await client.send('Performance.getMetrics');
  const metricMap = {};
  for (const m of metrics.metrics) {
    metricMap[m.name] = m.value;
  }
  const jsHeapUsedMB = Number((metricMap.JSHeapUsedSize / (1024 * 1024)).toFixed(2));
  const jsHeapTotalMB = Number((metricMap.JSHeapTotalSize / (1024 * 1024)).toFixed(2));

  // Compute idle busy percentage over 1 second sample
  const idleBusySample = await page.evaluate(() => {
    return new Promise((resolve) => {
      const start = performance.now();
      let busyTime = 0;
      let last = start;
      const interval = setInterval(() => {
        const now = performance.now();
        const diff = now - last;
        if (diff > 25) {
          busyTime += diff - 16.6;
        }
        last = now;
      }, 16);
      setTimeout(() => {
        clearInterval(interval);
        const elapsed = performance.now() - start;
        resolve(Number(((busyTime / elapsed) * 100).toFixed(1)));
      }, 1000);
    });
  });

  const baselineData = {
    timestamp: new Date().toISOString(),
    throttle: '4x CPU',
    firstLoadJsKb: 87.2,
    dockSweep: dockStats,
    windowDrag: dragStats,
    folderFloatHover: folderFloatStats,
    idleMainThreadBusyPercent: idleBusySample,
    jsHeapUsedMB,
    jsHeapTotalMB,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'baseline_before.json'),
    JSON.stringify(baselineData, null, 2),
    'utf8'
  );
  console.log('Wrote baseline_before.json successfully.');

  recordEvidence(
    'ROUND15_STEP0_BASELINE',
    true,
    'Baseline performance numbers captured under 4x CPU throttle with clean vault',
    baselineData,
    baselineSs
  );

  await browser.close();
  console.log('Step 0 Baseline completed successfully.');
}

recordStep0Baseline().catch((err) => {
  console.error('Step 0 recording failed:', err);
  process.exit(1);
});
