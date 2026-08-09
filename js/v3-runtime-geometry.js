/**
 * Compute the root scroll target for collapsing a native Sticky section.
 * All inputs are real measured browser geometry. No parent border/padding
 * constant is inferred here; flowTop must come from an in-flow sentinel.
 */
export function computeStickyCollapseTarget({
  currentY,
  flowTop,
  visualTop,
  bodyHeight,
  scrollHeight,
  clientHeight,
}) {
  const numbers = [currentY, flowTop, visualTop, bodyHeight, scrollHeight, clientHeight].map(Number);
  if (!numbers.every(Number.isFinite)) return null;
  const [y, flow, visual, body, height, viewport] = numbers;
  const safeCurrentY = Math.max(0, y);
  const rawTargetY = safeCurrentY + flow - visual;
  const postCollapseMaxY = Math.max(0, height - Math.max(0, body) - Math.max(0, viewport));
  const targetY = Math.max(0, Math.min(rawTargetY, postCollapseMaxY));
  return {
    currentY: safeCurrentY,
    targetY,
    delta: targetY - safeCurrentY,
    postCollapseMaxY,
  };
}
