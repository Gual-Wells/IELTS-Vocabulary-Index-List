import fs from 'node:fs/promises';
import { canonicalizeBackup, normalizeEnglish, toTraditional } from '../js/v3-model.js';
const seedPath=new URL('../data/seed.json',import.meta.url);
const seed=JSON.parse(await fs.readFile(seedPath,'utf8'));
const rows=(await fs.readFile(new URL('../data/computer-terms-source.tsv',import.meta.url),'utf8')).split(/\r?\n/).filter(x=>x&&!x.startsWith('#')).map(x=>x.split('|'));
const byText=new Map(rows.map(([e,z,s])=>[normalizeEnglish(e),{z,s}]));
for(const entry of seed.entries){if(entry.domainId!=='domain_computer_terms') continue; const row=byText.get(entry.normalizedText); if(!row) throw new Error(`missing ${entry.text}`); entry.glossHant=toTraditional(row.z); entry.glossSource=row.s;}
const out=canonicalizeBackup({...seed,schemaVersion:4,appVersion:'3.2.0'});
await fs.writeFile(seedPath,JSON.stringify(out,null,2)+'\n');
console.log(out.entries.filter(e=>e.domainId==='domain_computer_terms').slice(0,15).map(e=>[e.text,e.glossHant]));
