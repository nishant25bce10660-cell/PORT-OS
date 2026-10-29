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

async function verifyFolderLogosAndAnimation() {
  console.log('================================================================');
  console.log('  PORT OS — DESKTOP FOLDER LOGOS & FOLDERFLOAT VERIFICATION     ');
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
    console.log('[1/4] Navigating to PORT OS & Logging in as Owner...');
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
    // CHECK 1: Verify Classic Folder Logos & Glyphs
    // -------------------------------------------------------------
    console.log('\n[2/4] Verifying Classic Folder Logos (Projects, Cert & Edu, Owner)...');
    const folderIcons = await page.evaluate(() => {
      const items = [
        { id: 'projects', el: document.getElementById('desktop-item-projects') },
        { id: 'cert-education', el: document.getElementById('desktop-item-cert-education') },
        { id: 'owners-data', el: document.getElementById('desktop-item-owners-data') },
      ];

      return items.map(({ id, el }) => {
        const icon = el?.querySelector('.portos-app-icon');
        const kind = icon?.getAttribute('data-kind');
        const category = icon?.getAttribute('data-category');
        const isGlyphMode = icon?.classList.contains('portos-app-icon--glyph-mode');
        const hasSvg = !!icon?.querySelector('svg.folder-svg-icon');
        const hasPaper = !!icon?.querySelector('.folder-svg-paper-layer');
        const hasFront = !!icon?.querySelector('.folder-svg-front-layer');
        const svgContent = icon?.querySelector('svg')?.innerHTML || '';
        return {
          id,
          kind,
          category,
          isGlyphMode,
          hasSvg,
          hasPaper,
          hasFront,
          hasCodeSymbol: svgContent.includes('M19 23L14 28L19 33M29 23L34 28L29 33M26 21L22 35'),
          hasGradCap: svgContent.includes('M24 21L14 26L24 31L34 26L24 21Z'),
          hasOwnerAvatar: svgContent.includes('circle cx="24" cy="24" r="4.5"'),
        };
      });
    });

    console.log('Folder Icon Inspection Results:', folderIcons);

    // Assert Projects folder logo
    const proj = folderIcons.find(f => f.id === 'projects');
    assert.strictEqual(proj?.kind, 'folder-projects', 'Projects must have data-kind="folder-projects"');
    assert.strictEqual(proj?.category, 'folder', 'Projects category must be folder');
    assert.strictEqual(proj?.hasSvg, true, 'Projects must render folder-svg-icon');
    assert.strictEqual(proj?.hasPaper, true, 'Projects must have folder-svg-paper-layer');
    assert.strictEqual(proj?.hasFront, true, 'Projects must have folder-svg-front-layer');
    assert.strictEqual(proj?.hasCodeSymbol, true, 'Projects must have classic </> code glyph');

    // Assert Certifications folder logo
    const cert = folderIcons.find(f => f.id === 'cert-education');
    assert.strictEqual(cert?.kind, 'folder-cert-edu', 'Cert & Edu must have data-kind="folder-cert-edu"');
    assert.strictEqual(cert?.category, 'folder', 'Cert & Edu category must be folder');
    assert.strictEqual(cert?.hasSvg, true, 'Cert & Edu must render folder-svg-icon');
    assert.strictEqual(cert?.hasGradCap, true, 'Cert & Edu must have classic graduation cap glyph');

    // Assert Owner folder logo
    const owner = folderIcons.find(f => f.id === 'owners-data');
    assert.strictEqual(owner?.kind, 'folder-owner', 'Owner Data must have data-kind="folder-owner"');
    assert.strictEqual(owner?.category, 'folder', 'Owner Data category must be folder');
    assert.strictEqual(owner?.hasSvg, true, 'Owner Data must render folder-svg-icon');
    assert.strictEqual(owner?.hasOwnerAvatar, true, 'Owner Data must have classic user avatar glyph');

    console.log('✓ All 3 desktop folders successfully restored to their classic macOS folder logos and category glyphs!');

    const ssRestoredLogos = path.join(EVIDENCE_DIR, '01_desktop_restored_folder_logos.png');
    await page.screenshot({ path: ssRestoredLogos });
    console.log(`Saved screenshot: ${ssRestoredLogos}`);

    // -------------------------------------------------------------
    // CHECK 2: Verify FolderFloat Flap Tilt & Paper Elevation
    // -------------------------------------------------------------
    console.log('\n[3/4] Verifying Folder 3D Flap Tilt & Paper Elevation on Hover...');
    const folderProj = await page.$('#desktop-item-projects');
    const folderBox = await folderProj.boundingBox();

    // Hover the folder
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 450));

    // Check SVG animation state
    const animationState = await page.evaluate(() => {
      const folder = document.getElementById('desktop-item-projects');
      const paper = folder?.querySelector('.folder-svg-paper-layer');
      const front = folder?.querySelector('.folder-svg-front-layer');
      const pills = Array.from(document.querySelectorAll('.folder-float__item'));

      const paperStyle = window.getComputedStyle(paper);
      const frontStyle = window.getComputedStyle(front);

      return {
        pillCount: pills.length,
        paperOpacity: paperStyle.opacity,
        paperTransform: paperStyle.transform,
        frontTransform: frontStyle.transform,
      };
    });

    console.log('Hover Animation State:', animationState);
    assert(animationState.pillCount >= 4, 'Must have at least 4 floating pills emerged');
    assert(parseFloat(animationState.paperOpacity) > 0.5, 'Paper layer must rise and become visible');
    assert(animationState.frontTransform !== 'none', 'Front flap layer must have 3D transform applied');
    console.log('✓ 3D Flap tilt and paper elevation verified while folder is hovered.');

    const ssHoverPills = path.join(EVIDENCE_DIR, '02_folder_float_hover_expanded.png');
    await page.screenshot({ path: ssHoverPills });
    console.log(`Saved screenshot: ${ssHoverPills}`);

    // -------------------------------------------------------------
    // CHECK 3: Verify Pill Hover & File Opening
    // -------------------------------------------------------------
    console.log('\n[4/4] Verifying Floating Pill Selection & File Open...');
    // Re-hover folder to ensure stable expansion
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 450));

    const emergingPill = await page.$('.folder-float__item');
    assert(emergingPill, 'Emerging pill must be available to click');
    const epBox = await emergingPill.boundingBox();

    // Click emerging pill
    await page.mouse.click(epBox.x + epBox.width / 2, epBox.y + epBox.height / 2);
    await new Promise((r) => setTimeout(r, 800));

    // Verify window opened for the selected file
    const openedWindow = await page.$('.window-shell, .window-container');
    console.log('Opened window element found:', openedWindow !== null);
    assert(openedWindow !== null, 'File window must open upon clicking an emerging pill');
    console.log('✓ Pill selection pop and document launch verified.');

    const ssFileOpened = path.join(EVIDENCE_DIR, '03_pill_selected_file_opened.png');
    await page.screenshot({ path: ssFileOpened });
    console.log(`Saved screenshot: ${ssFileOpened}`);

    console.log('\n================================================================');
    console.log('  ALL FOLDER LOGOS & FOLDERFLOAT CHECKS PASSED (100% GREEN)     ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyFolderLogosAndAnimation();
