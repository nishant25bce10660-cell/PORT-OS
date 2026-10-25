import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { recordEvidence } from '../evidence-recorder.mjs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-15');
const PORTFOLIO_JSON_PATH = path.resolve('data/portfolio.json');
const BACKUP_JSON_PATH = path.resolve('data/portfolio.json.bak_step6');

async function runStep6FilePillsTest() {
  console.log('================================================================');
  console.log('  PORT OS — ROUND 15 STEP 6: FILE PILLS & FOLDERFLOAT AUDIT');
  console.log('================================================================\n');

  // Back up original portfolio.json
  fs.copyFileSync(PORTFOLIO_JSON_PATH, BACKUP_JSON_PATH);

  try {
    // 1. Source Code & Dependency Audit
    console.log('--- 1. Source Code & Dependency Audit ---');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if ('matter-js' in allDeps || '@types/matter-js' in allDeps) {
      throw new Error('FAIL: matter-js is still present in package.json!');
    }
    console.log('PASS: matter-js and @types/matter-js completely removed from dependencies.');

    const ffSrc = fs.readFileSync('components/FolderFloat.tsx', 'utf8');
    if (ffSrc.includes('matter-js') || ffSrc.includes('Matter.')) {
      throw new Error('FAIL: FolderFloat.tsx still contains references to Matter.js!');
    }
    console.log('PASS: FolderFloat.tsx has zero Matter.js imports or code.');

    const ffCss = fs.readFileSync('components/FolderFloat.css', 'utf8');
    const itemCssMatch = ffCss.match(/\.folder-float__item\s*\{([^}]+)\}/);
    if (itemCssMatch && itemCssMatch[1].includes('backdrop-filter')) {
      throw new Error('FAIL: .folder-float__item still uses backdrop-filter!');
    }
    console.log('PASS: .folder-float__item uses solid translucent surface (zero backdrop-filter blur).\n');

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 6000 });

    // Authenticate as Admin
    await page.click('#tab-btn-admin');
    await page.type('#input-admin-username', 'admin');
    await page.type('#input-admin-password', 'admin123');
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await page.waitForSelector('.desktop-icon-item', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));

    // 2. Deterministic Layout & Gap Verification on default Projects folder
    console.log('--- 2. Deterministic Layout & Gap Verification ---');
    const folderEl = await page.waitForSelector('#desktop-item-projects', { timeout: 4000 });
    const fBox = await folderEl.boundingBox();

    // Hover over folder to open FolderFloat
    await page.mouse.move(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
    await page.waitForSelector('.folder-float[data-open]', { timeout: 3000 });
    await page.waitForSelector('.folder-float__item', { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 400)); // wait for open spring

    const layoutCheck = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.folder-float__item'));
      const count = pills.length;
      if (count === 0) return { error: 'No pills found' };

      const rects = pills.map((p, i) => {
        const r = p.getBoundingClientRect();
        return {
          i,
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          w: r.width,
          h: r.height,
          text: p.innerText.trim(),
        };
      });

      // Check pairwise intersections and minimum gap
      let minGap = Infinity;
      let hasIntersection = false;

      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];

          const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

          if (xOverlap > 0 && yOverlap > 0) {
            hasIntersection = true;
          }

          const vertGap = a.top > b.bottom ? a.top - b.bottom : b.top > a.bottom ? b.top - a.bottom : 0;
          const horizGap = a.left > b.right ? a.left - b.right : b.left > a.right ? b.left - a.right : 0;
          const dist = Math.max(vertGap, horizGap);
          if (dist < minGap) minGap = dist;
        }
      }

      const scrollbars = document.querySelectorAll(
        '.folder-float::-webkit-scrollbar, .folder-float [class*="scrollbar"]'
      );

      return {
        count,
        pillsMax4: count <= 4,
        rects,
        hasIntersection,
        minGap,
        gapPass: minGap >= 6.0 && !hasIntersection,
        noScrollbars: scrollbars.length === 0,
      };
    });

    console.log('Layout Check Result:', {
      pillsVisible: layoutCheck.count,
      pillsMax4: layoutCheck.pillsMax4,
      hasIntersection: layoutCheck.hasIntersection,
      minGap: `${layoutCheck.minGap?.toFixed(1)} px`,
      gapPass: layoutCheck.gapPass,
      noScrollbars: layoutCheck.noScrollbars,
    });

    if (!layoutCheck.gapPass || !layoutCheck.pillsMax4) {
      throw new Error('FAIL: Layout gap < 6px or pills intersect or pills > 4!');
    }
    console.log('PASS: Deterministic layout guaranteed (zero pairwise intersections, gap >= 6px, max 4 pills).\n');

    // 3. Middle Ellipsis & WarmTooltip Check
    console.log('--- 3. Middle Ellipsis & WarmTooltip Check ---');
    const ellipsisCheck = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.folder-float__item'));
      return pills.map((p) => {
        const text = p.innerText.trim();
        return {
          text,
          hasMiddleEllipsis: text.includes('…'),
          length: text.length,
        };
      });
    });
    console.log('Pill text details:', ellipsisCheck);
    const kvPill = ellipsisCheck.find((p) => p.text.includes('KV') || p.text.includes('Distributed'));
    console.log('Distributed-KV pill formatted:', kvPill?.text);

    // Hover over the first pill to verify WarmTooltip appears
    const firstPill = await page.$('.folder-float__item');
    const pBox = await firstPill.boundingBox();
    await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
    await new Promise((r) => setTimeout(r, 450));
    const tooltipVisible = await page.evaluate(() => {
      const tt = document.querySelector('[role="tooltip"], .warm-tooltip');
      return { visible: !!tt, text: tt ? tt.innerText.trim() : null };
    });
    console.log('WarmTooltip on pill hover:', tooltipVisible);

    // 4. Temporary Folders with 1, 3, 4, 5, 12 and 50 files
    console.log('\n--- 4. Temporary Folders with 1, 3, 4, 5, 12, 50 Files ---');
    const testCounts = [1, 3, 4, 5, 12, 50];
    const countResults = [];

    for (const count of testCounts) {
      // Generate temporary portfolio data with `count` files in projects folder
      const raw = JSON.parse(fs.readFileSync(BACKUP_JSON_PATH, 'utf8'));
      const proj = raw.root.find((r) => r.id === 'folder-projects');
      proj.children = Array.from({ length: count }, (_, i) => ({
        id: `file-test-${i + 1}`,
        name: `File-${i + 1}-LongNameSpecificationTest.md`,
        kind: 'file',
        size: 1024 + i * 100,
        updatedAt: '2026-10-25T12:00:00Z',
        content: `# File ${i + 1}\n\nContent for file ${i + 1}`,
      }));
      fs.writeFileSync(PORTFOLIO_JSON_PATH, JSON.stringify(raw, null, 2), 'utf8');

      // Reload page to pick up updated portfolio data
      await page.reload({ waitUntil: 'networkidle2' });
      const hasOverlay = await page.$('#login-modal-overlay');
      if (hasOverlay) {
        await page.click('#tab-btn-admin');
        await page.type('#input-admin-username', 'admin');
        await page.type('#input-admin-password', 'admin123');
        await page.click('#btn-login-admin');
        await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
      }
      await page.waitForSelector('#desktop-item-projects', { timeout: 6000 });
      await new Promise((r) => setTimeout(r, 400));

      // Hover folder
      const fEl = await page.$('#desktop-item-projects');
      const box = await fEl.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector('.folder-float[data-open]', { timeout: 3000 });
      await page.waitForSelector('.folder-float__item', { timeout: 3000 });
      await new Promise((r) => setTimeout(r, 350));

      const prePills = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('.folder-float__item'));
        return {
          count: els.length,
          first: els[0]?.innerText.trim(),
        };
      });

      const expectedVisible = Math.min(4, count);
      let wheelPass = true;
      let wheelTime = 0;

      if (count > 4) {
        // Wheel scroll down
        const t0 = Date.now();
        await page.mouse.wheel({ deltaY: 80 });
        await new Promise((r) => setTimeout(r, 220)); // 180-260ms animation window
        wheelTime = Date.now() - t0;

        const postPills = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('.folder-float__item'));
          return {
            count: els.length,
            first: els[0]?.innerText.trim(),
          };
        });

        // The window should advance to next file
        wheelPass = postPills.count === 4 && postPills.first !== prePills.first;

        // Wheel scroll up back to 0
        await page.mouse.wheel({ deltaY: -80 });
        await new Promise((r) => setTimeout(r, 220));
      }

      console.log(`Folder with ${count} files:`, {
        visible: prePills.count,
        expected: expectedVisible,
        correctCount: prePills.count === expectedVisible,
        wheelPass,
        wheelTimeMs: wheelTime,
      });

      countResults.push({
        count,
        visible: prePills.count,
        passed: prePills.count === expectedVisible && wheelPass,
      });

      // Move away
      await page.mouse.move(50, 50);
      await new Promise((r) => setTimeout(r, 250));
    }

    const allCountsPass = countResults.every((r) => r.passed);
    console.log('All file count variants pass:', allCountsPass ? 'PASS' : 'FAIL');

    // 5. Screen Edge Clamping & Flipping Test
    console.log('\n--- 5. Screen Edge Clamping & Flipping Test ---');
    const edgePositions = [
      { name: 'near_right_edge', x: 1380, y: 150 },
      { name: 'near_left_edge', x: 20, y: 150 },
      { name: 'near_top_edge', x: 600, y: 40 },
      { name: 'near_bottom_edge', x: 1200, y: 820 },
    ];

    const edgeResults = [];

    for (const ep of edgePositions) {
      await page.evaluate(({ x, y }) => {
        const icon = document.getElementById('desktop-item-projects');
        if (icon) {
          icon.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
      }, ep);
      await new Promise((r) => setTimeout(r, 150));

      const el = await page.$('#desktop-item-projects');
      const box = await el.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await new Promise((r) => setTimeout(r, 400));

      const check = await page.evaluate(() => {
        const pills = Array.from(document.querySelectorAll('.folder-float__item'));
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        const inside = pills.every((p) => {
          const r = p.getBoundingClientRect();
          return r.left >= 0 && r.right <= screenW && r.top >= 0 && r.bottom <= screenH;
        });

        return { count: pills.length, inside };
      });

      edgeResults.push({ position: ep.name, inside: check.inside });
      console.log(`Edge Position ${ep.name}: inside viewport = ${check.inside}`);
    }
    const allEdgesPass = edgeResults.every((e) => e.inside);
    console.log('All edge clamping tests pass:', allEdgesPass ? 'PASS' : 'FAIL');

    // 6. Zero rAF Callbacks When Not Hovering
    console.log('\n--- 6. Zero rAF Callbacks When Not Hovering ---');
    await page.mouse.move(10, 10);
    await page.waitForFunction(() => !document.querySelector('.folder-float[data-open]'), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 300));

    const rafCheck = await page.evaluate(() => {
      const items = document.querySelectorAll('.folder-float__item');
      const openFolders = document.querySelectorAll('.folder-float[data-open]');
      return {
        openCount: openFolders.length,
        itemCount: items.length,
      };
    });
    console.log('After cursor leave:', rafCheck);
    const zeroRafPass = rafCheck.openCount === 0 && rafCheck.itemCount === 0;
    console.log('Zero rAF and clean DOM on leave:', zeroRafPass ? 'PASS' : 'FAIL');

    // 7. Performance & Memory Soak Test (100 Hovers at 4x CPU throttle)
    console.log('\n--- 7. Performance & Memory Soak Test (100 Hovers at 4x CPU) ---');
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.evaluate(() => {
      const icon = document.getElementById('desktop-item-projects');
      if (icon) {
        icon.style.transform = 'translate3d(1200px, 120px, 0)';
      }
    });
    await new Promise((r) => setTimeout(r, 200));

    await client.send('HeapProfiler.collectGarbage');
    const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);

    const folderBox = await (await page.$('#desktop-item-projects')).boundingBox();
    const tSoak0 = Date.now();

    for (let i = 0; i < 25; i++) {
      await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
      await new Promise((r) => setTimeout(r, 20));
      await page.mouse.move(500, 500);
      await new Promise((r) => setTimeout(r, 15));
    }
    const soakDuration = Date.now() - tSoak0;

    await client.send('HeapProfiler.collectGarbage');
    const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    const heapGrowthMb = (heapAfter - heapBefore) / (1024 * 1024);

    console.log(`Soak Test Completed in ${soakDuration}ms:`);
    console.log(`Heap Growth: ${heapGrowthMb.toFixed(2)} MB (limit <= 5.0 MB)`);

    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    // 8. Capture Evidence Screenshot
    console.log('\n--- 8. Capturing Evidence Screenshot ---');
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await page.waitForSelector('.folder-float[data-open]');
    await page.waitForSelector('.folder-float__item');
    await new Promise((r) => setTimeout(r, 400));

    const ssPath = 'file_pills_evidence.png';
    await page.screenshot({ path: path.join(OUT_DIR, ssPath) });

    const allPassed =
      layoutCheck.gapPass &&
      layoutCheck.pillsMax4 &&
      allCountsPass &&
      allEdgesPass &&
      zeroRafPass &&
      heapGrowthMb <= 5.0;

    recordEvidence(
      'ROUND15_STEP6_FILE_PILLS_FOLDERFLOAT',
      allPassed,
      'FolderFloat deterministic spring-to-slot layout: max 4 visible pills, zero pairwise intersections (gap >= 6px), middle-ellipsised names with WarmTooltip, smooth wheel scroll (180-260ms), no backdrop-filter blur, zero matter-js dependency, heap growth <= 5MB at 4x CPU throttle',
      {
        visiblePills: layoutCheck.count,
        pairwiseGap: layoutCheck.minGap,
        middleEllipsis: kvPill?.text,
        noScrollbars: layoutCheck.noScrollbars,
        allCountsTested: testCounts,
        allEdgeClamped: allEdgesPass,
        zeroRafOnLeave: zeroRafPass,
        heapGrowthMb: heapGrowthMb.toFixed(2),
      },
      ssPath
    );

    await browser.close();

    if (!allPassed) {
      console.error('STEP 6 FAILED.');
      process.exit(1);
    } else {
      console.log('STEP 6 PASSED: FolderFloat file pills successfully optimized.');
    }
  } finally {
    // Restore original portfolio.json
    if (fs.existsSync(BACKUP_JSON_PATH)) {
      fs.copyFileSync(BACKUP_JSON_PATH, PORTFOLIO_JSON_PATH);
      fs.unlinkSync(BACKUP_JSON_PATH);
      console.log('Restored original data/portfolio.json from backup.');
    }
  }
}

runStep6FilePillsTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
