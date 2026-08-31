import { ProviderError } from './v3-provider-runtime.js';

function node(tag, className, text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}
function section(label, text, className = '') {
  const container = node('section', `provider-section ${className}`);
  container.append(node('h4', 'provider-section-label', label), node('p', '', text));
  return container;
}

export function renderGroqLookup(result) {
  const body = node('div', 'provider-lookup');
  body.append(node('h3', 'provider-headword', result.headword));
  const meta = [result.pronunciation, result.partOfSpeech].filter(Boolean).join(' · ');
  if (meta) body.append(node('p', 'provider-lexical-meta', meta));
  body.append(section('释义', result.meaning));
  if (result.examples.length) {
    const examples = node('section', 'provider-section');
    examples.append(node('h4', 'provider-section-label', '例句'));
    for (const item of result.examples) {
      const example = node('div', 'provider-example');
      example.append(node('p', 'provider-example-english', item.english));
      if (item.translation) example.append(node('p', 'provider-example-translation', item.translation));
      examples.append(example);
    }
    body.append(examples);
  }
  if (result.usageNote) body.append(section('用法', result.usageNote));
  body.append(node('p', 'provider-footnote', 'AI 生成的学习参考，可能有误；不会修改词库。'));
  return body;
}

export function renderGroqVerification(result) {
  const body = node('div', 'provider-verification');
  const titles = { ok: '未发现明确问题', issue: '发现可能需要修订的内容', uncertain: '现有信息不足以确认' };
  body.append(section(titles[result.verdict], result.explanation));
  if (result.suggestedText) body.append(section('建议文本', result.suggestedText));
  if (result.suggestedGloss) body.append(section('建议释义', result.suggestedGloss));
  body.append(node('p', 'provider-footnote', '核查仅供参考，未自动修改词条或生成标注。'));
  return body;
}

const SAFE_TAGS = new Set(['div', 'span', 'p', 'b', 'strong', 'i', 'em', 'small', 'br', 'sup', 'sub',
  'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'tbody', 'tr', 'td', 'th']);
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'img', 'picture', 'source',
  'link', 'meta', 'base', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'audio', 'video', 'template']);
const SEMANTIC_CLASSES = {
  orth: 'headword', hwd: 'headword', headword: 'headword', pron: 'pronunciation', ipa: 'pronunciation',
  pos: 'pos', sense: 'sense', hom: 'sense', def: 'definition', definition: 'definition',
  cit: 'example', quote: 'example', example: 'example', translation: 'translation', trans: 'translation',
  label: 'label', gram: 'label', usage: 'label', etym: 'etymology', copyright: 'copyright',
};

/** Parse into an inert template, then COPY only safe structure/text. Never mount raw HTML,
 * provider class names, href/src/style/events, or publisher scripts/resources. */
export function renderCollinsEntry(result) {
  const template = document.createElement('template');
  template.innerHTML = result.entryContent;
  const body = node('div', 'provider-collins-entry');
  let count = 0;
  function copy(source, target, depth = 0) {
    if (++count > 15000 || depth > 80) throw new ProviderError('invalid-response', 'Collins 词条结构过大，未展示');
    if (source.nodeType === 3) { target.append(document.createTextNode(source.textContent || '')); return; }
    if (source.nodeType !== 1) return;
    const tag = source.localName.toLowerCase();
    if (DROP_TAGS.has(tag)) return;
    const safeTag = SAFE_TAGS.has(tag) ? (/^h[1-6]$/.test(tag) ? 'h4' : tag) : 'span';
    const element = document.createElement(safeTag);
    for (const token of source.classList) {
      const semantic = SEMANTIC_CLASSES[token.toLowerCase()];
      if (semantic) element.classList.add(`collins-${semantic}`);
    }
    for (const child of source.childNodes) copy(child, element, depth + 1);
    target.append(element);
  }
  try {
    for (const child of template.content.childNodes) copy(child, body);
  } finally { template.content.replaceChildren(); }
  if (!body.textContent.trim()) throw new ProviderError('invalid-response', 'Collins 未返回可阅读的词条内容');
  const wrapper = node('div', 'provider-dictionary');
  wrapper.append(node('p', 'provider-lexical-meta', `词典：${result.dictionaryCode}`), body,
    node('p', 'provider-footnote', '词典内容由 Collins 提供 · © HarperCollins Publishers。仅本次查询展示，不缓存、不写入词库。'));
  return wrapper;
}
