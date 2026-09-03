import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

const out = new URL('../data/sources/seed5/', import.meta.url);
const retrievedAt = '2026-09-02';
const records = [];

const pins = Object.freeze({
  octanove: 'd4e45b75b38f27b30dfc5c44d8c571aec7e7092f',
  coca: 'cee58af112e7469261bd52ce5a44d75986ac757b',
  cet: '773cb8a955e28c89eb676618746d869e3417d1c8',
  qwerty: '122acd90b4079dd040c28a14356447f6553cff83',
  phrases: '4362d151decd8fd92e511bdd2cda31efbe63c8eb',
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fetchBytes(url, attempts = 5) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'VIX-Seed5-source-fetcher/1' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (caught) {
      error = caught;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  throw error;
}

async function save({ key, file, url, authority, license, note = '' }) {
  const bytes = await fetchBytes(url);
  await fs.writeFile(new URL(file, out), bytes);
  records.push({ key, file, url, authority, license, note, bytes: bytes.length, sha256: sha256(bytes) });
  console.log(`${key}: ${bytes.length} bytes`);
  return bytes;
}

await fs.mkdir(out, { recursive: true });

await save({
  key: 'cefrj-1.6', file: 'CEFRJ_wordlist_ver1.6.zip',
  url: 'https://www.cefr-j.org/data/CEFRJ_wordlist_ver1.6.zip',
  authority: 'official', license: 'Free research and commercial use with proper acknowledgement',
  note: 'Canonical CEFR-J 1.6 archive; covers A1 through B2.',
});
await save({
  key: 'octanove-c1c2-1.0', file: 'octanove-c1c2-1.0.csv',
  url: `https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/${pins.octanove}/octanove-vocabulary-profile-c1c2-1.0.csv`,
  authority: 'publisher-approved mirror', license: 'CC BY-SA 4.0',
  note: 'C1/C2 profile supplied by Octanove Labs through Open Language Profiles.',
});
await save({
  key: 'nawl-1.2', file: 'NAWL_1.2_alphabetized_description.txt',
  url: 'https://static1.squarespace.com/static/64336926d7c6bb38965fdf3b/t/644e0e936f1c072f5a0503f8/1682837139514/NAWL_1.2_alphabetized_description.txt',
  authority: 'official', license: 'CC BY-SA 4.0',
  note: 'Official alphabetized NAWL 1.2 file. Header plus 957 entries in the current official download.',
});
await save({
  key: 'cet-2016-community', file: 'cet_full_list.json',
  url: `https://raw.githubusercontent.com/exam-data/CETVocabulary/${pins.cet}/cet_full_list.json`,
  authority: 'community transcription', license: 'CC BY-NC-SA 4.0 data',
  note: 'Community transcription of the 2016 CET outline; not an official examination authority release.',
});
await save({
  key: 'tem4-community', file: 'Level4luan_2_T.json',
  url: `https://raw.githubusercontent.com/RealKai42/qwerty-learner/${pins.qwerty}/public/dicts/Level4luan_2_T.json`,
  authority: 'community compilation', license: 'GPL-3.0 repository license; no separate data-specific grant stated',
  note: 'Qwerty Learner community dictionary; not an official TEM syllabus export.',
});
await save({
  key: 'tem8-community', file: 'Level8luan_2_T.json',
  url: `https://raw.githubusercontent.com/RealKai42/qwerty-learner/${pins.qwerty}/public/dicts/Level8luan_2_T.json`,
  authority: 'community compilation', license: 'GPL-3.0 repository license; no separate data-specific grant stated',
  note: 'Qwerty Learner community dictionary; not an official TEM syllabus export.',
});

const cocaRows = [];
const cocaParts = [];
for (let part = 1; part <= 50; part++) {
  const start = (part - 1) * 200 + 1;
  const end = part * 200;
  const filename = `part${String(part).padStart(3, '0')}_${start}-${end}.md`;
  const url = `https://raw.githubusercontent.com/llt22/coca-vocabulary-20000/${pins.coca}/vocabulary/${filename}`;
  const bytes = await fetchBytes(url);
  const text = bytes.toString('utf8');
  const rows = [...text.matchAll(/^\s*(\d+)\s+([^\s]+)\s*$/gm)].map((match) => `${match[1]}\t${match[2]}`);
  if (rows.length !== 200) throw new Error(`${filename}: expected 200 ranked rows, received ${rows.length}`);
  cocaRows.push(...rows);
  cocaParts.push({ file: filename, url, bytes: bytes.length, sha256: sha256(bytes) });
}
const cocaBytes = Buffer.from(`${cocaRows.join('\n')}\n`, 'utf8');
await fs.writeFile(new URL('coca-1-10000.tsv', out), cocaBytes);
records.push({
  key: 'coca-1-10000-community', file: 'coca-1-10000.tsv',
  url: `https://github.com/llt22/coca-vocabulary-20000/tree/${pins.coca}/vocabulary`,
  authority: 'community mirror', license: 'MIT repository license',
  note: 'Ranked community mirror only; it is not represented as an official COCA distribution.',
  bytes: cocaBytes.length, sha256: sha256(cocaBytes), sourceParts: cocaParts,
});
console.log(`coca-1-10000-community: ${cocaRows.length} ranked rows`);

for (const level of ['cet4', 'cet6', 'tem4', 'tem8']) {
  await save({
    key: `${level}-phrases-community`, file: `phrases-${level}.txt`,
    url: `https://raw.githubusercontent.com/2ndLA/english-phrases/${pins.phrases}/lists/${level}.txt`,
    authority: 'community compilation', license: 'CC BY-SA 4.0',
    note: level.startsWith('tem') ? 'The source itself labels TEM coverage as fragmentary.' : 'Secondary phrase evidence only.',
  });
}

const manifest = {
  protocol: 'vix-seed-source-manifest/1',
  seedRevision: 5,
  retrievedAt,
  pins,
  records,
};
await fs.writeFile(new URL('SOURCE_MANIFEST.json', out), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`source manifest: ${records.length} records`);
