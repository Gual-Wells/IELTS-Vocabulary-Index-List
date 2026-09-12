from pathlib import Path
import json, hashlib, re

root=Path('.')
p=root/'js/v3-ui.js'
ui=p.read_text(encoding='utf-8')

# The historical UI file contains a second legacy Bridge settings block that
# predates the active declaration. Make any surviving block conform to the new
# split query/speech contract as well, so no Google-TTS compatibility path remains.
ui=ui.replace('Google Cloud TTS API Key','Groq Speech API Key')
ui=ui.replace('await validateTtsSecret(candidateTtsKey, { config });','await validateGroqSpeechApiKey(candidateTtsKey);')
ui=ui.replace("await deleteTtsSecret({ config: { url: url.value, deviceToken: token.value } });","deleteGroqSpeechApiKey();")
ui=ui.replace('await saveTtsSecret(ttsKey.value, { config: nextConfig });','await validateGroqSpeechApiKey(ttsKey.value);\n          saveGroqSpeechApiKey(ttsKey.value);')

# Any historical Bridge labels are genericized. The entry-row buttons themselves
# remain icon-only; provider names are not rendered there or in the result header.
ui=ui.replace("field('Groq API Key', groqKey)","field('Groq 查询 API Key', groqKey)")
ui=ui.replace("placeholder: 'Groq API Key'","placeholder: 'Groq Query API Key'")

p.write_text(ui,encoding='utf-8')

manifest=json.loads((root/'data/seed5-runtime/manifest.json').read_text(encoding='utf-8'))
assert manifest['seedRevision']==11
assert manifest['counts']=={'entries':15644,'memberships':49060,'relationComponents':0},manifest['counts']
entries=[]
for d in manifest['entries']:
    entries += json.loads((root/d['path']).read_text(encoding='utf-8'))
assert len(entries)==15644 and all(e.get('kind')!='phrase' for e in entries)
meta=json.loads((root/'data/seed5-runtime/meta.json').read_text(encoding='utf-8'))
assert meta.get('annotations')==[]
assert not any(c.get('type') in ('system-phrases','system-global-phrases') or str(c.get('id','')).endswith('__phrases') for c in meta.get('collections',[]))

ui=p.read_text(encoding='utf-8')
for forbidden in ('Google Cloud TTS','saveTtsSecret','deleteTtsSecret','validateTtsSecret','requestSpeech(',"button('AI 核查'","button('添加短语'","button('撤销', '', async","button('重做', '', async",'全局短语','短语总表','domain-phrases:'):
    assert forbidden not in ui, forbidden
assert "startProviderQuery('Groq', entry, collection)" in ui
assert "iconButton('dictionary', 'entry-relations'" in ui
assert 'toggleAllCollectionSections' in ui
assert "elements['settings-button'].addEventListener('click', openSettingsDialog);" in ui
assert 'Groq 查询 API Key' in ui and 'Groq 语音 API Key' in ui
assert 'requestGroqSpeech' in ui and 'speakWithSystemTts' in ui
assert '结构化（词汇 / 短语）' not in ui and '不参与关联' not in ui
assert not (root/'data/relation-low-level-lexemes.json').exists()
for d in [manifest['meta'],*manifest['entries'],*manifest['memberships']]:
    b=(root/d['path']).read_bytes()
    assert len(b)==d['bytes'] and hashlib.sha256(b).hexdigest()==d['sha256']
print('WORD_ONLY_POST_QA_OK', {'openBridgeDialog_defs':ui.count('function openBridgeDialog('), 'speech_defs':ui.count('function createLazySpeechSession(')})
