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
