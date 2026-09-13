// @ts-check
import { deleteCollinsSecret, saveCollinsSecret } from './v5-collins-bridge.js';

const host = document.getElementById('app-dialog');

function fieldInput(root, labelText) {
  for (const label of root.querySelectorAll('label.field')) {
    const caption = label.querySelector(':scope > span')?.textContent?.trim();
    if (caption === labelText) return label.querySelector('input');
  }
  return null;
}

function activeBridgeFrame() {
  if (!host || host.classList.contains('hidden')) return null;
  const frames = [...host.querySelectorAll('.modal-layer:not([aria-hidden="true"])')];
  for (const frame of frames.reverse()) {
    const heading = frame.querySelector('.dialog-header h2')?.textContent?.trim();
    if (heading === 'Bridge') return frame;
  }
  return null;
}

function bridgeConfig(frame) {
  const urlInput = fieldInput(frame, 'Bridge URL');
  const tokenInput = fieldInput(frame, 'Device Token');
  return {
    url: String(urlInput?.value || '').trim().replace(/\/+$/, ''),
    deviceToken: String(tokenInput?.value || '').trim(),
  };
}

function setStatus(node, message, kind = '') {
  node.textContent = message;
  if (kind) node.dataset.kind = kind;
  else delete node.dataset.kind;
}

async function readCollinsState(config) {
  if (!config.url || !config.deviceToken) return 'missing-bridge';
  let endpoint;
  try { endpoint = new URL('/v1/status', `${config.url}/`).href; }
  catch { return 'missing-bridge'; }
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${config.deviceToken}`,
      'x-vix-device-token': config.deviceToken,
      'x-vix-client': 'vix-web',
    },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Bridge 状态请求失败（HTTP ${response.status}）`);
  return String(payload?.collinsState || (payload?.collins ? 'ready' : 'missing'));
}

function stateLabel(state) {
  if (state === 'ready') return ['Collins Key 已保存在 Bridge，可直接查询。', 'ready'];
  if (state === 'master_key_mismatch') return ['Collins Key 与当前 Bridge Master Key 不匹配，请重新保存。', 'error'];
  if (state === 'unreadable') return ['Collins Key 无法读取，请重新保存。', 'error'];
  if (state === 'missing-bridge') return ['先填写 Bridge URL 与 Device Token，再保存 Collins Key。', ''];
  return ['Bridge 尚未保存 Collins API Key。', ''];
}

async function refreshStatus(frame, status) {
  try {
    setStatus(status, '正在读取 Collins 配置…');
    const [message, kind] = stateLabel(await readCollinsState(bridgeConfig(frame)));
    setStatus(status, message, kind);
  } catch (error) {
    setStatus(status, error?.message || '无法读取 Collins 配置状态。', 'error');
  }
}

function installCollinsSettings(frame) {
  if (!frame || frame.querySelector('.collins-bridge-settings')) return;
  const body = frame.querySelector('.dialog-body');
  if (!body) return;

  const section = document.createElement('section');
  section.className = 'collins-bridge-settings';

  const title = document.createElement('h3');
  title.textContent = 'Collins';

  const label = document.createElement('label');
  label.className = 'collins-bridge-field';
  const caption = document.createElement('span');
  caption.textContent = 'Collins API Key';
  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'credential-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Collins API Key';
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-1p-ignore', 'true');
  input.setAttribute('data-bwignore', 'true');
  label.append(caption, input);

  const actions = document.createElement('div');
  actions.className = 'collins-bridge-actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary-button';
  save.textContent = '保存 Collins Key';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary-button';
  remove.textContent = '删除 Collins Key';
  actions.append(save, remove);

  const status = document.createElement('p');
  status.className = 'collins-bridge-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  save.addEventListener('click', async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      setStatus(status, '请填写 Collins API Key。', 'error');
      input.focus();
      return;
    }
    const config = bridgeConfig(frame);
    save.disabled = true;
    remove.disabled = true;
    const oldText = save.textContent;
    save.textContent = '验证并保存中…';
    try {
      await saveCollinsSecret(apiKey, { config });
      input.value = '';
      setStatus(status, 'Collins Key 已验证并安全保存到 Bridge。', 'ready');
    } catch (error) {
      setStatus(status, error?.message || 'Collins Key 保存失败。', 'error');
    } finally {
      if (save.isConnected) {
        save.disabled = false;
        remove.disabled = false;
        save.textContent = oldText;
      }
    }
  });

  remove.addEventListener('click', async () => {
    const config = bridgeConfig(frame);
    save.disabled = true;
    remove.disabled = true;
    const oldText = remove.textContent;
    remove.textContent = '删除中…';
    try {
      await deleteCollinsSecret({ config });
      input.value = '';
      setStatus(status, 'Collins Key 已从 Bridge 删除。');
    } catch (error) {
      setStatus(status, error?.message || 'Collins Key 删除失败。', 'error');
    } finally {
      if (remove.isConnected) {
        save.disabled = false;
        remove.disabled = false;
        remove.textContent = oldText;
      }
    }
  });

  section.append(title, label, actions, status);

  const resources = body.querySelector('.bridge-integration-resources');
  if (resources) body.insertBefore(section, resources);
  else body.append(section);
  refreshStatus(frame, status);
}

function scan() {
  installCollinsSettings(activeBridgeFrame());
}

if (host) {
  new MutationObserver(scan).observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  scan();
}
