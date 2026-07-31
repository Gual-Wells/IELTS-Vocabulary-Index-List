# GitHub Pages 部署说明 — 2.2.1 Local Stable

目标地址：

```text
https://gual-wells.github.io/IELTS-Vocabulary-Index-List/
```

## 必须使用清洁镜像替换

GitHub 网页端“Upload files”只新增或覆盖同名路径，不会删除新包中不存在的旧文件。云备份版曾增加过额外模块和文档，因此本次应使用 GitHub Desktop 或 Git 命令执行严格镜像替换。

### GitHub Desktop

1. 克隆 `IELTS-Vocabulary-Index-List`。
2. 打开本地仓库目录。
3. 删除旧的网站文件和目录，但不要删除隐藏的 `.git`。
4. 解压完整 ZIP。
5. 将 ZIP 根目录中的 `index.html`、`sw.js`、`js/`、`css/`、`data/`、`assets/` 等直接复制到仓库根目录。
6. 确认没有多套一层 `Vocabulary-Index-.../` 文件夹。
7. 在 GitHub Desktop 中检查新增、修改和删除记录。
8. Commit，例如 `Replace site with 2.2.1 local stable`，然后 Push。
9. Pages 来源保持 `main / (root)`。

## 数据是否会被覆盖

部署程序文件不会清除现有 IndexedDB。正常升级会保留：

- 词表和词汇；
- 来源关系；
- PIN；
- AI 标注；
- 撤销历史；
- Groq Key。

应用只会自动删除已经废弃的 GitHub 云备份 Token、仓库配置和云状态。

不要清除 Safari 网站数据；该操作会删除 IndexedDB。

## 更新缓存

部署完成后：

### Windows Chrome

1. 关闭该网站全部标签页。
2. 重新打开目标地址。
3. 按 `Ctrl + Shift + R`。
4. 设置页应显示 `Vocabulary Index 2.2.1`。

### iPhone Safari / 主屏幕 PWA

1. 从多任务界面关闭主屏幕应用和该网站的 Safari 标签页。
2. 在 Safari 打开目标网址，等待 5–10 秒。
3. 刷新一次；版本仍旧时再刷新一次。
4. 设置页确认 `Vocabulary Index 2.2.1`。
5. 再从主屏幕启动。

Oxford 图标文件未更换，不需要重新制作图标。若主屏幕仍显示旧应用缓存，可删除主屏幕入口后重新添加；不要删除网站数据。

## 部署后最低验收

1. 首页显示 7 个词表、5,005 个全局唯一词汇。
2. 普通进入 A1、A2、B1、B2、C1、AWL 时所有字母均收起。
3. 手动展开 A、B，计数和内容稳定。
4. 搜索或 PIN 跳转只展开目标字母。
5. 点按词汇可以复制。
6. 导出完整 JSON，再用该文件执行恢复预览。
7. 设置页版本为 2.2.1。
