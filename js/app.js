import { initializeDatabase, recoverDatabaseFromBackup, resetDatabaseToSeed } from './db.js';
import { APP_VERSION, MAX_IMPORT_BYTES } from './constants.js';
import { initializeInstanceCoordination, initializeStore } from './store.js';
import { initializeUI } from './ui.js';


const RETIRED_CLOUD_STORAGE_KEYS = [
  'gualVocabulary.githubToken',
  'gualVocabulary.githubOwner',
  'gualVocabulary.githubRepo',
  'gualVocabulary.githubBranch',
  'gualVocabulary.githubDeviceName',
  'gualVocabulary.githubDeviceId',
  'gualVocabulary.githubAutoSync',
];

function purgeRetiredCloudStorage() {
  try {
    for (const key of RETIRED_CLOUD_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    // Safari 隐私模式或禁用网站存储时，应用仍继续尝试启动。
  }
}


function verifyDocumentVersion() {
  const documentVersion = document.querySelector('meta[name="application-version"]')?.getAttribute('content');
  if (!documentVersion || documentVersion === APP_VERSION) return true;
  const key = 'gualVocabulary.versionReload';
  try {
    if (sessionStorage.getItem(key) === APP_VERSION) {
      console.warn(`HTML/JavaScript 版本仍不一致：HTML ${documentVersion}, JS ${APP_VERSION}`);
      return true;
    }
    sessionStorage.setItem(key, APP_VERSION);
  } catch { /* storage may be unavailable */ }
  const url = new URL(location.href);
  url.searchParams.set('app-version', APP_VERSION);
  location.replace(url.href);
  return false;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const reloadKey = 'gualVocabulary.swReloaded';
  const sessionGet = () => { try { return sessionStorage.getItem(reloadKey); } catch { return null; } };
  const sessionSet = (value) => { try {
    if (value == null) sessionStorage.removeItem(reloadKey); else sessionStorage.setItem(reloadKey, value);
  } catch { /* storage may be disabled */ } };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionGet() === '1') return;
    sessionSet('1');
    location.reload();
  });
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    await registration.update().catch(() => {});
    // Once the current controller is confirmed, allow a future version change
    // to perform one clean reload instead of mixing old and new modules.
    if (navigator.serviceWorker.controller) sessionSet(null);
  } catch (error) {
    console.warn('Service Worker 注册失败，应用仍可在线运行。', error);
  }
}

async function start() {
  if (!verifyDocumentVersion()) return;
  purgeRetiredCloudStorage();
  await initializeDatabase();
  await initializeStore();
  initializeInstanceCoordination();
  await initializeUI();
  await registerServiceWorker();
}

function reportRuntimeError(error) {
  console.error(error);
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = `运行错误：${error?.message || error}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

window.addEventListener('error', (event) => reportRuntimeError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => reportRuntimeError(event.reason));

start().catch((error) => {
  console.error(error);
  document.getElementById('app')?.setAttribute('aria-busy', 'false');
  const main = document.getElementById('main-content');
  if (main) {
    const box = document.createElement('div');
    box.className = 'empty-state startup-recovery';
    const message = document.createElement('p');
    message.textContent = `应用启动失败：${error.message}。请先关闭此站点的其他标签页或主屏幕实例后重试。若确认本地数据库已损坏，可从 JSON 恢复或重置内置词库。`;
    const actions = document.createElement('div');
    actions.className = 'inline-actions';
    const reloadButton = document.createElement('button');
    reloadButton.type = 'button'; reloadButton.className = 'primary-button'; reloadButton.textContent = '重新载入';
    reloadButton.addEventListener('click', () => location.reload());
    const restoreLabel = document.createElement('label');
    restoreLabel.className = 'secondary-button recovery-file-button';
    restoreLabel.textContent = '从 JSON 恢复';
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.hidden = true;
    restoreLabel.append(fileInput);
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new Error('备份文件超过 64 MB，已拒绝在移动端加载');
        const backup = JSON.parse(await file.text());
        await recoverDatabaseFromBackup(backup);
        location.reload();
      } catch (restoreError) {
        message.textContent = `恢复失败：${restoreError?.message || restoreError}`;
      }
    });
    const resetButton = document.createElement('button');
    resetButton.type = 'button'; resetButton.className = 'danger-button'; resetButton.textContent = '重置内置词库';
    resetButton.addEventListener('click', async () => {
      if (!window.confirm('这会直接清空当前损坏数据库并重新写入内置词库，且无法撤销。继续吗？')) return;
      try { await resetDatabaseToSeed(); location.reload(); }
      catch (resetError) { message.textContent = `重置失败：${resetError?.message || resetError}`; }
    });
    actions.append(reloadButton, restoreLabel, resetButton);
    box.append(message, actions);
    main.replaceChildren(box);
  }
});
