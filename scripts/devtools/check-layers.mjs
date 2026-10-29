import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function check() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1366, height: 768 },
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
    await page.type('#input-viewer-email', 'auditor@layer.test');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 4000 });
  }

  const layersCheck = await page.evaluate(() => {
    const item = document.getElementById('desktop-item-projects');
    if (!item) return { found: false };
    const push = item.querySelector('.di-push');
    const drag = push?.querySelector('.di-drag');
    const zoom = drag?.querySelector('.di-zoom');
    return {
      found: true,
      hasSlot: item.classList.contains('di-slot'),
      hasPush: !!push,
      hasDrag: !!drag,
      hasZoom: !!zoom,
      slotTransform: item.style.transform,
      pushTransform: push?.style.transform,
      dragTransform: drag?.style.transform,
      zoomTransform: zoom?.style.transform,
      slotVarX: item.style.getPropertyValue('--slot-x'),
      slotVarY: item.style.getPropertyValue('--slot-y'),
      pushVarX: push?.style.getPropertyValue('--push-x'),
      pushVarY: push?.style.getPropertyValue('--push-y'),
      zoomVarScale: zoom?.style.getPropertyValue('--zoom-scale'),
    };
  });
  console.log('4-layer architecture check:', JSON.stringify(layersCheck, null, 2));
  await browser.close();
}

check().catch(console.error);
