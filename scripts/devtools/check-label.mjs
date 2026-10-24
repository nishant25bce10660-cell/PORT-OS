import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe',
  headless: 'new'
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  sessionStorage.setItem('portos_booted', 'true');
});
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
const guestTab = await page.$('#tab-btn-viewer, #avatar-select-guest');
if (guestTab) await guestTab.click();
await page.waitForSelector('#input-viewer-name');
await page.type('#input-viewer-name', 'Guest');
await page.click('#btn-login-viewer');
await page.waitForSelector('.desktop-icon-label', { timeout: 6000 });
const info = await page.evaluate(() => {
  const el = document.querySelector('.desktop-icon-label');
  const s = window.getComputedStyle(el);
  return { color: s.color, bg: s.backgroundColor, text: el.innerText };
});
console.log('Label info:', info);
await browser.close();
