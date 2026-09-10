import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canonicalizeBackup } from '../js/v3-model.js';
import {
  MIRROR_CONTEXT_PROTOCOL, MIRROR_RESULT_PROTOCOL, buildMirrorContext,
  extendMirrorRecord, prepareMirrorResult,
} from '../js/v5-mirror3.js';
import {
  activateMirror, commitMirrorCurrent, deactivateMirror, deleteMirrorRecord, getMirrorSnapshot,
  initializeMirrorRuntime,
} from '../js/v5-mirror-runtime.js';

const state = {
  domains: [{ id: 'domain_general', name: '通用英语', order: 0, contentMode: 'structured' }],
  collections: [{ id: 'collection_b1', domainId: 'domain_general', name: 'B1', order: 0, type: 'normal', hidden: false }],
  entries: [
    { id: 'entry_alpha', text: 'alpha', normalizedText: 'alpha', kind: 'word', domainId: 'domain_general', partsOfSpeech: ['n.'], gloss: '阿爾法' },
    { id: 'entry_beta', text: 'beta', normalizedText: 'beta', kind: 'word', domainId: 'domain_general', partsOfSpeech: [], gloss: '' },
  ],
  membershipsByEntry: new Map([
    ['entry_alpha', [{ entryId: 'entry_alpha', collectionId: 'collection_b1' }]],
    ['entry_beta', [{ entryId: 'entry_beta', collectionId: 'collection_b1' }]],
  ]),
  lowLevelRelationLexemes: new Set(['alpha']),
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resultFor(context) {
  return {
    protocol: MIRROR_RESULT_PROTOCOL,
    kind: 'vix-mirror-result',
    runId: 'vmr_test',
    contextRevision: context.revision,
    sourceCorpusHash: context.sourceCorpusHash,
    matchCorpusHash: context.matchCorpusHash,
    collectionCatalogHash: context.collectionCatalogHash,
    matchPolicyHash: context.matchPolicyHash,
    materialLabel: 'Paper A',
    existingMatches: [{
      slot: 2, mirrorClass: 'vocabulary', matchType: 'exact', surfaceForm: 'beta',
      importance: 'core', gloss: '貝塔',
      evidence: [{ quote: 'beta appears here', location: 'p.1' }],
    }],
    candidates: [{
      candidateId: 'candidate_gamma', text: 'gamma', normalizedText: 'gamma', kind: 'word',
      mirrorClass: 'vocabulary', partsOfSpeech: ['n.'], gloss: '伽馬', importance: 'related',
      domainKey: 'domain_general', collectionKeys: ['collection_b1'],
      evidence: [{ quote: 'gamma appears here', location: 'p.1' }], relatedExistingSlots: [1],
    }],
  };
}

test('Mirror Context freezes slots, policies, and keeps local Entry IDs private', async () => {
  const context = await buildMirrorContext(state);
  assert.equal(context.protocol, MIRROR_CONTEXT_PROTOCOL);
  assert.deepEqual(context.corpus.map((item) => item.slot), [1, 2]);
  assert.equal(context.corpus[0].relationNoise, true);
  assert.equal(context.corpus[1].relationNoise, false);
  assert.equal(context.matchPolicy.equalPriority, true);
  assert.deepEqual(context.matchPolicy.classes, ['vocabulary', 'phrase', 'usage']);
  assert.equal(context.matchPolicy.phraseAndUsageNeverSuppressedByComponentNoise, true);
  assert.ok(!JSON.stringify(context).includes('entry_alpha'));
  assert.deepEqual(context.resultContract.required, [
    'protocol', 'kind', 'runId', 'contextRevision', 'sourceCorpusHash', 'matchCorpusHash',
    'collectionCatalogHash', 'matchPolicyHash', 'materialLabel', 'existingMatches', 'candidates',
  ]);
});

test('Mirror Result verifies frozen hashes and maps slots on the local device', async () => {
  const context = await buildMirrorContext(state);
  const prepared = await prepareMirrorResult(resultFor(context));
  assert.deepEqual(prepared.mirrorRecord.entryIds, ['entry_beta']);
  assert.equal(prepared.existingMatches[0].entryId, 'entry_beta');
  assert.equal(prepared.existingMatches[0].mirrorClass, 'vocabulary');
  assert.equal(prepared.existingMatches[0].gloss, '貝塔');
  assert.equal(prepared.candidates[0].valid, true);
  assert.deepEqual(prepared.candidates[0].relatedEntryIds, ['entry_alpha']);
  const extended = await extendMirrorRecord(prepared.mirrorRecord, ['entry_beta', ...prepared.candidates[0].relatedEntryIds, 'entry_gamma']);
  assert.deepEqual(extended.entryIds, ['entry_beta', 'entry_alpha', 'entry_gamma']);
  assert.match(extended.mirrorHash, /^sha256:[a-f0-9]{64}$/);
  await assert.rejects(prepareMirrorResult({ ...resultFor(context), matchCorpusHash: `sha256:${'0'.repeat(64)}` }), /不一致/);
  await assert.rejects(prepareMirrorResult({ ...resultFor(context), matchPolicyHash: `sha256:${'0'.repeat(64)}` }), /匹配策略/);
  const badSlot = resultFor(context);
  badSlot.candidates[0].relatedExistingSlots = [999];
  await assert.rejects(prepareMirrorResult(badSlot), /relatedExistingSlots/);
  const wrongKind = resultFor(context);
  wrongKind.candidates[0].kind = 'content';
  assert.equal((await prepareMirrorResult(wrongKind)).candidates[0].valid, false);
});

test('Mirror Result never imports visibly corrupted question-mark glosses', async () => {
  const dirtyState = {
    ...state,
    entries: state.entries.map((entry, index) => index === 0
      ? { ...entry, gloss: '\uFFFD\uFFFD\uFFFD' }
      : entry),
  };
  const dirtyContext = await buildMirrorContext(dirtyState);
  assert.equal(dirtyContext.corpus[0].gloss, '');
  const context = await buildMirrorContext(state);
  const broken = resultFor(context);
  broken.existingMatches[0].gloss = '\ufffd\ufffd\ufffd';
  broken.candidates[0].gloss = 'valid gloss';
  const prepared = await prepareMirrorResult(broken);
  assert.equal(prepared.existingMatches[0].gloss, '');
  assert.equal(prepared.candidates[0].gloss, 'valid gloss');

  const glossContext = await buildMirrorContext({
    ...state,
    domains: state.domains.map((domain) => ({ ...domain, glossEnabled: true })),
  });
  const missingRequiredGloss = resultFor(glossContext);
  missingRequiredGloss.candidates[0].gloss = '\uFFFD\uFFFD';
  assert.equal((await prepareMirrorResult(missingRequiredGloss)).candidates[0].valid, false);
});

test('full Seed context fits the sidecar limit and exposes slots instead of Entry IDs', async () => {
  const seed = canonicalizeBackup(JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8')));
  const membershipsByEntry = new Map();
  for (const membership of seed.memberships) {
    const items = membershipsByEntry.get(membership.entryId) || [];
    items.push(membership);
    membershipsByEntry.set(membership.entryId, items);
  }
  const context = await buildMirrorContext({
    domains: seed.domains, collections: seed.collections, entries: seed.entries, membershipsByEntry,
    lowLevelRelationLexemes: new Set(),
  });
  assert.equal(context.corpus.length, seed.entries.length);
  assert.ok(Buffer.byteLength(JSON.stringify(context), 'utf8') < 16 * 1024 * 1024);
  assert.ok(!context.corpus.some((item) => Object.hasOwn(item, 'id') || Object.hasOwn(item, 'entryId')));
});

test('Mirror material library supports selection, activation, and permanent deletion', async () => {
  const context = await buildMirrorContext(state);
  const prepared = await prepareMirrorResult(resultFor(context));
  const record = await extendMirrorRecord(prepared.mirrorRecord, {
    existingMatches: prepared.existingMatches,
    candidateImports: [],
    entryIds: ['entry_beta'],
  });
  await initializeMirrorRuntime();
  await commitMirrorCurrent(record, ['entry_alpha', 'entry_beta']);
  assert.equal(getMirrorSnapshot().library.length, 1);
  assert.equal(getMirrorSnapshot().library[0].record.runId, 'vmr_test');
  await activateMirror(['entry_alpha', 'entry_beta'], record.mirrorId);
  assert.equal(getMirrorSnapshot().active.mirrorId, record.mirrorId);
  await deleteMirrorRecord(record.mirrorId);
  assert.equal(getMirrorSnapshot().enabled, false);
  assert.equal(getMirrorSnapshot().library.length, 0);
  assert.equal(getMirrorSnapshot().current, null);
  deactivateMirror();
});
