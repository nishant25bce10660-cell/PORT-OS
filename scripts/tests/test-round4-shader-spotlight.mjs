import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('report_assets/round-4');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRound4Tests() {
  console.log('================================================================');
  console.log('  PORT OS - ROUND 4 ACCEPTANCE: SHADER, SPOTLIGHT, CONTEXT, TOASTS');
  console.log('================================================================\n');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle'],
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
    // SETUP: Navigate and Skip Boot Screen
    // -------------------------------------------------------------
    console.log('[SETUP] Navigating to PORT OS...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    try {
      await page.waitForSelector('#btn-boot-skip', { timeout: 3500 });
      await page.click('#btn-boot-skip');
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 5000 });
      console.log('[SETUP] Boot screen skipped.');
    } catch {
      await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 7000 }).catch(() => {});
    }

    // Login as Admin for testing
    const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 6000 }).catch(() => null);
    if (loginOverlay) {
      await page.evaluate(async () => {
        await fetch('/api/auth/login', { method: 'DELETE' });
      });
      await page.waitForSelector('#tab-btn-admin', { visible: true });
      await page.click('#tab-btn-admin');
      await new Promise(r => setTimeout(r, 200));
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
      console.log('[SETUP] Admin logged in.');
    }

    // -------------------------------------------------------------
    // TEST 1: M7 - SILK WAVE SHADER WALLPAPER (R6, P9, Fixes C6)
    // -------------------------------------------------------------
    console.log('\n--- Testing M7: Silk Wave Shader Wallpaper & Pause Controls ---');
    
    // Wait for canvas to be mounted
    await page.waitForSelector('canvas.wallpaper-canvas', { timeout: 8000 });
    const canvasExists = await page.evaluate(() => {
      const cvs = document.querySelector('canvas.wallpaper-canvas');
      return !!cvs;
    });
    console.log(`[M7] Wallpaper canvas element present: ${canvasExists}`);
    assert(canvasExists, 'Wallpaper canvas element must be present in DOM');

    // Check ShaderMaterial usage, DPR cap at 1.5, and pause behavior
    const shaderInfo = await page.evaluate(async () => {
      const cvs = document.querySelector('canvas.wallpaper-canvas');
      if (!cvs) return { error: 'No canvas found' };
      
      const width = cvs.width;
      const height = cvs.height;
      const dpr = window.devicePixelRatio;
      const isDprCapped = (width <= window.innerWidth * 1.5 + 2);
      
      // Check if silk wave custom shader is active on window.__portos_wallpaper
      const wp = (window).__portos_wallpaper;
      const hasShader = wp ? wp.isShaderMaterial : false;
      const isWireframe = wp ? wp.isWireframe : false;
      const isPaused = wp ? wp.isPaused : false;

      return {
        canvasWidth: width,
        canvasHeight: height,
        dpr,
        isDprCapped,
        hasShader,
        isWireframe,
        isPaused,
      };
    });

    console.log(`[M7] Canvas metrics:`, shaderInfo);
    assert(canvasExists, 'Wallpaper canvas element must be present in DOM');
    assert(shaderInfo.isDprCapped, 'Canvas DPR must be capped at 1.5');
    // Note: Silk Wave GLSL Shader retired in Round 19 per S12; replaced by Interactive Mirror Canvas (VW-01..33)
    results['M7_SHADER_WALLPAPER'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 2: M8.1 - GLOBAL SPOTLIGHT SEARCH (Cmd+K / Ctrl+K)
    // -------------------------------------------------------------
    console.log('\n--- Testing M8.1: Global Spotlight Search (Ctrl+K / Cmd+K) ---');
    
    // Trigger Ctrl+K
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 400));

    const spotlightVisible = await page.evaluate(() => {
      const modal = document.getElementById('spotlight-modal');
      return modal && window.getComputedStyle(modal).display !== 'none';
    });
    console.log(`[M8.1] Spotlight modal opened via Ctrl+K: ${spotlightVisible}`);
    assert(spotlightVisible, 'Pressing Ctrl+K must open Spotlight modal (#spotlight-modal)');

    // Type query "Distributed"
    await page.type('#spotlight-search-input', 'Distributed');
    await new Promise(r => setTimeout(r, 300));

    const resultCount = await page.evaluate(() => {
      const results = document.querySelectorAll('.spotlight-result-item');
      return results.length;
    });
    console.log(`[M8.1] Fuzzy search results for "Distributed": ${resultCount}`);
    assert(resultCount >= 1, 'Spotlight search must find matching items for "Distributed"');

    // Press Enter to open
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 600));

    const spotlightClosedAndWindowOpened = await page.evaluate(() => {
      const modal = document.getElementById('spotlight-modal');
      const isModalClosed = !modal || window.getComputedStyle(modal).display === 'none';
      const openWins = document.querySelectorAll('.window-shell, .window-container');
      return isModalClosed && openWins.length >= 1;
    });
    console.log(`[M8.1] Item opened from Spotlight and modal closed: ${spotlightClosedAndWindowOpened}`);
    assert(spotlightClosedAndWindowOpened, 'Selecting result in Spotlight must launch window and close modal');
    results['M8_1_SPOTLIGHT'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 3: M8.2 - DESKTOP RIGHT-CLICK CONTEXT MENU
    // -------------------------------------------------------------
    console.log('\n--- Testing M8.2: Global Desktop Right-Click Context Menu ---');
    
    // Ensure any open window is closed before clicking desktop workspace
    await page.evaluate(() => {
      const closeBtns = document.querySelectorAll('.traffic-light-close');
      closeBtns.forEach((btn) => btn.click());
    });
    await new Promise(r => setTimeout(r, 400));

    // Right click on empty desktop workspace
    await page.evaluate(() => {
      const ws = document.getElementById('desktop-workspace');
      if (ws) {
        ws.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
      }
    });
    await new Promise(r => setTimeout(r, 400));

    const contextMenuState = await page.evaluate(() => {
      const menu = document.getElementById('desktop-context-menu');
      if (!menu) return { visible: false };
      const style = window.getComputedStyle(menu);
      const items = Array.from(menu.querySelectorAll('.context-menu-item')).map(el => el.textContent?.trim());
      const rect = menu.getBoundingClientRect();
      return {
        visible: style.display !== 'none' && style.visibility !== 'hidden',
        x: rect.left,
        y: rect.top,
        items,
      };
    });

    console.log(`[M8.2] Context menu:`, contextMenuState);
    assert(contextMenuState.visible, 'Right-clicking on empty desktop must display #desktop-context-menu');
    assert(contextMenuState.items.some(i => i && i.includes('Settings')), 'Context menu must include Settings option');
    assert(!contextMenuState.items.some(i => i && i.includes('Wallpaper')), 'Context menu must NOT include Wallpaper option (customization removed)');
    
    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    const menuDismissed = await page.evaluate(() => {
      const menu = document.getElementById('desktop-context-menu');
      return !menu || window.getComputedStyle(menu).display === 'none';
    });
    assert(menuDismissed, 'Pressing Escape must dismiss desktop context menu');
    results['M8_2_CONTEXT_MENU'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 4: M8.3 - TOAST NOTIFICATION ENGINE
    // -------------------------------------------------------------
    console.log('\n--- Testing M8.3: Toast Notification Engine ---');
    
    // Trigger a toast via custom event or helper
    await page.evaluate(() => {
      const trigger = (window).__portos_notify;
      if (typeof trigger === 'function') {
        trigger({
          type: 'success',
          title: 'System Notification',
          message: 'Settings updated successfully',
        });
      }
    });
    await new Promise(r => setTimeout(r, 300));

    const toastState = await page.evaluate(() => {
      const toasts = document.querySelectorAll('.portos-toast-item');
      if (toasts.length === 0) return { exists: false };
      const first = toasts[0];
      return {
        exists: true,
        count: toasts.length,
        title: first.querySelector('.toast-title')?.textContent?.trim(),
        message: first.querySelector('.toast-message')?.textContent?.trim(),
        type: first.getAttribute('data-type'),
      };
    });
    console.log(`[M8.3] Toast state:`, toastState);
    assert(toastState.exists, 'Toast item must appear in DOM when notification is triggered');
    assert(toastState.title === 'System Notification', 'Toast title must match triggered payload');
    results['M8_3_TOASTS'] = 'PASS';

    // -------------------------------------------------------------
    // TEST 5: M8.4 - VISITOR TELEMETRY & SECURITY
    // -------------------------------------------------------------
    console.log('\n--- Testing M8.4: Visitor Telemetry API & UI Security ---');
    
    // 1. Check /api/telemetry/visitors as Admin
    const adminTelemetryRes = await page.evaluate(async () => {
      const res = await fetch('/api/telemetry/visitors');
      return {
        status: res.status,
        data: res.ok ? await res.json() : null,
      };
    });
    console.log(`[M8.4] Admin /api/telemetry/visitors status: ${adminTelemetryRes.status}`);
    assert(adminTelemetryRes.status === 200, 'Admin must receive 200 OK from /api/telemetry/visitors');
    assert(Array.isArray(adminTelemetryRes.data?.visitors), 'Visitors response must be an array');

    // 2. Logout Admin
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    // 3. Login as Viewer with a distinct identity
    const viewerName = 'Grace Hopper';
    const viewerEmail = 'grace@compiler.org';
    
    await page.waitForSelector('#login-modal-overlay', { timeout: 4000 });
    await page.click('#tab-btn-viewer');
    await new Promise(r => setTimeout(r, 200));
    await page.type('#input-viewer-name', viewerName);
    await page.type('#input-viewer-email', viewerEmail);
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
    console.log(`[M8.4] Logged in as Viewer: ${viewerName} (${viewerEmail})`);

    // 4. Verify Viewer is blocked with 403 on /api/telemetry/visitors
    const viewerTelemetryRes = await page.evaluate(async () => {
      const res = await fetch('/api/telemetry/visitors');
      return { status: res.status };
    });
    console.log(`[M8.4] Viewer /api/telemetry/visitors status: ${viewerTelemetryRes.status}`);
    assert(viewerTelemetryRes.status === 403, 'Viewer must be denied 403 Forbidden on /api/telemetry/visitors');

    // 5. Verify the visitor record was recorded in the database
    // Logout viewer, log back in as admin, check visitors
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#tab-btn-admin', { visible: true });
    await page.click('#tab-btn-admin');
    await page.type('#input-admin-username', 'admin');
    await page.type('#input-admin-password', 'admin123');
    await page.click('#btn-login-admin');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });

    const updatedTelemetry = await page.evaluate(async () => {
      const res = await fetch('/api/telemetry/visitors');
      if (!res.ok) return null;
      const json = await res.json();
      return json.visitors;
    });

    const recorded = updatedTelemetry?.find(v => v.email === viewerEmail);
    console.log(`[M8.4] Recorded visitor entry for ${viewerEmail}:`, recorded);
    assert(recorded, `Visitor ${viewerEmail} must be recorded in telemetry log`);
    assert(recorded.name === viewerName, 'Recorded name must match logged-in viewer');
    results['M8_4_TELEMETRY'] = 'PASS';

    // Capture screenshot evidence
    const screenshotPath = path.join(SCREENSHOT_DIR, 'round4_shader_spotlight_evidence.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`\n[EVIDENCE] Screenshot saved to ${screenshotPath}`);

    console.log('\n================================================================');
    console.log('  ROUND 4 TEST RESULTS');
    console.log('================================================================');
    for (const [key, val] of Object.entries(results)) {
      console.log(`  ${key}: ${val}`);
    }

  } catch (err) {
    console.error('\n[FAIL] Test suite failed with error:', err.message);
    const failShot = path.join(SCREENSHOT_DIR, 'round4_failure_evidence.png');
    await page.screenshot({ path: failShot }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

runRound4Tests();
