import { planVixImport } from './v3-exchange.js';

self.addEventListener('message', (event) => {
  const { id, content, currentBackup, selection, conflictPolicy } = event.data || {};
  try {
    const parsed = JSON.parse(String(content || ''));
    const plan = planVixImport(currentBackup, parsed, selection || {}, conflictPolicy || 'current');
    self.postMessage({ id, ok: true, plan });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
  }
});
