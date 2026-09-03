import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadRuntimeSeed } from '../js/v3-db.js';

const originalFetch = globalThis.fetch;
function localAssetFetch({ corrupt = '' } = {}) {
  return async (input) => {
    const url = input instanceof URL ? input : new URL(String(input));
    try {
      let body = await fs.readFile(fileURLToPath(url));
      if (corrupt && url.pathname.endsWith(corrupt)) body = Buffer.concat([body, Buffer.from(' ')]);
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}

test.after(() => { globalThis.fetch = originalFetch; });

test('runtime Seed5 manifest reassembles the full canonical source counts', async () => {
  globalThis.fetch = localAssetFetch();
  const seed = await loadRuntimeSeed();
  const manifest = JSON.parse(await fs.readFile(new URL('../data/seed5-runtime/manifest.json', import.meta.url), 'utf8'));
  assert.equal(seed.settings.builtInSeedRevision, 7);
  assert.equal(seed.entries.length, manifest.counts.entries);
  assert.equal(seed.memberships.length, manifest.counts.memberships);
  assert.equal(seed.relationComponents.length, manifest.counts.relationComponents);
  assert.ok(seed.collections.some((item) => item.name === 'C2'));
});

test('runtime Seed5 loader fails closed when a chunk does not match its declared hash', async () => {
  globalThis.fetch = localAssetFetch({ corrupt: 'entries-000.json' });
  await assert.rejects(loadRuntimeSeed(), /integrity check failed/);
});
