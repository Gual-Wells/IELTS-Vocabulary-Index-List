# Vocabulary Index 3.0.6 测试报告

测试日期：2026-08-01

## 自动验证

| 项目 | 结果 |
|---|---|
| 业务模型与导入测试 | `run-tests: OK` |
| 静态 UI / PWA / 数据交换契约 | `static-tests: OK` |
| 随机压力测试 | `stress-tests: OK (115 entries, 114 memberships)` |
| 搜索性能 | 25 次查询约 25–30 ms |
| 小型词表 VIX 预检 | Node 环境约 2.5–2.7 s |
| 完整计算机术语域 VIX 预检 | Node 环境约 3.0 s |
| JavaScript / MJS 语法 | 通过 |
| TypeScript `checkJs` | 0 错误 |
| HTML / CSS 解析 | 通过 |
| JSON 文件解析 | 12/12 通过 |
| VIX Schema 示例 | 6/6 通过 |

VIX 差异计算在 Web Worker 中运行。上述预检耗时是受管 Node 环境的完成时间，不代表 iPhone Safari 的绝对耗时；设计目标是避免阻塞主界面，而不是承诺瞬时完成大型全域预检。

## Seed 与投影

```text
Domains: 2
Collections: 14
Entries: 6,126
Words: 5,539
Phrases: 587
Memberships: 7,495
PhraseTokens: 1,312
```

全局去重投影：

```text
Words: 5,322
Phrases: 587
```

计算机术语：

| 列表 | 数量 |
|---|---:|
| 总词表 | 544 |
| 短语 | 577 |
| 计算机基础与系统 | 214 |
| 软件开发与数据 | 197 |
| 网络、云与安全 | 114 |
| 人工智能 | 19 |

544 个普通词全部拥有一个且仅一个用户可见主分类。四表数量之和为 544。隐藏来源 Collection 不进入用户投影。

## 数据交换测试

已覆盖：

- 全局、独立域、普通词表和短语表内容导出；
- 新建独立域；
- 独立域增量合并；
- 新建普通词表；
- 普通词表增量与替换；
- 短语表增量；
- 全局完整替换；
- 释义冲突的“保留当前 / 使用导入值”；
- 面板目标与文件声明目标不一致；
- 普通词表拒绝短语 Membership；
- 总表不作为直接写入目标；
- 全局替换不残留旧内容；
- 新词表目标可以由文件创建；
- 差异预览子层不会被父表单提交逻辑立即关闭；
- 六份 `data/examples/` 文件通过 JSON Schema 与实际预检。

## 升级与不可变数据

- `builtInSeedRevision` 为 2；
- 模拟 3.0.5 数据库升级后只补充四个分类词表和 544 条可见分类 Membership；
- 重复运行升级不会重复创建 Entry、Collection 或 Membership；
- 通用英语的 5,005 个 Entry、6,407 条 Membership 和 20 条 PhraseToken 与 3.0.5 基线语义一致；
- 七份通用英语源词表和三个 PWA 图标与 3.0.5 基线逐字节一致。

## 未自动替代的验收

受管环境未完成稳定的真实 iPhone Safari / 主屏幕 PWA 端到端视觉测试。以下项目仍以部署后的人工验收为准：

- 数据交换大 Sheet 的真实尺寸、键盘和返回栈；
- 大型 JSON 预检期间的 Safari 响应性；
- 自动下载恢复备份在 Safari 与主屏幕 PWA 中的行为；
- 首页全局层与两个独立词域容器的最终视觉密度；
- 3.0.5 线上数据库首次升级后的真机状态保留。

人工项目见 `tests/MANUAL_CHECKLIST.md`。
