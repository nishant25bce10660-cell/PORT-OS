// scripts/devtools/a11y-audit.mjs
// Phase 3 — Accessibility Audit (M21) based on /a11y-debugging guidelines
// Audits Lock Screen, Desktop, Finder (4 views), Settings (all tabs), Terminal, Context Menu, Mobile (390px)

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const APP_URL = 'http://localhost:3000';
const ASSETS_DIR = 'd:\\porfolio project 1\\report_assets\\round-10';

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const a11yViolations = [];

function recordViolation(id, severity, surface, elementDesc, issueType, expected, actual, screenshot = null) {
  const item = {
    id: `A11Y-${String(a11yViolations.length + 1).padStart(3, '0')}`,
    bugId: id || `BUG-A11Y-${String(a11yViolations.length + 1).padStart(3, '0')}`,
    severity,
    surface,
    elementDesc,
    issueType,
    expected,
    actual,
    screenshot
  };
  a11yViolations.push(item);
  console.log(`[${severity.toUpperCase()}] [${surface}] ${elementDesc}: ${issueType} -> ${actual}`);
}

async function main() {
  console.log('=== Starting Phase 3: Accessibility Audit (M21) ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Pre-boot so it doesn't get stuck on boot animation
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });

    // -------------------------------------------------------------
    // 1. AUDIT LOCK SCREEN (Anonymous)
    // -------------------------------------------------------------
    console.log('\n--- 1. Auditing Lock Screen ---');
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay, #lock-screen-clock', { timeout: 8000 });

    const ssLock = path.join(ASSETS_DIR, 'A11Y-01-lock-screen.png');
    await page.screenshot({ path: ssLock });

    // Check ARIA & Keyboard Tab sequence on lock screen
    const lockKeyAudit = await page.evaluate(() => {
      const interactives = Array.from(document.querySelectorAll('button, input, [role="button"], [role="tab"]'));
      return interactives.map(el => {
        const ariaLabel = el.getAttribute('aria-label');
        const text = el.innerText || el.textContent || el.placeholder || '';
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        return {
          id: el.id,
          tag: el.tagName,
          text: text.trim().slice(0, 30),
          ariaLabel,
          hasAccessibleName: !!(ariaLabel || text.trim()),
          role,
          tabIndex: el.tabIndex
        };
      });
    });

    for (const item of lockKeyAudit) {
      if (!item.hasAccessibleName) {
        recordViolation(
          'BUG-A11Y-001',
          'Medium',
          'Lock Screen',
          `${item.tag}#${item.id}`,
          'Missing Accessible Name',
          'Interactive elements must have text content or aria-label',
          'Element has empty accessible name',
          ssLock
        );
      }
    }

    // -------------------------------------------------------------
    // 2. AUDIT DESKTOP & MENU BAR (Guest Identity)
    // -------------------------------------------------------------
    console.log('\n--- 2. Logging in as Guest & Auditing Desktop ---');
    const guestTab = await page.$('#tab-btn-viewer, #avatar-select-guest');
    if (guestTab) await guestTab.click();
    await page.waitForSelector('#input-viewer-name', { timeout: 4000 });
    await page.type('#input-viewer-name', 'Guest Reviewer');
    await page.type('#input-viewer-email', 'guest@example.com');
    await page.click('#btn-login-viewer');
    await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await page.waitForSelector('#desktop-workspace', { timeout: 6000 });
    await new Promise(r => setTimeout(r, 600));

    const ssDesktop = path.join(ASSETS_DIR, 'A11Y-02-desktop.png');
    await page.screenshot({ path: ssDesktop });

    // 2.1 Menu Bar accessibility
    const menuBarA11y = await page.evaluate(() => {
      const menu = document.getElementById('macos-menu-bar') || document.querySelector('.menu-bar');
      if (!menu) return { error: 'Menu bar element not found' };
      const buttons = Array.from(menu.querySelectorAll('button, [role="button"], .menu-item'));
      return {
        buttonCount: buttons.length,
        items: buttons.map(b => ({
          id: b.id,
          text: b.innerText.trim(),
          ariaLabel: b.getAttribute('aria-label'),
          role: b.getAttribute('role')
        }))
      };
    });
    console.log('Menu Bar Items count:', menuBarA11y.buttonCount);

    // 2.2 Desktop Icons accessibility & roles
    const desktopIconsA11y = await page.evaluate(() => {
      const icons = Array.from(document.querySelectorAll('.desktop-icon'));
      return icons.map(icon => {
        const appIcon = icon.querySelector('.portos-app-icon');
        const label = icon.querySelector('.desktop-icon-label');
        return {
          id: icon.id,
          label: label ? label.innerText.trim() : '',
          role: icon.getAttribute('role'),
          tabIndex: icon.tabIndex,
          hasImgRole: appIcon ? appIcon.getAttribute('role') === 'img' : false,
          hasAriaLabel: appIcon ? !!appIcon.getAttribute('aria-label') : false
        };
      });
    });

    for (const icon of desktopIconsA11y) {
      if (icon.role !== 'button' && icon.tabIndex < 0) {
        recordViolation(
          'BUG-A11Y-002',
          'Medium',
          'Desktop Icons',
          `Desktop Icon (${icon.label || icon.id})`,
          'Keyboard Navigation & Role',
          'role="button" and tabIndex >= 0 for keyboard focus',
          `role=${icon.role}, tabIndex=${icon.tabIndex}`,
          ssDesktop
        );
      }
    }

    // 2.3 Dock accessibility
    const dockA11y = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.dock-item'));
      return items.map(item => ({
        id: item.id,
        label: item.getAttribute('aria-label') || item.innerText.trim(),
        hasAria: !!(item.getAttribute('aria-label') || item.innerText.trim()),
        tabIndex: item.tabIndex
      }));
    });

    for (const item of dockA11y) {
      if (!item.hasAria) {
        recordViolation(
          'BUG-A11Y-003',
          'Low',
          'Dock',
          `Dock Item (${item.id})`,
          'Missing aria-label on dock item',
          'Dock items must have aria-label',
          'Missing aria-label',
          ssDesktop
        );
      }
    }

    // -------------------------------------------------------------
    // 3. AUDIT FINDER (4 Views)
    // -------------------------------------------------------------
    console.log('\n--- 3. Auditing Finder Window & 4 Views ---');
    await page.click('#dock-item-finder');
    await page.waitForSelector('.finder-window-container, .finder-toolbar', { timeout: 6000 });
    await new Promise(r => setTimeout(r, 500));

    const viewModes = ['icons', 'list', 'columns', 'gallery'];
    for (const mode of viewModes) {
      const viewBtn = await page.$(`button[data-view="${mode}"]`);
      if (viewBtn) {
        await viewBtn.click();
        await new Promise(r => setTimeout(r, 400));
      }
      const ssFinderMode = path.join(ASSETS_DIR, `A11Y-03-finder-${mode}.png`);
      await page.screenshot({ path: ssFinderMode });

      const viewAudit = await page.evaluate(mode => {
        const container = document.querySelector(`.finder-view-${mode}`) || document.querySelector('.folder-view-content');
        if (!container) return { error: `Container for ${mode} not found` };
        const items = Array.from(container.querySelectorAll('.finder-item, .folder-item, [role="row"], [role="button"]'));
        return {
          itemCount: items.length,
          focusableCount: items.filter(el => el.tabIndex >= 0).length
        };
      }, mode);

      console.log(`Finder [${mode}] view:`, viewAudit);
    }

    // Close Finder
    const finderClose = await page.$('.finder-window-container button.traffic-light-close, .window-frame button.traffic-light.close');
    if (finderClose) await finderClose.click();
    await new Promise(r => setTimeout(r, 300));

    // -------------------------------------------------------------
    // 4. AUDIT SYSTEM SETTINGS (All Tabs)
    // -------------------------------------------------------------
    console.log('\n--- 4. Auditing System Settings (All Tabs) ---');
    await page.click('#dock-item-settings');
    await page.waitForSelector('.settings-window, .settings-modal, [class*="settings"]', { timeout: 6000 });
    await new Promise(r => setTimeout(r, 500));

    const settingsTabs = ['general', 'customization', 'boot', 'security'];
    for (const tab of settingsTabs) {
      const tabBtn = await page.$(`button[data-settings-tab="${tab}"], .settings-tab-btn[data-tab="${tab}"], button[data-tab="${tab}"]`);
      if (tabBtn) {
        await tabBtn.click();
        await new Promise(r => setTimeout(r, 400));
      }
      const ssSettingsTab = path.join(ASSETS_DIR, `A11Y-04-settings-${tab}.png`);
      await page.screenshot({ path: ssSettingsTab });

      // Check contrast in this tab
      const tabContrast = await page.evaluate(() => {
        function getLum(r, g, b) {
          const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        }
        function parseRgb(c) {
          if (!c) return null;
          const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
          if (!m) return null;
          return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
        }
        const win = document.querySelector('.settings-window, .settings-modal, [class*="settings"]');
        if (!win) return [];
        const elements = Array.from(win.querySelectorAll('span, p, h1, h2, h3, h4, label, button, select, option, .settings-card'));
        const issues = [];
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          const fg = parseRgb(style.color);
          if (!fg) continue;
          // approximate bg
          let bg = parseRgb(style.backgroundColor);
          if (!bg || (bg.r === 0 && bg.g === 0 && bg.b === 0 && style.backgroundColor.includes('0)'))) {
            bg = { r: 24, g: 26, b: 34 }; // dark settings background
          }
          const l1 = getLum(fg.r, fg.g, fg.b);
          const l2 = getLum(bg.r, bg.g, bg.b);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const fontSize = parseFloat(style.fontSize);
          const isLarge = fontSize >= 24 || (fontSize >= 18.5 && (parseInt(style.fontWeight) >= 700 || style.fontWeight === 'bold'));
          const minRequired = isLarge ? 3.0 : 4.5;
          if (ratio < minRequired && ratio > 1.05) {
            issues.push({
              tag: el.tagName,
              className: el.className,
              text: (el.innerText || el.textContent || '').trim().slice(0, 25),
              ratio: ratio.toFixed(2),
              minRequired
            });
          }
        }
        return issues;
      });

      if (tabContrast.length > 0) {
        console.log(`Settings [${tab}] low-contrast count:`, tabContrast.length);
        for (const issue of tabContrast.slice(0, 3)) {
          recordViolation(
            'BUG-A11Y-004',
            'Medium',
            `Settings (${tab} tab)`,
            `<${issue.tag} class="${issue.className}"> "${issue.text}"`,
            'Insufficient Contrast Ratio',
            `Contrast ratio >= ${issue.minRequired}:1`,
            `Ratio = ${issue.ratio}:1`,
            ssSettingsTab
          );
        }
      }
    }

    // -------------------------------------------------------------
    // 5. AUDIT CONTEXT MENU
    // -------------------------------------------------------------
    console.log('\n--- 5. Auditing Context Menu ---');
    await page.mouse.click(500, 500, { button: 'right' });
    await page.waitForSelector('.context-menu, [role="menu"]', { timeout: 3000 });

    const ssContextMenu = path.join(ASSETS_DIR, 'A11Y-05-context-menu.png');
    await page.screenshot({ path: ssContextMenu });

    const contextMenuAudit = await page.evaluate(() => {
      const menu = document.querySelector('.context-menu, [role="menu"]');
      if (!menu) return { error: 'Context menu not found' };
      const role = menu.getAttribute('role');
      const items = Array.from(menu.querySelectorAll('.context-menu-item, [role="menuitem"]'));
      return {
        role,
        isPortalInBody: menu.parentElement === document.body,
        itemCount: items.length,
        hasMenuRole: role === 'menu',
        itemsAria: items.map(it => ({
          text: it.innerText.trim(),
          role: it.getAttribute('role'),
          tabIndex: it.tabIndex
        }))
      };
    });

    console.log('Context Menu Audit:', contextMenuAudit);

    if (!contextMenuAudit.isPortalInBody) {
      recordViolation(
        'BUG-A11Y-005',
        'Medium',
        'Context Menu',
        'ContextMenu container',
        'Portal Placement',
        'Rendered directly under document.body via Portal to prevent coordinate corruption',
        'Rendered inside nested container',
        ssContextMenu
      );
    }

    // Dismiss with Escape
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    const menuStillOpen = await page.$('.context-menu, [role="menu"]');
    if (menuStillOpen) {
      recordViolation(
        'BUG-A11Y-006',
        'Medium',
        'Context Menu',
        'ContextMenu',
        'Keyboard Dismissal (Escape)',
        'Escape closes open context menu',
        'Menu remains open after Escape',
        ssContextMenu
      );
    }

    // -------------------------------------------------------------
    // 6. AUDIT MOBILE VIEWPORT (390x844) & TAP TARGETS
    // -------------------------------------------------------------
    console.log('\n--- 6. Auditing Mobile (390x844) Tap Targets ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 500));

    const ssMobile = path.join(ASSETS_DIR, 'A11Y-06-mobile-390.png');
    await page.screenshot({ path: ssMobile });

    const tapTargetAudit = await page.evaluate(() => {
      const interactives = Array.from(document.querySelectorAll('button, a, input, select, .dock-item, .desktop-icon, .menu-item'));
      const smallTargets = [];
      for (const el of interactives) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (rect.width < 44 || rect.height < 44) {
          smallTargets.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 20),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      }
      return smallTargets;
    });

    console.log(`Small tap targets found on mobile (< 44px): ${tapTargetAudit.length}`);
    for (const target of tapTargetAudit.slice(0, 5)) {
      recordViolation(
        'BUG-A11Y-007',
        'Low',
        'Mobile (390px)',
        `<${target.tag} id="${target.id}" class="${target.className}"> "${target.text}"`,
        'Tap Target Size < 44x44px',
        'Touch targets on mobile should be >= 44x44px per WCAG / web.dev',
        `Size: ${target.width}x${target.height}px`,
        ssMobile
      );
    }

    await context.close();
  } finally {
    await browser.close();
  }

  // Write violations report
  const reportPath = path.join(ASSETS_DIR, 'a11y-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(a11yViolations, null, 2));
  console.log(`\nAccessibility audit complete. Logged ${a11yViolations.length} items to ${reportPath}`);
}

main().catch(err => {
  console.error('Phase 3 A11y Audit Error:', err);
  process.exit(1);
});
