import { POS_ORDER } from './constants.js';


const INVISIBLE_FORMAT = /[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu;
const UNSAFE_FORMAT = /[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

export function containsControlCharacters(value) {
  const text = String(value ?? '');
  return /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(text) || UNSAFE_FORMAT.test(text);
}

export function normalizeWord(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE_FORMAT, '')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}


export function normalizeCategoryName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE_FORMAT, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

export function groupForWord(word) {
  const normalized = normalizeWord(word);
  return /^[a-z]/.test(normalized) ? normalized[0].toUpperCase() : '#';
}

export function parsePos(value) {
  let source = String(value ?? '').trim().toLocaleLowerCase('en-US');
  if (!source) return [];
  const protectedTokens = new Map([
    ['modal v.', '__MODAL__'],
    ['auxiliary v.', '__AUX__'],
    ['infinitive marker', '__INF__'],
    ['indefinite article', '__ART__'],
    ['definite article', '__ART__'],
  ]);
  for (const [text, token] of protectedTokens) source = source.replaceAll(text, token);
  source = source.replaceAll('number', 'num.').replaceAll('/', ',');
  source = source
    .replaceAll('__MODAL__', 'modal v.')
    .replaceAll('__AUX__', 'auxiliary v.')
    .replaceAll('__INF__', 'infinitive marker')
    .replaceAll('__ART__', 'art.');

  const aliases = new Map([
    ['n', 'n.'], ['n.', 'n.'], ['noun', 'n.'],
    ['v', 'v.'], ['v.', 'v.'], ['verb', 'v.'],
    ['adj', 'adj.'], ['adj.', 'adj.'], ['adjective', 'adj.'],
    ['adv', 'adv.'], ['adv.', 'adv.'], ['adverb', 'adv.'],
    ['prep', 'prep.'], ['prep.', 'prep.'], ['preposition', 'prep.'],
    ['pron', 'pron.'], ['pron.', 'pron.'], ['pronoun', 'pron.'],
    ['conj', 'conj.'], ['conj.', 'conj.'], ['conjunction', 'conj.'],
    ['det', 'det.'], ['det.', 'det.'], ['determiner', 'det.'],
    ['art', 'art.'], ['art.', 'art.'], ['article', 'art.'],
    ['num', 'num.'], ['num.', 'num.'], ['number', 'num.'],
    ['int', 'exclam.'], ['int.', 'exclam.'], ['exclam', 'exclam.'], ['exclam.', 'exclam.'],
    ['modal v.', 'modal v.'], ['auxiliary v.', 'auxiliary v.'], ['infinitive marker', 'infinitive marker'],
  ]);

  const result = [];
  for (const rawPart of source.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const normalized = aliases.get(part);
    if (!normalized) throw new Error(`无法识别词性：${part}`);
    if (!result.includes(normalized)) result.push(normalized);
  }
  return sortPos(result);
}

export function sortPos(values) {
  return [...new Set(values)].sort((a, b) => {
    const ai = POS_ORDER.indexOf(a);
    const bi = POS_ORDER.indexOf(b);
    return (ai === -1 ? POS_ORDER.length : ai) - (bi === -1 ? POS_ORDER.length : bi) || a.localeCompare(b);
  });
}

export function formatPos(values) {
  return sortPos(Array.isArray(values) ? values : parsePos(values)).join(', ');
}

export function mergePos(...collections) {
  return sortPos(collections.flatMap((item) => Array.isArray(item) ? item : parsePos(item)));
}

export function uuid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  const random = Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function containsHan(value) {
  return /[\u3400-\u9fff\uf900-\ufaff]/u.test(String(value ?? ''));
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightText(text, query) {
  const fragment = document.createDocumentFragment();
  const source = String(text ?? '');
  const q = String(query ?? '').trim();
  if (!q) {
    fragment.append(document.createTextNode(source));
    return fragment;
  }
  const lower = source.toLocaleLowerCase('en-US');
  const needle = q.toLocaleLowerCase('en-US');
  const index = lower.indexOf(needle);
  if (index < 0) {
    fragment.append(document.createTextNode(source));
    return fragment;
  }
  fragment.append(document.createTextNode(source.slice(0, index)));
  const mark = document.createElement('mark');
  mark.textContent = source.slice(index, index + q.length);
  fragment.append(mark, document.createTextNode(source.slice(index + q.length)));
  return fragment;
}

export function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function deepClone(value) {
  return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function downloadText(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // iOS 主屏幕 PWA 可能在 click 之后异步接管下载，过早撤销会产生空文件或失败。
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function formatDateForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export async function copyText(text) {
  const value = String(text ?? '');
  if (navigator.clipboard && globalThis.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      console.warn('Clipboard API 失败，改用兼容复制路径。', error);
    }
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.className = 'clipboard-fallback';
  document.body.append(area);
  let success = false;
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    success = document.execCommand('copy');
  } finally {
    area.remove();
  }
  if (!success) throw new Error('复制失败');
}

export function approximateJsonSize(value) {
  try { return new Blob([JSON.stringify(value)]).size; }
  catch { return 0; }
}

export function fileExtension(filename) {
  const match = String(filename ?? '').toLocaleLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}
