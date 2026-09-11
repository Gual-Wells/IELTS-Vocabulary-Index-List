#!/usr/bin/env python3
from __future__ import annotations
import glob,json,os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'data'/'seed5-runtime'
STAGE=Path(os.environ.get('SEED9_HANS_OUT','/tmp/seed9-hans.json'))

GENERAL_EXACT={
    'ceo':'首席执行官',
    'cort':'皮质醇',
    'cv':'简历；履历',
    'dvd':'数字多功能光盘；DVD 光盘',
    'eco':'生态；环保',
    'gop':'美国共和党（大老党）',
    'hiv':'人类免疫缺陷病毒；艾滋病病毒',
    'hmm':'嗯；唔（表示思考或犹豫）',
    'phd':'博士；哲学博士学位',
    'por':'返回时付款',
    'pre':'在……之前；预先',
    'sitcom':'情景喜剧',
    'ya':'你；你们（非正式用语）',
    'fanciful':'想象出来的；异想天开的',
    'imaginable':'可想象的',
    'imaginary':'想象中的；虚构的；假想的',
    'imagination':'想象；想象力',
    'imaginative':'富有想象力的',
    'imagine':'想象；设想；猜测',
    'monumental':'纪念性的；巨大的；不朽的',
    'picture':'图片；照片；画面；描绘；想象',
    'suppose':'假设；认为；设想',
    'supposition':'假设；推测',
    'think':'想；思考；认为；考虑',
    'think of':'想到；考虑；想起；认为',
    'unimaginably':'难以想象地',
    'unthinkable':'难以想象的；不可思议的',
}
TECH_EXACT={
    'serviceworker':'在后台拦截网络请求的浏览器工作线程',
    'webworker':'在后台执行脚本的浏览器工作线程',
}

entries=[]
for p in sorted(glob.glob(str(RUNTIME/'entries-*.json'))):
    entries.extend(json.load(open(p,encoding='utf-8')))
by_id={e['id']:e for e in entries}
stage=json.load(STAGE.open(encoding='utf-8'))
if stage.get('protocol')!='vix-seed9-hans-stage/1' or len(stage.get('entries',[]))!=23917:
    raise SystemExit('invalid Seed 9 stage')

changed=0
exact_hits=set()
out=[]
for eid,hans,source in stage['entries']:
    e=by_id[eid]
    key=str(e.get('text') or '').strip().casefold()
    new=str(hans)
    if e.get('domainId')=='domain_general_english':
        new=new.replace('做为','作为').replace('想像','想象')
        if key in GENERAL_EXACT:
            new=GENERAL_EXACT[key]
            exact_hits.add(('g',key))
    elif e.get('domainId')=='domain_computer_terms' and key in TECH_EXACT:
        new=TECH_EXACT[key]
        exact_hits.add(('t',key))
    if new!=hans:
        changed+=1
        source='VIX-9-LANGUAGE-REVIEWED'
    out.append([eid,new,source])

expected={('g',k) for k in GENERAL_EXACT}|{('t',k) for k in TECH_EXACT}
missing=expected-exact_hits
if missing:
    raise SystemExit('language override keys not found: '+json.dumps(sorted(missing),ensure_ascii=False))
stage['entries']=out
review=dict(stage.get('semanticReview') or {})
review['languageCleanupChanged']=changed
review['languageCleanupExactOverrides']=len(expected)
stage['semanticReview']=review
STAGE.write_text(json.dumps(stage,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('LANGUAGE_REFINEMENT_OK',json.dumps({'changed':changed,'exactOverrides':len(expected)},ensure_ascii=False))
