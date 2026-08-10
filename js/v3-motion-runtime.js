/**
 * Vocabulary Index 4.7 semantic-motion primitives.
 *
 * DOM-free by design. The UI adapter supplies real flow-anchor geometry and
 * consumes the resulting semantic/physical positions. This keeps motion math
 * testable without coupling it to WebKit layout state.
 */

export const ALPHABET_KEYS = Object.freeze([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']);

export function alphabetOrdinal(letter) {
  const index = ALPHABET_KEYS.indexOf(String(letter || '').toUpperCase());
  return index >= 0 ? index : -1;
}

export function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  return (progress) => {
    const x = clamp01(progress);
    if (x === 0 || x === 1) return x;
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const error = sampleX(t) - x;
      const slope = sampleDerivativeX(t);
      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
      t -= error / slope;
      if (t < 0 || t > 1) break;
    }
    if (t < 0 || t > 1 || Math.abs(sampleX(t) - x) > 1e-4) {
      let low = 0;
      let high = 1;
      t = x;
      for (let i = 0; i < 12; i += 1) {
        const value = sampleX(t);
        if (Math.abs(value - x) < 1e-6) break;
        if (value < x) low = t;
        else high = t;
        t = (low + high) / 2;
      }
    }
    return sampleY(Math.max(0, Math.min(1, t)));
  };
}

// iOS-style decisive acceleration with a long soft landing. These are product
// motion tokens, not claims about private UIKit constants.
export const MOTION_EASE = Object.freeze({
  scroll: cubicBezier(0.20, 0.72, 0.20, 1.00),
  page: cubicBezier(0.22, 0.74, 0.20, 1.00),
  sibling: cubicBezier(0.22, 0.68, 0.24, 1.00),
  reindex: cubicBezier(0.20, 0.70, 0.18, 1.00),
  home: cubicBezier(0.24, 0.74, 0.22, 1.00),
});

function normalizedKnots(knots = []) {
  const result = knots
    .map((item) => ({ semantic: Number(item?.semantic), physical: Number(item?.physical), key: item?.key || '' }))
    .filter((item) => Number.isFinite(item.semantic) && Number.isFinite(item.physical))
    .sort((a, b) => a.semantic - b.semantic || a.physical - b.physical);
  const unique = [];
  for (const item of result) {
    const previous = unique.at(-1);
    if (previous && Math.abs(previous.semantic - item.semantic) < 1e-9) {
      previous.physical = item.physical;
      previous.key = item.key;
    } else unique.push(item);
  }
  return unique;
}

export function createSemanticAxis(knots = []) {
  const points = normalizedKnots(knots);
  return { points };
}

function interpolate(a, b, ratio) {
  return a + (b - a) * ratio;
}

export function semanticAtPhysical(axis, physical) {
  const points = axis?.points || [];
  const value = Number(physical);
  if (!points.length || !Number.isFinite(value)) return Number.NaN;
  if (points.length === 1) return points[0].semantic;
  if (value <= points[0].physical) return points[0].semantic;
  if (value >= points.at(-1).physical) return points.at(-1).semantic;
  let low = 0;
  let high = points.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (points[mid].physical <= value) low = mid;
    else high = mid;
  }
  const a = points[low];
  const b = points[high];
  const span = b.physical - a.physical;
  if (Math.abs(span) < 1e-9) return b.semantic;
  return interpolate(a.semantic, b.semantic, (value - a.physical) / span);
}

export function physicalAtSemantic(axis, semantic) {
  const points = axis?.points || [];
  const value = Number(semantic);
  if (!points.length || !Number.isFinite(value)) return Number.NaN;
  if (points.length === 1) return points[0].physical;
  if (value <= points[0].semantic) return points[0].physical;
  if (value >= points.at(-1).semantic) return points.at(-1).physical;
  let low = 0;
  let high = points.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (points[mid].semantic <= value) low = mid;
    else high = mid;
  }
  const a = points[low];
  const b = points[high];
  const span = b.semantic - a.semantic;
  if (Math.abs(span) < 1e-9) return b.physical;
  return interpolate(a.physical, b.physical, (value - a.semantic) / span);
}

export function semanticScrollDuration(logicalDistance, _pixelDistance = 0) {
  const logical = Math.max(0, Math.abs(Number(logicalDistance || 0)));
  if (logical < 0.015) return 0;
  // Alphabet motion time is semantic, not pixel-based. The same logical span
  // receives the same duration even when relationship expansion makes one
  // physical letter interval tens of times taller than another. Physical speed
  // is therefore the adaptive variable; semantic percentage/time stays stable.
  const semanticBudget = 178 + 82 * Math.sqrt(Math.max(0.18, logical));
  return Math.round(Math.max(180, Math.min(640, semanticBudget)));
}

export function physicalScrollDuration(pixelDistance = 0) {
  const pixels = Math.max(0, Math.abs(Number(pixelDistance || 0)));
  if (pixels < 2) return 0;
  return Math.round(Math.max(170, Math.min(500, 168 + Math.log1p(pixels / 420) * 92)));
}

export function letterRailFocusRatio(semanticVelocity = 0) {
  // Positive motion leaves slightly more room in the forward (right) direction;
  // negative motion mirrors it. The bias is continuous rather than first/second
  // cell guard logic.
  const velocity = Math.max(-8, Math.min(8, Number(semanticVelocity || 0)));
  return Math.max(0.36, Math.min(0.64, 0.5 - velocity * 0.018));
}

export function cameraTargetForLocus({ locusCenter, viewportWidth, scrollWidth, semanticVelocity = 0 }) {
  const width = Math.max(0, Number(viewportWidth || 0));
  const content = Math.max(width, Number(scrollWidth || 0));
  if (!width) return 0;
  const focus = letterRailFocusRatio(semanticVelocity);
  const desired = Number(locusCenter || 0) - width * focus;
  return Math.max(0, Math.min(Math.max(0, content - width), desired));
}

export function exponentialApproach(current, target, deltaMs, timeConstantMs = 70) {
  const dt = Math.max(0, Number(deltaMs || 0));
  const tau = Math.max(1, Number(timeConstantMs || 70));
  const alpha = 1 - Math.exp(-dt / tau);
  return Number(current || 0) + (Number(target || 0) - Number(current || 0)) * alpha;
}
