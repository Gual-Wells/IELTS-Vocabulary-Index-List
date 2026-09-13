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

function speechButton(text, onSpeak) {
  const control = node('button', 'provider-speech-button');
  control.type = 'button';
  control.setAttribute('aria-label', `播放发音：${text}`);
  control.title = '播放发音';
  control.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 9.2h3.5l4.2-3.5v12.6l-4.2-3.5H5z"></path><path d="M16 9a4.2 4.2 0 0 1 0 6M18.5 6.8a7.2 7.2 0 0 1 0 10.4"></path></svg>';
  control.addEventListener('click', () => {
    if (control.disabled) return;
    Promise.resolve(onSpeak(text, control)).catch(() => undefined);
  });
  return control;
}

export function renderGroqLookup(result, { onSpeak = null } = {}) {
  const body = node('div', 'provider-lookup');
  const headword = node('div', 'provider-headword-row');
  headword.append(node('h3', 'provider-headword', result.headword));
  if (onSpeak) headword.append(speechButton(result.headword, onSpeak));
  body.append(headword);
  if (result.partOfSpeech) body.append(node('p', 'provider-lexical-meta', result.partOfSpeech));
  if (result.memoryCue) body.append(section('提示', result.memoryCue));
  body.append(section('含义', result.meaning));
  if (result.collocations.length) body.append(section('搭配', result.collocations.join(' · ')));
  if (result.usageHints.length) {
    const hints = node('section', 'provider-section');
    hints.append(node('h4', 'provider-section-label', '用法'));
    const list = node('ul', 'provider-hint-list');
    for (const item of result.usageHints) list.append(node('li', '', item));
    hints.append(list);
    body.append(hints);
  }
  if (result.examples.length) {
    const examples = node('section', 'provider-section');
    examples.append(node('h4', 'provider-section-label', '例句'));
    for (const item of result.examples) {
      const example = node('div', 'provider-example');
      const english = node('div', 'provider-example-english-row');
      english.append(node('p', 'provider-example-english', item.english));
      if (onSpeak) english.append(speechButton(item.english, onSpeak));
      example.append(english);
      if (item.translation) example.append(node('p', 'provider-example-translation', item.translation));
      examples.append(example);
    }
    body.append(examples);
  }
  return body;
}

export function renderGroqVerification(result) {
  const body = node('div', 'provider-verification');
  const titles = { ok: '未发现明确问题', issue: '可能需要修订', uncertain: '信息不足' };
  body.append(section(titles[result.verdict], result.explanation));
  if (result.suggestedText) body.append(section('建议文本', result.suggestedText));
  if (result.suggestedGloss) body.append(section('建议释义', result.suggestedGloss));
  return body;
}
