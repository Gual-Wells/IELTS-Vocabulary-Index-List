import {
  canonicalizeBackup, normalizeDisplayText, normalizeEnglish,
  normalizeGlossHant, parseLegacySourceLine,
} from './v3-model.js';
import { isVixContentPackage, normalizeVixPackage } from './v3-exchange.js';

export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;

function mergeRows(rows) {
  const byText = new Map();
  for (const row of rows) {
    const text = normalizeDisplayText(row?.text || row?.word || row?.w || '');
    const normalized = normalizeEnglish(text);
    if (!normalized) continue;
    const current = byText.get(normalized);
    const sourceLabel = normalizeDisplayText(row?.sourceLabel || row?.pos || row?.d || '');
    const gloss = normalizeDisplayText(row?.glossHant || row?.gloss || '');
    if (!current) {
      byText.set(normalized, { text, sourceLabel, gloss });
      continue;
    }
    const labels = new Set(`${current.sourceLabel},${sourceLabel}`.split(',').map((item) => normalizeDisplayText(item)).filter(Boolean));
    current.sourceLabel = [...labels].join(', ');
    if (!current.gloss && gloss) current.gloss = gloss;
  }
  return [...byText.values()];
}

export function parseTextList(text) {
  const rows = [];
  const errors = [];
  String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || /^#{1,6}\s/.test(trimmed)) return;
    const parsed = parseLegacySourceLine(trimmed);
    if (!parsed?.text) errors.push({ line: index + 1, message: '缺少英文内容' });
    else rows.push(parsed);
  });
  return { entries: mergeRows(rows), errors };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (character !== '\r') field += character;
  }
  if (quoted) throw new Error('CSV 存在未闭合双引号');
  row.push(field);
  if (row.some((item) => item.length) || rows.length === 0) rows.push(row);
  return rows;
}

export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return { entries: [], errors: [] };
  const header = rows[0].map((item) => normalizeEnglish(item));
  const hasHeader = header.some((item) => ['text', 'word', 'sourcelabel', 'pos', 'gloss', 'glosshant'].includes(item));
  const indexes = hasHeader ? {
    text: Math.max(header.indexOf('text'), header.indexOf('word')),
    sourceLabel: Math.max(header.indexOf('sourcelabel'), header.indexOf('pos')),
    gloss: Math.max(header.indexOf('gloss'), header.indexOf('glosshant')),
  } : { text: 0, sourceLabel: 1, gloss: 2 };
  const entries = [];
  const errors = [];
  rows.slice(hasHeader ? 1 : 0).forEach((columns, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const textValue = normalizeDisplayText(columns[indexes.text] || '');
    if (!textValue) {
      if (columns.some((item) => normalizeDisplayText(item))) errors.push({ line, message: '缺少英文内容' });
      return;
    }
    entries.push({
      text: textValue,
      sourceLabel: indexes.sourceLabel >= 0 ? normalizeDisplayText(columns[indexes.sourceLabel] || '') : '',
      gloss: indexes.gloss >= 0 ? normalizeDisplayText(columns[indexes.gloss] || '') : '',
    });
  });
  return { entries: mergeRows(entries), errors };
}

export function parseJsonContent(text) {
  let parsed;
  try { parsed = JSON.parse(String(text || '')); } catch (error) { throw new Error(`JSON 解析失败：${error.message}`); }
  if (Array.isArray(parsed)) {
    const entries = parsed.map((item) => ({
      text: item?.text || item?.word || item?.w || '',
      sourceLabel: Array.isArray(item?.pos) ? item.pos.join(', ') : (item?.sourceLabel || item?.pos || item?.d || ''),
      gloss: item?.glossHant || item?.gloss || '',
    }));
    return { kind: 'entries', entries: mergeRows(entries), errors: [] };
  }
  if (parsed && typeof parsed === 'object') {
    if (isVixContentPackage(parsed)) return { kind: 'content-package', package: normalizeVixPackage(parsed), errors: [] };
    if (Number(parsed.schemaVersion) === 6 && Array.isArray(parsed.domains)) {
      return { kind: 'backup', backup: canonicalizeBackup(parsed), errors: [] };
    }
    if (Number(parsed.schemaVersion) && Number(parsed.schemaVersion) !== 6) {
      throw new Error('完整备份版本不兼容；4.2.0 仅接受 Schema 6 完整备份');
    }
    if (Array.isArray(parsed.categories) || Array.isArray(parsed.domains)) {
      throw new Error('旧世代完整备份不兼容 4.2.0；请使用对应旧版本回滚');
    }
  }
  throw new Error('JSON 既不是内容数组、VIX 内容文件，也不是受支持的完整备份');
}

export function parseImportContent(content, filename = '') {
  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.json')) return parseJsonContent(content);
  if (name.endsWith('.csv')) return { kind: 'entries', ...parseCsv(content) };
  return { kind: 'entries', ...parseTextList(content) };
}

export async function readImportFile(file) {
  if (!file) throw new Error('未选择文件');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('导入文件超过 64 MB 上限');
  return parseImportContent(await file.text(), file.name);
}

function quoteCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function entriesToCsv(entries, memberships = []) {
  const membershipByEntry = new Map(memberships.map((item) => [item.entryId, item]));
  const lines = ['text,sourceLabel,gloss'];
  for (const entry of entries) {
    const membership = membershipByEntry.get(entry.id);
    lines.push([entry.text, membership?.sourceLabel || '', entry.glossHant || ''].map(quoteCsv).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function prepareGlossPreview(entries) {
  return entries.map((entry) => ({ ...entry, glossHant: normalizeGlossHant(entry.gloss || entry.glossHant || '') }));
}

export function downloadText(filename, content, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
