import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function testJitter() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1366, height: 768 },
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('portos_booted', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 800));

  // Skip boot / login
  try {
    const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 1500 });
    if (skipBtn) await skipBtn.click();
  } catch {}

  const loginOverlay = await page.$('#login-modal-overlay');
  if (loginOverlay) {
    await page.waitForSelector('#tab-btn-viewer', { timeout: 3000 });
    await page.click('#tab-btn-viewer');
    await page.type('#input-viewer-name', 'Auditor');
    await page.type('#input-viewer-email', 'auditor@jitter.test');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 4000 });
  }

  // Hover projects
  const p = await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
  const pBox = await p.boundingBox();
  console.log('Projects box:', pBox);
  await page.mouse.move(pBox.x + 20, pBox.y + 20);
  await new Promise((r) => setTimeout(r, 400));

  const certTransform1 = await page.evaluate(() => {
    const el = document.getElementById('desktop-item-cert-education');
    return {
      styleTransform: el?.style.transform,
      computedTransform: window.getComputedStyle(el).transform,
      rect: el?.getBoundingClientRect(),
    };
  });
  console.log('Cert state while projects hovered:', certTransform1);

  // Click cert-education at its displayed position
  const cBox = certTransform1.rect;
  await page.mouse.move(cBox.x + 20, cBox.y + 20);
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, 50));
  // Hand tremor move 6px
  await page.mouse.move(cBox.x + 26, cBox.y + 26);
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 400));

  const certTransform2 = await page.evaluate(() => {
    const el = document.getElementById('desktop-item-cert-education');
    return {
      styleTransform: el?.style.transform,
      computedTransform: window.getComputedStyle(el).transform,
      rect: el?.getBoundingClientRect(),
      localStorage: localStorage.getItem('portos_desktop_icons'),
    };
  });
  console.log('Cert state after click with tremor:', certTransform2);

  await browser.close();
}

testJitter().catch((err) => {
  console.error(err);
  process.exit(1);
});
