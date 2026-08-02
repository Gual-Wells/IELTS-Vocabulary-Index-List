# Vocabulary Index 3.1.1 本地架构

## 模块

- `v3-model.js`：规范化、实体创建、投影、关系和校验；
- `v3-db.js`：IndexedDB、事务、历史、Seed 初始化和升级；
- `v3-store.js`：内存状态、索引、局部写入和跨标签页同步；
- `v3-ui.js`：首页、复合普通表、日期模式、关系和弹窗；
- `v3-exchange.js`：VIX 内容包生成、预检和应用；
- `v3-integrations.js`：牛津 URL、ChatGPT 快捷指令 URL 和条目上下文 JSON；
- `v3-data-worker.js`：大型 JSON 解析与差异预检；
- `v3-ai.js`：可选 Groq 核查。

## 持久化

Schema 4 的业务存储：

```text
Domains
Collections
Entries
Memberships
PhraseTokens
Pins
Annotations
StudyStamps
Settings
History
```

全局词汇总表、全局短语总表和独立域词汇总表不持久化。它们由 Entry 和 Membership 构造运行时投影。

## 普通表投影

普通表投影读取其全部 Membership，并按 Entry.kind 拆为词汇区和短语区。域短语总表仍由域内全部 phrase Entry 派生。

## 学习日期

StudyStamp 独立于 Entry 内容和 Membership。单条刷新只写一条状态记录，不重建 PhraseToken 或全库投影。日期模式在当前视图中按日期索引生成标题和日历。

## 关联目标

关系索引描述词汇与短语之间的语义连接；导航目标另行从普通 Membership 解析。任何总表都不会进入合法目标集合。

## 升级

数据库版本升级后先读取当前 v3 存储快照，再规范化到 Schema 4，最后幂等合并 Seed revision 3。该顺序防止既有 3.0.x 数据被 Seed 替换。

## 外部查询

外部查询只在一级表项按钮的同步点击处理函数中执行。牛津只接收英文纯文本；ChatGPT 接收 `vix-entry-context` v1。集成模块不写入 IndexedDB，也不修改 Store。
