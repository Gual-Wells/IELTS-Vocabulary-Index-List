let installed = false;
let observer = null;

function mirrorSettingsSection() {
  for (const section of document.querySelectorAll('.settings-section')) {
    if (section.querySelector(':scope > h3')?.textContent?.trim() === 'Personal Mirror') return section;
  }
  return null;
}

function statusText(connection) {
  if (connection?.status === 'disabled') return '此设备已断开 · Cloudflare Gateway 保持配置';
  if (connection?.status === 'checking') return '正在检查 Cloudflare Mirror Gateway…';
  if (connection?.status === 'access-required') return 'Cloudflare Access 会话已失效 · 重新打开 VIX 完成验证';
  if (connection?.status === 'unconfigured') return 'Cloudflare Mirror Gateway 尚未初始化';
  if (connection?.status === 'degraded') {
    return `已连接 · ${connection?.lastError || 'Personal Mirror 上游暂时不可达'}`;
  }
  if (!connection?.paired) return connection?.lastError ? `未连接 · ${connection.lastError}` : '未连接';
  const synced = connection.lastSyncedAt
    ? `最近同步 ${new Date(connection.lastSyncedAt).toLocaleString()}`
    : '尚未同步';
  return `已连接 · Cloudflare Gateway · ${synced}`;
}

function setTextIfChanged(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function reflectConnection(connection) {
  const section = mirrorSettingsSection();
  if (!section) return;

  const status = section.querySelector(':scope > .help-text');
  setTextIfChanged(status, statusText(connection));

  const row = section.querySelector(':scope > .settings-row');
  const buttons = row ? [...row.querySelectorAll(':scope > button')] : [];
  if (buttons.length < 4) return;

  const [connect, sync, pick, disconnect] = buttons;
  connect.dataset.mirrorAction = 'connect';
  sync.dataset.mirrorAction = 'sync';
  pick.dataset.mirrorAction = 'pick';
  disconnect.dataset.mirrorAction = 'disconnect';

  setTextIfChanged(connect, connection?.paired ? '重新验证' : connection?.status === 'disabled' ? '重新连接' : '连接');
  const usable = Boolean(connection?.paired);
  if (!sync.textContent?.includes('中')) sync.disabled = !usable;
  pick.disabled = !usable;
  disconnect.disabled = !usable;
}

export function installMirrorSettingsStateBridge(getConnection) {
  if (installed || typeof getConnection !== 'function') return;
  installed = true;

  const refresh = (event) => reflectConnection(event?.detail || getConnection());
  window.addEventListener('vix-mirror-connection', refresh);

  const start = () => {
    observer?.disconnect();
    const host = document.getElementById('app-dialog');
    if (host) {
      observer = new MutationObserver(() => reflectConnection(getConnection()));
      observer.observe(host, { childList: true, subtree: true });
    }
    reflectConnection(getConnection());
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
