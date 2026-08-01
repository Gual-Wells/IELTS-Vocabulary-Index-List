# Vocabulary Index 3.0 部署

## 推荐：分支 RC 验收

1. 将 3.0 完整源码提交到独立 `release/v3.0.0-rc2` 分支。
2. 不立即覆盖 `main`。
3. 使用临时 Pages/本地 HTTPS 环境验证。
4. 完成 iPhone 清单后再合并。

## 正式镜像替换

GitHub 网页“Upload files”不会删除旧文件，不适合本次主版本升级。合并时应确保：

- 本交付 ZIP 是完整源码树，应整体部署，不与旧分支逐文件合并；
- 新 `index.html`、`sw.js`、`manifest.webmanifest`、`css/v3.css`、`js/v3-*.js` 全部同时部署；
- 旧 `js/*.js` 与旧拆分 CSS 从交付树删除；
- `data/seed.json`、`data/source/` 和图标保持原文件；
- Pages 来源继续为仓库根目录。

## iPhone 更新缓存

1. 完全关闭该站点 Safari 标签页和主屏幕应用。
2. Safari 打开正式地址，等待数秒后刷新。
3. 设置页确认版本为 `Vocabulary Index 3.0.0`。
4. 再从主屏幕启动。
5. 本版 Service Worker 使用 `gual-vocabulary-index-v3.0.0-rc2` 缓存；若主屏幕仍是旧程序，可删除主屏幕图标后重新添加；**不要删除网站数据**。

## 最低部署验收

- 单词域首页直接显示 7 个普通词表和“短语”入口；
- 旧 5,005 个词项仍存在；
- 旧词性不在主行显示，但完整 JSON 中以 `sourceLabel` 保留；
- 系统短语表可打开，初始短语词元索引为 20 条；
- Safari 与主屏幕 PWA 显示同一版本；
- 离线冷启动可读取本地数据；
- 导出一份 3.0 完整 JSON 并验证恢复预览。
