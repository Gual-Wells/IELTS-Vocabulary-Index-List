import { exportFullBackup } from './v3-store.js';
import {
  MIRROR_FILE_PROTOCOL, createVixSnapshotEnvelope, isMirrorFile,
} from './vix-protocols.js';
import { installMirrorSettingsStateBridge } from './v5-mirror-ui-runtime.js';

const CONFIG_KEY = 'vix.personal-mirror.connection';
const DEFAULT_UPSTREAM_ORIGIN = 'https://vix-personal-mirror.tydw.chatgpt.site';
const GATEWAY_STATUS_PATH = '/api/mirror-gateway/status';
const GATEWAY_BOOTSTRAP_PATH = '/api/mirror-gateway/bootstrap';
const VALIDATION_TTL_MS = 5 * 60 * 1000;
let fallbackWriteTail = Promise.resolve();
let connectionStatus = 'checking';
let connectionError = '';
let gatewayConfigured = false;
let gatewayHealthy = false;
let validationPromise = null;

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
      siteOrigin: validOrigin(value.siteOrigin) || DEFAULT_UPSTREAM_ORIGIN,
      token: typeof value.token === 'string' && value.token.startsWith('vixm_') ? value.token : '',
      revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : '',
      validatedAt: typeof value.validatedAt === 'string' ? value.validatedAt : '',
      gateway: value.gateway === true,
      disabled: value.disabled === true,
    };
  } catch {
    return {
      siteOrigin: DEFAULT_UPSTREAM_ORIGIN, token: '', revision: 0, lastSyncedAt: '',
      validatedAt: '', gateway: false, disabled: false,
    };
  }
}

function save(next) {
  const current = config();
  const merged = { ...current, ...next };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  emitConnection();
  return merged;
}

function connectionSnapshot() {
  const current = config();
  const paired = gatewayConfigured && !current.disabled;
  return {
    siteOrigin: current.siteOrigin,
    paired,
    revision: current.revision,
    lastSyncedAt: current.lastSyncedAt,
    validatedAt: current.validatedAt,
    status: current.disabled ? 'disabled' : connectionStatus,
    lastError: connectionError,
    gateway: true,
    gatewayConfigured,
    gatewayHealthy,
  };
}

function emitConnection() {
  window.dispatchEvent(new CustomEvent('vix-mirror-connection', { detail: connectionSnapshot() }));
}

function setConnection(status, { error = '', configured = gatewayConfigured, healthy = gatewayHealthy } = {}) {
  connectionStatus = status;
  connectionError = error;
  gatewayConfigured = Boolean(configured);
  gatewayHealthy = Boolean(healthy);
  emitConnection();
}

async function gatewayRequest(path, init = {}) {
  return fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json', ...init.headers },
  });
}

async function gatewayStatus({ probe = false } = {}) {
  const response = await gatewayRequest(`${GATEWAY_STATUS_PATH}${probe ? '?probe=1' : ''}`);
  if (response.status === 401) {
    setConnection('access-required', { error: 'Cloudflare Access 会话已失效', configured: gatewayConfigured, healthy: false });
    return { configured: gatewayConfigured, healthy: false, accessRequired: true };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Mirror Gateway 状态读取失败（${response.status}）`);
  return payload;
}

async function bootstrapGatewayFromLegacy() {
  const current = config();
  if (!current.token) return null;
  setConnection('checking', { configured: false, healthy: false });
  const response = await gatewayRequest(GATEWAY_BOOTSTRAP_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteOrigin: current.siteOrigin, token: current.token }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    setConnection('access-required', { error: 'Cloudflare Access 会话已失效', configured: false, healthy: false });
    throw new Error('Cloudflare Access 会话已失效，请重新打开 VIX 完成验证');
  }
  if (!response.ok || !payload?.configured) {
    throw new Error(payload?.error?.message || `Mirror Gateway 初始化失败（${response.status}）`);
  }
  const now = payload.lastVerifiedAt || new Date().toISOString();
  save({
    siteOrigin: validOrigin(payload.upstreamOrigin) || current.siteOrigin,
    token: '',
    gateway: true,
    disabled: false,
    validatedAt: now,
  });
  gatewayConfigured = true;
  gatewayHealthy = payload.healthy !== false;
  connectionStatus = gatewayHealthy ? 'connected' : 'degraded';
  connectionError = gatewayHealthy ? '' : 'Personal Mirror 上游暂时不可达';
  emitConnection();
  return payload;
}

export function getMirrorConnection() {
  return connectionSnapshot();
}

export async function validateMirrorConnection({ force = false } = {}) {
  if (validationPromise) return validationPromise;
  const current = config();
  if (current.disabled) {
    setConnection('disabled', { configured: gatewayConfigured || current.gateway, healthy: false });
    return getMirrorConnection();
  }
  const validatedAt = Date.parse(current.validatedAt || '');
  if (!force && current.gateway && gatewayConfigured && Number.isFinite(validatedAt)
    && Date.now() - validatedAt < VALIDATION_TTL_MS && connectionStatus === 'connected') {
    return getMirrorConnection();
  }

  validationPromise = (async () => {
    setConnection('checking', { configured: gatewayConfigured || current.gateway, healthy: false });
    let status = await gatewayStatus({ probe: true });
    if (status.accessRequired) return getMirrorConnection();

    if (!status.configured && current.token) {
      await bootstrapGatewayFromLegacy();
      status = await gatewayStatus({ probe: true });
    }

    if (!status.configured) {
      setConnection('unconfigured', {
        error: current.token ? '旧授权未能迁移到 Cloudflare Gateway' : '需要先初始化 Personal Mirror Gateway',
        configured: false,
        healthy: false,
      });
      return getMirrorConnection();
    }

    const upstreamOrigin = validOrigin(status.upstreamOrigin) || current.siteOrigin;
    const now = status.lastVerifiedAt || (status.healthy ? new Date().toISOString() : current.validatedAt);
    save({ siteOrigin: upstreamOrigin, gateway: true, token: '', validatedAt: now || '', disabled: false });
    if (status.healthy) {
      setConnection('connected', { configured: true, healthy: true });
    } else {
      setConnection('degraded', {
        error: status.upstreamStatus === 401 ? 'Gateway 上游 capability 已失效' : 'Personal Mirror 上游暂时不可达',
        configured: true,
        healthy: false,
      });
    }
    return getMirrorConnection();
  })().catch((error) => {
    setConnection('degraded', {
      error: error?.message || 'Cloudflare Mirror Gateway 暂时不可达',
      configured: gatewayConfigured || current.gateway,
      healthy: false,
    });
    return getMirrorConnection();
  }).finally(() => { validationPromise = null; });

  return validationPromise;
}

export async function pairMirrorSite() {
  const current = config();
  if (current.disabled) save({ disabled: false });
  const status = await validateMirrorConnection({ force: true });
  if (status.paired) return status;
  if (current.token) {
    await bootstrapGatewayFromLegacy();
    return validateMirrorConnection({ force: true });
  }
  throw new Error('Cloudflare Mirror Gateway 尚未初始化；请先在保留旧 5.1.1 Mirror 授权的设备上打开新版 VIX 完成一次自动迁移');
}

export async function disconnectMirrorSite() {
  save({ disabled: true });
  setConnection('disabled', { configured: gatewayConfigured || config().gateway, healthy: false });
  return getMirrorConnection();
}

function withWriteLock(task) {
  if (navigator.locks?.request) return navigator.locks.request('vix-personal-mirror-write', { mode: 'exclusive' }, task);
  const run = fallbackWriteTail.then(task, task);
  fallbackWriteTail = run.catch(() => undefined);
  return run;
}

async function api(path, init = {}) {
  const current = config();
  if (current.disabled) throw new Error('此设备已断开 Personal Mirror');
  if (!gatewayConfigured) {
    const connection = await validateMirrorConnection({ force: true });
    if (!connection.paired) throw new Error(connection.lastError || 'Cloudflare Mirror Gateway 尚未连接');
  }
  const response = await gatewayRequest(path, init);
  if (response.status === 401) {
    setConnection('access-required', { error: 'Cloudflare Access 会话已失效', configured: gatewayConfigured, healthy: false });
  } else if (response.status === 503) {
    setConnection('degraded', { error: 'Cloudflare Mirror Gateway 尚未配置或暂时不可用', configured: gatewayConfigured, healthy: false });
  } else if (response.ok && connectionStatus !== 'connected') {
    setConnection('connected', { configured: true, healthy: true });
  }
  return response;
}

export async function synchronizePersonalMirror({ reason = 'manual' } = {}) {
  return withWriteLock(async () => {
    const current = config();
    let revision = current.revision;
    const head = await api('/api/mirror/snapshot', { method: 'HEAD' });
    if (head.status === 401) throw new Error('Cloudflare Access 会话已失效，请重新打开 VIX');
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
    if (!response.ok) throw new Error(result?.error?.message || result.error || `Personal Mirror 同步失败（${response.status}）`);
    save({
      revision: Number(result.revision || revision + 1),
      lastSyncedAt: result.updatedAt || new Date().toISOString(),
      validatedAt: new Date().toISOString(),
      gateway: true,
      disabled: false,
    });
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
    if (!response.ok) throw new Error(result?.error?.message || result.error || 'Mirror 文件写入失败');
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

function normalizeNodes(payload) {
  const nodes = payload?.data?.nodes || payload?.nodes || [];
  return Array.isArray(nodes) ? nodes.filter((node) => node && node.kind === 'file' && node.id) : [];
}

async function listMirrorFiles(query = '') {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
  const response = await api(`/api/mirror/nodes${suffix}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload.error || `Mirror 文件列表读取失败（${response.status}）`);
  return normalizeNodes(payload);
}

async function readMirrorFile(node) {
  const response = await api(`/api/mirror/files/${encodeURIComponent(node.id)}`);
  if (!response.ok) throw new Error(`Mirror 文件读取失败（${response.status}）`);
  const document = await response.json();
  if (!isMirrorFile(document)) throw new Error('所选文件不符合 Mirror 文件协议');
  return { node, document };
}

export function openMirrorSitePicker() {
  const current = getMirrorConnection();
  if (!current.paired) return Promise.reject(new Error('请先连接 Personal Mirror'));

  const dialog = document.createElement('dialog');
  dialog.className = 'mirror-site-picker mirror-native-picker';
  const shell = document.createElement('div');
  shell.className = 'mirror-native-picker-shell';
  const header = document.createElement('header');
  header.className = 'mirror-native-picker-header';
  const title = document.createElement('div');
  title.innerHTML = '<strong>选择 Mirror 文件</strong><span>Cloudflare Gateway · PWA 内完成</span>';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'mirror-native-picker-close'; close.textContent = '关闭';
  header.append(title, close);
  const search = document.createElement('input');
  search.type = 'search'; search.className = 'mirror-native-picker-search'; search.placeholder = '搜索 Mirror 文件';
  search.autocomplete = 'off'; search.spellcheck = false;
  const status = document.createElement('p');
  status.className = 'mirror-native-picker-status'; status.textContent = '正在读取…';
  const list = document.createElement('div');
  list.className = 'mirror-native-picker-list';
  shell.append(header, search, status, list);
  dialog.append(shell);
  document.body.append(dialog);

  return new Promise((resolve, reject) => {
    let settled = false;
    let requestId = 0;
    let timer = 0;

    const cleanup = () => {
      clearTimeout(timer);
      dialog.remove();
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error || 'Mirror 文件选择失败')));
    };

    const render = async (query = '') => {
      const id = ++requestId;
      status.textContent = '正在读取…';
      list.replaceChildren();
      try {
        const nodes = await listMirrorFiles(query.trim());
        if (id !== requestId || settled) return;
        if (!nodes.length) {
          status.textContent = query.trim() ? '没有匹配的 Mirror 文件' : 'Mirror 中暂无可选文件';
          return;
        }
        status.textContent = `${nodes.length} 个文件`;
        for (const node of nodes) {
          const item = document.createElement('button');
          item.type = 'button'; item.className = 'mirror-native-picker-item';
          const name = document.createElement('strong'); name.textContent = node.name || node.id;
          const meta = document.createElement('span');
          meta.textContent = `revision ${Number(node.revision || 0) || '—'}${node.updatedAt ? ` · ${new Date(node.updatedAt).toLocaleString()}` : ''}`;
          item.append(name, meta);
          item.addEventListener('click', async () => {
            if (settled) return;
            item.disabled = true;
            status.textContent = `正在打开 ${node.name || 'Mirror 文件'}…`;
            try { finish(await readMirrorFile(node)); }
            catch (error) { fail(error); }
          });
          list.append(item);
        }
      } catch (error) {
        if (id !== requestId || settled) return;
        fail(error);
      }
    };

    close.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => render(search.value), 220);
    });
    dialog.showModal();
    render();
  });
}

installMirrorSettingsStateBridge(getMirrorConnection);
queueMicrotask(() => { validateMirrorConnection({ force: true }).catch(() => {}); });
