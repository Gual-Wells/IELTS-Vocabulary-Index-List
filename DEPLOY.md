# Vocabulary Index 3.4.0 iPhone PWA 部署与回滚

## 部署

1. 部署完整目录到 HTTPS 静态站点；
2. 确认 `manifest.webmanifest`、`sw.js`、`index.html`、三层 CSS、全部 ES Modules 和 Seed 均可访问；
3. iPhone Safari 打开站点；
4. 分享 → 添加到主屏幕；
5. 从主屏幕图标启动；
6. 设置中确认版本为 3.4.0；
7. 按 `tests/MANUAL_CHECKLIST.md` 验收系统总表、动态标题、跨域冲突行、三态关系跳转、弹窗、键盘和外部查询；
8. 导出一次 Schema 5 完整备份。

## 更新既有安装

- 等待应用内更新提示并选择立即更新；
- 若仍显示旧外壳，完全关闭主屏幕应用后重开；
- 不要清除网站数据；IndexedDB DB version 仍为 4，应用会在读取时把完整备份语义规范化为 Schema 5；
- 首次升级后建议立即导出一份新的 Schema 5 完整备份。

## 缓存

```text
gual-vocabulary-index-v3.4.0-ios-shell-20260802-2
```

升级桥只清理旧 App Shell 缓存，不清理 IndexedDB 业务数据。

## 回滚

不建议直接把已运行 3.4.0 的网站静态文件回滚到 3.3.1：

- 3.4.0 完整备份使用 Schema 5；
- 3.3.1 只认识 Schema 4；
- 3.4.0 中跨域学习日期已经拆成具体 Entry 状态。

需要回滚时，应先保留 3.4.0 完整备份，再使用升级前保存的 3.3.1 Schema 4 备份恢复到旧版本。不得把 Schema 5 文件直接交给 3.3.1。
