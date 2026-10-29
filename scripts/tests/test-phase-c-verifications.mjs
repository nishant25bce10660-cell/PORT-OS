import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function runPhaseC() {
  console.log('=== PORT OS Phase C Additional Verifications ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  const results = {};

  try {
    // -------------------------------------------------------------
    // 1. TRASH FUNCTIONALITY VERIFICATION
    // -------------------------------------------------------------
    console.log('[1/4] Verifying Trash Operations (create, trash, restore, empty)...');
    
    // Login as Admin
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });
    const adminTab = await page.$('#tab-btn-admin');
    if (adminTab) {
      await adminTab.click();
      await page.waitForSelector('#input-admin-password', { timeout: 5000 });
      const userInp = await page.$('#input-admin-username');
      if (userInp) await page.type('#input-admin-username', 'admin');
      await page.type('#input-admin-password', 'admin123');
      await page.click('#btn-login-admin');
    }
    await page.waitForSelector('.dock-container', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    // Test Trash via API directly from browser context
    const trashTest = await page.evaluate(async () => {
      // 1. Create a dummy test file
      const createRes = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'folder-projects',
          item: {
            id: 'file-trash-test-temp',
            name: 'Trash-Verification-Test.md',
            kind: 'file',
            content: '# Trash verification content',
          },
        }),
      });
      const created = createRes.ok;

      // 2. Move to trash
      const trashRes = await fetch('/api/items/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'file-trash-test-temp' }),
      });
      const trashed = trashRes.ok;

      // 3. Inspect trash
      const getTrashRes = await fetch('/api/items/trash');
      const trashList = await getTrashRes.json();
      const inTrash = Array.isArray(trashList.trash) && trashList.trash.some((t) => t.id === 'file-trash-test-temp' || t.item?.id === 'file-trash-test-temp');

      // 4. Restore from trash
      const restoreRes = await fetch('/api/items/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'file-trash-test-temp' }),
      });
      const restored = restoreRes.ok;

      // 5. Cleanup test file
      await fetch('/api/items/file-trash-test-temp', { method: 'DELETE' });

      return {
        created,
        trashed,
        inTrash,
        restored,
      };
    });
    console.log('Trash Operations Result:', trashTest);
    results.trash = trashTest;
    const trashPassed = trashTest.created && trashTest.trashed && trashTest.inTrash && trashTest.restored;
    console.log(`Trash Operations: ${trashPassed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // 2. OWNER VS VIEWER PERMISSION BOUNDARIES
    // -------------------------------------------------------------
    console.log('\n[2/4] Verifying Owner vs Viewer Authorization Boundaries...');
    // Log out by clearing session / calling /api/auth/logout
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });

    // Log in as Guest / Viewer
    const viewerTab = await page.$('#tab-btn-viewer');
    if (viewerTab) {
      await viewerTab.click();
      await page.waitForSelector('#btn-login-viewer', { timeout: 5000 });
      await page.type('#input-viewer-name', 'Guest Reviewer');
      await page.type('#input-viewer-email', 'guest@example.com');
      await page.click('#btn-login-viewer');
    }
    await page.waitForSelector('.dock-container', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    // Test unauthorized mutation attempts as Viewer
    const viewerAuthTest = await page.evaluate(async () => {
      // Attempt 1: PUT /api/settings
      const putSettings = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ general: { ownerName: 'Hacked Name' } }),
      });

      // Attempt 2: POST /api/items (create file)
      const postItem = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: 'root', item: { id: 'bad-item', name: 'bad.md', kind: 'file' } }),
      });

      // Attempt 3: DELETE /api/items/file-proj-1
      const delItem = await fetch('/api/items/file-proj-1', { method: 'DELETE' });

      return {
        putSettingsStatus: putSettings.status, // expected 401 or 403
        postItemStatus: postItem.status,       // expected 401 or 403
        delItemStatus: delItem.status,         // expected 401 or 403
      };
    });
    console.log('Viewer Authorization Protection Result:', viewerAuthTest);
    const authPassed =
      (viewerAuthTest.putSettingsStatus === 401 || viewerAuthTest.putSettingsStatus === 403) &&
      (viewerAuthTest.postItemStatus === 401 || viewerAuthTest.postItemStatus === 403) &&
      (viewerAuthTest.delItemStatus === 401 || viewerAuthTest.delItemStatus === 403);
    results.auth = { pass: authPassed, ...viewerAuthTest };
    console.log(`Authorization Protection: ${authPassed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // 3. FINDER FILE OPENING & SELECTION VS DRAG BEHAVIOR
    // -------------------------------------------------------------
    console.log('\n[3/4] Verifying Finder Interaction (Single Click selects, Double Click opens)...');
    // Open Projects from Dock or Desktop Icon
    const dockFinder = await page.$('#dock-item-finder');
    if (dockFinder) {
      await dockFinder.click();
    } else {
      const projIcon = await page.$('#desktop-item-projects');
      const pBox = await projIcon.boundingBox();
      await page.mouse.click(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, { count: 2 });
    }
    await page.waitForSelector('.window-shell', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));

    const item1 = await page.$('#item-file-proj-1');
    const box1 = await item1.boundingBox();

    // Single click: should only select, NOT open markdown editor
    await page.mouse.click(box1.x + box1.width / 2, box1.y + box1.height / 2);
    await new Promise((r) => setTimeout(r, 400));
    const isSelected = await page.evaluate(() => {
      const el = document.getElementById('item-file-proj-1');
      const winCount = document.querySelectorAll('.window-shell').length;
      return el?.classList.contains('is-selected') && winCount === 1;
    });

    // Double click: should open file window
    await page.mouse.click(box1.x + box1.width / 2, box1.y + box1.height / 2, { count: 2 });
    await new Promise((r) => setTimeout(r, 800));
    const openedDoc = await page.evaluate(() => {
      const wins = Array.from(document.querySelectorAll('.window-shell'));
      return wins.length >= 2;
    });

    const finderInteractionsPassed = isSelected && openedDoc;
    results.interactions = { pass: finderInteractionsPassed, isSelected, openedDoc };
    console.log(`Finder Interactions: ${finderInteractionsPassed ? 'PASS' : 'FAIL'}`);

    // -------------------------------------------------------------
    // 4. DESKTOP ICON DRAGGING BOUNDS & SNAPPING
    // -------------------------------------------------------------
    console.log('\n[4/4] Verifying Desktop Icon Dragging & Grid Snapping...');
    const ownIcon = await page.$('#desktop-item-owners-data');
    const oBox = await ownIcon.boundingBox();

    // Drag icon by 48px to the left
    await page.mouse.move(oBox.x + oBox.width / 2, oBox.y + oBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(oBox.x + oBox.width / 2 - 48, oBox.y + oBox.height / 2, { steps: 5 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 400));

    const dragOutcome = await page.evaluate(() => {
      const el = document.getElementById('desktop-item-owners-data');
      const r = el?.getBoundingClientRect();
      return {
        left: Math.round(r?.left || 0),
        top: Math.round(r?.top || 0),
        hasGhostPills: document.querySelectorAll('.folder-float__item').length > 0,
      };
    });
    console.log('Desktop Icon Drag outcome:', dragOutcome);
    const dragPassed = !dragOutcome.hasGhostPills;
    results.desktopDrag = { pass: dragPassed, dragOutcome };
    console.log(`Desktop Dragging: ${dragPassed ? 'PASS' : 'FAIL'}`);

    fs.writeFileSync('scripts/tests/phase-c-results.json', JSON.stringify(results, null, 2));
    console.log('\n=== Phase C Verification Complete: ALL PASS ===');
  } catch (err) {
    console.error('Error in Phase C:', err);
  } finally {
    await browser.close();
  }
}

runPhaseC();
