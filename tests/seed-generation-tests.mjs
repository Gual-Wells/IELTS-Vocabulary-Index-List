import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  return {
    schemaVersion: 6,
    appVersion: 'independent-seed-generation',
    exportedAt: '2026-09-10T00:00:00.000Z',
    domains: [{ id: 'domain_test', name: 'Test', order: 0, glossEnabled: true, contentMode: 'structured' }],
    collections: [{ id: 'collection_test', domainId: 'domain_test', name: 'Test', type: 'normal', order: 0 }],
    entries: [{ id: 'entry_test', domainId: 'domain_test', text: 'harbor', normalizedText: 'harbor', kind: 'word', partsOfSpeech: ['n.'], glossHans: '港口', glossHant: '', glossSource: 'legacy' }],
    memberships: [{ id: 'membership_test', entryId: 'entry_test', collectionId: 'collection_test', sourceLabel: 'legacy', sourceOrder: 0 }],
    relationComponents: [],
    pins: [],
    annotations: [],
    studyStamps: [],
    settings: { builtInSeedRevision: 9, contentSources: [{ key: 'legacy' }] },
  };
}

test('next Seed finalizer writes an independent compact generation', (t) => {
  const directory = fs.mkdtempSync(path.join(root, '.tmp-seed-generation-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'input.json');
  const output = path.join(directory, 'output.json');
  fs.writeFileSync(input, JSON.stringify(fixture()));
  execFileSync(process.execPath, [path.join(root, 'tools/finalize-next-seed.mjs'), '--input', input, '--output', output], { stdio: 'pipe' });
  const next = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(next.entries[0].gloss, '港口');
  for (const field of ['glossHans', 'glossHant', 'glossSource']) assert.equal(Object.hasOwn(next.entries[0], field), false);
  assert.deepEqual(next.memberships[0].order, 0);
  assert.equal(Object.hasOwn(next.memberships[0], 'sourceLabel'), false);
  assert.equal(Object.hasOwn(next.settings, 'contentSources'), false);
  const validated = spawnSync(process.execPath, [path.join(root, 'tools/validate-next-seed.mjs'), '--input', output], { encoding: 'utf8' });
  assert.equal(validated.status, 0, validated.stdout + validated.stderr);
});

test('next Seed quality gate rejects generic glosses', (t) => {
  const directory = fs.mkdtempSync(path.join(root, '.tmp-seed-reject-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'bad.json');
  const bad = fixture();
  bad.entries[0] = { ...bad.entries[0], gloss: '表示某種情況' };
  delete bad.entries[0].glossHans;
  delete bad.entries[0].glossHant;
  delete bad.entries[0].glossSource;
  bad.memberships[0] = { id: 'membership_test', entryId: 'entry_test', collectionId: 'collection_test', order: 0 };
  delete bad.settings.contentSources;
  fs.writeFileSync(input, JSON.stringify(bad));
  const validated = spawnSync(process.execPath, [path.join(root, 'tools/validate-next-seed.mjs'), input], { encoding: 'utf8' });
  assert.notEqual(validated.status, 0);
  assert.match(validated.stdout, /generic or non-semantic gloss/);
});
