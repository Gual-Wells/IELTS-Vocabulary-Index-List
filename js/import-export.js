import { fileExtension, formatPos, normalizeWord, parsePos } from './utils.js';

const POS_START = /\s+(indefinite article|definite article|infinitive marker|modal v\.|auxiliary v\.|(?:n|v|adj|adv|prep|pron|conj|det|art|num|int|exclam)\.?|number\b)/i;

function parseVocabularyLine(line, lineNumber) {
  const source = line.trim();
  if (!source) return null;
  const match = POS_START.exec(source);
  if (!match) return { error: `第 ${lineNumber} 行无法识别词性：${source}` };
  const word = source.slice(0, match.index).trim();
  const rawPos = source.slice(match.index).trim();
  if (!word) return { error: `第 ${lineNumber} 行缺少词汇` };
  try {
    return { word, pos: parsePos(rawPos), line: lineNumber };
  } catch (error) {
    return { error: `第 ${lineNumber} 行：${error.message}` };
  }
}

function deduplicateParsed(items) {
  const byWord = new Map();
  for (const item of items) {
    const key = normalizeWord(item.word);
    if (!key) continue;
    if (!byWord.has(key)) byWord.set(key, { ...item, normalizedWord: key, pos: [...item.pos] });
    else {
      const existing = byWord.get(key);
      existing.pos = parsePos(`${formatPos(existing.pos)}, ${formatPos(item.pos)}`);
    }
  }
  return [...byWord.values()];
}

export function parseMarkdownOrText(text) {
  const items = [];
  const errors = [];
  const headings = [];
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      headings.push(line.replace(/^#+\s*/, ''));
      return;
    }
    const parsed = parseVocabularyLine(line, lineNumber);
    if (!parsed) return;
    if (parsed.error) errors.push(parsed.error);
    else items.push(parsed);
  });
  return { entries: deduplicateParsed(items), errors, headings, format: headings.length ? 'markdown' : 'text' };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((value) => value.trim()));
  const errors = [];
  const items = [];
  if (!rows.length) return { entries: [], errors: ['CSV 文件为空'], headings: [], format: 'csv' };
  const first = rows[0].map((value) => value.trim().toLocaleLowerCase('en-US'));
  const hasHeader = first.some((value) => ['word', 'vocabulary', 'term', '词汇', '单词'].includes(value));
  const wordIndex = hasHeader ? Math.max(0, first.findIndex((value) => ['word', 'vocabulary', 'term', '词汇', '单词'].includes(value))) : 0;
  const posIndex = hasHeader ? first.findIndex((value) => ['pos', 'part of speech', '词性'].includes(value)) : 1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  dataRows.forEach((row, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const word = String(row[wordIndex] ?? '').trim();
    const rawPos = String(row[posIndex] ?? '').trim();
    if (!word && !rawPos) return;
    if (!word || !rawPos) { errors.push(`第 ${line} 行缺少词汇或词性`); return; }
    try { items.push({ word, pos: parsePos(rawPos), line }); }
    catch (error) { errors.push(`第 ${line} 行：${error.message}`); }
  });
  return { entries: deduplicateParsed(items), errors, headings: [], format: 'csv' };
}

function parseJsonVocabulary(value) {
  if (Array.isArray(value)) {
    const errors = [];
    const entries = [];
    value.forEach((item, index) => {
      const word = typeof item === 'string' ? '' : String(item?.word ?? item?.w ?? '').trim();
      const rawPos = typeof item === 'string' ? '' : item?.pos ?? item?.d ?? '';
      if (!word) { errors.push(`JSON 第 ${index + 1} 项缺少 word`); return; }
      try { entries.push({ word, pos: Array.isArray(rawPos) ? parsePos(rawPos.join(', ')) : parsePos(rawPos), line: index + 1 }); }
      catch (error) { errors.push(`JSON 第 ${index + 1} 项：${error.message}`); }
    });
    return { entries: deduplicateParsed(entries), errors, headings: [], format: 'json-list' };
  }
  if (value && Array.isArray(value.entries) && Array.isArray(value.categories) && Number(value.schemaVersion) >= 1) {
    return { backup: value, entries: [], errors: [], headings: [], format: 'backup' };
  }
  if (value && Array.isArray(value.entries)) return parseJsonVocabulary(value.entries);
  return { entries: [], errors: ['JSON 既不是完整备份，也不是词汇数组'], headings: [], format: 'json' };
}

export function parseImportContent(filename, text) {
  const extension = fileExtension(filename);
  if (extension === 'json') {
    try { return parseJsonVocabulary(JSON.parse(text)); }
    catch (error) { return { entries: [], errors: [`JSON 解析失败：${error.message}`], headings: [], format: 'json' }; }
  }
  if (extension === 'csv') return parseCsv(text);
  return parseMarkdownOrText(text);
}

export function validateBackup(backup) {
  if (!backup || Number(backup.schemaVersion) !== 1) throw new Error('不支持的备份版本');
  if (!Array.isArray(backup.categories) || !Array.isArray(backup.entries)) throw new Error('备份缺少 categories 或 entries');
  const categoryIds = new Set(backup.categories.map((category) => category.id));
  const words = new Set();
  for (const category of backup.categories) {
    if (!category.id || !category.name || !Number.isFinite(Number(category.order))) throw new Error('备份包含无效词表');
  }
  for (const entry of backup.entries) {
    const normalized = normalizeWord(entry.word);
    if (!entry.id || !normalized || words.has(normalized)) throw new Error(`备份包含无效或重复词汇：${entry.word ?? ''}`);
    words.add(normalized);
    if (!categoryIds.has(entry.categoryId)) throw new Error(`词汇 ${entry.word} 指向不存在的词表`);
    parsePos(Array.isArray(entry.pos) ? entry.pos.join(', ') : entry.pos);
  }
  return true;
}

export function exportCategoryMarkdown(category, entries) {
  const groups = new Map();
  for (const entry of entries) {
    const letter = /^[A-Z]/.test(entry.word.toUpperCase()) ? entry.word[0].toUpperCase() : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(entry);
  }
  const lines = [`# ${category.name}`];
  for (const letter of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']) {
    const group = groups.get(letter);
    if (!group?.length) continue;
    lines.push(`## ${letter}`);
    for (const entry of group.sort((a, b) => a.normalizedWord.localeCompare(b.normalizedWord))) {
      lines.push(`${entry.word} ${formatPos(entry.pos)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function exportAllMarkdown(categories, entries) {
  return categories
    .sort((a, b) => a.order - b.order)
    .map((category) => exportCategoryMarkdown(category, entries.filter((entry) => entry.categoryId === category.id)).trimEnd())
    .join('\n\n');
}

export function exportCategoryCsv(entries) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = ['word,pos'];
  for (const entry of entries.sort((a, b) => a.normalizedWord.localeCompare(b.normalizedWord))) {
    lines.push(`${quote(entry.word)},${quote(formatPos(entry.pos))}`);
  }
  return `${lines.join('\r\n')}\r\n`;
}
