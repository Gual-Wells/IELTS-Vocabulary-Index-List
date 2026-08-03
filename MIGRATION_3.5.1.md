# Vocabulary Index 3.5.1 迁移说明

## 数据兼容性

- Backup Schema：5；
- IndexedDB DB version：4；
- Seed revision：3；
- VIX version：1。

3.5.1 不迁移 Entry、Membership、PIN、Annotation 或 StudyStamp。3.5.0 数据可直接打开。

## 浏览位置语义变化

旧 `lastPositions` 数据继续可用，但从 3.5.1 起不再被滚动、复制或返回顶部自动覆盖。用户通过底部靶心按钮：

- 短按：跳到已有浏览锚点；
- 长按：保存或覆盖当前位置。

旧位置会成为初始浏览锚点，用户可选择保留或长按覆盖。

## Service Worker

缓存版本升级为 `v3.5.1-ios-shell-20260803-2`，并预缓存 `css/v3.5.1.css`。部署时必须完全替换旧站点文件，避免 3.5.0 HTML、JavaScript 和 3.5.1 CSS 混用。
