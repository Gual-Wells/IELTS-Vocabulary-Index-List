# Vocabulary Index 3.0.1 测试报告

测试日期：2026-08-01

## 自动测试

```text
run-tests: OK
static-tests: OK
stress-tests: OK (115 entries, 114 memberships)
TypeScript checkJs: 0 errors
```

## 关键契约

- 普通 Collection 投影全部为词汇；
- 短语 Collection 投影全部为短语；
- 完整 Seed：4,995 个词汇、10 个短语、6,407 条 Membership、20 条 PhraseToken；
- 关系子项按字典序；
- 行内 PIN；
- 无独立详情弹窗；
- UI 源码不包含“词项”“词表来源”“相关短语”“组成词”等说明标签；
- 每词表位置读取时验证当前 Collection 可见性；
- 搜索存在全部 / 词域 / 词表三级范围；
- 管理使用拖动排序；
- App Dialog 存在父层快照与恢复；
- 搜索使用背景锁定、`visualViewport` 与 `preventScroll`；
- 升级引导只清理旧应用壳 Cache Storage，不触碰 IndexedDB；
- Service Worker 使用 3.0.1 独立缓存；活动 Worker 以缓存中的同代 App Shell 响应导航，避免新 HTML 与旧 JS 混装；安装阶段不强制刷新。

## 压力测试

固定随机种子执行 600 步新增、复用、短语、来源增删、删除和 PIN 操作，每步校验域内唯一、关系完整性和投影类型隔离。

## 仍需真机确认

- iPhone Safari 与主屏幕 PWA 的实际字体渲染；
- 虚拟键盘出现和关闭时的像素级稳定性；
- 拖动排序触控手感；
- 外部牛津词典往返；
- 真实 Groq 请求、限流和断网；
- PWA 更新提示和离线冷启动。
