import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};

const { requestSpeech, validateGroqSecret } = await import('../js/vix-provider-site.js');
const { getModelCatalog, queryVocabularyEntry, refreshModels, saveModelCatalog, selectModel, suggestEntries } = await import('../js/v3-ai.js');

let calls = [];
let completion = null;

beforeEach(() => {
  values.clear();
  values.set('vix.personal-mirror.connection', JSON.stringify({
    siteOrigin: 'https://mirror.example.test', token: 'vixm_device_secret', revision: 0,
  }));
  calls = [];
  completion = {
    headword: 'earnest', partOfSpeech: 'adjective', memoryCue: 'seriously sincere',
    meaning: '認真而誠懇的', collocations: ['in earnest', 'earnest effort'],
    usageHints: ['常用於表達認真投入的語境'],
    examples: [
      { english: 'The talks began in earnest.', translation: '會談正式認真展開。' },
      { english: 'She made an earnest effort.', translation: '她作出了誠懇的努力。' },
    ],
  };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/api/groq/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile', active: true }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).endsWith('/api/groq/settings/validate')) {
      return new Response(JSON.stringify({ valid: true, models: [{ id: 'llama-3.3-70b-versatile', active: true }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(completion) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
});

test('Groq model catalog travels through Personal Mirror with the protocol token', async () => {
  const catalog = await refreshModels();
  assert.ok(catalog.some((item) => item.id === 'llama-3.3-70b-versatile' && item.available));
  assert.equal(calls[0].url, 'https://mirror.example.test/api/groq/models');
  assert.equal(calls[0].options.headers.authorization, 'Bearer vixm_device_secret');
  assert.equal(calls[0].options.credentials, 'omit');
});

test('candidate Groq key validation uses the paired Site without persisting the candidate locally', async () => {
  const before = values.get('vix.personal-mirror.connection');
  const result = await validateGroqSecret('candidate-key');
  assert.equal(calls[0].url, 'https://mirror.example.test/api/groq/settings/validate');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { apiKey: 'candidate-key' });
  assert.equal(result.valid, true);
  assert.equal(values.get('vix.personal-mirror.connection'), before);
});

test('speech synthesis stays lazy and carries the separate model and voice', async () => {
  assert.equal(calls.length, 0);
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      protocol: 'vix-speech/1', audioContent: 'UklGRgAAAAA=', mimeType: 'audio/wav',
      model: 'canopylabs/orpheus-v1-english', voice: 'diana',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const payload = await requestSpeech('The talks began in earnest.', {
    model: 'canopylabs/orpheus-v1-english', voice: 'diana',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://mirror.example.test/api/groq/speech');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    text: 'The talks began in earnest.', model: 'canopylabs/orpheus-v1-english', voice: 'diana',
  });
  assert.equal(payload.voice, 'diana');
});

test('Personal Mirror provider errors remain typed', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'groq_secret_unreadable', message: 'Groq Key 無法解密' },
  }), { status: 409, headers: { 'content-type': 'application/json' } });
  await assert.rejects(refreshModels(), { code: 'groq_secret_unreadable', status: 409 });
});

test('lookup contract is compact recall with collocations, hints, and varied examples', async () => {
  saveModelCatalog(['llama-3.3-70b-versatile']);
  selectModel('llama-3.3-70b-versatile');
  const result = await queryVocabularyEntry({ subject: { text: 'earnest', kind: 'word', domain: { name: '通用英語' } } });
  assert.equal(result.memoryCue, 'seriously sincere');
  assert.deepEqual(result.collocations, ['in earnest', 'earnest effort']);
  assert.equal(result.examples.length, 2);
  const request = JSON.parse(calls.at(-1).options.body);
  assert.equal(calls.at(-1).url, 'https://mirror.example.test/api/groq/chat');
  assert.match(request.messages[0].content, /compact English recall aid/);
  assert.match(request.messages[0].content, /without long explanations/);
  assert.match(request.messages[0].content, /pronunciation/);
  assert.ok(!JSON.stringify(request.response_format).includes('pronunciation'));
});

test('lookup rejects malformed output and unknown models fail closed', async () => {
  saveModelCatalog(['llama-3.3-70b-versatile']);
  selectModel('llama-3.3-70b-versatile');
  completion = { headword: 'earnest' };
  await assert.rejects(queryVocabularyEntry({ subject: { text: 'earnest', kind: 'word', domain: { name: '通用英語' } } }), { code: 'invalid-response' });
  selectModel('unknown/model');
  assert.equal(getModelCatalog().find((item) => item.id === 'unknown/model')?.available, false);
});

test('generated candidates use Entry partsOfSpeech and never a source label', async () => {
  saveModelCatalog(['llama-3.3-70b-versatile']);
  selectModel('llama-3.3-70b-versatile');
  completion = { entries: [{ text: 'earnest', partsOfSpeech: ['adj.'], gloss: '認真的' }] };
  const entries = await suggestEntries({ domainName: '通用英語', collectionName: '測試', instruction: 'one item' });
  assert.deepEqual(entries, [{ text: 'earnest', partsOfSpeech: ['adj.'], gloss: '認真的' }]);
  const request = JSON.parse(calls.at(-1).options.body);
  assert.ok(request.messages[0].content.includes('partsOfSpeech'));
  assert.ok(!request.messages[0].content.includes('sourceLabel'));
});
