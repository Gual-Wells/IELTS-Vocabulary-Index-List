import json,re,collections,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
seed_path=root/'data/seed.json'
seed=json.loads(seed_path.read_text('utf-8'))
D='domain_computer_terms'
SOURCE='collection_computer_terms_builtin_source'
CATS=[
 ('collection_computer_foundations_systems','计算机基础与系统',2),
 ('collection_computer_software_data','软件开发与数据',3),
 ('collection_computer_network_cloud_security','网络、云与安全',4),
 ('collection_computer_artificial_intelligence','人工智能',5),
]
CAT_BY_ID={x[0]:x for x in CATS}
# Strong lexical overrides are evaluated before broad source families.
AI=set('''activation agent alignment attention backpropagation classifier clustering corpus embedding epoch fine-tuning hallucination inference intelligence loss model neuron optimizer perplexity prediction prompt reasoning regression reward sampler tokenizer training transformer'''.split())
AI_PAT=[r'(^| )(ai|ml)($| )',r'neural',r'language model',r'foundation model',r'generative',r'machine learning',r'deep learning',r'reinforcement',r'computer vision',r'natural language',r'knowledge graph',r'diffusion',r'adversarial',r'fairness',r'bias',r'explainab',r'responsible ai',r'few-shot',r'zero-shot']
NETSEC=set('''authentication authorization certificate cipher credential cryptography firewall gateway hostname internet malware network packet port privacy protocol proxy router routing socket threat trust vulnerability web'''.split())
NET_PAT=[r'cloud',r'kubernetes',r'container',r'cluster',r'deployment',r'orchestrat',r'microservice',r'devops',r'pipeline',r'observab',r'telemetr',r'load balanc',r'domain name',r'dns',r'http',r'https',r'tcp',r'udp',r'ip address',r'zero trust',r'access control',r'encrypt',r'decrypt',r'attack',r'security',r'privacy',r'vulnerab',r'certificate',r'identity',r'credential',r'malware',r'phishing',r'firewall',r'network',r'protocol']
SW=set('''api application argument array assertion branch bug build class code compiler constant database debug dependency developer exception function git github implementation interface javascript library method module object package programming python query repository runtime schema script software source string test transaction type variable web'''.split())
SW_PAT=[r'database',r'data ',r'query',r'sql',r'program',r'software',r'web ',r'browser',r'document object',r'css',r'html',r'javascript',r'python',r'github',r'version control',r'continuous integration',r'testing',r'framework',r'library',r'package',r'api',r'interface',r'function',r'class',r'object',r'type system',r'exception',r'debug',r'compiler']
SYS=set('''algorithm architecture bit buffer bus byte cache cpu data structure device disk graph hardware heap kernel memory node operating processor queue register scheduling stack storage system thread tree'''.split())
SYS_PAT=[r'operating system',r'file system',r'virtual memory',r'process',r'thread',r'concurr',r'synchron',r'deadlock',r'processor',r'hardware',r'memory',r'storage',r'algorithm',r'complexity',r'graph',r'tree',r'queue',r'stack',r'hash',r'sort',r'search',r'architecture',r'instruction',r'cache',r'kernel',r'device',r'bus']
source_default={
 'NIST-AI':CATS[3][0],
 'NIST':CATS[2][0],'K8S':CATS[2][0],'CNCF':CATS[2][0],'IETF':CATS[2][0],'DEVOPS':CATS[2][0],
 'PY':CATS[1][0],'GH':CATS[1][0],'MDN':CATS[1][0],'DATA':CATS[1][0],
 'HW':CATS[0][0],'OS':CATS[0][0],'DSA':CATS[0][0],'CORE':CATS[0][0],
}
def match(text, words, patterns):
 t=text.lower()
 toks=set(re.findall(r"[a-z0-9]+",t))
 if toks & words:return True
 return any(re.search(p,t) for p in patterns)
def classify(e):
 t=e['normalizedText']; s=e.get('glossSource','')
 # Highest-confidence modern AI phrases first.
 if s=='NIST-AI' or match(t,AI,AI_PAT): return CATS[3][0]
 # Network/cloud/security before general software, because terms such as token and service are ambiguous.
 if s in {'NIST','K8S','CNCF','IETF','DEVOPS'} or match(t,NETSEC,NET_PAT): return CATS[2][0]
 if s in {'PY','GH','MDN','DATA'} or match(t,SW,SW_PAT): return CATS[1][0]
 if s in {'HW','OS','DSA'} or match(t,SYS,SYS_PAT): return CATS[0][0]
 return source_default.get(s,CATS[0][0])
# Upsert category collections; keep hidden provenance collection last and out of projection.
ts='2026-08-01T14:20:00.000Z'
by_id={c['id']:c for c in seed['collections']}
for cid,name,order in CATS:
 by_id[cid]={
  'id':cid,'domainId':D,'name':name,'label':'','type':'normal','order':order,'hidden':False,
  'createdAt':by_id.get(cid,{}).get('createdAt',ts),'updatedAt':ts,
 }
if SOURCE in by_id:
 by_id[SOURCE]={**by_id[SOURCE],'order':100,'hidden':True,'updatedAt':ts}
seed['collections']=list(by_id.values())
entries=[e for e in seed['entries'] if e['domainId']==D and e['kind']=='word']
existing=[m for m in seed['memberships'] if m['collectionId'] not in CAT_BY_ID]
new=[]; audit=[]; counts=collections.Counter(); source_counts=collections.defaultdict(collections.Counter)
for idx,e in enumerate(sorted(entries,key=lambda x:x['normalizedText'])):
 cid=classify(e); counts[cid]+=1; source_counts[cid][e.get('glossSource','')]+=1
 mid='membership_'+hashlib.sha1(f"{e['id']}:{cid}".encode()).hexdigest()[:24]
 new.append({'id':mid,'entryId':e['id'],'collectionId':cid,'sourceLabel':e.get('glossSource',''),'sourceOrder':idx,'createdAt':ts,'updatedAt':ts})
 audit.append({'text':e['text'],'glossHant':e.get('glossHant',''),'source':e.get('glossSource',''),'collectionId':cid,'collectionName':CAT_BY_ID[cid][1]})
seed['memberships']=existing+new
seed['appVersion']='3.0.7'; seed['exportedAt']=ts
seed.setdefault('settings',{})['builtInSeedRevision']=2
seed_path.write_text(json.dumps(seed,ensure_ascii=False,indent=2)+'\n','utf-8')
report={'generatedAt':ts,'domainId':D,'words':len(entries),'classified':len(new),'counts':{CAT_BY_ID[k][1]:v for k,v in counts.items()},'sourceCounts':{CAT_BY_ID[k][1]:dict(v) for k,v in source_counts.items()},'items':audit}
(root/'data/computer-terms-classification-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps(report['counts'],ensure_ascii=False,indent=2)); print('sum',sum(counts.values()))
