# Vocabulary Index 3.0

一个面向 iPhone Safari / 主屏幕 PWA 的本地优先英语词汇索引。3.0 将旧版单一全局词库升级为“词域—词表—词项—来源关系—短语词元索引”模型。

## 3.0 核心能力

- **词域隔离**：同一英文词形可以分别存在于通用英语、计算机科学等不同词域。
- **域内唯一**：同一词域内只保存一个规范词项；多个普通词表通过 Membership 关联。
- **无重复来源文本**：Membership 不保存 `sourceText`，英文文本只存在于 Entry。
- **系统短语表**：每个词域自动拥有一个不可删除、不可重命名的短语总览。
- **双向短语索引**：普通词可查看相关短语，短语可跳转到已经收录的组成词。
- **可选繁体释义**：词域可独立启用；简体输入在本地转换为通用繁体。
- **本地优先**：业务数据存入 IndexedDB；Groq API Key 只存 localStorage。
- **可恢复**：完整 JSON、CSV/TXT/Markdown/JSON 词项导入、撤销与重做。
- **旧体验保留**：PIN 有序跳转、上次位置、三种序号模式和全局 AI 标注审阅。
- **动态 Groq 模型目录**：不对具体模型名称写硬编码兼容分支。
- **3.0 视觉、可靠交互**：保留米色纸张感、墨绿与 Georgia；单词域首页自动扁平化。
- **持续可达操作**：iPhone 固定底部工具栏，撤销/重做位于顶栏，PIN 独立 sticky 导航。
- **渐进披露**：词条关系与低频管理操作进入详情 Sheet，主列表不再被按钮矩阵占据。

## 开发与检查

```bash
npm test
npm run test:static
npm run test:stress
npm run test:all
```

静态类型检查：

```bash
npx tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable js/*.js
npx tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution Bundler --lib ES2022,WebWorker sw.js
```

## 部署前硬要求

1. 在当前 2.4.1 中导出完整 JSON。
2. 保留该文件，不要只依赖浏览器内数据。
3. 关闭同站点其他 Safari 标签页和主屏幕 PWA。
4. 严格镜像部署 3.0 文件。
5. 按 `tests/MANUAL_CHECKLIST.md` 完成 iPhone 真机验收。

详见 `UX_REDESIGN_3.0.0.md`、`MIGRATION_3.0.0.md`、`DATA_FORMATS.md`、`DEPLOY.md`。
