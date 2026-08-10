import assert from 'node:assert/strict';
import { computeStickyCollapseTarget } from '../js/v3-runtime-geometry.js';
import { clampRootScrollTarget, createScrollCoordinator, geometryIsStable, semanticAnchorError } from '../js/v3-scroll-runtime.js';
import {
  alphabetOrdinal, cameraTargetForLocus, createSemanticAxis, exponentialApproach,
  letterRailFocusRatio, MOTION_EASE, physicalAtSemantic, physicalScrollDuration,
  semanticAtPhysical, semanticScrollDuration,
} from '../js/v3-motion-runtime.js';

// Scroll ownership remains newest-intent-wins.
const scroll = createScrollCoordinator();
const letter = scroll.begin('letter-jump', { kind: 'section', sectionId: 'letter-X' });
assert.equal(scroll.owns(letter.epoch), true);
const back = scroll.begin('back-restore', { kind: 'entry', entryId: '4995' });
assert.equal(scroll.owns(letter.epoch), false);
assert.equal(scroll.owns(back.epoch), true);
assert.equal(scroll.setPhase(back.epoch, 'verify'), true);
assert.equal(scroll.finish(back.epoch), true);
assert.equal(scroll.isActive(), false);
assert.equal(clampRootScrollTarget(900, 1000, 300), 700);
assert.equal(clampRootScrollTarget(-10, 1000, 300), 0);
assert.equal(semanticAnchorError(120, 104), 16);
assert.equal(geometryIsStable([50, 50.3], 0.5), true);
assert.equal(geometryIsStable([50, 51], 0.5), false);

// Sticky 4.4 behavior is frozen.
const long = computeStickyCollapseTarget({ currentY: 3200, flowTop: -2500, visualTop: 104, bodyHeight: 3000, scrollHeight: 9000, clientHeight: 800 });
assert.equal(long.targetY, 596);
assert.equal(long.delta, -2604);
const noDelta = computeStickyCollapseTarget({ currentY: 596, flowTop: 104, visualTop: 104, bodyHeight: 3000, scrollHeight: 6400, clientHeight: 800 });
assert.equal(noDelta.delta, 0);
const bottomClamp = computeStickyCollapseTarget({ currentY: 5100, flowTop: 50, visualTop: 100, bodyHeight: 2500, scrollHeight: 6000, clientHeight: 800 });
assert.equal(bottomClamp.targetY, 2700);

// Uneven physical section heights map to equal logical alphabet units.
const uneven = createSemanticAxis([
  { key: 'A', semantic: alphabetOrdinal('A'), physical: 100 },
  { key: 'B', semantic: alphabetOrdinal('B'), physical: 3900 },
  { key: 'C', semantic: alphabetOrdinal('C'), physical: 4020 },
  { key: 'D', semantic: alphabetOrdinal('D'), physical: 8120 },
]);
assert.equal(semanticAtPhysical(uneven, 2000), 0.5); // midpoint A-B despite 3800px span
assert.equal(semanticAtPhysical(uneven, 3960), 1.5); // midpoint B-C despite 120px span
assert.equal(physicalAtSemantic(uneven, 0.5), 2000);
assert.equal(physicalAtSemantic(uneven, 1.5), 3960);
for (const y of [100, 888, 2000, 3900, 3960, 4020, 5500, 8120]) {
  const roundTrip = physicalAtSemantic(uneven, semanticAtPhysical(uneven, y));
  assert.ok(Math.abs(roundTrip - y) < 1e-6, `semantic round-trip failed at ${y}`);
}

// Missing Q keeps alphabet ordinal distance: P -> R spans two semantic units.
assert.equal(alphabetOrdinal('P'), 15);
assert.equal(alphabetOrdinal('R'), 17);
const missingQ = createSemanticAxis([{ key: 'P', semantic: 15, physical: 0 }, { key: 'R', semantic: 17, physical: 1000 }]);
assert.equal(semanticAtPhysical(missingQ, 500), 16);
assert.equal(physicalAtSemantic(missingQ, 16), 500);

// Motion is bounded, non-linear, and logical distance dominates section pixel height.
assert.equal(semanticScrollDuration(0, 0), 0);
const oneLetterShort = semanticScrollDuration(1, 120);
const oneLetterTall = semanticScrollDuration(1, 3800);
assert.ok(oneLetterShort >= 180 && oneLetterTall <= 640);
assert.equal(oneLetterTall, oneLetterShort, 'same logical letter gap must have identical time budget regardless of physical height');
assert.ok(semanticScrollDuration(20, 20000) <= 640);
assert.ok(physicalScrollDuration(100000) <= 500);
assert.equal(MOTION_EASE.scroll(0), 0);
assert.equal(MOTION_EASE.scroll(1), 1);
assert.ok(MOTION_EASE.scroll(0.5) > 0.5, 'scroll curve should accelerate decisively then soften');

// Dynamic LetterRail camera is continuous and direction-aware, not first/second-cell guards.
assert.ok(letterRailFocusRatio(4) < 0.5);
assert.ok(letterRailFocusRatio(-4) > 0.5);
const centerTarget = cameraTargetForLocus({ locusCenter: 700, viewportWidth: 300, scrollWidth: 1400, semanticVelocity: 0 });
assert.equal(centerTarget, 550);
const approached = exponentialApproach(0, 100, 16, 70);
assert.ok(approached > 0 && approached < 100);
assert.ok(exponentialApproach(approached, 100, 16, 70) > approached);

console.log('runtime-behavior-tests: OK');
