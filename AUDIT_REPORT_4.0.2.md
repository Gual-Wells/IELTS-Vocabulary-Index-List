# Vocabulary Index 4.0.2 审计报告

## 根因审计

### Sticky/镂空

4.0.1 的 `topChromeBottom()` 只在字母栏已经与顶部 Chrome 连续时才把它计入 `--chrome-bottom`。初始渲染阶段字母栏仍处在文档流中，缓存的 `--chrome-bottom` 因而只等于顶部栏底边；滚动后该值没有因字母栏进入 sticky 状态而可靠更新。独立 Sticky Heading 随后被定位到字母栏本应占据的位置，并因 z-index 低于字母栏而被遮挡。真实分组标题滚过时，覆盖层缺失造成同源的“镂空”视觉。

4.0.2 改为：只测基础顶部 Chrome 和字母栏自身高度，内容边界恒为两者之和。字母栏隐藏时自动退化为基础边界。该规则不依赖 scroll 时机。

### 日期刷新跳转

4.0.1 在 date mode 刷新 StudyStamp 时显式设置 `pendingJumpEntryId` / `study-date`，导致重渲染后主动定位到今天分组。4.0.2 删除该导航语义，保存 scrollY、临时关闭 overflow-anchor，并在重渲染后无动画恢复当前位置。

### 顶部系统区

iOS Home Screen PWA 的状态栏/顶部系统区域并非总由页面 DOM 控制。4.0.2 只做 theme-color/under-page surface 的 best-effort 同步，不通过强制黑色状态栏或伪造覆盖层破坏浅色常态页面。iOS 26.5.2 若保留系统不可达顶部带，应作为 WebKit 平台限制记录。

## 数据与业务审计

Seed 与 4.0.1 保持字节一致；Schema 6 / DB 5 / Seed 4 / VIX 2 不变。关系、搜索、优先级占有、Provider 数据边界无变化。
