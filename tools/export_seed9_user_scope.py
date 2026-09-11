#!/usr/bin/env python3
from __future__ import annotations
import glob,json,subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'data'/'seed5-runtime'
BASE=ROOT/'data'/'seed-baselines'/'seed-9-glosses.json'
OUT=ROOT/'data'/'seed-review-user-scope'
ORIGINAL_511='aac041c4d3a4d5a3910a2bf492e509090f7a7a21'
CHUNK=100


def git_json(commit:str,path:str):
    raw=subprocess.check_output(['git','show',f'{commit}:{path}'])
    return json.loads(raw.decode('utf-8'))

entries=[]
for p in sorted(glob.glob(str(RUNTIME/'entries-*.json'))):
    entries.extend(json.load(open(p,encoding='utf-8')))
assert len(entries)==23917
current_by_id={e['id']:e for e in entries}
base=json.load(BASE.open(encoding='utf-8'))
rows={r[0]:r for r in base['entries']}
assert len(rows)==23917

old=[]
for name in ('entries-000.json','entries-001.json'):
    old.extend(git_json(ORIGINAL_511,f'data/seed5-runtime/{name}'))
assert len(old)==23917

blank_targets=[]
for e in old:
    if e.get('domainId') not in {'domain_general_english','domain_computer_terms'}:
        continue
    if str(e.get('gloss') or '').strip():
        continue
    r=rows[e['id']]
    blank_targets.append({
        'scope':'original-5.1.1-blank',
        'id':e['id'],
        'domainId':e['domainId'],
        'kind':e.get('kind'),
        'partsOfSpeech':e.get('partsOfSpeech',[]),
        'text':e.get('text'),
        'currentHans':r[1],
        'source':r[3],
    })

usage_targets=[]
for e in entries:
    if e.get('domainId')!='domain_general_collocations':
        continue
    r=rows[e['id']]
    usage_targets.append({
        'scope':'general-usage-all',
        'id':e['id'],
        'domainId':e['domainId'],
        'kind':e.get('kind'),
        'partsOfSpeech':e.get('partsOfSpeech',[]),
        'text':e.get('text'),
        'currentHans':r[1],
        'source':r[3],
    })

all_targets=[]; seen=set()
for item in blank_targets+usage_targets:
    if item['id'] in seen: continue
    seen.add(item['id']); all_targets.append(item)

OUT.mkdir(parents=True,exist_ok=True)
for p in OUT.glob('targets-*.jsonl'): p.unlink()
for i in range(0,len(all_targets),CHUNK):
    p=OUT/f'targets-{i//CHUNK:03d}.jsonl'
    with p.open('w',encoding='utf-8') as f:
        for item in all_targets[i:i+CHUNK]:
            f.write(json.dumps(item,ensure_ascii=False,separators=(',',':'))+'\n')
manifest={
    'protocol':'vix-seed9-user-scope-review/1',
    'baselineCommit':ORIGINAL_511,
    'originalBlankGeneralEnglish':sum(x['domainId']=='domain_general_english' for x in blank_targets),
    'originalBlankComputerTerms':sum(x['domainId']=='domain_computer_terms' for x in blank_targets),
    'originalBlankTotal':len(blank_targets),
    'generalUsageAll':len(usage_targets),
    'uniqueTargetCount':len(all_targets),
    'chunkSize':CHUNK,
    'chunkCount':(len(all_targets)+CHUNK-1)//CHUNK,
}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('USER_SCOPE',json.dumps(manifest,ensure_ascii=False))
