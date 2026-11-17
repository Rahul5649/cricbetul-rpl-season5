import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const required = [
  'public/index.html', 'public/auction.html', 'public/display.html', 'public/overlay.html', 'public/setup-check.html',
  'public/assets/rpl-season5.jpg', 'public/assets/cricbetul-logo.webp', 'public/assets/payment-qr.jpg',
  'netlify/functions/api.mjs', 'netlify/functions/media.mjs',
  'netlify/database/migrations/0001_create_rpl_state.sql', 'netlify.toml', 'package.json'
];
const missing = required.filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error('Missing required project files:', missing.join(', '));
  process.exit(1);
}

for (const file of ['netlify/functions/api.mjs', 'netlify/functions/media.mjs']) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Syntax check failed: ${file}\n${result.stderr}`);
    process.exit(1);
  }
}

for (const file of ['public/index.html', 'public/display.html', 'public/overlay.html']) {
  const html = readFileSync(resolve(root, file), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  for (let i = 0; i < blocks.length; i++) {
    const result = spawnSync(process.execPath, ['--check'], { input: blocks[i][1], encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`Inline JavaScript syntax check failed: ${file} script ${i + 1}\n${result.stderr}`);
      process.exit(1);
    }
  }
}

const api = readFileSync(resolve(root, 'netlify/functions/api.mjs'), 'utf8');
const migration = readFileSync(resolve(root, 'netlify/database/migrations/0001_create_rpl_state.sql'), 'utf8');
if (!api.includes('getDatabase') || !api.includes('FOR UPDATE') || !api.includes('register-player') || !api.includes('submit-payment')) {
  console.error('API database/persistence checks failed.');
  process.exit(1);
}
if (!migration.includes('CREATE TABLE IF NOT EXISTS rpl_state') || !migration.includes('ON CONFLICT (id) DO NOTHING')) {
  console.error('Database migration check failed.');
  process.exit(1);
}
console.log('RPL Season 5 smoke checks passed: project files, API syntax, media function syntax, inline JavaScript and database migration.');
