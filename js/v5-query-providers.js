// @ts-check
import { getSelectedModel } from './v3-ai.js';
import { getBridgeConfig, requestGroqCompletion } from './v5-bridge.js';
import { CollinsBridgeError, requestCollinsLookup, saveCollinsSecret } from './v5-collins-bridge.js';

const CHATGPT_SHORTCUT_NAME = 'AI查询';
const COLLINS_ATTRIBUTION = 'www.collinsdictionary.com © HarperCollins Publishers Ltd 2025';
const menu = document.getElementById('query-menu');
let extendingMenu = false;
let activeLookup = null;
let activeLearning = null;
let overlay = null;
let panel = null;
let panelBody = null;

const ICONS = {
  collins: '<path d="M5 4.8h14v14.4H5z"></path><path d="M8 8.2h8M8 12h6M8 15.8h7"></path>',
  chatgpt: '<path d="M5.2 5.3h13.6v10.6H11l-4.1 2.8v-2.8H5.2z"></path><path d="M8.2 9.1h7.6M8.2 12.1h5.1"></path>',
  groq: '<path d="M7.2 5.3h9.6M5.2 8.8h13.6v8.6H5.2z"></path><path d="M8.2 12h7.6M8.2 14.8h4.5"></path>',
  close: '<path d="m7.35 7.35 9.3 9.3M16.65 7.35l-9.3 9.3"></path>',
};

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function iconButton(icon, className, label, onClick, visibleLabel = '') {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = `icon-button ${className}`;
  control.setAttribute('aria-label', label);
  control.title = label;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ui-icon');
  svg.innerHTML = ICONS[icon] || '';
  control.append(svg);
  if (visibleLabel) control.append(node('span', 'query-provider-label', visibleLabel));
  control.addEventListener('click', onClick);
  return control;
}

function providerLabel(control) {
  return control?.querySelector('.query-provider-label')?.textContent?.trim() || '';
}

function currentQuery() {
  if (!menu) return '';
  const oxford = [...menu.querySelectorAll('[role="menuitem"]')].find((control) => providerLabel(control) === 'Oxford');
  const label = oxford?.getAttribute('aria-label') || '';
  const prefix = '在牛津英汉辞书中查询 ';
  if (label.startsWith(prefix)) return label.slice(prefix.length).trim();
  const groq = [...menu.querySelectorAll('[role="menuitem"]')].find((control) => providerLabel(control) === 'Groq');
  return (groq?.getAttribute('aria-label') || '').replace(/^用 Groq 查询\s*/, '').trim();
}

function querySource() {
  const candidates = [...document.querySelectorAll('button[aria-expanded="true"]')];
  if (!candidates.length || !menu) return null;
  const menuRect = menu.getBoundingClientRect();
  return candidates.sort((left, right) => {
    const a = left.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    const ad = Math.abs(a.right - menuRect.right) + Math.abs(a.top - menuRect.top);
    const bd = Math.abs(b.right - menuRect.right) + Math.abs(b.top - menuRect.top);
    return ad - bd;
  })[0] || null;
}

function closeNativeQueryMenu() {
  const source = querySource();
  if (source) source.click();
  else {
    menu?.classList.add('hidden');
    menu?.replaceChildren();
  }
}

function repositionExtendedMenu() {
  if (!menu || menu.classList.contains('hidden')) return;
  const source = querySource();
  if (!source) return;
  const sourceRect = source.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const sideInset = 10;
  const idealLeft = sourceRect.right - menuRect.width - 10;
  const left = Math.max(viewportLeft + sideInset, Math.min(idealLeft, viewportLeft + viewportWidth - menuRect.width - sideInset));
  menu.style.left = `${Math.round(left)}px`;
}

function buildChatGPTShortcutUrl(prompt) {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(CHATGPT_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(prompt)}`;
}

function openChatGPTWordQuery(query) {
  const prompt = [
    '请作为英语学习助手解释下面这个词或短语。重点不是重新抄词典，而是帮助我建立可主动使用的语感：核心义项、常见句法/可数性、关键搭配与短语、义项之间的联系，以及容易从中文释义里漏掉的用法。用简洁的繁体中文说明，并给少量自然例句。',
    `查询项：${query}`,
  ].join('\n');
  window.location.assign(buildChatGPTShortcutUrl(prompt));
}

function enhanceMenu() {
  if (!menu || extendingMenu || menu.classList.contains('hidden') || menu.querySelector('.collins-option')) return;
  const options = [...menu.querySelectorAll('[role="menuitem"]')];
  const oxford = options.find((control) => providerLabel(control) === 'Oxford');
  const groq = options.find((control) => providerLabel(control) === 'Groq');
  const query = currentQuery();
  if (!oxford || !groq || !query) return;
  extendingMenu = true;
  try {
    const collins = iconButton('collins', 'query-menu-option collins-option', `用 Collins 查询 ${query}`, () => {
      closeNativeQueryMenu();
      queueMicrotask(() => openCollins(query));
    }, 'Collins');
    collins.setAttribute('role', 'menuitem');
    const chatgpt = iconButton('chatgpt', 'query-menu-option chatgpt-option', `用 ChatGPT 学习 ${query}`, () => {
      closeNativeQueryMenu();
      queueMicrotask(() => openChatGPTWordQuery(query));
    }, 'ChatGPT');
    chatgpt.setAttribute('role', 'menuitem');
    menu.replaceChildren(oxford, collins, groq, chatgpt);
    requestAnimationFrame(repositionExtendedMenu);
  } finally {
    extendingMenu = false;
  }
}

function ensureOverlay() {
  if (overlay) return;
  overlay = node('section', 'provider-extension-overlay hidden');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlay(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOverlay(); });
  panel = node('article', 'provider-extension-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panelBody = node('div', 'provider-extension-body');
  panel.append(panelBody);
  overlay.append(panel);
  document.body.append(overlay);
}

function closeOverlay() {
  activeLookup?.abort();
  activeLearning?.abort();
  activeLookup = null;
  activeLearning = null;
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('provider-extension-open');
}

function openShell(query) {
  ensureOverlay();
  activeLookup?.abort();
  activeLearning?.abort();
  activeLearning = null;
  panelBody.replaceChildren();
  const header = node('header', 'provider-extension-header');
  const titleWrap = node('div', 'provider-extension-title');
  titleWrap.append(node('span', 'provider-extension-kicker', 'Collins COBUILD'), node('h2', '', query));
  header.append(titleWrap, iconButton('close', 'provider-extension-close', '关闭 Collins', closeOverlay));
  const content = node('div', 'provider-extension-content');
  panelBody.append(header, content);
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('provider-extension-open');
  requestAnimationFrame(() => header.querySelector('button')?.focus({ preventScroll: true }));
  return content;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), 'https://www.collinsdictionary.com/');
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

function sanitizedCollinsFragment(html) {
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  for (const blocked of parsed.querySelectorAll('script, style, noscript, iframe, object, embed, form, input, button, textarea, select, meta, link, img, picture, audio, video, source, svg')) blocked.remove();
  for (const element of parsed.body.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || ['style', 'srcdoc'].includes(name)) { element.removeAttribute(attribute.name); continue; }
      if (['href', 'src'].includes(name)) {
        const value = safeUrl(attribute.value);
        if (value) element.setAttribute(attribute.name, value); else element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'class' || name === 'title' || name === 'lang' || name === 'dir' || name === 'role' || name.startsWith('aria-')) continue;
      element.removeAttribute(attribute.name);
    }
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
  const fragment = document.createDocumentFragment();
  while (parsed.body.firstChild) fragment.append(parsed.body.firstChild);
  return fragment;
}

function textFromHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return String(parsed.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40000);
}

function statusBox(text, kind = '') {
  return node('div', `provider-extension-status${kind ? ` ${kind}` : ''}`, text);
}

function renderBridgeConfiguration(content, query, error) {
  content.replaceChildren(statusBox(error?.message || 'Collins 尚未配置', 'error'));
  const config = getBridgeConfig();
  if (!config.url || !config.deviceToken) {
    const openSettings = node('button', 'secondary-button', '打开 VIX 设置');
    openSettings.type = 'button';
    openSettings.addEventListener('click', () => {
      closeOverlay();
      document.getElementById('settings-button')?.click();
    });
    content.append(openSettings);
    return;
  }
  const form = node('form', 'collins-key-form');
  const label = node('label', 'collins-key-label');
  label.append(node('span', '', 'Collins API Key'));
  const input = document.createElement('input');
  input.type = 'password';
  input.autocomplete = 'off';
  input.placeholder = 'Collins API Key';
  label.append(input);
  const save = node('button', 'primary-button', '保存并查询');
  save.type = 'submit';
  form.append(label, save);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = input.value.trim();
    if (!key) return;
    save.disabled = true;
    save.textContent = '验证中…';
    try {
      await saveCollinsSecret(key);
      input.value = '';
      await runCollinsLookup(query, content);
    } catch (failure) {
      content.prepend(statusBox(failure?.message || 'Collins API Key 验证失败', 'error'));
    } finally {
      if (save.isConnected) { save.disabled = false; save.textContent = '保存并查询'; }
    }
  });
  content.append(form);
}

function learningAction(icon, label, handler) {
  const control = iconButton(icon, 'query-menu-option provider-study-option', `${label} 学习当前 Collins 词条`, handler, label);
  return control;
}

async function runGroqLearning(result, host) {
  activeLearning?.abort();
  const controller = new AbortController();
  activeLearning = controller;
  const model = getSelectedModel();
  if (!model) {
    host.replaceChildren(statusBox('尚未选择可用的 Groq 模型，请先在 VIX 设置中配置。', 'error'));
    return;
  }
  host.replaceChildren(statusBox('Groq 正在整理这个词条里的学习点…'));
  const source = String(result.plainText || textFromHtml(result.entryContent)).slice(0, 30000);
  try {
    const payload = await requestGroqCompletion({
      model,
      temperature: 0.1,
      max_completion_tokens: 2400,
      messages: [
        {
          role: 'system',
          content: '你是英语词典学习助手。用户会给你刚刚实时查询到的 Collins COBUILD 单条词条。不要机械复述整篇词典；请用繁体中文把分散的信息连接起来，重点解释：核心义项脉络、可数性/句法变化、常见搭配和短语为什么这样成立、例句真正值得学的表达，以及容易只看中文释义时漏掉的语义延伸。只分析当前素材；需要推断时明确说是推断。输出清晰短段落，不要使用 JSON。',
        },
        { role: 'user', content: JSON.stringify({ headword: result.query, dictionary: result.dictionaryName || 'Collins COBUILD', entry: source }) },
      ],
    }, { signal: controller.signal });
    if (controller.signal.aborted) return;
    const choice = payload?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Groq 输出被截断，请重试');
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw new Error('Groq 未能完成本次学习分析');
    const answer = String(choice?.message?.content || '').trim();
    if (!answer) throw new Error('Groq 没有返回可用内容');
    const section = node('section', 'provider-study-result');
    section.append(node('h3', '', 'Groq 学习'), node('div', 'provider-study-copy', answer));
    host.replaceChildren(section);
  } catch (error) {
    if (controller.signal.aborted) return;
    host.replaceChildren(statusBox(error?.message || 'Groq 学习请求失败', 'error'));
  }
}

function openChatGPTCollinsLearning(result) {
  const source = String(result.plainText || textFromHtml(result.entryContent)).slice(0, 7500);
  const prompt = [
    '下面是我刚刚实时查询到的一条 Collins COBUILD 词典内容。请不要重抄词条，而是作为英语学习助手把其中分散的信息连接成我能主动使用的学习点。重点说明核心义项之间的关系、可数性和句法变化、搭配/短语为什么这样用、例句里值得主动吸收的表达，以及中文直译容易漏掉的语义。必要时可以补充解释，但请把词典原文与额外推断区分开。用繁体中文，简洁但讲清楚。',
    `查询项：${result.query}`,
    `词典：${result.dictionaryName || 'Collins COBUILD'}`,
    '当前词条内容：',
    source,
  ].join('\n');
  window.location.assign(buildChatGPTShortcutUrl(prompt));
}

function renderCollinsResult(content, result) {
  content.replaceChildren();
  const meta = node('div', 'collins-result-meta', result.dictionaryName || 'Collins COBUILD');
  const entry = node('article', 'collins-entry-content');
  entry.append(sanitizedCollinsFragment(result.entryContent));
  const actions = node('section', 'provider-study-actions');
  const actionTitle = node('div', 'provider-study-heading', 'AI 学习');
  const actionRow = node('div', 'provider-study-button-row');
  const learningHost = node('div', 'provider-study-host');
  actionRow.append(
    learningAction('groq', 'Groq', () => runGroqLearning(result, learningHost)),
    learningAction('chatgpt', 'ChatGPT', () => openChatGPTCollinsLearning(result)),
  );
  actions.append(actionTitle, actionRow, learningHost);
  const attribution = node('footer', 'collins-attribution', result.attribution || COLLINS_ATTRIBUTION);
  content.append(meta, entry, actions, attribution);
}

async function runCollinsLookup(query, content) {
  activeLookup?.abort();
  const controller = new AbortController();
  activeLookup = controller;
  content.replaceChildren(statusBox('正在通过 Bridge 查询 Collins…'));
  try {
    const result = await requestCollinsLookup(query, { signal: controller.signal });
    if (controller.signal.aborted) return;
    renderCollinsResult(content, result);
  } catch (error) {
    if (controller.signal.aborted || error?.code === 'cancelled') return;
    if (error instanceof CollinsBridgeError && ['configuration', 'collins_authentication', 'collins_secret_unreadable', 'master_key_mismatch'].includes(error.code)) {
      renderBridgeConfiguration(content, query, error);
      return;
    }
    content.replaceChildren(statusBox(error?.message || 'Collins 查询失败', 'error'));
  }
}

function openCollins(query) {
  const content = openShell(query);
  runCollinsLookup(query, content);
}

if (menu) {
  const observer = new MutationObserver(enhanceMenu);
  observer.observe(menu, { childList: true, attributes: true, attributeFilter: ['class'] });
  window.visualViewport?.addEventListener('resize', repositionExtendedMenu);
  window.addEventListener('resize', repositionExtendedMenu, { passive: true });
  enhanceMenu();
}
