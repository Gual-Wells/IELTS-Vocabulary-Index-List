export const SCHEMA_VERSION = 3;
export const DEFAULT_DOMAIN_ID = 'domain_general_english';
export const DEFAULT_DOMAIN_NAME = '通用英语';
export const SYSTEM_PHRASE_SUFFIX = '__phrases';
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

export function createDomain({ id = null, name, order = 0, glossEnabled = false, timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
  const cleanName = normalizeDisplayText(name);
  if (!cleanName) throw new Error('词域名称不能为空');
  if (cleanName.length > MAX_DOMAIN_NAME) throw new Error(`词域名称不能超过 ${MAX_DOMAIN_NAME} 个字符`);
  return {
    id: id || safeId('domain', cleanName),
    name: cleanName,
    order: Number.isFinite(order) ? order : 0,
    glossEnabled: Boolean(glossEnabled),
    createdAt: String(createdAt || timestamp),
    updatedAt: String(updatedAt || createdAt || timestamp),
  };
}

export function createCollection({ id = null, domainId, name, label = '', type = 'normal', order = 0, timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
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
    createdAt: String(createdAt || timestamp),
    updatedAt: String(updatedAt || createdAt || timestamp),
  };
}

export function createEntry({ id = null, domainId, text, glossHant = '', glossSource = '', timestamp = nowIso(), createdAt = timestamp, updatedAt = timestamp }) {
  const cleanText = normalizeDisplayText(text);
  const normalizedText = normalizeEnglish(cleanText);
  if (!domainId) throw new Error('内容缺少词域');
  if (!normalizedText) throw new Error('内容不能为空');
  if (cleanText.length > MAX_ENTRY_TEXT) throw new Error(`内容不能超过 ${MAX_ENTRY_TEXT} 个字符`);
  const normalizedGloss = normalizeGlossHant(glossHant);
  return {
    id: id || safeId('entry', `${domainId}:${normalizedText}`),
    domainId,
    kind: isPhraseText(cleanText) ? 'phrase' : 'word',
    text: cleanText,
    normalizedText,
    glossHant: normalizedGloss,
    glossSource: normalizedGloss ? normalizeDisplayText(glossSource || 'manual') : '',
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

export function buildPhraseTokens(entry) {
  if (!entry || entry.kind !== 'phrase') return [];
  return tokenizeEnglish(entry.text).map((token, tokenIndex) => ({
    id: `${entry.id}:${tokenIndex}`,
    phraseId: entry.id,
    domainId: entry.domainId,
    token,
    normalizedToken: normalizeEnglish(token),
    tokenIndex,
  }));
}

// Phrase-first replacements handle common lexical ambiguities before character mapping.
const S2T_PHRASES = new Map([
  ['线程', '線程'], ['线程池', '線程池'], ['开发', '開發'], ['后台', '後台'],
  ['数据库', '數據庫'], ['软件', '軟件'], ['硬件', '硬件'], ['网络', '網絡'],
  ['计算机', '計算機'], ['信息', '信息'], ['用户', '用戶'], ['服务器', '服務器'],
  ['应用程序', '應用程序'], ['操作系统', '操作系統'], ['人工智能', '人工智能'],
]);

const S2T_PAIRS = `万萬与與专业專業丛叢东東丝絲丢丟两兩严嚴丧喪个個丰豐临臨为為丽麗举舉么麼义義乌烏乐樂乔喬习習乡鄉书書买買乱亂争爭于於亏虧云雲亚亞产產亩畝亲親亿億仅僅从從仑侖仓倉仪儀们們价價众眾优優会會伞傘伟偉传傳伤傷伦倫伪偽体體余餘佣傭侠俠侣侶侥僥侦偵侧側侨僑侩儈俭儉债債倾傾偿償储儲儿兒兑兌党黨兰蘭关關兴興养養兽獸内內冈岡册冊写寫军軍农農冲沖决決况況冻凍净淨凉涼减減凑湊凤鳳凭憑凯凱击擊凿鑿刍芻划劃刘劉则則刚剛创創删刪别別刮颳制製刹剎剂劑剐剮剑劍剧劇劝勸办辦务務动動励勵劲勁劳勞势勢勋勳匀勻区區医醫华華协協单單卖賣卢盧卫衛却卻厅廳历歷厉厲压壓厌厭厕廁厦廈厨廚县縣参參双雙发發变變叙敘叶葉号號叹嘆吓嚇吕呂吗嗎吨噸听聽启啟吴吳呐吶呕嘔员員呛嗆呜嗚咏詠咙嚨咸鹹响響哑啞哗嘩哟喲唤喚啧嘖喷噴喽嘍嘘噓团團园園围圍国國图圖圆圓圣聖场場坏壞块塊坚堅坛壇坝壩坞塢坟墳坠墜垄壟垒壘垦墾垫墊埘塒埙塤堑塹墙牆壮壯声聲壳殼壶壺处處备備复復够夠头頭夹夾夺奪奋奮奖獎妇婦妈媽妆妝姗姍姜薑娄婁娱娛婴嬰孙孫学學宁寧宝寶实實宠寵审審宪憲宫宮宽寬宾賓寝寢对對寻尋导導寿壽将將尔爾尘塵尝嘗尧堯尸屍尽盡层層屉屜属屬岁歲岂豈岗崗岛島岭嶺岳嶽峡峽峦巒币幣帅帥师師帐帳帘簾带帶帮幫帧幀并並广廣庄莊庆慶庐廬库庫应應庙廟庞龐废廢开開异異弃棄张張弥彌弯彎弹彈强強归歸当當录錄彻徹径徑忆憶忧憂怀懷态態总總恋戀恳懇恶惡恼惱悦悅悬懸惊驚惧懼惨慘惩懲惯慣愤憤愿願慑懾戏戲战戰户戶扑撲执執扩擴扫掃扬揚扰擾抚撫抛拋抢搶护護报報担擔拟擬拥擁拦攔拨撥择擇挂掛挚摯挛攣挞撻挟挾挥揮损損换換捣搗据據掳擄掷擲掺摻揽攬搀攙携攜摄攝摆擺摇搖摊攤撑撐撵攆撷擷撸擼敌敵数數斋齋斗鬥斩斬断斷无無旧舊时時旷曠显顯晋晉晒曬晓曉暂暫术術朴樸机機杀殺杂雜权權条條来來杨楊杰傑极極构構枣棗枪槍柜櫃标標栈棧栋棟栏欄树樹样樣桥橋桩樁梦夢检檢楼樓横橫橹櫓欢歡欧歐歼殲残殘殴毆毁毀毕畢毙斃气氣氢氫汇匯汉漢汤湯沟溝没沒沥瀝沦淪沧滄沪滬泞濘泪淚泽澤洁潔洼窪浅淺浆漿浇澆浊濁测測济濟浑渾浓濃涂塗涌湧涛濤涝澇涡渦涣渙涤滌润潤涩澀涨漲渐漸渔漁渗滲温溫湾灣湿濕溃潰滚滾满滿滤濾滥濫滨濱滩灘滞滯漤灠潜潛潇瀟灭滅灯燈灵靈灾災灿燦炉爐点點炼煉烁爍烂爛烛燭热熱爱愛爷爺牵牽犊犢状狀犹猶狈狽狱獄独獨狭狹猎獵猫貓献獻玛瑪环環现現玺璽珐琺琐瑣琼瓊电電画畫畅暢疗療疟瘧疮瘡疯瘋瘫癱皑皚皱皺盘盤卢盧监監盖蓋盗盜眦眥睁睜瞒瞞矫矯矿礦码碼砖磚砚硯砾礫础礎硕碩确確碍礙礼禮祷禱祸禍离離秃禿秆稈种種积積称稱秽穢稳穩穷窮窃竊窍竅窝窩窥窺窜竄竞競笋筍笔筆笺箋筑築筛篩筝箏筹籌签簽简簡箩籮篮籃类類粮糧紧緊纠糾红紅纤纖约約级級纪紀纫紉纬緯纯純纱紗纲綱纳納纵縱纷紛纸紙纹紋纺紡纽紐线線练練组組细細织織终終绍紹经經绑綁绒絨结結绕繞绘繪给給络絡绝絕绞絞统統绢絹绣繡继繼绩績绪緒续續绳繩维維绵綿绷繃绿綠缀綴缄緘缅緬缆纜缓緩编編缘緣缚縛缝縫缠纏缩縮缴繳网網罗羅罚罰职職联聯聪聰肃肅肠腸肤膚肾腎肿腫胀脹胆膽胜勝胶膠脉脈脏臟脑腦脚腳脱脫脸臉腻膩腾騰舆輿舰艦舱艙艺藝节節芜蕪苇葦苍蒼苏蘇范範茧繭荐薦荆荊荡蕩荣榮药藥莲蓮获獲莹瑩营營萧蕭蓝藍蔷薔蔼藹蕴蘊薮藪虚虛虫蟲虽雖蚀蝕蚁蟻蚂螞蛊蠱蛮蠻补補衬襯袜襪袭襲装裝裤褲见見观觀规規觅覓视視览覽觉覺触觸誉譽计計订訂认認讨討让讓训訓议議讯訊记記讲講讳諱讶訝许許论論讼訟设設访訪诀訣证證评評识識诈詐诉訴诊診词詞译譯试試诗詩诚誠话話诞誕询詢该該详詳语語误誤诱誘说說诵誦请請诸諸诺諾读讀课課谁誰调調谈談谊誼谋謀谎謊谐諧谓謂谣謠谦謙谨謹谱譜贝貝负負贡貢财財责責贤賢败敗账賬货貨质質贩販贪貪贫貧贬貶购購贯貫贮貯贴貼贵貴贷貸贸貿费費贺賀贼賊贾賈资資赋賦赌賭赏賞赔賠赖賴赚賺赛賽赞讚赠贈赢贏赵趙赶趕趋趨跃躍践踐踪蹤车車轨軌轩軒转轉轮輪软軟轰轟轴軸轻輕载載较較辅輔辆輛辈輩辉輝辐輻辑輯输輸辕轅辖轄辗輾辙轍辞辭边邊辽遼达達迁遷过過迈邁运運还還这這进進远遠违違连連迟遲迩邇适適选選递遞逻邏遗遺邮郵邻鄰郑鄭酝醞酱醬酿釀释釋里裏鉴鑒钉釘针針钓釣钝鈍钟鐘钢鋼钥鑰钦欽钧鈞钩鉤钱錢钳鉗钻鑽铁鐵铃鈴铅鉛铜銅铭銘银銀铸鑄铺鋪链鏈销銷锁鎖锅鍋锋鋒错錯锡錫锣鑼锦錦键鍵锻鍛镀鍍镇鎮镜鏡镶鑲长長门門闪閃闭閉问問闯闖闲閒间間闻聞阅閱阐闡队隊阳陽阴陰阵陣阶階际際陆陸陈陳险險随隨隐隱难難雏雛雾霧静靜顶頂项項顺順须須顾顧顿頓颁頒颂頌预預领領颇頗颈頸频頻题題颜顏额額风風飞飛饥飢饭飯饮飲饲飼饱飽饰飾饼餅馆館马馬驭馭驯馴驰馳驱驅驳駁驻駐骑騎骗騙骚騷验驗骤驟鱼魚鲁魯鲜鮮鸟鳥鸡雞鸣鳴鸭鴨鸿鴻鹅鵝鹏鵬麦麥黄黃黉黌齐齊齿齒龙龍龟龜`;
const S2T_CHARS = new Map();
for (let index = 0; index < S2T_PAIRS.length - 1; index += 2) {
  S2T_CHARS.set(S2T_PAIRS[index], S2T_PAIRS[index + 1]);
}

export function toTraditional(value) {
  let text = normalizeDisplayText(value);
  for (const [source, target] of [...S2T_PHRASES.entries()].sort((a, b) => b[0].length - a[0].length)) {
    text = text.split(source).join(target);
  }
  return [...text].map((character) => S2T_CHARS.get(character) ?? character).join('');
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
  if (Number(input?.schemaVersion) === SCHEMA_VERSION && Array.isArray(input?.domains)) {
    return canonicalizeBackup(input);
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
    name: '短语',
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
  const phraseTokens = entries.flatMap(buildPhraseTokens);
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
    appVersion: '3.0.1',
    exportedAt: timestamp,
    domains,
    collections,
    entries,
    memberships,
    phraseTokens,
    pins,
    annotations,
    settings: {
      numberMode: ['none', 'group', 'global'].includes(settingsInput.numberMode) ? settingsInput.numberMode : 'global',
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
  const rebuiltTokens = entries.flatMap(buildPhraseTokens);
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
  pins.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.contextCollectionId.localeCompare(b.contextCollectionId) || a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.entryId.localeCompare(b.entryId));
  annotations.sort((a, b) => a.domainId.localeCompare(b.domainId) || a.entryId.localeCompare(b.entryId));

  const settingsInput = object(input?.settings);
  const lastPositions = Object.fromEntries(Object.entries(object(settingsInput.lastPositions))
    .filter(([key, value]) => key.startsWith('lastPosition:') && typeof value === 'string'));
  const settings = {
    numberMode: ['none', 'group', 'global'].includes(settingsInput.numberMode) ? settingsInput.numberMode : 'global',
    lastPositions,
    migrationComplete: Boolean(settingsInput.migrationComplete),
    migrationSource: normalizeDisplayText(settingsInput.migrationSource || ''),
    migrationNoticePending: Boolean(settingsInput.migrationNoticePending),
  };
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: normalizeDisplayText(input?.appVersion || '3.0.1'),
    exportedAt: timestamp,
    domains,
    collections,
    entries,
    memberships,
    phraseTokens: rebuiltTokens,
    pins,
    annotations,
    settings,
  };
  validateBackup(backup);
  return backup;
}

export function validateBackup(backup) {
  if (Number(backup?.schemaVersion) !== SCHEMA_VERSION) throw new Error('备份 schemaVersion 必须为 3');
  const domains = array(backup.domains);
  const collections = array(backup.collections);
  const entries = array(backup.entries);
  const memberships = array(backup.memberships);
  const tokens = array(backup.phraseTokens);
  const pins = array(backup.pins);
  const annotations = array(backup.annotations);

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
  unique(tokens, (item) => item.id, '短语词元 ID 重复');
  unique(pins, (item) => item.entryId, '同一内容存在多个 PIN');
  unique(annotations, (item) => item.entryId, '同一内容存在多个 AI 标注');
  for (const item of [...domains, ...collections, ...entries, ...memberships, ...pins]) {
    if (!validId(item.id)) throw new Error('数据包含无效或危险 ID');
  }
  for (const token of tokens) if (!validTokenId(token.id)) throw new Error('短语词元 ID 无效');
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
    if (phraseCollections.length !== 1) throw new Error(`词域 ${domain.name} 必须恰有一个系统短语表`);
    if (phraseCollections[0].id !== systemPhraseCollectionId(domain.id)) throw new Error('系统短语表 ID 无效');
  }

  for (const collection of collections) {
    if (!domainIds.has(collection.domainId)) throw new Error('词表指向不存在词域');
  }

  for (const entry of entries) {
    if (!domainIds.has(entry.domainId)) throw new Error('内容指向不存在词域');
    if (entry.normalizedText !== normalizeEnglish(entry.text)) throw new Error('内容规范文本不一致');
    if (entry.kind !== (isPhraseText(entry.text) ? 'phrase' : 'word')) throw new Error('内容 kind 与文本不一致');
    if (entry.glossHant !== normalizeGlossHant(entry.glossHant)) throw new Error('释义不是规范繁体');
    if (entry.kind === 'word') {
      const hasNormalMembership = (membershipByEntry.get(entry.id) || [])
        .some((item) => collectionById.get(item.collectionId)?.type === 'normal');
      if (!hasNormalMembership) throw new Error(`普通词 ${entry.text} 没有普通词表来源`);
    }
  }

  const expectedTokens = entries.flatMap(buildPhraseTokens);
  if (JSON.stringify(tokens) !== JSON.stringify(expectedTokens)) throw new Error('短语词元索引与内容不一致');

  const visible = buildProjection(backup);
  for (const pin of pins) {
    const entry = entryById.get(pin.entryId);
    const collection = collectionById.get(pin.contextCollectionId);
    if (!entry || !collection || pin.domainId !== entry.domainId || collection.domainId !== entry.domainId) {
      throw new Error('PIN 关联无效');
    }
    if (!Number.isFinite(pin.order) || pin.order < 0) throw new Error('PIN 顺序无效');
    if (!(visible.get(pin.contextCollectionId) || []).some((item) => item.id === entry.id)) throw new Error('PIN 指向不可见内容');
  }
  for (const [key, entryId] of Object.entries(object(backup.settings?.lastPositions))) {
    const parts = key.split(':');
    const collectionId = parts.slice(2).join(':');
    if (!collectionById.has(collectionId) || !(visible.get(collectionId) || []).some((item) => item.id === entryId)) {
      throw new Error('上次位置指向不可见内容');
    }
  }
  for (const annotation of annotations) {
    const entry = entryById.get(annotation.entryId);
    if (!entry || annotation.domainId !== entry.domainId) throw new Error('AI 标注关联无效');
  }
  return true;
}

export function buildProjection(backup) {
  const collections = array(backup?.collections);
  const entries = array(backup?.entries);
  const memberships = array(backup?.memberships);
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const membershipsByEntry = new Map();
  memberships.forEach((membership) => {
    const list = membershipsByEntry.get(membership.entryId) || [];
    list.push(membership);
    membershipsByEntry.set(membership.entryId, list);
  });
  const projection = new Map(collections.map((item) => [item.id, []]));

  for (const entry of entries) {
    if (entry.kind === 'phrase') {
      const phraseCollectionId = systemPhraseCollectionId(entry.domainId);
      projection.get(phraseCollectionId)?.push(entry);
      continue;
    }
    const candidates = (membershipsByEntry.get(entry.id) || [])
      .map((membership) => collectionById.get(membership.collectionId))
      .filter((collection) => collection?.type === 'normal')
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    if (candidates[0]) projection.get(candidates[0].id)?.push(entry);
  }
  for (const [collectionId, list] of projection) {
    const collection = collectionById.get(collectionId);
    list.sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
    if (collection?.type === 'system-phrases') list.sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
  }
  return projection;
}

export function relatedPhrases(backup, entryId) {
  const entry = array(backup?.entries).find((item) => item.id === entryId);
  if (!entry || entry.kind !== 'word') return [];
  const phraseIds = new Set(array(backup?.phraseTokens)
    .filter((token) => token.domainId === entry.domainId && token.normalizedToken === entry.normalizedText)
    .map((token) => token.phraseId));
  return array(backup?.entries)
    .filter((item) => phraseIds.has(item.id))
    .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
}

export function phraseComponents(backup, phraseId) {
  const phrase = array(backup?.entries).find((item) => item.id === phraseId && item.kind === 'phrase');
  if (!phrase) return [];
  const entries = array(backup?.entries);
  return buildPhraseTokens(phrase).map((token) => ({
    ...token,
    entry: entries.find((item) => item.domainId === phrase.domainId && item.kind === 'word' && item.normalizedText === token.normalizedToken) || null,
  }));
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
