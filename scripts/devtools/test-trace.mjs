import puppeteer from 'puppeteer';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function testTrace() {
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
  const guestBtn = await page.$('#tab-btn-viewer');
  if (guestBtn) {
    await guestBtn.click();
    await page.type('#input-viewer-name', 'Auditor');
    await page.type('#input-viewer-email', 'auditor@trace.test');
    await page.click('#btn-login-viewer');
    await new Promise((r) => setTimeout(r, 600));
  }

  // Hook events on desktop-item-projects
  await page.evaluate(() => {
    window.__evts = [];
    const el = document.getElementById('desktop-item-projects');
    ['pointerenter', 'pointerleave', 'pointerdown', 'pointerup', 'pointermove'].forEach((name) => {
      el.addEventListener(name, (e) => {
        window.__evts.push({ name, t: performance.now(), x: e.clientX, y: e.clientY });
      });
    });
  });

  const p = await page.waitForSelector('#desktop-item-projects');
  let b = await p.boundingBox();
  console.log('Initial b:', b);

  // S8: Cancel drag
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 500));

  b = await p.boundingBox();
  console.log('After S8 drag b:', b);

  // S9 move
  await page.mouse.move(20, 20);
  await new Promise((r) => setTimeout(r, 400));
  console.log('Moving to:', b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await new Promise((r) => setTimeout(r, 600));

  const evts = await page.evaluate(() => window.__evts.slice(-10));
  console.log('Recent events on projects:', evts);

  const pills = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
  console.log('Pills count:', pills);

  await browser.close();
}

testTrace().catch(console.error);
