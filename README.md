# Vocabulary Index 2.0

一个无需构建、可直接部署到 GitHub Pages 的本地优先英语词汇索引工具。

主要使用场景：在 iPhone Safari 添加到主屏幕，点按词汇即复制到剪贴板，再由快捷指令打开牛津英汉辞书进行查询。应用自身只维护 **词汇/短语和词性**，不保存释义、熟练度或复习数据。

## 核心规则

- 数据主存储为 IndexedDB，设计上限为 50,000 个全局唯一词条。
- 词表顺序同时是重复词归属优先级。默认顺序：A1 → A2 → B1 → B2 → C1 → AWL → AVL。
- 同一规范化词汇全局只显示一次；不同来源词表的词性自动合并。
- 内部保留来源词表关系。替换、删除或调整较早词表时，词条可自动回落到下一个来源词表。
- A–Z/# 只由词汇首字符自动派生，不再作为真实存储层。
- 点击词汇只执行复制；学习与释义查询由外部辞书完成。

## 功能

- iPhone 与桌面响应式双布局。
- 英语词汇本地模糊搜索；全局结果显示所属词表。
- 中文查询通过 Groq 生成英语候选，再与本地词表匹配。
- AI 新增候选，只包含英语词汇和词性。
- AI 核查仅检查拼写与词性；只生成可取消的持久标注，不自动修改数据。
- JSON、Markdown、CSV、TXT 导入。
- “合并到当前词表”和“替换当前词表”两种导入事务。
- 完整 JSON 备份恢复、Markdown/CSV 导出。
- 持久化撤销/重做，最多 100 个事务并设 30 MB 历史容量上限。
- 多书签固定与前后跳转。
- 记录上次浏览词条。
- 完整 PWA，可添加到主屏幕并离线查看、编辑。

## 本地运行

浏览器 ES Modules、IndexedDB 和 Service Worker 需要通过 HTTP(S) 访问，不能直接双击 `index.html`。

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/`。

## 测试

无需安装依赖：

```bash
npm test
```

## 文件结构

```text
index.html
manifest.webmanifest
sw.js
assets/icons/
css/
js/
data/seed.json
data/source/
tests/
```

部署步骤见 [DEPLOY.md](DEPLOY.md)。数据规则见 [DATA_FORMATS.md](DATA_FORMATS.md)。
