import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProviderError, fetchProviderJson, createProviderSession, parseRetryAfter } from '../js/v3-provider-runtime.js';
import { decodeLookup, decodeVerification, decodeBatch, decodeSearch, decodeSuggestions } from '../js/v3-groq-contracts.js';
import { getApiKey, setApiKey, selectModel, getSelectedModel, getModelCatalog, refreshModels,
  queryVocabularyEntry, verifyVocabularyEntry, checkEntries, AiCheckController, saveModelCatalog } from '../js/v3-ai.js';
import { getCollinsApiKey, setCollinsApiKey, getCollinsDictionary, setCollinsDictionary,
  queryCollins, refreshCollinsDictionaries } from '../js/v3-collins.js';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: (k) => storage.delete(k) };
let calls;
const lookup = { headword: 'thread', pronunciation: '/θred/', partOfSpeech: 'noun', meaning: '線；線程',
  examples: [{ english: 'A worker thread handles the task.', translation: '工作線程處理任務。' }], usageNote: '' };
const verification = { verdict: 'ok', explanation: '未見明確錯誤。', suggestedText: '', suggestedGloss: '' };
const context = { subject: { text: 'thread', kind: 'word', glossHant: 'SECRET-EXISTING-GLOSS', domain: { name: '计算机术语' } } };
const completion = (data, extra = {}) => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(data) }, ...extra }] });
function respond(payload, status = 200, headers = {}) { return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...headers } }); }
function mock(payload, status = 200) {
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return respond(payload, status); };
}
beforeEach(() => { storage.clear(); calls = []; setApiKey('fixture-key-not-real'); selectModel('llama-3.3-70b-versatile'); });
after(() => { globalThis.fetch = originalFetch; if (originalStorage) globalThis.localStorage = originalStorage; else delete globalThis.localStorage; });

test('lookup is independent of existing gloss; JSON mode, typed result and no writes', async () => {
  mock(completion(lookup)); const before = [...storage];
  assert.deepEqual(await queryVocabularyEntry(context), lookup);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.response_format.type, 'json_object');
  assert.ok(!calls[0].options.body.includes('SECRET-EXISTING-GLOSS'));
  assert.deepEqual([...storage], before);
});
test('verification has an independent prompt/schema and no mutation', async () => {
  selectModel('openai/gpt-oss-20b'); mock(completion(verification)); const before = [...storage];
  assert.deepEqual(await verifyVocabularyEntry(context), verification);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.name, 'vix_verification');
  assert.ok(calls[0].options.body.includes('SECRET-EXISTING-GLOSS'));
  assert.deepEqual([...storage], before);
});
test('verification omits blank optional metadata instead of asking the model to fill it', async () => {
  mock(completion(verification));
  await verifyVocabularyEntry({ subject: { text: 'abandon', kind: 'word', glossHant: '  ', partsOfSpeech: ['', '  '] } });
  const body = JSON.parse(calls[0].options.body);
  const input = JSON.parse(body.messages.at(-1).content);
  assert.equal(input.text, 'abandon');
  assert.equal(Object.hasOwn(input, 'gloss'), false);
  assert.equal(Object.hasOwn(input, 'partsOfSpeech'), false);
  assert.match(body.messages[0].content, /NEVER errors/);
  assert.match(body.messages[0].content, /review the text alone/i);
});

test('verification retains supplied POS and gloss without changing the entry', async () => {
  mock(completion(verification));
  const subject = { text: 'abandon', kind: 'word', glossHant: 'leave', partsOfSpeech: ['verb', '', '  '] };
  const before = structuredClone(subject);
  await verifyVocabularyEntry({ subject });
  const input = JSON.parse(JSON.parse(calls[0].options.body).messages.at(-1).content);
  assert.equal(input.gloss, 'leave');
  assert.deepEqual(input.partsOfSpeech, ['verb']);
  assert.deepEqual(subject, before);
});

test('all ready fields reject null, objects, blank required text and oversized content', () => {
  for (const value of [null, {}, [], 42, false, '']) assert.throws(() => decodeLookup({ ...lookup, meaning: value }), ProviderError);
  assert.throws(() => decodeLookup({ ...lookup, usageNote: null }));
  assert.throws(() => decodeLookup({ ...lookup, examples: [{ english: {}, translation: '' }] }));
  assert.throws(() => decodeLookup({ ...lookup, meaning: 'x'.repeat(2001) }));
  assert.throws(() => decodeVerification({ ...verification, verdict: 'maybe' }));
  assert.throws(() => decodeVerification({ ...verification, suggestedText: 'change' }));
  assert.throws(() => decodeSearch({ terms: [null] }));
  assert.throws(() => decodeSuggestions({ entries: [{ text: {}, sourceLabel: '', gloss: '' }] }));
});
test('transport success is not ready: malformed JSON, missing/empty completion, truncation, refusal', async () => {
  for (const payload of [{}, completion({}), completion(lookup, { finish_reason: 'length' }),
    completion(lookup, { message: { refusal: 'no' } }), completion(lookup, { message: { content: 'prefix {"a":1}' } })]) {
    mock(payload); await assert.rejects(queryVocabularyEntry(context), ProviderError);
  }
  assert.equal(calls.length, 5, 'no blind format fallback requests');
});
test('unknown, guard and speech models fail before any network call', async () => {
  mock(completion(lookup));
  for (const id of ['whisper-large-v3', 'openai/gpt-oss-safeguard-20b', 'groq/compound', 'unknown-model']) {
    selectModel(id); await assert.rejects(queryVocabularyEntry(context), { code: 'configuration' });
  }
  assert.equal(calls.length, 0);
});
test('model catalog is tolerant of legacy storage, never equates active with compatible', async () => {
  storage.set('gualVocabulary.groqModelCatalog', '{bad');
  mock({ data: [{ id: 'whisper-large-v3' }, { id: 'llama-3.3-70b-versatile' }, { id: 'unknown-active' }, { id: 'openai/gpt-oss-20b', active: false }] });
  const rows = await refreshModels();
  assert.equal(rows.find((r) => r.id === 'whisper-large-v3').available, false);
  assert.equal(rows.find((r) => r.id === 'unknown-active').available, false);
  assert.equal(rows.find((r) => r.id === 'llama-3.3-70b-versatile').available, true);
  assert.equal(rows.find((r) => r.id === 'openai/gpt-oss-20b').available, false);
  assert.equal(getSelectedModel(), 'llama-3.3-70b-versatile');
  setApiKey('changed-fixture-key');
  assert.equal(storage.has('gualVocabulary.groqModelActiveCatalog'), false);
});
test('draft model refresh does not persist credentials/catalog; unavailable model blocks request', async () => {
  mock({ data: [{ id: 'openai/gpt-oss-20b' }] }); const before = [...storage];
  await refreshModels({ apiKey: 'draft-only', persist: false });
  assert.deepEqual([...storage], before);
  saveModelCatalog(['openai/gpt-oss-20b']);
  await assert.rejects(queryVocabularyEntry(context), { code: 'configuration' });
  assert.equal(calls.length, 1);
});
test('legacy credential keys and explicit dictionary selection remain compatible', () => {
  storage.set('gualVocabulary.collinsApiKey', 'old-collins');
  assert.equal(getCollinsApiKey(), 'old-collins'); assert.equal(getApiKey(), 'fixture-key-not-real');
  assert.equal(getCollinsDictionary(), '');
  setCollinsDictionary('english'); assert.equal(getCollinsDictionary(), 'english');
  assert.throws(() => setCollinsDictionary('../other?key=x'));
});
test('Collins lookup is exactly one search/first request with transient structured content', async () => {
  setCollinsApiKey('collins-fixture'); setCollinsDictionary('english');
  mock({ entryId: 'thread_1', entryContent: '<div class="sense"><b>thread</b><p>Definition</p></div>' });
  const before = [...storage]; const result = await queryCollins('thread');
  assert.equal(calls.length, 1); const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/dictionaries/english/search/first');
  assert.equal(url.searchParams.get('format'), 'html');
  assert.equal(calls[0].options.cache, 'no-store'); assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(result.entryContent.includes('<b>thread</b>')); assert.deepEqual([...storage], before);
});
test('Collins requires configuration, never guesses a dictionary', async () => {
  setCollinsApiKey('fixture'); mock({});
  await assert.rejects(queryCollins('thread'), { code: 'configuration' });
  assert.equal(calls.length, 0);
});
test('Collins catalog is an explicit one-call settings action, zero catalog persistence', async () => {
  mock({ dictionaries: [{ dictionaryCode: 'english', dictionaryName: 'English' }] });
  const before = [...storage];
  assert.deepEqual(await refreshCollinsDictionaries({ apiKey: 'fixture' }), [{ code: 'english', name: 'English' }]);
  assert.equal(calls.length, 1); assert.equal(new URL(calls[0].url).pathname, '/api/v1/dictionaries');
  assert.deepEqual([...storage], before);
});
test('Collins 401/404/429/500/network and malformed payload never retry or fall through', async () => {
  setCollinsApiKey('fixture'); setCollinsDictionary('english');
  for (const [status, code] of [[401, 'authorization'], [404, 'not-found'], [429, 'rate-limit'], [500, 'unavailable']]) {
    mock({}, status); await assert.rejects(queryCollins('thread'), { code });
  }
  for (const payload of [{}, { entryId: 'a', entryContent: null }, { entryId: {}, entryContent: '<p>a</p>' }]) {
    mock(payload); await assert.rejects(queryCollins('thread'), { code: 'invalid-response' });
  }
  assert.equal(calls.length, 7);
});
test('access pages are distinct from JSON authorization errors and never retried or exposed', async () => {
  for (const [status, type, challenge, code] of [
    [403, 'text/html', true, 'access-challenge'],
    [403, 'text/html; charset=utf-8', false, 'access-blocked'],
    [403, 'application/json', false, 'authorization'],
    [200, 'text/html', false, 'invalid-response'],
  ]) {
    let count = 0;
    globalThis.fetch = async () => {
      count++;
      return new Response('PRIVATE-RESPONSE-DO-NOT-EXPOSE', { status,
        headers: { 'Content-Type': type, ...(challenge ? { 'cf-mitigated': 'challenge' } : {}) } });
    };
    await assert.rejects(fetchProviderJson('https://fixture.test', {}, { provider: 'Collins', retries: 2 }), error => {
      assert.equal(error.code, code);
      assert.ok(!error.message.includes('PRIVATE-RESPONSE'));
      return true;
    });
    assert.equal(count, 1);
  }
});

test('Collins unreadable network errors remain unknown, not an authorization verdict', async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; throw new TypeError('secret-url-and-key'); };
  await assert.rejects(refreshCollinsDictionaries({ apiKey: 'fixture' }), error => {
    assert.equal(error.code, 'network');
    assert.ok(!error.message.includes('secret-url-and-key'));
    return true;
  });
  assert.equal(count, 1);
});

test('transport retries only transient failures and respects bounded Retry-After', async () => {
  let n = 0;
  globalThis.fetch = async () => ++n < 3 ? respond({}, 503) : respond({ ok: true });
  assert.deepEqual(await fetchProviderJson('https://fixture.test', {}, { retries: 2, retryBaseMs: 1 }), { ok: true });
  assert.equal(n, 3);
  n = 0; globalThis.fetch = async () => { n++; return respond({}, 429, { 'Retry-After': '3600' }); };
  await assert.rejects(fetchProviderJson('https://fixture.test', {}, { retries: 2 }), { code: 'rate-limit' });
  assert.equal(n, 1);
  assert.equal(parseRetryAfter('2'), 2000);
});
test('timeout includes response body; late JSON cannot reach ready', async () => {
  globalThis.fetch = async () => ({ ok: true, headers: new Headers(), json: () => new Promise(() => {}) });
  await assert.rejects(fetchProviderJson('https://fixture.test', {}, { timeoutMs: 8 }), { code: 'timeout' });
});
test('cancel during body read and retry delay rejects promptly without another request', async () => {
  let n = 0; const controller = new AbortController();
  globalThis.fetch = async () => { n++; return { ok: true, headers: new Headers(), json: () => new Promise(() => {}) }; };
  const request = fetchProviderJson('https://fixture.test', {}, { signal: controller.signal });
  setTimeout(() => controller.abort(), 3);
  await assert.rejects(request, { code: 'cancelled' }); assert.equal(n, 1);
  const retryController = new AbortController();
  globalThis.fetch = async () => { n++; return respond({}, 503); };
  const retryRequest = fetchProviderJson('https://fixture.test', {}, { retries: 2, retryBaseMs: 50, signal: retryController.signal });
  setTimeout(() => retryController.abort(), 5);
  await assert.rejects(retryRequest, { code: 'cancelled' }); assert.equal(n, 2);
});
test('session disposal and cancellation prevent stale commits even if executor ignores abort', async () => {
  const states = []; const session = createProviderSession((s) => states.push(s));
  let finish; const pending = session.run(() => new Promise((resolve) => { finish = resolve; }));
  session.dispose(); finish(lookup);
  await assert.rejects(pending, { code: 'cancelled' }); assert.deepEqual(states, ['requesting']);
  const cancelled = createProviderSession((s) => states.push(s));
  const pending2 = cancelled.run(() => new Promise((resolve) => { finish = resolve; }));
  cancelled.cancel(); finish(lookup); await assert.rejects(pending2, { code: 'cancelled' });
  assert.equal(states.at(-1), 'cancelled'); assert.ok(!states.includes('ready'));
});
test('session maps validated success, empty and error distinctly', async () => {
  const session = createProviderSession(); await session.run(async () => lookup); assert.equal(session.state, 'ready');
  for (const [code, state] of [['not-found','empty'],['invalid-response','error']]) {
    const s = createProviderSession(); await assert.rejects(s.run(async () => { throw new ProviderError(code, 'fixture'); }));
    assert.equal(s.state, state);
  }
});
test('batch validation is bound to exact IDs, preserves content semantics, never writes bad output', async () => {
  const batch = [{ id: 'entry-a', text: 'the more ...', kind: 'content' }];
  for (const issue of [{ entryId: 'other', suggestion: '', posSuggestion: '', reason: 'bad' },
    { entryId: 'entry-a', suggestion: '', posSuggestion: 'n.', reason: '' }]) {
    assert.throws(() => decodeBatch({ issues: [issue] }, batch));
  }
  mock(completion({ issues: [{ entryId: 'other', suggestion: 'bad', posSuggestion: '', reason: '' }] }));
  let written = false;
  await assert.rejects(checkEntries(batch, { onBatch: async () => { written = true; } })); assert.equal(written, false);
  const controller = new AiCheckController(); controller.cancel();
  const result = await checkEntries(batch, { controller }); assert.equal(result.cancelled, true);
});
test('Provider wiring preserves existing core and lifecycle hooks', () => {
  const ui = fs.readFileSync(new URL('../js/v3-ui.js', import.meta.url), 'utf8');
  const views = fs.readFileSync(new URL('../js/v3-provider-views.js', import.meta.url), 'utf8');
  assert.ok(ui.includes('dialogStack.includes(activeProviderQuery.frame)'));
  assert.ok(ui.includes('frame.onDispose?.()')); assert.ok(ui.includes('queryFrame.onDispose'));
  assert.ok(ui.includes('settingsController.abort()')); assert.ok(ui.includes('renderGroqVerification'));
  assert.ok(views.includes("document.createElement('template')"));
  assert.ok(!views.includes('setAttribute('));
  const integrations = fs.readFileSync(new URL('../js/v3-integrations.js', import.meta.url), 'utf8');
  assert.ok(!integrations.includes('dictionaryScore')); assert.ok(!integrations.includes('htmlToText'));
});
