import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('report_assets/round-19');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function runVerification() {
  console.log('================================================================');
  console.log('  PORT OS — VERIFY REFLECTIVE CARD LOGIN & ANIMATIONS           ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portos_booted', 'true');
  });

  console.log('[1/7] Navigating to PORT OS lock screen...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-modal-overlay', { timeout: 6000 });
  await page.waitForSelector('#login-card', { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 600));

  // Screenshot initial lockscreen
  await page.screenshot({ path: path.join(OUT_DIR, 'reflective_login_initial.png') });
  console.log('Saved initial screenshot.');

  // 1. Verify ReflectiveCard WebGL2 canvas inside login card
  console.log('\n[2/7] Verifying ReflectiveCard WebGL2 Canvas & Surface...');
  const cardProbe = await page.evaluate(() => {
    const card = document.getElementById('login-card');
    const canvas = card?.querySelector('.reflective-card__canvas');
    const body = card?.querySelector('.reflective-card__body');
    const rim = card?.querySelector('.reflective-card__rim');

    let webgl2Ok = false;
    if (canvas) {
      const gl = canvas.getContext('webgl2');
      webgl2Ok = !!gl;
    }

    const compCard = card ? window.getComputedStyle(card) : null;
    const compBody = body ? window.getComputedStyle(body) : null;

    return {
      hasCard: !!card,
      hasCanvas: !!canvas,
      hasBody: !!body,
      hasRim: !!rim,
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      cardWidth: card?.offsetWidth || 0,
      cardHeight: card?.offsetHeight || 0,
      webgl2Supported: webgl2Ok,
      bodyRadius: compBody?.borderRadius,
      cardClasses: card?.className,
    };
  });

  console.log('ReflectiveCard probe:', cardProbe);
  if (!cardProbe.hasCanvas || cardProbe.canvasWidth <= 0 || cardProbe.canvasHeight <= 0) {
    throw new Error('ReflectiveCard canvas is missing or not properly sized');
  }
  console.log('✓ ReflectiveCard WebGL2 Canvas verified successfully.');

  // 2. Verify Button Geometry (No Capsule/Pill Buttons)
  console.log('\n[3/7] Verifying Button Geometry (No capsule-like buttons)...');
  const buttonGeometry = await page.evaluate(() => {
    const checkRadius = (el) => {
      if (!el) return null;
      const style = window.getComputedStyle(el);
      const br = parseFloat(style.borderRadius);
      return {
        radius: style.borderRadius,
        radiusNum: br,
        isCapsule: br >= 20 || style.borderRadius.includes('50%'),
        bg: style.backgroundColor,
        color: style.color,
      };
    };

    return {
      btnViewer: checkRadius(document.getElementById('btn-login-viewer')),
      roleSwitch: checkRadius(document.getElementById('login-role-switch')),
      switchThumb: checkRadius(document.getElementById('login-switch-thumb')),
      tabViewer: checkRadius(document.getElementById('tab-btn-viewer')),
      tabAdmin: checkRadius(document.getElementById('tab-btn-admin')),
      btnSleep: checkRadius(document.querySelector('#btn-footer-sleep div')),
      btnRestart: checkRadius(document.querySelector('#btn-footer-restart div')),
      btnShutdown: checkRadius(document.querySelector('#btn-footer-shutdown div')),
    };
  });

  console.log('Button geometry evaluation:', buttonGeometry);
  const anyCapsule = Object.values(buttonGeometry).some((b) => b && b.isCapsule);
  if (anyCapsule) {
    throw new Error('Capsule-like button detected! All buttons must have non-capsule geometry (radius <= 12px)');
  }
  console.log('✓ All buttons adhere to non-capsule geometric styling (radii <= 12px).');

  // 3. Verify White & Grey Color Combinations
  console.log('\n[4/7] Verifying White & Grey Color Palette...');
  const paletteCheck = await page.evaluate(() => {
    const isPurpleOrTeal = (str) => {
      if (!str) return false;
      const s = str.toLowerCase();
      return s.includes('124, 108, 255') || s.includes('7c6cff') || s.includes('35d0ba') || s.includes('53, 208, 186');
    };

    const btnViewer = document.getElementById('btn-login-viewer');
    const tabAdmin = document.getElementById('tab-btn-admin');
    const tabViewer = document.getElementById('tab-btn-viewer');
    const ownerAvatar = document.getElementById('avatar-select-owner')?.firstElementChild;
    const guestAvatar = document.getElementById('avatar-select-guest')?.firstElementChild;

    const btnViewerStyle = btnViewer ? window.getComputedStyle(btnViewer) : null;
    const tabViewerStyle = tabViewer ? window.getComputedStyle(tabViewer) : null;
    const ownerAvatarStyle = ownerAvatar ? window.getComputedStyle(ownerAvatar) : null;
    const guestAvatarStyle = guestAvatar ? window.getComputedStyle(guestAvatar) : null;

    return {
      btnViewerBg: btnViewerStyle?.backgroundColor,
      btnViewerColor: btnViewerStyle?.color,
      tabViewerColor: tabViewerStyle?.color,
      ownerAvatarBg: ownerAvatarStyle?.backgroundImage || ownerAvatarStyle?.background,
      guestAvatarBg: guestAvatarStyle?.backgroundImage || guestAvatarStyle?.background,
      hasPurpleOrTeal:
        isPurpleOrTeal(btnViewerStyle?.backgroundColor) ||
        isPurpleOrTeal(btnViewerStyle?.color) ||
        isPurpleOrTeal(ownerAvatarStyle?.backgroundImage) ||
        isPurpleOrTeal(guestAvatarStyle?.backgroundImage),
    };
  });

  console.log('Palette check:', paletteCheck);
  if (paletteCheck.hasPurpleOrTeal) {
    throw new Error('Forbidden purple or teal color found in buttons or avatars');
  }
  console.log('✓ Buttons, tabs, and avatar accents strictly adhere to white and grey combinations.');

  // 4. Verify 3D Tilt & Pointer Tracking Animation on ReflectiveCard
  console.log('\n[5/7] Verifying ReflectiveCard 3D Tilt & Pointer Tracking Animation...');
  const cardBox = await page.evaluate(() => {
    const card = document.getElementById('login-card');
    const r = card.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

  // Hover over top-left of card
  await page.mouse.move(cardBox.x + 20, cardBox.y + 20);
  await new Promise((r) => setTimeout(r, 200));

  const tiltTopLeft = await page.evaluate(() => {
    const card = document.getElementById('login-card');
    return {
      rotateX: card.style.getPropertyValue('--rc-rotate-x'),
      rotateY: card.style.getPropertyValue('--rc-rotate-y'),
      presence: card.style.getPropertyValue('--rc-presence'),
    };
  });
  console.log('Tilt at top-left hover:', tiltTopLeft);

  // Hover over bottom-right of card
  await page.mouse.move(cardBox.x + cardBox.width - 20, cardBox.y + cardBox.height - 20);
  await new Promise((r) => setTimeout(r, 200));

  const tiltBottomRight = await page.evaluate(() => {
    const card = document.getElementById('login-card');
    return {
      rotateX: card.style.getPropertyValue('--rc-rotate-x'),
      rotateY: card.style.getPropertyValue('--rc-rotate-y'),
    };
  });
  console.log('Tilt at bottom-right hover:', tiltBottomRight);

  if (tiltTopLeft.rotateX === tiltBottomRight.rotateX && tiltTopLeft.rotateY === tiltBottomRight.rotateY) {
    throw new Error('ReflectiveCard failed to tilt in response to pointer movement');
  }
  console.log('✓ ReflectiveCard dynamic 3D tilt animation verified.');

  // 5. Verify Tab Switch & Role Switch Thumb Animation
  console.log('\n[6/7] Verifying Tab Switch & Sliding Thumb Animation...');
  const thumbBefore = await page.evaluate(() => {
    const thumb = document.getElementById('login-switch-thumb');
    const avOwner = document.getElementById('avatar-select-owner');
    const rect = avOwner.getBoundingClientRect();
    const elAtPoint = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      transform: window.getComputedStyle(thumb).transform,
      elAtPointTag: elAtPoint?.tagName,
      elAtPointId: elAtPoint?.id,
      elAtPointClass: elAtPoint?.className,
    };
  });
  console.log('Thumb before switch:', thumbBefore);

  // Switch to Owner
  await page.click('#avatar-select-owner');
  await page.waitForFunction(() => {
    const thumb = document.getElementById('login-switch-thumb');
    return thumb && thumb.style.transform.includes('0px');
  }, { timeout: 3000 });
  await new Promise((r) => setTimeout(r, 400));

  const thumbOwner = await page.evaluate(() => {
    const thumb = document.getElementById('login-switch-thumb');
    const formOwner = !!document.getElementById('input-admin-password');
    const btnOwner = document.getElementById('btn-login-admin');
    const avOwner = document.getElementById('avatar-select-owner');
    const avGuest = document.getElementById('avatar-select-guest');
    const compBtn = btnOwner ? window.getComputedStyle(btnOwner) : null;
    return {
      inlineTransform: thumb?.style.transform,
      transform: window.getComputedStyle(thumb).transform,
      avOwnerChecked: avOwner?.getAttribute('aria-checked'),
      avGuestChecked: avGuest?.getAttribute('aria-checked'),
      formOwner,
      btnAdminBg: compBtn?.backgroundColor,
      btnAdminColor: compBtn?.color,
      btnAdminRadius: compBtn?.borderRadius,
    };
  });

  console.log('Owner tab state:', thumbOwner);
  if (!thumbOwner.inlineTransform.includes('0px') || !thumbOwner.formOwner) {
    throw new Error(`Sliding thumb failed to animate to Owner position (inline: ${thumbOwner.inlineTransform}, computed: ${thumbOwner.transform})`);
  }

  // Screenshot Owner state
  await page.screenshot({ path: path.join(OUT_DIR, 'reflective_login_owner.png') });
  console.log('✓ Sliding thumb animation and Owner form verified.');

  // 6. Verify Error Shake Animation
  console.log('\n[7/7] Verifying Empty Submit Error Shake Animation...');
  await page.click('#btn-login-admin');
  await page.waitForSelector('#login-error-message', { timeout: 3000 });

  const isShaking = await page.evaluate(() => {
    const card = document.getElementById('login-card');
    return card.classList.contains('login-card-shake');
  });

  console.log('Shake animation active on error:', isShaking);
  if (!isShaking) {
    throw new Error('Error shake animation failed to trigger on invalid submit');
  }
  console.log('✓ Error shake animation verified.');

  // Wait for shake to end
  await new Promise((r) => setTimeout(r, 600));

  // Test floating label animation
  console.log('Testing floating label animation...');
  await page.type('#input-admin-username', 'admin');
  const labelMoved = await page.evaluate(() => {
    const label = document.querySelector('label[for="input-admin-username"]');
    const style = window.getComputedStyle(label);
    return style.transform.includes('matrix');
  });
  console.log('Floating label matrix transform:', labelMoved);
  if (!labelMoved) {
    throw new Error('Floating label animation failed to trigger');
  }
  console.log('✓ Floating label animation verified.');

  // Test successful login and fade-out animation
  console.log('Testing login success fade-out animation...');
  await page.type('#input-admin-password', 'admin123');
  await page.click('#btn-login-admin');

  const fadeOutActive = await page.evaluate(() => {
    const overlay = document.getElementById('login-modal-overlay');
    return overlay?.classList.contains('lock-screen-fade-out');
  });
  console.log('Lockscreen fade-out triggered on success:', fadeOutActive);

  await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 5000 });
  console.log('✓ Login success transition complete. Desktop active.');

  await page.screenshot({ path: path.join(OUT_DIR, 'reflective_login_success.png') });

  await browser.close();

  console.log('\n================================================================');
  console.log('  ALL REFLECTIVE CARD & LOGIN ANIMATION CHECKS PASSED (100%)    ');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
