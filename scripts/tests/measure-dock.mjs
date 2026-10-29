import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testDock() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Handle login if present
  const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 5000 }).catch(() => null);
  if (loginOverlay) {
    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
    } else {
      await page.click('#tab-btn-viewer');
      await page.type('#input-viewer-name', 'Auditor');
      await page.click('#btn-login-viewer');
    }
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  }

  await page.waitForSelector('#macos-dock', { timeout: 8000 });

  // Measure resting dock and buttons
  const resting = await page.evaluate(() => {
    const dock = document.getElementById('macos-dock');
    const dockRect = dock.getBoundingClientRect();
    const btn = document.getElementById('dock-item-finder');
    const squircle = btn.querySelector('.dock-squircle');
    const btnRect = btn.getBoundingClientRect();
    const squircleRect = squircle.getBoundingClientRect();
    return {
      dock: { top: dockRect.top, bottom: dockRect.bottom, height: dockRect.height },
      btn: { top: btnRect.top, bottom: btnRect.bottom, height: btnRect.height },
      squircle: { top: squircleRect.top, bottom: squircleRect.bottom, height: squircleRect.height },
    };
  });
  console.log('Resting measurements:', resting);

  // Hover over Finder button center
  const finderBtn = await page.$('#dock-item-finder');
  const box = await finderBtn.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Move pointer over Finder icon to trigger magnification
  await page.mouse.move(cx, cy, { steps: 15 });
  await new Promise((r) => setTimeout(r, 200));

  const magnified = await page.evaluate(() => {
    const dock = document.getElementById('macos-dock');
    const dockRect = dock.getBoundingClientRect();
    const btn = document.getElementById('dock-item-finder');
    const squircle = btn.querySelector('.dock-squircle');
    const btnRect = btn.getBoundingClientRect();
    const squircleRect = squircle.getBoundingClientRect();
    const dot = btn.querySelector('.dock-dot');
    const dotRect = dot ? dot.getBoundingClientRect() : null;

    // Check ancestor chain
    const ancestors = [];
    let cur = btn.parentElement;
    while (cur && cur !== document.documentElement) {
      const style = window.getComputedStyle(cur);
      ancestors.push({
        tag: cur.tagName,
        id: cur.id,
        className: cur.className,
        overflow: style.overflow,
        contain: style.contain,
        clipPath: style.clipPath,
      });
      cur = cur.parentElement;
    }

    return {
      dock: { top: dockRect.top, bottom: dockRect.bottom, height: dockRect.height },
      btn: { top: btnRect.top, bottom: btnRect.bottom, height: btnRect.height, transform: btn.style.transform },
      squircle: { top: squircleRect.top, bottom: squircleRect.bottom, height: squircleRect.height },
      dot: dotRect ? { top: dotRect.top, bottom: dotRect.bottom } : null,
      ancestors,
    };
  });
  console.log('Magnified measurements:', magnified);

  const restingHeight = resting.squircle.height;
  const restingBottom = resting.squircle.bottom;
  const magTop = magnified.squircle.top;
  const magBottom = magnified.squircle.bottom;
  const dockTop = magnified.dock.top;

  const topAboveBar = dockTop - magTop;
  const topAbovePercent = (topAboveBar / restingHeight) * 100;
  const bottomDiff = Math.abs(magBottom - restingBottom);
  const barHeightDiff = Math.abs(magnified.dock.height - resting.dock.height);

  console.log('\nResults:');
  console.log(`- Resting icon height: ${restingHeight}px`);
  console.log(`- Dock top: ${dockTop}px, Magnified icon top: ${magTop}px`);
  console.log(`- Top above bar: ${topAboveBar.toFixed(2)}px (${topAbovePercent.toFixed(1)}% of resting size) [Target: >= 35%]`);
  console.log(`- Bottom drift: ${bottomDiff.toFixed(2)}px [Target: <= 2px]`);
  console.log(`- Bar height change: ${barHeightDiff.toFixed(2)}px [Target: 0px]`);
  console.log('\nAncestor chain:');
  magnified.ancestors.forEach((a) => {
    console.log(`  <${a.tag} id="${a.id}" class="${a.className}">: overflow=${a.overflow}, contain=${a.contain}, clipPath=${a.clipPath}`);
  });

  await browser.close();
}

testDock().catch(console.error);
