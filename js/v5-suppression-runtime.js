// @ts-check

/**
 * Runtime-only logical suppression. Persistent VIX facts never enter this
 * object, and no method writes IndexedDB, history or backups.
 */
export class SuppressionRuntime {
  constructor() {
    /** @type {Map<string, Map<string, Set<string>>>} */
    this.channels = new Map();
    this.revision = 0;
  }

  /** @param {string} channel @param {string} reason @param {Iterable<string>} ids */
  replace(channel, reason, ids) {
    const normalizedChannel = String(channel || '').trim();
    const normalizedReason = String(reason || '').trim();
    if (!normalizedChannel || !normalizedReason) throw new Error('Suppression channel/reason 不能为空');
    const next = new Set([...ids].map((id) => String(id || '').trim()).filter(Boolean));
    const reasons = this.channels.get(normalizedChannel) || new Map();
    const previous = reasons.get(normalizedReason) || new Set();
    if (setsEqual(previous, next)) return this.revision;
    if (next.size) reasons.set(normalizedReason, next);
    else reasons.delete(normalizedReason);
    if (reasons.size) this.channels.set(normalizedChannel, reasons);
    else this.channels.delete(normalizedChannel);
    this.revision += 1;
    return this.revision;
  }

  /** @param {string} channel @param {string} reason */
  clear(channel, reason) {
    return this.replace(channel, reason, []);
  }

  /** @param {string} id @param {string} [channel] */
  suppressed(id, channel = 'entry') {
    const reasons = this.channels.get(channel);
    if (!reasons) return false;
    for (const ids of reasons.values()) if (ids.has(id)) return true;
    return false;
  }

  /** @param {string} [channel] */
  suppressedIds(channel = 'entry') {
    const result = new Set();
    for (const ids of this.channels.get(channel)?.values() || []) for (const id of ids) result.add(id);
    return result;
  }

  snapshot() {
    return {
      revision: this.revision,
      channels: Object.fromEntries([...this.channels].map(([channel, reasons]) => [
        channel,
        Object.fromEntries([...reasons].map(([reason, ids]) => [reason, [...ids].sort()])),
      ])),
    };
  }
}

/** @param {Set<string>} left @param {Set<string>} right */
function setsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const item of left) if (!right.has(item)) return false;
  return true;
}

/**
 * Preserve every Structural collection key while filtering its visible Entry
 * list. This is deliberately separate from buildProjection().
 * @param {Map<string, any[]>} structuralProjection
 * @param {SuppressionRuntime} runtime
 */
export function deriveEffectiveProjection(structuralProjection, runtime) {
  return new Map([...structuralProjection].map(([collectionId, entries]) => [
    collectionId,
    entries.filter((entry) => !runtime.suppressed(entry.id, 'entry')),
  ]));
}

/**
 * Mirror keeps an allow-list; logical suppression stores the complement so
 * additional future reasons retain OR semantics.
 * @param {SuppressionRuntime} runtime
 * @param {Iterable<string>} structuralEntryIds
 * @param {Iterable<string> | null} allowedEntryIds
 */
export function setMirrorSuppression(runtime, structuralEntryIds, allowedEntryIds) {
  if (allowedEntryIds == null) return runtime.clear('entry', 'mirror-background');
  const allowed = new Set(allowedEntryIds);
  return runtime.replace('entry', 'mirror-background', [...structuralEntryIds].filter((id) => !allowed.has(id)));
}
