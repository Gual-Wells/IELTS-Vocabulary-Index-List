import assert from 'node:assert/strict';
import test from 'node:test';

import { SuppressionRuntime, deriveEffectiveProjection, setMirrorSuppression } from '../js/v5-suppression-runtime.js';
import {
  activateMirror, commitMirrorCurrent, deactivateMirror, effectiveProjectionFromMirror, getMirrorSnapshot,
} from '../js/v5-mirror-runtime.js';
import {
  MATCH_RESULT_KIND, SESSION_PROTOCOL, acceptMatchResult, createMatchRequest,
} from '../js/v5-session-capsule.js';

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const mirror = (id, ids, sequence = 1) => ({
  protocol: 'vix-mirror/2', mirrorId: id, createdAt: '2026-09-02T00:00:00.000Z',
  sourceCorpusHash: hash('a'), matchCorpusHash: hash('b'), mirrorHash: hash('c'),
  requestSequence: sequence, entryIds: ids, materialLabel: id, matchMode: 'lexical',
});

test('suppression reasons compose with OR semantics and preserve collection keys', () => {
  const runtime = new SuppressionRuntime();
  setMirrorSuppression(runtime, ['a', 'b', 'c'], ['a', 'c']);
  runtime.replace('entry', 'future-policy', ['c']);
  const effective = deriveEffectiveProjection(new Map([
    ['one', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]],
    ['empty', []],
  ]), runtime);
  assert.deepEqual(effective.get('one').map((entry) => entry.id), ['a']);
  assert.ok(effective.has('empty'));
  runtime.clear('entry', 'mirror-background');
  assert.equal(runtime.suppressed('c'), true);
});

test('CURRENT delivery never hot-swaps ACTIVE; OFF to ON picks up newest CURRENT', async () => {
  deactivateMirror();
  await commitMirrorCurrent(mirror('A', ['a']), ['a', 'b']);
  await activateMirror(['a', 'b']);
  assert.equal(getMirrorSnapshot().active.mirrorId, 'A');
  await commitMirrorCurrent(mirror('B', ['b'], 2), ['a', 'b']);
  assert.equal(getMirrorSnapshot().current.mirrorId, 'B');
  assert.equal(getMirrorSnapshot().active.mirrorId, 'A');
  assert.deepEqual(effectiveProjectionFromMirror(new Map([['all', [{ id: 'a' }, { id: 'b' }]]])).get('all').map((entry) => entry.id), ['a']);
  deactivateMirror();
  await activateMirror(['a', 'b']);
  assert.equal(getMirrorSnapshot().active.mirrorId, 'B');
  assert.deepEqual(effectiveProjectionFromMirror(new Map([['all', [{ id: 'a' }, { id: 'b' }]]])).get('all').map((entry) => entry.id), ['b']);
  deactivateMirror();
});

test('a valid empty Mirror is different from a missing Mirror', async () => {
  await commitMirrorCurrent(mirror('empty', [], 3), ['a']);
  await activateMirror(['a']);
  assert.equal(getMirrorSnapshot().enabled, true);
  assert.deepEqual(effectiveProjectionFromMirror(new Map([['all', [{ id: 'a' }]]])).get('all'), []);
  deactivateMirror();
});

function fakeState() {
  const entries = [
    { id: 'entry_a', text: 'alpha', normalizedText: 'alpha', kind: 'word', domainId: 'domain', partsOfSpeech: ['n.'], glossHant: '甲' },
    { id: 'entry_b', text: 'beta', normalizedText: 'beta', kind: 'word', domainId: 'domain', partsOfSpeech: [], glossHant: '乙' },
  ];
  return {
    entries,
    domainById: new Map([['domain', { id: 'domain', name: '測試' }]]),
    collectionById: new Map([['collection', { id: 'collection', name: 'A1', type: 'normal' }]]),
    membershipsByEntry: new Map(entries.map((entry) => [entry.id, [{ entryId: entry.id, collectionId: 'collection' }]])),
  };
}

test('Session Capsule exposes slots, keeps IDs local and maps accepted slots back on-device', async () => {
  const request = await createMatchRequest(fakeState(), { materialLabel: 'unit', matchMode: 'lexical' });
  assert.equal(request.corpus.length, 2);
  assert.equal(Object.hasOwn(request.corpus[0], 'id'), false);
  const result = {
    protocol: SESSION_PROTOCOL,
    kind: MATCH_RESULT_KIND,
    sessionId: request.sessionId,
    sourceCorpusHash: request.sourceCorpusHash,
    matchCorpusHash: request.matchCorpusHash,
    requestSequence: request.requestSequence,
    matchedSlots: [2],
  };
  const accepted = await acceptMatchResult(result);
  assert.deepEqual(accepted.entryIds, ['entry_b']);
  assert.match(accepted.mirrorHash, /^sha256:[a-f0-9]{64}$/);
});

test('Session Capsule fails closed on hash mismatch and unknown slots', async () => {
  const request = await createMatchRequest(fakeState());
  await assert.rejects(() => acceptMatchResult({
    protocol: SESSION_PROTOCOL, kind: MATCH_RESULT_KIND, sessionId: request.sessionId,
    sourceCorpusHash: hash('f'), matchCorpusHash: request.matchCorpusHash,
    requestSequence: 1, matchedSlots: [1],
  }), /hash/);
  await assert.rejects(() => acceptMatchResult({
    protocol: SESSION_PROTOCOL, kind: MATCH_RESULT_KIND, sessionId: request.sessionId,
    sourceCorpusHash: request.sourceCorpusHash, matchCorpusHash: request.matchCorpusHash,
    requestSequence: 1, matchedSlots: [3],
  }), /未知 slot/);
});
