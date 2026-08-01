import {
  acknowledgeMigrationNotice, addCollection, addDomain, addEntry, addPhraseForWord,
  clearAnnotationsForCollection, deleteCollection, deleteDomain, deleteEntry, dismissAnnotation,
  editEntry, exportFullBackup, getLastPosition, getPhraseComponents, getRelatedPhrases, getState,
  getPinsForCollection, getVisibleEntries, importEntries, initializeStore, moveCollection, redo, reloadStore,
  removeEntryFromCollection, renameCollection, renameDomain, replaceAnnotations, restoreBackup,
  search, setDomainGlossEnabled, setLastPosition, setNumberMode, subscribe, togglePin, undo,
} from './v3-store.js';
import {
  AiCheckController, checkEntries, getApiKey, getModelCatalog, getModelCatalogUpdatedAt,
  getSelectedModel, refreshModels, selectModel, setApiKey, suggestEntries,
} from './v3-ai.js';
import {
  downloadText, entriesToCsv, readImportFile,
} from './v3-import.js';
import { normalizeEnglish, systemPhraseCollectionId } from './v3-model.js';

const APP_VERSION = '3.0.0';
/** @type {Record<string, any>} */
const elements = Object.fromEntries([
  'boot-screen', 'app', 'back-button', 'page-title', 'page-subtitle', 'search-button', 'settings-button',
  'home-view', 'collection-view', 'collection-toolbar', 'letter-nav', 'entry-list', 'task-panel',
  'annotation-review-bar', 'toast-region', 'app-dialog', 'dialog-form', 'dialog-title',
  'dialog-description', 'dialog-close', 'dialog-body', 'dialog-actions', 'hidden-file-input',
].map((id) => [id, document.getElementById(id)]));

let currentCollectionId = '';
let expandedLetters = new Set();
let expandedEntries = new Set();
let pendingJumpEntryId = '';
let activeTask = null;
let review = { ids: [], index: 0, collectionId: '' };
let dialogSubmitHandler = null;
let previousRouteCollectionId = '';

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'on') for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    else if (key in node && key !== 'form') node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function button(text, className, handler, options = {}) {
  return el('button', { type: 'button', className, text, disabled: options.disabled || false, on: { click: handler }, title: options.title || '' });
}

function showToast(message, type = 'info') {
  const toast = el('div', { className: `toast${type === 'error' ? ' error' : ''}`, text: String(message) });
  elements['toast-region'].replaceChildren(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 2800);
}

function displayError(error) {
  console.error(error);
  showToast(error?.message || String(error), 'error');
}

function field(label, control, help = '') {
  const wrapper = el('label', { className: 'field' }, [el('span', { text: label }), control]);
  if (help) wrapper.append(el('p', { className: 'help-text', text: help }));
  return wrapper;
}

function closeDialog() {
  if (elements['app-dialog'].open) elements['app-dialog'].close();
  dialogSubmitHandler = null;
}

function openDialog({ title, description = '', body = [], submitText = '保存', cancelText = '取消', destructive = false, onSubmit = null }) {
  elements['dialog-title'].textContent = title;
  elements['dialog-description'].textContent = description;
  elements['dialog-description'].classList.toggle('hidden', !description);
  elements['dialog-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  elements['dialog-actions'].replaceChildren();
  elements['dialog-actions'].append(button(cancelText, 'secondary-button', closeDialog));
  if (onSubmit) {
    const submit = el('button', { type: 'submit', className: destructive ? 'danger-button' : 'primary-button', text: submitText });
    elements['dialog-actions'].append(submit);
    dialogSubmitHandler = onSubmit;
  } else dialogSubmitHandler = null;
  if (!elements['app-dialog'].open) elements['app-dialog'].showModal();
  queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['dialog-body'].querySelector('input,textarea,select,button'))?.focus());
}

function collectionRoute(collectionId, entryId = '') {
  const query = new URLSearchParams();
  query.set('collection', collectionId);
  if (entryId) query.set('entry', entryId);
  return `#${query}`;
}

function parseRoute() {
  const query = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { collectionId: query.get('collection') || '', entryId: query.get('entry') || '' };
}

function navigateCollection(collectionId, entryId = '') {
  const hash = collectionRoute(collectionId, entryId);
  if (location.hash === hash) {
    currentCollectionId = collectionId;
    pendingJumpEntryId = entryId;
    renderApp();
  } else location.hash = hash;
}

function goHome() {
  if (location.hash) location.hash = '';
  else { currentCollectionId = ''; renderApp(); }
}

function projectionCollectionForEntry(entryId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) return '';
  if (entry.kind === 'phrase') return systemPhraseCollectionId(entry.domainId);
  for (const [collectionId, entries] of state.projection.entries()) {
    if (entries.some((item) => item.id === entryId)) return collectionId;
  }
  return '';
}

function annotationCountForCollection(collectionId) {
  const state = getState();
  return getVisibleEntries(collectionId).filter((entry) => state.annotationByEntry.has(entry.id)).length;
}

function renderHome() {
  const state = getState();
  currentCollectionId = '';
  elements['home-view'].classList.remove('hidden');
  elements['collection-view'].classList.add('hidden');
  elements['back-button'].classList.add('hidden');
  elements['page-title'].textContent = '词汇索引';
  elements['page-subtitle'].textContent = `${state.domains.length} 个词域 · ${state.entries.length.toLocaleString()} 个词项`;

  const annotationTotal = state.annotations.length;
  const summaryActions = [button('新建词域', 'primary-button', openAddDomainDialog)];
  if (annotationTotal) summaryActions.unshift(button(`审阅待核查 ${annotationTotal}`, 'secondary-button', () => startAnnotationReview('')));
  const summary = el('div', { className: 'home-summary' }, [
    el('div', {}, [el('h2', { text: 'Vocabulary Index' }), el('p', { text: '本地优先 · 词域隔离 · 短语双向索引' })]),
    el('div', { className: 'home-summary-actions' }, summaryActions),
  ]);

  const sections = state.domains.map((domain) => {
    const domainCollections = state.collections.filter((item) => item.domainId === domain.id);
    const normalCount = domainCollections.filter((item) => item.type === 'normal').length;
    const domainEntryCount = state.entries.filter((item) => item.domainId === domain.id).length;
    const header = el('div', { className: 'domain-header' }, [
      el('div', { className: 'domain-header-text' }, [
        el('h3', { text: domain.name }),
        el('p', { text: `${normalCount} 个词表 · ${domainEntryCount.toLocaleString()} 个词项${domain.glossEnabled ? ' · 繁体释义已启用' : ''}` }),
      ]),
      el('div', { className: 'domain-actions' }, [
        button('＋', 'icon-button', () => openAddCollectionDialog(domain.id), { title: '新建词表' }),
        button('⋯', 'icon-button', () => openDomainMenu(domain.id), { title: '管理词域' }),
      ]),
    ]);

    const cards = domainCollections.map((collection) => {
      const count = getVisibleEntries(collection.id).length;
      const card = el('button', {
        type: 'button',
        className: `collection-card${collection.type === 'system-phrases' ? ' system' : ''}`,
        on: { click: () => navigateCollection(collection.id) },
      }, [
        el('span', { className: 'arrow', text: '↗' }),
        el('h4', { text: collection.name }),
        el('div', { className: 'label', text: collection.label || (collection.type === 'system-phrases' ? '域内短语总览' : '普通词表') }),
        el('div', { className: 'count', text: count.toLocaleString() }),
        collection.type === 'system-phrases' ? el('span', { className: 'type-tag', text: '系统' }) : null,
      ]);
      return card;
    });
    cards.push(el('button', { type: 'button', className: 'collection-card add-card', text: '＋ 新建词表', on: { click: () => openAddCollectionDialog(domain.id) } }));
    return el('section', { className: 'domain-section' }, [header, el('div', { className: 'collection-grid' }, cards)]);
  });
  elements['home-view'].replaceChildren(summary, ...sections);
}

function renderCollection() {
  const state = getState();
  const collection = state.collectionById.get(currentCollectionId);
  if (!collection) { goHome(); return; }
  const domain = state.domainById.get(collection.domainId);
  const entries = getVisibleEntries(collection.id);
  elements['home-view'].classList.add('hidden');
  elements['collection-view'].classList.remove('hidden');
  elements['back-button'].classList.remove('hidden');
  elements['page-title'].textContent = collection.name;
  elements['page-subtitle'].textContent = `${domain?.name || ''} · ${entries.length.toLocaleString()} 个词项`;
  renderCollectionToolbar(collection, domain, entries);
  renderEntryList(collection, domain, entries);
  if (pendingJumpEntryId) queueMicrotask(() => jumpToEntry(pendingJumpEntryId));
}

function renderCollectionToolbar(collection, domain, entries) {
  const state = getState();
  const pinCount = getPinsForCollection(collection.id).length;
  const annotationCount = annotationCountForCollection(collection.id);
  const meta = el('div', { className: 'collection-meta' }, [
    el('div', { className: 'collection-meta-text' }, [
      el('h2', { text: collection.name }),
      el('p', { text: `${entries.length.toLocaleString()} 项 · ${pinCount} 个 PIN · ${annotationCount} 个待核查${collection.label ? ` · ${collection.label}` : ''}` }),
    ]),
  ]);
  const actions = el('div', { className: 'toolbar-buttons' }, [
    button(collection.type === 'system-phrases' ? '新增短语' : '新增词项', 'primary-button compact-button', () => openAddEntryDialog(collection.id)),
    button('导入', 'secondary-button compact-button', () => openImportDialog(collection.id)),
    button('AI 新增', 'secondary-button compact-button', () => openAiAddDialog(collection.id)),
    button('AI 核查', 'secondary-button compact-button', () => startAiCheck(collection.id), { disabled: activeTask != null || entries.length === 0 }),
    button(`待核查 ${annotationCount}`, 'secondary-button compact-button', () => startAnnotationReview(collection.id), { disabled: annotationCount === 0 }),
    button('PIN ←', 'secondary-button compact-button', () => jumpPinned(collection.id, -1), { disabled: pinCount === 0 }),
    button(`PIN ${pinCount} →`, 'secondary-button compact-button', () => jumpPinned(collection.id, 1), { disabled: pinCount === 0 }),
    button('撤销', 'secondary-button compact-button', async () => { try { if (!(await undo())) showToast('没有可撤销操作'); } catch (error) { displayError(error); } }),
    button('重做', 'secondary-button compact-button', async () => { try { if (!(await redo())) showToast('没有可重做操作'); } catch (error) { displayError(error); } }),
    button('更多', 'secondary-button compact-button', () => openCollectionMenu(collection.id)),
  ]);
  elements['collection-toolbar'].replaceChildren(meta, actions);
}

function letterForEntry(entry) {
  const letter = entry.normalizedText.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '#';
}

function renderEntryList(collection, domain, entries) {
  if (!entries.length) {
    elements['letter-nav'].classList.add('hidden');
    elements['entry-list'].replaceChildren(el('div', { className: 'empty-state', text: collection.type === 'system-phrases' ? '尚未收录短语。' : '该词表尚无可见词项。' }));
    return;
  }
  if (collection.type === 'system-phrases') {
    elements['letter-nav'].classList.add('hidden');
    elements['entry-list'].replaceChildren(...entries.map((entry, index) => renderEntryRow(entry, collection, domain, { groupIndex: index + 1, globalIndex: index + 1 })));
    return;
  }
  const grouped = new Map();
  for (const entry of entries) {
    const letter = letterForEntry(entry);
    const list = grouped.get(letter) || [];
    list.push(entry);
    grouped.set(letter, list);
  }
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
  elements['letter-nav'].classList.remove('hidden');
  elements['letter-nav'].replaceChildren(...letters.map((letter) => button(letter, grouped.has(letter) ? '' : 'empty', () => {
    if (!grouped.has(letter)) return;
    expandedLetters.add(letter);
    renderEntryList(collection, domain, entries);
    queueMicrotask(() => document.getElementById(`letter-${letter === '#' ? 'other' : letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, { disabled: !grouped.has(letter) })));

  const globalIndexById = new Map(entries.map((entry, index) => [entry.id, index + 1]));
  const sections = letters.filter((letter) => grouped.has(letter)).map((letter) => {
    const open = expandedLetters.has(letter);
    const section = el('section', { className: 'letter-section', id: `letter-${letter === '#' ? 'other' : letter}` });
    const heading = button('', 'letter-heading', () => {
      if (open) expandedLetters.delete(letter); else expandedLetters.add(letter);
      renderEntryList(collection, domain, entries);
    });
    heading.append(el('span', { text: `${open ? '▾' : '▸'} ${letter}` }), el('span', { className: 'letter-count', text: grouped.get(letter).length.toLocaleString() }));
    section.append(heading);
    if (open) section.append(el('div', { className: 'letter-body' }, grouped.get(letter).map((entry, index) => renderEntryRow(entry, collection, domain, { groupIndex: index + 1, globalIndex: globalIndexById.get(entry.id) || index + 1 }))));
    return section;
  });
  elements['entry-list'].replaceChildren(...sections);
}

function renderEntryRow(entry, collection, domain, indexes = { groupIndex: 0, globalIndex: 0 }) {
  const state = getState();
  const pinned = state.pinByEntry.has(entry.id);
  const annotation = state.annotationByEntry.get(entry.id);
  const expanded = expandedEntries.has(entry.id);
  const row = el('article', { className: 'entry-row', id: `entry-${entry.id}`, dataset: { entryId: entry.id } });
  const numberMode = state.settings.numberMode || 'global';
  const indexText = numberMode === 'group' ? `${indexes.groupIndex}.` : numberMode === 'global' ? `${indexes.globalIndex}.` : '';
  const copy = el('button', { type: 'button', className: 'copy-entry', on: { click: () => copyEntry(entry, collection) } }, [
    indexText ? el('span', { className: 'entry-index', text: indexText }) : null,
    el('span', { className: 'entry-text', text: entry.text }),
    domain?.glossEnabled && entry.glossHant ? el('span', { className: 'entry-gloss', text: entry.glossHant }) : null,
  ]);
  const pin = button(pinned ? '★' : '☆', `row-action${pinned ? ' active' : ''}`, async () => {
    try { await togglePin(entry.id, collection.id); showToast(pinned ? '已取消 PIN' : '已设置 PIN'); } catch (error) { displayError(error); }
  }, { title: pinned ? '取消 PIN' : '设置 PIN' });
  const flag = button(annotation ? '!' : '', `row-action${annotation ? ' flagged' : ''}`, () => annotation && startAnnotationReview(collection.id, entry.id), { title: annotation ? '审阅 AI 标注' : '' });
  if (!annotation) flag.disabled = true;
  const detail = button(expanded ? '⌃' : '⌄', 'row-action', () => {
    if (expanded) expandedEntries.delete(entry.id); else expandedEntries.add(entry.id);
    renderCollection();
  }, { title: '详情' });
  row.append(el('div', { className: 'entry-main' }, [copy, pin, flag, detail]));
  if (expanded) row.append(renderEntryDetail(entry, collection, domain));
  return row;
}

function renderEntryDetail(entry, collection, domain) {
  const state = getState();
  const detail = el('div', { className: 'entry-detail' });
  const memberships = state.membershipsByEntry.get(entry.id) || [];
  if (memberships.length) {
    detail.append(el('div', { className: 'detail-heading', text: '词表来源' }));
    const list = el('ul', { className: 'source-list' });
    for (const membership of memberships) {
      const source = state.collectionById.get(membership.collectionId);
      list.append(el('li', { text: `${source?.name || membership.collectionId}${membership.sourceLabel ? ` · ${membership.sourceLabel}` : ''}` }));
    }
    detail.append(list);
  }
  if (entry.kind === 'word') {
    const phrases = getRelatedPhrases(entry.id);
    detail.append(el('div', { className: 'detail-heading', text: '相关短语' }));
    const chips = phrases.map((phrase) => button(phrase.text, 'chip', () => navigateCollection(systemPhraseCollectionId(entry.domainId), phrase.id)));
    chips.push(button('＋ 添加相关短语', 'chip', () => openAddRelatedPhraseDialog(entry.id)));
    detail.append(el('div', { className: 'chip-list' }, chips));
  } else {
    const components = getPhraseComponents(entry.id);
    detail.append(el('div', { className: 'detail-heading', text: '组成词' }));
    detail.append(el('div', { className: 'chip-list' }, components.map((component) => component.entry
      ? button(component.token, 'chip', () => navigateCollection(projectionCollectionForEntry(component.entry.id), component.entry.id))
      : el('span', { className: 'chip missing', text: `${component.token} · 未收录` }))));
  }
  const actions = el('div', { className: 'chip-list' }, [
    button('编辑', 'chip', () => openEditEntryDialog(entry.id)),
    memberships.some((item) => item.collectionId === collection.id)
      ? button('从本词表移除', 'chip danger', () => confirmRemoveSource(entry.id, collection.id))
      : null,
    button('彻底删除', 'chip danger', () => confirmDeleteEntry(entry.id)),
  ]);
  detail.append(el('div', { className: 'detail-heading', text: '操作' }), actions);
  return detail;
}

async function copyEntry(entry, collection) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(entry.text);
    else {
      const input = el('textarea', { value: entry.text, readonly: true });
      input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.append(input); input.select();
      if (!document.execCommand('copy')) throw new Error('浏览器拒绝复制');
      input.remove();
    }
    await setLastPosition(entry.domainId, collection.id, entry.id);
    showToast(`已复制：${entry.text}`);
  } catch (error) {
    displayError(error);
  }
}

function jumpToEntry(entryId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) return;
  const targetCollectionId = projectionCollectionForEntry(entryId);
  if (!targetCollectionId) return;
  if (targetCollectionId !== currentCollectionId) {
    navigateCollection(targetCollectionId, entryId);
    return;
  }
  const collection = state.collectionById.get(currentCollectionId);
  if (collection?.type === 'normal') expandedLetters.add(letterForEntry(entry));
  pendingJumpEntryId = '';
  if (location.hash.includes('entry=')) history.replaceState(null, '', collectionRoute(currentCollectionId));
  renderCollection();
  requestAnimationFrame(() => {
    const target = document.getElementById(`entry-${entryId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.animate([{ background: '#f8e5a8' }, { background: 'transparent' }], { duration: 1500 });
  });
}

function jumpPinned(collectionId, direction = 1) {
  const state = getState();
  const ids = getPinsForCollection(collectionId).map((pin) => pin.entryId);
  if (!ids.length) return;
  const currentVisible = /** @type {HTMLElement | null} */ (document.elementFromPoint(innerWidth / 2, Math.min(innerHeight / 2, 400))?.closest?.('[data-entry-id]'))?.dataset.entryId;
  const fallback = getLastPosition(state.collectionById.get(collectionId)?.domainId, collectionId);
  const current = currentVisible || fallback || '';
  const index = ids.indexOf(current);
  const next = index < 0 ? (direction < 0 ? ids.length - 1 : 0) : (index + direction + ids.length) % ids.length;
  jumpToEntry(ids[next]);
}

function openAddDomainDialog() {
  const name = el('input', { required: true, maxlength: 40, placeholder: '例如：计算机科学' });
  const gloss = el('input', { type: 'checkbox' });
  openDialog({
    title: '新建词域',
    description: '词域之间的同形词、短语和释义相互独立。',
    body: [field('词域名称', name), el('label', { className: 'inline-field' }, [el('span', { text: '启用繁体中文释义' }), gloss])],
    onSubmit: async () => { await addDomain(name.value, { glossEnabled: gloss.checked }); },
  });
}

function openDomainMenu(domainId) {
  const state = getState();
  const domain = state.domainById.get(domainId);
  const name = el('input', { value: domain.name, maxlength: 40, required: true });
  const gloss = el('input', { type: 'checkbox', checked: domain.glossEnabled });
  const body = [field('词域名称', name), el('label', { className: 'inline-field' }, [el('span', { text: '显示并编辑繁体释义' }), gloss]), el('p', { className: 'help-text', text: '关闭只隐藏释义功能，不会删除已经保存的释义。' })];
  if (domain.id !== 'domain_general_english') body.push(button('删除整个词域', 'danger-button', () => confirmDeleteDomain(domain.id)));
  openDialog({
    title: '管理词域',
    body,
    onSubmit: async () => {
      if (name.value.trim() !== domain.name) await renameDomain(domain.id, name.value);
      if (gloss.checked !== domain.glossEnabled) await setDomainGlossEnabled(domain.id, gloss.checked);
    },
  });
}

function openAddCollectionDialog(domainId) {
  const name = el('input', { required: true, maxlength: 40, placeholder: '例如：操作系统' });
  const label = el('input', { maxlength: 80, placeholder: '可选说明' });
  openDialog({ title: '新建词表', body: [field('词表名称', name), field('说明', label)], onSubmit: async () => { await addCollection(domainId, name.value, label.value); } });
}

function openAddEntryDialog(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(collection.domainId);
  const text = el('input', { required: true, maxlength: 160, placeholder: collection.type === 'system-phrases' ? '例如：thread pool' : '例如：thread' });
  const label = el('input', { maxlength: 80, placeholder: '可选，如 n., v.' });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field(collection.type === 'system-phrases' ? '英文短语' : '英文词项', text)];
  if (collection.type === 'normal') body.push(field('来源标签', label, '仅归档原始词性或来源标签，不参与词项身份。'));
  if (domain.glossEnabled) body.push(field('繁体释义', gloss, '简体输入会在本地转换为通用繁体。'));
  openDialog({
    title: collection.type === 'system-phrases' ? '新增短语' : '新增词项',
    body,
    onSubmit: async () => { const entry = await addEntry(collectionId, text.value, { sourceLabel: label.value, gloss: gloss.value }); pendingJumpEntryId = entry.id; },
  });
}

function openAddRelatedPhraseDialog(entryId) {
  const entry = getState().entryById.get(entryId);
  const domain = getState().domainById.get(entry.domainId);
  const text = el('input', { required: true, maxlength: 160, placeholder: `必须包含词元 “${entry.text}”` });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field('英文短语', text)];
  if (domain.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({ title: '添加相关短语', body, onSubmit: async () => { await addPhraseForWord(entryId, text.value, { gloss: gloss.value }); } });
}

function openEditEntryDialog(entryId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  const domain = state.domainById.get(entry.domainId);
  const text = el('input', { required: true, maxlength: 160, value: entry.text });
  const gloss = el('input', { maxlength: 120, value: entry.glossHant || '', placeholder: '可输入简体或繁体' });
  const body = [field('英文词项', text)];
  if (domain.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({
    title: '编辑词项',
    description: '修改英文文本会重建短语索引，并删除该词项的陈旧 AI 标注。',
    body,
    onSubmit: async () => { await editEntry(entry.id, { text: text.value, gloss: gloss.value }, entry.updatedAt); },
  });
}

function openCollectionMenu(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = getVisibleEntries(collectionId);
  const body = [];
  if (collection.type === 'normal') {
    const name = el('input', { value: collection.name, required: true, maxlength: 40 });
    const label = el('input', { value: collection.label || '', maxlength: 80 });
    body.push(field('词表名称', name), field('说明', label));
    body.push(el('div', { className: 'settings-row' }, [
      button('提高优先级', 'secondary-button', async () => { try { await moveCollection(collectionId, -1); closeDialog(); } catch (error) { displayError(error); } }),
      button('降低优先级', 'secondary-button', async () => { try { await moveCollection(collectionId, 1); closeDialog(); } catch (error) { displayError(error); } }),
    ]));
    if (entries.length) body.push(button('导出当前词表 CSV', 'secondary-button', () => exportCollectionCsv(collectionId)));
    if (annotationCountForCollection(collectionId)) body.push(button('清空当前词表标注', 'secondary-button', async () => { await clearAnnotationsForCollection(collectionId); closeDialog(); }));
    body.push(button('删除词表', 'danger-button', () => confirmDeleteCollection(collectionId)));
    openDialog({ title: '管理词表', body, onSubmit: async () => { await renameCollection(collectionId, name.value, label.value); } });
  } else {
    body.push(el('p', { className: 'help-text', text: '系统短语表由词域自动维护，不能重命名或删除。' }));
    body.push(button('导出当前短语 CSV', 'secondary-button', () => exportCollectionCsv(collectionId)));
    openDialog({ title: '短语表信息', body, onSubmit: null, cancelText: '关闭' });
  }
}

function exportCollectionCsv(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = getVisibleEntries(collectionId);
  const memberships = state.membershipsByCollection.get(collectionId) || [];
  downloadText(`${collection.name}-${new Date().toISOString().slice(0, 10)}.csv`, entriesToCsv(entries, memberships), 'text/csv;charset=utf-8');
  showToast('CSV 已导出');
}

function openImportDialog(collectionId) {
  const fileInput = el('input', { type: 'file', accept: '.json,.csv,.txt,.md,text/plain,application/json,text/csv' });
  const mode = el('select', {}, [el('option', { value: 'merge', text: '合并到当前词表' }), el('option', { value: 'replace', text: '替换当前词表内容' })]);
  const preview = el('div', { className: 'preview-list' }, [el('div', { className: 'preview-item muted', text: '选择文件后显示预览。' })]);
  let parsed = null;
  fileInput.addEventListener('change', async () => {
    try {
      parsed = await readImportFile(fileInput.files?.[0]);
      if (parsed.kind === 'backup') {
        preview.replaceChildren(el('div', { className: 'preview-item', text: '检测到完整备份。请在设置中使用“恢复完整备份”。' }));
        return;
      }
      const items = parsed.entries.slice(0, 80).map((item) => el('div', { className: 'preview-item', text: `${item.text}${item.sourceLabel ? ` · ${item.sourceLabel}` : ''}${item.gloss ? ` · ${item.gloss}` : ''}` }));
      if (parsed.entries.length > 80) items.push(el('div', { className: 'preview-item muted', text: `另有 ${parsed.entries.length - 80} 项未显示` }));
      if (parsed.errors.length) items.unshift(el('div', { className: 'preview-item danger', text: `${parsed.errors.length} 行存在问题，将跳过无效行。` }));
      preview.replaceChildren(...items);
    } catch (error) { parsed = null; preview.replaceChildren(el('div', { className: 'preview-item danger', text: error.message })); }
  });
  openDialog({
    title: '导入词项',
    description: '支持 TXT、Markdown、CSV 和 JSON 词项数组。解析与预览完成前不会修改数据库。',
    body: [field('文件', fileInput), field('导入方式', mode), preview],
    submitText: '执行导入',
    onSubmit: async () => {
      if (!parsed || parsed.kind !== 'entries') throw new Error('请选择有效的词项文件');
      await importEntries(collectionId, parsed.entries, { mode: mode.value });
      showToast(`已导入 ${parsed.entries.length} 项`);
    },
  });
}

function confirmDeleteCollection(collectionId) {
  const collection = getState().collectionById.get(collectionId);
  openDialog({
    title: '删除词表',
    description: `将删除“${collection.name}”的来源关系；仍有其他来源的词项会自动回落。`,
    body: el('div', { className: 'warning-box', text: '该操作可以立即撤销，但建议在大规模修改前先导出完整 JSON。' }),
    submitText: '确认删除', destructive: true,
    onSubmit: async () => { await deleteCollection(collectionId); goHome(); },
  });
}

function confirmDeleteDomain(domainId) {
  const domain = getState().domainById.get(domainId);
  openDialog({ title: '删除整个词域', description: `将删除“${domain.name}”及其中全部词表、词项、PIN 和标注。`, body: el('div', { className: 'warning-box', text: '这是大范围操作。请确认已有完整 JSON 备份。' }), submitText: '确认删除词域', destructive: true, onSubmit: async () => { await deleteDomain(domainId); goHome(); } });
}

function confirmRemoveSource(entryId, collectionId) {
  const entry = getState().entryById.get(entryId);
  openDialog({ title: '移除词表来源', description: `从当前词表移除 “${entry.text}”。`, body: el('p', { className: 'help-text', text: '若它仍属于其他词表，将自动显示在优先级最高的剩余词表；普通词失去全部来源后会被删除。' }), submitText: '移除', destructive: true, onSubmit: async () => { await removeEntryFromCollection(entryId, collectionId); } });
}

function confirmDeleteEntry(entryId) {
  const entry = getState().entryById.get(entryId);
  openDialog({ title: '彻底删除词项', description: `删除 “${entry.text}” 及其全部来源、PIN、标注和短语索引。`, body: el('div', { className: 'warning-box', text: '可通过撤销恢复。' }), submitText: '彻底删除', destructive: true, onSubmit: async () => { await deleteEntry(entryId); } });
}

async function openAiAddDialog(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(collection.domainId);
  const instruction = el('textarea', { required: true, placeholder: '例如：生成 30 个操作系统进程与线程相关的核心英文术语' });
  const resultBox = el('div', { className: 'preview-list hidden' });
  let candidates = [];
  const generate = button('生成候选', 'secondary-button', async () => {
    try {
      generate.disabled = true;
      generate.textContent = '生成中…';
      candidates = await suggestEntries({ domainName: domain.name, collectionName: collection.name, instruction: `${collection.type === 'system-phrases' ? 'Generate multi-word English phrases only. ' : ''}${instruction.value}`, existing: getVisibleEntries(collectionId).map((item) => item.text), glossEnabled: domain.glossEnabled });
      resultBox.classList.remove('hidden');
      resultBox.replaceChildren(...candidates.map((item) => el('div', { className: 'preview-item', text: `${item.text}${item.gloss ? ` · ${item.gloss}` : ''}` })));
    } catch (error) { displayError(error); }
    finally { generate.disabled = false; generate.textContent = '重新生成'; }
  });
  openDialog({
    title: 'AI 新增词项',
    description: '模型目录动态读取，不针对具体模型写兼容分支。候选写入前仍按域内规范词形去重。',
    body: [field('生成要求', instruction), generate, resultBox],
    submitText: '导入候选',
    onSubmit: async () => { if (!candidates.length) throw new Error('请先生成候选'); await importEntries(collectionId, candidates, { mode: 'merge' }); },
  });
}

async function startAiCheck(collectionId) {
  if (activeTask) return;
  const entries = getVisibleEntries(collectionId);
  if (!entries.length) return;
  const controller = new AiCheckController();
  activeTask = { controller, paused: false, completed: 0, total: 1, collectionId };
  renderTaskPanel('准备 AI 核查…');
  try {
    const result = await checkEntries(entries, {
      controller,
      onProgress: (progress) => {
        activeTask.completed = progress.completed;
        activeTask.total = progress.total;
        renderTaskPanel(`批次 ${Math.min(progress.completed + 1, progress.total)} / ${progress.total}`);
      },
      onBatch: async (issues, batch) => { await replaceAnnotations(batch.map((entry) => entry.id), issues); },
    });
    showToast(result.cancelled ? '核查已取消；已完成批次的标注已保留' : 'AI 核查完成');
  } catch (error) { displayError(error); }
  finally { activeTask = null; elements['task-panel'].classList.add('hidden'); renderApp(); }
}

function renderTaskPanel(status) {
  if (!activeTask) { elements['task-panel'].classList.add('hidden'); return; }
  elements['task-panel'].classList.remove('hidden');
  const progress = el('progress', { max: Math.max(activeTask.total, 1), value: activeTask.completed });
  const pause = button(activeTask.paused ? '继续' : '暂停', 'secondary-button compact-button', () => {
    activeTask.paused = !activeTask.paused;
    if (activeTask.paused) activeTask.controller.pause(); else activeTask.controller.resume();
    renderTaskPanel(activeTask.paused ? '已暂停，将在当前请求结束后停止推进' : status);
  });
  const cancel = button('取消', 'danger-button compact-button', () => activeTask.controller.cancel());
  elements['task-panel'].replaceChildren(el('div', { className: 'task-top' }, [
    el('div', { className: 'task-copy' }, [el('strong', { text: 'AI 核查' }), el('span', { text: status })]),
    el('div', { className: 'task-actions' }, [pause, cancel]),
  ]), progress);
}

function annotationReviewIds(collectionId = '') {
  const state = getState();
  const entries = collectionId ? getVisibleEntries(collectionId) : state.entries;
  return [...entries]
    .filter((entry) => state.annotationByEntry.has(entry.id))
    .sort((a, b) => a.domainId.localeCompare(b.domainId) || a.normalizedText.localeCompare(b.normalizedText, 'en'))
    .map((entry) => entry.id);
}

function startAnnotationReview(collectionId = '', startEntryId = '') {
  const ids = annotationReviewIds(collectionId);
  if (!ids.length) { showToast(collectionId ? '当前词表没有待核查标注' : '没有待核查标注'); return; }
  const requestedIndex = startEntryId ? ids.indexOf(startEntryId) : 0;
  review = { ids, index: requestedIndex >= 0 ? requestedIndex : 0, collectionId };
  renderReviewBar();
  jumpToEntry(review.ids[review.index]);
}

function syncReview() {
  const currentId = review.ids[review.index] || '';
  const ids = annotationReviewIds(review.collectionId);
  if (!ids.length) { closeReview(); return false; }
  const currentIndex = currentId ? ids.indexOf(currentId) : -1;
  review.index = currentIndex >= 0 ? currentIndex : Math.min(review.index, ids.length - 1);
  review.ids = ids;
  return true;
}

function renderReviewBar() {
  if (!review.ids.length) { elements['annotation-review-bar'].classList.add('hidden'); return; }
  const state = getState();
  const entryId = review.ids[review.index];
  const entry = state.entryById.get(entryId);
  const annotation = state.annotationByEntry.get(entryId);
  if (!entry || !annotation) { if (syncReview()) renderReviewBar(); return; }
  elements['annotation-review-bar'].classList.remove('hidden');
  elements['annotation-review-bar'].replaceChildren(
    button('←', '', () => { review.index = (review.index - 1 + review.ids.length) % review.ids.length; renderReviewBar(); jumpToEntry(review.ids[review.index]); }),
    el('div', { className: 'review-text', text: `${review.index + 1}/${review.ids.length} ${entry.text} → ${annotation.spelling.suggestion || '需检查'} · ${annotation.reason || ''}` }),
    button('编辑', '', () => openEditEntryDialog(entryId)),
    button('取消标注', '', async () => { try { const oldIndex = review.index; await dismissAnnotation(entryId); review.index = oldIndex; if (syncReview()) { renderReviewBar(); jumpToEntry(review.ids[review.index]); } } catch (error) { displayError(error); } }),
    button('×', '', closeReview),
  );
}

function closeReview() {
  review = { ids: [], index: 0, collectionId: '' };
  elements['annotation-review-bar'].classList.add('hidden');
}

function openSearchDialog() {
  const input = el('input', { type: 'search', placeholder: '搜索英文或中文释义', autocomplete: 'off' });
  const results = el('div', { className: 'search-results' });
  const render = () => {
    const found = search(input.value, { limit: 80 });
    if (!input.value.trim()) { results.replaceChildren(el('p', { className: 'help-text', text: '输入英文、简体或繁体中文。简体查询会匹配规范繁体释义。' })); return; }
    if (!found.length) { results.replaceChildren(el('p', { className: 'help-text', text: '没有匹配结果。' })); return; }
    const state = getState();
    results.replaceChildren(...found.map((entry) => {
      const collectionId = projectionCollectionForEntry(entry.id);
      const collection = state.collectionById.get(collectionId);
      const domain = state.domainById.get(entry.domainId);
      return el('button', { type: 'button', className: 'search-result', on: { click: () => { closeDialog(); navigateCollection(collectionId, entry.id); } } }, [
        el('strong', { text: entry.text }),
        el('span', { text: `${domain?.name || ''} · ${collection?.name || ''}${entry.glossHant ? ` · ${entry.glossHant}` : ''}` }),
      ]);
    }));
  };
  input.addEventListener('input', render);
  render();
  openDialog({ title: '搜索', body: [el('div', { className: 'search-box' }, input), results], onSubmit: null, cancelText: '关闭' });
}

function openSettingsDialog() {
  const key = el('input', { type: 'password', value: getApiKey(), autocomplete: 'off', placeholder: 'gsk_…' });
  const model = el('select');
  const numberMode = el('select', {}, [
    el('option', { value: 'none', text: '不显示序号', selected: getState().settings.numberMode === 'none' }),
    el('option', { value: 'group', text: '每个字母分组重新编号', selected: getState().settings.numberMode === 'group' }),
    el('option', { value: 'global', text: '词表内连续编号', selected: !['none', 'group'].includes(getState().settings.numberMode) }),
  ]);
  const updated = el('p', { className: 'help-text' });
  const renderModels = () => {
    const catalog = getModelCatalog();
    model.replaceChildren(el('option', { value: '', text: catalog.length ? '选择模型' : '尚未刷新模型目录' }), ...catalog.map((item) => el('option', { value: item.id, text: `${item.id}${item.active ? '' : '（历史）'}`, selected: item.id === getSelectedModel() })));
    updated.textContent = getModelCatalogUpdatedAt() ? `最近刷新：${new Date(getModelCatalogUpdatedAt()).toLocaleString()}` : '模型目录尚未刷新。';
  };
  renderModels();
  model.addEventListener('change', () => selectModel(model.value));
  const refresh = button('刷新模型目录', 'secondary-button', async () => {
    try { setApiKey(key.value); refresh.disabled = true; refresh.textContent = '刷新中…'; await refreshModels(); renderModels(); showToast('模型目录已刷新'); }
    catch (error) { displayError(error); }
    finally { refresh.disabled = false; refresh.textContent = '刷新模型目录'; }
  });
  const exportButton = button('导出完整 JSON', 'secondary-button', async () => {
    try { const backup = await exportFullBackup(); downloadText(`vocabulary-index-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(backup, null, 2)}\n`); showToast('完整备份已导出'); }
    catch (error) { displayError(error); }
  });
  const restoreButton = button('恢复完整备份', 'secondary-button', openRestoreDialog);
  const body = [
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Groq' }), field('API Key', key, '仅保存在当前浏览器 localStorage，不进入 JSON 备份。'), field('模型', model), updated, refresh]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号模式', numberMode, '保留 2.4.1 的不显示、分组编号和全局编号三种模式。')]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [exportButton, restoreButton]), el('p', { className: 'help-text', text: '部署 3.0 前必须保留一份 2.4.1 JSON；3.0 数据不能直接由旧版读取。' })]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '版本' }), el('p', { className: 'help-text', text: `Vocabulary Index ${APP_VERSION} · IndexedDB schema 3 · 本地优先` })]),
  ];
  openDialog({ title: '设置', body, submitText: '保存', onSubmit: async () => { setApiKey(key.value); if (model.value) selectModel(model.value); await setNumberMode(numberMode.value); showToast('设置已保存'); } });
}

function openRestoreDialog() {
  const file = el('input', { type: 'file', accept: '.json,application/json' });
  let backup = null;
  const preview = el('div', { className: 'preview-list' }, [el('div', { className: 'preview-item muted', text: '选择 2.x 或 3.0 完整 JSON 备份。' })]);
  file.addEventListener('change', async () => {
    try {
      const parsed = await readImportFile(file.files?.[0]);
      if (parsed.kind !== 'backup') throw new Error('该 JSON 不是完整备份');
      backup = parsed.backup;
      preview.replaceChildren(el('div', { className: 'preview-item', text: `${backup.domains.length} 个词域 · ${backup.collections.length} 个词表 · ${backup.entries.length.toLocaleString()} 个词项` }));
    } catch (error) { backup = null; preview.replaceChildren(el('div', { className: 'preview-item danger', text: error.message })); }
  });
  openDialog({ title: '恢复完整备份', description: '恢复会整体替换当前 3.0 数据并清空撤销历史。', body: [el('div', { className: 'warning-box', text: '先导出当前完整 JSON。请勿在 Safari 与主屏幕 PWA 两个实例中同时执行恢复。' }), field('备份文件', file), preview], submitText: '确认恢复', destructive: true, onSubmit: async () => { if (!backup) throw new Error('请选择有效完整备份'); await restoreBackup(backup); goHome(); showToast('完整备份已恢复'); } });
}

function showMigrationNotice() {
  const state = getState();
  if (!state.settings.migrationNoticePending) return;
  openDialog({
    title: '已升级到 3.0',
    description: `已从 ${state.settings.migrationSource || '2.x'} 迁移到词域数据模型。`,
    body: [
      el('div', { className: 'warning-box', text: '请立即导出一份 3.0 完整 JSON，并在真机验收完成前保留升级前的 2.4.1 JSON。' }),
      el('p', { className: 'help-text', text: '旧词性已作为来源标签保留；主列表不再把词性作为词项身份。每个词域已自动建立系统短语表。' }),
    ],
    submitText: '我已了解',
    onSubmit: acknowledgeMigrationNotice,
  });
}

function renderApp() {
  const route = parseRoute();
  const routeChanged = route.collectionId !== previousRouteCollectionId;
  currentCollectionId = route.collectionId;
  if (route.entryId) pendingJumpEntryId = route.entryId;
  else if (routeChanged && currentCollectionId) {
    const collection = getState().collectionById.get(currentCollectionId);
    pendingJumpEntryId = collection ? getLastPosition(collection.domainId, currentCollectionId) || '' : '';
  }
  previousRouteCollectionId = currentCollectionId;
  if (currentCollectionId) renderCollection(); else renderHome();
  if (review.ids.length) { syncReview(); renderReviewBar(); }
}

async function handleDialogSubmit(event) {
  event.preventDefault();
  if (!dialogSubmitHandler) return;
  const submit = /** @type {HTMLButtonElement | null} */ (elements['dialog-actions'].querySelector('button[type="submit"]'));
  try {
    if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = '处理中…'; }
    await dialogSubmitHandler();
    closeDialog();
    renderApp();
  } catch (error) { displayError(error); }
  finally { if (submit?.isConnected) { submit.disabled = false; submit.textContent = submit.dataset.oldText || '保存'; } }
}

export async function initializeUI() {
  elements['dialog-form'].addEventListener('submit', handleDialogSubmit);
  elements['dialog-close'].addEventListener('click', closeDialog);
  elements['back-button'].addEventListener('click', goHome);
  elements['search-button'].addEventListener('click', openSearchDialog);
  elements['settings-button'].addEventListener('click', openSettingsDialog);
  window.addEventListener('hashchange', renderApp);
  subscribe(({ type }) => {
    if (type === 'external-change') showToast('检测到另一实例的数据更新，已重新载入');
    renderApp();
  });
  await initializeStore();
  elements['boot-screen'].classList.add('hidden');
  elements.app.classList.remove('hidden');
  renderApp();
  setTimeout(showMigrationNotice, 60);
}
