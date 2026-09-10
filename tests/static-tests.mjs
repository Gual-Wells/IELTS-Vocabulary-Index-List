import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const index = read('index.html');
const ui = read('js/v3-ui.js');
const model = read('js/v3-model.js');
const store = read('js/v3-store.js');
const db = read('js/v3-db.js');
const exchange = read('js/v3-exchange.js');
const protocols = read('js/vix-protocols.js');
const mirrorClient = read('js/vix-mirror-site.js');
const groqClient = read('js/vix-provider-site.js');
const css = read('css/v5.1.0.css');
const sw = read('sw.js');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const seedRuntimeManifest = JSON.parse(read('data/seed5-runtime/manifest.json'));

assert.equal(pkg.version, '5.1.0');
assert.ok(index.includes('Vocabulary Index 5.1.0'));
assert.ok(index.includes('css/v5.1.0.css'));
assert.ok(sw.includes('v5.1.0-shell-20260909-1'));
assert.ok(index.includes("frame-src 'self' https://vix-personal-mirror.tydw.chatgpt.site"));
assert.equal(manifest.name, 'Vocabulary Index');

// Protocol identities have independent lifecycles and carry no app release.
for (const id of ['vix-data-exchange/1', 'vix-mirror-service/1', 'vix-mirror-file/1']) assert.ok(protocols.includes(id));
assert.ok(protocols.includes('domain-local-dedup'));
assert.ok(protocols.includes('collection-priority-membership'));
assert.ok(!protocols.includes('5.1.0'));
assert.ok(exchange.includes("export const VIX_VERSION = 2"));
assert.ok(exchange.includes("kind: 'increment'"));
assert.ok(store.includes('export async function applyVixIncrement'));
assert.ok(ui.includes('await applyVixIncrement(finalPlan.package'));
assert.ok(ui.includes('importMirrorCandidates(candidates'));
assert.ok(ui.includes("accept: '.json,application/json'"));
assert.ok(!ui.includes('openImportDialog'));
assert.ok(!ui.includes('exportCollectionCsv'));
assert.ok(!ui.includes("value: 'export-backup'"));
assert.ok(!ui.includes('annotation'));
assert.ok(!ui.includes('AI 核查'));
assert.ok(!exists('js/v3-import.js'));

// Current runtime fields are compact; legacy fields are accepted only at boundaries.
assert.ok(model.includes('gloss: normalizedGloss'));
assert.ok(model.includes('order: Number.isFinite(order)'));
assert.ok(store.includes('export async function undo()'));
assert.ok(store.includes('return false;'));
assert.ok(db.includes("tx.objectStore(STORES.history).clear()"));
assert.ok(db.includes("tx.objectStore(STORES.annotations).clear()"));

// Personal Mirror is the only live persistence/provider backend.
for (const old of ['bridge/wrangler.jsonc', 'bridge/src/index.js', 'bridge/package.json']) assert.ok(!exists(old));
assert.ok(mirrorClient.includes('https://vix-personal-mirror.tydw.chatgpt.site'));
assert.ok(mirrorClient.includes("navigator.locks?.request"));
assert.ok(mirrorClient.includes("'/api/mirror/snapshot'"));
assert.ok(mirrorClient.includes('/picker?origin='));
assert.ok(groqClient.includes("'/api/groq/chat'"));
assert.ok(groqClient.includes("'/api/groq/speech'"));
assert.ok(!groqClient.includes('googleapis.com'));
assert.ok(!groqClient.includes('/v1/tts/synthesize'));
assert.ok(ui.includes('canopylabs/orpheus-v1-english'));
for (const voice of ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy']) assert.ok(ui.includes(`'${voice}'`));
assert.ok(ui.includes('SpeechSynthesisUtterance'));

// Mirror manager/picker and hidden database use Site-native persistent bindings.
const siteRoot = path.join(root, 'mirror-site');
const hosting = JSON.parse(fs.readFileSync(path.join(siteRoot, '.openai/hosting.json'), 'utf8'));
assert.equal(hosting.d1, 'DB');
assert.equal(hosting.r2, 'FILES');
for (const file of [
  'app/page.tsx', 'app/picker/page.tsx', 'app/pair/page.tsx',
  'app/api/mirror/snapshot/route.ts', 'app/api/mirror/nodes/route.ts', 'app/api/mirror/files/[id]/route.ts',
  'app/api/groq/chat/route.ts', 'app/api/groq/speech/route.ts', 'app/api/groq/settings/route.ts',
  'drizzle/0000_personal_mirror.sql',
]) assert.ok(fs.existsSync(path.join(siteRoot, file)), `Mirror Site asset missing: ${file}`);
const siteProtocol = fs.readFileSync(path.join(siteRoot, 'lib/mirror-protocol.ts'), 'utf8');
assert.ok(siteProtocol.includes('groq.speech.proxy'));
assert.ok(!siteProtocol.includes('5.1.0'));
const siteDrive = fs.readFileSync(path.join(siteRoot, 'components/mirror-drive.tsx'), 'utf8');
assert.ok(siteDrive.includes("mode: 'manager'" ) || siteDrive.includes("DriveMode"));
assert.ok(siteDrive.includes('vix-mirror-selection'));
assert.ok(!siteDrive.includes('snapshotKey'));

// VIX Function reads the latest snapshot and only submits protocol-validated Mirror files.
const functionScript = read('integration/vix-function/VIX-Function.ps1');
const functionInstructions = read('integration/vix-function/VIX_PERSONALIZED_INSTRUCTIONS.md');
for (const marker of ['vix-function/1', 'vix-function-context/1', 'vix-mirror-file/1', '/api/mirror/snapshot', '/api/mirror/nodes']) assert.ok(functionScript.includes(marker));
assert.ok(!functionScript.includes('/v1/runs'));
assert.ok(!functionScript.includes('Agent Token'));
assert.ok(functionInstructions.includes('Chunk the source by semantic boundaries'));
assert.ok(functionInstructions.includes('substantive Traditional Chinese'));
assert.ok(functionInstructions.includes('Ordinary ChatGPT access to Personal Mirror is read-only'));
assert.ok(!functionInstructions.includes('WebMCP'));

// UI depth is conveyed by perimeter elevation, never by a dim mask.
assert.ok(css.includes('box-shadow: var(--page-surface-shadow)'));
assert.ok(css.includes('background: transparent'));
assert.ok(css.includes('.mirror-site-picker::backdrop'));
assert.ok(css.includes('.entry-line'));
assert.ok(ui.includes("button('全部展开'"));
assert.ok(ui.includes('expandAllCurrentGroups'));

// PWA shell remains local and precache entries are present exactly once.
assert.ok(!/<script[^>]+src=["']https?:/i.test(index));
assert.ok(!/<link[^>]+href=["']https?:/i.test(index));
const body = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...body.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(precache.length, new Set(precache).size);
for (const required of ['./css/v5.1.0.css', './js/vix-protocols.js', './js/vix-mirror-site.js', './js/vix-provider-site.js']) assert.ok(precache.includes(required));
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (clean) assert.ok(exists(clean), `SW asset missing: ${relative}`);
}
assert.equal(seedRuntimeManifest.protocol, 'vix-seed-runtime/1');
assert.equal(seedRuntimeManifest.seedRevision, 8);
for (const descriptor of [seedRuntimeManifest.meta, ...seedRuntimeManifest.entries, ...seedRuntimeManifest.memberships, ...seedRuntimeManifest.relationComponents]) {
  assert.equal(fs.statSync(path.join(root, descriptor.path)).size, descriptor.bytes);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, descriptor.path))).digest('hex'), descriptor.sha256);
}

for (const doc of ['AUDIT_REPORT_5.1.0.md', 'REQUIREMENT_BASELINE_5.1.0.md', 'MIGRATION_5.1.0.md', 'RELEASE_5.1.0.md', 'TEST_REPORT_5.1.0.md']) {
  assert.ok(exists(doc), `5.1.0 document missing: ${doc}`);
}

console.log(`static-tests: OK (${precache.length} precache entries)`);
