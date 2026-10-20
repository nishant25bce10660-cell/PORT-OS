#!/usr/bin/env node

import { spawn } from 'child_process';
import http from 'http';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;

if (args.includes('share')) {
  console.log('\n======================================================');
  console.log('       Portfolio OS — Read-Only Share Link');
  console.log('======================================================');
  console.log(`\nViewer URL: ${URL}?view=share\n`);
  console.log('Visitors can sign in as a Viewer using their name and email.');
  console.log('All file modifications and widgets are read-only and server-enforced.\n');
  console.log('======================================================\n');
  process.exit(0);
}

function checkServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/session`, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  console.log('\nStarting Portfolio OS...');
  const isAlreadyRunning = await checkServerReady(PORT);

  if (isAlreadyRunning) {
    console.log(`Portfolio OS is already running at ${URL}`);
    console.log(`Opening browser...\n`);
    await open(URL);
    return;
  }

  console.log(`Launching server on port ${PORT}...`);
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', String(PORT)], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', () => {
    // If next start failed (e.g. not built yet), fall back to dev
    const devChild = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });
    waitForServerAndOpen();
  });

  async function waitForServerAndOpen() {
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 40) {
      await new Promise((r) => setTimeout(r, 500));
      ready = await checkServerReady(PORT);
      attempts++;
    }

    if (ready) {
      console.log(`\nPortfolio OS ready at ${URL}`);
      console.log(`Opening browser...\n`);
      await open(URL);
    } else {
      console.log(`\nPlease navigate to ${URL} in your browser.`);
    }
  }

  waitForServerAndOpen();

  const shutdown = () => {
    child.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
