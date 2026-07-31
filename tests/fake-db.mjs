const stores = {
  categories: new Map(), entries: new Map(), pins: new Map(), annotations: new Map(), settings: new Map(),
};
let history = [];
let pointer = 0;

const clone = (value) => value == null ? value : structuredClone(value);
const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function mapFor(name) {
  const map = stores[name];
  if (!map) throw new Error(`Unknown fake store ${name}`);
  return map;
}
function current(name, key) {
  if (name === 'settings') return stores.settings.has(key) ? { key, value: clone(stores.settings.get(key)) } : null;
  return clone(mapFor(name).get(key) ?? null);
}
function apply(change, direction) {
  const value = change[direction];
  if (change.store === 'settings') {
    if (value == null) stores.settings.delete(change.key); else stores.settings.set(change.key, clone(value.value));
    return;
  }
  const map = mapFor(change.store);
  if (value == null) map.delete(change.key); else map.set(change.key, clone(value));
}
function verify(changes, direction) {
  for (const item of changes) {
    if (!equal(current(item.store, item.key), item[direction])) throw new Error('fake stale write');
  }
}

function softHistoryChange(item) {
  return item.store === 'annotations' || (item.store === 'settings' && (
    String(item.key).startsWith('lastPosition:') || item.key === 'numberMode'
  ));
}
function applicableHistoryChanges(changes, direction) {
  const applicable = [];
  for (const item of changes) {
    if (equal(current(item.store, item.key), item[direction])) applicable.push(item);
    else if (!softHistoryChange(item)) throw new Error('fake stale history');
  }
  return applicable;
}

function revision() { return Number(stores.settings.get('dataRevision') ?? 0); }
function setRevision(value) { stores.settings.set('dataRevision', Number(value)); }

export function __reset(snapshot) {
  for (const map of Object.values(stores)) map.clear();
  history = [];
  pointer = 0;
  for (const name of ['categories', 'entries', 'pins', 'annotations']) {
    for (const item of snapshot[name] ?? []) mapFor(name).set(name === 'annotations' ? item.entryId : item.id, clone(item));
  }
  for (const [key, value] of Object.entries(snapshot.settings ?? {})) stores.settings.set(key, clone(value));
  if (!stores.settings.has('dataRevision')) setRevision(0);
  stores.settings.set('historyPointer', 0);
}

export async function readDatabaseSnapshot() {
  return {
    categories: [...stores.categories.values()].map(clone),
    entries: [...stores.entries.values()].map(clone),
    pins: [...stores.pins.values()].map(clone),
    annotations: [...stores.annotations.values()].map(clone),
    settings: [...stores.settings].map(([key, value]) => ({ key, value: clone(value) })),
    history: history.map(clone),
  };
}
export async function getSetting(key, fallback = null) { return stores.settings.has(key) ? clone(stores.settings.get(key)) : fallback; }
export async function setSetting(key, value) { stores.settings.set(key, clone(value)); }
export async function historyStatus() {
  return { canUndo: pointer > 0 && Boolean(history[pointer - 1]), canRedo: Boolean(history[pointer]), pointer };
}
export async function commitChanges(label, changes, expectedRevision = null) {
  if (expectedRevision != null && revision() !== Number(expectedRevision)) throw new Error('fake revision conflict');
  verify(changes, 'before');
  history = history.slice(0, pointer);
  changes.forEach((item) => apply(item, 'after'));
  history.push({ sequence: pointer + 1, label, changes: clone(changes) });
  pointer += 1;
  stores.settings.set('historyPointer', pointer);
  setRevision(revision() + 1);
  return { sequence: pointer, changed: true, revision: revision() };
}
export async function writeChangesWithoutHistory(changes, expectedRevision = null) {
  if (expectedRevision != null && revision() !== Number(expectedRevision)) throw new Error('fake revision conflict');
  verify(changes, 'before');
  changes.forEach((item) => apply(item, 'after'));
  setRevision(revision() + 1);
  return { changed: true, revision: revision() };
}
export async function undoHistory(expectedRevision = null) {
  if (expectedRevision != null && revision() !== Number(expectedRevision)) throw new Error('fake revision conflict');
  if (pointer <= 0) return null;
  const record = history[pointer - 1];
  const applicable = applicableHistoryChanges(record.changes, 'after');
  [...applicable].reverse().forEach((item) => apply(item, 'before'));
  pointer -= 1;
  stores.settings.set('historyPointer', pointer);
  setRevision(revision() + 1);
  return clone(record);
}
export async function redoHistory(expectedRevision = null) {
  if (expectedRevision != null && revision() !== Number(expectedRevision)) throw new Error('fake revision conflict');
  const record = history[pointer];
  if (!record) return null;
  const applicable = applicableHistoryChanges(record.changes, 'before');
  applicable.forEach((item) => apply(item, 'after'));
  pointer += 1;
  stores.settings.set('historyPointer', pointer);
  setRevision(revision() + 1);
  return clone(record);
}
