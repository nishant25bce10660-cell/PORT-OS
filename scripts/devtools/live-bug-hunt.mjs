import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve('report_assets/round-10');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const bugRegistry = [];
let bugCounter = 1;

function registerBug(severity, title, identity, viewport, steps, expected, actual, suspectedRootCause, screenshot = null) {
  const id = `BUG-${String(bugCounter++).padStart(3, '0')}`;
  bugRegistry.push({
    id,
    severity,
    title,
    identity,
    viewport,
    steps,
    expected,
    actual,
    suspectedRootCause,
    screenshot: screenshot ? path.relative(process.cwd(), screenshot).replace(/\\/g, '/') : null,
  });
  console.log(`[FOUND ${id}] (${severity}) ${title} [${identity} @ ${viewport}]`);
}

async function runLiveBugHunt() {
  console.log('================================================================');
  console.log('  PORT OS — PHASE 2: LIVE BUG HUNT & VF-01..VF-20 AUDIT         ');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const viewports = [
      { name: '1920x1080', width: 1920, height: 1080, isMobile: false, hasTouch: false },
      { name: '1366x768', width: 1366, height: 768, isMobile: false, hasTouch: false },
      { name: '390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
    ];

    // =================================================================
    // 1. AUDIT IDENTITIES & VIEWPORTS
    // =================================================================

    // --- 1.1 ANONYMOUS (LOCK SCREEN) ---
    console.log('\n--- 1. Testing Identity: ANONYMOUS (Lock Screen) ---');
    for (const vp of viewports) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(vp);

      const consoleMessages = [];
      const failedRequests = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        }
      });
      page.on('requestfailed', (req) => {
        failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 600));

      const ssLock = path.join(EVIDENCE_DIR, `VF-16-anon-lock-${vp.name}.png`);
      await page.screenshot({ path: ssLock });

      // Check lock screen elements
      const lockData = await page.evaluate(() => {
        const lockClock = document.getElementById('lock-screen-clock');
        const loginModal = document.getElementById('login-modal-overlay');
        const desktopWorkspace = document.getElementById('desktop-workspace');
        const menuBar = document.getElementById('portfolio-menubar');
        const dock = document.getElementById('macos-dock');
        const powerControls = document.querySelector('.lock-screen-power-controls, [class*="power"]');

        return {
          hasLockClock: !!lockClock,
          hasLoginModal: !!loginModal,
          hasDesktopWorkspace: !!desktopWorkspace,
          hasMenuBar: !!menuBar,
          hasDock: !!dock,
          hasPowerControls: !!powerControls,
        };
      });

      if (lockData.hasDesktopWorkspace || lockData.hasMenuBar || lockData.hasDock) {
        registerBug(
          'Critical',
          'Desktop elements leaked before authentication',
          'anonymous',
          vp.name,
          'Load root URL without session',
          'Desktop workspace, menu bar and dock should NOT be mounted before login',
          `Workspace=${lockData.hasDesktopWorkspace}, Menu=${lockData.hasMenuBar}, Dock=${lockData.hasDock}`,
          'Lock screen conditional rendering leaking desktop components',
          ssLock
        );
      }

      // Check console and failed requests
      if (consoleMessages.length > 0) {
        registerBug(
          'Low',
          `Console errors/warnings on Lock Screen (${consoleMessages.length})`,
          'anonymous',
          vp.name,
          'Inspect console on initial load',
          'Zero console errors and warnings',
          consoleMessages.map((m) => `${m.type}: ${m.text}`).join('; '),
          'Client scripts or asset warnings',
          ssLock
        );
      }

      // Check mobile viewport overflow at 390px
      if (vp.isMobile) {
        const overflow = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
          };
        });
        if (overflow.scrollWidth > overflow.clientWidth) {
          registerBug(
            'Medium',
            'Horizontal scroll on mobile Lock Screen',
            'anonymous',
            vp.name,
            'Load at 390px width',
            'scrollWidth <= clientWidth (390px)',
            `scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
            'Lock screen element min-width or margin causing horizontal overflow',
            ssLock
          );
        }
      }

      await context.close();
    }

    // --- 1.2 GUEST / VIEWER IDENTITY ---
    console.log('\n--- 2. Testing Identity: GUEST (Viewer) ---');
    for (const vp of viewports) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(vp);

      // Pre-boot
      await page.evaluateOnNewDocument(() => {
        sessionStorage.setItem('portos_booted', 'true');
      });

      const consoleMessages = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleMessages.push(msg.text());
        }
      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 400));

      // Login as Guest / Viewer
      await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });
      const guestTab = await page.$('#tab-btn-viewer, #avatar-select-guest');
      if (guestTab) await guestTab.click();
      await page.waitForSelector('#input-viewer-name', { timeout: 3000 });
      await page.type('#input-viewer-name', 'Guest Reviewer');
      await page.type('#input-viewer-email', 'guest@example.com');
      await page.click('#btn-login-viewer');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
      await page.waitForSelector('#desktop-workspace', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 500));

      const ssGuestDesktop = path.join(EVIDENCE_DIR, `VF-guest-desktop-${vp.name}.png`);
      await page.screenshot({ path: ssGuestDesktop });

      // Check VF-01: Menu bar
      const menuBarData = await page.evaluate(() => {
        const menu = document.getElementById('portfolio-menubar');
        if (!menu) return { exists: false };
        const text = menu.innerText;
        const hasLegacy = /\b(File|Edit|View|Go|Window)\b/i.test(text);
        const hasNLogo = !!document.getElementById('menu-btn-n-logo');
        const hasFinder = !!document.getElementById('menu-item-top-finder');
        const hasHelp = !!document.getElementById('menu-item-top-help');
        const hasSpotlight = !!document.getElementById('menu-btn-spotlight');
        const hasControlCenter = !!document.getElementById('menu-btn-control-center');
        return { exists: true, hasLegacy, hasNLogo, hasFinder, hasHelp, hasSpotlight, hasControlCenter, text };
      });

      if (!menuBarData.hasNLogo || !menuBarData.hasFinder || !menuBarData.hasHelp) {
        registerBug(
          'High',
          'Menu bar missing core macOS items (N, Finder, Help)',
          'guest',
          vp.name,
          'Inspect top menu bar',
          'Top menu bar must contain N logo, Finder, and Help',
          `hasNLogo=${menuBarData.hasNLogo}, hasFinder=${menuBarData.hasFinder}, hasHelp=${menuBarData.hasHelp}`,
          'MenuBar.tsx items missing or conditional',
          ssGuestDesktop
        );
      }
      if (menuBarData.hasLegacy) {
        registerBug(
          'Medium',
          'Menu bar contains legacy desktop menus (File/Edit/View/Window)',
          'guest',
          vp.name,
          'Inspect top menu bar text',
          'No legacy desktop menus',
          `Text: ${menuBarData.text}`,
          'Legacy menus not completely removed',
          ssGuestDesktop
        );
      }
      if (menuBarData.hasControlCenter) {
        registerBug(
          'High',
          'Simulated Control Center button still present in Menu Bar',
          'guest',
          vp.name,
          'Inspect menu bar for #menu-btn-control-center',
          'Control Center button completely removed per Q2 & VF-06',
          '#menu-btn-control-center found',
          'Control Center button not removed from MenuBar.tsx',
          ssGuestDesktop
        );
      }

      // Check VF-02: Click Help -> Opens Terminal and runs `help` exactly once
      await page.click('#menu-item-top-help');
      await page.waitForSelector('#window-terminal', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 600));

      const termHelpData = await page.evaluate(() => {
        const term = document.getElementById('window-terminal');
        const output = term?.innerText || '';
        const helpOccurrences = (output.match(/Available commands/g) || []).length;
        const hasHelpHeader = output.includes('Available commands') || output.includes('portsh');
        const lines = output.split('\n').filter((l) => l.includes('-'));
        const hasOwnerCommands = lines.some((l) => /\b(edit|passwd|rm|mkdir)\b/.test(l));
        return { output, helpOccurrences, hasHelpHeader, hasOwnerCommands };
      });

      const ssGuestHelp = path.join(EVIDENCE_DIR, `VF-02-guest-help-${vp.name}.png`);
      await page.screenshot({ path: ssGuestHelp });

      if (termHelpData.helpOccurrences !== 1) {
        registerBug(
          'High',
          `Help command ran ${termHelpData.helpOccurrences} times (expected exactly 1)`,
          'guest',
          vp.name,
          'Click top menu bar Help',
          'Help should execute exactly once',
          `Count: ${termHelpData.helpOccurrences}`,
          'Initial command auto-execution firing multiple times or loop',
          ssGuestHelp
        );
      }

      // Guest output should not contain mutating owner commands
      if (termHelpData.hasOwnerCommands) {
        registerBug(
          'Medium',
          'Guest Help output lists owner-only write commands',
          'guest',
          vp.name,
          'Read terminal help output as guest',
          'Guest output lists read-only commands only',
          termHelpData.output.slice(0, 300),
          'TerminalView help command not filtering by user role',
          ssGuestHelp
        );
      }

      // Test clicking Help again -> does not duplicate window
      await page.click('#menu-item-top-help');
      await new Promise((r) => setTimeout(r, 300));
      const termWindowCount = await page.evaluate(() => document.querySelectorAll('#window-terminal').length);
      if (termWindowCount > 1) {
        registerBug(
          'Medium',
          'Clicking Help duplicates Terminal window',
          'guest',
          vp.name,
          'Click Help twice',
          'Single terminal window should remain focused',
          `Count: ${termWindowCount}`,
          'openWindow creating duplicate instance instead of focusWindow',
          ssGuestHelp
        );
      }

      await context.close();
    }

    // --- 1.3 OWNER IDENTITY ---
    console.log('\n--- 3. Testing Identity: OWNER (Admin) ---');
    for (const vp of viewports) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(vp);

      await page.evaluateOnNewDocument(() => {
        sessionStorage.setItem('portos_booted', 'true');
      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 400));

      // Login as Admin
      await page.waitForSelector('#login-modal-overlay', { timeout: 5000 });
      await page.click('#tab-btn-admin');
      await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
      await page.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
      await page.waitForSelector('#desktop-workspace', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 500));

      const ssOwnerDesktop = path.join(EVIDENCE_DIR, `VF-owner-desktop-${vp.name}.png`);
      await page.screenshot({ path: ssOwnerDesktop });

      // Check VF-05: Finder Sidebar & Vault Contents
      await page.click('#dock-item-finder');
      await page.waitForSelector('.finder-window-container, .finder-toolbar', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 500));

      const finderSidebarData = await page.evaluate(() => {
        const sidebar = document.querySelector('.finder-sidebar');
        if (!sidebar) return { hasSidebar: false };
        const text = sidebar.innerText;
        const hasThisPc = text.includes('This PC');
        const hasDesktop = text.includes('Desktop');
        const hasTrash = text.includes('Trash');
        const vaultItems = Array.from(sidebar.querySelectorAll('.finder-sidebar span')).map((s) => s.innerText);
        return { hasSidebar: true, text, hasThisPc, hasDesktop, hasTrash, vaultItems };
      });

      const ssFinderSidebar = path.join(EVIDENCE_DIR, `VF-05-finder-sidebar-${vp.name}.png`);
      await page.screenshot({ path: ssFinderSidebar });

      if (finderSidebarData.hasThisPc || finderSidebarData.hasDesktop) {
        registerBug(
          'High',
          'Finder sidebar contains removed This PC or Desktop entries',
          'owner',
          vp.name,
          'Open Finder and inspect sidebar',
          'Sidebar has Vault folders and Trash only, NO This PC or Desktop',
          `Text: ${finderSidebarData.text}`,
          'Removed items still rendered in FolderView sidebar',
          ssFinderSidebar
        );
      }

      // Check VF-07 & VF-08: System Settings & Visual Effects truth
      await page.click('#dock-item-settings');
      await page.waitForSelector('.settings-window, .settings-modal, [class*="settings"]', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 600));

      // Click Customization tab
      const custTab = await page.$('#tab-customization, button[title*="Customization"], [data-tab="customization"]');
      if (custTab) await custTab.click();
      await new Promise((r) => setTimeout(r, 400));

      const effectsTruthData = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.effect-card, .visual-effect-item, [class*="effect"]'));
        const activeBadges = Array.from(document.querySelectorAll('.badge-active, .effect-active-pill, [class*="badge"]')).map((b) => b.innerText);
        return {
          cardCount: cards.length,
          activeBadges,
        };
      });

      const ssSettingsEffects = path.join(EVIDENCE_DIR, `VF-08-effects-truth-${vp.name}.png`);
      await page.screenshot({ path: ssSettingsEffects });

      // Check if all effect cards are labelled Active at the same time
      if (effectsTruthData.activeBadges.filter((b) => b.toLowerCase().includes('active')).length > 4) {
        registerBug(
          'Medium',
          'Effects library displays "Active" badge on every effect simultaneously',
          'owner',
          vp.name,
          'Open Settings -> Customization -> Effects Library',
          'Only genuinely active effects should display the Active badge',
          `Active count: ${effectsTruthData.activeBadges.length}`,
          'Active badge hardcoded or not bound to active effects state in SystemSettings.tsx',
          ssSettingsEffects
        );
      }

      // Check VF-10: Portfolio Stats Widget Layout & Overflow
      const statsWidgetCheck = await page.evaluate(() => {
        const widget = document.querySelector('.widget-stats, .portfolio-stats-card, [id*="stats"]');
        if (!widget) return { exists: false };
        const rect = widget.getBoundingClientRect();
        const pills = Array.from(widget.querySelectorAll('.stat-pill, .stat-metric-card, [class*="stat"]'));
        let hasOverflow = false;
        pills.forEach((p) => {
          const pr = p.getBoundingClientRect();
          if (pr.right > rect.right + 2 || pr.bottom > rect.bottom + 2) hasOverflow = true;
        });
        return { exists: true, rect: { w: rect.width, h: rect.height }, pillCount: pills.length, hasOverflow };
      });

      const ssStatsWidget = path.join(EVIDENCE_DIR, `VF-10-stats-widget-${vp.name}.png`);
      await page.screenshot({ path: ssStatsWidget });

      if (statsWidgetCheck.hasOverflow) {
        registerBug(
          'Medium',
          'Portfolio Stats widget cards overflow widget bounds',
          'owner',
          vp.name,
          'Inspect Portfolio Stats widget on desktop',
          'Metric cards fit within widget bounds',
          `hasOverflow=true, w=${statsWidgetCheck.rect?.w}, h=${statsWidgetCheck.rect?.h}`,
          'CSS grid/flex container exceeding card dimensions',
          ssStatsWidget
        );
      }

      await context.close();
    }

    // =================================================================
    // 2. DETAILED CHECKLIST: VF-03, VF-04, VF-09, VF-14, VF-20
    // =================================================================
    console.log('\n--- 4. Detailed Interaction & Positioning Checks (VF-03, VF-04) ---');
    const checkContext = await browser.createBrowserContext();
    const checkPage = await checkContext.newPage();
    await checkPage.setViewport({ width: 1440, height: 900 });

    await checkPage.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portos_booted', 'true');
    });

    await checkPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await checkPage.waitForSelector('#login-modal-overlay', { timeout: 5000 });
    await checkPage.click('#tab-btn-admin');
    await checkPage.type('#input-admin-username', 'admin');
    await checkPage.type('#input-admin-password', 'admin123');
    await checkPage.click('#btn-login-admin');
    await checkPage.waitForFunction(() => !document.getElementById('login-modal-overlay'), { timeout: 6000 });
    await checkPage.waitForSelector('#desktop-workspace', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));

    // VF-03: Real pointer events: single click vs drag vs double click
    const desktopItem = await checkPage.$('#desktop-item-projects');
    if (desktopItem) {
      // 1. Single click selects only
      await desktopItem.click();
      await new Promise((r) => setTimeout(r, 300));
      const singleClickState = await checkPage.evaluate(() => {
        const item = document.getElementById('desktop-item-projects');
        const win = document.getElementById('window-folder-projects');
        return {
          hasSelectedClass: item?.classList.contains('is-selected') || !!item?.querySelector('.portos-app-icon--selected'),
          hasWindowOpened: !!win,
        };
      });

      if (singleClickState.hasWindowOpened) {
        registerBug(
          'High',
          'Desktop icon opens window on single click (must select only)',
          'owner',
          '1440x900',
          'Single click #desktop-item-projects',
          'Window must NOT open on single click',
          `hasWindowOpened=${singleClickState.hasWindowOpened}`,
          'onClick trigger opening window instead of selecting'
        );
      }

      // 2. Drag by Δ >= 10px never opens anything
      const box = await desktopItem.boundingBox();
      if (box) {
        await checkPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await checkPage.mouse.down();
        await checkPage.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
        await checkPage.mouse.up();
        await new Promise((r) => setTimeout(r, 300));

        const dragWindowState = await checkPage.evaluate(() => {
          return !!document.getElementById('window-folder-projects');
        });
        if (dragWindowState) {
          registerBug(
            'High',
            'Dragging desktop icon by 50px opens window (must only reposition)',
            'owner',
            '1440x900',
            'Drag desktop icon by 50px',
            'Window must NOT open after drag operation',
            'Window opened after drag',
            'Click event triggered on drag release'
          );
        }
      }
    }

    // VF-04: Context-menu positioning (9 screen positions & viewport clamping)
    console.log('Testing Context Menu positioning across screen bounds...');
    const testPositions = [
      { x: 10, y: 35 },
      { x: 720, y: 35 },
      { x: 1430, y: 35 },
      { x: 10, y: 450 },
      { x: 720, y: 450 },
      { x: 1430, y: 450 },
      { x: 10, y: 890 },
      { x: 720, y: 890 },
      { x: 1430, y: 890 },
    ];

    let clippingCount = 0;
    for (const pos of testPositions) {
      await checkPage.evaluate((p) => {
        const ws = document.getElementById('desktop-workspace');
        if (ws) {
          const evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: p.x,
            clientY: p.y,
          });
          ws.dispatchEvent(evt);
        }
      }, pos);

      await new Promise((r) => setTimeout(r, 100));
      const menuRect = await checkPage.evaluate(() => {
        const menu = document.getElementById('desktop-context-menu');
        if (!menu) return null;
        const rect = menu.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          w: rect.width,
          h: rect.height,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        };
      });

      if (menuRect) {
        if (menuRect.right > menuRect.screenWidth || menuRect.bottom > menuRect.screenHeight || menuRect.left < 0 || menuRect.top < 28) {
          clippingCount++;
        }
      }
      await checkPage.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 80));
    }

    if (clippingCount > 0) {
      registerBug(
        'Medium',
        `Context menu overflows viewport bounds in ${clippingCount} / ${testPositions.length} edge positions`,
        'owner',
        '1440x900',
        'Right click near viewport boundaries',
        'Context menu strictly clamped inside viewport',
        `Clipping occurrences: ${clippingCount}`,
        'Clamping math in ContextMenu.tsx not accounting for menuWidth or menuHeight'
      );
    }

    // VF-09: Contrast & White-on-White scan
    console.log('Auditing color contrast across interactive elements...');
    const contrastViolations = await checkPage.evaluate(() => {
      const violations = [];
      function getRGB(str) {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
      }
      function luminance([r, g, b]) {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }
      function contrastRatio(rgb1, rgb2) {
        const l1 = luminance(rgb1);
        const l2 = luminance(rgb2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      document.querySelectorAll('button, input, select, .desktop-icon-label, span').forEach((el) => {
        if (!el.offsetParent) return; // not visible
        const style = window.getComputedStyle(el);
        const fg = getRGB(style.color);
        const bg = getRGB(style.backgroundColor);
        if (fg && bg && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
          const ratio = contrastRatio(fg, bg);
          if (ratio < 3.0 && el.innerText.trim().length > 0) {
            violations.push({
              tag: el.tagName,
              id: el.id,
              class: el.className,
              text: el.innerText.slice(0, 30),
              ratio: ratio.toFixed(2),
            });
          }
        }
      });
      return violations;
    });

    if (contrastViolations.length > 0) {
      registerBug(
        'Medium',
        `Found ${contrastViolations.length} low-contrast elements (< 3.0 ratio)`,
        'owner',
        '1440x900',
        'Computed style scan of visible text elements',
        'All text meets minimum 3.0:1 (large) or 4.5:1 (normal) contrast',
        JSON.stringify(contrastViolations.slice(0, 5)),
        'CSS color tokens with insufficient contrast against active backgrounds'
      );
    }

    await checkContext.close();

    // =================================================================
    // 3. WRITE BUG REGISTRY TO JSON
    // =================================================================
    console.log(`\nLive bug hunt completed. Total bugs registered: ${bugRegistry.length}`);
    const bugPath = path.join(EVIDENCE_DIR, 'bug-registry.json');
    fs.writeFileSync(bugPath, JSON.stringify(bugRegistry, null, 2), 'utf-8');
    console.log(`Saved bug registry to: ${bugPath}`);

    console.log('\n================================================================');
    console.log(`  PHASE 2 LIVE BUG HUNT FINISHED: ${bugRegistry.length} BUGS FOUND        `);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Fatal error during bug hunt:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

runLiveBugHunt();
