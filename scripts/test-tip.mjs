import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import http from 'http';

async function verifyTipDetection() {
  const CHROME_PATH = 'D:/porfolio project 1/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const FRAMES_DIR = path.resolve('public/wallpaper-frames');

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

  await new Promise(r => server.listen(9003, r));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:9003/frames/ezgif-frame-001.jpg');

  // Let's inspect frames 50, 75, 100, 130, 160, 185, 210
  // And detect the bounding box of the cleared glass / hand
  const result = await page.evaluate(async (testFrames) => {
    const W = 1920;
    const H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const coords = [];
    for (const f of testFrames) {
      const name = 'ezgif-frame-' + String(f).padStart(3, '0') + '.jpg';
      const img = new Image();
      img.src = 'http://localhost:9003/frames/' + name;
      await new Promise(r => { img.onload = r; });

      ctx.drawImage(img, 0, 0, W, H);
      // Let's sample a few horizontal slices to find where the hand touches the glass
      coords.push({ frame: f, width: img.naturalWidth, height: img.naturalHeight });
    }
    return coords;
  }, [30, 60, 90, 120, 150, 180, 210, 240]);

  server.close();
  await browser.close();
  console.log('Test frames verified:', result);
}

verifyTipDetection().catch(console.error);
