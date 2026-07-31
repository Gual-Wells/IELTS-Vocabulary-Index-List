# Vocabulary Index 2.2.1 Local Stable

无需构建、可直接部署到 GitHub Pages 的本地优先英语词汇索引工具。

主要使用方式：在 iPhone Safari 添加到主屏幕，点按词汇复制词形，再通过快捷指令打开牛津英汉辞书。本工具只维护词汇/固定短语和词性，不保存释义、例句或熟练度。

## 版本定位

2.2.1 Local Stable 已彻底撤销 GitHub 云备份、PAT、远端 revision、自动同步和云快照功能。真实数据只存在于当前浏览器的 IndexedDB 中，长期备份通过手动导出完整 JSON 完成。

首页提供：

- 导出完整 JSON；
- 恢复完整 JSON；
- 初始化为内置 seed；
- 撤销与重做。

从曾短暂部署的云备份版升级时，应用会自动清除遗留的 GitHub Token、仓库配置及 IndexedDB 云状态，不清除词库、PIN、AI 标注或 Groq Key。

## 核心规则

- IndexedDB 主存储，校验和导入上限为 50,000 个全局唯一词条。
- 默认优先级：A1 → A2 → B1 → B2 → C1 → AWL → AVL。
- 同一规范化词汇全局只显示一次，各来源词性自动合并。
- 内部保留来源关系；移除较早来源后自动回落到下一词表。
- A–Z/# 是派生视图，不是物理存储层。
- 普通进入词表时所有字母默认收起；搜索、PIN 或明确跳转才展开目标字母。
- 点击词汇只复制词形，不复制词性。

## 本地多实例保护

Safari 标签页与主屏幕 PWA 共享同一 IndexedDB。2.2.1 使用：

- 全局 `dataRevision`；
- IndexedDB 提交前快照校验；
- BroadcastChannel 通知；
- 回到前台时的轻量修订检查；
- 单页面 mutation 队列。

陈旧实例不能静默覆盖较新数据；写入会被安全取消并重新载入最新状态。仍不建议主动在两个实例中同时连续编辑。

## 运行和测试

必须通过 HTTP(S) 访问，不能直接双击 `index.html`：

```bash
python -m http.server 8000
```

自动化检查：

```bash
npm test
```

部署见 [DEPLOY.md](DEPLOY.md)，数据格式见 [DATA_FORMATS.md](DATA_FORMATS.md)，修复清单见 [BUG_FIX_REPORT_2.2.1.md](BUG_FIX_REPORT_2.2.1.md)。
