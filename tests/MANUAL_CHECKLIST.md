# Vocabulary Index 4.0.2 · iPhone 17 主屏幕 PWA 人工验收清单

> 自动化通过不等于真机通过。以下项目必须在 iPhone 17 标准版 standalone PWA 验证。

## A. 启动 / 世代 / PWA

- [ ] 4.0.1 直接升级到 4.0.2，不清空 Entry、PIN、日期、Annotation、设置。
- [ ] 3.5.x 旧世代仍进入 Schema6/Seed4 替换流程；旧 VIX/Full Backup 不被误导入。
- [ ] Home Screen `V` 图标正常；离线冷启动正常。
- [ ] 状态栏/Dynamic Island 区域与 App 背景连续，不再出现 modal 顶部独立白块。
- [ ] 顶栏内容仍按 safe-area 避让，不侵入系统状态区域。

## B. Sticky / 字母栏

- [ ] 字母栏上方、下方均无镂空白带或正文穿透。
- [ ] A 首组从页面顶部即可正确进入 Sticky Heading Layer，无死区。
- [ ] 慢速滚动时当前字母即时切换，无明显滞后。
- [ ] 快速 fling 后最终 sticky 字母与真实阅读位置一致。
- [ ] 惰性 chunk 从 placeholder 物化后 sticky 不漂移。
- [ ] 展开/折叠任意字母组后 sticky 仍正确，页面补偿无跳动。
- [ ] 手动横滑字母栏后，既有手动锁语义不回归；纵向真正换组后自动跟随恢复。
- [ ] 点击独立 sticky 标题可展开/收起对应真实分组。

## C. Modal Stack

- [ ] 首页打开“设置”：卡片四角完整，上下均留有背景蒙版，不接近全屏。
- [ ] “设置”内容超过高度时仅 body 滚动；Header/Footer 不随内容继续撑高。
- [ ] 设置页无 Collins CORS、低级词汇关系等常驻开发说明段落。
- [ ] 设置 → 管理词库：设置卡片仍真实保留在后方并被第二层轻蒙版锁定。
- [ ] 关闭管理词库：设置原滚动、API Key 临时输入、模型选择和 checkbox 状态原位保留，不重新跳出/闪回。
- [ ] 词表操作 → 应用设置：父 action 层保留，子层正确叠加。
- [ ] 子层再打开编辑/确认时层级顺序正确；每次关闭只 pop 一层。
- [ ] 父层在子层存在时完全不可点击/不可 Tab；焦点只在顶层循环。
- [ ] 关闭子层后焦点回到发起控件或合理父层控件。
- [ ] 背景页面在任何层级 modal 打开时都不可滚。
- [ ] 弹窗打开无位置跳动，也无白色/未完成布局的卡片闪现；允许 backdrop 先出现一帧。
- [ ] 搜索/确认 native utility dialog 与 retained app modal 叠加时无白带、无 scroll-lock 计数错误。

## D. Entry row / nonStructured

- [ ] 普通 word/phrase row 高度无回归。
- [ ] 有繁体释义时 row 明显比 4.0.0 紧凑，主行与副行之间无大块空白。
- [ ] 有独立域来源时来源与繁体释义使用同一 Y/bottom 判定，左右视觉基线一致。
- [ ] 同时有繁体+来源时上下边缘仍紧凑且文字不碰边。
- [ ] content-normal 正常显示。
- [ ] content-two-line 自然换行，不被右侧控件截失。
- [ ] content-extreme 可横向拖动查看完整文本，点击复制逻辑不被横滑误触。
- [ ] 虚拟 chunk 高度变化后滚动位置无明显跳跃。

## E. Query chooser / Settings controls

- [ ] Query chooser 略向左贴近来源按钮，不超出屏幕。
- [ ] 四列顺序固定 Oxford / Collins / Groq / ChatGPT。
- [ ] 四个图标下副字清晰，菜单没有明显增高或多余上方空白。
- [ ] Oxford、ChatGPT 新图标与既有 Collins/Groq 线宽和视觉重心协调；其他既有图标未被无故重绘。
- [ ] “关闭低级词汇关联”使用产品绿色 checkbox；点击区域、状态持久化、VoiceOver/键盘语义不变。

## F. 长按 / 原生手势

- [ ] 普通 UI 文本不可系统长按选择。
- [ ] 浏览锚点 520ms 成功：保存成立，松手后提示，无 Selection/callout/click 泄漏。
- [ ] 保存失败、pointercancel、520ms 边界释放后同样无蓝色选区或系统菜单。
- [ ] Toast/错误提示不会被刚结束的长按手势选中。
- [ ] input/textarea 仍可原生选字、移动光标。
- [ ] 底部 Home Indicator / 系统返回手势无误触回归。

## G. 4.0.0 业务语义回归

- [ ] word/phrase/content 优先级占有不变。
- [ ] Search 仍 fuzzy；Relation 仍 exact、Raw Graph 双向。
- [ ] 四态关系跳转与“关闭低级词汇关联”逻辑过滤不变。
- [ ] Fresh navigation：Home→Collection 为 alphabet/top/collapsed，structured word-first。
- [ ] Recursive return 恢复 view/mode/scroll/expanded state。
- [ ] Oxford/Collins/Groq/ChatGPT 功能顺序、Abort/stale-response、ChatGPT compact context 无回归。
- [ ] 58px 底部工具栏保持原真机尺寸。

## 4.0.2 真机专项

- [ ] 字母模式：全局词汇/短语、域总表、普通词表、短语页、内容页的字母栏下方无镂空；独立 Sticky 标题稳定显示在字母栏下方。
- [ ] 日期模式：Sticky 日标题继续位于顶部主栏下方，不错误预留字母栏高度。
- [ ] 日期模式刷新学习日期后，视口保持原位置，不跟随被刷新 Entry 跳转。
- [ ] 查询菜单右边界完整露出且相较 4.0.1 略左移；Oxford 为闭合书本描边图标，四 Provider 同为深色描边。
- [ ] 打开/关闭应用 Modal 时检查顶部系统状态区颜色连续性；iOS 26.5.2 若仍保留系统不可绘制 62px 区域，记录为 WebKit 平台限制而非 DOM 回归。
