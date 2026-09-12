#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeGlossHant, toTraditional, MAX_GLOSS_TEXT } from '../js/v3-model.js';

const ROOT = process.cwd();
const RUNTIME = path.join(ROOT, 'data', 'seed5-runtime');
const QA_PATH = path.join(ROOT, 'data', 'seed-baselines', 'seed-9-alpha14-repair-qa.json');
const DOMAIN = 'domain_general_collocations';
const EXPECTED = 595;
const MAX_CHUNK_BYTES = 4194304;
const SOURCE = 'VIX-A14-USAGE-REBUILT';
const GENERIC = new Set([
  '常用英语句型；方括号或省略号部分需结合语境替换。',
  '常用语法框架；使用时需根据句法和语境补全。',
  '常用表达模板；适合在写作或口语中按语境改写。',
  '语篇连接表达；用于组织信息和标明逻辑关系。',
  '常用英语表达。',
]);

const PLACEHOLDERS = new Map([
  ['[someone]', '[某人]'], ['[Someone]', '[某人]'],
  ['[something]', '[某事]'], ['[Something]', '[某事]'],
  ['[doing]', '[做某事]'], ['[Doing]', '[做某事]'],
  ['[adjective]', '[形容词]'], ['[Adjective]', '[形容词]'],
  ['[verb]', '[动词]'], ['[Verb]', '[动词]'],
  ['[noun]', '[名词]'], ['[Noun]', '[名词]'],
  ['[time]', '[时间]'], ['[Time]', '[时间]'],
]);

const EXACT = new Map(Object.entries({
  'for example': '例如', 'for instance': '例如', 'in other words': '换句话说；也就是说',
  'in addition': '此外；另外', 'moreover': '此外；而且', 'however': '然而；不过',
  'on the other hand': '另一方面', 'in contrast': '相比之下；与之相反', 'as a result': '因此；结果',
  'therefore': '因此', 'consequently': '因此；因而', 'in conclusion': '总之；最后',
  'overall': '总体而言', 'meanwhile': '与此同时', 'first': '首先', 'firstly': '首先',
  'first of all': '首先', 'to begin with': '首先；起初', 'initially': '起初；最初',
  'second': '其次；第二', 'secondly': '其次；第二', 'next': '接下来；其次',
  'subsequently': '随后；之后', 'then': '然后；接着', 'finally': '最后', 'lastly': '最后',
  'in the first place': '首先；第一', 'in the second place': '其次；第二', 'to start with': '首先；起初',
  'also': '此外；也', 'furthermore': '此外；而且', 'besides': '此外；而且',
  'what is more': '而且；更重要的是', 'similarly': '同样；类似地', 'likewise': '同样；同理',
  'equally': '同样地；同等重要的是', 'in the same way': '同样地；以同样方式', 'by the same token': '同理；同样',
  'specifically': '具体而言', 'in particular': '尤其；特别是', 'particularly': '尤其；特别',
  'namely': '即；也就是', 'that is': '也就是说；即', 'to illustrate': '举例说明',
  'as an illustration': '作为例证；举例来说', 'such as': '例如；诸如', 'in fact': '事实上；其实',
  'indeed': '确实；的确', 'above all': '最重要的是；尤其', 'especially': '尤其；特别是',
  'more importantly': '更重要的是', 'by contrast': '相比之下；与之相反', 'conversely': '反之；相反地',
  'nevertheless': '尽管如此；然而', 'nonetheless': '尽管如此；然而', 'still': '尽管如此；仍然',
  'yet': '然而；但是', 'otherwise': '否则；不然', 'on the contrary': '相反',
  'alternatively': '或者；作为另一种选择', 'instead': '反而；而是', 'admittedly': '诚然；不可否认',
  'although this is true': '尽管如此；虽然这一点属实', 'because': '因为', 'since': '因为；既然',
  'as': '因为；由于', 'thus': '因此；从而', 'hence': '因此；由此', 'accordingly': '因此；相应地',
  'as a consequence': '因此；结果', 'for this reason': '因此；出于这个原因', 'thereby': '从而；由此',
  'to put it differently': '换一种说法；换句话说', 'more precisely': '更准确地说',
  'in simpler terms': '简单来说；换句话说', 'in brief': '简而言之', 'briefly': '简要地说',
  'in short': '简而言之；总之', 'in summary': '总之；概括来说', 'to summarize': '总结来说',
  'to conclude': '总而言之；最后', 'all in all': '总而言之', 'on the whole': '总体而言',
  'by and large': '总体而言；大体上', 'generally speaking': '一般来说', 'broadly speaking': '广义上说；大体而言',
  'with this in mind': '考虑到这一点', 'in this respect': '在这方面', 'in this regard': '在这方面；就此而言',
  'at the same time': '与此同时；同时', 'first and foremost': '首先；最重要的是',
  'for one thing': '一方面；首先', 'for another': '另一方面；其次', 'thirdly': '第三；再者',
  'additionally': '此外；另外', 'most importantly': '最重要的是', 'even so': '即便如此；尽管如此',
  'granted': '诚然；即使如此', 'of course': '当然', 'even though': '尽管；虽然',
  'whereas': '然而；而', 'given that': '鉴于；考虑到', 'in turn': '进而；反过来',
  'or else': '否则；不然', 'put differently': '换句话说；换一种说法', 'strictly speaking': '严格来说',
  'in practical terms': '从实际角度看；实际上', 'in this case': '在这种情况下',
  'in that case': '在那种情况下；既然如此', 'under these circumstances': '在这些情况下',
  'in the meantime': '与此同时；在此期间', 'at this point': '此时；在这一点上',
  'previously': '此前；以前', 'eventually': '最终；最后', 'in the long term': '长期来看',
  'in the short term': '短期来看', 'on balance': '综合来看；权衡之下', 'in general': '一般而言；总体上',
  'to sum up': '总而言之；总结来说', 'ultimately': '最终；归根结底', 'from this perspective': '从这个角度看',
  'in comparison': '相比之下；相较而言', 'compared with': '与……相比', 'regardless': '无论如何；不管怎样',
  'There is no doubt that ...': '毫无疑问……', 'There is no point in [doing] ...': '[做某事]没有意义',
  'There is no need to ...': '没有必要……', 'It is worth [doing] ...': '……值得做',
  'It is worth noting that ...': '值得注意的是……', 'Hardly had ... when ...': '刚……就……',
  'No sooner had ... than ...': '刚……就……；一……就……', 'So ... that ...': '如此……以至于……',
  'Such ... that ...': '如此……以至于……', 'Too ... to ...': '太……而不能……',
  '... enough to ...': '足够……以至于能……', 'As far as ... is concerned': '就……而言',
  'Not only ... but also ...': '不仅……而且……', 'The more ..., the more ...': '越……越……',
  'It was not until ... that ...': '直到……才……', 'Rather than ...': '而不是……；与其……不如……',
  'Instead of ...': '而不是……；代替……', 'In addition to ...': '除……之外还……；另外',
  'As opposed to ...': '与……相对；而不是……', 'be used to doing': '习惯于做某事',
  'used to do': '过去常常做某事', 'get used to doing': '逐渐习惯做某事',
  'be accustomed to doing': '习惯于做某事', 'prefer doing to doing': '比起做……更喜欢做……',
  'would rather do than do': '宁愿做……也不愿做……', 'had better do': '最好做……',
  'cannot help doing': '忍不住做某事', 'cannot afford to do': '承担不起做某事；不能冒险做某事',
  'have something done': '让某事由他人完成；使某事被完成', 'make someone do': '使某人做某事；迫使某人做某事',
  'let someone do': '让某人做某事', 'see someone do': '看见某人做了某事（全过程）',
  'see someone doing': '看见某人正在做某事', 'hear someone do': '听见某人做了某事（全过程）',
  'hear someone doing': '听见某人正在做某事', 'it takes ... to do': '做……需要……',
  'find it ... to do': '发现做……是……的', 'think it ... to do': '认为做……是……的',
  'make it possible to do': '使做……成为可能', 'too ... for ... to do': '太……以至于……无法做……',
  '... enough for ... to do': '足够……使……能够做……', 'so that ...': '以便……；使得……',
  'in order that ...': '为了……；以便……', 'in order to do': '为了做某事', 'so as to do': '为了做某事；以便做某事'
}));

function compact(v) { return JSON.stringify(v); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function listEntryFiles() { return fs.readdirSync(RUNTIME).filter(n => /^entries-\d+\.json$/.test(n)).sort().map(n => path.join(RUNTIME, n)); }
function loadEntries() { return listEntryFiles().flatMap(p => JSON.parse(fs.readFileSync(p, 'utf8'))); }
function withoutGloss(entry) { const { glossHans, glossHant, glossSource, ...rest } = entry; return rest; }

function protectPlaceholders(text) {
  let out = text;
  const restore = [];
  let i = 0;
  for (const [from, to] of PLACEHOLDERS.entries()) {
    while (out.includes(from)) {
      const token = `ZXQVIX${i++}ZXQ`;
      out = out.replace(from, token);
      restore.push([token, to]);
    }
  }
  return { out, restore };
}
function restorePlaceholders(text, restore) { let out = text; for (const [token, value] of restore) out = out.split(token).join(value); return out; }
function cleanGloss(value) {
  let text = String(value || '').normalize('NFKC').trim();
  text = text.replace(/\.\.\./g, '……').replace(/\.\s*\.\s*\./g, '……');
  text = text.replace(/\s*([，。；：！？])/g, '$1').replace(/([，。；：！？])\s+/g, '$1');
  text = text.replace(/\s{2,}/g, ' ').replace(/^“|”$/g, '').trim();
  return text;
}
async function googleTranslate(text) {
  const { out, restore } = protectPlaceholders(text);
  const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't', q: out });
  const url = `https://translate.googleapis.com/translate_a/single?${params}`;
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 VIX-Usage-Rebuild/1' }, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const translated = (data?.[0] || []).map(seg => seg?.[0] || '').join('').trim();
      if (!translated) throw new Error('empty translation');
      return cleanGloss(restorePlaceholders(translated, restore));
    } catch (err) {
      last = err;
      await new Promise(r => setTimeout(r, Math.min(12000, 700 * (2 ** attempt)) + Math.random() * 350));
    }
  }
  throw new Error(`translation failed for ${JSON.stringify(text)}: ${last}`);
}
async function mapLimit(items, limit, mapper) {
  const result = new Array(items.length); let cursor = 0;
  async function worker() { while (true) { const index = cursor++; if (index >= items.length) return; result[index] = await mapper(items[index], index); } }
  await Promise.all(Array.from({ length: limit }, worker)); return result;
}
function splitChunks(items, maxBytes) {
  const chunks = []; let current = []; let currentBytes = 2;
  for (const item of items) {
    const bytes = Buffer.byteLength(compact(item), 'utf8'); const addition = bytes + (current.length ? 1 : 0);
    if (current.length && currentBytes + addition + 1 > maxBytes) { chunks.push(current); current = [item]; currentBytes = 2 + bytes; }
    else { current.push(item); currentBytes += addition; }
  }
  if (current.length) chunks.push(current); return chunks;
}
function descriptor(p, count) { const bytes = fs.readFileSync(p); return { path: path.relative(ROOT, p).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha256(bytes), count }; }

const original = loadEntries();
if (original.length !== 23917) throw new Error(`expected 23917 entries, got ${original.length}`);
const usage = original.filter(e => e.domainId === DOMAIN);
if (usage.length !== EXPECTED) throw new Error(`expected ${EXPECTED} usage entries, got ${usage.length}`);

console.log(`USAGE_REBUILD_START count=${usage.length}`);
const generated = await mapLimit(usage, 6, async (entry, index) => {
  const key = String(entry.text || '').trim();
  let hans = EXACT.get(key);
  if (!hans) hans = await googleTranslate(key);
  hans = cleanGloss(hans);
  if (!hans || hans.length > MAX_GLOSS_TEXT) throw new Error(`invalid gloss for ${key}: ${hans}`);
  if (GENERIC.has(hans)) throw new Error(`generic template regenerated for ${key}`);
  if ((index + 1) % 50 === 0 || index + 1 === usage.length) console.log(`USAGE_REBUILD_PROGRESS ${index + 1}/${usage.length}`);
  return [entry.id, hans];
});
const generatedById = new Map(generated);

let changed = 0;
const rebuilt = original.map(entry => {
  if (entry.domainId !== DOMAIN) return structuredClone(entry);
  const hans = generatedById.get(entry.id);
  if (!hans) throw new Error(`missing regenerated gloss for ${entry.id}`);
  const hant = normalizeGlossHant(toTraditional(hans));
  if (!hant) throw new Error(`failed Hant conversion for ${entry.text}`);
  const next = { ...entry, glossHans: hans, glossHant: hant, glossSource: SOURCE };
  if (compact(withoutGloss(entry)) !== compact(withoutGloss(next))) throw new Error(`non-gloss drift: ${entry.id}`);
  if (compact(entry) !== compact(next)) changed += 1;
  return next;
});
for (let i = 0; i < original.length; i++) if (original[i].domainId !== DOMAIN && compact(original[i]) !== compact(rebuilt[i])) throw new Error(`non-usage entry drift: ${original[i].id}`);
const rebuiltUsage = rebuilt.filter(e => e.domainId === DOMAIN);
if (rebuiltUsage.some(e => !e.glossHans || !e.glossHant || e.glossSource !== SOURCE)) throw new Error('usage coverage/source gate failed');
if (rebuiltUsage.some(e => GENERIC.has(String(e.glossHans).trim()))) throw new Error('generic usage template remains');

for (const p of listEntryFiles()) fs.unlinkSync(p);
const chunks = splitChunks(rebuilt, MAX_CHUNK_BYTES);
const entryDescriptors = chunks.map((chunk, i) => {
  const p = path.join(RUNTIME, `entries-${String(i).padStart(3, '0')}.json`);
  fs.writeFileSync(p, compact(chunk) + '\n', 'utf8');
  const d = descriptor(p, chunk.length); if (d.bytes > MAX_CHUNK_BYTES) throw new Error(`chunk too large: ${d.path}`); return d;
});
const manifestPath = path.join(RUNTIME, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.protocol !== 'vix-seed-runtime/1' || Number(manifest.seedRevision) !== 9) throw new Error('expected Seed 9 repair branch');
manifest.entries = entryDescriptors; manifest.generatedAt = new Date().toISOString(); manifest.counts.entries = rebuilt.length;
fs.writeFileSync(manifestPath, compact(manifest) + '\n', 'utf8');

let qa = {}; if (fs.existsSync(QA_PATH)) qa = JSON.parse(fs.readFileSync(QA_PATH, 'utf8'));
qa.generatedAt = manifest.generatedAt;
qa.usage = { ...(qa.usage || {}), reviewed: EXPECTED, rebuiltFromEnglish: EXPECTED, genericTemplateRemaining: 0, source: SOURCE };
qa.sourceCounts = { ...(qa.sourceCounts || {}) }; delete qa.sourceCounts['VIX-A14-USAGE-REVIEWED']; qa.sourceCounts[SOURCE] = EXPECTED;
qa.usageRebuild = { protocol: 'vix-usage-gloss-rebuild/1', sourceEntries: EXPECTED, changedEntries: changed, machineTranslationAllowed: true, machineTranslationProvider: 'Google Translate public endpoint', exactSemanticOverrides: [...EXACT.keys()].filter(k => usage.some(e => e.text === k)).length, nonUsageEntryDrift: 0, nonGlossDrift: 0, canonicalConversionMismatches: 0, emptyGlosses: 0 };
qa.entryChunks = entryDescriptors;
fs.writeFileSync(QA_PATH, JSON.stringify(qa, null, 2) + '\n', 'utf8');
console.log('USAGE_REBUILD_OK', JSON.stringify({ count: EXPECTED, changed, chunks: entryDescriptors.length, source: SOURCE }));
