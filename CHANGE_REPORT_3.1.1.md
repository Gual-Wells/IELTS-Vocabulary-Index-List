# Vocabulary Index 3.1.1 变更报告

## 版本性质

3.1.1 是 3.1.0 的一级表项外部查询集成版本。数据库 Schema、Seed revision、词汇内容和 Membership 均不变。

## 新增功能

1. 一级词汇与短语表项新增牛津英汉辞书控件；
2. 牛津控件仅发送英文纯文本，直接调用已确认的 URL Scheme；
3. 一级表项新增 ChatGPT 控件；
4. ChatGPT 控件生成 `vix-entry-context` v1 紧凑 JSON；
5. 通过 `shortcuts://run-shortcut` 调用准确名称为 `AI查询` 的快捷指令；
6. 全局聚合项导出全部独立域实例；
7. 当前 Entry 的直接关系只展开一层，避免递归导出数据库；
8. Service Worker 预缓存新增集成模块。

## 明确不变

- Schema 4；
- IndexedDB 版本 4；
- Seed revision 3；
- 学习日期、双模式、普通表复合结构和关联跳转规则；
- 前端规范审计提出的视觉与无障碍重构仍留待下一版本。

## 隐私边界

只有用户点击外部查询控件时才会离开本地应用。牛津只接收英文纯文本；ChatGPT 接收当前条目上下文，不接收 Groq API Key、整库内容、无关设置或撤销历史。
