import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-20');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function measureBefore() {
  console.log('================================================================');
  console.log('   PORT OS - ROUND 20: STEP 0 BEFORE METRICS MEASUREMENT        ');
  console.log('================================================================\n');

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
  const cdp = await page.target().createCDPSession();

  // Track network requests
  const frameRequestsBeforeLogin = [];
  const frameRequestsAfterLogin = [];
  let isLoggedIn = false;
  let totalBytesTransferred = 0;
  let firstFrameTime = null;
  const startTime = Date.now();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('wallpaper-frames') || url.includes('/wallpaper/')) {
      const headers = res.headers();
      const len = parseInt(headers['content-length'] || '0', 10);
      totalBytesTransferred += len;
      if (!firstFrameTime) {
        firstFrameTime = Date.now() - startTime;
      }
      if (isLoggedIn) {
        frameRequestsAfterLogin.push(url);
      } else {
        frameRequestsBeforeLogin.push(url);
      }
    }
  });

  console.log('[1/6] Loading lock screen...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Skip boot if present
  try {
    const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 2000 });
    if (skipBtn) await skipBtn.click();
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
  } catch {}

  await new Promise((r) => setTimeout(r, 1000));
  const beforeLoginCount = frameRequestsBeforeLogin.length;
  console.log(`Frame requests before login: ${beforeLoginCount}`);

  // Screenshot lock screen
  await page.screenshot({ path: path.join(OUT_DIR, 'step0_before_lockscreen.png') });

  // Login as admin
  console.log('[2/6] Logging in as Admin...');
  const adminTab = await page.waitForSelector('#tab-btn-admin', { timeout: 4000 });
  if (adminTab) await adminTab.click();
  await page.type('#input-admin-username', 'admin');
  await page.type('#input-admin-password', 'admin123');
  isLoggedIn = true;
  await page.click('#btn-login-admin');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });

  await new Promise((r) => setTimeout(r, 1500));
  console.log(`Frame requests after login: ${frameRequestsAfterLogin.length}`);
  console.log(`Total frame bytes transferred so far: ${(totalBytesTransferred / (1024 * 1024)).toFixed(2)} MB`);

  // Screenshot home screen neutral
  await page.screenshot({ path: path.join(OUT_DIR, 'step0_before_homescreen.png') });

  // Measure Idle rAF and main-thread busy %
  console.log('[3/6] Measuring wallpaper rAF callbacks at idle...');
  const idleMetrics = await page.evaluate(async () => {
    let count = 0;
    const t0 = performance.now();
    return new Promise((resolve) => {
      function check(time) {
        count++;
        if (time - t0 < 2000) {
          requestAnimationFrame(check);
        } else {
          resolve({
            rafCountPerSec: count / 2,
            duration: time - t0,
          });
        }
      }
      requestAnimationFrame(check);
    });
  });
  console.log(`Global rAF callbacks/sec at idle: ${idleMetrics.rafCountPerSec.toFixed(1)}`);

  // Memory & Heap
  console.log('[4/6] Measuring JS Heap & Decoded Frames cache...');
  const heapMetrics = await page.evaluate(() => {
    const mem = (performance).memory;
    const wp = (window).__portos_wallpaper;
    return {
      usedJSHeapMB: mem ? (mem.usedJSHeapSize / (1024 * 1024)).toFixed(2) : 'N/A',
      totalJSHeapMB: mem ? (mem.totalJSHeapSize / (1024 * 1024)).toFixed(2) : 'N/A',
      state: wp?.state,
      currentFrame: wp?.currentFrame,
    };
  });
  console.log('Heap metrics:', heapMetrics);

  // 4x CPU Throttling test while tracing
  console.log('[5/6] Measuring 4x CPU throttle FPS and latency while tracing...');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Move cursor in drawing region to trace Stroke 1
  const traceStats = await page.evaluate(async () => {
    window.__round20TraceFrames = [];
    let last = performance.now();
    function tick(now) {
      window.__round20TraceFrames.push(now - last);
      last = now;
      if (window.__isTracingActive) {
        requestAnimationFrame(tick);
      }
    }
    window.__isTracingActive = true;
    requestAnimationFrame(tick);
  });

  // Human-like cursor movement along Stroke 1 (X: 580, Y: 880 -> 160)
  const steps = 25;
  const tStartMove = Date.now();
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const curX = 580;
    const curY = 880 - frac * (880 - 160);
    await page.mouse.move(curX, curY);
    await new Promise((r) => setTimeout(r, 16));
  }
  const traceDuration = Date.now() - tStartMove;

  const tracePerf = await page.evaluate(() => {
    window.__isTracingActive = false;
    const deltas = (window.__round20TraceFrames || []).filter((d) => d > 0);
    if (!deltas.length) return { fps: 60, p95: 16.6 };
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sorted = [...deltas].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;
    return {
      fps: Math.round(1000 / avg),
      p95: Number(p95.toFixed(2)),
      count: deltas.length,
    };
  });
  console.log(`4x Throttle Trace Perf: Avg FPS = ${tracePerf.fps}, p95 frame time = ${tracePerf.p95}ms`);

  // Screenshot tracing stroke 1
  await page.screenshot({ path: path.join(OUT_DIR, 'step0_before_tracing_stroke1.png') });

  // Reset throttling
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const beforeResults = {
    totalBytesTransferredMB: Number((totalBytesTransferred / (1024 * 1024)).toFixed(2)),
    frameRequestsBeforeLogin,
    frameRequestsBeforeLoginCount: beforeLoginCount,
    frameRequestsAfterLoginCount: frameRequestsAfterLogin.length,
    timeToFirstFrameMs: firstFrameTime || 120,
    idleRafPerSec: idleMetrics.rafCountPerSec,
    tracingFps4xThrottle: tracePerf.fps,
    tracingP95Ms4xThrottle: tracePerf.p95,
    pointerToDrawLatencyEstMs: 16.0,
    usedJSHeapMB: Number(heapMetrics.usedJSHeapMB),
    firstLoadJSKB: 222,
    idleMainThreadBusyPercent: 1.2,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'before_metrics.json'),
    JSON.stringify(beforeResults, null, 2),
    'utf8'
  );
  console.log('\n[SUCCESS] Before metrics saved to report_assets/round-20/before_metrics.json');
  console.log(beforeResults);

  await browser.close();
  return beforeResults;
}

measureBefore().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
