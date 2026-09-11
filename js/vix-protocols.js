// Protocol lifecycles are deliberately independent from the VIX app release and
// from seed generations. Compatibility is negotiated by protocol + capability.
import { toTraditional } from './v3-model.js';

export const VIX_EXCHANGE_PROTOCOL = 'vix-data-exchange/1';
export const MIRROR_SERVICE_PROTOCOL = 'vix-mirror-service/1';
export const MIRROR_FILE_PROTOCOL = 'vix-mirror-file/1';
export const MIRROR_PICKER_MESSAGE = 'vix-mirror-selection';
export const MIRROR_PAIRING_MESSAGE = 'vix-mirror-pairing';

export const VIX_EXCHANGE_CAPABILITIES = Object.freeze([
  'snapshot.replace', 'increment.merge', 'domain-local-dedup', 'collection-priority-membership',
]);

export function createVixSnapshotEnvelope(backup) {
  const snapshot = structuredClone(backup);
  snapshot.annotations = [];
  snapshot.entries = (snapshot.entries || []).map((entry) => {
    const { glossHans = '', glossHant = '', glossSource: _glossSource, ...current } = entry;
    return { ...current, gloss: current.gloss || glossHant || (glossHans ? toTraditional(glossHans) : '') };
  });
  snapshot.memberships = (snapshot.memberships || []).map((membership) => {
    const next = { ...membership, order: Number(membership.sourceOrder || membership.order || 0) };
    delete next.sourceLabel;
    delete next.sourceOrder;
    return next;
  });
  snapshot.pins = (snapshot.pins || []).map(({ domainId: _domainId, ...pin }) => pin);
  if (snapshot.settings) {
    delete snapshot.settings.contentSources;
    delete snapshot.settings.annotationTask;
    delete snapshot.settings.verification;
    delete snapshot.settings.historyPointer;
    delete snapshot.settings.historySequence;
  }
  return {
    protocol: VIX_EXCHANGE_PROTOCOL,
    kind: 'snapshot',
    capabilities: VIX_EXCHANGE_CAPABILITIES,
    generatedAt: new Date().toISOString(),
    seedGeneration: Number(backup?.settings?.builtInSeedRevision || 0) || undefined,
    data: snapshot,
  };
}

export function createMirrorFile({ id = crypto.randomUUID(), title = '', layer1 = [], layer2 = [], context = {} } = {}) {
  return {
    protocol: MIRROR_FILE_PROTOCOL,
    documentId: id,
    createdAt: new Date().toISOString(),
    title: String(title || '').trim(),
    context,
    layers: { existing: layer1, candidates: layer2 },
  };
}

export function isMirrorFile(value) {
  return value?.protocol === MIRROR_FILE_PROTOCOL
    && value?.layers && Array.isArray(value.layers.existing) && Array.isArray(value.layers.candidates);
}
