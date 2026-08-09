/** Pure classifier for the destructive VIX navigation stack. */
export function classifyNavigationDestination({
  targetState,
  frames,
  discardedTokens,
  currentDepth,
  generation,
  rootToken,
  navModel,
}) {
  const state = targetState || {};
  const discarded = discardedTokens instanceof Set ? discardedTokens : new Set(discardedTokens || []);
  const token = String(state.navToken || '');
  if (state.vix !== true || state.navModel !== navModel || Number(state.generation || 0) !== Number(generation) || !token) {
    return { kind: 'stale', token, targetDepth: -1 };
  }
  if (state.routeKind === 'root') {
    return token === rootToken
      ? { kind: currentDepth > 0 ? 'back-root' : 'same-root', token, targetDepth: 0 }
      : { kind: 'stale', token, targetDepth: -1 };
  }
  if (discarded.has(token)) return { kind: 'stale', token, targetDepth: -1 };
  const index = (frames || []).findIndex((frame) => frame?.token === token);
  if (index < 0) return { kind: 'stale', token, targetDepth: -1 };
  const targetDepth = index + 1;
  if (targetDepth > currentDepth) return { kind: 'forward', token, targetDepth };
  if (targetDepth === currentDepth) return { kind: 'same', token, targetDepth };
  return { kind: 'back', token, targetDepth };
}
