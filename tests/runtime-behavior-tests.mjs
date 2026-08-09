import assert from 'node:assert/strict';
import { computeStickyCollapseTarget } from '../js/v3-runtime-geometry.js';
import { classifyNavigationDestination } from '../js/v3-navigation-runtime.js';

// Sticky: direct flow geometry is stable regardless of a parent's 1px/2px border.
const long = computeStickyCollapseTarget({
  currentY: 3200, flowTop: -2500, visualTop: 104, bodyHeight: 3000, scrollHeight: 9000, clientHeight: 800,
});
assert.equal(long.targetY, 596);
assert.equal(long.delta, -2604);
const noDelta = computeStickyCollapseTarget({
  currentY: 596, flowTop: 104, visualTop: 104, bodyHeight: 3000, scrollHeight: 6400, clientHeight: 800,
});
assert.equal(noDelta.delta, 0);
const bottomClamp = computeStickyCollapseTarget({
  currentY: 5100, flowTop: 50, visualTop: 100, bodyHeight: 2500, scrollHeight: 6000, clientHeight: 800,
});
assert.equal(bottomClamp.targetY, 2700);
assert.equal(bottomClamp.postCollapseMaxY, 2700);
assert.equal(computeStickyCollapseTarget({ currentY: NaN, flowTop: 0, visualTop: 0, bodyHeight: 1, scrollHeight: 2, clientHeight: 1 }), null);

// Navigation: token/generation are identity; depth metadata is diagnostic only.
const navModel = 'destructive-v2';
const generation = 44;
const rootToken = 'root-r';
const frames = [{ token: 'A' }, { token: 'B' }, { token: 'C' }];
const discarded = new Set();
const classify = (targetState, currentDepth = 3, frameSet = frames, discardedTokens = discarded) => classifyNavigationDestination({
  targetState, frames: frameSet, discardedTokens, currentDepth, generation, rootToken, navModel,
});
const B = classify({ vix: true, navModel, generation, navToken: 'B', routeKind: 'page', depth: 999 });
assert.equal(B.kind, 'back');
assert.equal(B.targetDepth, 2);
const root = classify({ vix: true, navModel, generation, navToken: rootToken, routeKind: 'root', depth: 77 });
assert.equal(root.kind, 'back-root');
const wrongGeneration = classify({ vix: true, navModel, generation: 43, navToken: 'B', routeKind: 'page' });
assert.equal(wrongGeneration.kind, 'stale');
const forward = classify({ vix: true, navModel, generation, navToken: 'C', routeKind: 'page' }, 2);
assert.equal(forward.kind, 'forward');
const deadC = classify({ vix: true, navModel, generation, navToken: 'C', routeKind: 'page' }, 2, [{ token: 'A' }, { token: 'B' }], new Set(['C']));
assert.equal(deadC.kind, 'stale');
const wrongRoot = classify({ vix: true, navModel, generation, navToken: 'old-root', routeKind: 'root' });
assert.equal(wrongRoot.kind, 'stale');

console.log('runtime-behavior-tests: OK');
