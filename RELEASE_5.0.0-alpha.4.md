# Vocabulary Index 5.0.0-alpha.4 发布说明

本版集中处理词库管理交互、首页信息密度与 Seed 同步问题，Cloudflare Worker 名和既有私域配置保持不变。

## 主要变化

- “管理词库”改为草稿排序：拖动仅改变当前弹窗，点击“保存”后一次性写入；“取消”或关闭弹窗不提交排序。
- 词表卡片不再显示来源副标与回车图标，词表页标题下方也不再重复来源说明。
- 设置页删除 Seed 数据来源入口，运行时静态资源不再发布来源说明文件，并精简 Provider 说明文字。
- Seed revision 7：计算机术语从 1,421 扩充至 1,583，通用英语搭配从 326 扩充至 595。
- 低级词汇关联清单改为由 Seed 的 A1/A2 词汇自动生成，共 2,303 项；以后重建 Seed 时同步刷新。

Worker 仍命名为 `vix-5-alpha2`，因此既有 Cloudflare Access、Durable Objects、环境变量和 `COLLINS_ACCESS_KEY` Secret 不需要重配。
