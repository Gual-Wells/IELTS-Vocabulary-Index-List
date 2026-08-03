# Vocabulary Index 3.5.1 iPhone PWA 部署与回滚

## 部署

1. 部署完整目录到 HTTPS 静态站点；
2. 确认 `manifest.webmanifest`、`sw.js`、`index.html`、四层 CSS、全部 ES Modules 和 Seed 均可访问；
3. iPhone Safari 打开站点；
4. 分享 → 添加到主屏幕；
5. 从主屏幕图标启动；
6. 设置中确认版本为 3.5.1；
7. 按 `tests/MANUAL_CHECKLIST.md` 验收字母标题／导航、弹窗、模式切换、浏览锚点、日历和一级表项；
8. 导出一次 Schema 5 完整备份。

## 更新既有安装

- 当前正式包直接兼容 3.5.0 数据库；
- 等待应用内更新提示并选择立即更新；
- 若仍显示旧外壳，完全关闭主屏幕应用后重开；
- 不要清除网站数据；IndexedDB version 仍为 4，Backup Schema 仍为 5；
- 两份旧 3.5.1 包已废弃。发现字母标题／导航无法点击时，应确认静态站点已完整替换为当前包，而不是继续局部覆盖旧文件。

## 缓存

```text
gual-vocabulary-index-v3.5.1-clean-rebuild-20260803-1
```

升级桥只清理旧 App Shell 缓存，不清理 IndexedDB 业务数据。

## 回滚

3.5.1 未修改数据结构，可回滚到可信的 3.5.0 完整包。回滚前仍应导出 Schema 5 完整备份。

不得回滚到两份已撤回的 3.5.1 错版。若必须回到 3.3.1 或更早版本，需要使用对应旧版可识别的备份；不得把 Schema 5 文件直接交给只认识 Schema 4 的版本。
