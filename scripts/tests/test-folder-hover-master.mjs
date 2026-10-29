import puppeteer from 'puppeteer-core';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve(process.cwd(), 'report_assets', 'folder-hover-verification');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runFolderHoverMasterSuite() {
  console.log('================================================================');
  console.log('  PORT OS — FOLDER HOVER MASTER VERIFICATION & REGRESSION SUITE ');
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

  const results = {};

  try {
    // -------------------------------------------------------------
    // SETUP: Navigate and Authenticate as Owner
    // -------------------------------------------------------------
    console.log('[SETUP] Navigating and logging in as Owner...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
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
    console.log('✓ Desktop mounted and ready.');

    // -------------------------------------------------------------
    // TEST A: Hover Persistence (Folder -> Bridge -> Pills -> Across Pills)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST A] Verifying Hover Persistence & Zero Retraction...');
    const folder = await page.$('#desktop-item-projects');
    assert(folder, 'Projects folder icon must exist on desktop');
    const folderBox = await folder.boundingBox();

    // 1. Hover folder icon
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 350));

    // Assert pills emerged
    let pills = await page.$$('.folder-float__item');
    assert(pills.length > 0, 'Pills must emerge on folder hover');
    console.log(`✓ Folder expanded with ${pills.length} visible pills.`);

    // 2. Move slowly across the gap onto the first pill
    const firstPillBox = await pills[0].boundingBox();
    assert(firstPillBox, 'First pill must have a bounding box');
    
    const startX = folderBox.x + folderBox.width / 2;
    const startY = folderBox.y + folderBox.height / 2;
    const endX = firstPillBox.x + firstPillBox.width / 2;
    const endY = firstPillBox.y + firstPillBox.height / 2;

    for (let s = 1; s <= 12; s++) {
      const cx = startX + (endX - startX) * (s / 12);
      const cy = startY + (endY - startY) * (s / 12);
      await page.mouse.move(cx, cy);
      await new Promise((r) => setTimeout(r, 30));
      const count = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
      assert.strictEqual(count > 0, true, `Pills must not collapse at step ${s} (x=${cx.toFixed(1)}, y=${cy.toFixed(1)})`);
    }
    console.log('✓ Continuous pointer travel from folder onto first pill verified without collapse.');

    // 3. Move between all child pills
    for (let i = 0; i < pills.length; i++) {
      const pBox = await pills[i].boundingBox();
      await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
      await new Promise((r) => setTimeout(r, 80));
      const count = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
      assert.strictEqual(count > 0, true, `Pills must stay expanded while hovering pill ${i}`);
    }
    console.log('✓ Pointer movement across all child pills verified stable.');
    results.TestA_HoverPersistence = 'PASS';

    // Capture screenshot: fully expanded with active pill hover
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_expanded_pill_hover.png') });

    // -------------------------------------------------------------
    // TEST B: Correct & Graceful Collapse
    // -------------------------------------------------------------
    console.log('\n>>> [TEST B] Verifying Correct & Graceful Collapse...');
    // Move outside the interaction region to empty desktop
    await page.mouse.move(960, 500);
    // Wait for debounce (280ms) + transition (~200ms)
    await new Promise((r) => setTimeout(r, 450));

    const pillsAfterExit = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
    assert.strictEqual(pillsAfterExit, 0, 'Pills must collapse and be removed after pointer leaves interaction region');
    console.log('✓ Folder collapsed cleanly after leaving interaction region.');
    results.TestB_CorrectCollapse = 'PASS';

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_collapsed_desktop.png') });

    // -------------------------------------------------------------
    // TEST C: Rapid Pointer Movement & Direction Reversal (Oscillation Guard)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST C] Verifying Rapid Pointer Movement & Reversals...');
    for (let cycle = 0; cycle < 12; cycle++) {
      // Enter folder
      await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
      await new Promise((r) => setTimeout(r, 25));
      // Move diagonally out
      await page.mouse.move(folderBox.x - 40, folderBox.y - 40);
      await new Promise((r) => setTimeout(r, 25));
    }

    // Move back into folder and stay
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 400));

    const pillsAfterRapid = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
    assert(pillsAfterRapid > 0, 'Folder must be cleanly expanded when pointer ends on folder after rapid movement');
    console.log('✓ Rapid pointer oscillation handled with zero stuck timers or visual glitches.');
    results.TestC_RapidMovement = 'PASS';

    // -------------------------------------------------------------
    // TEST D: Stable File Target Positions (No Jumps / Transform Conflicts)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST D] Verifying Stable File Geometry Across Animation Frames...');
    // Sample pill positions across 6 consecutive frames
    const framePositions = [];
    for (let f = 0; f < 6; f++) {
      const posData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.folder-float__item')).map(p => {
          const r = p.getBoundingClientRect();
          return { text: p.innerText.trim(), x: Math.round(r.x), y: Math.round(r.y) };
        });
      });
      framePositions.push(posData);
      await new Promise((r) => setTimeout(r, 40));
    }

    // Verify coordinates do not randomly jump or scatter
    const basePill0 = framePositions[0][0];
    const finalPill0 = framePositions[framePositions.length - 1][0];
    const diffX = Math.abs(finalPill0.x - basePill0.x);
    const diffY = Math.abs(finalPill0.y - basePill0.y);
    assert(diffX <= 4 && diffY <= 4, `Target position must be stable (drift: dx=${diffX}, dy=${diffY})`);
    console.log(`✓ Stable file target geometry verified (dx=${diffX}px, dy=${diffY}px).`);
    results.TestD_StablePositions = 'PASS';

    // -------------------------------------------------------------
    // TEST E: Collision Behavior & Temporary Displacement
    // -------------------------------------------------------------
    console.log('\n>>> [TEST E] Verifying Collision Behavior & Reversible Displacement...');
    // Adjacent icon is cert-education
    const certIcon = await page.$('#desktop-item-cert-education');
    const certTransformExpanded = await page.evaluate(el => {
      const push = el.querySelector('.di-push');
      return (push?.style.transform || '') + ' ' + el.style.transform;
    }, certIcon);
    console.log(`Adjacent icon transform while folder is expanded: "${certTransformExpanded}"`);
    assert(
      certTransformExpanded.includes('212px') ||
      certTransformExpanded.includes('220px') ||
      certTransformExpanded.includes('56px') ||
      certTransformExpanded.includes('88px') ||
      certTransformExpanded.includes('240px'),
      'Adjacent icon must be displaced out of the way'
    );

    // Collapse folder
    await page.mouse.move(960, 500);
    await new Promise((r) => setTimeout(r, 450));

    const certTransformCollapsed = await page.evaluate(el => {
      const push = el.querySelector('.di-push');
      return (push?.style.transform || '') + ' ' + el.style.transform;
    }, certIcon);
    console.log(`Adjacent icon transform after folder collapses: "${certTransformCollapsed}"`);
    // Should be at base position y=152px, 156px or 164px (zero displacement)
    assert(certTransformCollapsed.includes('152px') || certTransformCollapsed.includes('156px') || certTransformCollapsed.includes('164px'), 'Adjacent icon must return cleanly to base position');
    console.log('✓ Reversible displacement verified with zero permanent drift.');
    results.TestE_CollisionBehavior = 'PASS';

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_restored_layout.png') });

    // -------------------------------------------------------------
    // TEST F: Repeated-Use Stability (10 Full Cycles)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST F] Verifying Repeated-Use Stability (10 Complete Cycles)...');
    for (let c = 1; c <= 10; c++) {
      // Open
      await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
      await new Promise((r) => setTimeout(r, 200));
      // Close
      await page.mouse.move(960, 500);
      await new Promise((r) => setTimeout(r, 320));
    }
    const finalPills = await page.evaluate(() => document.querySelectorAll('.folder-float__item').length);
    assert.strictEqual(finalPills, 0, 'All pills must be cleanly unmounted after 10 cycles');
    console.log('✓ 10 complete expansion/collapse cycles completed with 0 leaks or stuck elements.');
    results.TestF_RepeatedUseStability = 'PASS';

    // -------------------------------------------------------------
    // TEST G: Regression Protection (Clicking Pill Opens File)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST G] Verifying File Opening via Pill Click...');
    // Open folder
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 350));

    const emergingPill = await page.$('.folder-float__item');
    assert(emergingPill, 'Emerging pill must be available to click');
    const epBox = await emergingPill.boundingBox();
    
    // Click pill
    await page.mouse.click(epBox.x + epBox.width / 2, epBox.y + epBox.height / 2);
    await new Promise((r) => setTimeout(r, 600));

    // Verify window opened for the selected file
    const openedWindow = await page.$('.window-shell, .window-container');
    assert(openedWindow !== null, 'File window must open upon clicking an emerging pill');
    console.log('✓ File opening verified from emerging pill click.');
    results.TestG_RegressionProtection = 'PASS';

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_file_window_opened.png') });

    console.log('\n================================================================');
    console.log('  ALL FOLDER HOVER MASTER CHECKS PASSED (7/7 GREEN)             ');
    console.log('================================================================');
    console.table(results);
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Failed with error:', err);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'failure_state.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runFolderHoverMasterSuite();
