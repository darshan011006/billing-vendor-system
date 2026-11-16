// Loads .env.local (creating it from .env.local.example on first run) into process.env.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const envFile = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envFile)) {
    const example = fs.readFileSync(path.join(ROOT, '.env.local.example'), 'utf8');
    fs.writeFileSync(envFile, example.replace('JWT_SECRET=change-me', `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`));
    console.log('Created .env.local');
  }
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
  return process.env;
}
