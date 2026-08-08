# Vocabulary Index 4.0.0 数据报告

生成依据：`data/seed.json` 与 `data/seed-report.json`。

## 当前 Seed 统计

| 指标 | 数值 |
|---|---:|
| Domain | 3 |
| Collection | 17 |
| Entry | 6,176 |
| Word | 5,539 |
| Phrase | 587 |
| Content | 50 |
| Membership | 7,574 |
| RelationComponent | 1,240 |

全局词汇渲染 5,539 行、规范文本 5,322 组；跨域同形仍保留具体 Entry 行。全局短语 587；全局非结构内容 50。

## Domain

### 通用英语 / structured

内置可验证基线：A1、A2、B1、B2、C1、AWL，共 5,005 Entry。优先级占有后可见普通表总量与 `data/seed-report.json` 一致。当前工作包没有可直接用于正式重建的清洁通用英语中文释义源，因此这 5,005 Entry 的 `glossHant/glossSource` 仍为空；本版不使用历史候选包中的低质量自动释义冒充正式内容。

### 计算机术语 / structured

1,121 Entry：544 word、577 phrase；繁体释义覆盖 1,121/1,121。四个可见普通表继续为计算机基础与系统、软件开发与数据、网络云与安全、人工智能。

### 通用英语搭配 / nonStructured

50 个 content starter：句型 12、语法框架 12、模板表达 12、语篇标记 14。它们参加同一 Entry 状态与精确关系体系，但浏览 UI 不分 word/phrase 页面。

## 关系数据

RelationComponent 由 phrase/content 内与现有 Entry 完全相同的连续规范文本 span 构建。当前 1240 个组件解析出 1593 条无向 Raw Relation 边（3186 定向邻接），对称性检查为 0 条非对称边。Raw Graph 在所有参与 Domain 间全局解析并双向维护；`relationExcluded` 与“关闭低级词汇关联”不会改写组件或原始边。

## 低级词汇关联过滤

`data/relation-low-level-lexemes.json` 是独立可审计数据资产，当前主要覆盖低信息冠词、代词、限定词、基础介词、助动词、连词、数词等。设置默认开启，只影响关系投影和关系上下文，不影响搜索/Seed/Membership/PIN/日期/标注。

## 数据范围 backlog

需求讨论中确认的 NAWL、CET-4、CET-6、TEM-4、TEM-8、COCA Top 10000 仍属于后续数据构建池。当前交接包没有这些清洁原始源文件；早期候选包中 CET 使用 ECDICT 标签、TEM 为人工覆盖表、COCA 为 ECDICT 频率衍生，已被历史复核判定不足以直接冒充最终权威表。因此 4.0.0 没有制造合成替代表。

本项目当前长期自用，公开再分发许可不是本轮构建阻塞门槛；但来源、获取时间、原文件/哈希和交叉验证仍应尽量保存，以保证未来可重建性。若未来将大型第三方 Seed 提交到公开仓库，应在公开分发前单独复核授权边界。
