/**
 * Vocabulary Index 4.6 root-scroll coordination primitives.
 *
 * This module is intentionally DOM-free. It owns only transaction identity and
 * small geometry helpers; v3-ui.js remains the adapter that reads DOM geometry
 * and performs the one permitted root viewport write.
 */

export function createScrollCoordinator() {
  let epoch = 0;
  let current = null;

  const clone = (state) => state ? { ...state, target: state.target ? { ...state.target } : null } : null;

  return {
    begin(owner, target = null) {
      epoch += 1;
      current = {
        epoch,
        owner: String(owner || 'unknown'),
        phase: 'prepare',
        target: target ? { ...target } : null,
        startedAt: Date.now(),
        cancelled: false,
      };
      return clone(current);
    },

    owns(candidateEpoch) {
      return Boolean(current && !current.cancelled && current.epoch === Number(candidateEpoch));
    },

    setPhase(candidateEpoch, phase) {
      if (!this.owns(candidateEpoch)) return false;
      current.phase = String(phase || 'prepare');
      return true;
    },

    updateTarget(candidateEpoch, target) {
      if (!this.owns(candidateEpoch)) return false;
      current.target = target ? { ...target } : null;
      return true;
    },

    finish(candidateEpoch) {
      if (!this.owns(candidateEpoch)) return false;
      current = null;
      return true;
    },

    cancel(reason = 'cancelled') {
      if (!current) return null;
      const cancelled = { ...current, cancelled: true, cancelReason: String(reason || 'cancelled') };
      current = null;
      return cancelled;
    },

    current() {
      return clone(current);
    },

    isActive() {
      return Boolean(current);
    },

    epoch() {
      return epoch;
    },
  };
}

export function clampRootScrollTarget(desiredY, scrollHeight, clientHeight) {
  const maxScroll = Math.max(0, Number(scrollHeight || 0) - Number(clientHeight || 0));
  const desired = Number.isFinite(Number(desiredY)) ? Number(desiredY) : 0;
  return Math.max(0, Math.min(maxScroll, desired));
}

export function semanticAnchorError(actualTop, desiredTop) {
  const actual = Number(actualTop);
  const desired = Number(desiredTop);
  if (!Number.isFinite(actual) || !Number.isFinite(desired)) return Number.POSITIVE_INFINITY;
  return actual - desired;
}

export function geometryIsStable(samples, tolerance = 0.5) {
  const values = (samples || []).map(Number).filter(Number.isFinite);
  if (values.length < 2) return false;
  const recent = values.slice(-2);
  return Math.abs(recent[1] - recent[0]) <= Math.max(0, Number(tolerance || 0));
}
