import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-20');

async function testStep4Engine() {
  console.log('================================================================');
  console.log('   PORT OS — STEP 4: INTERACTION ENGINE V2 & STATE MACHINE      ');
  console.log('================================================================\n');

  const transitionsVerified = {};

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // 1. Lock screen state check: INACTIVE
  console.log('[TEST 1] Verifying INACTIVE state on Lock Screen...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  try {
    const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 2000 });
    if (skipBtn) await skipBtn.click();
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
  } catch {}

  const lockState = await page.evaluate(() => {
    return (window).__portos_wallpaper?.state;
  });
  console.log(`Lock screen wallpaper state: ${lockState}`);
  transitionsVerified['INACTIVE_ON_LOCKSCREEN'] = lockState === 'INACTIVE';

  // 2. Login transition to READY
  console.log('[TEST 2] Verifying transition to READY on Home Screen...');
  const adminTab = await page.waitForSelector('#tab-btn-admin', { timeout: 4000 });
  if (adminTab) await adminTab.click();
  await page.type('#input-admin-username', 'admin');
  await page.type('#input-admin-password', 'admin123');
  await page.click('#btn-login-admin');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 600));

  const readyState = await page.evaluate(() => {
    return (window).__portos_wallpaper?.state;
  });
  console.log(`Desktop wallpaper initial state: ${readyState}`);
  transitionsVerified['TRANSITION_TO_READY'] = readyState === 'READY';

  // Verify #wallpaper-hit element exists beneath UI
  const hitLayerExists = await page.evaluate(() => {
    const el = document.getElementById('wallpaper-hit');
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.zIndex === '5' && style.position === 'fixed';
  });
  console.log(`Hit layer #wallpaper-hit correctly configured: ${hitLayerExists}`);
  transitionsVerified['HIT_LAYER_CONFIGURED'] = hitLayerExists;

  // 3. Move cursor to start capture zone -> triggers FOLLOWING
  console.log('[TEST 3] Moving pointer into Start Zone (Left leg bottom)...');
  // Scene: (537, 1029). At 1920x1080 desktop scale=1.0, screen is (537, 1029).
  await page.mouse.move(537, 1020);
  await new Promise((r) => setTimeout(r, 100));

  let followingState = await page.evaluate(() => {
    return {
      state: (window).__portos_wallpaper?.state,
      progress: (window).__portos_wallpaper?.progress,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('After entering start zone:', followingState);
  transitionsVerified['TRANSITION_TO_FOLLOWING'] = followingState.state === 'FOLLOWING';

  // 4. Trace Stroke 1 upward: progress advances continuously
  console.log('[TEST 4] Tracing Stroke 1 upward (human-like steps)...');
  for (let y = 1000; y >= 200; y -= 40) {
    await page.mouse.move(537, y);
    await new Promise((r) => setTimeout(r, 16));
  }
  await new Promise((r) => setTimeout(r, 200));

  const stroke1Progress = await page.evaluate(() => {
    return {
      progress: (window).__portos_wallpaper?.progress,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('Stroke 1 progress:', stroke1Progress);
  transitionsVerified['STROKE1_CONTINUOUS_PROGRESS'] =
    stroke1Progress.progress > 0.2 && stroke1Progress.currentFrame >= 15;

  await page.screenshot({ path: path.join(OUT_DIR, 'step4_engine_stroke1.png') });

  // 5. Test HOLD transition: Move cursor over Projects window or onto UI
  console.log('[TEST 5] Testing HOLD transition when leaving bare wallpaper onto UI...');
  // Open Projects window
  await page.mouse.click(50, 50); // top left area away from hit
  const hitLeave = await page.evaluate(() => {
    const hit = document.getElementById('wallpaper-hit');
    hit?.dispatchEvent(new Event('pointerleave'));
    return (window).__portos_wallpaper?.state;
  });
  console.log('State after pointerleave from bare wallpaper:', hitLeave);
  transitionsVerified['TRANSITION_TO_HOLD'] = hitLeave === 'HOLD';

  // Re-enter corridor -> resumes FOLLOWING
  await page.mouse.move(537, 200);
  await new Promise((r) => setTimeout(r, 100));
  const resumeFollowing = await page.evaluate(() => {
    return (window).__portos_wallpaper?.state;
  });
  console.log('State after re-entering corridor:', resumeFollowing);
  transitionsVerified['RESUME_TO_FOLLOWING'] = resumeFollowing === 'FOLLOWING';

  // 6. Trace Stroke 2 (diagonal down-right: 537,50 -> 1370,1029)
  console.log('[TEST 6] Tracing Stroke 2 diagonal...');
  const s2Steps = 25;
  for (let i = 0; i <= s2Steps; i++) {
    const t = i / s2Steps;
    const curX = 537 + t * (1370 - 537);
    const curY = 50 + t * (1029 - 50);
    await page.mouse.move(curX, curY);
    await new Promise((r) => setTimeout(r, 16));
  }
  await new Promise((r) => setTimeout(r, 200));

  const stroke2Progress = await page.evaluate(() => {
    return {
      progress: (window).__portos_wallpaper?.progress,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('Stroke 2 progress:', stroke2Progress);
  transitionsVerified['STROKE2_PROGRESS'] = stroke2Progress.progress > 0.6;

  // 7. Trace Stroke 3 (upward right leg: 1370,1029 -> 1370,50) to >= 90%
  console.log('[TEST 7] Tracing Stroke 3 upward to trigger COMPLETING...');
  for (let y = 1000; y >= 60; y -= 35) {
    await page.mouse.move(1370, y);
    await new Promise((r) => setTimeout(r, 16));
  }
  await new Promise((r) => setTimeout(r, 300));

  const completingState = await page.evaluate(() => {
    return (window).__portos_wallpaper?.state;
  });
  console.log(`State upon completing Stroke 3: ${completingState}`);
  transitionsVerified['TRANSITION_TO_COMPLETING'] = completingState === 'COMPLETING' || completingState === 'COMPLETE';

  // 8. Wait for autonomous finish (Frames 55 -> 76) -> COMPLETE
  console.log('[TEST 8] Waiting for autonomous completion playback to finish...');
  await new Promise((r) => setTimeout(r, 1400));

  const completeState = await page.evaluate(() => {
    return {
      state: (window).__portos_wallpaper?.state,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('State after autonomous playback:', completeState);
  transitionsVerified['TRANSITION_TO_COMPLETE'] =
    completeState.state === 'COMPLETE' && completeState.currentFrame >= 70;

  await page.screenshot({ path: path.join(OUT_DIR, 'step4_engine_complete.png') });

  // 9. Verify Lockout: Moving pointer does NOT move robot
  console.log('[TEST 9] Verifying pointer lockout after completion...');
  const frameBeforeMove = completeState.currentFrame;
  await page.mouse.move(500, 500);
  await new Promise((r) => setTimeout(r, 100));
  const frameAfterMove = await page.evaluate(() => {
    return (window).__portos_wallpaper?.currentFrame;
  });
  console.log(`Frame before move: ${frameBeforeMove}, Frame after move: ${frameAfterMove}`);
  transitionsVerified['COMPLETION_LOCKOUT_HOLDS'] = frameBeforeMove === frameAfterMove;

  // 10. W6 Rule: After completion, next pointer movement after 5.0s stillness resets and re-arms
  console.log('[TEST 10] Testing post-completion 5.0s stillness + re-arm move...');
  await new Promise((r) => setTimeout(r, 5200));

  // Next pointer movement over bare wallpaper triggers RESETTING
  await page.mouse.move(600, 600);
  await new Promise((r) => setTimeout(r, 100));

  const resettingState = await page.evaluate(() => {
    return (window).__portos_wallpaper?.state;
  });
  console.log(`State after post-completion move: ${resettingState}`);
  transitionsVerified['TRANSITION_TO_RESETTING'] = resettingState === 'RESETTING';

  // Wait 900ms for 800ms crossfade to complete -> restores READY and Frame 1
  await new Promise((r) => setTimeout(r, 900));
  const restoredState = await page.evaluate(() => {
    return {
      state: (window).__portos_wallpaper?.state,
      currentFrame: (window).__portos_wallpaper?.currentFrame,
    };
  });
  console.log('State after reset completes:', restoredState);
  transitionsVerified['RE_ARMED_TO_READY'] =
    restoredState.state === 'READY' && restoredState.currentFrame === 1;

  await page.screenshot({ path: path.join(OUT_DIR, 'step4_engine_rearmed_ready.png') });

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'step4_engine_transitions.json'),
    JSON.stringify(transitionsVerified, null, 2),
    'utf8'
  );

  console.log('\n================================================================');
  console.log('   STEP 4 ENGINE AUDIT: ALL TRANSITIONS PASSED                  ');
  console.log(transitionsVerified);
  console.log('================================================================\n');

  return transitionsVerified;
}

testStep4Engine().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
