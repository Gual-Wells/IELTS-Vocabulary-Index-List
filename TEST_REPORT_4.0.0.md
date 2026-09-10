# Vocabulary Index 4.0.0 测试报告

## 自动测试范围

`npm run test:all` 覆盖：

- Schema6 / DB5 / Seed4 / VIX2；
- structured/nonStructured 模型约束；
- word/phrase/content 统一优先级占有；
- 系统总表投影；
- exact symmetric relations + nonStructured relation；
- fuzzy search 与 relation 解耦；
- VIX v1/旧 Full Backup 拒绝；
- 4.0 Seed/示例 VIX 校验；
- runtime symbol / TypeScript checkJs；
- stress/transaction；
- compact ChatGPT context、Provider session 静态/集成路径；
- 搜索与 relation rebuild 性能；
- 402×874 布局合同，包括 dialog 非全屏根、58px toolbar、sticky 动态变量等。

## 当前结果

封包前工作副本实测：

- `run-tests`: OK（6176 Seed Entry / 1240 RelationComponent）
- `static-tests`: OK（23 个 Service Worker precache resource）
- `runtime-symbol-tests`: OK
- `stress-tests`: OK（125 entries / 158 memberships / 31 relation components）
- `integration-tests`: OK（最大 ChatGPT Shortcut URL 8042 chars，测试词 `data`）
- `performance-tests`: OK（25 次搜索 26.5ms；关系重建 4.0ms；VIX preflight 2852.7ms）
- `layout-contract-check`: OK（402×874）
- 全部产品 JS/MJS/Service Worker `node --check`: OK
- 产品 JSON/WebManifest：17 项解析通过
- VIX v2 examples：7 项 JSON Schema 校验通过
- 当前 Seed Raw Graph：1593 条无向关系边 / 3186 条定向邻接，非对称边 0

最终交付还会在全新解压目录重复执行同一套检查。自动化通过只证明源码/模型/可模拟布局，不证明真实 iOS WebKit 的 Home Screen 生命周期。

## 必须真机确认

- Dynamic Island/status bar 实际 safe area；
- dialog 打开无底部白块和唤出抖动；
- sticky 顶部 A 与快速滚动；
- 长按成功/失败/取消后无蓝色 Selection/callout/迟到 click；
- Home Indicator/系统边缘返回；
- 惯性/橡皮筋；
- Oxford/Shortcuts/ChatGPT 外跳返回；
- Collins 真实 API Key + standalone CORS；
- PWA 进程回收/离线冷启动/V icon 缓存。
