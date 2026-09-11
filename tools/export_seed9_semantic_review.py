#!/usr/bin/env python3
import glob, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data'/'seed-baselines'/'seed-9-glosses.json'
OUT=ROOT/'data'/'seed-review'
CHUNK=200

baseline=json.load(BASE.open(encoding='utf-8'))
rows={r[0]: {'hans':r[1],'hant':r[2],'source':r[3]} for r in baseline['entries']}
entries=[]
for p in sorted(glob.glob(str(ROOT/'data'/'seed5-runtime'/'entries-*.json'))):
    entries.extend(json.load(open(p,encoding='utf-8')))

targets=[]
for e in entries:
    r=rows[e['id']]
    if e['domainId']=='domain_computer_terms' or r['source']=='VIX-9-MT':
        targets.append({
            'id':e['id'],
            'domainId':e['domainId'],
            'kind':e['kind'],
            'partsOfSpeech':e.get('partsOfSpeech',[]),
            'text':e['text'],
            'currentHans':r['hans'],
            'source':r['source'],
        })

OUT.mkdir(parents=True,exist_ok=True)
for p in OUT.glob('targets-*.jsonl'): p.unlink()
for i in range(0,len(targets),CHUNK):
    path=OUT/f'targets-{i//CHUNK:03d}.jsonl'
    with path.open('w',encoding='utf-8') as f:
        for item in targets[i:i+CHUNK]:
            f.write(json.dumps(item,ensure_ascii=False,separators=(',',':'))+'\n')
manifest={
    'protocol':'vix-seed9-semantic-review/1',
    'targetCount':len(targets),
    'computerCount':sum(x['domainId']=='domain_computer_terms' for x in targets),
    'mtCount':sum(x['source']=='VIX-9-MT' for x in targets),
    'chunkSize':CHUNK,
    'chunkCount':(len(targets)+CHUNK-1)//CHUNK,
}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
