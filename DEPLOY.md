# Vocabulary Index 3.3.0 iPhone PWA 部署与回滚

## 部署

1. 部署完整目录到 HTTPS 静态站点；
2. 确认 `manifest.webmanifest`、`sw.js`、`index.html`、CSS、模块和 Seed 均可访问；
3. iPhone Safari 打开站点；
4. 分享 → 添加到主屏幕；
5. 从主屏幕图标启动；
6. 设置中检查版本为 3.3.0；
7. 按 `tests/MANUAL_CHECKLIST.md` 验收状态栏、动态顶部、弹窗、键盘、一级表项、PIN、标注和外部查询；
8. 导出一次完整备份。

## 更新既有安装

- 等待更新提示并选择立即更新；
- 若仍显示旧外壳，完全关闭主屏幕应用后重开；
- 不要清除网站数据，IndexedDB 会原样保留。

## 缓存

```text
gual-vocabulary-index-v3.3.0-ios-shell-20260802-1
```

升级桥只清理旧 App Shell 缓存，不操作业务数据库。

## 回滚

可将静态文件回滚至 3.2.0。数据库版本相同，但回滚前仍应导出完整备份。
