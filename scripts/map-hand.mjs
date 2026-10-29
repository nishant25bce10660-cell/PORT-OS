import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import http from 'http';

async function mapHandCoordinates() {
  const CHROME_PATH = 'D:/porfolio project 1/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
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

  await new Promise(r => server.listen(9001, r));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:9001/frames/ezgif-frame-001.jpg');

  const coordinates = await page.evaluate(async () => {
    const W = 480;
    const H = 270;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Load base frame 1
    const baseImg = new Image();
    baseImg.src = 'http://localhost:9001/frames/ezgif-frame-001.jpg';
    await new Promise(r => { baseImg.onload = r; });
    ctx.drawImage(baseImg, 0, 0, W, H);
    const baseData = ctx.getImageData(0, 0, W, H);

    const frameCoords = [];

    // Process every single frame from 1 to 300
    for (let f = 1; f <= 300; f++) {
      const name = 'ezgif-frame-' + String(f).padStart(3, '0') + '.jpg';
      const img = new Image();
      img.src = 'http://localhost:9001/frames/' + name;
      await new Promise(r => { img.onload = r; img.onerror = r; });

      ctx.drawImage(img, 0, 0, W, H);
      const curData = ctx.getImageData(0, 0, W, H);

      // Find the hand region: where is the change most concentrated?
      // In particular, the fingertip or top edge of the hand is the drawing contact point
      let minX = W, maxX = 0, minY = H, maxY = 0;
      let totalDiff = 0;
      let topY = H;
      let topX = 0;

      // Also calculate centroid
      let sumX = 0, sumY = 0;

      for (let y = 10; y < H - 10; y++) {
        for (let x = 10; x < W - 10; x++) {
          const idx = (y * W + x) * 4;
          // check if pixel is different from base
          const dr = Math.abs(curData.data[idx] - baseData.data[idx]);
          const dg = Math.abs(curData.data[idx+1] - baseData.data[idx+1]);
          const db = Math.abs(curData.data[idx+2] - baseData.data[idx+2]);
          const diff = dr + dg + db;

          if (diff > 45) {
            totalDiff++;
            sumX += x;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            // Fingertip detection: the highest point of the hand in this frame
            // specifically for frames where hand is moving
            if (y < topY) {
              topY = y;
              topX = x;
            }
          }
        }
      }

      const hasHand = totalDiff > 200;
      const centroidX = hasHand ? (sumX / totalDiff) * (1920 / W) : 0;
      const centroidY = hasHand ? (sumY / totalDiff) * (1080 / H) : 0;
      const tipX = hasHand ? topX * (1920 / W) : 0;
      const tipY = hasHand ? topY * (1080 / H) : 0;

      frameCoords.push({
        frame: f,
        hasHand,
        totalDiff,
        centroidX: Math.round(centroidX),
        centroidY: Math.round(centroidY),
        tipX: Math.round(tipX),
        tipY: Math.round(tipY),
        bbox: hasHand ? {
          left: Math.round(minX * (1920 / W)),
          top: Math.round(minY * (1080 / H)),
          right: Math.round(maxX * (1920 / W)),
          bottom: Math.round(maxY * (1080 / H))
        } : null
      });
    }

    return frameCoords;
  });

  server.close();
  await browser.close();

  fs.writeFileSync('report_assets/wallpaper_analysis/hand_coordinates.json', JSON.stringify(coordinates, null, 2));
  console.log('Saved 300 frame hand coordinates to report_assets/wallpaper_analysis/hand_coordinates.json');
}

mapHandCoordinates().catch(console.error);
