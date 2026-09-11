#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeGlossHant, toTraditional, MAX_GLOSS_TEXT } from '../js/v3-model.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RUNTIME=path.join(ROOT,'data','seed5-runtime');
const BASELINES=path.join(ROOT,'data','seed-baselines');
const STAGE=process.env.SEED9_HANS_OUT || '/tmp/seed9-hans.json';
const GENERATED_AT=process.env.SEED9_GENERATED_AT || '2026-09-11T00:00:00.000Z';
const MAX_CHUNK_BYTES=4194304;
const compact=v=>JSON.stringify(v);
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const withoutGloss=e=>{const {gloss,...rest}=e; return rest;};
const files=re=>fs.readdirSync(RUNTIME).filter(n=>re.test(n)).sort().map(n=>path.join(RUNTIME,n));
const loadAll=ps=>ps.flatMap(p=>readJson(p));
const descriptor=(p,count)=>{const b=fs.readFileSync(p);return {path:path.relative(ROOT,p).replaceAll('\\','/'),bytes:b.length,sha256:sha(b),count};};
const verify=d=>{const b=fs.readFileSync(path.join(ROOT,d.path));if(b.length!==d.bytes||sha(b)!==d.sha256)throw new Error(`descriptor drift: ${d.path}`);};

const manifest=readJson(path.join(RUNTIME,'manifest.json'));
if(manifest.protocol!=='vix-seed-runtime/1'||Number(manifest.seedRevision)!==9) throw new Error(`expected Seed 9 runtime, got ${manifest.seedRevision}`);
if(compact(manifest.counts)!==compact({entries:23917,memberships:61905,relationComponents:20793})) throw new Error('runtime counts mismatch');
for(const d of [...manifest.memberships,...manifest.relationComponents]) verify(d);

const entryPaths=files(/^entries-\d+\.json$/);
const original=loadAll(entryPaths);
if(original.length!==23917) throw new Error('entry count mismatch');
const stage=readJson(STAGE);
if(stage.protocol!=='vix-seed9-hans-stage/1'||Number(stage.seedRevision)!==9||stage.entries?.length!==23917) throw new Error('invalid semantic stage');
const byId=new Map(stage.entries.map(r=>[r[0],{hans:r[1],source:r[2]}]));
if(byId.size!==23917) throw new Error('semantic stage ID coverage mismatch');

const baselineRows=[];
const forbidden=['软体','网路','资讯','资料库','程式','记忆体','硬碟','伺服器','滑鼠','印表机','作业系统'];
let mismatches=0;
const rebuilt=original.map((entry,i)=>{
  const item=byId.get(entry.id);
  if(!item?.hans) throw new Error(`missing/empty gloss ${entry.id}`);
  if(item.hans.length>MAX_GLOSS_TEXT) throw new Error(`gloss too long ${entry.id}`);
  for(const bad of forbidden) if(item.hans.includes(bad)) throw new Error(`non-Mainland terminology ${bad} in ${entry.id}`);
  const hant=normalizeGlossHant(toTraditional(item.hans));
  if(!hant||hant.length>MAX_GLOSS_TEXT) throw new Error(`canonical invalid ${entry.id}`);
  if(normalizeGlossHant(toTraditional(item.hans))!==hant) mismatches++;
  baselineRows.push([entry.id,item.hans,hant,item.source]);
  const next={...entry,gloss:hant};
  if(compact(withoutGloss(entry))!==compact(withoutGloss(next))) throw new Error(`non-gloss drift ${entry.id}`);
  return next;
});

function splitChunks(items,maxBytes){
  const chunks=[];let cur=[];
  for(const item of items){
    const trial=[...cur,item];
    if(cur.length&&Buffer.byteLength(compact(trial),'utf8')>maxBytes){chunks.push(cur);cur=[item];}
    else cur=trial;
  }
  if(cur.length)chunks.push(cur);
  return chunks;
}
for(const p of entryPaths) fs.unlinkSync(p);
const chunks=splitChunks(rebuilt,MAX_CHUNK_BYTES);
const entryDescriptors=[];
chunks.forEach((chunk,i)=>{
  const p=path.join(RUNTIME,`entries-${String(i).padStart(3,'0')}.json`);
  fs.writeFileSync(p,compact(chunk)+'\n','utf8');
  const d=descriptor(p,chunk.length);
  if(d.bytes>MAX_CHUNK_BYTES)throw new Error(`chunk exceeds limit ${p}`);
  entryDescriptors.push(d);
});

fs.mkdirSync(BASELINES,{recursive:true});
const baseline={protocol:'vix-seed-field-baseline/1',seedRevision:9,fields:['glossHans','glossHant','glossSource'],entries:baselineRows};
const baselinePath=path.join(BASELINES,'seed-9-glosses.json');
fs.writeFileSync(baselinePath,compact(baseline)+'\n','utf8');

manifest.generatedAt=GENERATED_AT;
manifest.entries=entryDescriptors;
manifest.counts={entries:23917,memberships:61905,relationComponents:20793};
fs.writeFileSync(path.join(RUNTIME,'manifest.json'),compact(manifest)+'\n','utf8');

const sourceCounts={};
for(const row of baselineRows)sourceCounts[row[3]]=(sourceCounts[row[3]]||0)+1;
const qaPath=path.join(BASELINES,'seed-9-qa.json');
const qa=readJson(qaPath);
qa.generatedAt=GENERATED_AT;
qa.coverage='23917/23917';
qa.nonGlossDrift=0;
qa.entryOrderDrift=0;
qa.canonicalConversionMismatches=mismatches;
qa.emptyGlosses=0;
qa.sourceCounts=sourceCounts;
qa.fallbackCount=sourceCounts['VIX-9-MT']||0;
qa.semanticReview=stage.semanticReview||{};
qa.entryChunks=entryDescriptors;
qa.baseline={path:'data/seed-baselines/seed-9-glosses.json',bytes:fs.statSync(baselinePath).size,sha256:sha(fs.readFileSync(baselinePath))};

const entriesByKey=new Map(rebuilt.map(e=>[`${e.domainId}\n${e.normalizedText}`,e]));
const baselineById=new Map(baselineRows.map(r=>[r[0],r]));
qa.smoke=(qa.smoke||[]).map(t=>{
  const e=entriesByKey.get(`${t.domainId}\n${String(t.text).toLowerCase()}`);
  const actual=e?baselineById.get(e.id)?.[1]:'<missing-entry>';
  return {...t,actual,ok:actual===t.expected};
});
if(qa.smoke.some(x=>!x.ok)) throw new Error(`semantic smoke mismatch: ${JSON.stringify(qa.smoke.filter(x=>!x.ok))}`);
if(mismatches) throw new Error(`canonical conversion mismatches: ${mismatches}`);
fs.writeFileSync(qaPath,JSON.stringify(qa,null,2)+'\n','utf8');

for(const d of [...manifest.entries,...manifest.memberships,...manifest.relationComponents]) verify(d);
console.log('SEMANTIC_REAPPLY_OK',JSON.stringify({entries:rebuilt.length,chunks:chunks.length,sourceCounts,semanticReview:qa.semanticReview,baselineSha256:qa.baseline.sha256}));
