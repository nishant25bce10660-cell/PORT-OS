import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GATES = [
  { step: 'Step 1', name: 'Icon Glitch Reproduction & Hypotheses H1-H5', script: 'node scripts/devtools/icon-glitch-probe.mjs' },
  { step: 'Step 2', name: 'Layer Architecture & Single Transform Writer', script: 'node scripts/devtools/check-layers.mjs' },
  { step: 'Step 3', name: 'Glitch-Free Icon Interaction (3 Viewports)', script: 'node scripts/tests/verify-step3-glitch-free.mjs' },
  { step: 'Step 4', name: 'Dock Pop-Out Magnification & WarmTooltip', script: 'node scripts/tests/verify-step4-dock.mjs' },
  { step: 'Step 5', name: 'Effects Catalog Cleanup & Wallpaper Context', script: 'node scripts/tests/verify-step5-cleanup.mjs' },
  { step: 'Step 6', name: 'Folder Zoom & File Emergence System', script: 'node scripts/tests/verify-step6-folder-zoom.mjs' },
  { step: 'Step 7', name: 'Deterministic Neighbour Displacement', script: 'node scripts/tests/verify-step7-displacement.mjs' },
  { step: 'Step 8', name: 'All Folders on One Side & Auto-Adjusting', script: 'node scripts/tests/verify-step8-side.mjs' },
  { step: 'Step 9', name: 'macOS-Style Window Minimise & Close Animation', script: 'node scripts/tests/verify-step9-minimise.mjs' },
];

async function runAllGates() {
  console.log('================================================================');
  console.log('      PORT OS ROUND 18 — UNIFIED GATES 1-9 VERIFICATION RUN     ');
  console.log('================================================================\n');

  const report = [];
  let allWorking = true;

  for (const gate of GATES) {
    process.stdout.write(`Executing [${gate.step}] ${gate.name}... `);
    const t0 = Date.now();
    try {
      const output = execSync(gate.script, { encoding: 'utf8', stdio: 'pipe' });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`WORKING (${elapsed}s)`);
      report.push({
        step: gate.step,
        name: gate.name,
        status: 'WORKING',
        durationSec: elapsed,
        error: null,
      });
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`NOT WORKING (${elapsed}s)`);
      console.error(err.stdout || err.message);
      allWorking = false;
      report.push({
        step: gate.step,
        name: gate.name,
        status: 'NOT WORKING',
        durationSec: elapsed,
        error: err.stdout || err.message,
      });
    }
  }

  console.log('\n================================================================');
  console.log('                   GATE VERIFICATION SUMMARY                    ');
  console.log('================================================================');
  console.table(report.map(r => ({ Step: r.step, Feature: r.name, Status: r.status, Time: `${r.durationSec}s` })));

  const outDir = path.join(process.cwd(), 'report_assets', 'round-18', 'step10');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'gates_1_to_9_summary.json'), JSON.stringify(report, null, 2));

  if (!allWorking) {
    console.error('\n>>> SOME GATES FAILED. STOPPING AND RETURNING TO PREVIOUS STEP. <<<');
    process.exit(1);
  } else {
    console.log('\n>>> ALL GATES 1 TO 9 REPORTED WORKING (100% PASS) <<<');
  }
}

runAllGates();
