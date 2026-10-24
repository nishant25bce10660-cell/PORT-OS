import fs from 'fs';
import path from 'path';

const API_DIR = path.resolve('app/api');
const COMPONENTS_DIR = path.resolve('components');
const APP_DIR = path.resolve('app');
const LIB_DIR = path.resolve('lib');

function walkDir(dir, filter = () => true) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath, filter));
    } else if (filter(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

// 1.1 API Inventory
const apiFiles = walkDir(API_DIR, (f) => f.endsWith('.ts') || f.endsWith('.js'));
const apiInventory = [];

for (const file of apiFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const route = '/' + relPath.replace('app/', '').replace('/route.ts', '').replace('/route.js', '');

  const methods = [];
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }

  const hasHostOriginCheck = content.includes('validateHostAndOrigin');
  const hasRequireRole = content.includes('requireRole');
  const hasSessionCheck = content.includes('getSession');
  const hasAdminCheck = content.includes('role !== \'admin\'') || content.includes('role === \'admin\'') || content.includes('admin');
  const hasBodyValidation = content.includes('req.json()') || content.includes('formData()');

  apiInventory.push({
    file: relPath,
    route,
    methods,
    hasHostOriginCheck,
    hasRequireRole,
    hasSessionCheck,
    hasAdminCheck,
    hasBodyValidation,
  });
}

// 1.2 Dangerous APIs Scan
const allSourceFiles = [
  ...walkDir(APP_DIR, (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')),
  ...walkDir(COMPONENTS_DIR, (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')),
  ...walkDir(LIB_DIR, (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')),
];

const patterns = {
  dangerouslySetInnerHTML: /dangerouslySetInnerHTML/g,
  innerHTML: /\.innerHTML\s*=/g,
  eval: /\beval\s*\(/g,
  newFunction: /new\s+Function\s*\(/g,
  childProcess: /child_process|spawn\s*\(|exec\s*\(/g,
  variableFs: /fs\.\w+\s*\([^)]*[\+`]/g,
  mathRandom: /Math\.random\s*\(\)/g,
  localStorage: /localStorage\./g,
  indexedDB: /indexedDB/g,
  documentCookie: /document\.cookie/g,
  fetch: /\bfetch\s*\(/g,
};

const dangerFindings = [];

for (const file of allSourceFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    for (const [key, regex] of Object.entries(patterns)) {
      if (regex.test(line)) {
        dangerFindings.push({
          file: relPath,
          line: lineIdx + 1,
          type: key,
          code: line.trim(),
        });
      }
    }
  });
}

// 1.3 Remnants of Removed Features Scan
const remnantPatterns = {
  controlCenter: /ControlCenter|menu-btn-control-center|control-center/gi,
  pcBridge: /\/api\/pc|pcBridge|sidebar-item-pc/gi,
  editMode: /toggle-edit-mode|edit-mode-pill/gi,
  persistentSearch: /persistent-desktop-search|#persistent-desktop-search/gi,
};

const remnantFindings = [];
for (const file of allSourceFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    for (const [key, regex] of Object.entries(remnantPatterns)) {
      if (regex.test(line)) {
        // filter out comments or known tests
        remnantFindings.push({
          file: relPath,
          line: lineIdx + 1,
          type: key,
          code: line.trim(),
        });
      }
    }
  });
}

// 1.4 Write Expected Authorization Matrix to SECURITY/authz-matrix.json
const authzMatrix = [];

for (const item of apiInventory) {
  for (const m of item.methods) {
    let expectedAnon = 401;
    let expectedGuest = 403;
    let expectedOwner = 200;

    // Public / Read routes
    if (m === 'GET' && (item.route === '/api/portfolio' || item.route === '/api/session')) {
      expectedAnon = 200;
      expectedGuest = 200;
      expectedOwner = 200;
    } else if (item.route === '/api/auth/login') {
      expectedAnon = m === 'POST' ? 200 : 405;
      expectedGuest = 200;
      expectedOwner = 200;
    } else if (item.route === '/api/auth/logout') {
      expectedAnon = 200;
      expectedGuest = 200;
      expectedOwner = 200;
    } else if (item.route.startsWith('/api/pc')) {
      // Per Q3: PC bridge is to be deleted/disabled -> should return 404
      expectedAnon = 404;
      expectedGuest = 404;
      expectedOwner = 404;
    } else if (m === 'GET' && item.route === '/api/settings') {
      expectedAnon = 200;
      expectedGuest = 200;
      expectedOwner = 200;
    } else if (m === 'GET' && item.route === '/api/telemetry/visitors') {
      // Telemetry visitors list is Owner only
      expectedAnon = 403;
      expectedGuest = 403;
      expectedOwner = 200;
    } else if (m === 'POST' && item.route === '/api/telemetry/visitors') {
      // Log visitor
      expectedAnon = 200;
      expectedGuest = 200;
      expectedOwner = 200;
    }

    authzMatrix.push({
      route: item.route,
      method: m,
      handler: item.file,
      expected: {
        anonymous: expectedAnon,
        guest: expectedGuest,
        owner: expectedOwner,
      },
      hasRequireRole: item.hasRequireRole,
      hasHostOriginCheck: item.hasHostOriginCheck,
    });
  }
}

const secDir = path.resolve('SECURITY');
if (!fs.existsSync(secDir)) fs.mkdirSync(secDir, { recursive: true });
fs.writeFileSync(path.join(secDir, 'authz-matrix.json'), JSON.stringify(authzMatrix, null, 2), 'utf-8');

console.log('API Inventory count:', apiInventory.length);
console.log('Dangerous APIs findings count:', dangerFindings.length);
console.log('Remnants findings count:', remnantFindings.length);
console.log('Authz matrix written to SECURITY/authz-matrix.json (' + authzMatrix.length + ' endpoints)');

fs.writeFileSync(
  'report_assets/round-10/source-inventory.json',
  JSON.stringify({ apiInventory, dangerFindings, remnantFindings }, null, 2),
  'utf-8'
);
