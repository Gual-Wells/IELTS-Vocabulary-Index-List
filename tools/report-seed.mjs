import fs from 'node:fs/promises';
import {
  canonicalizeBackup, buildProjection, systemDomainWordsCollectionId, systemPhraseCollectionId,
  SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID,
} from '../js/v3-model.js';

const seed = canonicalizeBackup(JSON.parse(await fs.readFile(new URL('../data/seed.json', import.meta.url), 'utf8')));
const projection = buildProjection(seed);
const computer = 'domain_computer_terms';
const general = 'domain_general_english';

function collectionCounts(domainId) {
  return Object.fromEntries(seed.collections
    .filter((collection) => collection.domainId === domainId && collection.type === 'normal' && !collection.hidden)
    .sort((a, b) => a.order - b.order)
    .map((collection) => {
      const items = projection.get(collection.id) || [];
      return [collection.name, {
        words: items.filter((entry) => entry.kind === 'word').length,
        phrases: items.filter((entry) => entry.kind === 'phrase').length,
        total: items.length,
      }];
    }));
}

const sourceCounts = {};
for (const entry of seed.entries.filter((item) => item.domainId === computer)) {
  sourceCounts[entry.glossSource] = (sourceCounts[entry.glossSource] || 0) + 1;
}
const report = {
  generatedAt: seed.exportedAt,
  schemaVersion: seed.schemaVersion,
  appVersion: seed.appVersion,
  builtInSeedRevision: seed.settings.builtInSeedRevision,
  total: {
    domains: seed.domains.length,
    collections: seed.collections.length,
    entries: seed.entries.length,
    words: seed.entries.filter((entry) => entry.kind === 'word').length,
    phrases: seed.entries.filter((entry) => entry.kind === 'phrase').length,
    memberships: seed.memberships.length,
    phraseTokens: seed.phraseTokens.length,
    studyStamps: seed.studyStamps.length,
  },
  global: {
    words: (projection.get(SYSTEM_GLOBAL_WORDS_ID) || []).length,
    phrases: (projection.get(SYSTEM_GLOBAL_PHRASES_ID) || []).length,
  },
  generalEnglish: {
    entries: seed.entries.filter((entry) => entry.domainId === general).length,
    words: (projection.get(systemDomainWordsCollectionId(general)) || []).length,
    phrases: (projection.get(systemPhraseCollectionId(general)) || []).length,
    visibleCollections: collectionCounts(general),
  },
  computerTerms: {
    domainId: computer,
    entries: seed.entries.filter((entry) => entry.domainId === computer).length,
    words: (projection.get(systemDomainWordsCollectionId(computer)) || []).length,
    phrases: (projection.get(systemPhraseCollectionId(computer)) || []).length,
    glossEnabled: seed.domains.find((domain) => domain.id === computer)?.glossEnabled === true,
    glossCoverage: seed.entries.filter((entry) => entry.domainId === computer && entry.glossHant).length,
    hiddenSourceCollections: seed.collections.filter((collection) => collection.domainId === computer && collection.hidden).map((collection) => collection.id),
    visibleCollections: collectionCounts(computer),
    sourceCounts,
  },
};
await fs.writeFile(new URL('../data/seed-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
