import fs from 'fs';
import path from 'path';

const REPORT_DIR = path.resolve('report_assets/round-15');
const MANIFEST_PATH = path.join(REPORT_DIR, 'manifest.json');

export function initEvidenceRecorder() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ round: 15, checks: [], createdAt: new Date().toISOString() }, null, 2), 'utf8');
  }
}

export function recordEvidence(id, passed, description, metrics = {}, screenshotFilename = null) {
  initEvidenceRecorder();
  let manifest = { round: 15, checks: [] };
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {}

  const existingIdx = manifest.checks.findIndex((c) => c.id === id);
  const entry = {
    id,
    passed: !!passed,
    description,
    metrics,
    screenshot: screenshotFilename,
    timestamp: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    manifest.checks[existingIdx] = entry;
  } else {
    manifest.checks.push(entry);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[EVIDENCE] ${id}: ${passed ? 'PASS' : 'FAIL'} — ${description}`);
  return entry;
}
