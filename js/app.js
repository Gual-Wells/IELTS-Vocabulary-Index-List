import { initializeDatabase } from './db.js';
import { initializeStore } from './store.js';
import { initializeUI } from './ui.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    registration.update().catch(() => {});
  } catch (error) {
    console.warn('Service Worker 注册失败，应用仍可在线运行。', error);
  }
}

async function start() {
  await initializeDatabase();
  await initializeStore();
  await initializeUI();
  await registerServiceWorker();
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection', event.reason);
});

start().catch((error) => {
  console.error(error);
  document.getElementById('app')?.setAttribute('aria-busy', 'false');
  const main = document.getElementById('main-content');
  if (main) {
    const box = document.createElement('div');
    box.className = 'empty-state';
    box.textContent = `应用启动失败：${error.message}。请重新载入；若问题持续，请清除此站点的本地数据后重试。`;
    main.replaceChildren(box);
  }
});
