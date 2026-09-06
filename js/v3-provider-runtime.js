export class ProviderError extends Error {
  constructor(code, message, { status = 0, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function cancelledError() { return new ProviderError('cancelled', '查询已取消'); }

export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, time - now) : 0;
}

export function objectValue(value, field = 'result') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('invalid-response', `返回数据格式不正确：${field}`);
  return value;
}

export function textValue(value, field, { empty = false, max = 2000 } = {}) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new ProviderError('invalid-response', `返回数据格式不正确：${field}`);
  return value.trim();
}

export function arrayValue(value, field, max = 32) {
  if (!Array.isArray(value) || value.length > max) throw new ProviderError('invalid-response', `返回数据格式不正确：${field}`);
  return value;
}

export function createProviderSession(onState = (_state, _error = null) => {}) {
  const controller = new AbortController();
  let state = 'idle';
  let closed = false;
  const update = (next, error = null) => {
    if (closed) return;
    state = next;
    onState(next, error);
  };
  return {
    controller,
    get state() { return state; },
    async run(execute) {
      if (closed || state !== 'idle') throw cancelledError();
      try {
        update('requesting');
        const result = await execute(controller.signal, (next) => update(next));
        if (closed || controller.signal.aborted) throw cancelledError();
        update('ready');
        return result;
      } catch (error) {
        const failure = controller.signal.aborted ? cancelledError() : error;
        update(failure?.code === 'cancelled' ? 'cancelled' : failure?.code === 'not-found' ? 'empty' : 'error', failure);
        throw failure;
      }
    },
    cancel() {
      if (closed) return;
      controller.abort();
      update('cancelled');
      closed = true;
    },
    dispose() { controller.abort(); closed = true; onState = () => {}; },
  };
}
