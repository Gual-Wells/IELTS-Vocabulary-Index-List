import assert from 'node:assert/strict';
import { computeStickyCollapseTarget } from '../js/v3-runtime-geometry.js';
import { classifyNavigationKey, parentBrowserKey, planCommittedTraversal } from '../js/v3-navigation-runtime.js';
import { clampRootScrollTarget, createScrollCoordinator, geometryIsStable, semanticAnchorError } from '../js/v3-scroll-runtime.js';


// 4.6 ScrollCoordinator: newest semantic intent owns the root viewport; stale epochs are rejected.
const scroll = createScrollCoordinator();
const letter = scroll.begin('letter-jump', { kind: 'section', sectionId: 'letter-X' });
assert.equal(scroll.owns(letter.epoch), true);
const back = scroll.begin('back-restore', { kind: 'entry', entryId: '4995' });
assert.equal(scroll.owns(letter.epoch), false);
assert.equal(scroll.owns(back.epoch), true);
assert.equal(scroll.setPhase(back.epoch, 'verify'), true);
assert.equal(scroll.current().phase, 'verify');
assert.equal(scroll.finish(back.epoch), true);
assert.equal(scroll.isActive(), false);
assert.equal(clampRootScrollTarget(900, 1000, 300), 700);
assert.equal(clampRootScrollTarget(-10, 1000, 300), 0);
assert.equal(semanticAnchorError(120, 104), 16);
assert.equal(geometryIsStable([50, 50.3], 0.5), true);
assert.equal(geometryIsStable([50, 51], 0.5), false);

// Sticky 4.4 behavior is frozen: direct flow geometry stays independent of parent border.
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

// 4.6 keeps 4.5 navigation: browser key is rail identity; logical depth is only stack position.
const rootKey = 'root-key';
const frames = [
  { token: 'A', browserKey: 'key-A' },
  { token: 'B', browserKey: 'key-B' },
  { token: 'C', browserKey: 'key-C' },
];
const classify = (destinationKey, currentDepth = 3, frameSet = frames, deadKeys = new Set()) => classifyNavigationKey({
  destinationKey, rootKey, frames: frameSet, deadKeys, currentDepth,
});

assert.deepEqual(classify('key-B'), { kind: 'back', key: 'key-B', targetDepth: 2 });
assert.deepEqual(classify(rootKey), { kind: 'root', key: rootKey, targetDepth: 0 });
assert.equal(classify('key-C', 2).kind, 'forward');
assert.equal(classify('key-C', 2, frames.slice(0, 2), new Set(['key-C'])).kind, 'dead');
assert.equal(classify('unknown').kind, 'foreign');
assert.equal(classify('').kind, 'foreign');
assert.equal(parentBrowserKey({ rootKey, frames, currentDepth: 3 }), 'key-B');
assert.equal(parentBrowserKey({ rootKey, frames, currentDepth: 2 }), 'key-A');
assert.equal(parentBrowserKey({ rootKey, frames, currentDepth: 1 }), rootKey);
assert.equal(parentBrowserKey({ rootKey, frames, currentDepth: 0 }), '');

// Destructive POP model: after C -> B, C is no longer live and must classify dead.
const liveAfterPop = frames.slice(0, 2);
const deadAfterPop = new Set(['key-C']);
assert.equal(classifyNavigationKey({ destinationKey: 'key-C', rootKey, frames: liveAfterPop, deadKeys: deadAfterPop, currentDepth: 2 }).kind, 'dead');
assert.equal(classifyNavigationKey({ destinationKey: 'key-A', rootKey, frames: liveAfterPop, deadKeys: deadAfterPop, currentDepth: 2 }).kind, 'back');

// Home commit clears logical frames but leaves old slots as dead Forward until fresh PUSH truncates them.
const deadAfterHome = new Set(frames.map((frame) => frame.browserKey));
assert.equal(classifyNavigationKey({ destinationKey: 'key-A', rootKey, frames: [], deadKeys: deadAfterHome, currentDepth: 0 }).kind, 'dead');
assert.equal(classifyNavigationKey({ destinationKey: rootKey, rootKey, frames: [], deadKeys: deadAfterHome, currentDepth: 0 }).kind, 'same-root');


const popPlan = planCommittedTraversal({ destinationKey: 'key-B', rootKey, frames, deadKeys: new Set(), currentDepth: 3 });
assert.deepEqual(popPlan, { accepted: true, kind: 'back', keepDepth: 2, removedKeys: ['key-C'] });
const homePlan = planCommittedTraversal({ destinationKey: rootKey, rootKey, frames, deadKeys: new Set(), currentDepth: 3 });
assert.deepEqual(homePlan, { accepted: true, kind: 'root', keepDepth: 0, removedKeys: ['key-A', 'key-B', 'key-C'] });
const rejectDead = planCommittedTraversal({ destinationKey: 'key-C', rootKey, frames: frames.slice(0, 2), deadKeys: new Set(['key-C']), currentDepth: 2 });
assert.equal(rejectDead.accepted, false);
assert.equal(rejectDead.kind, 'dead');

console.log('runtime-behavior-tests: OK');
