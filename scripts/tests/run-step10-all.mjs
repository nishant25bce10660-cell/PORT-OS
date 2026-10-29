import { execSync } from 'child_process';
import path from 'path';

function run(cmd, name) {
  console.log(`\n================================================================`);
  console.log(`>>> STEP 10: RUNNING ${name}`);
  console.log(`================================================================`);
  const t0 = Date.now();
  try {
    execSync(cmd, { stdio: 'inherit', env: process.env });
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`>>> [PASS] ${name} completed cleanly in ${sec}s.`);
    return true;
  } catch (err) {
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`>>> [FAIL] ${name} failed after ${sec}s!`);
    return false;
  }
}

console.log('################################################################');
console.log('   PORT OS ROUND 18 · STEP 10 MASTER RE-VERIFICATION SUITE      ');
console.log('################################################################');

const tStart = Date.now();

const tasks = [
  { name: '1. Unified Gate Runner (Gates 1-9)', cmd: 'node scripts/tests/verify-all-gates.mjs' },
  { name: '2. Behaviour Walkthrough (14 flows)', cmd: 'node scripts/tests/step10-behaviour-walkthrough.mjs' },
  { name: '3. Lag Hunt (4x CPU Throttle)', cmd: 'node scripts/tests/step10-lag-hunt.mjs' },
  { name: '4. Animation Contract (25/25 animations)', cmd: 'node scripts/tests/animation-contract.mjs compare' },
  { name: '5. Memory & Resource Soak (500 cycles)', cmd: 'node scripts/tests/step10-memory-soak.mjs' },
  { name: '6. Accessibility (A11y) Audit', cmd: 'node scripts/tests/step10-a11y-audit.mjs' },
];

let allPassed = true;
for (const task of tasks) {
  const ok = run(task.cmd, task.name);
  if (!ok) {
    allPassed = false;
    break;
  }
}

const totalSec = ((Date.now() - tStart) / 1000).toFixed(1);
console.log('\n################################################################');
if (allPassed) {
  console.log(`   [GATE 10 PASSED] ALL 6 SUITES 100% GREEN (${totalSec}s total) `);
} else {
  console.log(`   [GATE 10 FAILED] One or more suites failed.                  `);
  process.exit(1);
}
console.log('################################################################\n');
