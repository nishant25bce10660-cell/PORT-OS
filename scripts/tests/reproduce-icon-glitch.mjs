import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { PROBE_INJECTION_SCRIPT } from '../devtools/icon-glitch-probe.mjs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-18/step1');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function humanMove(page, targetX, targetY, steps = 18, totalTimeMs = 360) {
  const currentPos = await page.evaluate(() => window.__probeData?.currentPointer || { x: 0, y: 0 });
  const stepDelay = Math.floor(totalTimeMs / steps);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Ease out
    const ease = 1 - Math.pow(1 - t, 3);
    const curX = currentPos.x + (targetX - currentPos.x) * ease;
    const curY = currentPos.y + (targetY - currentPos.y) * ease;
    await page.mouse.move(curX, curY);
    await new Promise((r) => setTimeout(r, stepDelay));
  }
}

export async function runStep1Reproduction() {
  console.log('================================================================');
  console.log(' PORT OS — STEP 1: ICON CLICK GLITCH REPRODUCTION & PROBE       ');
  console.log('================================================================\n');

  const viewports = [
    { width: 1920, height: 1080, name: '1920x1080', isTouch: false },
    { width: 1366, height: 768, name: '1366x768', isTouch: false },
    { width: 390, height: 844, name: '390x844_touch', isTouch: true },
  ];

  const results = {};

  for (const vp of viewports) {
    console.log(`\n================== TESTING VIEWPORT: ${vp.name} ==================`);
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

    // Inject probe before load
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });
    await page.evaluateOnNewDocument(PROBE_INJECTION_SCRIPT);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    // Handle login if present
    const loginOverlay = await page.$('#login-modal-overlay');
    if (loginOverlay) {
      await page.waitForSelector('#tab-btn-viewer', { timeout: 3000 });
      await page.click('#tab-btn-viewer');
      await page.type('#input-viewer-name', 'Auditor');
      await page.type('#input-viewer-email', 'auditor@round18.local');
      await page.click('#btn-login-viewer');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 4000 });
    }
    await new Promise((r) => setTimeout(r, 600));

    // Ensure probe injected
    await page.evaluate(PROBE_INJECTION_SCRIPT);

    const vpResults = {};

    // -------------------------------------------------------------
    // S1: Click an icon, keep pointer still for 4s
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S1: Click icon & still for 4s...`);
    const icon1 = await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
    const box1 = await icon1.boundingBox();
    const cx1 = box1.x + box1.width / 2;
    const cy1 = box1.y + box1.height / 2;

    await humanMove(page, cx1, cy1);
    await new Promise((r) => setTimeout(r, 200));

    await page.evaluate(() => window.__startProbeRecording('S1'));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 50));
    await page.mouse.up();
    // Keep still for 4s
    await new Promise((r) => setTimeout(r, 4000));
    const s1Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S1: drift=${s1Data.basePositionDrift}px, maxAmp=${s1Data.maxTransformAmplitude}px, signChanges=${s1Data.velocitySignChanges}, hoverRate=${s1Data.hoverTransitionsPerSec}/s, sideFlips=${s1Data.sideFlips}, under=${s1Data.elementUnderPointer.join(',')}`);
    vpResults['S1'] = s1Data;
    await page.screenshot({ path: path.join(OUT_DIR, `s1_${vp.name}.png`) });

    // -------------------------------------------------------------
    // S2: Click an icon, then move pointer 20px
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S2: Click icon & move 20px...`);
    await page.evaluate(() => window.__startProbeRecording('S2'));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 50));
    await page.mouse.up();
    await humanMove(page, cx1 + 20, cy1 + 20, 15, 300);
    await new Promise((r) => setTimeout(r, 1500));
    const s2Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S2: drift=${s2Data.basePositionDrift}px, maxAmp=${s2Data.maxTransformAmplitude}px, signChanges=${s2Data.velocitySignChanges}, sideFlips=${s2Data.sideFlips}`);
    vpResults['S2'] = s2Data;
    await page.screenshot({ path: path.join(OUT_DIR, `s2_${vp.name}.png`) });

    // -------------------------------------------------------------
    // S3: Hover 1s, then click
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S3: Hover 1s then click...`);
    // Move away first
    await humanMove(page, 50, 50);
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => window.__startProbeRecording('S3'));
    await humanMove(page, cx1, cy1);
    await new Promise((r) => setTimeout(r, 1000));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 50));
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 1500));
    const s3Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S3: drift=${s3Data.basePositionDrift}px, maxAmp=${s3Data.maxTransformAmplitude}px, signChanges=${s3Data.velocitySignChanges}`);
    vpResults['S3'] = s3Data;
    await page.screenshot({ path: path.join(OUT_DIR, `s3_${vp.name}.png`) });

    // -------------------------------------------------------------
    // S4: Click the three folders one after another
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S4: Click 3 folders sequentially...`);
    const iconEdu = await page.waitForSelector('#desktop-item-cert-education', { timeout: 5000 });
    const boxEdu = await iconEdu.boundingBox();
    const iconData = await page.waitForSelector('#desktop-item-owners-data', { timeout: 5000 });
    const boxData = await iconData.boundingBox();

    await page.evaluate(() => window.__startProbeRecording('S4'));
    // Click 1
    await humanMove(page, cx1, cy1);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 400));
    // Click 2
    await humanMove(page, boxEdu.x + boxEdu.width / 2, boxEdu.y + boxEdu.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 400));
    // Click 3
    await humanMove(page, boxData.x + boxData.width / 2, boxData.y + boxData.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 800));
    const s4Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S4: drift=${s4Data.basePositionDrift}px, maxAmp=${s4Data.maxTransformAmplitude}px, signChanges=${s4Data.velocitySignChanges}, sideFlips=${s4Data.sideFlips}`);
    vpResults['S4'] = s4Data;
    await page.screenshot({ path: path.join(OUT_DIR, `s4_${vp.name}.png`) });

    // -------------------------------------------------------------
    // S5: Quick double-click (open)
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S5: Quick double-click...`);
    await humanMove(page, cx1, cy1);
    await page.evaluate(() => window.__startProbeRecording('S5'));
    await page.mouse.click(cx1, cy1, { clickCount: 2 });
    await new Promise((r) => setTimeout(r, 1000));
    const s5Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S5: drift=${s5Data.basePositionDrift}px, maxAmp=${s5Data.maxTransformAmplitude}px`);
    vpResults['S5'] = s5Data;
    // Close window if opened
    const closeBtn = await page.$('.traffic-light-close');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // S6: Click an icon while another is expanded
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S6: Click icon while another is expanded...`);
    await humanMove(page, cx1, cy1); // Expand projects
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => window.__startProbeRecording('S6'));
    // Move to and click cert-education
    await humanMove(page, boxEdu.x + boxEdu.width / 2, boxEdu.y + boxEdu.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 1200));
    const s6Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S6: drift=${s6Data.basePositionDrift}px, maxAmp=${s6Data.maxTransformAmplitude}px, signChanges=${s6Data.velocitySignChanges}`);
    vpResults['S6'] = s6Data;
    await page.screenshot({ path: path.join(OUT_DIR, `s6_${vp.name}.png`) });

    // -------------------------------------------------------------
    // S7: Click a dock icon and wait 4s; click each dock icon
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S7: Click dock icons...`);
    const dockFinder = await page.$('#dock-item-finder');
    if (dockFinder) {
      const dfBox = await dockFinder.boundingBox();
      await humanMove(page, dfBox.x + dfBox.width / 2, dfBox.y + dfBox.height / 2);
      await page.evaluate(() => window.__startProbeRecording('S7'));
      await page.mouse.down(); await page.mouse.up();
      await new Promise((r) => setTimeout(r, 2000));
      const s7Data = await page.evaluate(() => window.__stopProbeRecording());
      console.log(`  S7: drift=${s7Data.basePositionDrift}px, maxAmp=${s7Data.maxTransformAmplitude}px, signChanges=${s7Data.velocitySignChanges}`);
      vpResults['S7'] = s7Data;
      // Close window
      const winClose = await page.$('.traffic-light-close');
      if (winClose) await winClose.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    // -------------------------------------------------------------
    // S8: Press and release without moving, with right button, cancelled pointer
    // -------------------------------------------------------------
    console.log(`[${vp.name}] Running S8: Right click, drag outside cancel...`);
    await page.evaluate(() => window.__startProbeRecording('S8'));
    // Right button click
    await humanMove(page, cx1, cy1);
    await page.mouse.click(cx1, cy1, { button: 'right' });
    await new Promise((r) => setTimeout(r, 300));
    // Close context menu
    await page.mouse.click(10, 10);
    // Drag outside cancel
    await humanMove(page, cx1, cy1);
    await page.mouse.down();
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 500));
    const s8Data = await page.evaluate(() => window.__stopProbeRecording());
    console.log(`  S8: drift=${s8Data.basePositionDrift}px, maxAmp=${s8Data.maxTransformAmplitude}px`);
    vpResults['S8'] = s8Data;

    await browser.close();
    results[vp.name] = vpResults;
  }

  const reportPath = path.join(OUT_DIR, 'step1_reproduction_metrics.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n[SUCCESS] Step 1 Reproduction metrics saved to: ${reportPath}`);
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('reproduce-icon-glitch.mjs')) {
  runStep1Reproduction().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}
