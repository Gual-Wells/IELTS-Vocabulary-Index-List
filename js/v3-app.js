import { initializeUI, notifyServiceWorkerUpdate } from './v3-ui.js';

const HTML_VERSION = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="application-version"]'))?.content || '';
const MODULE_VERSION = '3.0.6';
let reloadingForServiceWorker = false;

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

async function start() {
  if (HTML_VERSION !== MODULE_VERSION) {
    throw new Error(`页面版本 ${HTML_VERSION || '未知'} 与模块版本 ${MODULE_VERSION} 不一致。请完全关闭旧页面并重新打开。`);
  }
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
