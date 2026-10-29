import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

async function analyze() {
  const CHROME_PATH = 'D:/porfolio project 1/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const sampleIndices = [1, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];
  const outDir = path.resolve('report_assets/wallpaper_analysis');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const cells = sampleIndices.map(i => {
    const name = 'ezgif-frame-' + String(i).padStart(3, '0') + '.jpg';
    const filePath = path.join('C:/Users/nisha/Downloads/ezgif-41ced3c0eed9c0a0-jpg', name);
    const b64 = fs.readFileSync(filePath).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${b64}`;
    return `<div class="cell"><img src="${dataUrl}"/><div class="label">Frame ${i} (${name})</div></div>`;
  }).join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { background: #111; color: #fff; font-family: sans-serif; margin: 0; padding: 20px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
      .cell { border: 1px solid #444; border-radius: 8px; overflow: hidden; background: #000; }
      img { width: 100%; display: block; }
      .label { padding: 6px; font-size: 14px; background: rgba(0,0,0,0.7); }
    </style>
  </head>
  <body>
    <h1>Reference Frames Sampling</h1>
    <div class="grid">${cells}</div>
  </body>
  </html>
  `;

  await page.setContent(html);
  await new Promise(r => setTimeout(r, 1000));
  const contactSheetPath = path.join(outDir, 'frames_contact_sheet.png');
  await page.screenshot({ path: contactSheetPath, fullPage: true });
  console.log('Saved contact sheet to', contactSheetPath);

  // Let's also save individual key frames as PNG/JPEG in report_assets so we can describe the scene in detail
  for (const idx of [1, 50, 100, 150, 200, 250, 300]) {
    const name = 'ezgif-frame-' + String(idx).padStart(3, '0') + '.jpg';
    const src = path.join('C:/Users/nisha/Downloads/ezgif-41ced3c0eed9c0a0-jpg', name);
    const dest = path.join(outDir, `key_frame_${String(idx).padStart(3, '0')}.jpg`);
    fs.copyFileSync(src, dest);
  }

  await browser.close();
}

analyze().catch(console.error);
