import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'D:\\porfolio project 1\\chrome\\win64-155.0.8059.84\\chrome-win64\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function runBaseline() {
  console.log('--- Launching Browser for Phase A Baseline ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  const results = {};

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });

    // Step 0: Login as Owner/Admin
    console.log('Waiting for boot screen to finish and login screen to appear...');
    await page.waitForSelector('#login-modal-overlay', { timeout: 10000 });
    const hasLogin = await page.$('#login-modal-overlay');
    if (hasLogin) {
      console.log('Logging in as Owner...');
      const adminTab = await page.$('#tab-btn-admin');
      if (adminTab) {
        await adminTab.click();
        await page.waitForSelector('#input-admin-password', { timeout: 5000 });
        const userInp = await page.$('#input-admin-username');
        if (userInp) await page.type('#input-admin-username', 'admin');
        await page.type('#input-admin-password', 'admin123');
        await page.click('#btn-login-admin');
      } else {
        await page.click('#avatar-select-owner');
        await page.type('#input-admin-password', 'admin123');
        await page.click('#btn-login-admin');
      }
      await page.waitForSelector('.dock-container', { timeout: 8000 });
      await new Promise((r) => setTimeout(r, 600));
    }

    // VID-01: Check Widget Positions & Usable Desktop Bounds
    console.log('\n--- Checking VID-01: Widget Geometry & Boundaries ---');
    const widgetsGeometry = await page.evaluate(() => {
      const widgets = Array.from(document.querySelectorAll('.desktop-widget')).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.id,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
          inlineTransform: el.style.transform,
        };
      });
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        widgets,
      };
    });
    console.log('Viewport:', widgetsGeometry.viewport);
    console.log('Widgets geometry at 1920x1080:', JSON.stringify(widgetsGeometry.widgets, null, 2));

    // Check at 1366x768 viewport
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise((r) => setTimeout(r, 500));
    const widgetsAt1366 = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.desktop-widget')).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.id,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
          isOverflowingRight: rect.right > window.innerWidth,
          isOverflowingBottom: rect.bottom > window.innerHeight - 68, // Dock height
        };
      });
    });
    console.log('Widgets at 1366x768 viewport:', JSON.stringify(widgetsAt1366, null, 2));
    results.vid01 = { widgetsAt1366 };

    // Reset viewport to 1920x1080
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise((r) => setTimeout(r, 500));

    // VID-02: Check Desktop Filename Labels & FolderFloat Pills
    console.log('\n--- Checking VID-02: Desktop Icons & FolderFloat Pills ---');
    // Hover over cert-education icon
    const certIcon = await page.$('#desktop-item-cert-education');
    if (certIcon) {
      await certIcon.hover();
      await new Promise((r) => setTimeout(r, 600)); // wait for open animation
      const pillsInfo = await page.evaluate(() => {
        const pills = Array.from(document.querySelectorAll('.folder-float__item')).map((p) => {
          const r = p.getBoundingClientRect();
          return {
            text: p.innerText.trim(),
            rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          };
        });
        const certRect = document.getElementById('desktop-item-cert-education')?.getBoundingClientRect();
        const projRect = document.getElementById('desktop-item-projects')?.getBoundingClientRect();
        return {
          pills,
          certRect,
          projRect,
        };
      });
      console.log('FolderFloat Pills for Cert & Education:', JSON.stringify(pillsInfo, null, 2));
      results.vid02 = pillsInfo;

      // Unhover by moving mouse away
      await page.mouse.move(100, 100);
      await new Promise((r) => setTimeout(r, 400));
    }

    // VID-03: Check Finder Search Bar
    console.log('\n--- Checking VID-03: Finder Toolbar Search Bar ---');
    // Double click Projects icon to open Finder window
    const projIcon = await page.$('#desktop-item-projects');
    if (projIcon) {
      const box = await projIcon.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { count: 2 });
      await page.waitForSelector('.window-shell', { timeout: 6000 });
      await new Promise((r) => setTimeout(r, 600));
    }

    const finderSearchInfo = await page.evaluate(() => {
      const searchInput = document.querySelector('.finder-search-input');
      const toolbar = document.querySelector('.finder-toolbar');
      return {
        hasSearchInput: !!searchInput,
        searchInputHTML: searchInput ? searchInput.outerHTML : null,
        toolbarChildrenCount: toolbar ? toolbar.children.length : 0,
      };
    });
    console.log('Finder Search Bar Info:', finderSearchInfo);
    results.vid03 = finderSearchInfo;

    // VID-04: Check Finder Filename Layout
    console.log('\n--- Checking VID-04: Finder Filename Layout ---');
    const finderItemsLayout = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.finder-item')).map((el) => {
        const label = el.querySelector('.item-name-label');
        const style = label ? window.getComputedStyle(label) : null;
        return {
          id: el.id,
          name: label ? label.textContent.trim() : '',
          wordBreak: style ? style.wordBreak : null,
          maxWidth: style ? style.maxWidth : null,
          overflow: style ? style.overflow : null,
          boxWidth: el.getBoundingClientRect().width,
          boxHeight: el.getBoundingClientRect().height,
        };
      });
      return items;
    });
    console.log('Finder items layout sample:', JSON.stringify(finderItemsLayout.slice(0, 4), null, 2));
    results.vid04 = finderItemsLayout;

    // VID-05: Check Widget Controls & Pointer Interaction
    console.log('\n--- Checking VID-05: Widget Controls ---');
    const widgetControlsInfo = await page.evaluate(() => {
      const handles = Array.from(document.querySelectorAll('.widget-handle')).map((h) => ({
        id: h.id,
        action: h.getAttribute('data-action'),
        ariaLabel: h.getAttribute('aria-label'),
      }));
      return handles;
    });
    console.log('Widget handles:', widgetControlsInfo);
    results.vid05 = widgetControlsInfo;

    // VID-06: Check Visual Effects Rendering
    console.log('\n--- Checking VID-06: Visual Effects Classes & Styles ---');
    const effectsInfo = await page.evaluate(() => {
      const desktop = document.getElementById('portfolio-desktop-os');
      const widget = document.querySelector('.desktop-widget');
      const widgetStyle = widget ? window.getComputedStyle(widget) : null;
      return {
        desktopClasses: desktop ? desktop.className : '',
        bodyClasses: document.body.className,
        widgetInlineTransform: widget ? widget.style.transform : null,
        widgetComputedTransform: widgetStyle ? widgetStyle.transform : null,
        widgetBoxShadow: widgetStyle ? widgetStyle.boxShadow : null,
        widgetBackdropFilter: widgetStyle ? (widgetStyle.backdropFilter || widgetStyle.webkitBackdropFilter) : null,
      };
    });
    console.log('Visual Effects info:', effectsInfo);
    results.vid06 = effectsInfo;

    // VID-07: Check Customization Persistence in API
    console.log('\n--- Checking VID-07: Settings API Persistence ---');
    const apiSettings = await page.evaluate(async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return { error: res.status };
      return await res.json();
    });
    console.log('Current /api/settings effects:', apiSettings.settings?.customization?.effects);
    results.vid07 = apiSettings;

    // VID-08: Check Finder Window Controls & Tooltips
    console.log('\n--- Checking VID-08: Window Traffic Light Controls ---');
    const windowControls = await page.evaluate(() => {
      const finderWin = document.querySelector('.window-shell');
      if (!finderWin) return null;
      const closeBtn = finderWin.querySelector('.traffic-light-close');
      const minBtn = finderWin.querySelector('.traffic-light-minimize');
      const maxBtn = finderWin.querySelector('.traffic-light-maximize');
      return {
        windowId: finderWin.id,
        close: closeBtn ? { id: closeBtn.id, label: closeBtn.getAttribute('aria-label') } : null,
        minimize: minBtn ? { id: minBtn.id, label: minBtn.getAttribute('aria-label') } : null,
        maximize: maxBtn ? { id: maxBtn.id, label: maxBtn.getAttribute('aria-label') } : null,
      };
    });
    console.log('Window controls:', windowControls);
    results.vid08 = windowControls;

    // Write results to baseline report
    fs.writeFileSync('scripts/tests/baseline-results.json', JSON.stringify(results, null, 2));
    console.log('\nBaseline completed and written to scripts/tests/baseline-results.json');
  } catch (err) {
    console.error('Error during baseline:', err);
  } finally {
    await browser.close();
  }
}

runBaseline();
