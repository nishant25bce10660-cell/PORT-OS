import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('report_assets/round-1');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestM2() {
  console.log('================================================================');
  console.log('       PORT OS - ACCEPTANCE TEST SUITE: M2 (WIDGETS & TOKENS)   ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1920, height: 1080 },
  };

  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  const results = {};

  try {
    // -------------------------------------------------------------
    // 1. Viewer Role Inspection
    // -------------------------------------------------------------
    console.log('[1. VIEWER] Navigating to PORT OS...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    // If Boot Screen appears, skip it
    try {
      await page.waitForSelector('#btn-boot-skip', { timeout: 2500 });
      await page.click('#btn-boot-skip');
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
    } catch {}

    const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 4000 }).catch(() => null);
    if (loginOverlay) {
      await page.waitForSelector('#tab-btn-viewer', { timeout: 5000 });
      await page.click('#tab-btn-viewer');
      await page.type('#input-viewer-name', 'Widget Auditor Viewer');
      await page.type('#input-viewer-email', 'auditor@widgets.internal');
      await page.click('#btn-login-viewer');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
    }

    // Verify Inter font is active on body
    const bodyFont = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    console.log(`Computed body font-family: ${bodyFont}`);
    assert(bodyFont.includes('Inter'), 'Body font-family must include Inter');

    // Verify Clock Widget has 88px monospace font
    await page.waitForSelector('#widget-widget-clock', { timeout: 5000 });
    const clockProps = await page.evaluate(() => {
      const el = document.getElementById('widget-widget-clock');
      const timeDisplay = el.querySelector('.widget-clock-display');
      const compTime = window.getComputedStyle(timeDisplay);
      const dot = el.querySelector('.clock-seconds-dot');
      return {
        zIndex: parseInt(window.getComputedStyle(el).zIndex || '0', 10),
        fontSize: compTime.fontSize,
        fontFamily: compTime.fontFamily,
        hasDot: !!dot,
      };
    });
    console.log(`Clock Widget: zIndex=${clockProps.zIndex}, fontSize=${clockProps.fontSize}, fontFamily=${clockProps.fontFamily}, hasPulsingDot=${clockProps.hasDot}`);
    assert(clockProps.zIndex === 20, `Widget zIndex must be 20 (got ${clockProps.zIndex})`);
    assert(clockProps.fontSize === '88px', `Clock font size must be 88px (got ${clockProps.fontSize})`);
    assert(clockProps.fontFamily.includes('JetBrains Mono'), `Clock font family must include JetBrains Mono (got ${clockProps.fontFamily})`);
    assert(clockProps.hasDot, 'Clock must have seconds pulsing dot');
    results.ClockWidget = { status: 'PASS', details: '88px JetBrains Mono clock with pulsing dot and z-index 20' };

    // Verify Quick Note Widget is read-only for Viewer
    await page.waitForSelector('#widget-widget-note', { timeout: 5000 });
    const viewerNoteState = await page.evaluate(() => {
      const el = document.getElementById('widget-widget-note');
      const textarea = el.querySelector('textarea');
      const removeBtn = el.querySelector('.widget-remove-handle');
      const editBtn = el.querySelector('.widget-edit-handle');
      return {
        hasTextarea: !!textarea,
        hasRemoveBtn: !!removeBtn,
        hasEditBtn: !!editBtn,
      };
    });
    console.log(`Viewer Note Widget controls: hasTextarea=${viewerNoteState.hasTextarea}, hasRemoveBtn=${viewerNoteState.hasRemoveBtn}, hasEditBtn=${viewerNoteState.hasEditBtn}`);
    assert(!viewerNoteState.hasTextarea, 'Viewer must not see textarea in Quick Note');
    assert(!viewerNoteState.hasRemoveBtn, 'Viewer must not see remove handle');
    assert(!viewerNoteState.hasEditBtn, 'Viewer must not see edit handle');

    // Verify Stats Widget has 3 pills
    await page.waitForSelector('#widget-widget-counter', { timeout: 5000 });
    const statsPillsCount = await page.evaluate(() => {
      const el = document.getElementById('widget-widget-counter');
      return el.querySelectorAll('.widget-stat-pill').length;
    });
    console.log(`Portfolio Stats metric pills count: ${statsPillsCount}`);
    assert(statsPillsCount === 3, `Stats widget must have 3 metric pills (got ${statsPillsCount})`);
    results.StatsWidget = { status: 'PASS', details: '3 metric pills (Projects, Certs, Years) with micro charts' };

    // Verify Layering: Ensure window is open over widget and verify window z-index > widget z-index
    let winEl = await page.$('#window-folder-projects');
    if (!winEl) {
      await page.waitForSelector('#desktop-item-projects', { timeout: 5000 });
      await page.click('#desktop-item-projects', { clickCount: 2 });
      await page.waitForSelector('#window-folder-projects', { timeout: 5000 });
    }
    const layerCheck = await page.evaluate(() => {
      const win = document.getElementById('window-folder-projects');
      const wid = document.getElementById('widget-widget-clock');
      return {
        winZ: parseInt(win.style.zIndex || '0', 10),
        widZ: parseInt(window.getComputedStyle(wid).zIndex || '0', 10),
      };
    });
    console.log(`Layering Check: Window Z = ${layerCheck.winZ}, Widget Z = ${layerCheck.widZ}`);
    assert(layerCheck.winZ >= 100, 'Window Z must be >= 100');
    assert(layerCheck.widZ === 20, 'Widget Z must be 20');
    assert(layerCheck.winZ > layerCheck.widZ, 'Window Z must strictly cover Widget Z');
    results.WidgetLayering = { status: 'PASS', details: `Window (z=${layerCheck.winZ}) strictly covers Widget (z=${layerCheck.widZ})` };

    // Verify Security: Viewer calling POST /api/widgets gets 403
    const viewerForbidden = await page.evaluate(async () => {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'test-hack', type: 'clock', x: 0, y: 0, text: 'Hacked' }),
      });
      return { status: res.status };
    });
    console.log(`Viewer direct POST /api/widgets status: ${viewerForbidden.status}`);
    assert(viewerForbidden.status === 403, `Direct write by Viewer must return 403 (got ${viewerForbidden.status})`);
    results.ViewerSecurity403 = { status: 'PASS', details: 'Server correctly returned 403 Forbidden for Viewer write' };

    // -------------------------------------------------------------
    // 2. Admin Role & Customization
    // -------------------------------------------------------------
    console.log('\n[2. ADMIN] Logging out Viewer and authenticating Admin...');
    await page.click('#dock-sign-out');
    await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });

    // Admin login
    await page.waitForSelector('#tab-btn-admin', { timeout: 5000 });
    await page.click('#tab-btn-admin');
    await page.type('#input-admin-username', 'admin');
    await page.type('#input-admin-password', 'admin123');
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
    console.log('[ADMIN] Authenticated successfully.');

    // Verify Round 7: Global Edit Mode toggle is eliminated
    const editPill = await page.$('#toggle-edit-mode-pill');
    assert(!editPill, 'Global Edit Mode toggle pill must be eliminated in Round 7');
    console.log('[ROUND 7] Global Edit Mode toggle pill correctly eliminated.');

    // Verify Quick Note has NoteEditor with character counter directly for admin
    await page.waitForSelector('#widget-widget-note textarea', { timeout: 5000 });

    // Verify Quick Note now has NoteEditor with character counter
    const adminNoteState = await page.evaluate(() => {
      const el = document.getElementById('widget-widget-note');
      const textarea = el.querySelector('textarea');
      const counter = el.querySelector('.note-char-counter');
      return {
        hasTextarea: !!textarea,
        counterText: counter ? counter.textContent.trim() : null,
      };
    });
    console.log(`Admin Note Editor: hasTextarea=${adminNoteState.hasTextarea}, counter=${adminNoteState.counterText}`);
    assert(adminNoteState.hasTextarea, 'Admin must see textarea in Quick Note');
    assert(adminNoteState.counterText.includes('/ 280'), `Character counter must show / 280 (got ${adminNoteState.counterText})`);
    results.QuickNoteEditor = { status: 'PASS', details: `Textarea present with character counter: ${adminNoteState.counterText}` };

    // Hover Note widget to verify edit handles appear
    const noteEl = await page.$('#widget-widget-note');
    const noteBox = await noteEl.boundingBox();
    await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
    await new Promise((r) => setTimeout(r, 200));

    const handlesPresent = await page.evaluate(() => {
      const el = document.getElementById('widget-widget-note');
      const rm = el.querySelector('.widget-remove-handle');
      const ed = el.querySelector('.widget-edit-handle');
      return { hasRm: !!rm, hasEd: !!ed };
    });
    console.log(`Admin hover handles: removeHandle=${handlesPresent.hasRm}, editHandle=${handlesPresent.hasEd}`);
    assert(handlesPresent.hasRm && handlesPresent.hasEd, 'Admin must see remove and edit handles on hover in Edit mode');

    // Drag widget with 16px snap grid
    const dragStartX = noteBox.x + 20;
    const dragStartY = noteBox.y + 20;
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    await page.mouse.move(dragStartX + 35, dragStartY + 35); // Move +35px
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 400));

    const movedNoteBox = await (await page.$('#widget-widget-note')).boundingBox();
    console.log(`Moved Note position: x=${movedNoteBox.x}, y=${movedNoteBox.y}`);
    // 16px snap grid test: coordinate modulo 16 should be 0 (or snap-aligned)
    const isSnappedX = movedNoteBox.x % 16 === 0;
    const isSnappedY = movedNoteBox.y % 16 === 0;
    console.log(`Snap grid check: x=${movedNoteBox.x} (mod 16 = ${movedNoteBox.x % 16}), y=${movedNoteBox.y} (mod 16 = ${movedNoteBox.y % 16})`);
    assert(isSnappedX, 'Widget X must be snapped to 16px grid');
    assert(isSnappedY, 'Widget Y must be snapped to 16px grid');
    results.WidgetSnapGrid = { status: 'PASS', details: `Widget snapped to exact 16px grid: (${movedNoteBox.x}, ${movedNoteBox.y})` };

    // Screenshot evidence
    const screenshotPath = path.join(SCREENSHOT_DIR, 'm2_widgets_typography_evidence.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`\nScreenshot saved to: ${screenshotPath}`);

    console.log('\n================================================================');
    console.log('            ALL M2 WIDGET & TYPOGRAPHY CHECKS PASSED!           ');
    console.log('================================================================');
    console.table(results);
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED with error: <<<', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTestM2();
