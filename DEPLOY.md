# GitHub Pages 部署说明 — 2.4.0

目标地址：

```text
https://gual-wells.github.io/IELTS-Vocabulary-Index-List/
```

## 使用清洁镜像替换

GitHub 网页端上传只会新增或覆盖同路径文件，不会删除新包中不存在的旧文件。建议使用 GitHub Desktop 或 Git 做完整镜像替换。

### GitHub Desktop

1. 先在现有网站导出一次完整 JSON。
2. 克隆 `IELTS-Vocabulary-Index-List`。
3. 打开本地仓库目录，删除旧网站文件和目录，但不要删除隐藏的 `.git`。
4. 解压 2.4.0 完整 ZIP。
5. 将 ZIP 根目录中的 `index.html`、`sw.js`、`js/`、`css/`、`data/`、`assets/` 等直接复制到仓库根目录。
6. 确认没有额外的 `Vocabulary-Index-.../` 外层目录。
7. 在 GitHub Desktop 中检查新增、修改和删除记录。
8. Commit，例如 `Replace site with 2.4.0 UI and AI workflow`，然后 Push。
9. Pages 发布源保持 `main / (root)`。

## 本地数据保留

部署静态程序文件不会主动清除现有 IndexedDB。正常升级会保留：

- 词表、词汇和来源；
- PIN 和 AI 标注；
- 撤销历史；
- Groq API Key 与当前模型。

第一次打开 2.4.0 后，模型目录只有此前当前选择或已缓存项目；在设置中手动点击一次“刷新模型列表”即可建立完整本地目录。不要清除 Safari 网站数据。

## 更新缓存

### Windows Chrome

1. 关闭该网站所有标签页。
2. 重新打开正式地址。
3. 按 `Ctrl + Shift + R`。
4. 设置页确认显示 `Vocabulary Index 2.4.0`。

### iPhone Safari / 主屏幕 PWA

1. 从多任务界面关闭主屏幕应用和该网站的 Safari 标签页。
2. 在 Safari 打开正式地址，等待数秒。
3. 刷新一次；版本仍旧时再刷新一次。
4. 设置页确认显示 `Vocabulary Index 2.4.0`。
5. 再从主屏幕启动。

若主屏幕仍使用旧程序缓存，可删除主屏幕入口后重新添加；不要在 Safari 设置中删除该站点的网站数据。

## 部署后最低验收

1. 首页在 iPhone 为紧凑词表卡片布局，桌面端为自适应栅格，没有大块维护面板抢占首屏。
2. 首页显示 7 个词表和 5,005 个全局唯一词汇。
3. 普通进入 A1、A2、B1、B2、C1、AWL 时所有字母均收起。
4. 搜索、PIN、上次位置和 AI 标注审阅能打开目标字母并定位词条。
5. 设置页刷新模型后，关闭并重新打开设置，完整模型目录仍存在。
6. AI 核查显示批次和进度；暂停、继续、取消均有效。
7. 核查产生标注后，可从首页或词表页逐条上一条/下一条审阅。
8. 导出完整 JSON，并确认文件可进入恢复预览。
9. 设置页版本为 2.4.0。
