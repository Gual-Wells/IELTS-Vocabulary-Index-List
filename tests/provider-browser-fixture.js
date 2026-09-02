/* Local browser QA only. Inject before app startup; never include in app/SW.
 * Replaces Storage with a transient map, never reads existing credentials.
 * All Provider requests stay local. mode: ready | delay | invalid | empty | blocked | network.
 */
(() => {
  if (!['localhost', '127.0.0.1', '::1'].includes(location.hostname)) throw new Error('Local QA only');
  // Keep this fixture out of the app-shell cache. Use a fresh local origin.
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
    controller: null, addEventListener() {},
    register: async () => ({ waiting: null, addEventListener() {}, update: async () => {} }),
  } });
  const values = new Map([
    ['gualVocabulary.groqApiKey', 'fixture-not-a-real-key'],
    ['gualVocabulary.groqModel', 'openai/gpt-oss-20b'],
    ['gualVocabulary.collinsApiKey', 'fixture-not-a-real-key'],
    ['gualVocabulary.collinsDictionaryCode', 'american-learner'],
  ]);
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } });
  const originalFetch = window.fetch.bind(window);
  const fixture = window.__vixProviderFixture = { mode: 'ready', calls: [], releases: [] };
  window.fetch = async (url, options = {}) => {
    const target = new URL(String(url), location.href);
    const groq = target.hostname === 'api.groq.com';
    const collins = target.hostname === 'api.collinsdictionary.com';
    if (!groq && !collins) return originalFetch(url, options);
    const body = options.body ? JSON.parse(options.body) : null;
    fixture.calls.push({ provider: groq ? 'Groq' : 'Collins', path: target.pathname, body });
    // Intentionally ignores abort, so close/mode-switch tests exercise stale-result guards.
    if (fixture.mode === 'delay') await new Promise((resolve) => fixture.releases.push(resolve));
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (fixture.mode === 'network') throw new TypeError('Fixture network failure');
    if (fixture.mode === 'blocked') return new Response('<html>Fixture access challenge</html>', {
      status: 403, headers: { 'Content-Type': 'text/html', 'cf-mitigated': 'challenge' },
    });
    if (target.pathname.endsWith('/models')) return json({ data: [
      { id: 'openai/gpt-oss-20b', active: true }, { id: 'llama-3.3-70b-versatile', active: true },
      { id: 'whisper-large-v3', active: true }, { id: 'future-unknown-model', active: true },
    ] });
    if (fixture.mode === 'empty') return json({}, 404);
    if (fixture.mode === 'invalid') return json(groq ? { choices: [{ finish_reason: 'stop', message: { content: '{"headword":{}}' } }] } : { entryContent: null });
    if (collins) return json({ entryId: 'fixture-1', entryContent: `<div class="entry"><h2 class="orth">abandon</h2><span class="pron">/əˈbændən/</span> <span class="pos">verb</span><ol><li class="sense"><p class="def">to leave a person or place permanently</p><p class="example">They abandoned the old building.</p></li><li class="sense"><p class="def">to stop doing something before it is finished</p><p class="example">They had to abandon their plans.</p></li></ol><p class="copyright">© Collins fixture — test content only</p><img src="https://invalid.example/leak" onerror="window.__fixtureXss=true"><script>window.__fixtureXss=true</script><a href="javascript:window.__fixtureXss=true" onclick="window.__fixtureXss=true">inert reference</a></div>` });
    const name = body.response_format?.json_schema?.name;
    const verifying = name === 'verification' || body.messages?.[0]?.content.includes('verdict');
    const result = verifying
      ? { verdict: 'issue', explanation: '当前释义需要补充语境；这是独立核查测试，不会改写词条。', suggestedText: '', suggestedGloss: '放弃；遗弃' }
      : { headword: 'abandon', pronunciation: '/əˈbændən/', partOfSpeech: 'verb', meaning: '放弃；遗弃。停止继续某项计划，或离开需要照顾的人与事物。', examples: [
        { english: 'They abandoned the plan after the storm.', translation: '暴风雨之后，他们放弃了计划。' },
        { english: 'Do not abandon hope.', translation: '不要放弃希望。' },
      ], usageNote: '常见搭配：abandon a plan / abandon hope。注意具体语境中的语气差异。' };
    return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
  };
})();
