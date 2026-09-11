import { exportFullBackup } from './v3-store.js';
import {
  MIRROR_FILE_PROTOCOL, MIRROR_PAIRING_MESSAGE, MIRROR_PICKER_MESSAGE, MIRROR_SERVICE_PROTOCOL,
  createVixSnapshotEnvelope, isMirrorFile,
} from './vix-protocols.js';

const CONFIG_KEY = 'vix.personal-mirror.connection';
const PENDING_PAIR_KEY = 'vix.personal-mirror.pending-pair';
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

function pendingPair() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_PAIR_KEY) || '{}');
    const createdAt = Date.parse(value.createdAt || '');
    if (!/^[0-9a-f-]{36}$/i.test(value.state || '') || !validOrigin(value.siteOrigin)
      || !Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) return null;
    return { state: value.state, siteOrigin: validOrigin(value.siteOrigin), returnUrl: String(value.returnUrl || ''), createdAt };
  } catch { return null; }
}

function clearPendingPair() {
  localStorage.removeItem(PENDING_PAIR_KEY);
}

export function consumeMirrorPairingReturn() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const state = params.get('vix-mirror-state') || '';
  const token = params.get('vix-mirror-token') || '';
  if (!state && !token) return false;
  const pending = pendingPair();
  const returnUrl = pending?.returnUrl ? new URL(pending.returnUrl, location.href) : null;
  const exactReturn = returnUrl && returnUrl.origin === location.origin
    && returnUrl.pathname === location.pathname && returnUrl.search === location.search;
  if (!pending || !exactReturn || pending.state !== state || !token.startsWith('vixm_')) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    return false;
  }
  save({ siteOrigin: pending.siteOrigin, token, revision: 0, lastSyncedAt: '' });
  clearPendingPair();
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  return true;
}

export function getMirrorConnection() {
  const current = config();
  return { siteOrigin: current.siteOrigin, paired: Boolean(current.token), revision: current.revision, lastSyncedAt: current.lastSyncedAt };
}

export async function disconnectMirrorSite() {
  const current = config();
  if (current.token) {
    const response = await fetch(`${current.siteOrigin}/api/mirror/pair`, {
      method: 'DELETE', cache: 'no-store', headers: { authorization: `Bearer ${current.token}` },
    });
    if (!response.ok && response.status !== 401) throw new Error(`Personal Mirror 撤销授权失败（${response.status}）`);
  }
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
  const state = crypto.randomUUID();
  const pairUrl = new URL('/pair', origin);
  pairUrl.searchParams.set('origin', location.origin);
  pairUrl.searchParams.set('returnUrl', location.href);
  pairUrl.searchParams.set('state', state);
  localStorage.setItem(PENDING_PAIR_KEY, JSON.stringify({
    state, siteOrigin: origin, returnUrl: location.href, createdAt: new Date().toISOString(),
  }));
  const popup = window.open(pairUrl, 'vix-personal-mirror-pair', 'popup,width=520,height=620');
  if (!popup) {
    clearPendingPair();
    return Promise.reject(new Error('浏览器阻止了配对窗口'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let sessionPollBusy = false;
    const pairingSessionUrl = `${origin}/api/mirror/pair?state=${encodeURIComponent(state)}&origin=${encodeURIComponent(location.origin)}`;
    const claimPairingSession = async () => {
      const response = await fetch(pairingSessionUrl, { cache: 'no-store' });
      if (response.status === 404) return '';
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 410) fail('Mirror 配对会话已过期，请重新连接');
        return '';
      }
      if (result.protocol !== MIRROR_SERVICE_PROTOCOL || result.state !== state
        || typeof result.token !== 'string' || !result.token.startsWith('vixm_')) return '';
      return result.token;
    };
    const finish = (token, { sessionClaimed = false } = {}) => {
      if (settled) return;
      settled = true;
      save({ siteOrigin: origin, token, revision: 0, lastSyncedAt: '' });
      clearPendingPair();
      cleanup();
      if (!sessionClaimed) claimPairingSession().catch(() => {});
      try { popup.close(); } catch {}
      resolve(getMirrorConnection());
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearPendingPair();
      cleanup();
      try { popup.close(); } catch {}
      reject(new Error(message));
    };
    const timeout = window.setTimeout(() => fail('Mirror 配对超时，请重新连接'), 300000);
    const sessionPolling = window.setInterval(async () => {
      if (settled || sessionPollBusy) return;
      sessionPollBusy = true;
      try {
        const token = await claimPairingSession();
        if (token) finish(token, { sessionClaimed: true });
      } catch { /* temporary network loss keeps the other return channels alive */ }
      finally { sessionPollBusy = false; }
    }, 800);
    const polling = window.setInterval(() => {
      if (popup.closed) { fail('Mirror 配对窗口已关闭'); return; }
      try {
        if (popup.location.origin !== location.origin) return;
        const params = new URLSearchParams(popup.location.hash.replace(/^#/, ''));
        const token = params.get('vix-mirror-token') || '';
        if (params.get('vix-mirror-state') === state && token.startsWith('vixm_')) finish(token);
      } catch {}
    }, 400);
    const onMessage = (event) => {
      if (event.source !== popup || event.origin !== origin || event.data?.type !== MIRROR_PAIRING_MESSAGE
        || event.data?.protocol !== MIRROR_SERVICE_PROTOCOL || event.data?.state !== state) return;
      if (typeof event.data.token !== 'string' || !event.data.token.startsWith('vixm_')) return;
      finish(event.data.token);
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(polling);
      window.clearInterval(sessionPolling);
      window.removeEventListener('message', onMessage);
    };
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

export async function writeMirrorFile(nodeId, document, expectedRevision = null) {
  if (!nodeId || !isMirrorFile(document)) throw new Error(`需要 ${MIRROR_FILE_PROTOCOL} 文件`);
  return withWriteLock(async () => {
    const response = await api(`/api/mirror/files/${encodeURIComponent(nodeId)}`, {
      method: 'PUT', headers: {
        'content-type': 'application/vnd.vix-mirror+json',
        ...(Number.isSafeInteger(expectedRevision) && expectedRevision > 0 ? { 'if-match': String(expectedRevision) } : {}),
      }, body: JSON.stringify(document),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Mirror 文件写入失败');
    return result;
  });
}

export async function synchronizeAfterMirrorCommit({ nodeId = '', document = null, expectedRevision = null } = {}) {
  const file = nodeId && document ? await writeMirrorFile(nodeId, document, expectedRevision) : null;
  const snapshot = await synchronizePersonalMirror({ reason: 'mirror-layer2-commit' });
  return { file, snapshot };
}

export async function verifyMirrorFileReference(remote) {
  if (!remote?.nodeId || !remote?.documentId) return true;
  const current = config();
  if (remote.siteOrigin && remote.siteOrigin !== current.siteOrigin) throw new Error('当前 Mirror 来自另一个 Personal Mirror Site，请重新选择文件');
  const response = await api(`/api/mirror/files/${encodeURIComponent(remote.nodeId)}`);
  if (response.status === 404) throw new Error('远端 Mirror 文件已删除，请重新选择文件');
  if (!response.ok) throw new Error(`无法核对远端 Mirror 文件（${response.status}）`);
  const document = await response.json();
  const revision = Number(response.headers.get('x-mirror-file-revision') || 0);
  if (document.documentId !== remote.documentId || (remote.revision && revision !== remote.revision)) {
    throw new Error('远端 Mirror 文件已变化，请重新选择并审核');
  }
  return true;
}

// A Site authorization may return in a new standalone PWA context where the
// original opener and postMessage channel no longer exist. Consume the exact,
// state-bound return fragment during module initialization as the recovery path.
consumeMirrorPairingReturn();

export function openMirrorSitePicker() {
  const current = config();
  const state = crypto.randomUUID();
  const dialog = document.createElement('dialog');
  dialog.className = 'mirror-site-picker';
  const iframe = document.createElement('iframe');
  iframe.title = 'Personal Mirror 文件选择器';
  iframe.src = `${current.siteOrigin}/picker?origin=${encodeURIComponent(location.origin)}&state=${encodeURIComponent(state)}`;
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'mirror-site-picker-close'; close.textContent = '关闭';
  dialog.append(iframe, close); document.body.append(dialog);
  return new Promise((resolve, reject) => {
    const cleanup = () => { window.removeEventListener('message', onMessage); dialog.remove(); };
    const finish = (value) => { cleanup(); resolve(value); };
    const onMessage = (event) => {
      if (event.source !== iframe.contentWindow || event.origin !== current.siteOrigin || event.data?.type !== MIRROR_PICKER_MESSAGE
        || event.data?.protocol !== MIRROR_SERVICE_PROTOCOL || event.data?.state !== state) return;
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
