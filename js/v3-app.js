import { initializeUI, notifyServiceWorkerUpdate } from './v3-ui.js';
import { exportLegacyGenerationBackup, getGenerationUpgradeStatus, replaceLegacyGenerationWithSeed } from './v3-db.js';

const HTML_VERSION = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="application-version"]'))?.content || '';
const MODULE_VERSION = '4.0.2';
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
    if (reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    location.reload();
  });
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
  const choice = await bootChoice('Vocabulary Index 4.0.2', '检测到 3.5.x 内容世代。4.0.2 使用新的 Schema、关系模型与 Seed，旧内容和内容绑定状态不会迁移。你可以先下载完整旧版备份。', [
    { label: '先下载备份', value: 'backup', primary: true },
    { label: '不备份继续', value: 'continue', primary: false },
  ]);
  if (choice === 'backup') {
    const backup = await exportLegacyGenerationBackup();
    downloadJsonFile(`Vocabulary-Index-${backup.appVersion || '3.5.2'}-Pre-4.0.2-Backup.json`, backup);
  }
  const confirm = await bootChoice('确认替换内容世代', '将清除旧 Seed、用户自建内容、PIN、学习日期、标注、浏览状态与撤销历史；Groq / Collins Key、模型选择和一般显示偏好不属于旧内容数据。此操作不能由 4.0.2 撤销。', [
    { label: '取消启动', value: 'cancel', primary: false },
    { label: '替换并进入 4.0.2', value: 'replace', primary: true },
  ]);
  if (confirm !== 'replace') throw new Error('已取消 4.0.2 内容世代替换。旧数据保持不变。');
  await replaceLegacyGenerationWithSeed();
}

async function start() {
  if (HTML_VERSION !== MODULE_VERSION) {
    throw new Error(`页面版本 ${HTML_VERSION || '未知'} 与模块版本 ${MODULE_VERSION} 不一致。请完全关闭旧页面并重新打开。`);
  }
  await handleGenerationUpgradeIfNeeded();
  await initializeUI();
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
