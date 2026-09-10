# Vocabulary Index 4.0.0 变更报告

4.0.0 是 3.5.2 之后的统一 major generation，不再单列 3.6.0。核心变化：Schema6/DB5/Seed4/VIX2；structured/nonStructured Domain；word/phrase/content 一等 Entry；word/phrase/content 统一优先级占有；全局精确双向关系与逻辑过滤；四态关系跳转；统一搜索范围；Oxford/Collins/Groq/ChatGPT 查询；以及 iOS dialog/sticky/longpress/PWA icon 收口。

### 运行时修复

- 去除全屏 dialog shell，遮罩/卡片/scroll-lock 解耦；卡片按任务面积居中，保留圆角，无首帧位置动画。
- sticky 使用真实顶部几何，去除逻辑固定 `+52px`。
- 58px bottom toolbar 仅为视觉规格，不再是其他几何算法的硬编码来源。
- 长按加入 520ms active + 350ms grace；普通 UI 全局不可选择，编辑控件白名单恢复。
- 来源副字 secondary Y 指标与繁体释义统一。
- PWA 图标由 Oxford 图改为 Vocabulary Index `V`。

### 数据/导航

- phrase 修复历史遗漏，和 word/content 一样执行优先级占有。
- nonStructured `通用英语搭配` 进入全局内容投影和完整关系网络。
- 首页全局区默认结构化双表，临时切换非结构总表；fresh 进入固定 alphabet/word-first。
- 旧同域优先关系导航废止，多目标展示完整有效目标集合。

### 查询

- Collins API/网站降级与 Groq 临时核查卡；前台 Provider session 可 abort/stale-reject。
- ChatGPT context v2 最大关系数受限，集成测试最大 URL 由旧约 30k 降到约 8k 级。

### 有意不包含

- 学习计划/任务/Dashboard。
- 测试自动机更新。
- 未取得清洁本地源的 NAWL/CET/TEM/COCA 伪造 Seed。
