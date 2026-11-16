// Loads .env.local into process.env. Creates it from .env.local.example on the first run,
// and adds any setting that a newer version of .env.local.example introduced.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const parse = (text) =>
  Object.fromEntries(
    text.split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
  );

export function loadEnv() {
  const envFile = path.join(ROOT, '.env.local');
  const example = fs.readFileSync(path.join(ROOT, '.env.local.example'), 'utf8');
  if (!fs.existsSync(envFile)) {
    fs.writeFileSync(envFile, example.replace('JWT_SECRET=change-me', `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`));
    console.log('Created .env.local');
  } else {
    const have = parse(fs.readFileSync(envFile, 'utf8'));
    const missing = Object.entries(parse(example)).filter(([k]) => !(k in have));
    if (missing.length) {
      fs.appendFileSync(envFile, '\n# added by a newer version\n' + missing.map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
      console.log(`Added to .env.local: ${missing.map(([k]) => k).join(', ')}`);
    }
  }
  for (const [k, v] of Object.entries(parse(fs.readFileSync(envFile, 'utf8')))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return process.env;
}
