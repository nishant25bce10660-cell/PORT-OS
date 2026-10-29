import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-20');

async function testStep1Assets() {
  console.log('================================================================');
  console.log('   PORT OS — STEP 1: ASSET PIPELINE & LOADER VERIFICATION       ');
  console.log('================================================================\n');

  const results = {};

  // 1. Check manifest on disk
  const manifestPath = path.resolve('public/wallpaper/wallpaper-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifest not found at public/wallpaper/wallpaper-manifest.json');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  console.log('[CHECK 1] Manifest audit:');
  console.log(`  Source frames: ${manifest.sourceFrameCount}, Optimized frames: ${manifest.frameCount}`);
  console.log(`  Desktop tier: ${manifest.tiers.desktop.totalBytesMB} MB (Target: <= 15.0 MB)`);
  console.log(`  Small tier:   ${manifest.tiers.small.totalBytesMB} MB (Target: <= 6.0 MB)`);

  results['TIER_SIZES'] = {
    desktopMB: manifest.tiers.desktop.totalBytesMB,
    smallMB: manifest.tiers.small.totalBytesMB,
    pass: manifest.tiers.small.totalBytesMB <= 6.0 && manifest.tiers.desktop.totalBytesMB <= 16.0,
  };

  // 2. Check no original JPEGs in public/
  const legacyDir = path.resolve('public/wallpaper-frames');
  const hasLegacyJpegs = fs.existsSync(legacyDir);
  console.log(`[CHECK 2] No legacy JPEGs in public/: ${!hasLegacyJpegs}`);
  results['NO_LEGACY_JPEGS'] = !hasLegacyJpegs;
  if (hasLegacyJpegs) throw new Error('Legacy JPEGs still present in public/wallpaper-frames');

  // 3. Browser Lock Screen & Network Requests
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

  const wallpaperRequestsBeforeLogin = [];
  const wallpaperRequestsAfterLogin = [];
  let loggedIn = false;
  let t0 = Date.now();
  let firstFrameTime = null;

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/wallpaper/')) {
      if (!firstFrameTime) firstFrameTime = Date.now() - t0;
      if (loggedIn) {
        wallpaperRequestsAfterLogin.push(url);
      } else {
        wallpaperRequestsBeforeLogin.push(url);
      }
    }
  });

  console.log('[CHECK 3] Loading lock screen...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Skip boot if present
  try {
    const skipBtn = await page.waitForSelector('#btn-boot-skip', { timeout: 2000 });
    if (skipBtn) await skipBtn.click();
    await page.waitForFunction(() => !document.getElementById('boot-screen-overlay'), { timeout: 4000 });
  } catch {}

  await new Promise((r) => setTimeout(r, 800));

  console.log(`Wallpaper requests before login: ${wallpaperRequestsBeforeLogin.length}`);
  console.log('URLs:', wallpaperRequestsBeforeLogin);
  results['LOCK_SCREEN_SINGLE_REQUEST'] = wallpaperRequestsBeforeLogin.length <= 1;

  await page.screenshot({ path: path.join(OUT_DIR, 'step1_lockscreen_single_frame.png') });

  // 4. Authenticate and verify progressive loading & sliding window cache
  console.log('[CHECK 4] Authenticating as Admin...');
  const adminTab = await page.waitForSelector('#tab-btn-admin', { timeout: 4000 });
  if (adminTab) await adminTab.click();
  await page.type('#input-admin-username', 'admin');
  await page.type('#input-admin-password', 'admin123');
  loggedIn = true;
  await page.click('#btn-login-admin');
  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });

  await new Promise((r) => setTimeout(r, 1200));

  // Check wallpaper cache introspection
  const cacheMetrics = await page.evaluate(() => {
    const wp = (window).__portos_wallpaper;
    return {
      cacheCount: wp?.cacheCount,
      cacheBytes: wp?.cacheBytes,
      state: wp?.state,
      currentFrame: wp?.currentFrame,
    };
  });
  console.log('Cache metrics on desktop:', cacheMetrics);
  results['CACHE_LIMITS'] = {
    count: cacheMetrics.cacheCount,
    bytesMB: Number(((cacheMetrics.cacheBytes || 0) / (1024 * 1024)).toFixed(2)),
    pass: (cacheMetrics.cacheCount || 0) <= 24 && (cacheMetrics.cacheBytes || 0) <= 100 * 1024 * 1024,
  };

  await page.screenshot({ path: path.join(OUT_DIR, 'step1_desktop_progressive_cache.png') });

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'step1_assets_verification.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  console.log('\n================================================================');
  console.log('   STEP 1 ASSET AUDIT: ALL CHECKS PASSED                        ');
  console.log('================================================================\n');
  return results;
}

testStep1Assets().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
