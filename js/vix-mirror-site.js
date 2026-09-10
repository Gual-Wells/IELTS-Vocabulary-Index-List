import { exportFullBackup } from './v3-store.js';
import {
  MIRROR_FILE_PROTOCOL, MIRROR_PAIRING_MESSAGE, MIRROR_PICKER_MESSAGE, MIRROR_SERVICE_PROTOCOL,
  createVixSnapshotEnvelope, isMirrorFile,
} from './vix-protocols.js';

const CONFIG_KEY = 'vix.personal-mirror.connection';
export const DEFAULT_MIRROR_SITE_ORIGIN = 'https://vix-personal-mirror.tydw.chatgpt.site';
let fallbackWriteTail = Promise.resolve();

function config() {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return {
      siteOrigin: validOrigin(value.siteOrigin) || DEFAULT_MIRROR_SITE_ORIGIN,
      token: typeof value.token === 'string' && value.token.startsWith('vixm_') ? value.token : '',
      revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : '',
    };
  } catch { return { siteOrigin: DEFAULT_MIRROR_SITE_ORIGIN, token: '', revision: 0, lastSyncedAt: '' }; }
}

function validOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return '';
    return url.origin;
  } catch { return ''; }
}

function save(next) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...config(), ...next }));
  window.dispatchEvent(new CustomEvent('vix-mirror-connection', { detail: getMirrorConnection() }));
}

export function getMirrorConnection() {
  const current = config();
  return { siteOrigin: current.siteOrigin, paired: Boolean(current.token), revision: current.revision, lastSyncedAt: current.lastSyncedAt };
}

export function disconnectMirrorSite() {
  const current = config();
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ siteOrigin: current.siteOrigin, revision: 0, lastSyncedAt: '' }));
  window.dispatchEvent(new CustomEvent('vix-mirror-connection', { detail: getMirrorConnection() }));
}

function withWriteLock(task) {
  if (navigator.locks?.request) return navigator.locks.request('vix-personal-mirror-write', { mode: 'exclusive' }, task);
  const run = fallbackWriteTail.then(task, task);
  fallbackWriteTail = run.catch(() => undefined);
  return run;
}

async function api(path, init = {}) {
  const current = config();
  if (!current.token) throw new Error('Personal Mirror 尚未配对');
  return fetch(`${current.siteOrigin}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...init.headers, authorization: `Bearer ${current.token}` },
  });
}

export function pairMirrorSite({ siteOrigin = DEFAULT_MIRROR_SITE_ORIGIN } = {}) {
  const origin = validOrigin(siteOrigin);
  if (!origin) return Promise.reject(new Error('Mirror Site 地址无效'));
  const popup = window.open(`${origin}/pair?origin=${encodeURIComponent(location.origin)}`, 'vix-personal-mirror-pair', 'popup,width=520,height=620');
  if (!popup) return Promise.reject(new Error('浏览器阻止了配对窗口'));
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Mirror 配对超时')); }, 120000);
    const onMessage = (event) => {
      if (event.origin !== origin || event.data?.type !== MIRROR_PAIRING_MESSAGE || event.data?.protocol !== MIRROR_SERVICE_PROTOCOL) return;
      if (typeof event.data.token !== 'string' || !event.data.token.startsWith('vixm_')) return;
      save({ siteOrigin: origin, token: event.data.token, revision: 0, lastSyncedAt: '' });
      cleanup(); popup.close(); resolve(getMirrorConnection());
    };
    const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener('message', onMessage); };
    window.addEventListener('message', onMessage);
  });
}

export async function synchronizePersonalMirror({ reason = 'manual' } = {}) {
  return withWriteLock(async () => {
    const current = config();
    if (!current.token) throw new Error('请先连接 Personal Mirror');
    let revision = current.revision;
    const head = await api('/api/mirror/snapshot', { method: 'HEAD' });
    if (head.status === 401) throw new Error('Personal Mirror 写入授权已失效，请重新连接');
    if (head.ok) revision = Number(head.headers.get('x-mirror-revision') || revision || 0);
    else if (head.status === 404) revision = 0;
    else throw new Error(`Personal Mirror 状态读取失败（${head.status}）`);
    const backup = await exportFullBackup();
    const envelope = createVixSnapshotEnvelope(backup);
    const response = await api('/api/mirror/snapshot', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'if-match': String(revision), 'x-vix-sync-reason': reason },
      body: JSON.stringify(envelope),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 409) throw new Error('Personal Mirror 正在被另一次写入更新，请重试');
    if (!response.ok) throw new Error(result.error || `Personal Mirror 同步失败（${response.status}）`);
    save({ revision: Number(result.revision || revision + 1), lastSyncedAt: result.updatedAt || new Date().toISOString() });
    return result;
  });
}

export async function writeMirrorFile(nodeId, document) {
  if (!nodeId || !isMirrorFile(document)) throw new Error(`需要 ${MIRROR_FILE_PROTOCOL} 文件`);
  return withWriteLock(async () => {
    const response = await api(`/api/mirror/files/${encodeURIComponent(nodeId)}`, {
      method: 'PUT', headers: { 'content-type': 'application/vnd.vix-mirror+json' }, body: JSON.stringify(document),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Mirror 文件写入失败');
    return result;
  });
}

export async function synchronizeAfterMirrorCommit({ nodeId = '', document = null } = {}) {
  if (nodeId && document) await writeMirrorFile(nodeId, document);
  return synchronizePersonalMirror({ reason: 'mirror-layer2-commit' });
}

export function openMirrorSitePicker() {
  const current = config();
  const dialog = document.createElement('dialog');
  dialog.className = 'mirror-site-picker';
  const iframe = document.createElement('iframe');
  iframe.title = 'Personal Mirror 文件选择器';
  iframe.src = `${current.siteOrigin}/picker?origin=${encodeURIComponent(location.origin)}`;
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'mirror-site-picker-close'; close.textContent = '关闭';
  dialog.append(iframe, close); document.body.append(dialog);
  return new Promise((resolve, reject) => {
    const cleanup = () => { window.removeEventListener('message', onMessage); dialog.remove(); };
    const finish = (value) => { cleanup(); resolve(value); };
    const onMessage = (event) => {
      if (event.origin !== current.siteOrigin || event.data?.type !== MIRROR_PICKER_MESSAGE || event.data?.protocol !== MIRROR_SERVICE_PROTOCOL) return;
      if (event.data.cancelled) { finish(null); return; }
      if (!isMirrorFile(event.data.document)) { cleanup(); reject(new Error('所选文件不符合 Mirror 文件协议')); return; }
      finish({ node: event.data.node, document: event.data.document });
    };
    close.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    window.addEventListener('message', onMessage);
    dialog.showModal();
  });
}
