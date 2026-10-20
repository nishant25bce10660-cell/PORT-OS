import { spawn } from 'child_process';
import path from 'path';

process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const testSuites = [
  { name: 'M1: Windows (W1–W9)', script: 'scripts/tests/test-windows-w1-w9.mjs' },
  { name: 'M2: Widgets & Typography', script: 'scripts/tests/test-m2-widgets-typography.mjs' },
  { name: 'M3 & M4: Boot, Audio, Dock & Menu', script: 'scripts/tests/test-round2-boot-dock-menu.mjs' },
  { name: 'M5 & M6: Finder, Settings & Security', script: 'scripts/tests/test-round3-finder-settings.mjs' },
  { name: 'M7 & M8: Shader Wallpaper & Spotlight', script: 'scripts/tests/test-round4-shader-spotlight.mjs' },
  { name: 'M9 & M10: Terminal, Control Center & FPS', script: 'scripts/tests/test-round5-terminal-control-mobile.mjs' },
  { name: 'M11 & M12: Defects (D1–D14) & Security Audit', script: 'scripts/tests/test-round6-defects-and-security.mjs' },
];

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`Script ${scriptPath} exited with code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}

async function runAll() {
  console.log('================================================================');
  console.log('       PORT OS — FULL MASTER TEST SUITE RUNNER                  ');
  console.log('================================================================\n');

  const startTime = Date.now();
  const summary = [];

  for (const suite of testSuites) {
    console.log(`\n>>> STARTING: ${suite.name} (${suite.script})`);
    try {
      await runScript(suite.script);
      summary.push({ name: suite.name, status: 'PASS' });
    } catch (err) {
      summary.push({ name: suite.name, status: 'FAIL', error: err.message });
      console.error(`\n[FAILED] ${suite.name}: ${err.message}`);
      break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n================================================================');
  console.log(`  MASTER AUDIT SUMMARY (Completed in ${elapsed}s)`);
  console.log('================================================================');
  for (const item of summary) {
    const marker = item.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${marker} [${item.status}] ${item.name}`);
  }
  console.log('================================================================\n');

  const hasFail = summary.some((s) => s.status === 'FAIL');
  process.exit(hasFail ? 1 : 0);
}

runAll();
