#!/usr/bin/env python3
from __future__ import annotations
import glob,json,re
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
base=json.load(open(ROOT/'data/seed-baselines/seed-9-glosses.json',encoding='utf-8'))
rows={r[0]:r for r in base['entries']}
entries=[]
for p in sorted(glob.glob(str(ROOT/'data/seed5-runtime/entries-*.json'))):
    entries+=json.load(open(p,encoding='utf-8'))
assert len(entries)==len(rows)==23917

# Mainland-invalid / strongly Taiwan-specific technical spellings. Do not flag
# legitimate Mainland terms such as “阵列”.
tech_forbidden=[
    '软体','网路','资讯','资料库','程式','记忆体','硬碟','伺服器','滑鼠','印表机','作业系统',
    '超文字','协定','非同步','可延伸','位元','快取','外挂','物件','布林','字串','萤幕',
    '登入','登出','相容','介面','资料夹','执行绪','伫列','程序码',
]
all_forbidden=['做为','想像']
metadata=re.compile(r'(?:\[(?:法|医|化|计|机|電|电|通信|语|经|贸|数|物|生|农|商|测|地|矿|纺|冶|航|建|军)\]|\b(?:abbr|n|v|vt|vi|adj|adv|prep|pron|conj)\.\s)',re.I)

hard=[]
soft=[]
source_counts=Counter()
domain_counts=Counter()
for e in entries:
    row=rows[e['id']]
    hans,hant,source=row[1],row[2],row[3]
    source_counts[source]+=1
    domain_counts[e['domainId']]+=1
    if not hans or not hant or not source:
        hard.append((e['text'],'empty-field',hans))
        continue
    if e['domainId']=='domain_computer_terms':
        for bad in tech_forbidden:
            if bad in hans:
                hard.append((e['text'],f'tech-forbidden:{bad}',hans))
    for bad in all_forbidden:
        if bad in hans:
            hard.append((e['text'],f'mainland-forbidden:{bad}',hans))
    if metadata.search(hans):
        hard.append((e['text'],'source-metadata',hans))
    if '\\n' in hans or '\n' in hans:
        hard.append((e['text'],'newline',hans))
    if '...' in hans or '……...' in hans:
        soft.append((e['text'],'ellipsis-ascii',hans))
    if re.search(r'[；，,、]{2,}',hans):
        soft.append((e['text'],'duplicate-punctuation',hans))
    if e['domainId']=='domain_general_collocations' and (hans.startswith('的') or hans.endswith('的')):
        soft.append((e['text'],'dangling-collocation',hans))
    if e['domainId']!='domain_computer_terms' and source=='VIX-9-MT' and re.search(r'某人.*神经|某事$|做事|这样做$',hans):
        soft.append((e['text'],'literal-mt-risk',hans))
    if e['domainId']=='domain_general_english' and e['kind']=='word' and re.fullmatch(r'[A-Za-z][A-Za-z0-9 .+/#_-]*',hans):
        soft.append((e['text'],'english-only-general',hans))
    if len(hans)>160:
        soft.append((e['text'],'very-long',hans))

print('AUDIT_COUNTS',json.dumps({'entries':len(entries),'domains':domain_counts,'sources':source_counts,'hard':len(hard),'soft':len(soft)},ensure_ascii=False,default=dict))
for item in hard[:300]: print('HARD',json.dumps(item,ensure_ascii=False))
for item in soft[:500]: print('SOFT',json.dumps(item,ensure_ascii=False))
if hard:
    raise SystemExit(f'hard language audit failures: {len(hard)}')
print('LANGUAGE_AUDIT_HARD_OK')
