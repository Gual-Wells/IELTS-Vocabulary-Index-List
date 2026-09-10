import fs from 'node:fs/promises';
import path from 'node:path';
import { toTraditional } from '../js/v3-model.js';

const args = process.argv.slice(2);
const inputFlag = args.indexOf('--input');
const outputFlag = args.indexOf('--output');
const positional = args.filter((item, index) => !item.startsWith('--') && index !== inputFlag + 1 && index !== outputFlag + 1);
const inputName = inputFlag >= 0 ? args[inputFlag + 1] : positional[0];
const outputName = outputFlag >= 0 ? args[outputFlag + 1] : positional[1];
if (!inputName || !outputName) {
  throw new Error('Usage: node tools/finalize-next-seed.mjs <input.json> <output.json>');
}
const inputPath = path.resolve(inputName);
const outputPath = path.resolve(outputName);
if (inputPath === outputPath) throw new Error('Input and output must be different; seed generations are immutable.');

const seed = JSON.parse(await fs.readFile(inputPath, 'utf8'));
seed.entries = (seed.entries || []).map((entry) => {
  const next = {
    ...entry,
    gloss: toTraditional(String(entry.gloss || entry.glossHant || entry.glossHans || '').trim()),
  };
  delete next.glossHans;
  delete next.glossHant;
  delete next.glossSource;
  return next;
});
seed.memberships = (seed.memberships || []).map((membership) => {
  const next = { ...membership, order: Number(membership.order ?? membership.sourceOrder ?? 0) };
  delete next.sourceLabel;
  delete next.sourceOrder;
  return next;
});
seed.pins = (seed.pins || []).map((pin) => {
  const next = { ...pin };
  delete next.domainId;
  return next;
});
seed.annotations = [];
if (seed.settings) {
  delete seed.settings.contentSources;
  delete seed.settings.annotationTask;
  delete seed.settings.verification;
  delete seed.settings.historyPointer;
  delete seed.settings.historySequence;
}
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(seed, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ protocol: 'vix-seed-finalizer/1', input: inputPath, output: outputPath, entries: seed.entries.length }));
