export const SCHEMA_VERSION = 6;
export const DEFAULT_DOMAIN_ID = 'domain_general_english';
export const DEFAULT_DOMAIN_NAME = '通用英语';
export const SYSTEM_PHRASE_SUFFIX = '__phrases';
export const SYSTEM_DOMAIN_WORDS_SUFFIX = '__all_words';
export const SYSTEM_DOMAIN_CONTENT_SUFFIX = '__all_content';
export const SYSTEM_GLOBAL_WORDS_ID = '__global_all_words';
export const SYSTEM_GLOBAL_PHRASES_ID = '__global_all_phrases';
export const SYSTEM_GLOBAL_CONTENT_ID = '__global_all_content';
export const MAX_ENTRY_TEXT = 160;
export const MAX_GLOSS_TEXT = 120;
export const MAX_DOMAIN_NAME = 40;
export const MAX_COLLECTION_NAME = 40;
export const MAX_COLLECTION_LABEL = 80;
export const MAX_SOURCE_LABEL = 120;

const FORMAT_CONTROLS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const HYPHENS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const APOSTROPHES = /[\u2018\u2019\u02BC\uFF07]/g;
const QUOTES = /[\u201C\u201D\uFF02]/g;

export function normalizeDisplayText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(FORMAT_CONTROLS, '')
    .replace(HYPHENS, '-')
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEnglish(value) {
  return normalizeDisplayText(value).toLocaleLowerCase('en-US');
}

export function isPhraseText(value) {
  return tokenizeEnglish(value).length > 1;
}

export function tokenizeEnglish(value) {
  const text = normalizeEnglish(value);
  return text.match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? [];
}

export function systemPhraseCollectionId(domainId) {
  return `${domainId}${SYSTEM_PHRASE_SUFFIX}`;
}

export function systemDomainWordsCollectionId(domainId) {
  return `${domainId}${SYSTEM_DOMAIN_WORDS_SUFFIX}`;
}

export function systemDomainContentCollectionId(domainId) {
  return `${domainId}${SYSTEM_DOMAIN_CONTENT_SUFFIX}`;
}

export function isSystemDomainWordsCollectionId(collectionId) {
  return String(collectionId || '').endsWith(SYSTEM_DOMAIN_WORDS_SUFFIX);
}

export function domainIdFromSystemWordsCollectionId(collectionId) {
  return isSystemDomainWordsCollectionId(collectionId)
    ? String(collectionId).slice(0, -SYSTEM_DOMAIN_WORDS_SUFFIX.length)
    : '';
}

export function positionScopeDomainId(collection, entry = null) {
  if (collection?.virtual && !collection?.domainId) return 'global';
  return collection?.domainId || entry?.domainId || 'global';
}

export function globalStudyStampKey(kind, normalizedText) {
  return `global:${kind}:${normalizedText}`;
}

export function cleanStudyStampReferences(backup) {
  const entryIds = new Set((backup?.entries || []).map((item) => item.id));
  backup.studyStamps = (backup?.studyStamps || []).filter((item) => item.scope === 'entry' && entryIds.has(item.entryId));
  return backup;
}

function hash32(input, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (const character of String(input)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function safeId(prefix, input) {
  const slug = normalizeDisplayText(input)
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'item';
  return `${prefix}_${slug}_${hash32(input)}${hash32(input, 0x9e3779b9)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createDomain({ id = null, name, order = 0, glossEnabled = false, contentMode = 'structured', relationExcluded = false, timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
  const cleanName = normalizeDisplayText(name);
  if (!cleanName) throw new Error('词域名称不能为空');
  if (cleanName.length > MAX_DOMAIN_NAME) throw new Error(`词域名称不能超过 ${MAX_DOMAIN_NAME} 个字符`);
  const cleanMode = contentMode === 'nonStructured' ? 'nonStructured' : 'structured';
  return {
    id: id || safeId('domain', cleanName),
    name: cleanName,
    order: Number.isFinite(order) ? order : 0,
    glossEnabled: Boolean(glossEnabled),
    contentMode: cleanMode,
    relationExcluded: Boolean(relationExcluded),
    createdAt: String(createdAt || timestamp),
    updatedAt: String(updatedAt || createdAt || timestamp),
  };
}

export function createCollection({ id = null, domainId, name, label = '', type = 'normal', order = 0, hidden = false, timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
  if (!domainId) throw new Error('词表缺少词域');
  if (!['normal', 'system-phrases'].includes(type)) throw new Error('词表类型无效');
  const cleanName = normalizeDisplayText(name);
  if (!cleanName) throw new Error('词表名称不能为空');
  if (cleanName.length > MAX_COLLECTION_NAME) throw new Error(`词表名称不能超过 ${MAX_COLLECTION_NAME} 个字符`);
  const cleanLabel = normalizeDisplayText(label);
  if (cleanLabel.length > MAX_COLLECTION_LABEL) throw new Error(`词表说明不能超过 ${MAX_COLLECTION_LABEL} 个字符`);
  const expectedId = type === 'system-phrases' ? systemPhraseCollectionId(domainId) : null;
  return {
    id: expectedId || id || safeId('collection', `${domainId}:${cleanName}`),
    domainId,
    name: cleanName,
    label: cleanLabel,
    type,
    order: Number.isFinite(order) ? order : 0,
    hidden: Boolean(hidden),
    createdAt: String(createdAt || timestamp),
    updatedAt: String(updatedAt || createdAt || timestamp),
  };
}

export function createEntry({ id = null, domainId, text, kind = '', contentType = '', partsOfSpeech = [], glossHans = '', glossHant = '', glossSource = '', timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
  const cleanText = normalizeDisplayText(text);
  const normalizedText = normalizeEnglish(cleanText);
  if (!domainId) throw new Error('内容缺少词域');
  if (!normalizedText) throw new Error('内容不能为空');
  if (cleanText.length > MAX_ENTRY_TEXT) throw new Error(`内容不能超过 ${MAX_ENTRY_TEXT} 个字符`);
  const cleanKind = ['word', 'phrase', 'content'].includes(kind) ? kind : (isPhraseText(cleanText) ? 'phrase' : 'word');
  if (cleanKind === 'word' && isPhraseText(cleanText)) throw new Error('多词文本不能标记为普通词');
  const normalizedGloss = normalizeGlossHant(glossHant);
  const cleanPos = [...new Set((Array.isArray(partsOfSpeech) ? partsOfSpeech : String(partsOfSpeech || '').split(/[;,/]/))
    .map((item) => normalizeDisplayText(item)).filter(Boolean))].slice(0, 16);
  return {
    id: id || safeId('entry', `${domainId}:${normalizedText}`),
    domainId,
    kind: cleanKind,
    contentType: cleanKind === 'content' ? (normalizeDisplayText(contentType) || 'general') : '',
    partsOfSpeech: cleanPos,
    text: cleanText,
    normalizedText,
    glossHans: normalizeDisplayText(glossHans),
    glossHant: normalizedGloss,
    glossSource: (normalizedGloss || glossHans) ? normalizeDisplayText(glossSource || 'manual') : '',
    createdAt: String(createdAt || timestamp),
    updatedAt: String(updatedAt || createdAt || timestamp),
  };
}

export function createMembership({ id = null, entryId, collectionId, sourceLabel = '', sourceOrder = 0, timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
  if (!entryId || !collectionId) throw new Error('来源关系缺少关联 ID');
  const normalizedLabel = normalizeDisplayText(sourceLabel);
  if (normalizedLabel.length > MAX_SOURCE_LABEL) throw new Error(`来源标签不能超过 ${MAX_SOURCE_LABEL} 个字符`);
  return {
    id: id || safeId('membership', `${entryId}:${collectionId}`),
    entryId,
    collectionId,
    sourceLabel: normalizedLabel,
    sourceOrder: Number.isFinite(sourceOrder) ? sourceOrder : 0,
    createdAt: String(createdAt || timestamp),
    updatedAt: String(updatedAt || createdAt || timestamp),
  };
}

export function createStudyStamp({ key = '', scope = 'entry', entryId = '', kind = '', normalizedText = '', reviewDateKey = '', reviewedAt = nowIso(), revision = 1 }) {
  const cleanScope = scope === 'global' ? 'global' : 'entry';
  const cleanEntryId = cleanScope === 'entry' ? String(entryId || '') : '';
  const cleanKind = cleanScope === 'global' && ['word', 'phrase'].includes(kind) ? kind : '';
  const cleanNormalizedText = cleanScope === 'global' ? normalizeEnglish(normalizedText) : '';
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(String(reviewDateKey || '')) ? String(reviewDateKey) : '';
  if (!cleanDate) throw new Error('学习日期格式无效');
  if (cleanScope === 'entry' && !cleanEntryId) throw new Error('学习日期缺少内容 ID');
  if (cleanScope === 'global' && (!cleanKind || !cleanNormalizedText)) throw new Error('全局学习日期缺少聚合键');
  const resolvedKey = key || (cleanScope === 'global'
    ? `global:${cleanKind}:${cleanNormalizedText}`
    : `entry:${cleanEntryId}`);
  return {
    key: resolvedKey,
    scope: cleanScope,
    entryId: cleanEntryId,
    kind: cleanKind,
    normalizedText: cleanNormalizedText,
    reviewDateKey: cleanDate,
    reviewedAt: String(reviewedAt || nowIso()),
    revision: Math.max(1, Number(revision || 1)),
  };
}

function laterStudyStamp(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.reviewDateKey !== right.reviewDateKey) return left.reviewDateKey > right.reviewDateKey ? left : right;
  if (left.reviewedAt !== right.reviewedAt) return left.reviewedAt > right.reviewedAt ? left : right;
  return Number(left.revision || 0) >= Number(right.revision || 0) ? left : right;
}

function migrateStudyStampsToEntries(rawStamps, entries, domains) {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const domainOrder = new Map([...domains]
    .sort((a, b) => a.order - b.order || normalizeEnglish(a.name).localeCompare(normalizeEnglish(b.name), 'en'))
    .map((domain, index) => [domain.id, index]));
  const entriesByAggregate = new Map();
  for (const entry of entries) {
    const aggregateKey = globalStudyStampKey(entry.kind, entry.normalizedText);
    const list = entriesByAggregate.get(aggregateKey) || [];
    list.push(entry);
    entriesByAggregate.set(aggregateKey, list);
  }
  for (const list of entriesByAggregate.values()) {
    list.sort((a, b) => (domainOrder.get(a.domainId) ?? Number.MAX_SAFE_INTEGER)
      - (domainOrder.get(b.domainId) ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id));
  }

  const migrated = new Map();
  const issues = [];
  for (const raw of array(rawStamps)) {
    let entry = null;
    if (raw?.scope === 'entry' || raw?.entryId) entry = entryById.get(String(raw?.entryId || '')) || null;
    else if (raw?.scope === 'global' || String(raw?.key || '').startsWith('global:')) {
      const aggregateKey = raw?.key || globalStudyStampKey(raw?.kind, normalizeEnglish(raw?.normalizedText));
      const candidates = entriesByAggregate.get(aggregateKey) || [];
      entry = candidates[0] || null;
      if (entry && candidates.length > 1) {
        issues.push({
          type: 'global-study-stamp-ambiguous',
          sourceKey: String(raw?.key || aggregateKey),
          reviewDateKey: String(raw?.reviewDateKey || ''),
          chosenEntryId: entry.id,
          candidateEntryIds: candidates.map((candidate) => candidate.id),
        });
      }
    }
    if (!entry) continue;
    let stamp;
    try {
      stamp = createStudyStamp({
        key: `entry:${entry.id}`,
        scope: 'entry',
        entryId: entry.id,
        reviewDateKey: raw?.reviewDateKey,
        reviewedAt: raw?.reviewedAt,
        revision: raw?.revision,
      });
    } catch {
      continue;
    }
    migrated.set(stamp.key, laterStudyStamp(migrated.get(stamp.key), stamp));
  }
  return {
    stamps: [...migrated.values()].sort((a, b) => a.key.localeCompare(b.key)),
    issues,
  };
}

export function buildPhraseTokens(entry) {
  if (!entry || !['phrase', 'content'].includes(entry.kind)) return [];
  return tokenizeEnglish(entry.text).map((token, tokenIndex) => ({
    id: `${entry.id}:${tokenIndex}`,
    sourceEntryId: entry.id,
    phraseId: entry.id,
    domainId: entry.domainId,
    token,
    normalizedToken: normalizeEnglish(token),
    normalizedText: normalizeEnglish(token),
    startToken: tokenIndex,
    endToken: tokenIndex + 1,
    tokenIndex,
    componentKind: 'token',
  }));
}

// Build a deterministic exact structural component index. Components describe
// spans that correspond to at least one concrete Entry text; relation edges are
// resolved globally from these normalized spans and therefore stay symmetric.
export function buildRelationComponentsForEntries(entriesInput) {
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  const known = new Set(entries.map((entry) => entry.normalizedText).filter(Boolean));
  const components = [];
  for (const entry of entries) {
    if (!['phrase', 'content'].includes(entry.kind)) continue;
    const tokens = tokenizeEnglish(entry.text);
    const normalizedTokens = tokens.map(normalizeEnglish);
    const seen = new Set();
    for (let start = 0; start < normalizedTokens.length; start += 1) {
      for (let end = start + 1; end <= normalizedTokens.length; end += 1) {
        const normalizedText = normalizedTokens.slice(start, end).join(' ');
        if (!known.has(normalizedText) || normalizedText === entry.normalizedText || seen.has(`${start}:${end}:${normalizedText}`)) continue;
        seen.add(`${start}:${end}:${normalizedText}`);
        components.push({
          id: `${entry.id}:${start}:${end}:${hash32(normalizedText)}`,
          sourceEntryId: entry.id,
          phraseId: entry.id,
          domainId: entry.domainId,
          text: tokens.slice(start, end).join(' '),
          token: tokens.slice(start, end).join(' '),
          normalizedText,
          normalizedToken: normalizedText,
          startToken: start,
          endToken: end,
          tokenIndex: start,
          componentKind: end - start === 1 ? 'token' : 'span',
        });
      }
    }
  }
  return components.sort((a, b) => a.sourceEntryId.localeCompare(b.sourceEntryId)
    || a.startToken - b.startToken || b.endToken - a.endToken || a.normalizedText.localeCompare(b.normalizedText, 'en'));
}

// Phrase-first replacements handle common lexical ambiguities before character mapping.
const S2T_PHRASES = new Map([
  ['线程', '線程'], ['线程池', '線程池'], ['开发', '開發'], ['后台', '後台'],
  ['数据库', '數據庫'], ['软件', '軟件'], ['硬件', '硬件'], ['网络', '網絡'],
  ['计算机', '計算機'], ['信息', '信息'], ['用户', '用戶'], ['服务器', '服務器'],
  ['应用程序', '應用程序'], ['操作系统', '操作系統'], ['人工智能', '人工智能'],
]);


// Curated computer-term translations are chosen in Simplified Chinese first, then converted
// one-to-one with ICU Hans→Hant during seed construction. These protected phrase mappings
// preserve context-sensitive characters such as 制/製, 后/後, 复/複 and 发/發.
const S2T_COMPUTER_GLOSS_OVERRIDES = [
  ["GitHub Actions", "GitHub Actions"],
  ["Service Worker", "Service Worker"],
  ["Transformer 模型", "Transformer 模型"],
  ["Pod 垂直自动伸缩器", "Pod 垂直自動伸縮器"],
  ["Pod 水平自动伸缩器", "Pod 水平自動伸縮器"],
  ["WebAssembly", "WebAssembly"],
  ["JavaScript", "JavaScript"],
  ["Pickle 序列化", "Pickle 序列化"],
  ["Web Worker", "Web Worker"],
  ["基于哈希的消息认证码", "基於哈希的消息認證碼"],
  ["渐进式 Web 应用", "漸進式 Web 應用"],
  ["Future 对象", "Future 對象"],
  ["IndexedDB", "IndexedDB"],
  ["WebSocket", "WebSocket"],
  ["Wheel 分发包", "Wheel 分發包"],
  ["互联网控制消息协议", "互聯網控制消息協議"],
  ["基于角色的访问控制", "基於角色的訪問控制"],
  ["Pod 中断预算", "Pod 中斷預算"],
  ["Pod 反亲和性", "Pod 反親和性"],
  ["互联网服务提供商", "互聯網服務提供商"],
  ["交互到下一次绘制", "交互到下一次繪制"],
  ["内存映射输入输出", "內存映射輸入輸出"],
  ["动态主机配置协议", "動態主機配置協議"],
  ["基本输入输出系统", "基本輸入輸出系統"],
  ["应用程序编程接口", "應用程序編程接口"],
  ["异步上下文管理器", "異步上下文管理器"],
  ["现场可编程门阵列", "現場可編程門陣列"],
  ["简单邮件传输协议", "簡單郵件傳輸協議"],
  ["精简指令集计算机", "精簡指令集計算機"],
  ["ACID 事务", "ACID 事務"],
  ["API 服务器", "API 服務器"],
  ["HTTP 方法", "HTTP 方法"],
  ["HTTP 标头", "HTTP 標頭"],
  ["Kube 代理", "Kube 代理"],
  ["Kubelet", "Kubelet"],
  ["MIME 类型", "MIME 類型"],
  ["Pod 亲和性", "Pod 親和性"],
  ["Promise", "Promise"],
  ["Webhook", "Webhook"],
  ["不可变基础设施", "不可變基礎設施"],
  ["个人可识别信息", "個人可識別信息"],
  ["传输层安全协议", "傳輸層安全協議"],
  ["分布式拒绝服务", "分布式拒絕服務"],
  ["可解释人工智能", "可解釋人工智能"],
  ["响应式网页设计", "響應式網頁設計"],
  ["基于性质的测试", "基於性質的測試"],
  ["基础设施即代码", "基礎設施即代碼"],
  ["基础设施自动化", "基礎設施自動化"],
  ["多因素身份验证", "多因素身份驗證"],
  ["持续集成流水线", "持續集成流水線"],
  ["数字信号处理器", "數字信號處理器"],
  ["无类别域间路由", "無類別域間路由"],
  ["生成式人工智能", "生成式人工智能"],
  ["用户数据报协议", "用戶數據報協議"],
  ["站点可靠性工程", "站點可靠性工程"],
  ["结构化模式匹配", "結構化模式匹配"],
  ["统一资源定位符", "統一資源定位符"],
  ["统一资源标识符", "統一資源標識符"],
  ["自定义资源定义", "自定義資源定義"],
  ["计算机体系结构", "計算機體系結構"],
  ["负责任人工智能", "負責任人工智能"],
  ["身份与访问管理", "身份與訪問管理"],
  ["通用异步收发器", "通用異步收發器"],
  ["集群自动伸缩器", "集群自動伸縮器"],
  ["非易失性存储器", "非易失性存儲器"],
  ["Base64", "Base64"],
  ["CPU 调度", "CPU 調度"],
  ["Cookie", "Cookie"],
  ["Git 对象", "Git 對象"],
  ["MathML", "MathML"],
  ["Secret", "Secret"],
  ["Web 应用", "Web 應用"],
  ["Web 性能", "Web 性能"],
  ["Web 标准", "Web 標準"],
  ["Web 组件", "Web 組件"],
  ["上下文管理器", "上下文管理器"],
  ["专用集成电路", "專用集成電路"],
  ["中断处理程序", "中斷處理程序"],
  ["事件驱动架构", "事件驅動架構"],
  ["人工神经网络", "人工神經網絡"],
  ["传输控制协议", "傳輸控制協議"],
  ["伦理人工智能", "倫理人工智能"],
  ["全局解释器锁", "全局解釋器鎖"],
  ["公钥基础设施", "公鑰基礎設施"],
  ["内存层次结构", "內存層次結構"],
  ["内存映射文件", "內存映射文件"],
  ["内存管理单元", "內存管理單元"],
  ["内容分发网络", "內容分發網絡"],
  ["内容安全策略", "內容安全策略"],
  ["分布式数据库", "分布式數據庫"],
  ["分析型数据库", "分析型數據庫"],
  ["前进后退缓存", "前進後退緩存"],
  ["双下划线名称", "雙下划線名稱"],
  ["发布候选版本", "發佈候選版本"],
  ["变更数据捕获", "變更數據捕獲"],
  ["可串行化隔离", "可串行化隔離"],
  ["可信人工智能", "可信人工智能"],
  ["可信执行环境", "可信執行環境"],
  ["命名空间隔离", "命名空間隔離"],
  ["地址解析协议", "地址解析協議"],
  ["大 O 记号", "大 O 記號"],
  ["安全外壳协议", "安全外殼協議"],
  ["完全限定域名", "完全限定域名"],
  ["实时操作系统", "實時操作系統"],
  ["对象关系映射", "對象關係映射"],
  ["广度优先搜索", "廣度優先搜索"],
  ["恶意软件分析", "惡意軟件分析"],
  ["抽象数据类型", "抽象數據類型"],
  ["拉取请求审查", "拉取請求審查"],
  ["文档对象模型", "文檔對象模型"],
  ["方法解析顺序", "方法解析順序"],
  ["最大内容绘制", "最大內容繪制"],
  ["最小权限原则", "最小權限原則"],
  ["有效连接类型", "有效連接類型"],
  ["有状态副本集", "有狀態副本集"],
  ["服务器端渲染", "服務器端渲染"],
  ["机器学习模型", "機器學習模型"],
  ["标签选择算符", "標籤選擇算符"],
  ["检索增强生成", "檢索增強生成"],
  ["深度优先搜索", "深度優先搜索"],
  ["生产者消费者", "生產者消費者"],
  ["生成器表达式", "生成器表達式"],
  ["直接内存访问", "直接內存訪問"],
  ["真实用户监控", "真實用戶監控"],
  ["类型强制转换", "類型強制轉換"],
  ["累积布局偏移", "累積佈局偏移"],
  ["网络地址转换", "網絡地址轉換"],
  ["网络安全框架", "網絡安全框架"],
  ["联机事务处理", "聯機事務處理"],
  ["联机分析处理", "聯機分析處理"],
  ["自然语言处理", "自然語言處理"],
  ["虚拟专用网络", "虛擬專用網絡"],
  ["虚拟文件系统", "虛擬文件系統"],
  ["视觉语言模型", "視覺語言模型"],
  ["证书颁发机构", "證書頒發機構"],
  ["跨源资源共享", "跨源資源共享"],
  ["跨站请求伪造", "跨站請求偽造"],
  ["软件物料清单", "軟件物料清單"],
  ["软件配置管理", "軟件配置管理"],
  ["输入法编辑器", "輸入法編輯器"],
  ["边界网关协议", "邊界網關協議"],
  ["镜像拉取策略", "鏡像拉取策略"],
  ["面向对象编程", "面向對象編程"],
  ["页面加载时间", "頁面加載時間"],
  ["领域特定语言", "領域特定語言"],
  ["首次内容绘制", "首次內容繪制"],
  ["首次输入延迟", "首次輸入延遲"],
  ["高级编程语言", "高級編程語言"],
  ["ASCII", "ASCII"],
  ["AVL 树", "AVL 樹"],
  ["HTTPS", "HTTPS"],
  ["IP 地址", "IP 地址"],
  ["IP 路由", "IP 路由"],
  ["上下文切换", "上下文切換"],
  ["不相交集合", "不相交集合"],
  ["中央处理器", "中央處理器"],
  ["二叉搜索树", "二叉搜索樹"],
  ["互联网协议", "互聯網協議"],
  ["仓库可见性", "倉庫可見性"],
  ["代码所有者", "代碼所有者"],
  ["供应链攻击", "供應鏈攻擊"],
  ["入站控制器", "入站控制器"],
  ["全局作用域", "全局作用域"],
  ["公钥密码学", "公鑰密碼學"],
  ["关系数据库", "關係數據庫"],
  ["关键字参数", "關鍵字參數"],
  ["准入控制器", "准入控制器"],
  ["准确率指标", "準確率指標"],
  ["函数式编程", "函數式編程"],
  ["分布式计算", "分布式計算"],
  ["分布式追踪", "分布式追蹤"],
  ["列表推导式", "列表推導式"],
  ["初始化容器", "初始化容器"],
  ["发布自动化", "發佈自動化"],
  ["受保护分支", "受保護分支"],
  ["可等待对象", "可等待對象"],
  ["可观测性栈", "可觀測性棧"],
  ["可调用对象", "可調用對象"],
  ["向量数据库", "向量數據庫"],
  ["命令式编程", "命令式編程"],
  ["命令行外壳", "命令行外殼"],
  ["命名空间包", "命名空間包"],
  ["图形处理器", "圖形處理器"],
  ["声明式编程", "聲明式編程"],
  ["大语言模型", "大語言模型"],
  ["套接字地址", "套接字地址"],
  ["字典推导式", "字典推導式"],
  ["守护进程集", "守護進程集"],
  ["客户端渲染", "客戶端渲染"],
  ["容器运行时", "容器運行時"],
  ["嵌入式系统", "嵌入式系統"],
  ["工作流运行", "工作流運行"],
  ["开发者工具", "開發者工具"],
  ["异步生成器", "異步生成器"],
  ["异步迭代器", "異步迭代器"],
  ["弹性盒布局", "彈性盒佈局"],
  ["强连通分量", "強連通分量"],
  ["循环不变量", "循環不變量"],
  ["微服务架构", "微服務架構"],
  ["持久卷申领", "持久卷申領"],
  ["指令集架构", "指令集架構"],
  ["按引用调用", "按引用調用"],
  ["描述符协议", "描述符協議"],
  ["提示词工程", "提示詞工程"],
  ["数据一致性", "數據一致性"],
  ["数据完整性", "數據完整性"],
  ["数据库事务", "數據庫事務"],
  ["数据库模式", "數據庫模式"],
  ["数据库索引", "數據庫索引"],
  ["数据库迁移", "數據庫遷移"],
  ["数据流水线", "數據流水線"],
  ["文件描述符", "文件描述符"],
  ["文档字符串", "文檔字符串"],
  ["文档数据库", "文檔數據庫"],
  ["无监督学习", "無監督學習"],
  ["无障碍名称", "無障礙名稱"],
  ["时序数据库", "時序數據庫"],
  ["时间复杂度", "時間複雜度"],
  ["最小生成树", "最小生成樹"],
  ["构建流水线", "構建流水線"],
  ["查询优化器", "查詢優化器"],
  ["正则表达式", "正則表達式"],
  ["污点和容忍", "污點和容忍"],
  ["注意力机制", "注意力機制"],
  ["测试覆盖率", "測試覆蓋率"],
  ["浏览上下文", "瀏覽上下文"],
  ["浏览器引擎", "瀏覽器引擎"],
  ["渐近复杂度", "漸近複雜度"],
  ["源代码仓库", "源代碼倉庫"],
  ["源代码管理", "源代碼管理"],
  ["环形缓冲区", "環形緩衝區"],
  ["百分号编码", "百分號編碼"],
  ["空间复杂度", "空間複雜度"],
  ["结构化克隆", "結構化克隆"],
  ["缓存一致性", "緩存一致性"],
  ["自定义资源", "自定義資源"],
  ["自监督学习", "自監督學習"],
  ["节点亲和性", "節點親和性"],
  ["规范化形式", "規範化形式"],
  ["解释器关闭", "解釋器關閉"],
  ["计算机视觉", "計算機視覺"],
  ["记忆化递归", "記憶化遞歸"],
  ["负载均衡器", "負載均衡器"],
  ["身份提供商", "身份提供商"],
  ["软件供应链", "軟件供應鏈"],
  ["进程间通信", "進程間通信"],
  ["迭代器协议", "迭代器協議"],
  ["部署流水线", "部署流水線"],
  ["金丝雀发布", "金絲雀發佈"],
  ["金丝雀部署", "金絲雀部署"],
  ["随机化算法", "隨機化算法"],
  ["集合推导式", "集合推導式"],
  ["零停机部署", "零停機部署"],
  ["零往返时间", "零往返時間"],
  ["面包屑导航", "麵包屑導航"],
  ["ARIA", "ARIA"],
  ["Ajax", "Ajax"],
  ["B+ 树", "B+ 樹"],
  ["HTML", "HTML"],
  ["HTTP", "HTTP"],
  ["IPv4", "IPv4"],
  ["IPv6", "IPv6"],
  ["JSON", "JSON"],
  ["MIME", "MIME"],
  ["QUIC", "QUIC"],
  ["REST", "REST"],
  ["不可变性", "不可變性"],
  ["专家系统", "專家系統"],
  ["个人数据", "個人數據"],
  ["中断请求", "中斷請求"],
  ["中断预算", "中斷預算"],
  ["临时容器", "臨時容器"],
  ["主干开发", "主幹開發"],
  ["事件响应", "事件響應"],
  ["事件溯源", "事件溯源"],
  ["事务隔离", "事務隔離"],
  ["二分查找", "二分查找"],
  ["互操作性", "互操作性"],
  ["人在回路", "人在迴路"],
  ["人工智能", "人工智能"],
  ["代码审查", "代碼審查"],
  ["代码异味", "代碼異味"],
  ["代码拆分", "代碼拆分"],
  ["代码片段", "代碼片段"],
  ["优先队列", "優先隊列"],
  ["传输加密", "傳輸加密"],
  ["传输协议", "傳輸協議"],
  ["位置参数", "位置參數"],
  ["信任边界", "信任邊界"],
  ["偏差缓解", "偏差緩解"],
  ["健康检查", "健康檢查"],
  ["僵尸进程", "僵屍進程"],
  ["入侵检测", "入侵檢測"],
  ["入侵防御", "入侵防禦"],
  ["全局对象", "全局對象"],
  ["全表扫描", "全表掃描"],
  ["共享内存", "共享內存"],
  ["具身智能", "具身智能"],
  ["内存保护", "內存保護"],
  ["内存分配", "內存分配"],
  ["内存泄漏", "內存洩漏"],
  ["内存管理", "內存管理"],
  ["冒泡排序", "冒泡排序"],
  ["冒烟测试", "冒煙測試"],
  ["写时复制", "寫時複製"],
  ["凭据填充", "憑據填充"],
  ["分支保护", "分支保護"],
  ["分支限界", "分支限界"],
  ["分类模型", "分類模型"],
  ["列式存储", "列式存儲"],
  ["列式格式", "列式格式"],
  ["判别模型", "判別模型"],
  ["制品仓库", "製品倉庫"],
  ["前置条件", "前置條件"],
  ["剪枝策略", "剪枝策略"],
  ["功能开关", "功能開關"],
  ["动态制备", "動態制備"],
  ["动态类型", "動態類型"],
  ["动态规划", "動態規劃"],
  ["十六进制", "十六進制"],
  ["单元测试", "單元測試"],
  ["单向链表", "單向鏈表"],
  ["单调队列", "單調隊列"],
  ["单页应用", "單頁應用"],
  ["即时编译", "即時編譯"],
  ["压力测试", "壓力測試"],
  ["压缩精简", "壓縮精簡"],
  ["双向链表", "雙向鏈表"],
  ["双端队列", "雙端隊列"],
  ["反向代理", "反向代理"],
  ["反向传播", "反向傳播"],
  ["反序列化", "反序列化"],
  ["发布分支", "發佈分支"],
  ["发布管理", "發佈管理"],
  ["只读副本", "只讀副本"],
  ["可伸缩性", "可伸縮性"],
  ["可变参数", "可變參數"],
  ["可观测性", "可觀測性"],
  ["可解释性", "可解釋性"],
  ["可追责性", "可追責性"],
  ["可重复读", "可重復讀"],
  ["合并冲突", "合併衝突"],
  ["合并队列", "合併隊列"],
  ["同源策略", "同源策略"],
  ["启动探针", "啓動探針"],
  ["命名空间", "命名空間"],
  ["哈希冲突", "哈希衝突"],
  ["哈希函数", "哈希函數"],
  ["哈希映射", "哈希映射"],
  ["回归测试", "回歸測試"],
  ["回溯信息", "回溯信息"],
  ["回溯搜索", "回溯搜索"],
  ["回滚策略", "回滾策略"],
  ["回调函数", "回調函數"],
  ["图数据库", "圖數據庫"],
  ["在线算法", "在線算法"],
  ["地址总线", "地址總線"],
  ["地址空间", "地址空間"],
  ["块级内容", "塊級內容"],
  ["垃圾回收", "垃圾回收"],
  ["域名系统", "域名系統"],
  ["基准测试", "基準測試"],
  ["基数排序", "基數排序"],
  ["基本类型", "基本類型"],
  ["基础模型", "基礎模型"],
  ["威胁情报", "威脅情報"],
  ["威胁模型", "威脅模型"],
  ["媒体查询", "媒體查詢"],
  ["子网掩码", "子網掩碼"],
  ["字符编码", "字符編碼"],
  ["存活探针", "存活探針"],
  ["守护进程", "守護進程"],
  ["安全事件", "安全事件"],
  ["安全令牌", "安全令牌"],
  ["安全启动", "安全啓動"],
  ["安全态势", "安全態勢"],
  ["安全控制", "安全控制"],
  ["安全策略", "安全策略"],
  ["审计日志", "審計日誌"],
  ["容器编排", "容器編排"],
  ["容器镜像", "容器鏡像"],
  ["密码套件", "密碼套件"],
  ["密码算法", "密碼算法"],
  ["密钥交换", "密鑰交換"],
  ["密钥派生", "密鑰派生"],
  ["密钥管理", "密鑰管理"],
  ["对抗样本", "對抗樣本"],
  ["对称加密", "對稱加密"],
  ["对象引用", "對象引用"],
  ["导入路径", "導入路徑"],
  ["就绪探针", "就緒探針"],
  ["层次结构", "層次結構"],
  ["工作线程", "工作線程"],
  ["工作负载", "工作負載"],
  ["工作频率", "工作頻率"],
  ["差分数组", "差分數組"],
  ["差异统计", "差異統計"],
  ["平均情况", "平均情況"],
  ["平衡因子", "平衡因子"],
  ["并发编程", "併發編程"],
  ["并行计算", "並行計算"],
  ["序列化器", "序列化器"],
  ["延迟加载", "延遲加載"],
  ["开放寻址", "開放尋址"],
  ["异常处理", "異常處理"],
  ["引用计数", "引用計數"],
  ["强化学习", "強化學習"],
  ["归并排序", "歸並排序"],
  ["往返时间", "往返時間"],
  ["循环链表", "循環鏈表"],
  ["微处理器", "微處理器"],
  ["微控制器", "微控制器"],
  ["快速排序", "快速排序"],
  ["性能测试", "性能測試"],
  ["恶意软件", "惡意軟件"],
  ["惰性求值", "惰性求值"],
  ["扩散模型", "擴散模型"],
  ["技术债务", "技術債務"],
  ["抽象基类", "抽象基類"],
  ["拉取请求", "拉取請求"],
  ["拒绝服务", "拒絕服務"],
  ["拓扑排序", "拓撲排序"],
  ["拣选提交", "揀選提交"],
  ["拥塞控制", "擁塞控制"],
  ["持续交付", "持續交付"],
  ["持续测试", "持續測試"],
  ["持续部署", "持續部署"],
  ["持续集成", "持續集成"],
  ["指标采集", "指標採集"],
  ["指纹识别", "指紋識別"],
  ["按位运算", "按位運算"],
  ["按值调用", "按值調用"],
  ["控制单元", "控制單元"],
  ["控制平面", "控制平面"],
  ["控制循环", "控制循環"],
  ["推理引擎", "推理引擎"],
  ["提交历史", "提交歷史"],
  ["提交哈希", "提交哈希"],
  ["插入排序", "插入排序"],
  ["搜索空间", "搜索空間"],
  ["摊还分析", "攤還分析"],
  ["数字签名", "數字簽名"],
  ["数字证书", "數字證書"],
  ["数字身份", "數字身份"],
  ["数据仓库", "數據倉庫"],
  ["数据加密", "數據加密"],
  ["数据增强", "數據增強"],
  ["数据复制", "數據複製"],
  ["数据工程", "數據工程"],
  ["数据总线", "數據總線"],
  ["数据标注", "數據標注"],
  ["数据校验", "數據校驗"],
  ["数据模型", "數據模型"],
  ["数据治理", "數據治理"],
  ["数据泄露", "數據洩露"],
  ["数据清洗", "數據清洗"],
  ["数据目录", "數據目錄"],
  ["数据结构", "數據結構"],
  ["数据网格", "數據網格"],
  ["数据血缘", "數據血緣"],
  ["数据质量", "數據質量"],
  ["数据集市", "數據集市"],
  ["整数溢出", "整數溢出"],
  ["文件权限", "文件權限"],
  ["文件系统", "文件系統"],
  ["无障碍树", "無障礙樹"],
  ["日志聚合", "日誌聚合"],
  ["最坏情况", "最壞情況"],
  ["最好情况", "最好情況"],
  ["最短路径", "最短路徑"],
  ["服务发现", "服務發現"],
  ["服务网格", "服務網格"],
  ["服务账户", "服務賬戶"],
  ["期望状态", "期望狀態"],
  ["本地存储", "本地存儲"],
  ["机器学习", "機器學習"],
  ["机密扫描", "機密掃描"],
  ["机密管理", "機密管理"],
  ["机密计算", "機密計算"],
  ["树状数组", "樹狀數組"],
  ["梯度下降", "梯度下降"],
  ["模型治理", "模型治理"],
  ["模型漂移", "模型漂移"],
  ["模型监控", "模型監控"],
  ["模型训练", "模型訓練"],
  ["模型评估", "模型評估"],
  ["模式演进", "模式演進"],
  ["正向代理", "正向代理"],
  ["死锁检测", "死鎖檢測"],
  ["死锁预防", "死鎖預防"],
  ["泛型编程", "泛型編程"],
  ["派生仓库", "派生倉庫"],
  ["派生网络", "派生網絡"],
  ["流量整形", "流量整形"],
  ["深度学习", "深度學習"],
  ["混淆矩阵", "混淆矩陣"],
  ["渐近分析", "漸近分析"],
  ["渐进增强", "漸進增強"],
  ["渗透测试", "滲透測試"],
  ["渲染阻塞", "渲染阻塞"],
  ["湖仓一体", "湖倉一體"],
  ["滑动窗口", "滑動窗口"],
  ["滚动更新", "滾動更新"],
  ["滚动部署", "滾動部署"],
  ["漏洞管理", "漏洞管理"],
  ["漏洞评估", "漏洞評估"],
  ["灾难恢复", "災難恢復"],
  ["片上系统", "片上系統"],
  ["版本控制", "版本控制"],
  ["版本锁定", "版本鎖定"],
  ["物化视图", "物化視圖"],
  ["特征工程", "特徵工程"],
  ["状态转移", "狀態轉移"],
  ["环境变量", "環境變量"],
  ["生命周期", "生命週期"],
  ["生成模型", "生成模型"],
  ["用户代理", "用戶代理"],
  ["电源管理", "電源管理"],
  ["监督学习", "監督學習"],
  ["短路求值", "短路求值"],
  ["祖先节点", "祖先節點"],
  ["神经网络", "神經網絡"],
  ["离线算法", "離線算法"],
  ["移动优先", "移動優先"],
  ["稀疏矩阵", "稀疏矩陣"],
  ["稳定排序", "穩定排序"],
  ["立即求值", "立即求值"],
  ["竞态条件", "競態條件"],
  ["端口转发", "端口轉發"],
  ["端点安全", "端點安全"],
  ["类型安全", "類型安全"],
  ["类型推断", "類型推斷"],
  ["类型擦除", "類型擦除"],
  ["类型检查", "類型檢查"],
  ["类型注解", "類型注解"],
  ["类型转换", "類型轉換"],
  ["系统测试", "系統測試"],
  ["系统调用", "系統調用"],
  ["纵深防御", "縱深防禦"],
  ["线性查找", "線性查找"],
  ["缓存控制", "緩存控制"],
  ["编解码器", "編解碼器"],
  ["缺页异常", "缺頁異常"],
  ["网格布局", "網格佈局"],
  ["网络分段", "網絡分段"],
  ["网络协议", "網絡協議"],
  ["网络爬虫", "網絡爬蟲"],
  ["网络策略", "網絡策略"],
  ["网络限速", "網絡限速"],
  ["蓝绿部署", "藍綠部署"],
  ["虚拟内存", "虛擬內存"],
  ["虚拟环境", "虛擬環境"],
  ["计数排序", "計數排序"],
  ["训练数据", "訓練數據"],
  ["设计模式", "設計模式"],
  ["访问令牌", "訪問令牌"],
  ["访问控制", "訪問控制"],
  ["证书吊销", "證書吊銷"],
  ["请求分页", "請求分頁"],
  ["读已提交", "讀已提交"],
  ["负载均衡", "負載均衡"],
  ["负载测试", "負載測試"],
  ["贪心算法", "貪心算法"],
  ["资源泄漏", "資源洩漏"],
  ["资源管理", "資源管理"],
  ["资源请求", "資源請求"],
  ["资源限制", "資源限制"],
  ["跨站脚本", "跨站腳本"],
  ["身份验证", "身份驗證"],
  ["软件架构", "軟件架構"],
  ["软件设计", "軟件設計"],
  ["运行时类", "運行時類"],
  ["近似算法", "近似算法"],
  ["进程状态", "進程狀態"],
  ["进程调度", "進程調度"],
  ["进程隔离", "進程隔離"],
  ["远程仓库", "遠程倉庫"],
  ["连通分量", "連通分量"],
  ["选择排序", "選擇排序"],
  ["速率限制", "速率限制"],
  ["邻居节点", "鄰居節點"],
  ["邻接矩阵", "鄰接矩陣"],
  ["部署环境", "部署環境"],
  ["配置文件", "配置文件"],
  ["配置映射", "配置映射"],
  ["配置漂移", "配置漂移"],
  ["重放攻击", "重放攻擊"],
  ["错误处理", "錯誤處理"],
  ["键值存储", "鍵值存儲"],
  ["附加组件", "附加組件"],
  ["集成测试", "集成測試"],
  ["集群状态", "集群狀態"],
  ["页面置换", "頁面置換"],
  ["预写日志", "預寫日誌"],
  ["预检请求", "預檢請求"],
  ["风险管理", "風險管理"],
  ["风险评估", "風險評估"],
  ["驱动程序", "驅動程序"],
  ["验收测试", "驗收測試"],
  ["高可用性", "高可用性"],
  ["默认分支", "默認分支"],
  ["B 树", "B 樹"],
  ["CSS", "CSS"],
  ["Pod", "Pod"],
  ["SVG", "SVG"],
  ["XML", "XML"],
  ["一致性", "一致性"],
  ["上下文", "上下文"],
  ["中间件", "中間件"],
  ["临界区", "臨界區"],
  ["主机名", "主機名"],
  ["主线程", "主線程"],
  ["乐观锁", "樂觀鎖"],
  ["二进制", "二進制"],
  ["云原生", "雲原生"],
  ["云计算", "雲計算"],
  ["仪表板", "儀表板"],
  ["优先级", "優先級"],
  ["会话层", "會話層"],
  ["传感器", "傳感器"],
  ["传输层", "傳輸層"],
  ["伪元素", "偽元素"],
  ["位掩码", "位掩碼"],
  ["作用域", "作用域"],
  ["依赖项", "依賴項"],
  ["保密性", "保密性"],
  ["信号量", "信號量"],
  ["元数据", "元數據"],
  ["公平性", "公平性"],
  ["内核态", "內核態"],
  ["分布式", "分布式"],
  ["分治法", "分治法"],
  ["初始化", "初始化"],
  ["前缀和", "前綴和"],
  ["前缀树", "前綴樹"],
  ["副作用", "副作用"],
  ["副本集", "副本集"],
  ["加速器", "加速器"],
  ["十进制", "十進制"],
  ["协作者", "協作者"],
  ["协议类", "協議類"],
  ["单调栈", "單調棧"],
  ["卷挂载", "卷掛載"],
  ["原子性", "原子性"],
  ["双指针", "雙指針"],
  ["可用区", "可用區"],
  ["可用性", "可用性"],
  ["可见性", "可見性"],
  ["叶节点", "葉節點"],
  ["吞吐量", "吞吐量"],
  ["哈希表", "哈希表"],
  ["哨兵值", "哨兵值"],
  ["国际化", "國際化"],
  ["基分支", "基分支"],
  ["堆排序", "堆排序"],
  ["复杂度", "複雜度"],
  ["大整数", "大整數"],
  ["大端序", "大端序"],
  ["套接字", "套接字"],
  ["子程序", "子程序"],
  ["子节点", "子節點"],
  ["字典树", "字典樹"],
  ["字符串", "字符串"],
  ["字节码", "字節碼"],
  ["字面值", "字面值"],
  ["存储类", "存儲類"],
  ["完整性", "完整性"],
  ["定点数", "定點數"],
  ["客户端", "客戶端"],
  ["宽高比", "寬高比"],
  ["寄存器", "寄存器"],
  ["密码学", "密碼學"],
  ["小端序", "小端序"],
  ["小组件", "小組件"],
  ["局部性", "局部性"],
  ["工作树", "工作樹"],
  ["工作流", "工作流"],
  ["布尔值", "布爾值"],
  ["平衡树", "平衡樹"],
  ["并查集", "並查集"],
  ["序列化", "序列化"],
  ["应用层", "應用層"],
  ["引用环", "引用環"],
  ["悲观锁", "悲觀鎖"],
  ["慢查询", "慢查詢"],
  ["执行器", "執行器"],
  ["批处理", "批處理"],
  ["拉链法", "拉鍊法"],
  ["持久化", "持久化"],
  ["持久卷", "持久卷"],
  ["指令集", "指令集"],
  ["控制器", "控制器"],
  ["推导式", "推導式"],
  ["描述符", "描述符"],
  ["提示词", "提示詞"],
  ["插入符", "插入符"],
  ["攻击面", "攻擊面"],
  ["数据包", "數據包"],
  ["数据报", "數據報"],
  ["数据框", "數據框"],
  ["数据湖", "數據湖"],
  ["数据集", "數據集"],
  ["无障碍", "無障礙"],
  ["智能体", "智能體"],
  ["最大流", "最大流"],
  ["最小割", "最小割"],
  ["服务器", "服務器"],
  ["本地化", "本地化"],
  ["术语表", "術語表"],
  ["标识符", "標識符"],
  ["栈溢出", "棧溢出"],
  ["校验和", "校驗和"],
  ["样式表", "樣式表"],
  ["根节点", "根節點"],
  ["检查点", "檢查點"],
  ["模型卡", "模型卡"],
  ["注册表", "注冊表"],
  ["流处理", "流處理"],
  ["流水线", "流水線"],
  ["浏览器", "瀏覽器"],
  ["浮点数", "浮點數"],
  ["源代码", "源代碼"],
  ["源映射", "源映射"],
  ["熔断器", "熔斷器"],
  ["生成器", "生成器"],
  ["用户态", "用戶態"],
  ["监听器", "監聽器"],
  ["看门狗", "看門狗"],
  ["确定性", "確定性"],
  ["碎片化", "碎片化"],
  ["索引化", "索引化"],
  ["累加器", "累加器"],
  ["红黑树", "紅黑樹"],
  ["线段树", "線段樹"],
  ["线程池", "線程池"],
  ["缓冲区", "緩衝區"],
  ["缓存行", "緩存行"],
  ["编码器", "編碼器"],
  ["编译器", "編譯器"],
  ["网络层", "網絡層"],
  ["自动化", "自動化"],
  ["芯片组", "芯片組"],
  ["虚拟化", "虛擬化"],
  ["表达式", "表達式"],
  ["装饰器", "裝飾器"],
  ["规范化", "規範化"],
  ["解析器", "解析器"],
  ["解析度", "解析度"],
  ["解码器", "解碼器"],
  ["解释器", "解釋器"],
  ["触发器", "觸發器"],
  ["计数器", "計數器"],
  ["记忆化", "記憶化"],
  ["证书链", "證書鏈"],
  ["读写锁", "讀寫鎖"],
  ["调度器", "調度器"],
  ["调用栈", "調用棧"],
  ["调试器", "調試器"],
  ["负责人", "負責人"],
  ["超文本", "超文本"],
  ["超链接", "超鏈接"],
  ["路由器", "路由器"],
  ["路由表", "路由表"],
  ["边界框", "邊界框"],
  ["过滤器", "過濾器"],
  ["运算符", "運算符"],
  ["运行时", "運行時"],
  ["连接池", "連接池"],
  ["迭代器", "迭代器"],
  ["适配器", "適配器"],
  ["选择器", "選擇器"],
  ["透明度", "透明度"],
  ["邻接表", "鄰接表"],
  ["里程碑", "里程碑"],
  ["链接器", "鏈接器"],
  ["链路层", "鏈路層"],
  ["长任务", "長任務"],
  ["防火墙", "防火牆"],
  ["零信任", "零信任"],
  ["鲁棒性", "魯棒性"],
  ["上游", "上游"],
  ["下溢", "下溢"],
  ["丢包", "丟包"],
  ["中断", "中斷"],
  ["主机", "主機"],
  ["主键", "主鍵"],
  ["争用", "爭用"],
  ["事件", "事件"],
  ["事务", "事務"],
  ["事实", "事實"],
  ["互斥", "互斥"],
  ["仓库", "倉庫"],
  ["代理", "代理"],
  ["任务", "任務"],
  ["任播", "任播"],
  ["优化", "優化"],
  ["会话", "會話"],
  ["伪类", "偽類"],
  ["位图", "位圖"],
  ["保障", "保障"],
  ["信任", "信任"],
  ["信号", "信號"],
  ["信标", "信標"],
  ["偏差", "偏差"],
  ["元类", "元類"],
  ["元素", "元素"],
  ["元组", "元組"],
  ["克隆", "克隆"],
  ["入站", "入站"],
  ["关系", "關係"],
  ["内核", "內核"],
  ["冗余", "冗余"],
  ["冲突", "衝突"],
  ["准入", "准入"],
  ["凭据", "憑據"],
  ["函数", "函數"],
  ["分区", "分區"],
  ["分布", "分布"],
  ["分支", "分支"],
  ["分析", "分析"],
  ["分派", "分派"],
  ["分片", "分片"],
  ["分类", "分類"],
  ["分配", "分配"],
  ["切片", "切片"],
  ["判定", "判定"],
  ["利用", "利用"],
  ["别名", "別名"],
  ["制品", "製品"],
  ["制备", "制備"],
  ["前端", "前端"],
  ["功能", "功能"],
  ["加密", "加密"],
  ["动态", "動態"],
  ["协程", "協程"],
  ["协议", "協議"],
  ["单播", "單播"],
  ["压缩", "壓縮"],
  ["去重", "去重"],
  ["发布", "發佈"],
  ["发现", "發現"],
  ["变更", "變更"],
  ["变量", "變量"],
  ["句柄", "句柄"],
  ["合并", "合併"],
  ["同步", "同步"],
  ["后端", "後端"],
  ["向量", "向量"],
  ["哈希", "哈希"],
  ["响应", "響應"],
  ["回流", "回流"],
  ["回溯", "回溯"],
  ["回滚", "回滾"],
  ["回调", "回調"],
  ["固件", "固件"],
  ["地址", "地址"],
  ["垫片", "墊片"],
  ["域名", "域名"],
  ["基数", "基數"],
  ["声明", "聲明"],
  ["复制", "複製"],
  ["外设", "外設"],
  ["外键", "外鍵"],
  ["多云", "多雲"],
  ["多态", "多態"],
  ["委托", "委託"],
  ["威胁", "威脅"],
  ["子图", "子圖"],
  ["子树", "子樹"],
  ["子网", "子網"],
  ["字典", "字典"],
  ["字形", "字形"],
  ["字段", "字段"],
  ["字节", "字節"],
  ["存储", "存儲"],
  ["定义", "定義"],
  ["实体", "實體"],
  ["实例", "實例"],
  ["实参", "實參"],
  ["实现", "實現"],
  ["审查", "審查"],
  ["审计", "審計"],
  ["容器", "容器"],
  ["容忍", "容忍"],
  ["容量", "容量"],
  ["容错", "容錯"],
  ["对手", "對手"],
  ["对策", "對策"],
  ["对象", "對象"],
  ["对齐", "對齊"],
  ["寻址", "尋址"],
  ["属性", "屬性"],
  ["嵌入", "嵌入"],
  ["差异", "差異"],
  ["带宽", "帶寬"],
  ["帧率", "幀率"],
  ["常量", "常量"],
  ["并发", "併發"],
  ["并行", "並行"],
  ["幻觉", "幻覺"],
  ["广播", "廣播"],
  ["序列", "序列"],
  ["延迟", "延遲"],
  ["开销", "開銷"],
  ["异常", "異常"],
  ["异步", "異步"],
  ["引用", "引用"],
  ["形参", "形參"],
  ["循环", "循環"],
  ["快照", "快照"],
  ["总线", "總線"],
  ["执行", "執行"],
  ["扩展", "擴展"],
  ["抖动", "抖動"],
  ["抽象", "抽象"],
  ["拥塞", "擁塞"],
  ["指令", "指令"],
  ["指针", "指針"],
  ["授权", "授權"],
  ["排序", "排序"],
  ["接口", "接口"],
  ["推理", "推理"],
  ["提交", "提交"],
  ["提升", "提升"],
  ["插件", "插件"],
  ["握手", "握手"],
  ["故障", "故障"],
  ["效率", "效率"],
  ["数据", "數據"],
  ["数组", "數組"],
  ["文档", "文檔"],
  ["方法", "方法"],
  ["日志", "日誌"],
  ["时钟", "時鐘"],
  ["映射", "映射"],
  ["暂存", "暫存"],
  ["替换", "替換"],
  ["服务", "服務"],
  ["权重", "權重"],
  ["条目", "條目"],
  ["构建", "構建"],
  ["枚举", "枚舉"],
  ["查询", "查詢"],
  ["标头", "標頭"],
  ["标志", "標誌"],
  ["标注", "標注"],
  ["标签", "標籤"],
  ["标记", "標記"],
  ["校验", "校驗"],
  ["核心", "核心"],
  ["格式", "格式"],
  ["框架", "框架"],
  ["检出", "檢出"],
  ["森林", "森林"],
  ["概率", "概率"],
  ["模块", "模塊"],
  ["模型", "模型"],
  ["模式", "模式"],
  ["模板", "模板"],
  ["死锁", "死鎖"],
  ["比特", "比特"],
  ["求值", "求值"],
  ["汇编", "匯編"],
  ["污点", "污點"],
  ["沙箱", "沙箱"],
  ["泄漏", "洩漏"],
  ["泛化", "泛化"],
  ["泛型", "泛型"],
  ["注解", "注解"],
  ["消息", "消息"],
  ["清单", "清單"],
  ["游标", "游標"],
  ["溢出", "溢出"],
  ["漂移", "漂移"],
  ["漏洞", "漏洞"],
  ["激活", "激活"],
  ["版本", "版本"],
  ["状态", "狀態"],
  ["环境", "環境"],
  ["瓶颈", "瓶頸"],
  ["画布", "畫布"],
  ["目录", "目錄"],
  ["矩阵", "矩陣"],
  ["码点", "碼點"],
  ["端口", "端口"],
  ["端点", "端點"],
  ["策略", "策略"],
  ["签名", "簽名"],
  ["算术", "算術"],
  ["算法", "算法"],
  ["类型", "類型"],
  ["粒度", "粒度"],
  ["精度", "精度"],
  ["索引", "索引"],
  ["约束", "約束"],
  ["线程", "線程"],
  ["组件", "組件"],
  ["组合", "組合"],
  ["组播", "組播"],
  ["组织", "組織"],
  ["绑定", "綁定"],
  ["结构", "結構"],
  ["继承", "繼承"],
  ["维度", "維度"],
  ["缓存", "緩存"],
  ["编排", "編排"],
  ["编码", "編碼"],
  ["缺陷", "缺陷"],
  ["网关", "網關"],
  ["耦合", "耦合"],
  ["聚合", "聚合"],
  ["脏读", "髒讀"],
  ["脚本", "腳本"],
  ["节流", "節流"],
  ["节点", "節點"],
  ["范式", "範式"],
  ["获取", "獲取"],
  ["补丁", "補丁"],
  ["表示", "表示"],
  ["规范", "規範"],
  ["视口", "視口"],
  ["解密", "解密"],
  ["训练", "訓練"],
  ["议题", "議題"],
  ["记录", "記錄"],
  ["访问", "訪問"],
  ["证书", "證書"],
  ["词元", "詞元"],
  ["语义", "語義"],
  ["语句", "語句"],
  ["语法", "語法"],
  ["请求", "請求"],
  ["调用", "調用"],
  ["负载", "負載"],
  ["贡献", "貢獻"],
  ["资源", "資源"],
  ["超时", "超時"],
  ["路径", "路徑"],
  ["路由", "路由"],
  ["身份", "身份"],
  ["载荷", "載荷"],
  ["输入", "輸入"],
  ["输出", "輸出"],
  ["边界", "邊界"],
  ["边车", "邊車"],
  ["迁移", "遷移"],
  ["进程", "進程"],
  ["连接", "連接"],
  ["迭代", "迭代"],
  ["递归", "遞歸"],
  ["遍历", "遍歷"],
  ["遥测", "遙測"],
  ["邻接", "鄰接"],
  ["部署", "部署"],
  ["配置", "配置"],
  ["重构", "重構"],
  ["重绘", "重繪"],
  ["重试", "重試"],
  ["钩子", "鈎子"],
  ["链表", "鏈表"],
  ["错误", "錯誤"],
  ["闭包", "閉包"],
  ["队列", "隊列"],
  ["防抖", "防抖"],
  ["隐私", "隱私"],
  ["隔离", "隔離"],
  ["集合", "集合"],
  ["集群", "集群"],
  ["韧性", "韌性"],
  ["顶点", "頂點"],
  ["风险", "風險"],
  ["列", "列"],
  ["包", "包"],
  ["卷", "卷"],
  ["图", "圖"],
  ["块", "塊"],
  ["域", "域"],
  ["堆", "堆"],
  ["库", "庫"],
  ["栈", "棧"],
  ["桶", "桶"],
  ["流", "流"],
  ["源", "源"],
  ["环", "環"],
  ["类", "類"],
  ["行", "行"],
  ["表", "表"],
  ["边", "邊"],
  ["锁", "鎖"],
  ["键", "鍵"],
  ["页", "頁"],
];
for (const [source, target] of S2T_COMPUTER_GLOSS_OVERRIDES) {
  S2T_PHRASES.set(source, target);
  S2T_PHRASES.set(target, target);
}

const S2T_PAIRS = `万萬与與专业專業丛叢东東丝絲丢丟两兩严嚴丧喪个個丰豐临臨为為丽麗举舉么麼义義乌烏乐樂乔喬习習乡鄉书書买買乱亂争爭于於亏虧云雲亚亞产產亩畝亲親亿億仅僅从從仑侖仓倉仪儀们們价價众眾优優会會伞傘伟偉传傳伤傷伦倫伪偽体體余餘佣傭侠俠侣侶侥僥侦偵侧側侨僑侩儈俭儉债債倾傾偿償储儲儿兒兑兌党黨兰蘭关關兴興养養兽獸内內冈岡册冊写寫军軍农農冲沖决決况況冻凍净淨凉涼减減凑湊凤鳳凭憑凯凱击擊凿鑿刍芻划劃刘劉则則刚剛创創删刪别別刮颳制製刹剎剂劑剐剮剑劍剧劇劝勸办辦务務动動励勵劲勁劳勞势勢勋勳匀勻区區医醫华華协協单單卖賣卢盧卫衛却卻厅廳历歷厉厲压壓厌厭厕廁厦廈厨廚县縣参參双雙发發变變叙敘叶葉号號叹嘆吓嚇吕呂吗嗎吨噸听聽启啟吴吳呐吶呕嘔员員呛嗆呜嗚咏詠咙嚨咸鹹响響哑啞哗嘩哟喲唤喚啧嘖喷噴喽嘍嘘噓团團园園围圍国國图圖圆圓圣聖场場坏壞块塊坚堅坛壇坝壩坞塢坟墳坠墜垄壟垒壘垦墾垫墊埘塒埙塤堑塹墙牆壮壯声聲壳殼壶壺处處备備复復够夠头頭夹夾夺奪奋奮奖獎妇婦妈媽妆妝姗姍姜薑娄婁娱娛婴嬰孙孫学學宁寧宝寶实實宠寵审審宪憲宫宮宽寬宾賓寝寢对對寻尋导導寿壽将將尔爾尘塵尝嘗尧堯尸屍尽盡层層屉屜属屬岁歲岂豈岗崗岛島岭嶺岳嶽峡峽峦巒币幣帅帥师師帐帳帘簾带帶帮幫帧幀并並广廣庄莊庆慶庐廬库庫应應庙廟庞龐废廢开開异異弃棄张張弥彌弯彎弹彈强強归歸当當录錄彻徹径徑忆憶忧憂怀懷态態总總恋戀恳懇恶惡恼惱悦悅悬懸惊驚惧懼惨慘惩懲惯慣愤憤愿願慑懾戏戲战戰户戶扑撲执執扩擴扫掃扬揚扰擾抚撫抛拋抢搶护護报報担擔拟擬拥擁拦攔拨撥择擇挂掛挚摯挛攣挞撻挟挾挥揮损損换換捣搗据據掳擄掷擲掺摻揽攬搀攙携攜摄攝摆擺摇搖摊攤撑撐撵攆撷擷撸擼敌敵数數斋齋斗鬥斩斬断斷无無旧舊时時旷曠显顯晋晉晒曬晓曉暂暫术術朴樸机機杀殺杂雜权權条條来來杨楊杰傑极極构構枣棗枪槍柜櫃标標栈棧栋棟栏欄树樹样樣桥橋桩樁梦夢检檢楼樓横橫橹櫓欢歡欧歐歼殲残殘殴毆毁毀毕畢毙斃气氣氢氫汇匯汉漢汤湯沟溝没沒沥瀝沦淪沧滄沪滬泞濘泪淚泽澤洁潔洼窪浅淺浆漿浇澆浊濁测測济濟浑渾浓濃涂塗涌湧涛濤涝澇涡渦涣渙涤滌润潤涩澀涨漲渐漸渔漁渗滲温溫湾灣湿濕溃潰滚滾满滿滤濾滥濫滨濱滩灘滞滯漤灠潜潛潇瀟灭滅灯燈灵靈灾災灿燦炉爐点點炼煉烁爍烂爛烛燭热熱爱愛爷爺牵牽犊犢状狀犹猶狈狽狱獄独獨狭狹猎獵猫貓献獻玛瑪环環现現玺璽珐琺琐瑣琼瓊电電画畫畅暢疗療疟瘧疮瘡疯瘋瘫癱皑皚皱皺盘盤卢盧监監盖蓋盗盜眦眥睁睜瞒瞞矫矯矿礦码碼砖磚砚硯砾礫础礎硕碩确確碍礙礼禮祷禱祸禍离離秃禿秆稈种種积積称稱秽穢稳穩穷窮窃竊窍竅窝窩窥窺窜竄竞競笋筍笔筆笺箋筑築筛篩筝箏筹籌签簽简簡箩籮篮籃类類粮糧紧緊纠糾红紅纤纖约約级級纪紀纫紉纬緯纯純纱紗纲綱纳納纵縱纷紛纸紙纹紋纺紡纽紐线線练練组組细細织織终終绍紹经經绑綁绒絨结結绕繞绘繪给給络絡绝絕绞絞统統绢絹绣繡继繼绩績绪緒续續绳繩维維绵綿绷繃绿綠缀綴缄緘缅緬缆纜缓緩编編缘緣缚縛缝縫缠纏缩縮缴繳网網罗羅罚罰职職联聯聪聰肃肅肠腸肤膚肾腎肿腫胀脹胆膽胜勝胶膠脉脈脏臟脑腦脚腳脱脫脸臉腻膩腾騰舆輿舰艦舱艙艺藝节節芜蕪苇葦苍蒼苏蘇范範茧繭荐薦荆荊荡蕩荣榮药藥莲蓮获獲莹瑩营營萧蕭蓝藍蔷薔蔼藹蕴蘊薮藪虚虛虫蟲虽雖蚀蝕蚁蟻蚂螞蛊蠱蛮蠻补補衬襯袜襪袭襲装裝裤褲见見观觀规規觅覓视視览覽觉覺触觸誉譽计計订訂认認讨討让讓训訓议議讯訊记記讲講讳諱讶訝许許论論讼訟设設访訪诀訣证證评評识識诈詐诉訴诊診词詞译譯试試诗詩诚誠话話诞誕询詢该該详詳语語误誤诱誘说說诵誦请請诸諸诺諾读讀课課谁誰调調谈談谊誼谋謀谎謊谐諧谓謂谣謠谦謙谨謹谱譜贝貝负負贡貢财財责責贤賢败敗账賬货貨质質贩販贪貪贫貧贬貶购購贯貫贮貯贴貼贵貴贷貸贸貿费費贺賀贼賊贾賈资資赋賦赌賭赏賞赔賠赖賴赚賺赛賽赞讚赠贈赢贏赵趙赶趕趋趨跃躍践踐踪蹤车車轨軌轩軒转轉轮輪软軟轰轟轴軸轻輕载載较較辅輔辆輛辈輩辉輝辐輻辑輯输輸辕轅辖轄辗輾辙轍辞辭边邊辽遼达達迁遷过過迈邁运運还還这這进進远遠违違连連迟遲迩邇适適选選递遞逻邏遗遺邮郵邻鄰郑鄭酝醞酱醬酿釀释釋里裏鉴鑒钉釘针針钓釣钝鈍钟鐘钢鋼钥鑰钦欽钧鈞钩鉤钱錢钳鉗钻鑽铁鐵铃鈴铅鉛铜銅铭銘银銀铸鑄铺鋪链鏈销銷锁鎖锅鍋锋鋒错錯锡錫锣鑼锦錦键鍵锻鍛镀鍍镇鎮镜鏡镶鑲长長门門闪閃闭閉问問闯闖闲閒间間闻聞阅閱阐闡队隊阳陽阴陰阵陣阶階际際陆陸陈陳险險随隨隐隱难難雏雛雾霧静靜顶頂项項顺順须須顾顧顿頓颁頒颂頌预預领領颇頗颈頸频頻题題颜顏额額风風飞飛饥飢饭飯饮飲饲飼饱飽饰飾饼餅馆館马馬驭馭驯馴驰馳驱驅驳駁驻駐骑騎骗騙骚騷验驗骤驟鱼魚鲁魯鲜鮮鸟鳥鸡雞鸣鳴鸭鴨鸿鴻鹅鵝鹏鵬麦麥黄黃黉黌齐齊齿齒龙龍龟龜`;
const S2T_CHARS = new Map();
for (let index = 0; index < S2T_PAIRS.length - 1; index += 2) {
  S2T_CHARS.set(S2T_PAIRS[index], S2T_PAIRS[index + 1]);
}

export function toTraditional(value) {
  let text = normalizeDisplayText(value);
  const protectedValues = [];
  for (const [source, target] of [...S2T_PHRASES.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (!source || !text.includes(source)) continue;
    const marker = `\uE000${protectedValues.length.toString(36)}\uE001`;
    protectedValues.push(target);
    text = text.split(source).join(marker);
  }
  text = [...text].map((character) => S2T_CHARS.get(character) ?? character).join('');
  protectedValues.forEach((target, index) => {
    text = text.split(`\uE000${index.toString(36)}\uE001`).join(target);
  });
  return text;
}

export function normalizeGlossHant(value) {
  const result = toTraditional(value);
  if (result.length > MAX_GLOSS_TEXT) throw new Error(`释义不能超过 ${MAX_GLOSS_TEXT} 个字符`);
  return result;
}

const POS_TOKENS = [
  'infinitive marker', 'auxiliary v.', 'modal v.', 'exclam.', 'prep.', 'pron.', 'conj.',
  'det.', 'art.', 'num.', 'adj.', 'adv.', 'n.', 'v.',
];

export function parseLegacySourceLine(line) {
  const text = normalizeDisplayText(line);
  if (!text || /^#{1,6}\s+/.test(text)) return null;
  const labelPattern = new RegExp(`(?:\\s+)((?:${POS_TOKENS.map((token) => token.replace('.', '\\.') ).join('|')})(?:\\s*[,/]\\s*(?:${POS_TOKENS.map((token) => token.replace('.', '\\.') ).join('|')}))*)$`, 'i');
  const match = text.match(labelPattern);
  if (!match) return { text, sourceLabel: '' };
  return {
    text: normalizeDisplayText(text.slice(0, match.index)),
    sourceLabel: normalizeDisplayText(match[1]),
  };
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function coercePos(value) {
  if (Array.isArray(value)) return value.map(normalizeDisplayText).filter(Boolean).join(', ');
  return normalizeDisplayText(value);
}

function legacyWord(entry) {
  return normalizeDisplayText(entry?.manualWord || entry?.word || entry?.text || entry?.w || '');
}

export function migrateLegacyBackup(input, { timestamp = nowIso() } = {}) {
  if ([3, 4, SCHEMA_VERSION].includes(Number(input?.schemaVersion)) && Array.isArray(input?.domains)) {
    return canonicalizeBackup({ ...input, schemaVersion: SCHEMA_VERSION, studyStamps: array(input?.studyStamps) });
  }

  const categories = array(input?.categories);
  const oldEntries = array(input?.entries);
  const domains = [createDomain({ id: DEFAULT_DOMAIN_ID, name: DEFAULT_DOMAIN_NAME, order: 0, timestamp })];
  const categoryIdMap = new Map();
  const collections = [];

  categories.forEach((category, index) => {
    const oldId = String(category?.id || `category_${index}`);
    const collection = createCollection({
      id: safeId('collection', `${DEFAULT_DOMAIN_ID}:${oldId}`),
      domainId: DEFAULT_DOMAIN_ID,
      name: category?.name || category?.label || oldId,
      label: category?.label || '',
      order: Number.isFinite(category?.order) ? category.order : index,
      timestamp,
    });
    categoryIdMap.set(oldId, collection.id);
    collections.push(collection);
  });
  if (!collections.length) {
    const fallback = createCollection({ domainId: DEFAULT_DOMAIN_ID, name: '默认词表', order: 0, timestamp });
    collections.push(fallback);
  }
  collections.push(createCollection({
    domainId: DEFAULT_DOMAIN_ID,
    name: '短语总表',
    type: 'system-phrases',
    order: Number.MAX_SAFE_INTEGER,
    timestamp,
  }));

  const entryByNormalized = new Map();
  const legacyEntryIdMap = new Map();
  const membershipsByKey = new Map();

  oldEntries.forEach((legacyEntry, entryIndex) => {
    const text = legacyWord(legacyEntry);
    const normalizedText = normalizeEnglish(text);
    if (!normalizedText) return;
    let entry = entryByNormalized.get(normalizedText);
    if (!entry) {
      entry = createEntry({ id: safeId('entry', `${DEFAULT_DOMAIN_ID}:${normalizedText}`), domainId: DEFAULT_DOMAIN_ID, text, timestamp });
      entryByNormalized.set(normalizedText, entry);
    }
    if (legacyEntry?.id != null) legacyEntryIdMap.set(String(legacyEntry.id), entry.id);

    const sources = object(legacyEntry?.sources);
    const sourceEntries = Object.entries(sources);
    if (sourceEntries.length) {
      sourceEntries.forEach(([oldCategoryId, source], sourceIndex) => {
        const collectionId = categoryIdMap.get(String(oldCategoryId));
        if (!collectionId) return;
        const key = `${entry.id}:${collectionId}`;
        const sourceLabel = coercePos(legacyEntry?.manualPos || source?.pos || source?.label || legacyEntry?.pos || legacyEntry?.partOfSpeech);
        const existing = membershipsByKey.get(key);
        membershipsByKey.set(key, createMembership({
          id: existing?.id,
          entryId: entry.id,
          collectionId,
          sourceLabel: existing?.sourceLabel || sourceLabel,
          sourceOrder: Number.isFinite(source?.order) ? source.order : (Number.isFinite(legacyEntry?.order) ? legacyEntry.order : entryIndex + sourceIndex / 1000),
          timestamp: existing?.createdAt || timestamp,
        }));
      });
    } else {
      const oldCategoryId = String(legacyEntry?.categoryId ?? legacyEntry?.category ?? categories[0]?.id ?? '');
      const collectionId = categoryIdMap.get(oldCategoryId) || collections.find((item) => item.type === 'normal')?.id;
      if (collectionId) {
        const key = `${entry.id}:${collectionId}`;
        membershipsByKey.set(key, createMembership({
          entryId: entry.id,
          collectionId,
          sourceLabel: coercePos(legacyEntry?.manualPos || legacyEntry?.pos || legacyEntry?.partOfSpeech || legacyEntry?.d),
          sourceOrder: Number.isFinite(legacyEntry?.order) ? legacyEntry.order : entryIndex,
          timestamp,
        }));
      }
    }
  });

  const entries = [...entryByNormalized.values()];
  const memberships = [...membershipsByKey.values()];
  const relationComponents = buildRelationComponentsForEntries(entries);
  const collectionsById = new Map(collections.map((item) => [item.id, item]));
  const entriesById = new Map(entries.map((item) => [item.id, item]));

  const primaryCollectionForEntry = (entryId) => {
    const candidates = memberships
      .filter((item) => item.entryId === entryId)
      .map((item) => collectionsById.get(item.collectionId))
      .filter((item) => item?.type === 'normal')
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return candidates[0]?.id || systemPhraseCollectionId(DEFAULT_DOMAIN_ID);
  };

  const pinsByEntry = new Map();
  array(input?.pins).forEach((pin, index) => {
    const entryId = legacyEntryIdMap.get(String(pin?.entryId ?? pin?.wordId ?? ''));
    if (!entryId || !entriesById.has(entryId) || pinsByEntry.has(entryId)) return;
    const mappedContext = categoryIdMap.get(String(pin?.categoryId ?? pin?.contextCategoryId ?? ''));
    const contextCollectionId = mappedContext || primaryCollectionForEntry(entryId);
    pinsByEntry.set(entryId, {
      id: safeId('pin', entryId),
      entryId,
      domainId: DEFAULT_DOMAIN_ID,
      contextCollectionId,
      order: Number.isFinite(pin?.order) ? pin.order : index,
      createdAt: pin?.createdAt || timestamp,
    });
  });
  const pins = [...pinsByEntry.values()];

  const annotations = array(input?.annotations).flatMap((annotation) => {
    const entryId = legacyEntryIdMap.get(String(annotation?.entryId ?? annotation?.id ?? ''));
    if (!entryId) return [];
    const spellingSuggestion = normalizeDisplayText(
      annotation?.spelling?.suggestion || annotation?.suggestion || annotation?.replacement || '',
    );
    const spellingIncorrect = Boolean(annotation?.spelling?.incorrect || annotation?.incorrect || spellingSuggestion);
    const legacyPosSuggestion = coercePos(annotation?.pos?.suggestion || annotation?.posSuggestion || '');
    const legacyPosIssue = Boolean(annotation?.pos?.incorrect || legacyPosSuggestion);
    const reason = normalizeDisplayText(annotation?.reason || (legacyPosIssue
      ? `旧版词性标注${legacyPosSuggestion ? `：${legacyPosSuggestion}` : '，请人工核对'}`
      : ''));
    if (!spellingIncorrect && !reason) return [];
    return [{
      entryId,
      domainId: DEFAULT_DOMAIN_ID,
      spelling: { incorrect: spellingIncorrect, suggestion: spellingSuggestion },
      reason,
      createdAt: annotation?.createdAt || timestamp,
      updatedAt: annotation?.updatedAt || timestamp,
    }];
  });

  const settingsInput = object(input?.settings);
  const lastPositions = {};
  const legacyLastPairs = [];
  for (const [key, oldEntryId] of Object.entries(settingsInput)) {
    if (key.startsWith('lastPosition:') && typeof oldEntryId === 'string') {
      legacyLastPairs.push([key.slice('lastPosition:'.length), oldEntryId]);
    }
  }
  const legacyLast = object(settingsInput.lastPositions || settingsInput.lastPosition);
  for (const [key, oldEntryId] of Object.entries(legacyLast)) {
    legacyLastPairs.push([key.startsWith('lastPosition:') ? key.slice('lastPosition:'.length) : key, oldEntryId]);
  }
  for (const [oldCategoryId, oldEntryId] of legacyLastPairs) {
    const entryId = legacyEntryIdMap.get(String(oldEntryId));
    if (!entryId) continue;
    const collectionId = categoryIdMap.get(String(oldCategoryId)) || primaryCollectionForEntry(entryId);
    if ((buildProjection({ collections, entries, memberships }).get(collectionId) || []).some((item) => item.id === entryId)) {
      lastPositions[`lastPosition:${DEFAULT_DOMAIN_ID}:${collectionId}`] = entryId;
    }
  }

  return canonicalizeBackup({
    schemaVersion: SCHEMA_VERSION,
    appVersion: '4.4.0',
    exportedAt: timestamp,
    domains,
    collections,
    entries,
    memberships,
    relationComponents,
    pins,
    annotations,
    settings: {
      numberMode: ['none', 'group', 'global'].includes(settingsInput.numberMode) ? settingsInput.numberMode : 'global',
    closeLowLevelRelations: settingsInput.closeLowLevelRelations !== false,
      lastPositions,
      migrationComplete: true,
      migrationSource: input?.appVersion || '2.x',
    },
  });
}

export function canonicalizeBackup(input) {
  const timestamp = normalizeDisplayText(input?.exportedAt) || nowIso();
  const domains = array(input?.domains).map((item, index) => createDomain({ ...item, order: item?.order ?? index, timestamp, createdAt: item?.createdAt || timestamp, updatedAt: item?.updatedAt || item?.createdAt || timestamp }));
  const collections = array(input?.collections).map((item, index) => createCollection({ ...item, order: item?.order ?? index, timestamp, createdAt: item?.createdAt || timestamp, updatedAt: item?.updatedAt || item?.createdAt || timestamp }));
  const entries = array(input?.entries).map((item) => createEntry({ ...item, timestamp, createdAt: item?.createdAt || timestamp, updatedAt: item?.updatedAt || item?.createdAt || timestamp }));
  const memberships = array(input?.memberships).map((item) => createMembership({ ...item, timestamp, createdAt: item?.createdAt || timestamp, updatedAt: item?.updatedAt || item?.createdAt || timestamp }));
  domains.sort((a, b) => a.order - b.order || normalizeEnglish(a.name).localeCompare(normalizeEnglish(b.name), 'en'));
  collections.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.order - b.order || normalizeEnglish(a.name).localeCompare(normalizeEnglish(b.name), 'en'));
  entries.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.normalizedText.localeCompare(b.normalizedText, 'en'));
  memberships.sort((a, b) => a.collectionId.localeCompare(b.collectionId) || a.sourceOrder - b.sourceOrder || a.entryId.localeCompare(b.entryId));
  const rebuiltComponents = buildRelationComponentsForEntries(entries);
  const pins = array(input?.pins).map((item, index) => ({
    id: item?.id || safeId('pin', item?.entryId),
    entryId: String(item?.entryId || ''),
    domainId: String(item?.domainId || ''),
    contextCollectionId: String(item?.contextCollectionId || ''),
    order: Number.isFinite(item?.order) ? item.order : index,
    createdAt: item?.createdAt || timestamp,
  }));
  const annotations = array(input?.annotations).map((item) => ({
    entryId: String(item?.entryId || ''),
    domainId: String(item?.domainId || ''),
    spelling: {
      incorrect: Boolean(item?.spelling?.incorrect),
      suggestion: normalizeDisplayText(item?.spelling?.suggestion),
    },
    reason: normalizeDisplayText(item?.reason),
    createdAt: item?.createdAt || timestamp,
    updatedAt: item?.updatedAt || timestamp,
  })).filter((item) => item.spelling.incorrect || item.reason);
  const migratedStudy = migrateStudyStampsToEntries(input?.studyStamps, entries, domains);
  const studyStamps = migratedStudy.stamps;
  pins.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.contextCollectionId.localeCompare(b.contextCollectionId) || a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.entryId.localeCompare(b.entryId));
  annotations.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.entryId.localeCompare(b.entryId));
  studyStamps.sort((a, b) => a.key.localeCompare(b.key));

  const settingsInput = object(input?.settings);
  const lastPositions = Object.fromEntries(Object.entries(object(settingsInput.lastPositions))
    .filter(([key, value]) => key.startsWith('lastPosition:') && typeof value === 'string'));
  const settings = {
    numberMode: ['none', 'group', 'global'].includes(settingsInput.numberMode) ? settingsInput.numberMode : 'global',
    closeLowLevelRelations: settingsInput.closeLowLevelRelations !== false,
    lastPositions,
    viewModes: Object.fromEntries(Object.entries(object(settingsInput.viewModes)).filter(([, value]) => ['alphabet', 'date'].includes(value))),
    calendarMonths: Object.fromEntries(Object.entries(object(settingsInput.calendarMonths)).filter(([, value]) => /^\d{4}-\d{2}$/.test(String(value)))),
    migrationComplete: Boolean(settingsInput.migrationComplete),
    migrationSource: normalizeDisplayText(settingsInput.migrationSource || ''),
    migrationNoticePending: Boolean(settingsInput.migrationNoticePending),
    studyStampMigrationIssues: [...array(settingsInput.studyStampMigrationIssues), ...migratedStudy.issues]
      .filter((item, index, list) => item?.type && list.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index),
    builtInSeedRevision: Math.max(0, Number(settingsInput.builtInSeedRevision || 0)),
    contentSources: array(settingsInput.contentSources).map((item) => ({
      key: normalizeDisplayText(item?.key || item?.id || ''),
      title: normalizeDisplayText(item?.title || ''),
      publisher: normalizeDisplayText(item?.publisher || ''),
      url: normalizeDisplayText(item?.url || ''),
      retrievedAt: normalizeDisplayText(item?.retrievedAt || ''),
    })).filter((item) => item.key && item.title),
  };
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: normalizeDisplayText(input?.appVersion || '4.4.0'),
    exportedAt: timestamp,
    domains,
    collections,
    entries,
    memberships,
    relationComponents: rebuiltComponents,
    pins,
    annotations,
    studyStamps,
    settings,
  };
  validateBackup(backup);
  return backup;
}

export function validateBackup(backup) {
  if (Number(backup?.schemaVersion) !== SCHEMA_VERSION) throw new Error('备份 schemaVersion 必须为 6');
  const domains = array(backup.domains);
  const collections = array(backup.collections);
  const entries = array(backup.entries);
  const memberships = array(backup.memberships);
  const components = array(backup.relationComponents);
  const pins = array(backup.pins);
  const annotations = array(backup.annotations);
  const studyStamps = array(backup.studyStamps);
  const contentSources = array(backup.settings?.contentSources);

  const unique = (items, getKey, message) => {
    const seen = new Set();
    for (const item of items) {
      const key = getKey(item);
      if (!key || seen.has(key)) throw new Error(message);
      seen.add(key);
    }
  };

  const validId = (value) => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,199}$/u.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
  const validTokenId = (value) => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,220}$/u.test(value);
  unique(domains, (item) => item.id, '词域 ID 为空或重复');
  unique(collections, (item) => item.id, '词表 ID 为空或重复');
  unique(entries, (item) => item.id, '内容 ID 为空或重复');
  unique(entries, (item) => `${item.domainId}\u0000${item.normalizedText}`, '同一词域内内容重复');
  unique(memberships, (item) => `${item.entryId}\u0000${item.collectionId}`, '来源关系重复');
  unique(components, (item) => item.id, '关系组件 ID 重复');
  unique(pins, (item) => item.entryId, '同一内容存在多个 PIN');
  unique(annotations, (item) => item.entryId, '同一内容存在多个 AI 标注');
  unique(studyStamps, (item) => item.key, '学习日期键为空或重复');
  unique(contentSources, (item) => item.key, '内容来源键为空或重复');
  for (const source of contentSources) {
    if (source.key.length > 120 || source.title.length > 240 || source.publisher.length > 160 || source.url.length > 1000 || source.retrievedAt.length > 40) {
      throw new Error('内容来源字段过长');
    }
    if (source.url && !/^https?:\/\//i.test(source.url)) throw new Error('内容来源 URL 无效');
  }
  for (const item of [...domains, ...collections, ...entries, ...memberships, ...pins]) {
    if (!validId(item.id)) throw new Error('数据包含无效或危险 ID');
  }
  for (const component of components) if (!validTokenId(component.id)) throw new Error('关系组件 ID 无效');
  unique(domains, (item) => normalizeEnglish(item.name), '词域名称重复');
  unique(collections, (item) => `${item.domainId}\u0000${normalizeEnglish(item.name)}`, '同一词域内词表名称重复');

  const domainIds = new Set(domains.map((item) => item.id));
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const entryById = new Map(entries.map((item) => [item.id, item]));
  const membershipByEntry = new Map();
  memberships.forEach((item) => {
    if (!entryById.has(item.entryId)) throw new Error('来源关系指向不存在内容');
    const collection = collectionById.get(item.collectionId);
    if (!collection) throw new Error('来源关系指向不存在词表');
    if (collection.type !== 'normal') throw new Error('来源关系只能指向普通词表');
    const entry = entryById.get(item.entryId);
    if (entry.domainId !== collection.domainId) throw new Error('来源关系跨词域');
    const list = membershipByEntry.get(item.entryId) || [];
    list.push(item);
    membershipByEntry.set(item.entryId, list);
  });

  for (const domain of domains) {
    const phraseCollections = collections.filter((item) => item.domainId === domain.id && item.type === 'system-phrases');
    if (domain.contentMode === 'structured') {
      if (phraseCollections.length !== 1) throw new Error(`结构化词域 ${domain.name} 必须恰有一个系统短语表`);
      if (phraseCollections[0].id !== systemPhraseCollectionId(domain.id)) throw new Error('系统短语表 ID 无效');
    } else if (phraseCollections.length) throw new Error(`非结构词域 ${domain.name} 不应持久化系统短语表`);
  }

  for (const collection of collections) {
    if (!domainIds.has(collection.domainId)) throw new Error('词表指向不存在词域');
  }

  for (const entry of entries) {
    if (!domainIds.has(entry.domainId)) throw new Error('内容指向不存在词域');
    if (entry.normalizedText !== normalizeEnglish(entry.text)) throw new Error('内容规范文本不一致');
    if (!['word', 'phrase', 'content'].includes(entry.kind)) throw new Error('内容 kind 无效');
    const domain = domains.find((item) => item.id === entry.domainId);
    if (domain?.contentMode === 'nonStructured' && entry.kind !== 'content') throw new Error('非结构词域只能包含 content Entry');
    if (domain?.contentMode === 'structured' && entry.kind === 'content') throw new Error('结构化词域不能包含 content Entry');
    if (entry.glossHant !== normalizeGlossHant(entry.glossHant)) throw new Error('释义不是规范繁体');
    if (['word', 'phrase', 'content'].includes(entry.kind)) {
      const hasNormalMembership = (membershipByEntry.get(entry.id) || [])
        .some((item) => collectionById.get(item.collectionId)?.type === 'normal');
      if (!hasNormalMembership) throw new Error(`内容 ${entry.text} 没有普通词表来源`);
    }
  }

  const expectedComponents = buildRelationComponentsForEntries(entries);
  if (JSON.stringify(components) !== JSON.stringify(expectedComponents)) throw new Error('关系组件索引与内容不一致');

  const visible = buildProjection(backup);
  for (const pin of pins) {
    const entry = entryById.get(pin.entryId);
    const collection = collectionById.get(pin.contextCollectionId);
    const domainTotalId = entry ? systemDomainWordsCollectionId(entry.domainId) : '';
    const virtualValid = pin.contextCollectionId === SYSTEM_GLOBAL_WORDS_ID || pin.contextCollectionId === SYSTEM_GLOBAL_PHRASES_ID || pin.contextCollectionId === SYSTEM_GLOBAL_CONTENT_ID || pin.contextCollectionId === domainTotalId || pin.contextCollectionId === systemDomainContentCollectionId(entry?.domainId || '');
    if (!entry || pin.domainId !== entry.domainId || (!virtualValid && (!collection || collection.domainId !== entry.domainId))) {
      throw new Error('PIN 关联无效');
    }
    if (!Number.isFinite(pin.order) || pin.order < 0) throw new Error('PIN 顺序无效');
    if (!(visible.get(pin.contextCollectionId) || []).some((item) => item.id === entry.id)) throw new Error('PIN 指向不可见内容');
  }
  for (const [key, entryId] of Object.entries(object(backup.settings?.lastPositions))) {
    const parts = key.split(':');
    const collectionId = parts.length >= 5 ? parts.slice(2, -2).join(':') : parts.slice(2).join(':');
    if (!visible.has(collectionId) || !(visible.get(collectionId) || []).some((item) => item.id === entryId)) {
      throw new Error('上次位置指向不可见内容');
    }
  }
  for (const annotation of annotations) {
    const entry = entryById.get(annotation.entryId);
    if (!entry || annotation.domainId !== entry.domainId) throw new Error('AI 标注关联无效');
  }
  for (const stamp of studyStamps) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp.reviewDateKey) || !stamp.reviewedAt) throw new Error('学习日期记录无效');
    if (stamp.scope !== 'entry' || !entryById.has(stamp.entryId) || stamp.key !== `entry:${stamp.entryId}`) throw new Error('学习日期关联无效');
  }
  return true;
}

export function buildProjection(backup) {
  const domains = array(backup?.domains).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const collections = array(backup?.collections);
  const entries = array(backup?.entries);
  const memberships = array(backup?.memberships);
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const domainById = new Map(domains.map((item) => [item.id, item]));
  const domainOrder = new Map(domains.map((item, index) => [item.id, index]));
  const membershipsByEntry = new Map();
  memberships.forEach((membership) => {
    const list = membershipsByEntry.get(membership.entryId) || [];
    list.push(membership);
    membershipsByEntry.set(membership.entryId, list);
  });
  const projection = new Map(collections.map((item) => [item.id, []]));
  projection.set(SYSTEM_GLOBAL_WORDS_ID, []);
  projection.set(SYSTEM_GLOBAL_PHRASES_ID, []);
  projection.set(SYSTEM_GLOBAL_CONTENT_ID, []);
  for (const domain of domains) {
    if (domain.contentMode === 'nonStructured') projection.set(systemDomainContentCollectionId(domain.id), []);
    else projection.set(systemDomainWordsCollectionId(domain.id), []);
  }

  const globalWords = [];
  const globalPhrases = [];
  const globalContent = [];
  for (const entry of entries) {
    const domain = domainById.get(entry.domainId);
    const candidates = (membershipsByEntry.get(entry.id) || [])
      .map((membership) => ({ membership, collection: collectionById.get(membership.collectionId) }))
      .filter((item) => item.collection?.type === 'normal' && !item.collection.hidden)
      .sort((a, b) => a.collection.order - b.collection.order
        || Number(a.membership.sourceOrder || 0) - Number(b.membership.sourceOrder || 0)
        || a.collection.name.localeCompare(b.collection.name));

    if (entry.kind === 'content' || domain?.contentMode === 'nonStructured') {
      projection.get(systemDomainContentCollectionId(entry.domainId))?.push(entry);
      globalContent.push(entry);
      if (candidates[0]) projection.get(candidates[0].collection.id)?.push(entry);
      continue;
    }
    if (entry.kind === 'phrase') {
      projection.get(systemPhraseCollectionId(entry.domainId))?.push(entry);
      globalPhrases.push(entry);
      if (candidates[0]) projection.get(candidates[0].collection.id)?.push(entry);
      continue;
    }
    projection.get(systemDomainWordsCollectionId(entry.domainId))?.push(entry);
    globalWords.push(entry);
    if (candidates[0]) projection.get(candidates[0].collection.id)?.push(entry);
  }
  const globalSorter = (a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en')
    || (domainOrder.get(a.domainId) ?? Number.MAX_SAFE_INTEGER) - (domainOrder.get(b.domainId) ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id);
  projection.set(SYSTEM_GLOBAL_WORDS_ID, globalWords.sort(globalSorter));
  projection.set(SYSTEM_GLOBAL_PHRASES_ID, globalPhrases.sort(globalSorter));
  projection.set(SYSTEM_GLOBAL_CONTENT_ID, globalContent.sort(globalSorter));
  for (const [collectionId, list] of projection.entries()) {
    if ([SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collectionId)) continue;
    list.sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en') || a.id.localeCompare(b.id));
  }
  return projection;
}

export function uniqueProjectionCount(entries) {
  return new Set(array(entries).map((entry) => `${entry.kind}\u0000${entry.normalizedText}`)).size;
}

export function relationEdgeSuppressed(left, right, { domainById = new Map(), lowLevelLexemes = new Set(), closeLowLevelRelations = true } = {}) {
  if (!left || !right) return true;
  if (domainById.get(left.domainId)?.relationExcluded || domainById.get(right.domainId)?.relationExcluded) return true;
  if (!closeLowLevelRelations) return false;
  return (left.kind === 'word' && lowLevelLexemes.has(left.normalizedText))
    || (right.kind === 'word' && lowLevelLexemes.has(right.normalizedText));
}

export function relatedEntries(backup, entryId) {
  const entries = array(backup?.entries);
  const entryById = new Map(entries.map((item) => [item.id, item]));
  const entriesByText = new Map();
  for (const item of entries) {
    const list = entriesByText.get(item.normalizedText) || [];
    list.push(item);
    entriesByText.set(item.normalizedText, list);
  }
  const adjacency = new Map(entries.map((item) => [item.id, new Set()]));
  for (const component of array(backup?.relationComponents)) {
    const source = entryById.get(component.sourceEntryId);
    if (!source) continue;
    for (const target of entriesByText.get(component.normalizedText) || []) {
      if (target.id === source.id) continue;
      adjacency.get(source.id)?.add(target.id);
      adjacency.get(target.id)?.add(source.id);
    }
  }
  return [...(adjacency.get(entryId) || [])].map((id) => entryById.get(id)).filter(Boolean)
    .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en') || a.id.localeCompare(b.id));
}

export function relatedPhrases(backup, entryId) {
  return relatedEntries(backup, entryId).filter((entry) => entry.kind === 'phrase');
}

export function phraseComponents(backup, phraseId) {
  const entry = array(backup?.entries).find((item) => item.id === phraseId);
  if (!entry || !['phrase', 'content'].includes(entry.kind)) return [];
  return array(backup?.relationComponents).filter((item) => item.sourceEntryId === entry.id);
}

function isSubsequence(text, query) {
  let index = 0;
  for (const character of text) if (character === query[index]) index += 1;
  return index === query.length;
}

function boundedLevenshtein(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let minimum = current[0];
    for (let column = 1; column <= right.length; column += 1) {
      const value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      current.push(value);
      minimum = Math.min(minimum, value);
    }
    if (minimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

export function searchBackup(backup, query, { domainId = null, limit = 100 } = {}) {
  const qRaw = normalizeDisplayText(query);
  const qEn = normalizeEnglish(qRaw);
  const qHant = toTraditional(qRaw);
  if (!qRaw) return [];
  return array(backup?.entries)
    .filter((entry) => !domainId || entry.domainId === domainId)
    .map((entry) => {
      let score = 0;
      if (qEn && entry.normalizedText === qEn) score = 100;
      else if (qEn && entry.normalizedText.startsWith(qEn)) score = 90;
      else if (qEn && entry.normalizedText.includes(qEn)) score = 80;
      else if (entry.glossHant && qHant && entry.glossHant.includes(qHant)) score = 85;
      else if (qEn && qEn.length >= 2 && isSubsequence(entry.normalizedText, qEn)) score = 65 - Math.min(20, entry.normalizedText.length - qEn.length);
      else if (qEn && qEn.length >= 4) {
        const threshold = Math.max(1, Math.min(3, Math.floor(qEn.length * 0.24)));
        const distance = boundedLevenshtein(entry.normalizedText, qEn, threshold);
        if (distance <= threshold) score = 55 - distance * 5;
      }
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.normalizedText.localeCompare(b.entry.normalizedText, 'en'))
    .slice(0, limit)
    .map((item) => item.entry);
}
