# Vocabulary Index 3.2.0 前端与交互审计报告

审计日期：2026-08-02  
审计对象：Vocabulary Index 3.1.1 完整源码与用户提供的 iPhone 主屏幕 PWA 真机截图  
目标平台：iPhone Safari“添加到主屏幕”后的独立 PWA 运行环境  
不在范围内：桌面浏览器、Android、iPad 横屏、跨设备同步、多用户协作

## 1. 审计结论

3.1.1 的数据模型和功能结构已经稳定，但界面在加入学习日期、关联、PIN、更多、Oxford 和 ChatGPT 后，仍沿用“一级表项单行横向挤压”的旧布局。真机截图直接显示出三个结果：

1. 英文被迫在任意字符处断行，例如 `manifest`、`memoization` 被切成多行；
2. 繁体中文释义列被压缩到几乎不可见；
3. 每行同时承载七个触控动作，文本和操作互相争夺宽度。

首页则存在相反的问题：卡片计数采用较大的衬线字号，在 `1,294 词 · 0 短语` 等复合计数上发生不自然换行，视觉重心压过词表名称。与此同时，全局与独立域的系统总表虽然在数据语义上属于系统投影，视觉上仍与普通表接近。

用户感知到的轻微卡顿并非单一故障，而是多项主线程成本叠加：大量行一次性进入 DOM、每行重复解析 SVG、每行预先计算完整关联目标、滚动时扫描大量节点，以及多个 sticky 层使用实时背景模糊。3.2.0 因此采用“布局重构＋渲染限流＋iOS PWA 防御性修复”的组合方案，而不是只缩小字体。

## 2. 审计方法

### 2.1 源码审计

重点检查：

- `index.html`：PWA meta、顶栏、页面结构、CSP；
- `css/v3.css`：首页层级、卡片字号、一级表项网格、sticky 材质、触控区域、iOS 文本自动放大；
- `js/v3-ui.js`：首页渲染、长列表渲染、关系计算、滚动位置追踪、跳转、局部更新；
- `js/v3-store.js`：可见性判断、PIN、学习日期、上次位置；
- `js/v3-app.js`、`sw.js`、`v3-upgrade.js`：主屏幕 PWA 生命周期、缓存升级和后台恢复；
- 自动化测试与 Seed 报告。

### 2.2 真机证据

用户提供的 iPhone 截图显示：

- 首页复合计数使用过大衬线字体，出现两至三行断裂；
- 计算机术语普通表显示 `0 短语` 的旧数据库状态与 Seed 新分类不完全一致，这属于既有本地数据升级状态，不是本轮视觉问题；
- 一级表项英文发生任意位置断行；
- 繁体释义只剩极窄字符片段；
- 操作区占据一行大部分宽度；
- 日期模式与字母模式功能已出现，但密集布局降低了可读性。

### 2.3 外部资料

本轮优先采用 Apple、WebKit、web.dev 等一手资料，并以 WebKit Bugzilla、GitHub issue、PWA 社区讨论作为工程风险补充。

## 3. 产品范围修正

3.2.0 不再维护“iPhone 为主、桌面为辅”的双目标。产品约束冻结为：

- 只面向 iPhone 竖屏、Safari 添加到主屏幕后的 standalone PWA；
- 只服务一个本地用户、一个设备、一个浏览器存储空间；
- 不实现云同步、账户系统、跨设备合并或多人协作；
- 同一开源仓库被其他人部署或打开时，各自使用各自浏览器的 IndexedDB，不共享业务数据库，因此不会影响原用户；
- 浏览器标签页模式只保留基本可启动能力，不为其设计独立视觉或兼容分支。

Apple 的 iOS 指南强调围绕 iPhone 的中等尺寸屏幕、手持姿势、主要任务和有限屏上控件进行设计。本轮因此允许放弃桌面密度，改用更适合单手触控和纵向滚动的结构。

## 4. 关键问题与处理

### 4.1 一级表项横向过载

#### 3.1.1 问题

原布局把英文、释义、日期和七个操作控件放在同一逻辑行。CSS 中还存在 `overflow-wrap: anywhere`，在可用宽度不足时允许英文从任意字符处断开。随着 Oxford 与 ChatGPT 控件加入，横向约束已经不可解。

#### 3.2.0 处理

一级表项改为固定的两层信息架构：

```text
第一逻辑行：英文｜繁体释义｜学习日期
第二逻辑行：日期刷新｜标注｜关联｜PIN｜更多｜Oxford｜ChatGPT
```

具体规则：

- 英文保持单行，不再任意断词；超长词使用尾部省略，并保留完整 `title`；
- 繁体释义获得实质宽度，单行省略；
- 日期固定在文本行末端；
- 所有按钮进入第二行，保持稳定顺序；
- 每个触控目标维持 44×44 CSS px；
- 按压时立即出现背景与缩放反馈。

Apple 建议在水平空间受限时采用堆叠布局，并要求 iOS 按钮命中区至少 44×44pt。两行结构不是视觉偏好，而是对内容可读性和触控准确率的必要修正。

### 4.2 首页字号与信息层级

#### 3.1.1 问题

首页同时显示顶栏产品名、英文眉题和“我的词表”，造成重复身份信息；卡片计数使用 25px 左右 Georgia，复合计数在窄卡片内断裂，数字反而比词表名称更突出。

#### 3.2.0 处理

- 删除重复 Hero 标题，只保留顶栏“词汇索引”；
- 顶栏副标题只显示全局词汇数，不常驻显示“本地保存”；
- 管理入口移入“全局”标题行；
- 卡片名称使用系统无衬线字体；
- 单类型总表计数约 21px；
- 普通表复合计数约 13–14px、强制单行；
- 取消数字衬线体，减少视觉跳变。

这让首页优先表达“有哪些表”，而不是把计数当作展示性标题。

### 4.3 系统总表的视觉身份

#### 语义

全局词汇总表、全局短语总表、独立域词汇总表和独立域短语总表都是系统派生视图，不是普通 Membership 容器。

#### 3.2.0 处理

- 首页系统卡片增加淡绿色／青绿色侧向径向渐变；
- 全局总表使用稍强的青绿—蓝绿色侧光；
- 独立域总表使用更弱的绿色侧光；
- 不叠加厚边框、强阴影或动画光效；
- 进入系统总表后，列表容器左侧延续同一低强度光晕。

效果只承担“这是系统投影”的识别职责，不改变卡片结构，也不抢夺内容注意力。

### 4.4 轻微卡顿与交互延迟

#### 发现 A：大列表 DOM 规模

日期模式中，5,322 个未标注词汇可能一次生成全部行。字母组展开也可能一次生成数百行。大 DOM 会增加样式计算、布局和绘制成本，并放大任意后续交互的 presentation delay。

**处理：**每 42 行形成一个渲染块。首块立即生成，其余块用 `IntersectionObserver` 在距离视口约 960px 时物化；跳转到未生成条目时强制物化对应块。浏览器不支持观察器时自动完整渲染，避免空白内容。

#### 发现 B：每行重复解析 SVG

原实现每次创建按钮都通过 `innerHTML` 解析 SVG 字符串。数百行乘以多个图标会重复触发解析和节点构建。

**处理：**每种 SVG 只解析一次并缓存为模板，后续使用 `cloneNode(true)`。

#### 发现 C：未展开行也计算完整关联目标

完整关联计算需要跨 Entry、Membership 和词域解析合法落点。此前每次渲染行都可能执行完整计算，即使关联面板并未展开。

**处理：**未展开状态只执行低成本“是否存在关联”判断；只有展开时才构建完整关系列表和目的地。

#### 发现 D：滚动位置追踪扫描布局

滚动结束后逐行读取 `getBoundingClientRect()` 容易触发较多布局读取。

**处理：**优先用 `document.elementFromPoint()` 在有效阅读区域采样首个可见行；只在采样失败时扫描当前已物化的小量行。滚动 UI 更新统一进入 `requestAnimationFrame`；支持 `scrollend` 时只在真正结束后持久化位置。

#### 发现 E：重复线性可见性查询

PIN、学习日期和上次位置验证过去通过投影数组 `.some()` 或重新构建 `Set` 完成。

**处理：**Store 构建状态时为每个视图建立 `visibleEntryIdsByCollection`，后续 O(1) 查询。

#### 发现 F：sticky 背景模糊

顶栏、字母栏、上下文栏和返回顶部控件使用多个 `backdrop-filter: blur(...)`。WebKit 明确说明背景滤镜需要额外渲染和合成步骤，长列表滚动时会持续增加成本。

**处理：**iPhone PWA 中改为不透明背景，保留层级但取消实时背景模糊；对话框 backdrop 也不再模糊页面。

#### 发现 G：返回顶部平滑滚动

长列表使用平滑滚动会占用较长动画周期，并与位置追踪、懒渲染和 sticky 更新竞争。

**处理：**返回顶部改为即时滚动，同时先保存当前位置，并暂停滚动持久化，避免覆盖“上次位置”。

### 4.5 iOS 文本自动放大与输入缩放

Safari 可能对移动页面自动调整文字大小；小于 16px 的输入控件聚焦时还可能触发页面放大。

**处理：**

- 设置 `-webkit-text-size-adjust: 100%`；
- 输入、选择器和文本框统一至少 16px；
- 增加 `format-detection=telephone=no`，避免词条被误识别为电话号码。

### 4.6 standalone PWA 后台恢复风险

WebKit Bug 262207 记录了 standalone PWA 从后台恢复后 `innerWidth` 异常变成桌面虚拟宽度的问题；该报告在 2026 年仍有复现反馈。Bug 218983 也表明 `visualViewport.height` 在键盘和旋转流程中可能不可靠。社区中有类似的后台恢复缩放、底部空隙和 fixed 元素错位报告。

**处理：**

- 启动时识别 standalone 模式；
- 记录健康的 iPhone 视口宽度；
- 在 `visibilitychange` 和 `pageshow` 后检测异常宽度跃迁；
- 仅在异常时短暂重写 viewport meta，再恢复 `viewport-fit=cover`；
- 不以 `visualViewport` 作为唯一布局真值；
- 保留安全区变量和单一页面滚动。

这是防御性补偿，不代表 WebKit 问题已经从平台层解决。

## 5. 没有纳入的事项

本轮没有进行以下扩展：

- 桌面响应式布局；
- Android 或第三方 iOS 浏览器适配；
- 云同步、账户和多设备冲突解决；
- 全面 CSS Cascade Layers 重构；
- 动态字体极端字号下的完整多行重排；
- 将所有页面改成虚拟滚动窗口；
- 改动词库数据、学习日期语义、数据交换协议或外部查询格式。

## 6. 单用户数据隔离判断

当前数据保存在当前浏览器／当前安装 Web App 的 IndexedDB 中，不连接远程数据库。其他人打开同一个公开仓库或部署地址时，会在他们自己的浏览器存储环境中创建独立数据，不会写入原用户设备。只有用户主动导出并转移完整备份，数据才会离开本机。

因此，没有必要引入账户、同步服务器或多用户锁。保留 `BroadcastChannel`／跨标签页刷新只用于同一设备同一来源下可能出现的重复页面，不构成多人协作系统。

## 7. 验收重点

真实 iPhone 上应重点检查：

1. 从 Safari 添加到主屏幕后冷启动；
2. 锁屏或切换 App 数分钟后返回，页面宽度不异常缩小；
3. 首页卡片计数不再断成多行；
4. 全局和域内系统总表的侧光足够辨识但不刺眼；
5. 英文、繁体释义、日期均位于第一逻辑行；
6. 七个操作控件完整位于第二逻辑行；
7. 长词不任意断字；
8. 5,322 项日期模式滚动时不出现长期空白块；
9. 展开关联、PIN、刷新日期和模式切换的即时反馈；
10. Oxford／ChatGPT 跳转后返回 PWA，原页面和滚动位置保持；
11. 搜索输入聚焦不产生页面异常放大；
12. VoiceOver、Switch Control 或全键盘访问时焦点轮廓仍可见。

## 8. 残余风险

- 容器环境不能自动控制真实 iOS 主屏幕 PWA，因此无法生成可信的 WebKit Performance Timeline；
- 渲染块使用估计高度，首次物化时可能出现极轻微位置修正，但远小于一次性创建全部行的代价；
- ChatGPT 快捷指令的长 URL 上限由 iOS 与快捷指令 App 决定，自动化只能验证编码和反解；
- WebKit 视口修复是针对已知异常的保护逻辑，仍需实际锁屏／后台恢复测试；
- 本轮保留历史 CSS 结构，只在末端建立 iPhone 专用收敛层；彻底清理旧覆盖规则可作为后续纯工程版本。

## 9. 参考资料

### 官方设计与技术文档

1. Apple, *Designing for iOS*  
   https://developer.apple.com/design/human-interface-guidelines/designing-for-ios/
2. Apple, *Buttons*  
   https://developer.apple.com/design/human-interface-guidelines/buttons
3. Apple, *Typography*  
   https://developer.apple.com/design/human-interface-guidelines/typography
4. Apple, *Accessibility*  
   https://developer.apple.com/design/human-interface-guidelines/accessibility
5. Apple, *Human Interface Guidelines*  
   https://developer.apple.com/design/human-interface-guidelines/
6. WebKit, *Introducing Backdrop Filters*  
   https://webkit.org/blog/3632/introducing-backdrop-filters/
7. WebKit Bug 262207, *Safari viewport suddenly becomes half size*  
   https://bugs.webkit.org/show_bug.cgi?id=262207
8. WebKit Bug 218983, *visualViewport.height unreliable in standalone PWA mode*  
   https://bugs.webkit.org/show_bug.cgi?id=218983
9. web.dev, *Optimize Interaction to Next Paint*  
   https://web.dev/articles/optimize-inp
10. web.dev, *Avoid large, complex layouts and layout thrashing*  
    https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing

### 社区与开源工程反馈

以下资料只作为平台问题的复现补充，不替代官方规范：

1. r/PWA, standalone PWA 后台恢复后异常缩放讨论  
   https://www.reddit.com/r/PWA/comments/176vpj8/
2. r/PWA, iOS standalone 键盘后布局位移讨论  
   https://www.reddit.com/r/PWA/comments/1oavcpf/
3. Ionic Framework Issue #26702, visual viewport 与键盘导致应用整体滚动  
   https://github.com/ionic-team/ionic-framework/issues/26702
4. Flutter Issue #135800, iOS Web 文本输入与视口偏移  
   https://github.com/flutter/flutter/issues/135800
5. Open WebUI Discussion #20878, iOS Safari PWA 长页面交互降速反馈  
   https://github.com/open-webui/open-webui/discussions/20878

## 10. 最终判断

3.2.0 的正确方向不是继续在同一行压缩控件，而是承认一级表项已经从“简单词条”发展成“信息＋操作”复合单元。两行布局恢复了英文和繁体释义的主导地位；渲染分块、图标缓存、关系惰性计算和滚动限流则针对用户感知到的轻微延迟处理主线程成本。

本版本完成的是 iPhone standalone PWA 的平台收敛，不是通用网页兼容升级。
