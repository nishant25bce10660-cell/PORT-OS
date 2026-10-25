import fs from 'fs';
import path from 'path';

function scanDir(dir, ext) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.next') {
      results = results.concat(scanDir(full, ext));
    } else if (item.isFile() && ext.some(e => item.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const files = scanDir('components', ['.tsx', '.jsx', '.css']).concat(scanDir('app', ['.tsx', '.jsx', '.css']));

const tooltips = [];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('title=') || line.includes('dock-tooltip') || line.includes('tooltip')) {
      tooltips.push({ file: f, line: i + 1, text: line.trim() });
    }
  });
}

const sliders = [];
for (const f of files) {
  if (f.endsWith('.css')) continue;
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('type="range"') || line.includes("type='range'")) {
      sliders.push({ file: f, line: i + 1, text: line.trim() });
    }
  });
}

const dockContent = fs.readFileSync('components/Dock.tsx', 'utf-8');
const dockItems = [];
const itemRegex = /{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)'/g;
let match;
while ((match = itemRegex.exec(dockContent)) !== null) {
  dockItems.push({ id: match[1], label: match[2] });
}

const out = {
  tooltipsCount: tooltips.length,
  tooltips,
  slidersCount: sliders.length,
  sliders,
  dockItemsCount: dockItems.length,
  dockItems
};

fs.writeFileSync('report_assets/round-13/inventory.json', JSON.stringify(out, null, 2));
console.log('Inventory saved. Tooltips:', tooltips.length, 'Sliders:', sliders.length, 'Dock items:', dockItems);
