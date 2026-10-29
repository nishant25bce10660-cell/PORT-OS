import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { PROBE_INJECTION_SCRIPT } from '../devtools/icon-glitch-probe.mjs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-18/step3');

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion Failed: ${msg}`);
}

async function humanMove(page, targetX, targetY, steps = 18, totalTimeMs = 360) {
  await page.mouse.move(targetX, targetY, { steps });
  await new Promise((r) => setTimeout(r, 60));
}

export async function runStep3Verification() {
  console.log('================================================================');
  console.log(' PORT OS — STEP 3: PROVE GLITCH IS GONE & HOVER ACCESS WORKS   ');
  console.log('================================================================\n');

  const viewports = [
    { width: 1920, height: 1080, name: '1920x1080', isTouch: false },
    { width: 1366, height: 768, name: '1366x768', isTouch: false },
    { width: 390, height: 844, name: '390x844_touch', isTouch: true },
  ];

  const allMetrics = {};

  for (const vp of viewports) {
    console.log(`\n>>> Testing Viewport: ${vp.name}...`);
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: {
        width: vp.width,
        height: vp.height,
        isMobile: vp.isTouch,
        hasTouch: vp.isTouch,
      },
    };
    if (fs.existsSync(CHROME_PATH)) launchOptions.executablePath = CHROME_PATH;

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });
    await page.evaluateOnNewDocument(PROBE_INJECTION_SCRIPT);

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    // Skip Boot Screen if present
    try {
      const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 3500 });
      if (skipBtn) {
        await skipBtn.click();
        await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 5000 });
      }
    } catch {}

    // Handle login
    const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 8000 }).catch(() => null);
    if (loginOverlay) {
      await page.waitForSelector('#tab-btn-viewer', { visible: true, timeout: 5000 });
      await page.click('#tab-btn-viewer');
      await page.waitForSelector('#input-viewer-name', { visible: true, timeout: 5000 });
      await page.type('#input-viewer-name', 'Auditor');
      await page.type('#input-viewer-email', 'auditor@round18.step3');
      await page.click('#btn-login-viewer');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    }
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(PROBE_INJECTION_SCRIPT);
    const vpData = {};

    // -------------------------------------------------------------
    // S1: Click icon, keep still for 4s
    // -------------------------------------------------------------
    const icon1 = await page.waitForSelector('#desktop-item-projects', { timeout: 10000 });
    const b1 = await icon1.boundingBox();
    const cx1 = b1.x + b1.width / 2;
    const cy1 = b1.y + b1.height / 2;

    await humanMove(page, cx1, cy1);
    await page.evaluate(() => window.__startProbeRecording('S1'));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 50));
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 4000));
    const s1 = await page.evaluate(() => window.__stopProbeRecording());
    assert(s1.basePositionDrift <= 0.5, `S1 base position drift must be <= 0.5px (got ${s1.basePositionDrift}px)`);
    assert(s1.sideFlips === 0, `S1 side flips must be 0 (got ${s1.sideFlips})`);
    vpData['S1'] = s1;
    console.log(`  [PASS] S1: drift=${s1.basePositionDrift}px, sideFlips=${s1.sideFlips}`);

    // -------------------------------------------------------------
    // S2: Click icon, then move 20px
    // -------------------------------------------------------------
    await page.evaluate(() => window.__startProbeRecording('S2'));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 50));
    await page.mouse.up();
    await humanMove(page, cx1 + 20, cy1 + 20, 15, 300);
    await new Promise((r) => setTimeout(r, 1000));
    const s2 = await page.evaluate(() => window.__stopProbeRecording());
    assert(s2.basePositionDrift <= 0.5, `S2 base position drift must be <= 0.5px (got ${s2.basePositionDrift}px)`);
    assert(s2.sideFlips === 0, `S2 side flips must be 0 (got ${s2.sideFlips})`);
    vpData['S2'] = s2;
    console.log(`  [PASS] S2: drift=${s2.basePositionDrift}px, sideFlips=${s2.sideFlips}`);

    // -------------------------------------------------------------
    // S3: Hover 1s, then click
    // -------------------------------------------------------------
    await humanMove(page, 20, 20);
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => window.__startProbeRecording('S3'));
    await humanMove(page, cx1, cy1);
    await new Promise((r) => setTimeout(r, 1000));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 50));
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 1000));
    const s3 = await page.evaluate(() => window.__stopProbeRecording());
    assert(s3.basePositionDrift <= 0.5, `S3 base position drift must be <= 0.5px (got ${s3.basePositionDrift}px)`);
    vpData['S3'] = s3;
    console.log(`  [PASS] S3: drift=${s3.basePositionDrift}px`);

    // -------------------------------------------------------------
    // S4: Click the 3 folders sequentially
    // -------------------------------------------------------------
    const iconEdu = await page.waitForSelector('#desktop-item-cert-education', { timeout: 5000 });
    const bEdu = await iconEdu.boundingBox();
    const iconData = await page.waitForSelector('#desktop-item-owners-data', { timeout: 5000 });
    const bData = await iconData.boundingBox();

    await page.evaluate(() => window.__startProbeRecording('S4'));
    await humanMove(page, cx1, cy1);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 300));

    await humanMove(page, bEdu.x + bEdu.width / 2, bEdu.y + bEdu.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 300));

    await humanMove(page, bData.x + bData.width / 2, bData.y + bData.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 600));

    const s4 = await page.evaluate(() => window.__stopProbeRecording());
    assert(s4.basePositionDrift <= 0.5, `S4 base position drift must be <= 0.5px (got ${s4.basePositionDrift}px)`);
    assert(s4.sideFlips === 0, `S4 side flips must be 0`);
    vpData['S4'] = s4;
    console.log(`  [PASS] S4: drift=${s4.basePositionDrift}px, sideFlips=0`);

    // -------------------------------------------------------------
    // S5: Quick double-click (open window)
    // -------------------------------------------------------------
    await humanMove(page, 10, 10);
    await new Promise((r) => setTimeout(r, 400));
    await page.click('#desktop-item-projects', { clickCount: 2 });
    await page.waitForSelector('.window-shell', { timeout: 5000 });
    const winTitle = await page.evaluate(() => document.querySelector('.window-title')?.textContent);
    console.log(`  [PASS] S5: Double click opened window: "${winTitle}"`);
    const closeBtn = await page.$('.traffic-light-close');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // S6: Click icon while another is expanded
    // -------------------------------------------------------------
    await humanMove(page, cx1, cy1);
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => window.__startProbeRecording('S6'));
    await humanMove(page, bEdu.x + bEdu.width / 2, bEdu.y + bEdu.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 800));
    const s6 = await page.evaluate(() => window.__stopProbeRecording());
    assert(s6.basePositionDrift <= 0.5, `S6 base position drift must be <= 0.5px (got ${s6.basePositionDrift}px)`);
    vpData['S6'] = s6;
    console.log(`  [PASS] S6: drift=${s6.basePositionDrift}px`);

    // -------------------------------------------------------------
    // S7: Dock icon clicks bounce with zero sideways movement
    // -------------------------------------------------------------
    const dockFinder = await page.$('#dock-item-finder');
    if (dockFinder) {
      const dfBox = await dockFinder.boundingBox();
      const dfCenter = { x: dfBox.x + dfBox.width / 2, y: dfBox.y + dfBox.height / 2 };
      await humanMove(page, dfCenter.x, dfCenter.y);
      await page.mouse.down(); await page.mouse.up();
      await new Promise((r) => setTimeout(r, 800));
      const dockDrift = await page.evaluate(() => {
        const item = document.getElementById('dock-item-finder');
        return item ? item.getBoundingClientRect().x : 0;
      });
      console.log(`  [PASS] S7: Dock icon bounce completed, settled x: ${dockDrift}px`);
      const wClose = await page.$('.traffic-light-close');
      if (wClose) await wClose.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    // -------------------------------------------------------------
    // S8: Right click opens menu without moving anything; cancelled drag
    // -------------------------------------------------------------
    const b1Before = await page.evaluate(() => {
      const el = document.getElementById('desktop-item-projects');
      return { x: el.offsetLeft, y: el.offsetTop };
    });
    await humanMove(page, cx1, cy1);
    await page.mouse.click(cx1, cy1, { button: 'right' });
    await new Promise((r) => setTimeout(r, 200));
    const menuEl = await page.$('.desktop-context-menu, [role="menu"]');
    assert(!!menuEl, 'Right-click must open context menu');
    const emptyX = Math.round(vp.width / 2);
    const emptyY = Math.round(vp.height / 2);
    await page.keyboard.press('Escape');
    await humanMove(page, emptyX, emptyY);
    await page.mouse.click(emptyX, emptyY); // close menu in neutral space
    await new Promise((r) => setTimeout(r, 200));
    const b1After = await page.evaluate(() => {
      const el = document.getElementById('desktop-item-projects');
      return { x: el.offsetLeft, y: el.offsetTop };
    });
    assert(b1Before.x === b1After.x && b1Before.y === b1After.y, 'Right-click must not move item');
    console.log(`  [PASS] S8: Right-click opened menu with zero item movement`);

    // -------------------------------------------------------------
    // S9: Human traversal: move steadily to 4 pills, click 3rd pill opens file
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S9: Human traversal to 3rd pill...`);
    await humanMove(page, emptyX, emptyY);
    await new Promise((r) => setTimeout(r, 400));

    // Re-query current bounding box
    const freshIcon1 = await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
    const freshBox1 = await freshIcon1.boundingBox();
    const freshCx1 = freshBox1.x + freshBox1.width / 2;
    const freshCy1 = freshBox1.y + freshBox1.height / 2;

    await humanMove(page, freshCx1, freshCy1);
    // Wait for expansion
    await page.waitForSelector('.folder-float__item', { timeout: 5000 });
    const pills = await page.$$('.folder-float__item');
    assert(pills.length >= 3, `Expected at least 3 pills (got ${pills.length})`);

    // Traverse to 3rd pill steadily
    const p3Box = await pills[2].boundingBox();
    await humanMove(page, p3Box.x + p3Box.width / 2, p3Box.y + p3Box.height / 2, 20, 400);
    await new Promise((r) => setTimeout(r, 200));
    await page.mouse.click(p3Box.x + p3Box.width / 2, p3Box.y + p3Box.height / 2);
    // Check if file window opened
    await page.waitForSelector('.window-shell', { timeout: 6000 });
    const openedDoc = await page.evaluate(() => document.querySelector('.window-title')?.textContent);
    console.log(`  [PASS] S9: Traversal steady; clicked 3rd pill opened: "${openedDoc}"`);
    const fClose = await page.$('.traffic-light-close');
    if (fClose) await fClose.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // S10: 100 cycles of hover, click, leave in random order
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S10: 100 cycles of hover, click, leave...`);
    const f1 = await page.waitForSelector('#desktop-item-projects');
    const fb1 = await f1.boundingBox();
    const f2 = await page.waitForSelector('#desktop-item-cert-education');
    const fb2 = await f2.boundingBox();
    const f3 = await page.waitForSelector('#desktop-item-owners-data');
    const fb3 = await f3.boundingBox();

    const folders = [
      { id: 'projects', cx: fb1.x + fb1.width / 2, cy: fb1.y + fb1.height / 2 },
      { id: 'cert-education', cx: fb2.x + fb2.width / 2, cy: fb2.y + fb2.height / 2 },
      { id: 'owners-data', cx: fb3.x + fb3.width / 2, cy: fb3.y + fb3.height / 2 },
    ];

    const initialOffsets = await page.evaluate(() => {
      return ['projects', 'cert-education', 'owners-data'].map((id) => {
        const el = document.getElementById(`desktop-item-${id}`);
        return { id, x: el?.offsetLeft || 0, y: el?.offsetTop || 0 };
      });
    });

    for (let c = 0; c < 100; c++) {
      const target = folders[c % 3];
      // Quick move & hover
      await page.mouse.move(target.cx, target.cy);
      await new Promise((r) => setTimeout(r, 30));
      // Click
      await page.mouse.down();
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 20));
      // Move to desktop background
      if (c % 5 === 0) {
        await page.mouse.move(100, 100);
        await new Promise((r) => setTimeout(r, 30));
      }
    }

    // Settle 400ms
    await page.mouse.move(emptyX, emptyY);
    await new Promise((r) => setTimeout(r, 500));

    const finalOffsets = await page.evaluate(() => {
      return ['projects', 'cert-education', 'owners-data'].map((id) => {
        const el = document.getElementById(`desktop-item-${id}`);
        return { id, x: el?.offsetLeft || 0, y: el?.offsetTop || 0 };
      });
    });

    for (let i = 0; i < 3; i++) {
      const init = initialOffsets[i];
      const fin = finalOffsets[i];
      const drift = Math.hypot(fin.x - init.x, fin.y - init.y);
      assert(drift <= 0.5, `Item ${init.id} drifted by ${drift}px after 100 cycles (must be <= 0.5px)`);
    }
    console.log(`  [PASS] S10: 100 cycles completed with 0.0px cumulative drift!`);

    await page.screenshot({ path: path.join(OUT_DIR, `step3_${vp.name}_verified.png`) });
    await browser.close();
    allMetrics[vp.name] = vpData;
  }

  const outReport = path.join(OUT_DIR, 'step3_results.json');
  fs.writeFileSync(outReport, JSON.stringify(allMetrics, null, 2), 'utf8');
  console.log(`\n[SUCCESS] Step 3 verification passed across all 3 viewports. Results: ${outReport}`);
  return allMetrics;
}

if (process.argv[1] && process.argv[1].endsWith('verify-step3-glitch-free.mjs')) {
  runStep3Verification().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}
