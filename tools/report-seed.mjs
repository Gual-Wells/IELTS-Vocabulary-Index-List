import fs from 'node:fs/promises';
import { canonicalizeBackup, buildProjection, systemDomainWordsCollectionId, systemPhraseCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID } from '../js/v3-model.js';
const seed=canonicalizeBackup(JSON.parse(await fs.readFile(new URL('../data/seed.json', import.meta.url),'utf8')));
const projection=buildProjection(seed);
const computer='domain_computer_terms';
const sourceCounts={};
for(const entry of seed.entries.filter(e=>e.domainId===computer)) sourceCounts[entry.glossSource]=(sourceCounts[entry.glossSource]||0)+1;
const visibleCounts={};
for(const collection of seed.collections.filter(c=>c.domainId==='domain_general_english'&&c.type==='normal')) visibleCounts[collection.name]=(projection.get(collection.id)||[]).length;
const computerVisibleCounts={};
for(const collection of seed.collections.filter(c=>c.domainId===computer&&c.type==='normal'&&!c.hidden)) computerVisibleCounts[collection.name]=(projection.get(collection.id)||[]).length;
const report={
 generatedAt:seed.exportedAt,schemaVersion:3,appVersion:seed.appVersion,
 total:{domains:seed.domains.length,collections:seed.collections.length,entries:seed.entries.length,words:seed.entries.filter(e=>e.kind==='word').length,phrases:seed.entries.filter(e=>e.kind==='phrase').length,memberships:seed.memberships.length,phraseTokens:seed.phraseTokens.length},
 global:{words:(projection.get(SYSTEM_GLOBAL_WORDS_ID)||[]).length,phrases:(projection.get(SYSTEM_GLOBAL_PHRASES_ID)||[]).length},
 generalEnglish:{entries:seed.entries.filter(e=>e.domainId==='domain_general_english').length,words:(projection.get(systemDomainWordsCollectionId('domain_general_english'))||[]).length,phrases:(projection.get(systemPhraseCollectionId('domain_general_english'))||[]).length,visibleCollectionCounts:visibleCounts},
 computerTerms:{domainId:computer,entries:seed.entries.filter(e=>e.domainId===computer).length,words:(projection.get(systemDomainWordsCollectionId(computer))||[]).length,phrases:(projection.get(systemPhraseCollectionId(computer))||[]).length,glossEnabled:seed.domains.find(d=>d.id===computer)?.glossEnabled===true,glossCoverage:seed.entries.filter(e=>e.domainId===computer&&e.glossHant).length,hiddenSourceCollections:seed.collections.filter(c=>c.domainId===computer&&c.hidden).map(c=>c.id),visibleCollectionCounts:computerVisibleCounts,sourceCounts}
};
await fs.writeFile(new URL('../data/seed-report.json', import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
