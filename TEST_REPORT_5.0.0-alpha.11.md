# 5.0.0-alpha.11 测试报告

自动验证范围：

- Mirror Context/Result v4：策略哈希、三类同权、证据结构、slot 到本地 Entry ID 映射。
- 完整 Seed Context：23,917 项可在 Bridge 限额内分片保存并重组。
- Bridge 1.1.0：鉴权、不可变运行、v4 结果、确认、历史列表和结果恢复。
- 独立低级组件词库：来源版本、审核日期、范围、数量和“不抑制短语/用法”不变量。
- VIX Function：JSON 以 UTF-8 字节提交，文件以 UTF-8 读取。
- 静态、运行时、行为、集成、Provider、性能、布局与冷启动回归。

真机验收重点：iOS PWA 的嵌套弹窗覆盖、Mirror 四级复选、材料库切换、中文候选导入和 Service Worker 更新。
