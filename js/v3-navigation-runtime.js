/** Pure helpers for the 4.5.0 VIX logical-stack / browser-rail split. */
export function classifyNavigationKey({ destinationKey, rootKey, frames, deadKeys, currentDepth }) {
  const key = String(destinationKey || '');
  const root = String(rootKey || '');
  const dead = deadKeys instanceof Set ? deadKeys : new Set(deadKeys || []);
  if (!key) return { kind: 'foreign', key, targetDepth: -1 };
  if (key === root) return { kind: currentDepth > 0 ? 'root' : 'same-root', key, targetDepth: 0 };
  if (dead.has(key)) return { kind: 'dead', key, targetDepth: -1 };
  const index = (frames || []).findIndex((frame) => String(frame?.browserKey || '') === key);
  if (index < 0) return { kind: 'foreign', key, targetDepth: -1 };
  const targetDepth = index + 1;
  if (targetDepth < currentDepth) return { kind: 'back', key, targetDepth };
  if (targetDepth === currentDepth) return { kind: 'same', key, targetDepth };
  return { kind: 'forward', key, targetDepth };
}

export function parentBrowserKey({ rootKey, frames, currentDepth }) {
  const depth = Math.max(0, Number(currentDepth || 0));
  if (depth <= 0) return '';
  if (depth === 1) return String(rootKey || '');
  return String(frames?.[depth - 2]?.browserKey || '');
}

export function planCommittedTraversal({ destinationKey, rootKey, frames, deadKeys, currentDepth }) {
  const classification = classifyNavigationKey({ destinationKey, rootKey, frames, deadKeys, currentDepth });
  if (classification.kind === 'root') {
    return {
      accepted: true,
      kind: 'root',
      keepDepth: 0,
      removedKeys: (frames || []).map((frame) => String(frame?.browserKey || '')).filter(Boolean),
    };
  }
  if (classification.kind === 'back' || classification.kind === 'same') {
    const keepDepth = classification.targetDepth;
    return {
      accepted: true,
      kind: classification.kind,
      keepDepth,
      removedKeys: (frames || []).slice(keepDepth).map((frame) => String(frame?.browserKey || '')).filter(Boolean),
    };
  }
  return { accepted: false, kind: classification.kind, keepDepth: currentDepth, removedKeys: [] };
}
