import puppeteer from 'puppeteer';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-modal-overlay');
  const guestTab = await page.$('#tab-btn-viewer, #avatar-select-guest');
  if (guestTab) await guestTab.click();
  await page.type('#input-viewer-name', 'Guest Reviewer');
  await page.type('#input-viewer-email', 'guest@example.com');
  await page.click('#btn-login-viewer');
  await page.waitForSelector('#portfolio-menubar');

  console.log('Initial total elements:', await page.evaluate(() => document.querySelectorAll('*').length));

  // Open finder
  await page.click('#menu-item-top-finder');
  await page.waitForSelector('#window-folder-projects');
  console.log('After open finder:', await page.evaluate(() => document.querySelectorAll('*').length));

  // Close finder
  const closeBtn = await page.$('#btn-close-folder-projects');
  console.log('Found closeBtn:', !!closeBtn);
  if (closeBtn) {
    await closeBtn.click();
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('After close finder:', await page.evaluate(() => document.querySelectorAll('*').length));

  // Check if window is still in DOM
  const win = await page.$('#window-folder-projects');
  console.log('Is window-folder-projects still in DOM?', !!win);

  // Check context menu open & close
  await page.mouse.click(500, 400, { button: 'right' });
  console.log('After right click:', await page.evaluate(() => document.querySelectorAll('*').length));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 100));
  console.log('After escape:', await page.evaluate(() => document.querySelectorAll('*').length));

  await browser.close();
}

main().catch(console.error);
