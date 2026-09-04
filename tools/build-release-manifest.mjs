import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slash = (value) => value.split(path.sep).join('/');

function excluded(relative) {
  const parts = relative.split('/');
  const base = parts.at(-1);
  return parts.includes('.git') || parts.includes('.wrangler') || parts.includes('node_modules') || parts.includes('dist')
    || parts.some((part) => /^pip-(?:build|ephem|install|target)-/.test(part))
    || relative === '.dev.vars' || /^\.dev\.vars\.(?!example$)/.test(relative)
    || relative === '.env' || /^\.env\.(?!example$)/.test(relative)
    || (!relative.includes('/') && base.endsWith('.zip'));
}

async function walk(directory = root) {
  const rows = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = slash(path.relative(root, absolute));
    if (excluded(relative)) continue;
    if (entry.isDirectory()) rows.push(...await walk(absolute));
    else if (entry.isFile()) rows.push(relative);
    else throw new Error(`Unsupported package entry: ${relative}`);
  }
  return rows;
}

async function sha256(relative) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(path.join(root, relative))) hash.update(chunk);
  return hash.digest('hex');
}

const files = (await walk()).sort((left, right) => left.localeCompare(right, 'en'));
await fs.writeFile(path.join(root, 'FILE_MANIFEST.txt'), `${files.join('\n')}\n`, 'utf8');

const checksummed = files.filter((relative) => relative !== 'SHA256SUMS.txt');
const sums = [];
for (const relative of checksummed) sums.push(`${await sha256(relative)}  ./${relative}`);
await fs.writeFile(path.join(root, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');

console.log(`release-manifest: OK (${files.length} files; ${sums.length} checksums)`);
