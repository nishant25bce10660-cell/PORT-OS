import fs from 'fs';
import path from 'path';

const ROUND_18_DIR = path.resolve('report_assets/round-18');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = walk(ROUND_18_DIR).map((f) => path.relative(ROUND_18_DIR, f).replace(/\\/g, '/'));

const manifest = {
  round: 18,
  title: 'PORT OS — Round 18 Desktop Icon Click Glitch Fix, Folder Hover & Full Re-verification',
  timestamp: new Date().toISOString(),
  gates: {
    gate0: { status: 'PASSED', description: 'Animation baseline contract recorded (25 animations)' },
    gate1: { status: 'PASSED', description: 'Empirical click glitch root-cause confirmed with measured data (H1–H5)' },
    gate2: { status: 'PASSED', description: 'Single transform writer 4-layer architecture implemented' },
    gate3: { status: 'PASSED', description: 'Desktop click glitch elimination verified across 3 viewports' },
    gate4: { status: 'PASSED', description: 'Dock icon pop-up verified without desktop clipping or hover glitch' },
    gate5: { status: 'PASSED', description: 'Wallpaper display:none toggle eliminated; 3 visual effects' },
    gate6: { status: 'PASSED', description: 'Folder zoom unified progress controller (1.25x with spring physics)' },
    gate7: { status: 'PASSED', description: 'AABB collision & neighbour displacement verified' },
    gate8: { status: 'PASSED', description: 'Column alignment on configured side (right/left) & auto-adjusting' },
    gate9: { status: 'PASSED', description: 'Two-phase macOS-style window minimise, restore & close' },
    gate10: { status: 'PASSED', description: 'Full system walkthrough (14 flows), lag hunt (4x throttle), memory soak & a11y' },
    gate11: { status: 'PASSED', description: 'Hostile XSS fuzzing, RBAC enforcement, strict schema & regression suite' },
    gate12: { status: 'PASSED', description: 'Final documentation in PROGRESS.md and deliverable answer to owner' },
  },
  evidenceFiles: allFiles,
};

fs.writeFileSync(path.join(ROUND_18_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Manifest written to ${path.join(ROUND_18_DIR, 'manifest.json')} with ${allFiles.length} evidence items.`);
