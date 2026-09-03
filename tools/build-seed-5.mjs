import fs from 'node:fs/promises';
import {
  buildRelationComponentsForEntries,
  canonicalizeBackup,
  createCollection,
  createEntry,
  createMembership,
  isPhraseText,
  normalizeDisplayText,
  normalizeEnglish,
  safeId,
  toTraditional,
  validateBackup,
} from '../js/v3-model.js';
import { APP_VERSION } from '../js/v5-version.js';

const root = new URL('../', import.meta.url);
const sourceRoot = new URL('../data/sources/seed5/', import.meta.url);
const seed4 = JSON.parse(await fs.readFile(new URL('../data/seed-4.json', import.meta.url), 'utf8'));
const sourceManifest = JSON.parse(await fs.readFile(new URL('SOURCE_MANIFEST.json', sourceRoot), 'utf8'));
const timestamp = '2026-09-02T00:00:00.000Z';
const generalDomainId = 'domain_general_english';
const rejected = [];

const definitions = [
  ['a1', 'A1', 'A1', 0],
  ['a2', 'A2', 'A2', 1],
  ['b1', 'B1', 'B1', 2],
  ['b2', 'B2', 'B2', 3],
  ['c1', 'C1', 'C1', 4],
  ['c2', 'C2', 'C2', 5],
  ['nawl', 'NAWL', 'NAWL 1.2', 6],
  ['coca5000', 'COCA 5000', '社区 COCA 排名 1–5000', 7],
  ['coca10000', 'COCA 10000', '社区 COCA 排名 1–10000', 8],
  ['cet4', 'CET 4', '大学英语四级（社区整理）', 9],
  ['cet6', 'CET 6', '大学英语六级累计集（社区整理）', 10],
  ['tem4', 'TEM 4', '英语专业四级（社区整理）', 11],
  ['tem8', 'TEM 8', '英语专业八级（社区整理）', 12],
].map(([key, name, label, order]) => ({
  key, name, label, order,
  id: `collection_general_english_${key}`,
}));
const collectionByKey = new Map(definitions.map((item) => [item.key, item]));

const oldGeneralByText = new Map(seed4.entries
  .filter((entry) => entry.domainId === generalDomainId)
  .map((entry) => [entry.normalizedText, entry]));
const candidates = new Map();
const memberships = new Map();
let candidateSequence = 0;

function cleanCandidateText(input) {
  const text = normalizeDisplayText(input).replace(/^\uFEFF/, '');
  if (!text || text.length > 160 || !/[A-Za-z]/.test(text) || /^https?:/i.test(text)) return '';
  if (/^[\W_]+$/u.test(text)) return '';
  return text;
}

function cleanGloss(value) {
  return normalizeDisplayText(value).slice(0, 120);
}

function addCandidate(rawText, { source, pos = '', gloss = '', preferredKind = '', displayText = '' } = {}) {
  const text = cleanCandidateText(displayText || rawText);
  if (!text) {
    rejected.push({ source, text: String(rawText || '').slice(0, 160), reason: 'quality-filter' });
    return '';
  }
  const normalizedText = normalizeEnglish(text);
  let candidate = candidates.get(normalizedText);
  if (!candidate) {
    const old = oldGeneralByText.get(normalizedText);
    candidate = {
      normalizedText,
      text: old?.text || text,
      id: old?.id || safeId('entry', `${generalDomainId}:${normalizedText}`),
      createdAt: old?.createdAt || timestamp,
      kind: preferredKind || old?.kind || (isPhraseText(text) ? 'phrase' : 'word'),
      partsOfSpeech: new Set(old?.partsOfSpeech || []),
      glossHans: old?.glossHans || '',
      glossHant: old?.glossHant || '',
      glossSource: old?.glossSource || '',
      sources: new Set(),
      firstSeen: candidateSequence++,
    };
    candidates.set(normalizedText, candidate);
  }
  if (pos) candidate.partsOfSpeech.add(normalizeDisplayText(pos));
  if (source) candidate.sources.add(source);
  const normalizedGloss = cleanGloss(gloss);
  if (!candidate.glossHant && normalizedGloss) {
    candidate.glossHans = normalizedGloss;
    candidate.glossHant = toTraditional(normalizedGloss);
    candidate.glossSource = source;
  }
  return normalizedText;
}

function addMembership(collectionKey, normalizedText, sourceLabel, sourceOrder) {
  if (!normalizedText || !collectionByKey.has(collectionKey)) return;
  const key = `${collectionKey}\u0000${normalizedText}`;
  const current = memberships.get(key);
  if (!current) {
    memberships.set(key, { collectionKey, normalizedText, labels: new Set([sourceLabel]), sourceOrder });
  } else {
    current.labels.add(sourceLabel);
    current.sourceOrder = Math.min(current.sourceOrder, sourceOrder);
  }
}

const cefr = JSON.parse(await fs.readFile(new URL('cefrj-1.6.normalized.json', sourceRoot), 'utf8'));
for (const [index, row] of cefr.rows.entries()) {
  const level = String(row.level || '').toLowerCase().slice(0, 2);
  if (!collectionByKey.has(level)) continue;
  const text = addCandidate(row.word, { source: 'CEFR-J 1.6', pos: row.pos });
  addMembership(level, text, 'CEFR-J 1.6', index);
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  values.push(value);
  return values;
}

const octanoveLines = (await fs.readFile(new URL('octanove-c1c2-1.0.csv', sourceRoot), 'utf8')).split(/\r?\n/).slice(1);
for (const [index, line] of octanoveLines.entries()) {
  if (!line.trim()) continue;
  const [word, pos, rawLevel] = parseCsvLine(line);
  const level = String(rawLevel || '').toLowerCase().slice(0, 2);
  if (!['c1', 'c2'].includes(level)) continue;
  const text = addCandidate(word, { source: 'Octanove C1/C2 1.0', pos });
  addMembership(level, text, 'Octanove C1/C2 1.0', index);
}

const nawlLines = (await fs.readFile(new URL('NAWL_1.2_alphabetized_description.txt', sourceRoot), 'utf8')).split(/\r?\n/).slice(5);
for (const [index, word] of nawlLines.entries()) {
  const text = addCandidate(word, { source: 'NAWL 1.2' });
  addMembership('nawl', text, 'NAWL 1.2', index);
}

const cocaLines = (await fs.readFile(new URL('coca-1-10000.tsv', sourceRoot), 'utf8')).trim().split(/\r?\n/);
for (const line of cocaLines) {
  const [rankText, word] = line.split('\t');
  const rank = Number(rankText);
  const text = addCandidate(word, { source: 'COCA 20000 community mirror' });
  if (rank <= 5000) addMembership('coca5000', text, 'COCA community rank', rank);
  addMembership('coca10000', text, 'COCA community rank', rank);
}

const cetObject = JSON.parse(await fs.readFile(new URL('cet_full_list.json', sourceRoot), 'utf8'));
const cetRows = cetObject[Object.keys(cetObject)[0]] || [];
for (const [index, row] of cetRows.entries()) {
  const text = addCandidate(row['单词'], { source: 'CETVocabulary community', gloss: row['释义'] });
  if (row['六级'] == null) addMembership('cet4', text, 'CET 2016 community transcription', index);
  // CET6 is intentionally cumulative: CET4 core plus the starred CET6 extension.
  addMembership('cet6', text, 'CET 2016 cumulative community transcription', index);
  const alternatives = String(row['其他拼写'] || '').split(/[、,;/]/).map((item) => item.trim()).filter(Boolean);
  for (const alternative of alternatives) {
    const alternateText = addCandidate(alternative, { source: 'CETVocabulary alternate spelling', gloss: row['释义'] });
    if (row['六级'] == null) addMembership('cet4', alternateText, 'CET alternate spelling', index);
    addMembership('cet6', alternateText, 'CET alternate spelling', index);
  }
}

for (const [collectionKey, filename] of [['tem4', 'Level4luan_2_T.json'], ['tem8', 'Level8luan_2_T.json']]) {
  const rows = JSON.parse(await fs.readFile(new URL(filename, sourceRoot), 'utf8'));
  for (const [index, row] of rows.entries()) {
    const gloss = Array.isArray(row.trans) ? row.trans.find(Boolean) : row.trans;
    const text = addCandidate(row.name, { source: `Qwerty ${collectionKey.toUpperCase()} community`, gloss });
    addMembership(collectionKey, text, `Qwerty ${collectionKey.toUpperCase()} community`, index);
  }
}

for (const collectionKey of ['cet4', 'cet6', 'tem4', 'tem8']) {
  const lines = (await fs.readFile(new URL(`phrases-${collectionKey}.txt`, sourceRoot), 'utf8')).split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const text = addCandidate(line, { source: `2ndLA ${collectionKey.toUpperCase()} phrases`, preferredKind: 'phrase' });
    addMembership(collectionKey, text, `2ndLA ${collectionKey.toUpperCase()} phrase evidence`, 100000 + index);
  }
}

const generalEntries = [...candidates.values()]
  .sort((left, right) => left.firstSeen - right.firstSeen || left.normalizedText.localeCompare(right.normalizedText, 'en'))
  .map((candidate) => createEntry({
    id: candidate.id,
    domainId: generalDomainId,
    text: candidate.text,
    kind: candidate.kind,
    partsOfSpeech: [...candidate.partsOfSpeech].filter(Boolean),
    glossHans: candidate.glossHans,
    glossHant: candidate.glossHant,
    glossSource: candidate.glossSource,
    createdAt: candidate.createdAt,
    updatedAt: timestamp,
    timestamp,
  }));
const entryByText = new Map(generalEntries.map((entry) => [entry.normalizedText, entry]));

const generalCollections = definitions.map((definition) => createCollection({
  id: definition.id,
  domainId: generalDomainId,
  name: definition.name,
  label: definition.label,
  order: definition.order,
  timestamp,
}));
const previousPhraseCollection = seed4.collections.find((collection) => collection.id === `${generalDomainId}__phrases`);
generalCollections.push(createCollection({
  id: `${generalDomainId}__phrases`, domainId: generalDomainId, name: '短语总表', type: 'system-phrases',
  order: 1000, createdAt: previousPhraseCollection?.createdAt || timestamp, updatedAt: timestamp, timestamp,
}));

const generalMemberships = [...memberships.values()].map((membership) => {
  const entry = entryByText.get(membership.normalizedText);
  const collection = collectionByKey.get(membership.collectionKey);
  if (!entry || !collection) throw new Error(`Unresolved membership ${membership.collectionKey}:${membership.normalizedText}`);
  return createMembership({
    entryId: entry.id,
    collectionId: collection.id,
    sourceLabel: [...membership.labels].sort().join(' + ').slice(0, 120),
    sourceOrder: membership.sourceOrder,
    timestamp,
  });
});

const nonGeneralEntries = seed4.entries.filter((entry) => entry.domainId !== generalDomainId);
const nonGeneralCollections = seed4.collections.filter((collection) => collection.domainId !== generalDomainId);
const nonGeneralCollectionIds = new Set(nonGeneralCollections.map((collection) => collection.id));
const nonGeneralMemberships = seed4.memberships.filter((membership) => nonGeneralCollectionIds.has(membership.collectionId));
const entries = [...nonGeneralEntries, ...generalEntries];

const sourceTitles = new Map([
  ['cefrj-1.6', ['CEFR-J Wordlist 1.6', 'CEFR-J']],
  ['octanove-c1c2-1.0', ['Octanove Vocabulary Profile C1/C2 1.0', 'Octanove Labs']],
  ['nawl-1.2', ['New Academic Word List 1.2', 'Charlie Browne']],
  ['cet-2016-community', ['CET Vocabulary 2016 community transcription', 'exam-data community']],
  ['tem4-community', ['TEM 4 community compilation', 'Qwerty Learner community']],
  ['tem8-community', ['TEM 8 community compilation', 'Qwerty Learner community']],
  ['coca-1-10000-community', ['COCA 1-10000 community mirror', 'llt22 community mirror']],
  ['cet4-phrases-community', ['CET 4 phrase compilation', '2ndLA community']],
  ['cet6-phrases-community', ['CET 6 phrase compilation', '2ndLA community']],
  ['tem4-phrases-community', ['TEM 4 phrase compilation', '2ndLA community']],
  ['tem8-phrases-community', ['TEM 8 phrase compilation', '2ndLA community']],
]);
const seed5ContentSources = sourceManifest.records.map(({ key, url, authority, license, sha256 }) => ({
  key: `SEED5:${key}`,
  title: sourceTitles.get(key)?.[0] || key,
  publisher: sourceTitles.get(key)?.[1] || authority,
  url,
  retrievedAt: sourceManifest.retrievedAt,
  authority,
  license,
  sha256,
}));
const seed = canonicalizeBackup({
  ...seed4,
  schemaVersion: 6,
  appVersion: APP_VERSION,
  exportedAt: timestamp,
  collections: [...nonGeneralCollections, ...generalCollections],
  entries,
  memberships: [...nonGeneralMemberships, ...generalMemberships],
  relationComponents: buildRelationComponentsForEntries(entries),
  pins: [],
  annotations: [],
  studyStamps: [],
  settings: {
    ...seed4.settings,
    builtInSeedRevision: 5,
    migrationComplete: true,
    migrationSource: 'seed5-three-way-generation',
    migrationNoticePending: false,
    closeLowLevelRelations: true,
    lastPositions: {},
    viewModes: {},
    calendarMonths: {},
    contentSources: [...seed4.settings.contentSources, ...seed5ContentSources],
  },
});
if (!validateBackup(seed)) throw new Error('Seed5 failed Schema 6 validation');

const collectionCounts = Object.fromEntries(definitions.map((definition) => [definition.name,
  seed.memberships.filter((membership) => membership.collectionId === definition.id).length]));
const report = {
  protocol: 'vix-seed-build-report/2',
  seedRevision: 5,
  appVersion: APP_VERSION,
  generatedAt: timestamp,
  sourceManifest: 'data/sources/seed5/SOURCE_MANIFEST.json',
  counts: {
    domains: seed.domains.length,
    collections: seed.collections.length,
    entries: seed.entries.length,
    generalEntries: generalEntries.length,
    generalWords: generalEntries.filter((entry) => entry.kind === 'word').length,
    generalPhrases: generalEntries.filter((entry) => entry.kind === 'phrase').length,
    generalGlosses: generalEntries.filter((entry) => entry.glossHant).length,
    memberships: seed.memberships.length,
    relations: seed.relationComponents.length,
    rejected: rejected.length,
  },
  collectionCounts,
  qualityPolicy: {
    strategy: 'broad inclusion after normalization and basic quality filtering',
    crossCollectionMembershipsPreserved: true,
    communitySourcesClearlyLabelled: true,
    syntheticWordsCreated: false,
  },
  rejected: rejected.slice(0, 200),
};

await fs.writeFile(new URL('../data/seed.json', import.meta.url), `${JSON.stringify(seed, null, 2)}\n`);
await fs.writeFile(new URL('../data/seed5-build-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.counts, null, 2));
