import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(process.cwd(), 'report_assets', 'folder-hover-debug');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runReproduction() {
  console.log('================================================================');
  console.log('   REPRODUCING FOLDER HOVER BEHAVIORS & INTERACTION FLAWS      ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
    // Login as Admin
    await page.waitForSelector('#login-modal-overlay', { timeout: 8000 });
    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.waitForSelector('#input-admin-password', { visible: true });
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    }
    await page.waitForSelector('#desktop-item-projects', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));

    console.log('[SCENARIO A] Basic Expansion Stability...');
    const folder = await page.$('#desktop-item-projects');
    const folderBox = await folder.boundingBox();
    console.log(`Folder box: x=${folderBox.x}, y=${folderBox.y}, w=${folderBox.width}, h=${folderBox.height}`);

    // Hover folder
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 100));

    // Sample pill positions over 5 frames during expansion
    const positionsDuringExpansion = [];
    for (let i = 0; i < 5; i++) {
      const pos = await page.evaluate(() => {
        const pills = Array.from(document.querySelectorAll('.folder-float__item'));
        return pills.map(p => {
          const r = p.getBoundingClientRect();
          return { text: p.innerText.trim(), x: r.x, y: r.y, transform: p.style.transform };
        });
      });
      positionsDuringExpansion.push(pos);
      await new Promise((r) => setTimeout(r, 50));
    }
    console.log('Pill samples during expansion:', JSON.stringify(positionsDuringExpansion[0], null, 2));

    console.log('\n[SCENARIO B] Pointer movement from folder toward emerging file...');
    const initialPill = await page.$('.folder-float__item');
    if (initialPill) {
      const pillBox = await initialPill.boundingBox();
      console.log(`Pill box: x=${pillBox.x}, y=${pillBox.y}, w=${pillBox.width}, h=${pillBox.height}`);
      console.log(`Distance between folder center and pill center: dx=${pillBox.x + pillBox.width/2 - (folderBox.x + folderBox.width/2)}px`);
      
      // Move slowly across the gap in 10 steps
      const startX = folderBox.x + folderBox.width / 2;
      const startY = folderBox.y + folderBox.height / 2;
      const endX = pillBox.x + pillBox.width / 2;
      const endY = pillBox.y + pillBox.height / 2;

      let droppedMidway = false;
      for (let s = 1; s <= 10; s++) {
        const cx = startX + (endX - startX) * (s / 10);
        const cy = startY + (endY - startY) * (s / 10);
        await page.mouse.move(cx, cy);
        await new Promise((r) => setTimeout(r, 40));
        const count = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
        if (count === 0) {
          console.log(`! Dropped at step ${s}/10 (x=${cx.toFixed(1)}, y=${cy.toFixed(1)})`);
          droppedMidway = true;
          break;
        }
      }
      console.log(`Pointer travel across gap dropped: ${droppedMidway}`);
    }

    console.log('\n[SCENARIO D] Rapid pointer movement & oscillation check...');
    let toggleCount = 0;
    for (let r = 0; r < 10; r++) {
      await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
      await new Promise((res) => setTimeout(res, 30));
      await page.mouse.move(folderBox.x - 50, folderBox.y - 50);
      await new Promise((res) => setTimeout(res, 30));
    }
    const finalState = await page.evaluate(() => {
      const pills = document.querySelectorAll('.folder-float__item').length;
      return { pillsVisible: pills > 0 };
    });
    console.log('Final state after rapid movement:', finalState);

    console.log('\n[SCENARIO E] Nearby items displacement...');
    const certItem = await page.$('#desktop-item-cert-education, #desktop-item-certifications');
    if (certItem) {
      const transform = await page.evaluate(el => el.style.transform, certItem);
      console.log(`Nearby item transform: "${transform}"`);
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'reproduction_state.png') });
    console.log('\nReproduction run completed successfully.');
  } catch (err) {
    console.error('Reproduction error:', err);
  } finally {
    await browser.close();
  }
}

runReproduction();
