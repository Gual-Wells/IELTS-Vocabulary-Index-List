from pathlib import Path
import json, hashlib, re

root=Path('.')
p=root/'js/v3-ui.js'
ui=p.read_text(encoding='utf-8')

# Scrub every surviving legacy Google-TTS branch. Speech is Groq-or-system only.
ui=ui.replace('Google Cloud TTS API Key','Groq Speech API Key')
ui=ui.replace('await validateTtsSecret(candidateTtsKey, { config });','await validateGroqSpeechApiKey(candidateTtsKey);')
ui=ui.replace("await deleteTtsSecret({ config: { url: url.value, deviceToken: token.value } });","deleteGroqSpeechApiKey();")
ui=ui.replace('await saveTtsSecret(ttsKey.value, { config: nextConfig });','await validateGroqSpeechApiKey(ttsKey.value);\n          saveGroqSpeechApiKey(ttsKey.value);')
ui=ui.replace("field('Groq API Key', groqKey)","field('Groq 查询 API Key', groqKey)")
ui=ui.replace("placeholder: 'Groq API Key'","placeholder: 'Groq Query API Key'")

# Remove all remaining relation-settings presentation and persistence paths.
ui=ui.replace("  const lowLevelRelations = el('input', { type: 'checkbox', className: 'vix-checkbox', checked: state.settings.closeLowLevelRelations !== false });\n",'')
ui=ui.replace("    el('section', { className: 'settings-section' }, [el('h3', { text: '关联' }), el('label', { className: 'inline-field checkbox-field' }, [el('span', { text: '过滤低级组件关联' }), lowLevelRelations])]),\n",'')
ui=ui.replace("    await setLowLevelRelationsClosed(lowLevelRelations.checked);\n",'')
ui=ui.replace("  const relationExcluded = el('input', { type: 'checkbox', checked: Boolean(domain.relationExcluded) });\n",'')
ui=ui.replace("    field('内容模式', el('input', { value: domain.contentMode === 'nonStructured' ? '非结构（内容）' : '结构化（词汇 / 短语）', readOnly: true })),","    field('内容模式', el('input', { value: domain.contentMode === 'nonStructured' ? '非结构（内容）' : '结构化（词汇）', readOnly: true })),")
ui=ui.replace("    el('label', { className: 'inline-field' }, [el('span', { text: '不参与关联' }), relationExcluded]),\n",'')
ui=ui.replace("    el('p', { className: 'help-text', text: '“不参与关联”只在显示与查询上下文中逻辑隐藏关系；底层双向关系仍完整维护，关闭后立即恢复。' }),\n",'')
ui=ui.replace("      if (relationExcluded.checked !== Boolean(domain.relationExcluded)) await setDomainRelationExcluded(domain.id, relationExcluded.checked);\n",'')
# Remove now-unused store imports from the UI module.
for token in ['setLowLevelRelationsClosed, ', 'setDomainRelationExcluded, ', 'getRelationComponents, ', 'getRelatedEntries, ']:
    ui=ui.replace(token,'')

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
for forbidden in (
    'Google Cloud TTS','saveTtsSecret','deleteTtsSecret','validateTtsSecret','requestSpeech(',
    "button('AI 核查'","button('添加短语'","button('撤销', '', async","button('重做', '', async",
    '全局短语','短语总表','domain-phrases:','结构化（词汇 / 短语）','不参与关联',
    "el('h3', { text: '关联' })",'过滤低级组件关联','setLowLevelRelationsClosed(','setDomainRelationExcluded('
):
    assert forbidden not in ui, forbidden
assert "startProviderQuery('Groq', entry, collection)" in ui
assert "iconButton('dictionary', 'entry-relations'" in ui
assert 'toggleAllCollectionSections' in ui
assert "elements['settings-button'].addEventListener('click', openSettingsDialog);" in ui
assert 'Groq 查询 API Key' in ui and 'Groq 语音 API Key' in ui
assert 'requestGroqSpeech' in ui and 'speakWithSystemTts' in ui
assert not (root/'data/relation-low-level-lexemes.json').exists()
for d in [manifest['meta'],*manifest['entries'],*manifest['memberships']]:
    b=(root/d['path']).read_bytes()
    assert len(b)==d['bytes'] and hashlib.sha256(b).hexdigest()==d['sha256']
print('WORD_ONLY_POST_QA_OK', {'openBridgeDialog_defs':ui.count('function openBridgeDialog('), 'speech_defs':ui.count('function createLazySpeechSession(')})
