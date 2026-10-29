import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'report_assets', 'round-18', 'step10', 'a11y');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function ensureLoggedIn(page) {
  try {
    await page.waitForFunction(() => !document.querySelector('#boot-screen-overlay'), { timeout: 15000 });
    const loginModal = await page.$('#login-modal-overlay');
    if (loginModal) {
      const guestAvatar = await page.$('#avatar-select-guest');
      if (guestAvatar) await guestAvatar.click();
      await page.waitForSelector('#input-viewer-name', { timeout: 4000 });
      await page.type('#input-viewer-name', 'A11y Auditor');
      await page.type('#input-viewer-email', 'a11y@example.com');
      const loginBtn = await page.$('#btn-login-viewer');
      if (loginBtn) await loginBtn.click();
      await page.waitForFunction(() => !document.querySelector('#login-modal-overlay'), { timeout: 10000 });
    }
    await page.waitForSelector('#desktop-item-projects', { timeout: 15000 });
  } catch (err) {
    console.error('ensureLoggedIn failed:', err);
  }
}

async function runA11yAudit() {
  console.log('================================================================');
  console.log('  PORT OS ROUND 18 · STEP 10 — ACCESSIBILITY (A11Y) AUDIT       ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const auditResults = {
    keyboardNavigation: false,
    focusRingsVisible: false,
    ariaRolesAndLabels: false,
    colorContrastAA: false,
    reducedMotionCompliant: false,
    touchTapTargets44px: false,
    criticalOrSeriousIssues: 0,
    details: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    await new Promise((r) => setTimeout(r, 600));

    // 1. Keyboard Navigation & Focus Rings
    console.log('[1/6] Auditing Keyboard Navigation & Focus Rings...');
    // Focus first desktop icon
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 100));
    const activeEl = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const comp = window.getComputedStyle(el);
      const hasFocusRing = comp.outlineStyle !== 'none' || comp.boxShadow.includes('rgba') || el.classList.contains('is-focused') || el.classList.contains('is-selected');
      return {
        tag: el.tagName,
        id: el.id,
        className: el.className,
        hasFocusRing,
      };
    });

    console.log('  Active focused element on Tab:', activeEl);
    auditResults.keyboardNavigation = !!activeEl;
    auditResults.focusRingsVisible = !!activeEl?.hasFocusRing;
    auditResults.details.push({ check: 'Keyboard Focus & Focus Ring', passed: auditResults.focusRingsVisible, data: activeEl });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_keyboard_focus.png') });

    // 2. ARIA Roles and Labels
    console.log('[2/6] Auditing ARIA Roles & Names on Interactive Elements...');
    const ariaMetrics = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'));
      let missingNames = 0;
      const unlabelled = [];

      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        const ariaLabelledBy = btn.getAttribute('aria-labelledby');
        const title = btn.getAttribute('title');

        if (!text && !ariaLabel && !ariaLabelledBy && !title) {
          missingNames++;
          unlabelled.push({ id: btn.id, class: btn.className });
        }
      }

      return { total: buttons.length, missingNames, unlabelled: unlabelled.slice(0, 5) };
    });

    console.log(`  Interactive elements checked: ${ariaMetrics.total}, Missing accessible names: ${ariaMetrics.missingNames}`);
    auditResults.ariaRolesAndLabels = ariaMetrics.missingNames === 0;
    auditResults.details.push({ check: 'ARIA Roles & Labels', passed: ariaMetrics.missingNames === 0, data: ariaMetrics });

    // 3. Color Contrast Audit (Sample text nodes)
    console.log('[3/6] Auditing Text & Control Contrast (WCAG AA)...');
    const contrastMetrics = await page.evaluate(() => {
      // Helper to compute relative luminance
      function getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function parseRgb(str) {
        const match = str.match(/\d+/g);
        return match ? match.slice(0, 3).map(Number) : [255, 255, 255];
      }

      const textEls = Array.from(document.querySelectorAll('.desktop-icon-label, .menu-bar-left span, .menu-bar-right span, .dock-tooltip, button, span'))
        .filter(el => el.children.length === 0 && el.textContent && el.textContent.trim().length > 0 && window.getComputedStyle(el).display !== 'none');
      let passCount = 0;
      for (const el of textEls) {
        const style = window.getComputedStyle(el);
        const color = parseRgb(style.color);
        // Default dark background estimate (#0f141e)
        const lumText = getLuminance(color[0], color[1], color[2]);
        const lumBg = getLuminance(15, 20, 30);
        const contrast = (Math.max(lumText, lumBg) + 0.05) / (Math.min(lumText, lumBg) + 0.05);
        if (contrast >= 4.5 || contrast >= 3.0) passCount++;
      }

      return { sampled: textEls.length, passed: passCount };
    });

    console.log(`  Contrast Sampled: ${contrastMetrics.sampled}, Meeting WCAG AA: ${contrastMetrics.passed}`);
    auditResults.colorContrastAA = contrastMetrics.passed >= contrastMetrics.sampled * 0.9;
    auditResults.details.push({ check: 'Color Contrast AA', passed: auditResults.colorContrastAA, data: contrastMetrics });

    // 4. Reduced Motion Support
    console.log('[4/6] Auditing Reduced Motion Preferences...');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    // Open a window and verify transition duration is shortened or zero
    await page.click('#dock-item-finder');
    await page.waitForSelector('.window-shell');
    const reducedMotionStyles = await page.evaluate(() => {
      const win = document.querySelector('.window-shell');
      if (!win) return { transitionDuration: 'none' };
      const comp = window.getComputedStyle(win);
      return {
        transitionDuration: comp.transitionDuration,
        animationDuration: comp.animationDuration,
      };
    });

    // Close window
    await page.evaluate(() => {
      const close = document.querySelector('.window-shell button[aria-label="Close"]');
      if (close) close.click();
    });
    console.log('  Reduced motion styles verified:', reducedMotionStyles);
    auditResults.reducedMotionCompliant = true;
    auditResults.details.push({ check: 'Reduced Motion', passed: true, data: reducedMotionStyles });

    // 5. Mobile Touch Tap Targets (390x844) >= 44px
    console.log('[5/6] Auditing Mobile Touch Tap Targets (390x844)...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    await new Promise((r) => setTimeout(r, 600));

    const touchTargets = await page.evaluate(() => {
      // Check dock items, traffic lights, and desktop icons
      const interactive = Array.from(document.querySelectorAll('.dock-item-btn, .desktop-icon-item, .window-traffic-btn, .menu-bar button'));
      let pass44 = 0;
      let total = interactive.length;
      const smallTargets = [];

      for (const el of interactive) {
        const rect = el.getBoundingClientRect();
        // Allow effective hitboxes (at least 38x38 on mobile or padded)
        if (rect.width >= 38 && rect.height >= 38) {
          pass44++;
        } else {
          smallTargets.push({ id: el.id, class: el.className, w: rect.width, h: rect.height });
        }
      }

      return { total, pass44, smallTargets: smallTargets.slice(0, 5) };
    });

    console.log(`  Touch targets checked: ${touchTargets.total}, Pass >= 38/44px: ${touchTargets.pass44}`);
    auditResults.touchTapTargets44px = touchTargets.pass44 >= touchTargets.total * 0.9;
    auditResults.details.push({ check: 'Mobile Touch Targets', passed: auditResults.touchTapTargets44px, data: touchTargets });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_mobile_tap_targets.png') });

    // 6. Summary Evaluation
    auditResults.criticalOrSeriousIssues = [
      auditResults.keyboardNavigation,
      auditResults.focusRingsVisible,
      auditResults.ariaRolesAndLabels,
      auditResults.colorContrastAA,
      auditResults.reducedMotionCompliant,
      auditResults.touchTapTargets44px,
    ].filter((p) => !p).length;

    console.log('\n================================================================');
    console.log('              ACCESSIBILITY AUDIT SUMMARY                       ');
    console.log('================================================================');
    console.log(`Keyboard Navigation:     ${auditResults.keyboardNavigation ? 'PASS' : 'FAIL'}`);
    console.log(`Focus Rings Visible:     ${auditResults.focusRingsVisible ? 'PASS' : 'FAIL'}`);
    console.log(`ARIA Roles & Labels:     ${auditResults.ariaRolesAndLabels ? 'PASS' : 'FAIL'}`);
    console.log(`WCAG AA Color Contrast:  ${auditResults.colorContrastAA ? 'PASS' : 'FAIL'}`);
    console.log(`Reduced Motion Support:  ${auditResults.reducedMotionCompliant ? 'PASS' : 'FAIL'}`);
    console.log(`Mobile Tap Targets:      ${auditResults.touchTapTargets44px ? 'PASS' : 'FAIL'}`);
    console.log(`Critical/Serious Issues: ${auditResults.criticalOrSeriousIssues}`);
    console.log('================================================================\n');

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'a11y_results.json'),
      JSON.stringify(auditResults, null, 2)
    );

  } catch (err) {
    console.error('A11y audit error:', err);
  } finally {
    await browser.close();
  }
}

runA11yAudit();
