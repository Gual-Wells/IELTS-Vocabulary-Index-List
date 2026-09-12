from pathlib import Path
import re, json, hashlib

ROOT=Path('.')

def function_spans(src,name):
    needle=f'function {name}('
    starts=[]; pos=0
    while True:
        s=src.find(needle,pos)
        if s<0: break
        starts.append(s); pos=s+len(needle)
    spans=[]
    for start in starts:
        brace=src.find('{',start)
        i=brace; depth=0; quote=None; esc=False; line_comment=False; block_comment=False
        while i<len(src):
            c=src[i]; n=src[i+1] if i+1<len(src) else ''
            if line_comment:
                if c=='\n': line_comment=False
            elif block_comment:
                if c=='*' and n=='/': block_comment=False; i+=1
            elif quote:
                if esc: esc=False
                elif c=='\\': esc=True
                elif c==quote: quote=None
            else:
                if c=='/' and n=='/': line_comment=True; i+=1
                elif c=='/' and n=='*': block_comment=True; i+=1
                elif c in ('"',"'",'`'): quote=c
                elif c=='{': depth+=1
                elif c=='}':
                    depth-=1
                    if depth==0:
                        spans.append((start,i+1)); break
            i+=1
    return spans

def replace_all_functions(src,name,replacement):
    spans=function_spans(src,name)
    if not spans: raise SystemExit(f'{name}: no function declarations found')
    # Work backwards so original indices stay valid. Keep exactly one declaration,
    # at the last runtime definition site, and delete every earlier duplicate.
    for idx,(start,end) in reversed(list(enumerate(spans))):
        src=src[:start]+(replacement if idx==len(spans)-1 else '')+src[end:]
    return src

new_bridge=r'''function openBridgeDialog({ onConfigured = null } = {}) {
  const saved = getBridgeConfig();
  const url = el('input', { type: 'url', value: saved.url, placeholder: 'https://vix-bridge.example.workers.dev', autocomplete: 'url', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' });
  const token = bindCredentialMask(el('input', { type: 'text', className: 'credential-input', value: saved.deviceToken, placeholder: 'Device Token', name: 'vix-opaque-credential', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' }));
  const queryKey = bindCredentialMask(el('input', { type: 'text', className: 'credential-input', value: '', placeholder: 'Groq Query API Key', name: 'vix-provider-secret', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' }));
  const speechKey = bindCredentialMask(el('input', { type: 'text', className: 'credential-input', value: '', placeholder: 'Groq Speech API Key', name: 'vix-speech-secret', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' }));
  const test = button('测试', 'secondary-button', async () => {
    const oldText = test.textContent; test.disabled = true; test.textContent = '测试中…';
    try {
      let config = { url: url.value, deviceToken: token.value };
      let result = await testBridgeConfig(config, { probeGroq: false });
      config = applyRecoveredBridgeCredential(config, result, token);
      if (queryKey.value.trim()) await validateGroqSecret(queryKey.value.trim(), { config });
      if (speechKey.value.trim()) await validateGroqSpeechApiKey(speechKey.value.trim());
      showToast('配置可用');
    } finally { test.disabled = false; test.textContent = oldText; }
  });
  const removeQueryKey = button('删除查询 Key', 'secondary-button', async () => {
    await deleteGroqSecret({ config: { url: url.value, deviceToken: token.value } });
    queryKey.value=''; syncCredentialMask(queryKey); showToast('查询 Key 已删除');
  });
  const removeSpeechKey = button('删除语音 Key', 'secondary-button', () => {
    deleteGroqSpeechApiKey(); speechKey.value=''; syncCredentialMask(speechKey); showToast('语音 Key 已删除');
  });
  const clear = button('清除配置', 'secondary-button', () => {
    clearBridgeConfig(); deleteGroqSpeechApiKey(); url.value=''; token.value=''; queryKey.value=''; speechKey.value='';
    syncCredentialMask(token); syncCredentialMask(queryKey); syncCredentialMask(speechKey); showToast('配置已清除');
  });
  const functionLink = el('a', { className: 'integration-resource-link', href: './integration/vix-function/VIX-Function.ps1', download: 'VIX-Function.ps1', text: 'VIX Function' });
  const instructionLink = el('a', { className: 'integration-resource-link', href: './integration/vix-function/VIX_PERSONALIZED_INSTRUCTIONS.md', download: 'VIX_PERSONALIZED_INSTRUCTIONS.md', text: '个性化指令' });
  openDialog({ title: 'Bridge', variant: 'management', submitText: '保存', body: [
    field('Bridge URL', url), field('Device Token', token),
    field('Groq 查询 API Key', queryKey, '用于词条查询；由 Bridge 保存。'),
    field('Groq 语音 API Key', speechKey, '用于英语发音；与查询 Key 独立。未配置或调用失败时自动使用 iOS / 浏览器系统 TTS。'),
    el('div', { className: 'settings-row' }, [test, removeQueryKey, removeSpeechKey, clear]),
    el('section', { className: 'bridge-integration-resources' }, [el('h3', { text: '集成资源' }), el('div', { className: 'bridge-download-row' }, [functionLink, instructionLink])]),
  ], onSubmit: async () => {
    let nextConfig = { url: url.value, deviceToken: token.value };
    const probe = await testBridgeConfig(nextConfig, { probeGroq: false });
    nextConfig = applyRecoveredBridgeCredential(nextConfig, probe, token); setBridgeConfig(nextConfig);
    if (queryKey.value.trim()) { await saveGroqSecret(queryKey.value.trim(), { config: nextConfig }); queryKey.value=''; syncCredentialMask(queryKey); }
    if (speechKey.value.trim()) { await validateGroqSpeechApiKey(speechKey.value.trim()); saveGroqSpeechApiKey(speechKey.value.trim()); speechKey.value=''; syncCredentialMask(speechKey); }
    onConfigured?.(); showToast('Bridge 已保存');
  }});
}'''

new_speech=r'''function createLazySpeechSession() {
  const controller = new AbortController();
  const buffers = new Map();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let context = null; let source = null; let activeControl = null;
  const resetControl = () => { if (!activeControl) return; activeControl.disabled=false; delete activeControl.dataset.state; activeControl=null; };
  const stop = () => { try { source?.stop(); } catch {} source=null; if ('speechSynthesis' in window) speechSynthesis.cancel(); resetControl(); };
  const speak = async (text, control) => {
    stop(); activeControl=control; control.disabled=true; control.dataset.state='loading';
    try {
      let buffer=buffers.get(text);
      if (!buffer) {
        try {
          const audio=await requestGroqSpeech(text,{signal:controller.signal});
          if (!AudioContextClass) throw new Error('当前浏览器不能解码语音');
          context ||= new AudioContextClass(); await context.resume();
          buffer=await context.decodeAudioData(audio.slice(0)); buffers.set(text,buffer);
        } catch (error) {
          if (controller.signal.aborted) throw error;
          control.dataset.state='native'; await speakWithSystemTts(text,{signal:controller.signal}); resetControl(); return;
        }
      }
      if (controller.signal.aborted || activeControl !== control) return;
      context ||= new AudioContextClass(); await context.resume();
      source=context.createBufferSource(); source.buffer=buffer; source.connect(context.destination);
      source.onended=()=>{source=null;resetControl();}; control.dataset.state='playing'; source.start();
    } catch (error) { resetControl(); if (error?.name!=='AbortError' && error?.code!=='cancelled') displayError(error); }
  };
  return { speak, stop, dispose: () => { controller.abort(); stop(); buffers.clear(); context?.close().catch(()=>undefined); context=null; } };
}'''

p=ROOT/'js/v3-ui.js'; ui=p.read_text(encoding='utf-8')
ui=replace_all_functions(ui,'openBridgeDialog',new_bridge)
ui=replace_all_functions(ui,'createLazySpeechSession',new_speech)

# Remove phrase-only search scopes and routing. Search is word/content only now.
for exact in [
    "  scope.append(el('option', { value: 'global:phrases', text: '全局短语' }));\n",
    "      group.append(el('option', { value: `domain-phrases:${domain.id}`, text: '短语总表' }));\n",
    "  else if (current.id === SYSTEM_GLOBAL_PHRASES_ID) scope.value = 'global:phrases';\n",
    "  else if (current.type === 'system-phrases') scope.value = `domain-phrases:${current.domainId}`;\n",
    "    else if (value === 'global:phrases') allowedIds = new Set(getVisibleEntries(SYSTEM_GLOBAL_PHRASES_ID).map((entry)=>entry.id));\n",
    "    else if (value.startsWith('domain-phrases:')) allowedIds = new Set(getVisibleEntries(systemPhraseCollectionId(value.slice(15))).map((entry)=>entry.id));\n",
]: ui=ui.replace(exact,'')
ui=ui.replace('systemPhraseCollectionId, ','').replace('SYSTEM_GLOBAL_PHRASES_ID, ','')

# Direct query paths: stale popover calls are inert and route to their replacements.
ui=ui.replace("function openQueryMenu(entry, collection, anchor) {", "function openQueryMenu(entry, collection, anchor) {\n  return startProviderQuery('Groq', entry, collection).catch(displayError);")
ui=ui.replace("function openRelationTargetMenu(entry, collection, anchor) {", "function openRelationTargetMenu(entry, collection, anchor) {\n  return openOxfordLookup(entry);")

p.write_text(ui,encoding='utf-8')

ip=ROOT/'index.html'; html=ip.read_text(encoding='utf-8')
html=html.replace('英语词汇、短语与非结构内容索引','英语词汇索引').replace('切换词汇或短语视图','全部展开或收起')
ip.write_text(html,encoding='utf-8')

# Strong final QA over generated runtime and active product surface.
manifest=json.loads((ROOT/'data/seed5-runtime/manifest.json').read_text(encoding='utf-8'))
assert manifest['seedRevision']==11
assert manifest['counts']=={'entries':15644,'memberships':49060,'relationComponents':0},manifest['counts']
entries=[]
for d in manifest['entries']: entries += json.loads((ROOT/d['path']).read_text(encoding='utf-8'))
assert len(entries)==15644 and all(e.get('kind')!='phrase' for e in entries)
meta=json.loads((ROOT/'data/seed5-runtime/meta.json').read_text(encoding='utf-8'))
assert meta.get('annotations')==[]
assert not any(c.get('type') in ('system-phrases','system-global-phrases') or str(c.get('id','')).endswith('__phrases') for c in meta.get('collections',[]))
ui=p.read_text(encoding='utf-8')
for forbidden in ('Google Cloud TTS','saveTtsSecret','deleteTtsSecret','validateTtsSecret','requestSpeech(',"button('AI 核查'","button('添加短语'","button('撤销', '', async","button('重做', '', async",'全局短语','短语总表','domain-phrases:'):
    assert forbidden not in ui,forbidden
assert ui.count('function openBridgeDialog(')==1
assert ui.count('function createLazySpeechSession(')==1
assert "startProviderQuery('Groq', entry, collection)" in ui
assert "iconButton('dictionary', 'entry-relations'" in ui
assert 'toggleAllCollectionSections' in ui
assert "elements['settings-button'].addEventListener('click', openSettingsDialog);" in ui
assert 'Groq 查询 API Key' in ui and 'Groq 语音 API Key' in ui
assert 'requestGroqSpeech' in ui and 'speakWithSystemTts' in ui
assert '结构化（词汇 / 短语）' not in ui and '不参与关联' not in ui
assert not (ROOT/'data/relation-low-level-lexemes.json').exists()
for d in [manifest['meta'],*manifest['entries'],*manifest['memberships']]:
    b=(ROOT/d['path']).read_bytes(); assert len(b)==d['bytes']; assert hashlib.sha256(b).hexdigest()==d['sha256']
print('WORD_ONLY_FINAL_QA_OK')
