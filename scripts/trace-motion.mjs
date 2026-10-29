import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

async function traceMotion() {
  const CHROME_PATH = 'D:/porfolio project 1/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Let's create an analysis page that samples frames and detects motion / hand position
  const scriptContent = `
    async function runAnalysis() {
      const results = [];
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const prevCanvas = document.createElement('canvas');
      prevCanvas.width = 960;
      prevCanvas.height = 540;
      const prevCtx = prevCanvas.getContext('2d', { willReadFrequently: true });

      let prevData = null;

      // Sample every 5th frame out of 300
      for (let i = 1; i <= 300; i += 5) {
        const name = 'ezgif-frame-' + String(i).padStart(3, '0') + '.jpg';
        const img = new Image();
        img.src = 'http://localhost:8999/frames/' + name;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => res();
        });

        if (!img.naturalWidth) continue;

        ctx.drawImage(img, 0, 0, 960, 540);
        const curData = ctx.getImageData(0, 0, 960, 540);

        if (prevData) {
          let maxDiff = 0;
          let diffSumX = 0, diffSumY = 0, diffCount = 0;
          for (let y = 0; y < 540; y += 4) {
            for (let x = 0; x < 960; x += 4) {
              const idx = (y * 960 + x) * 4;
              const dr = Math.abs(curData.data[idx] - prevData.data[idx]);
              const dg = Math.abs(curData.data[idx+1] - prevData.data[idx+1]);
              const db = Math.abs(curData.data[idx+2] - prevData.data[idx+2]);
              const diff = dr + dg + db;
              if (diff > 50) {
                diffSumX += x * diff;
                diffSumY += y * diff;
                diffCount += diff;
              }
            }
          }
          const avgX = diffCount > 0 ? (diffSumX / diffCount) * 2 : 0; // scale back to 1920
          const avgY = diffCount > 0 ? (diffSumY / diffCount) * 2 : 0; // scale back to 1080
          results.push({ frame: i, motionEnergy: diffCount, motionX: Math.round(avgX), motionY: Math.round(avgY) });
        } else {
          results.push({ frame: i, motionEnergy: 0, motionX: 0, motionY: 0 });
        }
        prevData = curData;
      }
      return results;
    }
  `;

  // Serve the frames folder via a simple local http server or express/http to avoid dataUrl overhead
  const http = await import('http');
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body><h1>Frame Analyzer</h1><script>${scriptContent}</script></body></html>`);
      return;
    }
    if (req.url.startsWith('/frames/')) {
      const frameName = req.url.replace('/frames/', '');
      const filePath = path.join('C:/Users/nisha/Downloads/ezgif-41ced3c0eed9c0a0-jpg', frameName);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise(r => server.listen(8999, r));
  console.log('Frame server on port 8999');

  await page.goto('http://localhost:8999', { waitUntil: 'domcontentloaded' });
  const motionData = await page.evaluate(async () => {
    return await runAnalysis();
  });

  server.close();

  fs.writeFileSync('report_assets/wallpaper_analysis/motion_data.json', JSON.stringify(motionData, null, 2));
  console.log('Motion data written. Frames sampled:', motionData.length);

  // Print summary of motion
  const activeFrames = motionData.filter(d => d.motionEnergy > 5000);
  console.log('Active motion frames count:', activeFrames.length);
  if (activeFrames.length > 0) {
    console.log('First 5 active frames:', activeFrames.slice(0, 5));
    console.log('Middle active frames:', activeFrames.slice(Math.floor(activeFrames.length/2), Math.floor(activeFrames.length/2) + 5));
    console.log('Last 5 active frames:', activeFrames.slice(-5));
  }

  await browser.close();
}

traceMotion().catch(console.error);
