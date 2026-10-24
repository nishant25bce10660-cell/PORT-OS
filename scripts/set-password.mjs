import readline from 'readline';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const PORTFOLIO_PATH = path.resolve('data/portfolio.json');
const ENV_PATH = path.resolve('.env.local');

function askPassword(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Mute stdout while typing password
    const stdin = process.stdin;
    process.stdout.write(promptText);

    let password = '';
    const onData = (char) => {
      char = char.toString('utf-8');
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          password += char;
          break;
      }
    };

    if (process.stdin.isTTY) {
      stdin.on('data', onData);
    }

    rl.question('', (ans) => {
      rl.close();
      resolve(password || ans);
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('  PORT OS — SECURE ADMIN CREDENTIAL SETUP                       ');
  console.log('================================================================\n');

  // If password provided via CLI argument or env var for non-interactive automation
  let newPass = process.argv[2] || process.env.NEW_ADMIN_PASSWORD;

  if (!newPass) {
    newPass = await askPassword('Enter new Admin Password (min 8 characters): ');
    console.log();
    if (!newPass || newPass.trim().length < 8) {
      console.error('Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    const confirmPass = await askPassword('Confirm Admin Password: ');
    console.log();
    if (newPass !== confirmPass) {
      console.error('Error: Passwords do not match.');
      process.exit(1);
    }
  } else {
    if (newPass.length < 8) {
      console.error('Error: Password must be at least 8 characters long.');
      process.exit(1);
    }
  }

  console.log('\nGenerating secure bcrypt hash (cost factor 12)...');
  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(newPass, salt);

  // 1. Update data/portfolio.json
  if (fs.existsSync(PORTFOLIO_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(PORTFOLIO_PATH, 'utf-8'));
      if (!data.admin) data.admin = { username: 'admin' };
      data.admin.passwordHash = hash;
      fs.writeFileSync(PORTFOLIO_PATH, JSON.stringify(data, null, 2), 'utf-8');
      console.log('✓ Stored password hash in data/portfolio.json (admin.passwordHash).');
    } catch (e) {
      console.error('Failed to update data/portfolio.json:', e.message);
    }
  }

  // 2. Clean .env.local: remove any plaintext ADMIN_PASSWORD and store ADMIN_PASSWORD_HASH
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  const lines = envContent.split('\n').filter((l) => !l.startsWith('ADMIN_PASSWORD=') && !l.startsWith('ADMIN_PASSWORD_HASH='));
  lines.push(`ADMIN_PASSWORD_HASH=${hash}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n').trim() + '\n', 'utf-8');
  console.log('✓ Updated .env.local with ADMIN_PASSWORD_HASH (plaintext removed).');

  console.log('\n[SUCCESS] Password set securely. Plaintext password was not logged or stored.');
}

main().catch((err) => {
  console.error('Fatal error setting password:', err);
  process.exit(1);
});
