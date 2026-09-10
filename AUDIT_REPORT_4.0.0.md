# Vocabulary Index 4.0.0 交联审计报告

## 审计结论

源码模型与 UI 已按统一 4.0.0 语义重构；未发现必须回退到 3.5.2 模型的结构性冲突。最关键的历史不对称——word→phrase 与 phrase→word 两套关系条件——已由通用 RelationComponent + 全局双向解析替代。phrase 多 Membership 的可见特殊化也已取消。

## 关键不变量审计

- system totals 仅投影；写入操作只接受 normal Collection。
- cross-domain same-text 保持具体 Entry 独立。
- word/phrase/content 均以最高优先普通 Collection 作为可见 owner。
- relation Raw Graph 双向完整；低级词/Domain 开关仅逻辑删除。
- search fuzzy 与 relation exact 使用不同结果链。
- 一个具体 Entry 只产生一个 canonical navigation destination。
- fresh navigation 与 recursive return 不互相复用状态。
- old VIX/Full Backup 直接拒绝，不做静默迁移。

## UI 审计

- dialog root 不再继承全屏 visual-height；CSS 显式 `height:auto/min-height:0` 防旧 search-dialog 规则回流。
- sticky/top probe 共用真实 DOM geometry。
- normal application text 默认不可选择；Toast/Error 不接受 pointer/selection。
- longpress grace 不使用透明 overlay，也不在 pointerup 后继续 capture。
- Home Indicator 独立白带未恢复。

## 数据审计边界

当前 Seed4 6176 Entry 全部通过 Schema/引用/关系组件校验；1240 个 RelationComponent 解析为 1593 条无向 Raw Relation 边（3186 定向邻接），对称性审计非对称边为 0。NAWL/CET/TEM/COCA 的旧候选数据存在明确质量缺陷或当前工作包不可直接物化，因此没有为了“列表齐全”制造不可信 Seed。通用英语 5,005 Entry 当前也没有清洁可物化的中文释义源，故 `glossHant/glossSource` 保持空值；计算机术语 1,121/1,121 保持繁体释义覆盖。

## 外部环境边界

Collins endpoint/REST 结构已按官方 REST API 形态实现；真实用户 Key、iOS standalone CORS 与外部 App 返回仍必须真机验证。当前容器无法用 Chromium 访问本地 HTTP，故不把静态/layout PASS 描述为真实 iPhone 验收。
