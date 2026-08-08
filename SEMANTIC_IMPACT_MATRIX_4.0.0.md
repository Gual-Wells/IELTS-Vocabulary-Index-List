# Vocabulary Index 4.0.0 全相联语义影响矩阵

| 变化 | Identity/Data | Projection/Search | Relation | Navigation/State | Import/Seed | UI/PWA | Test gate |
|---|---|---|---|---|---|---|---|
| Domain contentMode | Domain 新不可变字段 | 决定总表/页面能力 | content 参加 Raw Graph | nonStructured 禁用 word/phrase 切换 | VIX v2/Seed4 | 首页新增非结构入口 | structured/nonStructured 约束 |
| content Entry | kind/contentType/POS | 全局/域/Collection content 投影；可 fuzzy 搜索 | 精确 component 双向关联 | PIN/日期/标注/查询与 word 同级 | Schema6/VIX2 | 复用 Entry row | content 全链测试 |
| phrase/content 优先级占有 | Membership 不删 | 普通表只显示最高优先 owner；Collection scope 搜可见投影 | canonical target 唯一 | 关系菜单不因多 Membership 重复 | Seed/import 重算 projection | 计数随 owner 改变 | 多 Membership 回落 |
| Raw/Effective Relation Graph | 原始边持久逻辑完整 | 搜索不受影响 | Domain/低级词仅过滤 Effective | 四态随过滤动态变化 | rebuild 只用于 Seed/修复 | 图标/菜单动态变化 | 全边对称、过滤可逆 |
| 四态导航 | 不改 Entry | 不改搜索 | 使用全部有效 canonical targets | 当前域唯一/域外唯一/非结构唯一/多目标 | 无 | 新非结构图标 | 0/1/N 组合 |
| Fresh vs Back | 不改数据 | 不改投影 | 不改关系 | fresh=alphabet/top/collapsed/word-first；Back=完整恢复 | 无 | 进入体验稳定 | History 场景 |
| Unified Search Scope | 不改身份 | Scope ID 唯一语义；Collection 搜完整可见内容 | 与 relation 解耦 | 搜索跳转仍是显式目标 | 无 | Scope select | 每 scope 契约 |
| Provider session | 不写 Seed | 无 | AI context 只读 Effective Relations | close/abort 防迟到 UI | API Key 非 Seed | Collins/Groq 临时卡 | abort/stale |
| ChatGPT context v2 | 不发送个人状态 | 无 | 最多有限 direct relations | Shortcut 外跳不改状态 | VIX 无关 | URL 显著缩短 | 长度上限/反解 |
| Dialog 重构 | 无 | 无 | 无 | scroll lock/focus 生命周期 | 无 | 去全屏 shell/抖动/白块 | 402×874 + 真机 |
| Global nonselect | 无 | 无 | 无 | longpress 事件所有权更干净 | 无 | 编辑白名单 | selection/callout 真机 |
| Seed generation break | 旧内容全部替换 | 全投影重建 | 全关系重建 | 内容绑定状态清空 | Schema6/Seed4 only | 启动阻断确认 | 事务/回滚备份 |
| V icon | 无 | 无 | 无 | 无 | cache revision | PWA identity | manifest/SW/icon |

## 联动原则

任何后续需求修改至少复核：Domain、Collection、Entry、Membership、Projection、Search、Relation、Query、Personal State、Navigation/History、Import/Export、Seed/Migration、UI/PWA、Tests。实现细节（固定尺寸、事件类型、RAF、具体 selector）不能自动升级为 Product Invariant。
