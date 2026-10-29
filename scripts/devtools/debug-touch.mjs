import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function debugTouch() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('portos_booted', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 600));

  const skipBtn = await page.$('#btn-boot-skip');
  if (skipBtn) await skipBtn.click();

  const loginOverlay = await page.$('#login-modal-overlay');
  if (loginOverlay) {
    await page.waitForSelector('#tab-btn-viewer', { timeout: 3000 });
    await page.click('#tab-btn-viewer');
    await page.type('#input-viewer-name', 'Auditor');
    await page.type('#input-viewer-email', 'auditor@touch.test');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 4000 });
  }

  const p = await page.waitForSelector('#desktop-item-projects');
  const pBox = await p.boundingBox();
  console.log('390x844 Projects box:', pBox);

  // Check hover state before
  const state0 = await page.evaluate(() => {
    const el = document.getElementById('desktop-item-projects');
    return {
      rect: el.getBoundingClientRect(),
      hasSlot: el.classList.contains('di-slot'),
      pointerEvents: el.style.pointerEvents,
    };
  });
  console.log('Item state:', state0);

  // Hover
  await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
  await new Promise((r) => setTimeout(r, 600));

  const hasPills = await page.evaluate(() => {
    return document.querySelectorAll('.folder-float__item').length;
  });
  console.log('Pills count after hover:', hasPills);

  await browser.close();
}

debugTouch().catch(console.error);
