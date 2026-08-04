# Vocabulary Index 3.5.2 iPhone PWA 部署与回滚

## 部署

1. 将完整目录部署到 HTTPS 静态站点，不做零散文件覆盖；
2. 确认 `manifest.webmanifest`、`sw.js`、`index.html`、四层 CSS、全部 ES Modules、Seed 和图标均可访问；
3. 确认 `index.html` 加载 `css/v3.5.2.css`，不同时加载 `v3.5.1.css`；
4. iPhone Safari 打开站点，从主屏幕图标启动；
5. 设置中确认版本为 3.5.2；
6. 按 `tests/MANUAL_CHECKLIST.md` 验收一级表项、顶部／底部字母轨道边界、弹窗、普通切换、递归返回、浏览锚点、底栏和日期折叠；
7. 导出一次 Schema 5 完整备份。

## 更新既有安装

- 3.5.2 直接兼容可信 3.5.1 Clean Rebuild 数据库；
- 等待应用内更新提示并选择立即更新；
- 若仍显示旧外壳，完全关闭主屏幕应用后重开；
- 不要清除网站数据；IndexedDB version 仍为 4，Backup Schema 仍为 5；
- 两份旧 3.5.1 错版继续保持废弃，不能局部覆盖回本包。

## 缓存

```text
v3.5.2-runtime-stabilization-20260804-1
```

升级桥只清理旧 App Shell 缓存，不清理 IndexedDB 业务数据。

## 回滚

3.5.2 未修改数据结构，可回滚到唯一可信的 3.5.1 Clean Rebuild 完整包。回滚前仍应导出 Schema 5 完整备份。

不得回滚到两份已撤回的 3.5.1 错版。若必须回到 Schema 4 时代，只能使用相应旧版可识别的备份，不能把 Schema 5 文件直接交给旧版本。
