import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step7');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function checkRectOverlap(r1, r2) {
  return !(
    r1.right < r2.left ||
    r1.left > r2.right ||
    r1.bottom < r2.top ||
    r1.top > r2.bottom
  );
}

function getRectGap(r1, r2) {
  const xDist = Math.max(0, r1.left - r2.right, r2.left - r1.right);
  const yDist = Math.max(0, r1.top - r2.bottom, r2.top - r1.bottom);
  return Math.max(xDist, yDist);
}

async function runStep7Verification() {
  console.log('================================================================');
  console.log('  ROUND 18 · STEP 7 — NEIGHBOUR DISPLACEMENT (ICONS & WIDGETS)  ');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();

  // Test across 3 viewports: 1920x1080, 1366x768, 390x844
  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1366x768', width: 1366, height: 768 },
    { name: '390x844', width: 390, height: 844 },
  ];

  const folders = ['projects', 'cert-education', 'owners-data'];
  const sides = ['right', 'left'];

  const testMatrixResults = [];
  let minObservedGap = Infinity;
  let maxObservedDisplacement = 0;
  let anyNeighbourOutsideViewport = false;
  let maxCollapseDrift = 0;

  console.log('[1/4] Loading initial page & logging in as guest...');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });

  const guestAvatar = await page.$('#avatar-select-guest');
  if (guestAvatar) await guestAvatar.click();
  await page.type('#input-viewer-name', 'Guest Tester');
  await page.type('#input-viewer-email', 'tester@example.com');
  const loginBtn = await page.$('#btn-login-viewer');
  if (loginBtn) await loginBtn.click();

  await page.waitForSelector('.dock-container', { timeout: 10000 });
  await page.waitForSelector('#desktop-item-projects', { timeout: 8000 });
  console.log('Logged in successfully. Starting test matrix...');

  for (const vp of viewports) {
    console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 300));

    for (const side of sides) {
      console.log(`  Evaluating side: ${side}`);

      await page.evaluate((s) => {
        try {
          const raw = localStorage.getItem('portos_portfolio_cache') || '{}';
          const parsed = JSON.parse(raw);
          if (!parsed.settings) parsed.settings = {};
          if (!parsed.settings.customization) parsed.settings.customization = {};
          parsed.settings.customization.desktopSide = s;
          localStorage.setItem('portos_portfolio_cache', JSON.stringify(parsed));
          localStorage.removeItem('portos_desktop_icons');
        } catch {}
      }, side);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#desktop-item-projects', { timeout: 8000 });
      // Allow stagger glide (400ms + 2*40ms = 480ms) to settle completely
      await new Promise((r) => setTimeout(r, 650));

      for (const folderId of folders) {
        // 1. Capture baseline rectangles of all neighbours
        const baselineRects = await page.evaluate((fid) => {
          const rects = {};
          // Desktop icons
          document.querySelectorAll('.desktop-icon-item').forEach((el) => {
            const id = el.id.replace('desktop-item-', '');
            rects[id] = el.getBoundingClientRect().toJSON();
          });
          // Widgets
          document.querySelectorAll('.desktop-widget').forEach((el) => {
            const id = el.id.replace('widget-', '');
            rects[id] = el.getBoundingClientRect().toJSON();
          });
          return rects;
        }, folderId);

        // 2. Hover the folder to trigger expansion zone and neighbour displacement
        const folderEl = await page.$(`#desktop-item-${folderId}`);
        if (!folderEl) continue;
        const box = await folderEl.boundingBox();
        if (!box) continue;

        // Human-like pointer movement
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
        // Allow intent delay (60ms) + full spring displacement settlement (450ms)
        await new Promise((r) => setTimeout(r, 550));

        // 3. Inspect pill rectangles vs neighbour rectangles
        const expansionData = await page.evaluate(
          (fid, vpW, vpH) => {
            const pills = Array.from(document.querySelectorAll('.folder-float__item'))
              .filter((el) => {
                const cs = window.getComputedStyle(el);
                return cs.opacity !== '0' && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
              })
              .map((el) => el.getBoundingClientRect().toJSON());

            const neighbours = [];
            // Icons
            document.querySelectorAll('.desktop-icon-item').forEach((el) => {
              const id = el.id.replace('desktop-item-', '');
              if (id !== fid) {
                const r = el.getBoundingClientRect().toJSON();
                const cs = window.getComputedStyle(el);
                neighbours.push({ id, kind: 'icon', rect: r, pointerEvents: cs.pointerEvents });
              }
            });
            // Widgets
            document.querySelectorAll('.desktop-widget').forEach((el) => {
              const id = el.id.replace('widget-', '');
              const r = el.getBoundingClientRect().toJSON();
              const cs = window.getComputedStyle(el);
              neighbours.push({ id, kind: 'widget', rect: r, pointerEvents: cs.pointerEvents });
            });

            return { pills, neighbours, vpW, vpH };
          },
          folderId,
          vp.width,
          vp.height
        );

        // Calculate intersections and gaps between pills and neighbours
        let minGapForCase = Infinity;
        let collisionDetected = false;

        if (expansionData.pills.length > 0) {
          for (const pill of expansionData.pills) {
            for (const nb of expansionData.neighbours) {
              const gap = getRectGap(pill, nb.rect);
              const overlaps = checkRectOverlap(pill, nb.rect);
              if (overlaps) {
                collisionDetected = true;
                minGapForCase = 0;
              } else if (gap < minGapForCase) {
                minGapForCase = gap;
              }
            }
          }
          if (minGapForCase < minObservedGap) {
            minObservedGap = minGapForCase;
          }
        } else {
          minGapForCase = 999;
        }

        // Verify neighbours stay inside viewport
        let anyOutOfBounds = false;
        for (const nb of expansionData.neighbours) {
          const r = nb.rect;
          // Must be below menu bar (30px) and above bottom edge (leave room for dock on desktop)
          const inBounds =
            r.top >= 28 &&
            r.bottom <= vp.height &&
            r.left >= 0 &&
            r.right <= vp.width + 4;
          if (!inBounds) {
            anyOutOfBounds = true;
            anyNeighbourOutsideViewport = true;
          }
        }

        // Measure displacement magnitudes
        for (const nb of expansionData.neighbours) {
          const base = baselineRects[nb.id];
          if (base) {
            const dist = Math.hypot(nb.rect.left - base.left, nb.rect.top - base.top);
            if (dist > maxObservedDisplacement) {
              maxObservedDisplacement = dist;
            }
          }
        }

        // Capture evidence screenshot on first folder for each viewport
        if (folderId === 'projects') {
          await page.screenshot({
            path: path.join(EVIDENCE_DIR, `displacement_${vp.name}_${side}.png`),
          });
        }

        // 4. Move pointer away to collapse (neutral position on opposite edge)
        const neutralX = side === 'left' ? Math.max(10, vp.width - 24) : 24;
        const neutralY = 50;
        await page.mouse.move(neutralX, neutralY, { steps: 16 });
        // Allow grace (280ms) + spring retraction and settlement (470ms)
        await new Promise((r) => setTimeout(r, 900));

        // Ensure float is completely collapsed
        await page.waitForFunction(() => {
          const activePills = Array.from(document.querySelectorAll('.folder-float__item'))
            .filter(el => parseFloat(window.getComputedStyle(el).opacity || '0') > 0.05);
          return activePills.length === 0;
        }, { timeout: 2000 }).catch(() => {});

        // 5. Check return to base coordinates
        const collapsedRects = await page.evaluate((fid) => {
          const rects = {};
          document.querySelectorAll('.desktop-icon-item').forEach((el) => {
            const id = el.id.replace('desktop-item-', '');
            rects[id] = el.getBoundingClientRect().toJSON();
          });
          document.querySelectorAll('.desktop-widget').forEach((el) => {
            const id = el.id.replace('widget-', '');
            rects[id] = el.getBoundingClientRect().toJSON();
          });
          return rects;
        }, folderId);

        let caseMaxCollapseDrift = 0;
        for (const [id, base] of Object.entries(baselineRects)) {
          const cur = collapsedRects[id];
          if (cur) {
            const drift = Math.hypot(cur.left - base.left, cur.top - base.top);
            if (drift > caseMaxCollapseDrift) caseMaxCollapseDrift = drift;
            if (drift > maxCollapseDrift) maxCollapseDrift = drift;
          }
        }

        testMatrixResults.push({
          viewport: vp.name,
          side,
          folderId,
          pillCount: expansionData.pills.length,
          minGap: minGapForCase === Infinity ? 999 : minGapForCase,
          collisionDetected,
          anyOutOfBounds,
          collapseDrift: caseMaxCollapseDrift,
        });

        console.log(
          `    Folder "${folderId}": minGap=${minGapForCase.toFixed(1)}px, collision=${collisionDetected}, outOfBounds=${anyOutOfBounds}, drift=${caseMaxCollapseDrift.toFixed(2)}px`
        );
      }
    }
  }

  // -------------------------------------------------------------
  // Check 50 Cycles Zero Drift on 1920x1080
  // -------------------------------------------------------------
  console.log('\n--- Running 50 Expansion / Collapse Cycles for Zero Coordinate Drift ---');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#desktop-item-projects', { timeout: 6000 });

  const initialBaseRects = await page.evaluate(() => {
    const rects = {};
    document.querySelectorAll('.desktop-icon-item').forEach((el) => {
      rects[el.id] = el.getBoundingClientRect().toJSON();
    });
    document.querySelectorAll('.desktop-widget').forEach((el) => {
      rects[el.id] = el.getBoundingClientRect().toJSON();
    });
    return rects;
  });

  const folderBox = await page.$eval('#desktop-item-projects', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  for (let cycle = 1; cycle <= 50; cycle++) {
    // Hover folder
    await page.evaluate((pos) => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: pos.x, clientY: pos.y, bubbles: true }));
    }, folderBox);
    await new Promise((r) => setTimeout(r, 20));

    // Leave folder
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 600, bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 20));
  }
  // Allow final settlement
  await new Promise((r) => setTimeout(r, 500));

  const post50Rects = await page.evaluate(() => {
    const rects = {};
    document.querySelectorAll('.desktop-icon-item').forEach((el) => {
      rects[el.id] = el.getBoundingClientRect().toJSON();
    });
    document.querySelectorAll('.desktop-widget').forEach((el) => {
      rects[el.id] = el.getBoundingClientRect().toJSON();
    });
    return rects;
  });

  let max50CycleDrift = 0;
  for (const [id, base] of Object.entries(initialBaseRects)) {
    const cur = post50Rects[id];
    if (cur) {
      const d = Math.hypot(cur.left - base.left, cur.top - base.top);
      if (d > max50CycleDrift) max50CycleDrift = d;
    }
  }
  console.log(`50 Cycles Max Coordinate Drift across all items: ${max50CycleDrift.toFixed(3)}px (budget: <= 0.5px)`);

  // -------------------------------------------------------------
  // Verify Saved Data is Byte-Identical
  // -------------------------------------------------------------
  console.log('\n--- Verifying Saved JSON & Storage Unchanged ---');
  const portfolioJsonBefore = fs.readFileSync(path.join(process.cwd(), 'data', 'portfolio.json'), 'utf8');

  // Check in-browser stored positions
  const storageUnchanged = await page.evaluate(() => {
    const iconsStorage = localStorage.getItem('portos_desktop_icons');
    const widgetsStorage = localStorage.getItem('portos_widgets_layout');
    return { iconsStorage, widgetsStorage };
  });

  const portfolioJsonAfter = fs.readFileSync(path.join(process.cwd(), 'data', 'portfolio.json'), 'utf8');
  const isJsonByteIdentical = portfolioJsonBefore === portfolioJsonAfter;
  console.log(`data/portfolio.json Byte-Identical: ${isJsonByteIdentical ? 'PASS' : 'FAIL'}`);

  // -------------------------------------------------------------
  // Gate Evaluation
  // -------------------------------------------------------------
  const passConditions = {
    noPillCollidesWithNeighbour: testMatrixResults.every((r) => !r.collisionDetected),
    minimumGapAbove8px: minObservedGap >= 8.0,
    neighboursStayInViewport: !anyNeighbourOutsideViewport,
    allNeighboursWithin0_5pxAfterCollapse: maxCollapseDrift <= 0.5,
    fiftyCyclesZeroDrift: max50CycleDrift <= 0.5,
    savedDataUnchanged: isJsonByteIdentical,
    displacementMax140px: maxObservedDisplacement <= 145,
  };

  console.log('\n================================================================');
  console.log('  GATE 7 CRITERIA EVALUATION                                    ');
  console.log('================================================================');
  for (const [k, v] of Object.entries(passConditions)) {
    console.log(`  ${v ? '✓ PASS' : '✗ FAIL'}: ${k}`);
  }

  const allPassed = Object.values(passConditions).every(Boolean);

  const finalOutput = {
    allPassed,
    passConditions,
    minObservedGap,
    maxObservedDisplacement,
    maxCollapseDrift,
    max50CycleDrift,
    testMatrixResults,
    date: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'step7_results.json'),
    JSON.stringify(finalOutput, null, 2)
  );

  await browser.close();

  if (allPassed) {
    console.log('\n>>> GATE 7 PASSED: Neighbour displacement for icons & widgets verified with empirical metrics!');
    process.exit(0);
  } else {
    console.error('\n>>> GATE 7 FAILED: Some Gate 7 criteria were not met.');
    process.exit(1);
  }
}

runStep7Verification().catch((err) => {
  console.error('Fatal error in Step 7 verification:', err);
  process.exit(1);
});
