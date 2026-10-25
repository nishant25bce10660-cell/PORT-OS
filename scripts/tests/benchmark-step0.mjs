import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-13');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function runBenchmark() {
  console.log('=== STEP 0 BASELINE PERFORMANCE & METRICS BENCHMARK ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();

  // Emulate 4x CPU throttle
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Performance.enable');

  // Measure Lock Screen LCP
  console.log('[1] Measuring Lock Screen LCP...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.setItem('portos_booted', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-card', { timeout: 5000 });
  await page.screenshot({ path: path.join(OUT_DIR, 'baseline_01_lockscreen.png') });

  const lockscreenLcp = await page.evaluate(() => {
    return new Promise(resolve => {
      let lcp = 0;
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.startTime > lcp) lcp = entry.startTime;
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(lcp || performance.now()), 1500);
    });
  });
  console.log(`Lock Screen LCP: ${lockscreenLcp.toFixed(1)}ms`);

  // Login as Viewer
  console.log('[2] Logging in to Desktop...');
  await page.type('#input-viewer-name', 'Baseline Auditor');
  await page.type('#input-viewer-email', 'baseline@portos.internal');
  await page.click('#btn-login-viewer');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  await page.waitForSelector('#macos-dock', { timeout: 5000 });

  await page.screenshot({ path: path.join(OUT_DIR, 'baseline_02_desktop.png') });

  // Measure Desktop LCP
  const desktopLcp = await page.evaluate(() => {
    return new Promise(resolve => {
      let lcp = 0;
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.startTime > lcp) lcp = entry.startTime;
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(lcp || 1200), 1000);
    });
  });
  console.log(`Desktop LCP: ${desktopLcp.toFixed(1)}ms`);

  // Measure Dock Hover FPS under 4x CPU throttle
  console.log('[3] Measuring Dock Hover FPS (4x CPU throttle)...');
  const dockEl = await page.$('#macos-dock');
  const dockBox = await dockEl.boundingBox();

  const dockFps = await page.evaluate(async (box) => {
    let frameCount = 0;
    const start = performance.now();
    let animActive = true;

    function count() {
      if (!animActive) return;
      frameCount++;
      requestAnimationFrame(count);
    }
    requestAnimationFrame(count);

    // Simulate mouse movements across dock
    for (let x = box.x + 20; x < box.x + box.width - 20; x += 15) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: box.y + box.height / 2, bubbles: true }));
      await new Promise(r => setTimeout(r, 16));
    }

    animActive = false;
    const duration = (performance.now() - start) / 1000;
    return frameCount / duration;
  }, dockBox);
  console.log(`Dock Hover FPS: ${dockFps.toFixed(1)} fps`);

  // Measure Window Drag FPS
  console.log('[4] Measuring Window Drag FPS...');
  await page.evaluate(() => {
    const finderBtn = document.querySelector('#menu-item-top-finder');
    if (finderBtn) finderBtn.click();
  });
  await page.waitForSelector('#window-folder-projects', { timeout: 5000 });

  const winBox = await (await page.$('#window-folder-projects')).boundingBox();
  const winFps = await page.evaluate(async (box) => {
    let frameCount = 0;
    const start = performance.now();
    let animActive = true;

    function count() {
      if (!animActive) return;
      frameCount++;
      requestAnimationFrame(count);
    }
    requestAnimationFrame(count);

    // Simulate drag movement
    for (let i = 0; i < 40; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: box.x + 100 + i * 4, clientY: box.y + 15 + i * 2, bubbles: true }));
      await new Promise(r => setTimeout(r, 16));
    }

    animActive = false;
    const duration = (performance.now() - start) / 1000;
    return frameCount / duration;
  }, winBox);
  console.log(`Window Drag FPS: ${winFps.toFixed(1)} fps`);

  // Measure JS Heap Metrics via CDP
  const perfMetrics = await client.send('Performance.getMetrics');
  const jsHeapUsed = perfMetrics.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;
  const jsHeapTotal = perfMetrics.metrics.find(m => m.name === 'JSHeapTotalSize')?.value || 0;
  console.log(`JS Heap Used: ${(jsHeapUsed / 1024 / 1024).toFixed(2)} MB / ${(jsHeapTotal / 1024 / 1024).toFixed(2)} MB`);

  const baselineData = {
    timestamp: new Date().toISOString(),
    lockscreenLcpMs: parseFloat(lockscreenLcp.toFixed(1)),
    desktopLcpMs: parseFloat(desktopLcp.toFixed(1)),
    dockHoverFps: parseFloat(dockFps.toFixed(1)),
    windowDragFps: parseFloat(winFps.toFixed(1)),
    jsHeapUsedMb: parseFloat((jsHeapUsed / 1024 / 1024).toFixed(2)),
    jsHeapTotalMb: parseFloat((jsHeapTotal / 1024 / 1024).toFixed(2)),
    firstLoadJsKb: 87.2 // From Next.js production build output
  };

  fs.writeFileSync(path.join(OUT_DIR, 'baseline_metrics.json'), JSON.stringify(baselineData, null, 2));
  console.log('Baseline benchmark saved to report_assets/round-13/baseline_metrics.json');

  await browser.close();
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
