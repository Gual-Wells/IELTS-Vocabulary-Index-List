import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'data','seed-access');
const DATES=path.join(OUT,'dates');
const CHECK=process.argv.includes('--check');
const DOMAIN_ID='domain_general_english';
const SECTION='word';
const LETTERS=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','#'];
const SHARD=8192;
const min=v=>JSON.stringify(v)+'\n';
const h256=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitsha=t=>{const b=Buffer.from(t,'utf8');return crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0','utf8')).update(b).digest('hex');};
async function json(spec){const b=await fs.readFile(path.join(ROOT,spec.path));if(spec.bytes!==undefined&&b.length!==spec.bytes)throw Error('bytes '+spec.path);if(spec.sha256&&h256(b)!==spec.sha256)throw Error('sha256 '+spec.path);return JSON.parse(b.toString('utf8'));}
async function arrays(specs,tag=false){const out=[];for(let i=0;i<specs.length;i++){const a=await json(specs[i]);if(!Array.isArray(a)||a.length!==specs[i].count)throw Error('count '+specs[i].path);out.push(...(tag?a.map(x=>({...x,__entryShardIndex:i})):a));}return out;}
const inc=(m,k)=>{const n=(m.get(k)||0)+1;m.set(k,n);return n;};
const section=(e,d)=>d.contentMode==='nonStructured'?'content':e.kind==='phrase'?'phrase':e.kind==='content'?'content':'word';
const letter=e=>{const x=String(e.normalizedText||'').charAt(0).toUpperCase();return /^[A-Z]$/.test(x)?x:'#';};
function validInternalDateLabel(label){const m=/^(\d{2})-(\d{2})$/.exec(label);if(!m)return false;const month=Number(m[1]),day=Number(m[2]);if(month<1||month>12||day<1)return false;const md=[31,29,31,30,31,30,31,31,30,31,30,31][month-1];return day<=md;}
async function loadDates(recordCount){
  const files=[];
  for(const fd of await fs.readdir(DATES,{withFileTypes:true})){
    const m=/^(\d{2}-\d{2})\.json$/.exec(fd.name);
    if(!fd.isFile()||!m)throw Error('invalid date file '+fd.name);
    const date=m[1];
    if(!validInternalDateLabel(date))throw Error('invalid internal date label '+date);
    const rel='data/seed-access/dates/'+fd.name;
    const text=await fs.readFile(path.join(ROOT,rel),'utf8'),v=JSON.parse(text);
    if(v.protocol!=='vix-seed-access-date/1'||v.schemaVersion!==1||v.date!==date||!Array.isArray(v.globalRanks))throw Error('invalid date payload '+rel);
    let prev=0;for(const rank of v.globalRanks){if(!Number.isInteger(rank)||rank<1||rank>recordCount||rank<=prev)throw Error('invalid date rank '+rel+'#'+rank);prev=rank;}
    files.push({path:rel,date,globalRanks:v.globalRanks,gitBlobSha:gitsha(text)});
  }
  files.sort((a,b)=>a.date.localeCompare(b.date));
  return files;
}

async function build(){
  const seedText=await fs.readFile(path.join(ROOT,'data','seed5-runtime','manifest.json'),'utf8');
  const seed=JSON.parse(seedText),meta=await json(seed.meta),entries=await arrays(seed.entries,true),memberships=await arrays(seed.memberships);
  if(entries.length!==seed.counts.entries||memberships.length!==seed.counts.memberships)throw Error('aggregate counts');
  const domain=meta.domains.find(d=>d.id===DOMAIN_ID);if(!domain)throw Error('missing '+DOMAIN_ID);
  const allDomains=[...meta.domains].sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const domainAbsolute=allDomains.findIndex(d=>d.id===DOMAIN_ID)+1;
  const allCollections=meta.collections.filter(c=>c.type==='normal'&&!c.hidden).sort((a,b)=>{const da=allDomains.findIndex(d=>d.id===a.domainId),db=allDomains.findIndex(d=>d.id===b.domainId);return da-db||a.order-b.order||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);});
  const collections=allCollections.filter(c=>c.domainId===DOMAIN_ID).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const ca=new Map(allCollections.map((c,i)=>[c.id,i+1])),cr=new Map(collections.map((c,i)=>[c.id,i+1])),cb=new Map(meta.collections.map(c=>[c.id,c]));
  const mb=new Map();for(const m of memberships){if(!mb.has(m.entryId))mb.set(m.entryId,[]);mb.get(m.entryId).push(m);}
  const owned=[];
  for(const e of entries){
    if(e.domainId!==DOMAIN_ID||section(e,domain)!==SECTION)continue;
    const q=(mb.get(e.id)||[]).map(m=>({m,c:cb.get(m.collectionId)})).filter(x=>x.c?.type==='normal'&&!x.c.hidden&&x.c.domainId===DOMAIN_ID).sort((x,y)=>x.c.order-y.c.order||Number(x.m.sourceOrder||0)-Number(y.m.sourceOrder||0)||x.c.name.localeCompare(y.c.name)||x.c.id.localeCompare(y.c.id)||x.m.id.localeCompare(y.m.id));
    if(!q.length)throw Error('unindexable '+e.id);
    owned.push({e,c:q[0].c,m:q[0].m});
  }
  owned.sort((x,y)=>cr.get(x.c.id)-cr.get(y.c.id)||Number(x.m.sourceOrder||0)-Number(y.m.sourceOrder||0)||x.e.id.localeCompare(y.e.id));
  const cc=new Map(),lc=new Map();
  const rows=owned.map((x,i)=>{const l=letter(x.e);return{entryId:x.e.id,text:x.e.text,normalizedText:x.e.normalizedText,entryShardIndex:x.e.__entryShardIndex,collectionId:x.c.id,letter:l,sourceOrder:Number(x.m.sourceOrder||0),globalRank:i+1,collectionRank:inc(cc,x.c.id),letterPriorityRank:inc(lc,x.c.id+'\0'+l),collectionDisplayRank:0,letterDisplayRank:0,collectionAbsolute:ca.get(x.c.id),collectionRelative:cr.get(x.c.id),letterAlphabet:0,letterPresent:0,markDates:[]};});
  const dateFiles=await loadDates(rows.length),byRank=new Map(rows.map(r=>[r.globalRank,r]));
  for(const f of dateFiles)for(const rank of f.globalRanks)byRank.get(rank).markDates.push(f.date);
  const bc=new Map();for(const r of rows){if(!bc.has(r.collectionId))bc.set(r.collectionId,[]);bc.get(r.collectionId).push(r);}
  const structure={schemaVersion:2,ordinalBase:1,scope:{domainId:DOMAIN_ID,domainName:domain.name,domainAbsoluteOrdinal:domainAbsolute,section:SECTION},collections:[]};
  for(const c of collections){
    const rs=bc.get(c.id)||[];if(!rs.length)continue;
    const disp=[...rs].sort((a,b)=>a.normalizedText.localeCompare(b.normalizedText,'en')||a.entryId.localeCompare(b.entryId));
    disp.forEach((r,i)=>r.collectionDisplayRank=i+1);
    const cn={id:c.id,name:c.name,label:c.label||'',order:c.order,absoluteOrdinal:ca.get(c.id),relativeOrdinal:cr.get(c.id),count:rs.length,globalStartRank:rs[0].globalRank,globalEndRank:rs.at(-1).globalRank,priorityGlobalRanks:rs.map(r=>r.globalRank),displayGlobalRanks:disp.map(r=>r.globalRank),letters:[]};
    const pl=LETTERS.filter(l=>rs.some(r=>r.letter===l));
    pl.forEach((l,li)=>{const pr=rs.filter(r=>r.letter===l),ds=disp.filter(r=>r.letter===l);ds.forEach((r,i)=>r.letterDisplayRank=i+1);pr.forEach(r=>{r.letterAlphabet=LETTERS.indexOf(l)+1;r.letterPresent=li+1;});cn.letters.push({key:l,alphabetOrdinal:LETTERS.indexOf(l)+1,presentOrdinal:li+1,count:pr.length,priorityGlobalRanks:pr.map(r=>r.globalRank),displayGlobalRanks:ds.map(r=>r.globalRank)});});
    structure.collections.push(cn);
  }
  const fields=['globalRank','entryId','text','collectionId','letter','sourceOrder','collectionPriorityRank','letterPriorityRank','collectionDisplayRank','letterDisplayRank','collectionAbsoluteOrdinal','collectionRelativeOrdinal','letterAlphabetOrdinal','letterPresentOrdinal','entryShardIndex','markDates'];
  const tuples=rows.map(r=>[r.globalRank,r.entryId,r.text,r.collectionId,r.letter,r.sourceOrder,r.collectionRank,r.letterPriorityRank,r.collectionDisplayRank,r.letterDisplayRank,r.collectionAbsolute,r.collectionRelative,r.letterAlphabet,r.letterPresent,r.entryShardIndex,r.markDates]);
  const markHash={protocol:'vix-seed-access-mark-hash/1',schemaVersion:1,ordinalBase:1,scope:{domainId:DOMAIN_ID,section:SECTION},counts:{records:rows.length,marked:rows.filter(r=>r.markDates.length).length,unmarked:rows.filter(r=>!r.markDates.length).length,dateFiles:dateFiles.length},byGlobalRank:Object.fromEntries(rows.map(r=>[String(r.globalRank),[r.entryId,r.markDates]]))};
  const st=min(structure),mh=min(markHash),arts=[];for(let i=0;i<tuples.length;i+=SHARD){const a=tuples.slice(i,i+SHARD),n=arts.length,p='data/seed-access/records-'+String(n).padStart(3,'0')+'.json',t=min(a);arts.push({path:p,text:t,gitBlobSha:gitsha(t),count:a.length,globalStartRank:a[0][0],globalEndRank:a.at(-1)[0]});}
  const manifest={protocol:'vix-seed-access/2',schemaVersion:2,ordinalBase:1,scope:{domainId:DOMAIN_ID,domainName:domain.name,domainAbsoluteOrdinal:domainAbsolute,section:SECTION,records:rows.length},binding:{seed:{direction:'one-way',source:'data/seed5-runtime',target:'data/seed-access',sourceAuthoritative:true,targetDerived:true,writeBack:false},marks:{source:'data/seed-access/dates',sourceAuthoritativeForMarks:true,labelFormat:'MM-DD',firstLabel:'01-01',externalDateMeaning:false,writeBackToSeed:false}},source:{manifestPath:'data/seed5-runtime/manifest.json',manifestGitBlobSha:gitsha(seedText),seedRevision:seed.seedRevision,appVersion:seed.appVersion,inputs:{meta:seed.meta,entries:seed.entries,memberships:seed.memberships},counts:{entries:seed.counts.entries,memberships:seed.counts.memberships}},semantics:{ownership:'first visible normal membership inside domain_general_english by collection.order, sourceOrder, collection.name, collection.id, membership.id',priority:'visible general-English collection order -> owner sourceOrder -> entryId',display:'within owning collection: normalizedText localeCompare(en) -> entryId',scopeFilter:'domain_general_english AND section=word',letterOrder:LETTERS,markValue:'markDates is derived only from date files; [] means unmarked'},recordTuple:fields,counts:{collections:structure.collections.length,records:tuples.length,marked:markHash.counts.marked,unmarked:markHash.counts.unmarked,dateFiles:dateFiles.length},structure:{path:'data/seed-access/structure.json',gitBlobSha:gitsha(st)},markHash:{path:'data/seed-access/mark-hash.json',gitBlobSha:gitsha(mh)},dates:dateFiles.map(f=>({path:f.path,date:f.date,count:f.globalRanks.length,gitBlobSha:f.gitBlobSha})),records:arts.map(({path:p,gitBlobSha:g,count,globalStartRank,globalEndRank})=>({path:p,gitBlobSha:g,count,globalStartRank,globalEndRank}))};
  return{out:new Map([['data/seed-access/manifest.json',min(manifest)],['data/seed-access/structure.json',st],['data/seed-access/mark-hash.json',mh],...arts.map(a=>[a.path,a.text])]),files:new Set(arts.map(a=>path.basename(a.path)))};
}
async function verify(out,files){let ok=true;for(const[p,e]of out){try{if(await fs.readFile(path.join(ROOT,p),'utf8')!==e){console.error('STALE '+p);ok=false;}}catch{console.error('MISSING '+p);ok=false;}}for(const n of await fs.readdir(OUT).catch(()=>[])){if(/^records-\d{3}\.json$/.test(n)&&!files.has(n)){console.error('EXTRA data/seed-access/'+n);ok=false;}}if(!ok)process.exitCode=1;else console.log('seed-access is current');}
async function write(out,files){await fs.mkdir(OUT,{recursive:true});for(const n of await fs.readdir(OUT).catch(()=>[])){if(/^records-\d{3}\.json$/.test(n)&&!files.has(n))await fs.rm(path.join(OUT,n),{force:true});}for(const[p,c]of out){const f=path.join(ROOT,p);await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,c,'utf8');}console.log('wrote '+out.size+' seed-access artifacts');}
const{out,files}=await build();if(CHECK)await verify(out,files);else await write(out,files);
