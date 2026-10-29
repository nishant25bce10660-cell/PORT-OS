import puppeteer from 'puppeteer';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function testDom() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.on('console', async (msg) => {
    const text = msg.text();
    console.log('PAGE LOG:', text);
    if (msg.type() === 'error') {
      for (const arg of msg.args()) {
        const val = await arg.evaluate((e) => (e instanceof Error ? { message: e.message, stack: e.stack } : String(e))).catch(() => null);
        console.log('PAGE ERROR ARG:', val);
      }
    }
  });
  page.on('pageerror', (err) => console.log('CAUGHT PAGEERROR:', err.message, err.stack));
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('portos_booted', 'true'));
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Skip boot if button exists
  const skip = await page.$('#btn-boot-skip');
  if (skip) await skip.click();

  // Login
  await page.waitForSelector('#tab-btn-viewer', { timeout: 3000 });
  await page.click('#tab-btn-viewer');
  await page.type('#input-viewer-name', 'Auditor');
  await page.type('#input-viewer-email', 'auditor@test.local');
  await page.click('#btn-login-viewer');

  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  console.log('Login overlay gone!');

  await new Promise((r) => setTimeout(r, 1000));

  const dom = await page.evaluate(() => {
    return {
      desktopWorkspace: !!document.getElementById('desktop-workspace'),
      desktopIconsContainer: !!document.querySelector('.desktop-icons-container'),
      desktopItemsCount: document.querySelectorAll('.desktop-icon-item').length,
      desktopItemsIds: Array.from(document.querySelectorAll('.desktop-icon-item')).map((el) => el.id),
    };
  });
  console.log('DOM state after login:', dom);

  await browser.close();
}

testDom().catch(console.error);
