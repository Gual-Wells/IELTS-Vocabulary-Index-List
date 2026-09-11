import { initializeUI, notifyServiceWorkerUpdate, serviceWorkerReloadIsArmed } from './v3-ui.js';
import { createVixSnapshotEnvelope } from './vix-protocols.js';
import { exportLegacyGenerationBackup, getGenerationUpgradeStatus, replaceLegacyGenerationWithSeed } from './v3-db.js';
import { APP_VERSION } from './v5-version.js';

const HTML_VERSION = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="application-version"]'))?.content || '';
const MODULE_VERSION = APP_VERSION;
let reloadingForServiceWorker = false;

const viewportMeta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="viewport"]'));
const STANDALONE = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || Boolean(/** @type {{ standalone?: boolean }} */ (navigator).standalone));
let healthyViewportWidth = Math.min(window.innerWidth, screen.width || window.innerWidth);
let viewportRecoveryTimer = 0;

function configureIPhoneStandaloneShell() {
  document.documentElement.classList.toggle('standalone-pwa', STANDALONE);
  document.documentElement.classList.toggle('browser-tab', !STANDALONE);
}

function rememberHealthyViewport() {
  const width = window.innerWidth;
  if (width > 0 && width <= Math.max(healthyViewportWidth + 12, (screen.width || width) + 12)) {
    healthyViewportWidth = Math.min(healthyViewportWidth || width, width);
  }
}

function recoverStandaloneViewportIfNeeded() {
  if (!STANDALONE || !viewportMeta || document.visibilityState !== 'visible') return;
  clearTimeout(viewportRecoveryTimer);
  viewportRecoveryTimer = window.setTimeout(() => {
    const width = window.innerWidth;
    const abnormal = width > Math.max(healthyViewportWidth + 80, (screen.width || healthyViewportWidth) * 1.35);
    if (!abnormal) {
      rememberHealthyViewport();
      return;
    }
    const canonical = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
    viewportMeta.content = 'width=device-width,initial-scale=1';
    requestAnimationFrame(() => {
      viewportMeta.content = canonical;
      window.dispatchEvent(new Event('resize'));
    });
  }, 80);
}

configureIPhoneStandaloneShell();
window.addEventListener('resize', rememberHealthyViewport, { passive: true });
document.addEventListener('visibilitychange', recoverStandaloneViewportIfNeeded);
window.addEventListener('pageshow', recoverStandaloneViewportIfNeeded);

function watchServiceWorkerRegistration(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) notifyServiceWorkerUpdate(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        notifyServiceWorkerUpdate(registration.waiting || installing);
      }
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First-install clients.claim() is not an update request. Reload only after
    // the user explicitly armed SKIP_WAITING from the update banner.
    if (!serviceWorkerReloadIsArmed() || reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    location.reload();
  });
}

function updateBootProgress(progress = {}) {
  const status = document.querySelector('#boot-screen p');
  const indicator = /** @type {HTMLProgressElement | null} */ (document.getElementById('boot-progress'));
  if (status && progress.label) status.textContent = progress.label;
  if (indicator && Number.isFinite(progress.percent)) indicator.value = Math.max(0, Math.min(100, Number(progress.percent)));
}

function bootChoice(title, description, actions) {
  return new Promise((resolve) => {
    const boot = document.getElementById('boot-screen');
    if (!boot) { resolve(actions[0]?.value); return; }
    boot.replaceChildren();
    const mark = document.createElement('div'); mark.className = 'boot-mark'; mark.textContent = 'V';
    const heading = document.createElement('strong'); heading.textContent = title;
    const copy = document.createElement('p'); copy.textContent = description;
    const row = document.createElement('div'); row.className = 'boot-actions';
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = action.primary ? 'primary-button' : 'secondary-button'; button.textContent = action.label;
      button.addEventListener('click', () => resolve(action.value), { once: true });
      row.append(button);
    }
    boot.append(mark, heading, copy, row);
  });
}

function downloadJsonFile(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleGenerationUpgradeIfNeeded() {
  const status = await getGenerationUpgradeStatus();
  if (!status.required) return;
  const oldLabel = status.fromSchema < status.toSchema
    ? `Schema ${status.fromSchema}`
    : `Seed 世代 ${status.fromSeedRevision}`;
  const choice = await bootChoice('Vocabulary Index 5.1.1', `检测到旧内容世代（${oldLabel}）。5.1.1 会用当前完整 Seed 独立替换，不构造跨世代内容增量迁移。个人 Entry 修改应先按 VIX → Personal Mirror 流程同步；这里还会强制导出一份替换前灾难恢复归档。`, [
    { label: '导出 VIX 恢复快照', value: 'backup', primary: true },
    { label: '取消升级', value: 'cancel', primary: false },
  ]);
  if (choice !== 'backup') throw new Error('升级已取消；旧世代数据保持不变。');
  if (choice === 'backup') {
    const backup = await exportLegacyGenerationBackup();
    downloadJsonFile(`Vocabulary-Index-${backup.appVersion || 'legacy'}-Pre-5.1.1-Recovery.json`, createVixSnapshotEnvelope(backup));
  }
  const confirm = await bootChoice('确认替换内容世代', '将以当前完整 Seed 世代替换旧内容数据库。恢复快照用于整库回到替换前状态，不会把个人 Entry 修改自动叠加到新 Seed；只有已同步到 Personal Mirror 的修改才属于下一 Seed 的依据。', [
    { label: '取消启动', value: 'cancel', primary: false },
    { label: '已同步，替换并进入 5.1.1', value: 'replace', primary: true },
  ]);
  if (confirm !== 'replace') throw new Error('已取消 5.1.1 内容世代替换。旧数据保持不变。');
  await replaceLegacyGenerationWithSeed();
}

async function start() {
  if (HTML_VERSION !== MODULE_VERSION) {
    throw new Error(`页面版本 ${HTML_VERSION || '未知'} 与模块版本 ${MODULE_VERSION} 不一致。请完全关闭旧页面并重新打开。`);
  }
  await handleGenerationUpgradeIfNeeded();
  await initializeUI({ onProgress: updateBootProgress });
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      watchServiceWorkerRegistration(registration);
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('Service Worker 注册失败', error);
    }
  }
}

start().catch((error) => {
  console.error(error);
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = '应用无法安全启动';
    const message = document.createElement('p');
    message.textContent = error?.message || String(error);
    boot.append(title, message);
  }
});
