import fs from 'node:fs/promises';
import {
  canonicalizeBackup, buildProjection, systemDomainWordsCollectionId, systemDomainContentCollectionId, systemPhraseCollectionId,
  SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID, uniqueProjectionCount,
} from '../js/v3-model.js';

const seed = canonicalizeBackup(JSON.parse(await fs.readFile(new URL('../data/seed.json', import.meta.url), 'utf8')));
const projection = buildProjection(seed);
const computer = 'domain_computer_terms';
const general = 'domain_general_english';
const contentDomain = 'domain_general_collocations';

function collectionCounts(domainId) {
  return Object.fromEntries(seed.collections
    .filter((collection) => collection.domainId === domainId && collection.type === 'normal' && !collection.hidden)
    .sort((a, b) => a.order - b.order)
    .map((collection) => {
      const items = projection.get(collection.id) || [];
      return [collection.name, {
        words: items.filter((entry) => entry.kind === 'word').length,
        phrases: items.filter((entry) => entry.kind === 'phrase').length,
        content: items.filter((entry) => entry.kind === 'content').length,
        total: items.length,
      }];
    }));
}

const sourceCounts = {};
for (const entry of seed.entries.filter((item) => item.domainId === computer)) sourceCounts[entry.glossSource] = (sourceCounts[entry.glossSource] || 0) + 1;
const globalWords = projection.get(SYSTEM_GLOBAL_WORDS_ID) || [];
const globalPhrases = projection.get(SYSTEM_GLOBAL_PHRASES_ID) || [];
const globalContent = projection.get(SYSTEM_GLOBAL_CONTENT_ID) || [];
const sourceCatalog = seed.settings.contentSources || [];
const sourceAuthorityCounts = Object.fromEntries([...new Set(sourceCatalog.map((item) => item.authority || 'legacy'))]
  .map((authority) => [authority, sourceCatalog.filter((item) => (item.authority || 'legacy') === authority).length]));
const generalMembershipCounts = Object.fromEntries(seed.collections
  .filter((collection) => collection.domainId === general && collection.type === 'normal')
  .sort((left, right) => left.order - right.order)
  .map((collection) => [collection.name, seed.memberships.filter((membership) => membership.collectionId === collection.id).length]));
const report = {
  generatedAt: seed.exportedAt,
  schemaVersion: seed.schemaVersion,
  appVersion: seed.appVersion,
  builtInSeedRevision: seed.settings.builtInSeedRevision,
  contentGeneration: 6,
  total: {
    domains: seed.domains.length,
    collections: seed.collections.length,
    entries: seed.entries.length,
    words: seed.entries.filter((entry) => entry.kind === 'word').length,
    phrases: seed.entries.filter((entry) => entry.kind === 'phrase').length,
    content: seed.entries.filter((entry) => entry.kind === 'content').length,
    memberships: seed.memberships.length,
    relationComponents: seed.relationComponents.length,
    studyStamps: seed.studyStamps.length,
  },
  global: {
    words: { renderedRows: globalWords.length, uniqueNormalized: uniqueProjectionCount(globalWords) },
    phrases: { renderedRows: globalPhrases.length, uniqueNormalized: uniqueProjectionCount(globalPhrases) },
    content: { renderedRows: globalContent.length, uniqueNormalized: uniqueProjectionCount(globalContent) },
  },
  generalEnglish: {
    entries: seed.entries.filter((entry) => entry.domainId === general).length,
    words: (projection.get(systemDomainWordsCollectionId(general)) || []).length,
    phrases: (projection.get(systemPhraseCollectionId(general)) || []).length,
    visibleCollections: collectionCounts(general),
    sourceMemberships: generalMembershipCounts,
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
  nonStructured: {
    domainId: contentDomain,
    name: seed.domains.find((domain) => domain.id === contentDomain)?.name || '',
    entries: seed.entries.filter((entry) => entry.domainId === contentDomain).length,
    content: (projection.get(systemDomainContentCollectionId(contentDomain)) || []).length,
    visibleCollections: collectionCounts(contentDomain),
  },
  provenance: {
    records: sourceCatalog.length,
    authorityCounts: sourceAuthorityCounts,
    manifest: 'data/sources/seed5/SOURCE_MANIFEST.json + data/sources/seed6/VIX6_DOMAIN_EXPANSION.json',
    runtimeManifest: 'data/seed5-runtime/manifest.json',
  },
  scopeNote: 'The current Seed broadly includes quality-acceptable official, publisher-approved, community and VIX-curated material after normalization, basic filtering and exact deduplication. Cross-list memberships are preserved; community and curated sources remain explicitly labelled and are not represented as official releases.',
};
await fs.writeFile(new URL('../data/seed-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
