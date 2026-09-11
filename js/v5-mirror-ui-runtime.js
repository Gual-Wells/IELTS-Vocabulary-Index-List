let installed = false;
let observer = null;

function mirrorSettingsSection() {
  for (const section of document.querySelectorAll('.settings-section')) {
    if (section.querySelector(':scope > h3')?.textContent?.trim() === 'Personal Mirror') return section;
  }
  return null;
}

function statusText(connection) {
  if (!connection?.paired) {
    return connection?.lastError
      ? `未连接 · ${connection.lastError}`
      : 'Site 与 VIX 版本、seed 世代相互独立。';
  }
  if (connection.status === 'checking') return '已连接 · 正在验证授权…';
  if (connection.status === 'degraded') return `已连接 · ${connection.lastError || 'Personal Mirror 暂时不可达'}`;
  return `已连接 · ${connection.lastSyncedAt
    ? `最近同步 ${new Date(connection.lastSyncedAt).toLocaleString()}`
    : '尚未同步'}`;
}

function reflectConnection(connection) {
  const section = mirrorSettingsSection();
  if (!section) return;

  const status = section.querySelector(':scope > .help-text');
  if (status) status.textContent = statusText(connection);

  const row = section.querySelector(':scope > .settings-row');
  const buttons = row ? [...row.querySelectorAll(':scope > button')] : [];
  if (buttons.length < 4) return;

  const [connect, sync, pick, disconnect] = buttons;
  connect.dataset.mirrorAction = 'connect';
  sync.dataset.mirrorAction = 'sync';
  pick.dataset.mirrorAction = 'pick';
  disconnect.dataset.mirrorAction = 'disconnect';

  connect.textContent = connection?.paired ? '重新连接' : '连接';
  if (!connection?.paired) {
    sync.disabled = true;
    pick.disabled = true;
    disconnect.disabled = true;
  } else {
    // Connection changes must make controls usable immediately without closing
    // and reopening Settings. Do not touch a control while its own handler is
    // presenting an explicit busy state.
    if (!sync.textContent?.includes('中')) sync.disabled = false;
    pick.disabled = false;
    disconnect.disabled = false;
  }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
