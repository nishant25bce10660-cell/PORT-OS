import puppeteer from 'puppeteer';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function checkLogin() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('portos_booted', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  const state1 = await page.evaluate(() => ({
    hasBoot: !!document.getElementById('boot-screen-overlay'),
    hasLogin: !!document.getElementById('login-modal-overlay'),
    hasSkip: !!document.getElementById('btn-boot-skip'),
  }));
  console.log('State on load:', state1);

  if (state1.hasBoot && state1.hasSkip) {
    await page.click('#btn-boot-skip');
    await new Promise((r) => setTimeout(r, 600));
  }

  const state2 = await page.evaluate(() => ({
    hasBoot: !!document.getElementById('boot-screen-overlay'),
    hasLogin: !!document.getElementById('login-modal-overlay'),
    hasViewerTab: !!document.getElementById('tab-btn-viewer'),
  }));
  console.log('State after skip:', state2);

  if (state2.hasViewerTab) {
    await page.click('#tab-btn-viewer');
    await new Promise((r) => setTimeout(r, 200));
    await page.type('#input-viewer-name', 'Auditor');
    await page.type('#input-viewer-email', 'auditor@test.local');
    await page.click('#btn-login-viewer');
    await new Promise((r) => setTimeout(r, 1500));
  }

  const state3 = await page.evaluate(() => ({
    hasLogin: !!document.getElementById('login-modal-overlay'),
    hasProjects: !!document.getElementById('desktop-item-projects'),
    hasDock: !!document.querySelector('.dock-container'),
  }));
  console.log('State after viewer login:', state3);

  await browser.close();
}

checkLogin().catch(console.error);
