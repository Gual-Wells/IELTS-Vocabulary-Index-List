# Vocabulary Index 3.5.1 测试报告（对齐重做版）

## 版本信息

- App version：3.5.1
- Backup schema：5
- IndexedDB DB version：4
- Seed revision：3
- Service Worker cache：`v3.5.1-ios-shell-20260803-3`

第一次 3.5.1 封包已撤回完整交付认定。本报告只对应当前对齐重做包。

## 自动测试

在工作副本中分别执行：

- `node tests/run-tests.mjs`：通过；
- `node tests/static-tests.mjs`：通过；
- `node tests/stress-tests.mjs`：通过（126 entries、156 memberships、45 study stamps）；
- `node tests/integration-tests.mjs`：通过（最大测试 URL 30,636 字符）；
- `node tests/performance-tests.mjs`：通过。

性能结果：

- 25 次搜索：25.8 ms；
- 词表导入预检：2,543.1 ms。

## 语法与格式

- JavaScript／ES Module 语法检查：通过；
- JSON 全量解析：通过；
- 4 个 CSS 文件使用 `tinycss2` 完整解析：通过。

## Chromium 组件布局契约

使用真实 Chromium 布局引擎和 320、375、390px 三种移动端宽度验证：

- App、Action、Search、Confirm 四类 Dialog 卡片均在至少 15px 安全边距内；
- 四类 Dialog 标题物理中心与视口中心误差小于 2.1px；
- 序号开启时繁体释义与英文左边缘误差小于 1.5px；
- 单行一级表项高度不超过 50px；
- 有释义／来源的双行一级表项高度不超过 64px；
- 独立域来源保持在一级表项右下边界内。

该契约使用组件夹具，不等同于完整 PWA 真机测试，但比纯字符串静态测试额外验证了 CSS 实际几何结果。

## 当前自动化覆盖

- 手动浏览锚点不再由普通滚动自动写入；
- 长按包含位移阈值和 Pointer 取消保护；
- 模式切换不读取目标模式锚点，并检测内容 Root 是否进入阅读区；
- 字母栏包含警戒区、方向、反向锁和程序滚动抑制；
- 来源与释义使用真实 `entry-meta-row`；
- 日期和操作区使用显式 Grid 列；
- Dialog 使用全视口 Shell 与统一三列标题；
- 日历包含年／月四个方向按钮。

## 仍需 iPhone 真机验证

- iOS Native Dialog 在 Visual Viewport、键盘和 Home Indicator 下的完整遮罩；
- 长按浏览锚点与 Safari 系统长按手势；
- 快速惯性滚动下字母栏警戒和反向滞回；
- 超长繁体释义、超长独立域名称及 Dynamic Type；
- 日历五按钮在目标机型上的实际视觉与触控；
- 主屏幕 PWA 的 Service Worker 从旧 3.5.1 Cache 升级到本重做包。
