import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'data','seed-access');
const CHECK=process.argv.includes('--check');
const SECTIONS=['word','phrase','content'];
const LETTERS=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','#'];
const SHARD=8192;
const min=v=>JSON.stringify(v)+'\n';
const h256=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitsha=t=>{const b=Buffer.from(t,'utf8');return crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\\0','utf8')).update(b).digest('hex');};
async function json(spec){const b=await fs.readFile(path.join(ROOT,spec.path));if(spec.bytes!==undefined&&b.length!==spec.bytes)throw Error('bytes '+spec.path);if(spec.sha256&&h256(b)!==spec.sha256)throw Error('sha256 '+spec.path);return JSON.parse(b.toString('utf8'));}
async function arrays(specs,tag=false){const out=[];for(let i=0;i<specs.length;i++){const a=await json(specs[i]);if(!Array.isArray(a)||a.length!==specs[i].count)throw Error('count '+specs[i].path);out.push(...(tag?a.map(x=>({...x,__entryShardIndex:i})):a));}return out;}
const inc=(m,k)=>{const n=(m.get(k)||0)+1;m.set(k,n);return n;};
const section=(e,d)=>d.contentMode==='nonStructured'?'content':e.kind==='phrase'?'phrase':e.kind==='content'?'content':'word';
const letter=e=>{const x=String(e.normalizedText||'').charAt(0).toUpperCase();return /^[A-Z]$/.test(x)?x:'#';};

async function build(){
  const seedText=await fs.readFile(path.join(ROOT,'data','seed5-runtime','manifest.json'),'utf8');
  const seed=JSON.parse(seedText),meta=await json(seed.meta),entries=await arrays(seed.entries,true),memberships=await arrays(seed.memberships);
  if(entries.length!==seed.counts.entries||memberships.length!==seed.counts.memberships)throw Error('aggregate counts');
  const domains=[...meta.domains].sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const da=new Map(domains.map((d,i)=>[d.id,i+1])),db=new Map(domains.map(d=>[d.id,d]));
  const collections=meta.collections.filter(c=>c.type==='normal'&&!c.hidden).sort((a,b)=>da.get(a.domainId)-da.get(b.domainId)||a.order-b.order||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const ca=new Map(collections.map((c,i)=>[c.id,i+1])),cb=new Map(meta.collections.map(c=>[c.id,c])),bd=new Map(domains.map(d=>[d.id,[]]));
  for(const c of collections)bd.get(c.domainId).push(c);
  const cr=new Map();for(const cs of bd.values())cs.forEach((c,i)=>cr.set(c.id,i+1));
  const mb=new Map();for(const m of memberships){if(!mb.has(m.entryId))mb.set(m.entryId,[]);mb.get(m.entryId).push(m);}
  const owned=entries.map(e=>{const d=db.get(e.domainId);const q=(mb.get(e.id)||[]).map(m=>({m,c:cb.get(m.collectionId)})).filter(x=>x.c?.type==='normal'&&!x.c.hidden).sort((x,y)=>x.c.order-y.c.order||Number(x.m.sourceOrder||0)-Number(y.m.sourceOrder||0)||x.c.name.localeCompare(y.c.name)||x.c.id.localeCompare(y.c.id)||x.m.id.localeCompare(y.m.id));if(!d||!q.length)throw Error('unindexable '+e.id);return{e,d,c:q[0].c,m:q[0].m};});
  owned.sort((x,y)=>da.get(x.d.id)-da.get(y.d.id)||cr.get(x.c.id)-cr.get(y.c.id)||Number(x.m.sourceOrder||0)-Number(y.m.sourceOrder||0)||x.e.id.localeCompare(y.e.id));
  const dc=new Map(),cc=new Map(),sc=new Map(),lc=new Map();
  const rows=owned.map((x,i)=>{const s=section(x.e,x.d),l=letter(x.e);return{entryId:x.e.id,text:x.e.text,normalizedText:x.e.normalizedText,entryShardIndex:x.e.__entryShardIndex,domainId:x.d.id,collectionId:x.c.id,section:s,letter:l,sourceOrder:Number(x.m.sourceOrder||0),domainAbsolute:da.get(x.d.id),collectionAbsolute:ca.get(x.c.id),collectionRelative:cr.get(x.c.id),sectionAbsolute:0,sectionPresent:0,letterAlphabet:0,letterPresent:0,globalRank:i+1,domainRank:inc(dc,x.d.id),collectionRank:inc(cc,x.c.id),sectionPriorityRank:inc(sc,x.c.id+'\\0'+s),letterPriorityRank:inc(lc,x.c.id+'\\0'+s+'\\0'+l),sectionDisplayRank:0,letterDisplayRank:0};});
  const bc=new Map();for(const r of rows){if(!bc.has(r.collectionId))bc.set(r.collectionId,[]);bc.get(r.collectionId).push(r);}
  const structure={schemaVersion:1,ordinalBase:1,domains:[]};
  for(const d of domains){const dr=rows.filter(r=>r.domainId===d.id);const dn={id:d.id,name:d.name,order:d.order,absoluteOrdinal:da.get(d.id),count:dr.length,globalStartRank:dr[0]?.globalRank||0,globalEndRank:dr.at(-1)?.globalRank||0,collections:[]};for(const c of bd.get(d.id)){const rs=bc.get(c.id)||[];const cn={id:c.id,name:c.name,label:c.label||'',order:c.order,absoluteOrdinal:ca.get(c.id),relativeOrdinal:cr.get(c.id),count:rs.length,globalStartRank:rs[0]?.globalRank||0,globalEndRank:rs.at(-1)?.globalRank||0,sections:[]};const ps=SECTIONS.filter(s=>rs.some(r=>r.section===s));ps.forEach((s,si)=>{const sr=rs.filter(r=>r.section===s),disp=[...sr].sort((a,b)=>a.normalizedText.localeCompare(b.normalizedText,'en')||a.entryId.localeCompare(b.entryId));disp.forEach((r,i)=>r.sectionDisplayRank=i+1);sr.forEach(r=>{r.sectionAbsolute=SECTIONS.indexOf(s)+1;r.sectionPresent=si+1;});const sn={key:s,absoluteOrdinal:SECTIONS.indexOf(s)+1,presentOrdinal:si+1,count:sr.length,priorityGlobalRanks:sr.map(r=>r.globalRank),displayGlobalRanks:disp.map(r=>r.globalRank),letters:[]};const pl=LETTERS.filter(l=>sr.some(r=>r.letter===l));pl.forEach((l,li)=>{const pr=sr.filter(r=>r.letter===l),ds=disp.filter(r=>r.letter===l);ds.forEach((r,i)=>r.letterDisplayRank=i+1);pr.forEach(r=>{r.letterAlphabet=LETTERS.indexOf(l)+1;r.letterPresent=li+1;});sn.letters.push({key:l,alphabetOrdinal:LETTERS.indexOf(l)+1,presentOrdinal:li+1,count:pr.length,priorityGlobalRanks:pr.map(r=>r.globalRank),displayGlobalRanks:ds.map(r=>r.globalRank)});});cn.sections.push(sn);});dn.collections.push(cn);}structure.domains.push(dn);}
  const fields=['globalRank','entryId','text','domainId','collectionId','section','letter','sourceOrder','domainRank','collectionPriorityRank','sectionPriorityRank','letterPriorityRank','sectionDisplayRank','letterDisplayRank','domainAbsoluteOrdinal','collectionAbsoluteOrdinal','collectionRelativeOrdinal','sectionAbsoluteOrdinal','sectionPresentOrdinal','letterAlphabetOrdinal','letterPresentOrdinal','entryShardIndex'];
  const tuples=rows.map(r=>[r.globalRank,r.entryId,r.text,r.domainId,r.collectionId,r.section,r.letter,r.sourceOrder,r.domainRank,r.collectionRank,r.sectionPriorityRank,r.letterPriorityRank,r.sectionDisplayRank,r.letterDisplayRank,r.domainAbsolute,r.collectionAbsolute,r.collectionRelative,r.sectionAbsolute,r.sectionPresent,r.letterAlphabet,r.letterPresent,r.entryShardIndex]);
  const st=min(structure),arts=[];for(let i=0;i<tuples.length;i+=SHARD){const a=tuples.slice(i,i+SHARD),n=arts.length,p='data/seed-access/records-'+String(n).padStart(3,'0')+'.json',t=min(a);arts.push({path:p,text:t,gitBlobSha:gitsha(t),count:a.length,globalStartRank:a[0][0],globalEndRank:a.at(-1)[0]});}
  const manifest={protocol:'vix-seed-access/1',schemaVersion:1,ordinalBase:1,binding:{direction:'one-way',source:'data/seed5-runtime',target:'data/seed-access',sourceAuthoritative:true,targetDerived:true,writeBack:false},source:{manifestPath:'data/seed5-runtime/manifest.json',manifestSnapshot:seed,derivationInputs:['meta','entries','memberships']},semantics:{ownership:'first visible normal membership by collection.order, sourceOrder, collection.name, collection.id, membership.id',priority:'domain.order -> visible normal collection order -> owner sourceOrder -> entryId',display:'within collection section: normalizedText localeCompare(en) -> entryId',systemCollections:'excluded from priority ownership because they are runtime-derived views',sectionOrder:SECTIONS,letterOrder:LETTERS},recordTuple:fields,counts:{domains:domains.length,collections:collections.length,records:tuples.length},structure:{path:'data/seed-access/structure.json',gitBlobSha:gitsha(st)},records:arts.map(({path:p,gitBlobSha:g,count,globalStartRank,globalEndRank})=>({path:p,gitBlobSha:g,count,globalStartRank,globalEndRank}))};
  return{out:new Map([['data/seed-access/manifest.json',min(manifest)],['data/seed-access/structure.json',st],...arts.map(a=>[a.path,a.text])]),files:new Set(arts.map(a=>path.basename(a.path)))};
}
async function verify(out,files){let ok=true;for(const[p,e]of out){try{if(await fs.readFile(path.join(ROOT,p),'utf8')!==e){console.error('STALE '+p);ok=false;}}catch{console.error('MISSING '+p);ok=false;}}for(const n of await fs.readdir(OUT).catch(()=>[])){if(/^records-\\d{3}\\.json$/.test(n)&&!files.has(n)){console.error('EXTRA data/seed-access/'+n);ok=false;}}if(!ok)process.exitCode=1;else console.log('seed-access is current');}
async function write(out,files){await fs.mkdir(OUT,{recursive:true});for(const n of await fs.readdir(OUT).catch(()=>[])){if(/^records-\\d{3}\\.json$/.test(n)&&!files.has(n))await fs.rm(path.join(OUT,n),{force:true});}for(const[p,c]of out){const f=path.join(ROOT,p);await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,c,'utf8');}console.log('wrote '+out.size+' seed-access artifacts');}
const{out,files}=await build();if(CHECK)await verify(out,files);else await write(out,files);
