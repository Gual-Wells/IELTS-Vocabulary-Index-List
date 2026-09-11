import { exportFullBackup } from './v3-store.js';
import { installMirrorSettingsStateBridge } from './v5-mirror-ui-runtime.js';
import {
  MIRROR_FILE_PROTOCOL, MIRROR_PAIRING_MESSAGE, MIRROR_PICKER_MESSAGE, MIRROR_SERVICE_PROTOCOL,
  createVixSnapshotEnvelope, isMirrorFile,
} from './vix-protocols.js';

const CONFIG_KEY = 'vix.personal-mirror.connection';
const PENDING_PAIR_KEY = 'vix.personal-mirror.pending-pair';
const PAIR_TTL_MS = 10 * 60 * 1000;
const PAIR_TIMEOUT_MS = 5 * 60 * 1000;
const PICKER_TIMEOUT_MS = 10 * 60 * 1000;
const VALIDATION_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_MIRROR_SITE_ORIGIN = 'https://vix-personal-mirror.tydw.chatgpt.site';
let fallbackWriteTail = Promise.resolve();
let connectionHealth = 'idle';
let connectionError = '';

function emptyConfig(siteOrigin = DEFAULT_MIRROR_SITE_ORIGIN) {
  return { siteOrigin, token: '', revision: 0, lastSyncedAt: '', validatedAt: '' };
}

function validOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return '';
    return url.origin;
  } catch { return ''; }
}

function config() {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return {
      siteOrigin: validOrigin(value.siteOrigin) || DEFAULT_MIRROR_SITE_ORIGIN,
      token: typeof value.token === 'string' && value.token.startsWith('vixm_') ? value.token : '',
      revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : '',
      validatedAt: typeof value.validatedAt === 'string' ? value.validatedAt : '',
    };
  } catch {
    return emptyConfig();
  }
}

function connectionSnapshot(current = config()) {
  const paired = Boolean(current.token);
  return {
    siteOrigin: current.siteOrigin,
    paired,
    revision: current.revision,
    lastSyncedAt: current.lastSyncedAt,
    validatedAt: current.validatedAt,
    status: paired ? (connectionHealth === 'idle' ? 'restored' : connectionHealth) : 'disconnected',
    lastError: paired ? connectionError : '',
  };
}

function emitConnection() {
  window.dispatchEvent(new CustomEvent('vix-mirror-connection', { detail: connectionSnapshot() }));
}

function save(next, { health = '' } = {}) {
  const merged = { ...config(), ...next };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  if (health) connectionHealth = health;
  if (health !== 'degraded') connectionError = '';
  emitConnection();
  return connectionSnapshot(merged);
}

function markConnectionHealth(health, error = '') {
  if (connectionHealth === health && connectionError === error) return;
  connectionHealth = health;
  connectionError = error;
  emitConnection();
}

function clearAuthorization(message = '') {
  const current = config();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(emptyConfig(current.siteOrigin)));
  connectionHealth = 'disconnected';
  connectionError = message;
  emitConnection();
}

function pendingPair() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_PAIR_KEY) || '{}');
    const createdAt = Date.parse(value.createdAt || '');
    if (!/^[0-9a-f-]{36}$/i.test(value.state || '') || !validOrigin(value.siteOrigin)
      || !Number.isFinite(createdAt) || Date.now() - createdAt > PAIR_TTL_MS) return null;
    return {
      state: value.state,
      siteOrigin: validOrigin(value.siteOrigin),
      returnUrl: String(value.returnUrl || ''),
      createdAt,
    };
  } catch { return null; }
}

function clearPendingPair() {
  localStorage.removeItem(PENDING_PAIR_KEY);
}

function cleanReturnUrl() {
  return `${location.origin}${location.pathname}${location.search}`;
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

  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  if (!pending || !exactReturn || pending.state !== state || !token.startsWith('vixm_')) return false;

  save({
    siteOrigin: pending.siteOrigin,
    token,
    revision: 0,
    lastSyncedAt: '',
    validatedAt: '',
  }, { health: 'paired' });
  clearPendingPair();
  return true;
}

export function getMirrorConnection() {
  return connectionSnapshot();
}

export async function disconnectMirrorSite() {
  const current = config();
  if (current.token) {
    let response;
    try {
      response = await fetch(`${current.siteOrigin}/api/mirror/pair`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: { authorization: `Bearer ${current.token}` },
      });
    } catch (error) {
      markConnectionHealth('degraded', '无法连接 Personal Mirror');
      throw error;
    }
    if (!response.ok && response.status !== 401) {
      throw new Error(`Personal Mirror 撤销授权失败（${response.status}）`);
    }
  }
  clearAuthorization();
}

function withWriteLock(task) {
  if (navigator.locks?.request) {
    return navigator.locks.request('vix-personal-mirror-write', { mode: 'exclusive' }, task);
  }
  const run = fallbackWriteTail.then(task, task);
  fallbackWriteTail = run.catch(() => undefined);
  return run;
}

async function authorizedFetch(path, init = {}) {
  const current = config();
  if (!current.token) throw new Error('Personal Mirror 尚未配对');

  const headers = new Headers(init.headers || {});
  headers.set('authorization', `Bearer ${current.token}`);

  let response;
  try {
    response = await fetch(`${current.siteOrigin}${path}`, {
      ...init,
      cache: 'no-store',
      headers,
    });
  } catch (error) {
    markConnectionHealth('degraded', 'Personal Mirror 暂时不可达');
    throw error;
  }

  if (response.status === 401) {
    clearAuthorization('Personal Mirror 授权已失效');
  } else if ((response.ok || [404, 409, 412].includes(response.status))
    && ['checking', 'degraded'].includes(connectionHealth)) {
    markConnectionHealth('paired');
  }
  return response;
}

async function api(path, init = {}) {
  const response = await authorizedFetch(path, init);
  if (response.status === 401) throw new Error('Personal Mirror 授权已失效，请重新连接');
  return response;
}

export async function validateMirrorConnection({ force = false } = {}) {
  const current = config();
  if (!current.token) return connectionSnapshot(current);

  const validatedAt = Date.parse(current.validatedAt || '');
  if (!force && Number.isFinite(validatedAt) && Date.now() - validatedAt < VALIDATION_TTL_MS) {
    return connectionSnapshot(current);
  }

  markConnectionHealth('checking');
  const response = await authorizedFetch('/api/mirror/snapshot', { method: 'HEAD' });
  if (response.status === 401) return getMirrorConnection();
  if (!response.ok && response.status !== 404) {
    markConnectionHealth('degraded', `Personal Mirror 状态读取失败（${response.status}）`);
    return getMirrorConnection();
  }

  return save({ validatedAt: new Date().toISOString() }, { health: 'paired' });
}

export function pairMirrorSite({ siteOrigin = DEFAULT_MIRROR_SITE_ORIGIN } = {}) {
  const origin = validOrigin(siteOrigin);
  if (!origin) return Promise.reject(new Error('Mirror Site 地址无效'));

  const state = crypto.randomUUID();
  const returnUrl = cleanReturnUrl();
  const pairUrl = new URL('/pair', origin);
  pairUrl.searchParams.set('origin', location.origin);
  pairUrl.searchParams.set('returnUrl', returnUrl);
  pairUrl.searchParams.set('state', state);

  localStorage.setItem(PENDING_PAIR_KEY, JSON.stringify({
    state,
    siteOrigin: origin,
    returnUrl,
    createdAt: new Date().toISOString(),
  }));

  // Pairing is always a first-party/top-level Site flow. Never embed Site login
  // in VIX: WebKit and privacy-oriented browsers can partition or block the
  // session cookie in a third-party frame.
  const popup = window.open(pairUrl.href, 'vix-personal-mirror-pair', 'popup,width=520,height=680');
  if (!popup) {
    // iOS standalone mode may deny a secondary window. The state-bound return
    // fragment is already persisted, so same-window navigation is a safe
    // recovery path and consumeMirrorPairingReturn() will restore the VIX state.
    location.assign(pairUrl.href);
    return new Promise(() => {});
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let sessionPollBusy = false;
    let popupClosedAt = 0;
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
      save({
        siteOrigin: origin,
        token,
        revision: 0,
        lastSyncedAt: '',
        validatedAt: '',
      }, { health: 'paired' });
      clearPendingPair();
      cleanup();
      if (!sessionClaimed) claimPairingSession().catch(() => {});
      try { popup.close(); } catch {}
      validateMirrorConnection({ force: true }).catch(() => {});
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

    const timeout = window.setTimeout(() => fail('Mirror 配对超时，请重新连接'), PAIR_TIMEOUT_MS);

    const sessionPolling = window.setInterval(async () => {
      if (settled || sessionPollBusy) return;
      sessionPollBusy = true;
      try {
        const token = await claimPairingSession();
        if (token) {
          finish(token, { sessionClaimed: true });
          return;
        }
        if (popupClosedAt && Date.now() - popupClosedAt > 1800) fail('Mirror 配对窗口已关闭');
      } catch {
        // Temporary network loss keeps the return/hash/postMessage channels alive.
      } finally {
        sessionPollBusy = false;
      }
    }, 700);

    const popupPolling = window.setInterval(() => {
      if (popup.closed) {
        popupClosedAt ||= Date.now();
        return;
      }
      try {
        if (popup.location.origin !== location.origin) return;
        const params = new URLSearchParams(popup.location.hash.replace(/^#/, ''));
        const token = params.get('vix-mirror-token') || '';
        if (params.get('vix-mirror-state') === state && token.startsWith('vixm_')) finish(token);
      } catch {
        // Cross-origin while the Site owns the popup.
      }
    }, 300);

    const onMessage = (event) => {
      if (event.source !== popup || event.origin !== origin || event.data?.type !== MIRROR_PAIRING_MESSAGE
        || event.data?.protocol !== MIRROR_SERVICE_PROTOCOL || event.data?.state !== state) return;
      if (typeof event.data.token !== 'string' || !event.data.token.startsWith('vixm_')) return;
      finish(event.data.token);
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(popupPolling);
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
    if (head.ok) revision = Number(head.headers.get('x-mirror-revision') || revision || 0);
    else if (head.status === 404) revision = 0;
    else throw new Error(`Personal Mirror 状态读取失败（${head.status}）`);

    const backup = await exportFullBackup();
    const envelope = createVixSnapshotEnvelope(backup);
    const response = await api('/api/mirror/snapshot', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'if-match': String(revision),
        'x-vix-sync-reason': reason,
      },
      body: JSON.stringify(envelope),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 409) throw new Error('Personal Mirror 正在被另一次写入更新，请重试');
    if (!response.ok) throw new Error(result.error || `Personal Mirror 同步失败（${response.status}）`);

    save({
      revision: Number(result.revision || revision + 1),
      lastSyncedAt: result.updatedAt || new Date().toISOString(),
      validatedAt: new Date().toISOString(),
    }, { health: 'paired' });
    return result;
  });
}

export async function writeMirrorFile(nodeId, document, expectedRevision = null) {
  if (!nodeId || !isMirrorFile(document)) throw new Error(`需要 ${MIRROR_FILE_PROTOCOL} 文件`);
  return withWriteLock(async () => {
    const response = await api(`/api/mirror/files/${encodeURIComponent(nodeId)}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/vnd.vix-mirror+json',
        ...(Number.isSafeInteger(expectedRevision) && expectedRevision > 0 ? { 'if-match': String(expectedRevision) } : {}),
      },
      body: JSON.stringify(document),
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
  if (remote.siteOrigin && remote.siteOrigin !== current.siteOrigin) {
    throw new Error('当前 Mirror 来自另一个 Personal Mirror Site，请重新选择文件');
  }
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

export function openMirrorSitePicker() {
  const current = config();
  if (!current.token) return Promise.reject(new Error('请先连接 Personal Mirror'));

  const state = crypto.randomUUID();
  const pickerUrl = new URL('/picker', current.siteOrigin);
  pickerUrl.searchParams.set('origin', location.origin);
  pickerUrl.searchParams.set('state', state);
  pickerUrl.searchParams.set('channel', 'opener');

  // The picker is deliberately top-level. An authenticated Site session inside
  // a cross-origin iframe is not a stable contract on iOS/WebKit and was the
  // source of the 5.1.1 login loop / blocked-login failure.
  const popup = window.open(pickerUrl.href, 'vix-personal-mirror-picker', 'popup,width=640,height=760');
  if (!popup) return Promise.reject(new Error('浏览器阻止了 Mirror 文件选择窗口，请允许弹出窗口后重试'));
  try { popup.focus(); } catch {}

  validateMirrorConnection().catch(() => {});

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(closedPolling);
      window.removeEventListener('message', onMessage);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { popup.close(); } catch {}
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { popup.close(); } catch {}
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const onMessage = (event) => {
      if (event.source !== popup || event.origin !== current.siteOrigin || event.data?.type !== MIRROR_PICKER_MESSAGE
        || event.data?.protocol !== MIRROR_SERVICE_PROTOCOL || event.data?.state !== state) return;
      if (event.data.cancelled) {
        finish(null);
        return;
      }
      if (!event.data.node?.id || !isMirrorFile(event.data.document)) {
        fail(new Error('所选文件不符合 Mirror 文件协议'));
        return;
      }
      finish({ node: event.data.node, document: event.data.document });
    };
    const timeout = window.setTimeout(() => fail(new Error('Mirror 文件选择超时，请重试')), PICKER_TIMEOUT_MS);
    const closedPolling = window.setInterval(() => {
      if (popup.closed) finish(null);
    }, 400);
    window.addEventListener('message', onMessage);
  });
}

installMirrorSettingsStateBridge(getMirrorConnection);

// A Site authorization may return in a new standalone PWA context where the
// original opener and postMessage channel no longer exist. Consume the exact,
// state-bound return fragment during module initialization as the recovery path.
const pairingReturned = consumeMirrorPairingReturn();
if (pairingReturned || config().token) {
  queueMicrotask(() => validateMirrorConnection({ force: pairingReturned }).catch(() => {}));
}
