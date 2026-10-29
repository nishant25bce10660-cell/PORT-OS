import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import http from 'http';

async function mapHandDelta() {
  const CHROME_PATH = 'D:/porfolio project 1/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const FRAMES_DIR = 'C:/Users/nisha/Downloads/ezgif-41ced3c0eed9c0a0-jpg';

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/frames/')) {
      const name = req.url.replace('/frames/', '');
      const filePath = path.join(FRAMES_DIR, name);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise(r => server.listen(9002, r));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:9002/frames/ezgif-frame-001.jpg');

  const deltaCoords = await page.evaluate(async () => {
    const W = 480;
    const H = 270;
    const c1 = document.createElement('canvas'); c1.width = W; c1.height = H;
    const ctx1 = c1.getContext('2d', { willReadFrequently: true });
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const ctx2 = c2.getContext('2d', { willReadFrequently: true });

    const results = [];
    let prevData = null;

    for (let f = 1; f <= 300; f++) {
      const name = 'ezgif-frame-' + String(f).padStart(3, '0') + '.jpg';
      const img = new Image();
      img.src = 'http://localhost:9002/frames/' + name;
      await new Promise(r => { img.onload = r; img.onerror = r; });

      ctx1.drawImage(img, 0, 0, W, H);
      const curData = ctx1.getImageData(0, 0, W, H);

      if (prevData) {
        let sumX = 0, sumY = 0, weightSum = 0;
        let topY = H, topX = 0;

        for (let y = 10; y < H - 10; y++) {
          for (let x = 10; x < W - 10; x++) {
            const idx = (y * W + x) * 4;
            const diff = Math.abs(curData.data[idx] - prevData.data[idx]) +
                         Math.abs(curData.data[idx+1] - prevData.data[idx+1]) +
                         Math.abs(curData.data[idx+2] - prevData.data[idx+2]);

            if (diff > 50) {
              sumX += x * diff;
              sumY += y * diff;
              weightSum += diff;
              if (y < topY) {
                topY = y;
                topX = x;
              }
            }
          }
        }

        const isMoving = weightSum > 10000;
        results.push({
          frame: f,
          isMoving,
          motionWeight: weightSum,
          handX: isMoving ? Math.round((sumX / weightSum) * (1920 / W)) : 0,
          handY: isMoving ? Math.round((sumY / weightSum) * (1080 / H)) : 0,
          fingertipX: isMoving ? Math.round(topX * (1920 / W)) : 0,
          fingertipY: isMoving ? Math.round(topY * (1080 / H)) : 0
        });
      } else {
        results.push({ frame: f, isMoving: false, handX: 0, handY: 0, fingertipX: 0, fingertipY: 0 });
      }

      prevData = curData;
    }

    return results;
  });

  server.close();
  await browser.close();

  fs.writeFileSync('report_assets/wallpaper_analysis/hand_delta_coordinates.json', JSON.stringify(deltaCoords, null, 2));
  console.log('Saved temporal hand delta coordinates.');
}

mapHandDelta().catch(console.error);
