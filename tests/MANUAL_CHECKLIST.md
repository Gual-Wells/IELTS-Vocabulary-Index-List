# Vocabulary Index 4.4.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 目标：iPhone 17 标准版 / iOS 26.5.2 WebKit / Home Screen standalone。帧级/手势 reduced cases 见 `IPHONE_REDUCED_TESTS_4.4.0.md`。

## 安装与版本

- [ ] 页面/设置显示 4.4.0；Home Screen 名称仍为 `Vocabulary Index`。
- [ ] 新 Service Worker cache generation 生效；离线可启动。
- [ ] 既有业务数据/PIN/StudyStamp/Annotation/设置仍在；Navigation runtime 从新 root generation 开始。

## Sticky

- [ ] Alphabet / Date native Sticky 正常 push-off。
- [ ] 长位移 collapse 无整页闪白。
- [ ] 重复开合不累计向上漂移。
- [ ] document bottom 不发生 clamp 跳跃。

## Navigation

- [ ] Back button 与 iOS swipe commit 恢复同一上一 frame。
- [ ] 合法 Back 只有 Safari 原生一套动画。
- [ ] POP 后 Forward 不复活旧页。
- [ ] Home 一次回根且不清业务数据。
- [ ] 无非法 Forward 时右缘不被无意义拦截。

## Modal

- [ ] Settings/Search/Confirm/nested 打开不改变背景 Sticky 位置。
- [ ] 背景不可滚/点/聚焦；dialog-body 可滚且不链滚。
- [ ] Search 键盘只改变 modal geometry。

## 保留项

- [ ] PIN/Review Dock。
- [ ] Query/Relation Popover。
- [ ] Oxford/Collins/Groq/ChatGPT。
- [ ] word/phrase 共用 Collection alphabet/date；各 view 的 scroll/expanded/calendar 独立。
- [ ] Home/Entry/Toolbar/longpress/StudyStamp/Relation/Search/Import/Export 无回归。
