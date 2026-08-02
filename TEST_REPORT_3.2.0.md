# Vocabulary Index 3.2.0 测试报告

## 1. 自动化结果

```text
run-tests: OK
static-tests: OK
stress-tests: OK (126 entries, 156 memberships, 45 study stamps)
integration-tests: OK (largest tested URL 33,726 chars)
performance-tests: OK
TypeScript checkJs: 0 errors
JavaScript / MJS syntax: OK
HTML parse: OK
CSS parse: OK
JSON parse: OK
```

当前环境性能记录：

```text
25 次本地搜索：27.2 ms
普通表 VIX 预检：2,595.6 ms
```

该数字用于回归比较，不等同于真实 iPhone 主线程性能。

## 2. 3.2.0 专项断言

- HTML、模块、manifest 和 Seed 版本均为 3.2.0；
- Service Worker 与缓存升级桥使用同一缓存名；
- standalone PWA 检测和后台 viewport 恢复逻辑存在；
- 页面禁用电话号码自动识别；
- 一级表项存在 `.entry-info` 与 `.entry-actions`；
- 英文使用单行省略，不再任意断字；
- 系统卡片和系统列表存在侧向渐变；
- 触控尺寸变量为 44px；
- SVG 使用模板缓存；
- 长列表使用 42 行分块和 IntersectionObserver；
- 无 IntersectionObserver 时会完整物化；
- 关系仅在展开时进行完整解析；
- 滚动位置使用 `elementFromPoint` 并提供小范围回退；
- 各视图预建可见 Entry ID 集合；
- sticky 层没有 14／16／18px 背景模糊；
- `:focus-visible` 没有在触控环境被关闭。

## 3. 数据回归

3.2.0 与 3.1.1 的 Seed 比较：

- Domains 不变；
- Collections 不变；
- Entries 不变；
- Memberships 不变；
- PhraseTokens 不变；
- Pins、Annotations、StudyStamps 和 Settings 业务内容不变；
- 仅 `appVersion` 更新。

## 4. 仍需真机验收

容器无法自动控制 iPhone 主屏幕 PWA。必须在实际设备检查：

1. 两行表项是否在当前 iPhone 宽度完整容纳七个按钮；
2. 首页字号与系统侧光的实际观感；
3. 5,322 项日期模式滚动时是否出现空白或位置跳动；
4. 锁屏、切换 App 后返回是否触发异常宽度；
5. 输入框聚焦和关闭键盘后的 viewport；
6. Oxford 与 ChatGPT 外部跳转返回后状态；
7. VoiceOver／Switch Control 的焦点和按钮名称；
8. 高关联词 `data` 的 ChatGPT URL 是否被 iOS 截断。
