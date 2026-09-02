# Vocabulary Index 4.7.3+D.3 · iPhone 17 主屏幕 PWA 人工验收清单

## D3 增量（真机验收仍待执行）

D3 固定 Collins 两本词典并删除账号目录请求，对齐官方认证 Header 与查询路径；本地测试不等同于以下 iPhone standalone 真实网络验收，详见 `PROVIDER_RUNTIME_D3.md`。

- [ ] 空词性/空释义不被当成必须补齐的错误；真实拼写错误仍能提示，结果不自动改词库。
- [ ] 设置页 Collins 仅显示 `Collins Cobuild Advanced American` 与 `Webster's New World College Dictionary`，没有自由 code 输入或“获取账号词典”。
- [ ] 打开、编辑 Key、保存或重开设置均不产生 Collins 目录请求；旧的非 Registry code 不被静默映射到第一本词典。
- [ ] 请求中把密钥从 A 改为 B 再改回 A，迟到响应或失败不覆盖新请求；关闭重开设置也不受旧请求影响。
- [ ] Collins 网络不可读提示不宣称密钥无效；验证页不能显示为词典结果。当前真实接入仍 BLOCKED，官方接入条件确认后须重新验收。
- [ ] iPhone 17 标准版的实际软键盘、安全区域、standalone、深浅主题、滚动和更新流程逐项复测。

## D1 Provider 补充项（以下真机项目尚未执行）

- [ ] 从 4.7.3 更新后，词库、PIN、学习日期、关系与旧 Provider 密钥不丢失。
- [ ] Groq 刷新后仅兼容且账号可用的模型可选；旧不兼容模型有提示；取消设置不保存草稿。
- [ ] 默认查词显示独立释义、发音/词性、例句、用法；核查显示结论/建议，不自动改词条或标注。
- [ ] 查询中取消、关闭、快速换用途，迟到结果不覆盖新查询；重新查询可恢复。
- [ ] Groq 真账号验证严格 Schema 与 JSON Object 两类模型；401、429、超时、截断/拒绝不显示假成功。
- [ ] Collins 老用户首次查询要求选择词典；设置和普通查词链均不请求远端词典目录。
- [ ] 依据官方账号说明确认 Collins 鉴权、CORS、词典授权与返回结构；未确认前不标记生产可用。
- [ ] Collins 每次查词仅一个 search/first 请求；404/401/403/429/5xx 不自动重试或换词典。
- [ ] Collins 多义项、例句、版权文字可读，长内容在弹窗内滚动；关闭后不留下结果 DOM 或持久化内容。
- [ ] iOS 键盘、动态视口、横竖屏及大字体下，设置/查询操作可达，输入不会异常缩放。
- [ ] 查询打开设置再返回，层级、关闭、滚动锁与焦点恢复符合原产品；Reduced Motion 不回归。
- [ ] 更新需用户确认，离线重开无混合版本；缓存桥接器不误删当前版本缓存。

## 原有 4.7.3 回归项

> 唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。详细P1 cases见`IPHONE_REDUCED_TESTS_4.7.3.md`。

- [ ] 页面显示4.7.3+D.3；Home Screen名称仍为`Vocabulary Index`。
- [ ] 新Collection Push与4.7.0一致；Back Pop保持4.7.1节奏。
- [ ] 手动Alphabet↔Date任意深位置直接得到TOP+collapsed，无整面flash/白帧/old-new overlap。
- [ ] Alphabet→Date calendar month为目标section最新有效月份。
- [ ] 手动Word↔Phrase直接得到TOP+collapsed；Date使用目标view自身calendar month；不闪灭。
- [ ] Same-Collection Search/Relation跨view第一次可见已落在目标Entry，之后无第二次滚动。
- [ ] 快速连续View/Mode切换10–20次不静默丢输入、不并发、不出现boot/Home重置。
- [ ] Home structured/non-structured原子切换，无grid 1→0→1 blink。
- [ ] Collection→Home不整App消失，只出现非常轻的Home稳定感。
- [ ] Relation连续开合20次：Entry主行文字/日期/按钮不闪；child slot与Chevron正常展开/收起。
- [ ] Relation开合不触发可感root viewport二次补偿。
- [ ] LetterRail无continuous locus；同一letter section内camera不持续抖动。
- [ ] 全局词汇总表A→Z逻辑正确；越往后不再明显单调恶化。
- [ ] Safari Inspector中远端chunk出现`data-parked=true`，live`.entry-row`不逼近全量。
- [ ] 返回A/B等parked旧区域可正常materialize且位置无明显漂移。
- [ ] expanded letter/relation语义不因DOM park被自动关闭。
- [ ] 普通Modal透明interaction backdrop、快速close无回归。
- [ ] Sticky Alphabet/Date collapse无闪、无累计漂移。
- [ ] 首装只`V→Home`一次；显式更新reload一次；kill→reopen Home。
