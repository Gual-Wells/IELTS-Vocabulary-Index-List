import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

const files = ['index.html', 'manifest.webmanifest', 'sw.js'];
const directories = ['css', 'js', 'assets/icons', 'data/seed5-runtime'];
const dataFiles = ['data/seed-4.json', 'data/relation-low-level-lexemes.json'];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

for (const relative of files) {
  await fs.copyFile(path.join(root, relative), path.join(output, relative));
}
for (const relative of directories) {
  await fs.cp(path.join(root, relative), path.join(output, relative), { recursive: true });
}
for (const relative of dataFiles) {
  const destination = path.join(output, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, relative), destination);
}

console.log('dist: OK (runtime allowlist only)');

