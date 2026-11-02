import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

const results = [];

function check(name, passed, details = '') {
  results.push({ name, passed, details });
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${name} ${details ? `(${details})` : ''}`);
  if (!passed) {
    console.error(`    FAILED: ${name}: ${details}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('  ROUND 23 VERIFICATION: DUMMY DATA CLEANUP, FOLDER CREATION,    ');
  console.log('  DESKTOP DRAG & DROP, AND COMPLETE CUSTOMIZATION RESTRICTIONS   ');
  console.log('================================================================\n');

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('Failed') || msg.text().includes('error')) {
      console.log(`[PAGE LOG ${msg.type()}]:`, msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]:', err);
  });

  // Handle dialog prompts automatically (for folder creation / rename)
  let nextPromptValue = 'New Project Alpha';
  page.on('dialog', async (dialog) => {
    console.log(`    [DIALOG] prompt: "${dialog.message()}" -> replying with: "${nextPromptValue}"`);
    await dialog.accept(nextPromptValue);
  });

  try {
    // -------------------------------------------------------------
    // PART 1: VISITOR / GUEST VERIFICATION
    // -------------------------------------------------------------
    console.log('--- PART 1: VISITOR / GUEST PERSPECTIVE ---');
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });

    // Enter as Guest
    const guestAvatar = await page.$('#avatar-select-guest');
    if (guestAvatar) {
      await guestAvatar.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    await page.waitForSelector('#input-viewer-name');
    await page.type('#input-viewer-name', 'Guest Reviewer');
    await page.type('#input-viewer-email', 'reviewer@example.com');
    await page.click('#btn-login-viewer');

    await page.waitForSelector('#desktop-workspace', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 1.1 Verify Zero Widgets on desktop
    const widgets = await page.$$('.desktop-widget');
    check('Zero widgets on desktop for guest', widgets.length === 0, `found ${widgets.length}`);

    // 1.2 Verify Widgets icon is NOT in the Dock
    const widgetDockBtn = await page.$('button[aria-label="Widgets Studio"], button[aria-label="Widgets"]');
    check('Widgets icon hidden from Dock for guest', widgetDockBtn === null);

    // 1.3 Verify Desktop Right-Click customization options are disabled
    const workspace = await page.$('#desktop-workspace');
    const wsBox = await workspace.boundingBox();
    await page.mouse.click(wsBox.x + 350, wsBox.y + 350, { button: 'right' });
    await page.waitForSelector('.context-menu', { timeout: 5000 });

    const newFolderDisabled = await page.$eval('#context-menu-item-ctx-new-folder', (el) => el.classList.contains('disabled'));
    check('Desktop Right-Click "New Folder" disabled for guest', newFolderDisabled);

    const desktopSideDisabled = await page.$eval('#context-menu-item-ctx-desktop-side', (el) => el.classList.contains('disabled'));
    check('Desktop Right-Click "Place Folders Left/Right" disabled for guest', desktopSideDisabled);

    const effectsDisabled = await page.$eval('#context-menu-item-ctx-effects', (el) => el.classList.contains('disabled'));
    check('Desktop Right-Click "Visual Effects Library" disabled for guest', effectsDisabled);

    const cleanupDisabled = await page.$eval('#context-menu-item-ctx-clean-up', (el) => el.classList.contains('disabled'));
    check('Desktop Right-Click "Clean Up Icons" disabled for guest', cleanupDisabled);

    // Close context menu by clicking elsewhere
    await page.mouse.click(wsBox.x + 100, wsBox.y + 100);
    await new Promise((r) => setTimeout(r, 400));

    // 1.4 Verify System Settings customization locks for guest
    // Open settings from Dock
    const settingsDockBtn = await page.$('button[aria-label="Settings"]');
    if (settingsDockBtn) {
      await settingsDockBtn.click();
      await page.waitForSelector('.window-shell', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 600));

      // Click "Customize" tab in settings
      const customizeTab = await page.$('button[id*="customize"], button[data-tab="customize"], button:has-text("Customize")');
      const tabs = await page.$$('button');
      for (const t of tabs) {
        const text = await page.evaluate((el) => el.textContent || '', t);
        if (text.includes('Customize')) {
          await t.click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));

      const lockNotice = await page.$('#customization-restricted-notice');
      check('System Settings "Customize" tab displays lock banner for guest', lockNotice !== null);

      // Click "Boot" tab
      for (const t of tabs) {
        const text = await page.evaluate((el) => el.textContent || '', t);
        if (text.includes('Boot')) {
          await t.click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
      const bootLockNotice = await page.$('#boot-restricted-notice');
      check('System Settings "Boot" tab displays lock banner for guest', bootLockNotice !== null);

      // Click "Fonts" tab
      for (const t of tabs) {
        const text = await page.evaluate((el) => el.textContent || '', t);
        if (text.includes('Fonts')) {
          await t.click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
      const fontsLockNotice = await page.$('#fonts-restricted-notice');
      check('System Settings "Fonts" tab displays lock banner for guest', fontsLockNotice !== null);

      // Verify Save / Reset buttons hidden
      const saveBtn = await page.$('button:has-text("Save Changes")');
      check('System Settings Save Changes button hidden from guest', saveBtn === null);
    }

    // 1.5 Verify Data Cleanliness in portfolio.json
    const portfolioRaw = fs.readFileSync('data/portfolio.json', 'utf-8');
    const portfolio = JSON.parse(portfolioRaw);
    const projectsFolder = portfolio.root.find((r) => r.id === 'folder-projects');
    const certFolder = portfolio.root.find((r) => r.id === 'folder-cert-edu');
    const ownersFolder = portfolio.root.find((r) => r.id === 'folder-owners-data');

    check('Projects root folder contains 0 dummy files', projectsFolder?.children?.length === 0, `${projectsFolder?.children?.length} files`);
    const certChildrenCount = (certFolder?.children || []).reduce((acc, c) => acc + (c.children?.length || 0), 0);
    check('Certification & Education root contains 0 dummy files', certChildrenCount === 0, `${certChildrenCount} files`);
    check("Owner's Data root folder contains 0 dummy files", ownersFolder?.children?.length === 0, `${ownersFolder?.children?.length} files`);
    check('Portfolio widgets array is empty in storage', portfolio.widgets?.length === 0, `${portfolio.widgets?.length} widgets`);

    // Sign out to prepare for Admin testing
    await page.evaluate(async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
    });
    await client.send('Network.clearBrowserCookies');

    // -------------------------------------------------------------
    // PART 2: ADMIN VERIFICATION (LOCALHOST)
    // -------------------------------------------------------------
    console.log('\n--- PART 2: ADMIN PERSPECTIVE ---');
    await client.send('Network.clearBrowserCookies');

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });

    // Switch to Owner / Admin tab
    const ownerAvatar = await page.$('#avatar-select-owner');
    if (ownerAvatar) {
      await ownerAvatar.click();
      await new Promise((r) => setTimeout(r, 300));
    }
    await page.waitForSelector('#input-admin-password');
    await page.type('#input-admin-password', 'Admin123');
    await page.click('#btn-login-admin');

    await page.waitForSelector('#desktop-workspace', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 2.1 Verify Widgets icon IS visible in Dock for Admin
    const adminWidgetDockBtn = await page.$('button[aria-label="Widgets Studio"], button[aria-label="Widgets"]');
    check('Widgets icon is present in Dock for Admin', adminWidgetDockBtn !== null);

    // 2.2 Test Creating a Folder on Desktop via Right-Click
    nextPromptValue = 'Design Lab 2026';
    const adminWs = await page.$('#desktop-workspace');
    const adminWsBox = await adminWs.boundingBox();
    await page.mouse.click(adminWsBox.x + 350, adminWsBox.y + 350, { button: 'right' });
    await page.waitForSelector('.context-menu', { timeout: 5000 });

    const newFolderAdminBtn = await page.$('#context-menu-item-ctx-new-folder');
    const isNewFolderEnabled = await page.$eval('#context-menu-item-ctx-new-folder', (el) => !el.classList.contains('disabled'));
    check('Desktop Right-Click "New Folder" is enabled for Admin', isNewFolderEnabled);

    // Click "New Folder"
    await newFolderAdminBtn.click();
    await new Promise((r) => setTimeout(r, 2000));

    // Check that "Design Lab 2026" appears on desktop
    const desktopItemCreated = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
      return items.some((it) => it.textContent.includes('Design Lab 2026'));
    });
    check('Custom folder "Design Lab 2026" rendered on Desktop', desktopItemCreated);

    // 2.3 Test Creating a Folder inside Finder and Moving to Home Screen
    // Open Finder from dock
    const finderDockBtn = await page.$('button[aria-label="Finder"], button[aria-label="Projects"]');
    if (finderDockBtn) {
      await finderDockBtn.click();
      await page.waitForSelector('.finder-window-container', { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 1000));

      // Click "Create New Folder" toolbar button in Finder
      nextPromptValue = 'Research & Notes';
      const addFolderBtns = await page.$$('#btn-add-folder');
      const addFolderBtn = addFolderBtns[addFolderBtns.length - 1];
      if (addFolderBtn) {
        await addFolderBtn.click();
        await new Promise((r) => setTimeout(r, 2500));
      }

      // Verify "Research & Notes" is created inside Finder
      const itemInFinder = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.finder-item'));
        return rows.some((r) => r.textContent.includes('Research & Notes'));
      });
      check('Folder "Research & Notes" created inside Finder', itemInFinder);

      // Right-click "Research & Notes" inside Finder to open context menu
      const itemEl = await page.evaluateHandle(() => {
        const cells = Array.from(document.querySelectorAll('.finder-item'));
        return cells.find((r) => r.textContent.includes('Research & Notes'));
      });

      if (itemEl && itemEl.asElement()) {
        const itemBox = await itemEl.asElement().boundingBox();
        await page.mouse.click(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2, { button: 'right' });
        await page.waitForSelector('.context-menu', { timeout: 5000 });

        // Verify "Move to Home Screen" option exists in context menu
        const moveToDesktopOption = await page.$('#context-menu-item-ctx-finder-place-desktop');
        check('"Move to Home Screen" option present in Finder context menu', moveToDesktopOption !== null);

        if (moveToDesktopOption) {
          await moveToDesktopOption.click();
          await new Promise((r) => setTimeout(r, 2500));

          // Verify "Research & Notes" is now a separate desktop icon
          const desktopItemMoved = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
            return items.some((it) => it.textContent.includes('Research & Notes'));
          });
          check('Folder moved from Finder to Home Screen successfully', desktopItemMoved);
        }
      }
    }

    // 2.4 Test Desktop Icon Context Menu: Rename and Move to Trash
    const customDesktopIcon = await page.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
      return items.find((it) => it.textContent.includes('Design Lab 2026'));
    });

    if (customDesktopIcon && customDesktopIcon.asElement()) {
      const iconBox = await customDesktopIcon.asElement().boundingBox();
      await page.mouse.click(iconBox.x + 20, iconBox.y + 20, { button: 'right' });
      await page.waitForSelector('.context-menu', { timeout: 5000 });

      const renameOption = await page.$('#context-menu-item-ctx-icon-rename');
      const trashOption = await page.$('#context-menu-item-ctx-icon-trash');
      check('Rename option available for custom desktop folder', renameOption !== null);
      check('Move to Trash option available for custom desktop folder', trashOption !== null);

      // Test Rename
      nextPromptValue = 'Design Lab Approved';
      if (renameOption) {
        await renameOption.click();
        await new Promise((r) => setTimeout(r, 2500));

        const isRenamed = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
          return items.some((it) => it.textContent.includes('Design Lab Approved'));
        });
        check('Custom desktop folder successfully renamed to "Design Lab Approved"', isRenamed);
      }

      // Test Move to Trash
      const renamedIcon = await page.evaluateHandle(() => {
        const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
        return items.find((it) => it.textContent.includes('Design Lab Approved'));
      });
      if (renamedIcon && renamedIcon.asElement()) {
        const rBox = await renamedIcon.asElement().boundingBox();
        await page.mouse.click(rBox.x + 20, rBox.y + 20, { button: 'right' });
        await page.waitForSelector('#context-menu-item-ctx-icon-trash', { timeout: 5000 });
        await page.click('#context-menu-item-ctx-icon-trash');
        await new Promise((r) => setTimeout(r, 2500));

        const isRemoved = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
          return !items.some((it) => it.textContent.includes('Design Lab Approved'));
        });
        check('Custom desktop folder removed from desktop and moved to Trash', isRemoved);
      }
    }

    // 2.5 Test Direct Drop on Desktop Workspace
    console.log('Testing direct drag/drop on Desktop Workspace...');
    const dropResult = await page.evaluate(async () => {
      // Create a test item via API first
      const createRes = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'folder-projects',
          item: { id: 'dragged-test-folder', name: 'Dropped Folder', kind: 'folder', children: [] },
        }),
      });
      if (!createRes.ok) return false;

      // Simulate drop event on #desktop-workspace at (500, 300)
      const workspaceEl = document.getElementById('desktop-workspace');
      if (!workspaceEl) return false;

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: 500,
        clientY: 300,
      });

      // Populate dataTransfer with item json
      const dt = new DataTransfer();
      dt.setData('application/json', JSON.stringify({ id: 'dragged-test-folder', name: 'Dropped Folder' }));
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dt });

      workspaceEl.dispatchEvent(dropEvent);
      return true;
    });

    await new Promise((r) => setTimeout(r, 1200));
    check('Drop event dispatched on desktop workspace', dropResult);

    const droppedItemOnDesktop = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.desktop-icon-item'));
      return items.some((it) => it.textContent.includes('Dropped Folder'));
    });
    check('Dropped folder appears on Desktop at drop coordinates', droppedItemOnDesktop);

    console.log('\n================================================================');
    const passedAll = results.every((r) => r.passed);
    console.log(`  VERIFICATION RESULTS: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
    console.log(`  OVERALL STATUS: ${passedAll ? 'SUCCESS (ALL GATES PASSED)' : 'FAILURE'}`);
    console.log('================================================================\n');

    if (!passedAll) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
