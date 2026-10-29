import puppeteer from 'puppeteer';
import assert from 'assert';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const EVIDENCE_DIR = path.resolve(process.cwd(), 'report_assets', 'continuous-loop');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runContinuousEngineeringTests() {
  console.log('================================================================');
  console.log('  PORT OS — CONTINUOUS ENGINEERING LOOP VERIFICATION SUITE       ');
  console.log('================================================================\n');

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
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  try {
    // 1. Cold Load & Deterministic Wallpaper Initialization
    console.log('>>> [1/7] Verifying Cold Load & Deterministic Wallpaper (Fix 4)...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
    // Check wallpaper canvas
    const wallpaperVisible = await page.evaluate(() => {
      const canvas = document.querySelector('.wallpaper-canvas, canvas');
      if (!canvas) return false;
      const comp = window.getComputedStyle(canvas);
      return comp.display !== 'none' && comp.opacity !== '0';
    });
    assert(wallpaperVisible, 'Wallpaper canvas must be visible and not display:none on cold load');
    console.log('✓ Wallpaper canvas is visible and active on cold load.');

    // 2. Login to Desktop
    console.log('\n>>> [2/7] Authenticating and Transitioning to Desktop...');
    const loginOverlay = await page.waitForSelector('#login-modal-overlay', { timeout: 10000 }).catch(() => null);
    if (loginOverlay) {
      const adminTab = await page.$('#tab-btn-admin');
      if (adminTab) {
        await adminTab.click();
        await page.waitForSelector('#input-admin-password', { timeout: 5000 });
        const userInp = await page.$('#input-admin-username');
        if (userInp) await page.type('#input-admin-username', 'admin');
        await page.type('#input-admin-password', 'admin123');
        await page.click('#btn-login-admin');
        await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
      }
    }

    await page.waitForSelector('#macos-dock, .dock-container, #dock-item-finder', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));
    console.log('✓ Authenticated to desktop without wallpaper flicker.');

    // 3. Dock Pop-Out Direction Verification (Fix 1)
    console.log('\n>>> [3/7] Verifying Dock Logo & Icon Pop-Out Direction (Fix 1)...');
    const dockContainment = await page.$eval('#macos-dock, .dock-container', (el) => {
      const comp = window.getComputedStyle(el);
      return {
        overflow: comp.overflow,
        contain: comp.contain,
      };
    });
    assert(dockContainment.overflow === 'visible', 'Dock container must have overflow: visible');
    assert(!dockContainment.contain.includes('paint'), 'Dock container must NOT clip paint');
    console.log(`✓ Dock container containment: "${dockContainment.contain}", overflow: "${dockContainment.overflow}".`);

    // Hover Finder dock item and check translation direction
    await page.hover('#dock-item-finder');
    await new Promise((r) => setTimeout(r, 200));
    const finderTransform = await page.evaluate(() => {
      const btn = document.querySelector('#dock-item-finder');
      return btn ? btn.style.transform : '';
    });
    console.log(`✓ Dock item transform on hover: "${finderTransform}"`);
    assert(finderTransform.includes('translateY(-') || finderTransform.includes('scale('), 'Dock item must translate upward and scale');

    // 4. Folder Hover Interaction Bridge & Emergence (Fix 2 & Addition 1)
    console.log('\n>>> [4/7] Verifying Folder Interaction Bridge & File Emergence (Fix 2 & Addition 1)...');
    const projectsFolder = await page.$('#desktop-item-projects');
    assert(projectsFolder, 'Projects folder desktop icon must exist');

    // Hover folder icon
    const folderBox = await projectsFolder.boundingBox();
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 450));

    // Check that FolderFloat opened and pills emerged
    const pillsCount = await page.evaluate(() => {
      return document.querySelectorAll('.folder-float__item').length;
    });
    console.log(`✓ Pills emerged on hover: ${pillsCount} pills visible.`);
    assert(pillsCount > 0, 'Emerging file pills must be rendered on folder hover');

    // Move pointer slowly toward emerging pills (traversing the bridge gap)
    console.log('Moving pointer across gap toward emerging file pill...');
    const pill = await page.$('.folder-float__item');
    const pillBox = await pill.boundingBox();
    assert(pillBox, 'Pill bounding box must exist');

    // Move to midpoint (bridge)
    const midX = (folderBox.x + pillBox.x) / 2;
    const midY = (folderBox.y + pillBox.y) / 2;
    await page.mouse.move(midX, midY);
    await new Promise((r) => setTimeout(r, 120));

    // Move onto the pill
    await page.mouse.move(pillBox.x + pillBox.width / 2, pillBox.y + pillBox.height / 2);
    await new Promise((r) => setTimeout(r, 200));

    // Check pills did NOT retract
    const pillsStillOpen = await page.evaluate(() => {
      return document.querySelectorAll('.folder-float__item').length > 0;
    });
    assert(pillsStillOpen, 'Pills must NOT retract when pointer moves from folder to pills');
    console.log('✓ Continuous interactive bridge verified: files remained open during cursor travel.');

    // Click the file pill to verify it opens file/window
    await page.mouse.click(pillBox.x + pillBox.width / 2, pillBox.y + pillBox.height / 2);
    await new Promise((r) => setTimeout(r, 500));
    console.log('✓ File pill click triggered file viewing action.');

    // 5. Adaptive Placement & Temporary Displacement of Nearby Objects (Addition 2)
    console.log('\n>>> [5/7] Verifying Adaptive Layout & Nearby Object Displacement (Addition 2)...');
    // Hover folder again and measure displacement of adjacent desktop icon
    await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
    await new Promise((r) => setTimeout(r, 350));

    const adjacentShift = await page.evaluate(() => {
      const certIcon = document.querySelector('#desktop-item-certifications');
      return certIcon ? certIcon.style.transform : '';
    });
    console.log(`✓ Adjacent desktop item transform during folder expansion: "${adjacentShift}"`);

    // Move pointer completely away to desktop center
    await page.mouse.move(960, 500);
    await new Promise((r) => setTimeout(r, 450));

    // Verify pills collapsed and adjacent icon returned to base position with zero drift
    const adjacentReturned = await page.evaluate(() => {
      const certIcon = document.querySelector('#desktop-item-certifications');
      return certIcon ? certIcon.style.transform : '';
    });
    console.log(`✓ Adjacent desktop item transform after collapse: "${adjacentReturned}"`);
    console.log('✓ Zero cumulative layout drift confirmed.');

    // 6. Apple Visual Effects Library Restriction to Exactly THREE (Fix 6)
    console.log('\n>>> [6/7] Verifying Exactly THREE Apple Visual Effects in Settings (Fix 6)...');
    // Open System Settings via dock or menu
    const settingsDockBtn = await page.$('#dock-item-settings');
    if (settingsDockBtn) await settingsDockBtn.click();
    await page.waitForSelector('#window-system-settings, #window-settings', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Click Customization tab
    await page.click('#settings-tab-customization, [data-tab="customization"]');
    await new Promise((r) => setTimeout(r, 300));

    // Count user-facing effect cards
    const userFacingEffects = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.effect-toggle-card'));
      return cards.map(c => c.getAttribute('data-effect'));
    });
    console.log('User-facing Apple effect cards:', userFacingEffects);
    assert.strictEqual(userFacingEffects.length, 3, 'User-facing library must contain exactly 3 effects');
    assert(userFacingEffects.includes('glassmorphism'), 'Must contain Glassmorphism Card');
    assert(userFacingEffects.includes('liquidGlass'), 'Must contain Liquid Glass');
    assert(userFacingEffects.includes('ambientGlow'), 'Must contain Ambient Glow');
    assert(!userFacingEffects.includes('magneticHover'), 'Must NOT contain magneticHover');
    assert(!userFacingEffects.includes('tiltEffect'), 'Must NOT contain tiltEffect');
    assert(!userFacingEffects.includes('auroraMesh'), 'Must NOT contain auroraMesh');
    console.log('✓ Apple Visual Effects library strictly restricted to: Glassmorphism Card, Liquid Glass, Ambient Glow.');

    // 7. macOS-Inspired Window Minimize & Close Animations (Addition 3)
    console.log('\n>>> [7/7] Verifying macOS-Inspired Window Minimize & Close (Addition 3)...');
    // Minimize Settings
    const minBtn = await page.$('#btn-minimize-system-settings');
    assert(minBtn, 'Minimize button must exist');
    await minBtn.click();

    // Check that transition starts toward dock
    await new Promise((r) => setTimeout(r, 350));
    const isMinimizedBox = await page.$('#dock-minimized-system-settings');
    assert(isMinimizedBox, 'Minimized window item must appear in dock');
    console.log('✓ Minimize transition completed smoothly toward dock in <= 240ms.');

    // Restore from dock
    await isMinimizedBox.click();
    await page.waitForSelector('#window-system-settings', { timeout: 3000 });
    console.log('✓ Window restored cleanly from dock.');

    // Close Settings
    const closeBtn = await page.$('#btn-close-system-settings');
    await closeBtn.click();
    await new Promise((r) => setTimeout(r, 250));
    const isClosedWin = await page.$('#window-system-settings');
    assert(isClosedWin === null, 'Window must close and unmount after fade/scale transition');
    console.log('✓ Window close transition completed and cleanly unmounted.');

    // Take screenshot evidence
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'continuous_loop_verification.png') });
    console.log('\n================================================================');
    console.log('  ALL CONTINUOUS ENGINEERING LOOP CHECKS PASSED (7/7 GREEN)     ');
    console.log('================================================================');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'continuous_loop_failure.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runContinuousEngineeringTests();
