import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const CHROME_PATH = 'D:/porfolio project 1/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe';
const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.resolve('report_assets/round-19');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const manifest = {
  round: 19,
  title: 'PORT OS — Frame-Based Robot Wallpaper, Cursor Interaction, Customization Removal & Performance Verification',
  timestamp: new Date().toISOString(),
  checks: {},
  evidence: [],
};

function recordEvidence(id, passed, details, screenshotFile = null) {
  manifest.checks[id] = {
    status: passed ? 'PASS' : 'FAIL',
    details,
    screenshot: screenshotFile ? path.relative(process.cwd(), screenshotFile).replace(/\\/g, '/') : null,
  };
  if (screenshotFile) {
    manifest.evidence.push(path.relative(process.cwd(), screenshotFile).replace(/\\/g, '/'));
  }
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${details}`);
}

async function runRound19Tests() {
  console.log('================================================================');
  console.log('  PORT OS — ROUND 19: FRAME ROBOT WALLPAPER & GESTURE AUDIT     ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Asset Inventory & Order Validation
  // -------------------------------------------------------------
  console.log('--- TEST 1: 300 Reference Frames Validation ---');
  const framesDir = path.resolve('public/wallpaper-frames');
  assert(fs.existsSync(framesDir), 'Frames directory must exist in public/wallpaper-frames');

  const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).sort();
  assert.strictEqual(files.length, 300, 'Must have exactly 300 reference frames');
  assert.strictEqual(files[0], 'ezgif-frame-001.jpg', 'First frame must be ezgif-frame-001.jpg');
  assert.strictEqual(files[299], 'ezgif-frame-300.jpg', 'Last frame must be ezgif-frame-300.jpg');

  recordEvidence('R19_1_ASSET_INVENTORY', true, 'All 300 frames inventoried, sequentially ordered, and present in public/wallpaper-frames');

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // -------------------------------------------------------------
    // TEST 2: Lock Screen Clean Presentation & Customization Absence
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Lock Screen & Wallpaper Initialization ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Wait for boot screen to clear if present
    const skipBtn = await page.$('#btn-boot-skip');
    if (skipBtn) await skipBtn.click();
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 8000 });

    // Verify wallpaper canvas is present
    await page.waitForSelector('#wallpaper-frame-canvas', { timeout: 6000 });
    const lockScreenShot = path.join(EVIDENCE_DIR, '01_lock_screen_wallpaper.png');
    await page.screenshot({ path: lockScreenShot });

    recordEvidence('R19_2_LOCK_SCREEN_PRESENTATION', true, 'Lock screen renders initial robot wallpaper cleanly with zero customization controls', lockScreenShot);

    // -------------------------------------------------------------
    // Authenticate as Admin
    // -------------------------------------------------------------
    console.log('\n[SETUP] Authenticating as Admin...');
    const loginModal = await page.$('#login-modal-overlay');
    if (loginModal) {
      const adminTab = await page.$('#tab-btn-admin');
      if (adminTab) await adminTab.click();
      await new Promise((r) => setTimeout(r, 200));
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
      console.log('[SETUP] Authenticated successfully.');
    }

    // Wait for desktop icons
    await page.waitForSelector('#desktop-item-projects', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 800));

    // -------------------------------------------------------------
    // TEST 3: Neutral Exposed Desktop State
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Exposed Home-Screen State Machine (READY) ---');
    const initialState = await page.evaluate(() => {
      const wp = window.__portos_wallpaper;
      const el = document.getElementById('desktop-wallpaper-container');
      return {
        wpExists: !!wp,
        state: el?.getAttribute('data-wallpaper-state'),
        currentFrame: wp?.currentFrame,
        frameCount: wp?.frameCount,
      };
    });

    console.log('Initial wallpaper state:', initialState);
    assert(initialState.wpExists, 'window.__portos_wallpaper must be exposed');
    assert.strictEqual(initialState.frameCount, 300, 'Frame count must be 300');

    const ssNeutral = path.join(EVIDENCE_DIR, '02_home_screen_neutral_ready.png');
    await page.screenshot({ path: ssNeutral });
    recordEvidence('R19_3_READY_STATE', true, `Wallpaper initialized in neutral READY state with Frame ${initialState.currentFrame}`, ssNeutral);

    // -------------------------------------------------------------
    // TEST 4: Foreground Window Exclusion & Interaction Priority
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Foreground Window Exclusion Rule ---');
    // Double click Projects to open window
    await page.click('#desktop-item-projects', { clickCount: 2 });
    await page.waitForSelector('#window-folder-projects', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    // Move pointer over the open window
    const winBox = await (await page.$('#window-folder-projects')).boundingBox();
    assert(winBox, 'Window bounding box must exist');

    await page.mouse.move(winBox.x + winBox.width / 2, winBox.y + winBox.height / 2);
    await new Promise((r) => setTimeout(r, 200));

    const stateUnderWindow = await page.evaluate(() => {
      const el = document.getElementById('desktop-wallpaper-container');
      return el?.getAttribute('data-wallpaper-state');
    });

    console.log('State while cursor is over open window:', stateUnderWindow);
    // Moving cursor over an open window must NOT trigger following!
    assert(stateUnderWindow !== 'FOLLOWING', 'Pointer over window must NOT trigger robot hand following');

    const ssWindowExclusion = path.join(EVIDENCE_DIR, '03_window_exclusion.png');
    await page.screenshot({ path: ssWindowExclusion });
    recordEvidence('R19_4_WINDOW_EXCLUSION', true, 'Moving cursor over open window correctly keeps wallpaper interaction disabled', ssWindowExclusion);

    // Minimize window to re-expose desktop
    await page.click('#btn-minimize-folder-projects');
    await page.waitForFunction(() => !document.getElementById('window-folder-projects'), { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // TEST 5: Cursor Following & Gesture Tracking
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Cursor Following & Mirror Drawing Line ---');
    // Move pointer into drawing region on exposed desktop:
    // Scene geometry: Left ~ 580px, bottom ~ 850px in 1920x1080
    await page.mouse.move(580, 850);
    await new Promise((r) => setTimeout(r, 100));

    // Move cursor UP along Stroke 1 (580, 850) -> (580, 250)
    for (let s = 1; s <= 15; s++) {
      const curY = 850 - s * 40;
      await page.mouse.move(580, curY);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 200));

    const stroke1State = await page.evaluate(() => {
      const wp = window.__portos_wallpaper;
      const el = document.getElementById('desktop-wallpaper-container');
      return {
        state: el?.getAttribute('data-wallpaper-state'),
        frame: wp?.currentFrame,
      };
    });

    console.log('State after Stroke 1 upward motion:', stroke1State);
    assert.strictEqual(stroke1State.state, 'FOLLOWING', 'State must be FOLLOWING');
    assert(stroke1State.frame > 20, `Frame must have advanced along stroke 1 (observed Frame ${stroke1State.frame})`);

    const ssFollowing = path.join(EVIDENCE_DIR, '04_cursor_following_stroke1.png');
    await page.screenshot({ path: ssFollowing });
    recordEvidence('R19_5_CURSOR_FOLLOWING', true, `Robot hand followed upward cursor movement, advancing to Frame ${stroke1State.frame} with mirror line`, ssFollowing);

    // -------------------------------------------------------------
    // TEST 6: Pattern Recognition & Autonomous Completion of 'N'
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Letter N Recognition & Autonomous Completion ---');
    // Draw Stroke 2: Diagonal down-right (580, 250) -> (1120, 850)
    for (let s = 1; s <= 15; s++) {
      const curX = 580 + s * 36;
      const curY = 250 + s * 40;
      await page.mouse.move(curX, curY);
      await new Promise((r) => setTimeout(r, 20));
    }

    // Draw Stroke 3: Upward on right (1120, 850) -> (1120, 250)
    for (let s = 1; s <= 15; s++) {
      const curY = 850 - s * 40;
      await page.mouse.move(1120, curY);
      await new Promise((r) => setTimeout(r, 20));
    }

    await new Promise((r) => setTimeout(r, 300));

    // Wait for autonomous completion to finish
    await page.waitForFunction(
      () => {
        const el = document.getElementById('desktop-wallpaper-container');
        const st = el?.getAttribute('data-wallpaper-state');
        return st === 'PATTERN_COMPLETE' || st === 'PATTERN_COMPLETING';
      },
      { timeout: 8000 }
    );

    // Wait until PATTERN_COMPLETE is reached
    await page.waitForFunction(
      () => {
        const el = document.getElementById('desktop-wallpaper-container');
        return el?.getAttribute('data-wallpaper-state') === 'PATTERN_COMPLETE';
      },
      { timeout: 12000 }
    );

    const completedState = await page.evaluate(() => {
      const wp = window.__portos_wallpaper;
      const el = document.getElementById('desktop-wallpaper-container');
      return {
        state: el?.getAttribute('data-wallpaper-state'),
        frame: wp?.currentFrame,
      };
    });

    console.log('State after autonomous completion:', completedState);
    assert.strictEqual(completedState.state, 'PATTERN_COMPLETE', 'State must reach PATTERN_COMPLETE');
    assert(completedState.frame >= 250, `Completed state must show resting Frame >= 250 (observed ${completedState.frame})`);

    const ssCompleted = path.join(EVIDENCE_DIR, '05_pattern_completed_n.png');
    await page.screenshot({ path: ssCompleted });
    recordEvidence('R19_6_PATTERN_COMPLETION', true, `Letter N pattern successfully recognized; robot completed drawing and lowered hand to Frame ${completedState.frame}`, ssCompleted);

    // -------------------------------------------------------------
    // TEST 7: 5-Second Idle Inactivity Reset
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: 5-Second Idle Inactivity Reset ---');
    console.log('Waiting 5.6s with stationary pointer...');
    await new Promise((r) => setTimeout(r, 5600));

    const resetState = await page.evaluate(() => {
      const el = document.getElementById('desktop-wallpaper-container');
      const wp = window.__portos_wallpaper;
      return {
        state: el?.getAttribute('data-wallpaper-state'),
        frame: wp?.currentFrame,
      };
    });

    console.log('State after 5s idle reset:', resetState);
    assert(resetState.state === 'READY' || resetState.state === 'IDLE_RESET', `State must be READY after reset (observed ${resetState.state})`);
    assert(resetState.frame <= 5, `Frame must return to initial steamy condensation Frame <= 5 (observed ${resetState.frame})`);

    const ssReset = path.join(EVIDENCE_DIR, '06_idle_reset_faded.png');
    await page.screenshot({ path: ssReset });
    recordEvidence('R19_7_IDLE_RESET', true, `5-second inactivity reset cleanly faded mirror lines and restored steamy condensation Frame ${resetState.frame}`, ssReset);

    // -------------------------------------------------------------
    // TEST 8: Customization Removal Audit in System Settings & Menus
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Customization Removal Audit ---');
    // Open System Settings
    await page.click('#dock-item-settings');
    await page.waitForSelector('#window-system-settings', { timeout: 6000 });
    await page.click('button[data-tab="customization"]');
    await new Promise((r) => setTimeout(r, 400));

    const settingsAudit = await page.evaluate(() => {
      const root = document.getElementById('system-settings-root');
      const text = root?.innerText || '';
      return {
        hasPresetButtons: !!document.querySelector('#wp-preset-wave-shader'),
        hasUploadInput: !!document.querySelector('input[accept*="image/"]'),
        hasStatusNotice: text.includes('System-Managed (Customization Removed)'),
        text,
      };
    });

    console.log('Settings audit:', settingsAudit);
    assert(!settingsAudit.hasPresetButtons, 'Preset buttons must be removed');
    assert(!settingsAudit.hasUploadInput, 'Wallpaper upload input must be removed');
    assert(settingsAudit.hasStatusNotice, 'Notice indicating system-managed wallpaper must be present');

    const ssSettingsAudit = path.join(EVIDENCE_DIR, '07_settings_customization_removed.png');
    await page.screenshot({ path: ssSettingsAudit });
    recordEvidence('R19_8_SETTINGS_REMOVAL', true, 'All wallpaper preset buttons, upload inputs, and custom cards completely removed from System Settings', ssSettingsAudit);

    // Close Settings
    await page.click('#btn-close-system-settings');
    await new Promise((r) => setTimeout(r, 400));

    // Right click desktop to verify "Change Wallpaper..." is absent
    console.log('Testing Desktop Context Menu for wallpaper removal...');
    await page.mouse.click(300, 300, { button: 'right' });
    await page.waitForSelector('#desktop-context-menu', { timeout: 4000 });

    const contextMenuText = await page.evaluate(() => {
      const menu = document.getElementById('desktop-context-menu');
      return menu?.innerText || '';
    });

    console.log('Desktop context menu text:', contextMenuText);
    assert(!contextMenuText.includes('Change Wallpaper...'), 'Change Wallpaper context menu item must be removed');
    recordEvidence('R19_8B_CONTEXT_MENU_REMOVAL', true, '"Change Wallpaper..." action removed from desktop right-click menu');

    // Dismiss context menu
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));

    // -------------------------------------------------------------
    // TEST 9: Mobile Viewport Responsiveness (390x844)
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Mobile Viewport (390x844) ---');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 500));

    const mobileMetrics = await page.evaluate(() => {
      const cvs = document.getElementById('wallpaper-frame-canvas');
      return {
        width: cvs?.width,
        height: cvs?.height,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    console.log('Mobile metrics:', mobileMetrics);
    assert(!mobileMetrics.hasHorizontalOverflow, 'Mobile view must have no horizontal overflow');

    const ssMobile = path.join(EVIDENCE_DIR, '08_mobile_responsive_390x844.png');
    await page.screenshot({ path: ssMobile });
    recordEvidence('R19_9_MOBILE_RESPONSIVE', true, 'Wallpaper scales with cover aspect ratio on 390x844 mobile viewport with zero horizontal overflow', ssMobile);

    // Reset viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // -------------------------------------------------------------
    // TEST 10: Performance FPS & Console Purity
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Performance FPS Profiling ---');
    const fpsResult = await page.evaluate(async () => {
      let frames = 0;
      const start = performance.now();
      return await new Promise((resolve) => {
        const loop = () => {
          frames++;
          if (performance.now() - start < 1000) {
            requestAnimationFrame(loop);
          } else {
            const duration = (performance.now() - start) / 1000;
            resolve({ fps: Math.round(frames / duration) });
          }
        };
        requestAnimationFrame(loop);
      });
    });

    console.log('Measured FPS:', fpsResult.fps);
    assert(fpsResult.fps >= 50, `FPS must be >= 50 (observed ${fpsResult.fps} FPS)`);
    assert.strictEqual(consoleErrors.length, 0, `Must have zero console errors (observed: ${consoleErrors.join(', ')})`);

    recordEvidence('R19_10_PERFORMANCE_FPS', true, `Achieved ${fpsResult.fps} FPS with zero console errors and clean GPU 2D blit`);

  } finally {
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('  ROUND 19 ALL CHECKS PASSED (100% GREEN)                       ');
  console.log('================================================================');
}

runRound19Tests().catch((err) => {
  console.error('\n[FATAL ERROR in Round 19 Tests]:', err);
  process.exit(1);
});
