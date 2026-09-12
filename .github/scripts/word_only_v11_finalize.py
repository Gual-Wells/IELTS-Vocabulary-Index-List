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

def keep_function_matching(src,name,needle):
    spans=function_spans(src,name)
    if not spans: raise SystemExit(f'{name}: no function declarations found')
    chosen=None
    for span in spans:
        if needle in src[span[0]:span[1]]:
            chosen=span; break
    if not chosen: raise SystemExit(f'{name}: desired implementation not found')
    # Remove every duplicate declaration except the chosen implementation.
    for start,end in reversed(spans):
        if (start,end)==chosen: continue
        src=src[:start]+src[end:]
    return src

p=ROOT/'js/v3-ui.js'; ui=p.read_text(encoding='utf-8')
ui=keep_function_matching(ui,'openBridgeDialog','Groq 查询 API Key')
ui=keep_function_matching(ui,'createLazySpeechSession','requestGroqSpeech')

# Remove phrase-only search scopes and routing. Search is word/content only now.
for exact in [
    "  scope.append(el('option', { value: 'global:phrases', text: '全局短语' }));\n",
    "      group.append(el('option', { value: `domain-phrases:${domain.id}`, text: '短语总表' }));\n",
    "  else if (current.id === SYSTEM_GLOBAL_PHRASES_ID) scope.value = 'global:phrases';\n",
    "  else if (current.type === 'system-phrases') scope.value = `domain-phrases:${current.domainId}`;\n",
    "    else if (value === 'global:phrases') allowedIds = new Set(getVisibleEntries(SYSTEM_GLOBAL_PHRASES_ID).map((entry)=>entry.id));\n",
    "    else if (value.startsWith('domain-phrases:')) allowedIds = new Set(getVisibleEntries(systemPhraseCollectionId(value.slice(15))).map((entry)=>entry.id));\n",
]:
    ui=ui.replace(exact,'')

# Remove unused phrase collection identifiers from the v3-model import after reachable phrase UI is gone.
ui=ui.replace('systemPhraseCollectionId, ','').replace('SYSTEM_GLOBAL_PHRASES_ID, ','')

# Phrase navigation is retired even if stale history/imported state contains it.
ui=ui.replace("entry.kind === 'phrase' ? 'phrase' :", "")

# Relation target/query popovers are no longer user-facing. Direct Oxford/Groq buttons are the only query path.
# Keep old helper bodies temporarily for schema compatibility, but force them inert if reached by stale state.
ui=ui.replace("function openQueryMenu(entry, collection, anchor) {", "function openQueryMenu(entry, collection, anchor) {\n  return startProviderQuery('Groq', entry, collection).catch(displayError);")
ui=ui.replace("function openRelationTargetMenu(entry, collection, anchor) {", "function openRelationTargetMenu(entry, collection, anchor) {\n  return openOxfordLookup(entry);")

p.write_text(ui,encoding='utf-8')

# Product HTML: remove explicit phrase wording and retired task/relation popover containers only after JS no longer relies on them at startup.
ip=ROOT/'index.html'; html=ip.read_text(encoding='utf-8')
html=html.replace('英语词汇、短语与非结构内容索引','英语词汇索引')
html=html.replace('切换词汇或短语视图','全部展开或收起')
ip.write_text(html,encoding='utf-8')

# Strong final QA over the generated runtime and reachable product surface.
manifest=json.loads((ROOT/'data/seed5-runtime/manifest.json').read_text(encoding='utf-8'))
assert manifest['seedRevision']==11
assert manifest['counts']=={'entries':15644,'memberships':49060,'relationComponents':0}, manifest['counts']
entries=[]
for d in manifest['entries']:
    entries += json.loads((ROOT/d['path']).read_text(encoding='utf-8'))
assert len(entries)==15644 and all(e.get('kind')!='phrase' for e in entries)
meta=json.loads((ROOT/'data/seed5-runtime/meta.json').read_text(encoding='utf-8'))
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
assert not (ROOT/'data/relation-low-level-lexemes.json').exists()

for d in [manifest['meta'],*manifest['entries'],*manifest['memberships']]:
    b=(ROOT/d['path']).read_bytes()
    assert len(b)==d['bytes']
    assert hashlib.sha256(b).hexdigest()==d['sha256']
print('WORD_ONLY_FINAL_QA_OK')
