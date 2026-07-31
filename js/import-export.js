import { MAX_CATEGORY_NAME_LENGTH, MAX_WORD_LENGTH } from './constants.js';
import { containsControlCharacters, deepClone, fileExtension, formatPos, groupForWord, mergePos, normalizeCategoryName, normalizeWord, parsePos, sortPos } from './utils.js';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const MAX_CATEGORIES = 1000;
const MAX_ENTRIES = 50000;
const MAX_LABEL_LENGTH = 120;
const MAX_REASON_LENGTH = 2000;
const FALLBACK_TIMESTAMP = '1970-01-01T00:00:00.000Z';

function assertSafeId(value, label) {
  const id = String(value ?? '').trim();
  if (!SAFE_ID.test(id)) throw new Error(`${label} ID 无效`);
  return id;
}

const POS_START = /\s+(indefinite article|definite article|infinitive marker|modal v\.|auxiliary v\.|(?:n|v|adj|adv|prep|pron|conj|det|art|num|int|exclam)\.?|number\b)/i;

function parseVocabularyLine(line, lineNumber) {
  const source = line.trim();
  if (!source) return null;
  const match = POS_START.exec(source);
  if (!match) return { error: `第 ${lineNumber} 行无法识别词性：${source}` };
  const word = source.slice(0, match.index).trim();
  const rawPos = source.slice(match.index).trim();
  if (!word) return { error: `第 ${lineNumber} 行缺少词汇` };
  if (containsControlCharacters(word)) return { error: `第 ${lineNumber} 行词汇包含控制字符` };
  if (word.length > MAX_WORD_LENGTH) return { error: `第 ${lineNumber} 行词汇超过 ${MAX_WORD_LENGTH} 个字符` };
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
    if (/^#{1,6}\s+/.test(line)) {
      headings.push(line.replace(/^#+\s+/, ''));
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
  return { rows, error: quoted ? 'CSV 存在未闭合的双引号' : null };
}

export function parseCsv(text) {
  const parsedRows = parseCsvRows(text);
  if (parsedRows.error) return { entries: [], errors: [parsedRows.error], headings: [], format: 'csv' };
  const rows = parsedRows.rows.filter((row) => row.some((value) => value.trim()));
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
    if (containsControlCharacters(word)) { errors.push(`第 ${line} 行词汇包含控制字符`); return; }
    if (word.length > MAX_WORD_LENGTH) { errors.push(`第 ${line} 行词汇超过 ${MAX_WORD_LENGTH} 个字符`); return; }
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
      if (containsControlCharacters(word)) { errors.push(`JSON 第 ${index + 1} 项词汇包含控制字符`); return; }
      if (word.length > MAX_WORD_LENGTH) { errors.push(`JSON 第 ${index + 1} 项词汇超过 ${MAX_WORD_LENGTH} 个字符`); return; }
      try {
        const pos = Array.isArray(rawPos) ? parsePos(rawPos.join(', ')) : parsePos(rawPos);
        if (!pos.length) throw new Error('词性不能为空');
        entries.push({ word, pos, line: index + 1 });
      } catch (error) { errors.push(`JSON 第 ${index + 1} 项：${error.message}`); }
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
  if (backup.categories.length > MAX_CATEGORIES) throw new Error(`备份词表数量超过上限 ${MAX_CATEGORIES}`);
  if (backup.entries.length > MAX_ENTRIES) throw new Error(`备份词条数量超过上限 ${MAX_ENTRIES}`);
  if (backup.pins != null && !Array.isArray(backup.pins)) throw new Error('备份 pins 必须是数组');
  if (backup.annotations != null && !Array.isArray(backup.annotations)) throw new Error('备份 annotations 必须是数组');
  if ((backup.pins?.length ?? 0) > MAX_ENTRIES) throw new Error('备份书签数量超过词条上限');
  if ((backup.annotations?.length ?? 0) > MAX_ENTRIES) throw new Error('备份 AI 标注数量超过词条上限');

  const categoryIds = new Set();
  const categoryNames = new Set();
  const categoryOrders = new Set();
  for (const category of backup.categories) {
    const id = assertSafeId(category?.id, '词表');
    const name = String(category?.name ?? '').trim();
    const label = String(category?.label ?? name).trim();
    const order = Number(category?.order);
    if (!name || containsControlCharacters(name) || name.length > MAX_CATEGORY_NAME_LENGTH
        || !label || containsControlCharacters(label) || label.length > MAX_LABEL_LENGTH
        || !Number.isInteger(order) || order < 0) throw new Error('备份包含无效词表');
    const normalizedName = normalizeCategoryName(name);
    if (categoryIds.has(id) || categoryNames.has(normalizedName) || categoryOrders.has(order)) {
      throw new Error(`备份包含重复词表 ID、名称或顺序：${name}`);
    }
    categoryIds.add(id);
    categoryNames.add(normalizedName);
    categoryOrders.add(order);
  }
  if (!categoryIds.size) throw new Error('备份至少需要一个词表');

  const orderMap = new Map(
    [...backup.categories].sort((a, b) => Number(a.order) - Number(b.order)).map((category, index) => [category.id, index]),
  );
  const entryIds = new Set();
  const words = new Set();
  const entryById = new Map();
  for (const entry of backup.entries) {
    const id = assertSafeId(entry?.id, '词条');
    const word = String(entry?.word ?? '').trim();
    const normalized = normalizeWord(word);
    if (!normalized || containsControlCharacters(word) || word.length > MAX_WORD_LENGTH || entryIds.has(id) || words.has(normalized)) {
      throw new Error(`备份包含无效或重复词汇：${word}`);
    }
    const pos = parsePos(Array.isArray(entry.pos) ? entry.pos.join(', ') : entry.pos);
    if (!pos.length) throw new Error(`词汇 ${word} 缺少词性`);
    if (!entry.sources || typeof entry.sources !== 'object' || Array.isArray(entry.sources)) {
      throw new Error(`词汇 ${word} 缺少来源关系`);
    }
    const sourceIds = Object.keys(entry.sources);
    if (!sourceIds.length || sourceIds.some((categoryId) => !categoryIds.has(categoryId))) {
      throw new Error(`词汇 ${word} 包含不存在的来源词表`);
    }
    let commonSourceNormalized = null;
    for (const sourceId of sourceIds) {
      const source = entry.sources[sourceId];
      const sourceWord = String(source?.word ?? '').trim();
      const sourcePos = parsePos(Array.isArray(source?.pos) ? source.pos.join(', ') : source?.pos);
      const sourceNormalized = normalizeWord(sourceWord);
      if (!sourceNormalized || containsControlCharacters(sourceWord) || sourceWord.length > MAX_WORD_LENGTH || !sourcePos.length) throw new Error(`词汇 ${word} 的来源数据无效`);
      if (commonSourceNormalized == null) commonSourceNormalized = sourceNormalized;
      else if (sourceNormalized !== commonSourceNormalized) throw new Error(`词汇 ${word} 的多个来源词形不一致`);
    }
    const expectedOwner = [...sourceIds].sort((a, b) => orderMap.get(a) - orderMap.get(b))[0];
    if (entry.categoryId !== expectedOwner) throw new Error(`词汇 ${word} 的当前归属与词表优先级不一致`);

    const manualWord = entry.manualWord == null ? null : String(entry.manualWord).trim();
    if (entry.manualWord != null && (!manualWord || containsControlCharacters(manualWord) || manualWord.length > MAX_WORD_LENGTH)) throw new Error(`词汇 ${word} 包含无效人工词形`);
    const expectedWord = manualWord || String(entry.sources[expectedOwner].word).trim();
    if (word !== expectedWord) throw new Error(`词汇 ${word} 的显示词形与来源数据不一致`);
    if (commonSourceNormalized !== normalized) {
      throw new Error(`词汇 ${word} 的来源词形与规范词形不一致`);
    }

    let manualPos = null;
    if (entry.manualPos != null) {
      manualPos = parsePos(Array.isArray(entry.manualPos) ? entry.manualPos.join(', ') : entry.manualPos);
      if (!manualPos.length) throw new Error(`词汇 ${word} 包含无效人工词性`);
    }
    const sourcePos = sourceIds.flatMap((sourceId) => parsePos(
      Array.isArray(entry.sources[sourceId].pos)
        ? entry.sources[sourceId].pos.join(', ')
        : entry.sources[sourceId].pos,
    ));
    const expectedPos = manualPos?.length ? manualPos : mergePos(sourcePos);
    if (formatPos(pos) !== formatPos(expectedPos)) throw new Error(`词汇 ${word} 的显示词性与来源数据不一致`);
    if (entry.normalizedWord != null && String(entry.normalizedWord) !== normalized) {
      throw new Error(`词汇 ${word} 的 normalizedWord 不一致`);
    }
    entryIds.add(id);
    words.add(normalized);
    entryById.set(id, entry);
  }

  const pinIds = new Set();
  const pinnedEntries = new Set();
  for (const pin of backup.pins ?? []) {
    const pinId = assertSafeId(pin?.id, '书签');
    const pinEntryId = assertSafeId(pin?.entryId, '书签词条');
    const pinCategoryId = assertSafeId(pin?.categoryId, '书签词表');
    if (pinIds.has(pinId) || pinnedEntries.has(pinEntryId) || !Number.isInteger(Number(pin.order)) || Number(pin.order) < 0
        || (pin.createdAt != null && typeof pin.createdAt !== 'string')) {
      throw new Error('备份包含重复或无效书签');
    }
    const entry = entryById.get(pinEntryId);
    if (!entry || pinCategoryId !== entry.categoryId) throw new Error('备份中的书签指向不存在或错误归属的词汇');
    pinIds.add(pinId);
    pinnedEntries.add(pinEntryId);
  }

  const annotationEntries = new Set();
  for (const annotation of backup.annotations ?? []) {
    const annotationEntryId = assertSafeId(annotation?.entryId, 'AI 标注词条');
    const entry = entryById.get(annotationEntryId);
    if (!entry || annotationEntries.has(annotationEntryId) || annotation.categoryId !== entry.categoryId) {
      throw new Error('备份包含重复、失效或错误归属的 AI 标注');
    }
    if (annotation.createdAt != null && typeof annotation.createdAt !== 'string') throw new Error('备份中的 AI 标注时间无效');
    if (annotation.spelling != null && (typeof annotation.spelling !== 'object' || Array.isArray(annotation.spelling))) {
      throw new Error('备份中的 AI 拼写标注无效');
    }
    if (annotation.pos != null && (typeof annotation.pos !== 'object' || Array.isArray(annotation.pos))) {
      throw new Error('备份中的 AI 词性标注无效');
    }
    if (annotation.spelling?.incorrect != null && typeof annotation.spelling.incorrect !== 'boolean') {
      throw new Error('备份中的 AI 拼写标注状态无效');
    }
    if (annotation.pos?.incorrect != null && typeof annotation.pos.incorrect !== 'boolean') {
      throw new Error('备份中的 AI 词性标注状态无效');
    }
    const spellingIncorrect = annotation.spelling?.incorrect === true;
    const posIncorrect = annotation.pos?.incorrect === true;
    if (!spellingIncorrect && !posIncorrect) throw new Error('备份包含没有实际问题的 AI 标注');
    if (annotation.spelling?.suggestion != null && String(annotation.spelling.suggestion).length > MAX_WORD_LENGTH) {
      throw new Error('备份中的 AI 拼写建议过长');
    }
    if (annotation.pos?.incorrect && annotation.pos.suggestion != null) {
      const suggested = parsePos(Array.isArray(annotation.pos.suggestion)
        ? annotation.pos.suggestion.join(', ')
        : annotation.pos.suggestion);
      if (String(annotation.pos.suggestion).trim() && !suggested.length) throw new Error('备份中的 AI 词性标注无效');
    }
    if (annotation.reason != null && String(annotation.reason).length > MAX_REASON_LENGTH) throw new Error('备份中的 AI 标注说明过长');
    annotationEntries.add(annotationEntryId);
  }
  if (backup.settings != null && (typeof backup.settings !== 'object' || Array.isArray(backup.settings))) throw new Error('备份 settings 无效');
  if (backup.settings?.historyLimit != null && (!Number.isInteger(Number(backup.settings.historyLimit)) || Number(backup.settings.historyLimit) < 1 || Number(backup.settings.historyLimit) > 1000)) throw new Error('备份包含无效历史上限');
  if (backup.settings?.numberMode != null && !['none', 'group', 'global'].includes(backup.settings.numberMode)) {
    throw new Error('备份包含无效序号模式');
  }
  return true;
}


export function canonicalizeBackup(backup) {
  validateBackup(backup);
  const backupTimestamp = String(backup.exportedAt ?? backup.generatedAt ?? FALLBACK_TIMESTAMP);
  const timestamp = (value) => {
    const text = String(value ?? backupTimestamp).trim();
    return text && text.length <= 80 ? text : FALLBACK_TIMESTAMP;
  };
  const categories = [...backup.categories]
    .map((category) => ({
      id: String(category.id).trim(),
      name: String(category.name).trim(),
      label: String(category.label ?? category.name).trim(),
      order: Number(category.order),
      createdAt: timestamp(category.createdAt),
      updatedAt: timestamp(category.updatedAt ?? category.createdAt),
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const orderMap = new Map(categories.map((category, index) => [category.id, index]));
  const entries = backup.entries.map((raw) => {
    const sourceIds = Object.keys(raw.sources).sort((a, b) => orderMap.get(a) - orderMap.get(b) || a.localeCompare(b));
    const sources = {};
    for (const sourceId of sourceIds) {
      const source = raw.sources[sourceId];
      sources[sourceId] = {
        word: String(source.word).trim(),
        pos: sortPos(parsePos(Array.isArray(source.pos) ? source.pos.join(', ') : source.pos)),
      };
    }
    const manualWord = raw.manualWord == null ? null : String(raw.manualWord).trim();
    const manualPos = raw.manualPos == null
      ? null
      : sortPos(parsePos(Array.isArray(raw.manualPos) ? raw.manualPos.join(', ') : raw.manualPos));
    const word = String(raw.word).trim();
    return {
      id: String(raw.id).trim(),
      word,
      normalizedWord: normalizeWord(word),
      sources,
      manualWord,
      manualPos,
      categoryId: String(raw.categoryId).trim(),
      pos: sortPos(parsePos(Array.isArray(raw.pos) ? raw.pos.join(', ') : raw.pos)),
      createdAt: timestamp(raw.createdAt),
      updatedAt: timestamp(raw.updatedAt ?? raw.createdAt),
    };
  }).sort((a, b) => a.normalizedWord.localeCompare(b.normalizedWord) || a.id.localeCompare(b.id));
  const pins = [...(backup.pins ?? [])]
    .map((pin) => ({
      id: String(pin.id).trim(),
      entryId: String(pin.entryId).trim(),
      categoryId: String(pin.categoryId).trim(),
      order: Number(pin.order),
      createdAt: timestamp(pin.createdAt),
    }))
    .sort((a, b) => (orderMap.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER)
      || a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const pinOrderByCategory = new Map();
  for (const pin of pins) {
    const nextOrder = pinOrderByCategory.get(pin.categoryId) ?? 0;
    pin.order = nextOrder;
    pinOrderByCategory.set(pin.categoryId, nextOrder + 1);
  }
  const annotations = [...(backup.annotations ?? [])].map((annotation) => {
    let suggestion = [];
    if (annotation.pos?.incorrect === true && annotation.pos?.suggestion != null) {
      suggestion = sortPos(parsePos(Array.isArray(annotation.pos.suggestion)
        ? annotation.pos.suggestion.join(', ')
        : annotation.pos.suggestion));
    }
    return {
      entryId: String(annotation.entryId).trim(),
      categoryId: String(annotation.categoryId).trim(),
      createdAt: timestamp(annotation.createdAt),
      spelling: {
        incorrect: annotation.spelling?.incorrect === true,
        suggestion: annotation.spelling?.incorrect === true
          ? String(annotation.spelling?.suggestion ?? '').trim().slice(0, MAX_WORD_LENGTH)
          : '',
      },
      pos: {
        incorrect: annotation.pos?.incorrect === true,
        suggestion: annotation.pos?.incorrect === true ? suggestion : [],
      },
      reason: String(annotation.reason ?? '').trim().slice(0, MAX_REASON_LENGTH),
    };
  }).sort((a, b) => a.entryId.localeCompare(b.entryId));
  return {
    schemaVersion: 1,
    appVersion: String(backup.appVersion ?? ''),
    exportedAt: timestamp(backup.exportedAt ?? backup.generatedAt),
    categories,
    entries,
    pins,
    annotations,
    settings: {
      numberMode: backup.settings?.numberMode ?? 'none',
      historyLimit: Number(backup.settings?.historyLimit ?? 100),
    },
  };
}

export function exportCategoryMarkdown(category, entries) {
  const groups = new Map();
  for (const entry of entries) {
    const letter = groupForWord(entry.word);
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
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => exportCategoryMarkdown(category, entries.filter((entry) => entry.categoryId === category.id)).trimEnd())
    .join('\n\n');
}

export function exportCategoryCsv(entries) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = ['word,pos'];
  for (const entry of [...entries].sort((a, b) => a.normalizedWord.localeCompare(b.normalizedWord))) {
    lines.push(`${quote(entry.word)},${quote(formatPos(entry.pos))}`);
  }
  return `${lines.join('\r\n')}\r\n`;
}
