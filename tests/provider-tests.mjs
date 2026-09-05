import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProviderError, fetchProviderJson, createProviderSession, parseRetryAfter } from '../js/v3-provider-runtime.js';
import { decodeLookup, decodeVerification, decodeBatch, decodeSearch, decodeSuggestions } from '../js/v3-groq-contracts.js';
import { getApiKey, setApiKey, selectModel, getSelectedModel, getModelCatalog, refreshModels,
  queryVocabularyEntry, verifyVocabularyEntry, checkEntries, AiCheckController, saveModelCatalog } from '../js/v3-ai.js';
import { getCollinsApiKey, setCollinsApiKey, getCollinsDictionary, setCollinsDictionary,
  COLLINS_DICTIONARIES, queryCollins, validateSupportedCollinsDictionary } from '../js/v3-collins.js';

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
test('legacy Collins browser credentials are retired while the fixed registry remains compatible', () => {
  storage.set('gualVocabulary.collinsApiKey', 'old-collins');
  assert.equal(getCollinsApiKey(), ''); assert.equal(getApiKey(), 'fixture-key-not-real');
  setCollinsApiKey('must-not-persist');
  assert.equal(storage.has('gualVocabulary.collinsApiKey'), false);
  assert.equal(getCollinsDictionary(), '');
  assert.deepEqual(COLLINS_DICTIONARIES, [
    { code: 'american-learner', name: 'Collins Cobuild Advanced American' },
    { code: 'american', name: "Webster's New World College Dictionary" },
  ]);
  assert.ok(Object.isFrozen(COLLINS_DICTIONARIES) && COLLINS_DICTIONARIES.every(Object.isFrozen));
  setCollinsDictionary('american-learner'); assert.equal(getCollinsDictionary(), 'american-learner');
  assert.equal(validateSupportedCollinsDictionary('american'), 'american');
  assert.throws(() => setCollinsDictionary('english'), { code: 'configuration' });
  assert.throws(() => setCollinsDictionary('../other?key=x'), { code: 'configuration' });
});
test('Collins lookup is exactly one search/first request with transient structured content', async () => {
  setCollinsDictionary('american-learner');
  mock({ entryId: 'thread_1', entryContent: '<div class="sense"><b>thread</b><p>Definition</p></div>' });
  const before = [...storage]; const result = await queryCollins('thread');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, './api/collins/lookup');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Accept, 'application/json');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), { query: 'thread', dictionaryCode: 'american-learner' });
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(Object.hasOwn(calls[0].options.headers, 'accessKey'), false);
  assert.ok(result.entryContent.includes('<b>thread</b>')); assert.deepEqual([...storage], before);
});
test('both fixed Collins dictionaries use their canonical search/first path', async () => {
  mock({ entryId: 'entry-1', entryContent: '<p>entry</p>' });
  for (const dictionaryCode of COLLINS_DICTIONARIES.map((dictionary) => dictionary.code)) {
    await queryCollins('entry', { dictionaryCode });
  }
  assert.ok(calls.every((call) => call.url === './api/collins/lookup'));
  assert.deepEqual(calls.map((call) => JSON.parse(call.options.body).dictionaryCode), ['american-learner', 'american']);
  assert.ok(calls.every((call) => !Object.hasOwn(call.options.headers, 'accessKey')));
});
test('Collins requires a supported explicit dictionary and never guesses or calls the catalog', async () => {
  mock({});
  await assert.rejects(queryCollins('thread'), { code: 'configuration' });
  storage.set('gualVocabulary.collinsDictionaryCode', 'legacy-english');
  await assert.rejects(queryCollins('thread'), { code: 'configuration' });
  assert.equal(calls.length, 0);
});
test('Collins 401/404/429/500/network and malformed payload never retry or fall through', async () => {
  setCollinsDictionary('american');
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
  setCollinsDictionary('american');
  await assert.rejects(queryCollins('thread'), error => {
    assert.equal(error.code, 'network');
    assert.ok(!error.message.includes('secret-url-and-key'));
    return true;
  });
  assert.equal(count, 1);
});

test('same-origin Access 401 is not misreported as a Collins key failure', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'access_required', message: 'Access required' },
  }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  setCollinsDictionary('american');
  await assert.rejects(queryCollins('thread'), error => {
    assert.equal(error.code, 'access-session');
    assert.match(error.message, /Cloudflare Access/);
    assert.doesNotMatch(error.message, /密钥无效/);
    return true;
  });
});

test('Collins bridge failure codes remain specific after the browser receives HTTP 502', async () => {
  const cases = [
    ['upstream_challenge', 'upstream-challenge', /官方防护/],
    ['upstream_network', 'upstream-network', /无法连接 Collins/],
    ['upstream_format', 'upstream-format', /网页而不是 API JSON/],
    ['upstream_redirect', 'upstream-redirect', /非预期重定向/],
    ['upstream_forbidden', 'upstream-forbidden', /拒绝了当前密钥或词典权限/],
    ['upstream_blocked', 'upstream-blocked', /边缘防护拦截/],
  ];
  setCollinsDictionary('american-learner');
  for (const [serverCode, providerCode, message] of cases) {
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { code: serverCode, message: 'sanitized server detail' },
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(queryCollins('emission'), error => {
      assert.equal(error.code, providerCode);
      assert.match(error.message, message);
      return true;
    });
  }
});

test('Collins bridge exposes only bounded safe upstream diagnostics', async () => {
  setCollinsDictionary('american-learner');
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      code: 'upstream_blocked',
      message: 'server detail is not used',
      diagnostics: {
        upstreamStatus: 403,
        contentType: 'text/html',
        challenged: false,
        cfRay: 'safe-ray',
        attempts: 2,
        strategy: 'cloudflare-workers',
        firstFailure: 'html-403',
        secret: 'must-not-surface',
      },
    },
  }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(queryCollins('earnest'), error => {
    assert.equal(error.code, 'upstream-blocked');
    assert.match(error.message, /诊断 403\/HTML\/2次\/cloudflare-workers/);
    assert.doesNotMatch(error.message, /must-not-surface|server detail/);
    assert.deepEqual(error.diagnostics, {
      upstreamStatus: 403, attempts: 2, strategy: 'cloudflare-workers', contentType: 'text/html',
      challenged: false, cfRay: 'safe-ray', firstFailure: 'html-403',
    });
    return true;
  });
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
