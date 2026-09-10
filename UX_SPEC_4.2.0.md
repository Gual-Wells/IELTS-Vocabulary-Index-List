# Vocabulary Index 4.2.0 UX 规格

## Alphabet / Date

- Alphabet 与 Date 都由真实 section heading 使用 native `position: sticky`。
- Alphabet 的 `top` 为实测 Top Chrome + 实测字母栏高度；Date 为基础 Top Chrome。
- collapsed 小标题不应形成持续 Sticky；expanded 小标题在其 section 触底时自然向上退场。
- 点击 Sticky heading 收起后，该真实 heading 保持在当前 Sticky 位置：字母模式为字母栏正下方，日期模式为基础 Chrome 正下方。
- Alphabet JS metrics 仅同步字母栏 active/横向轨道，不生成视觉 mirror。

## Query chooser

- Oxford → Collins → Groq → ChatGPT。
- 弹窗采用与关系多目标菜单相同的“右侧动作源向左展开”定位语言，再额外左退 10px；viewport 至少保留 12px 安全边距。
- 优先在触发 Entry 上方显示，与 Entry 外框保持 13px 呼吸缝；空间不足时才放到下方。
- 不把列表边框延伸/穿过浮层，不再故意把 Query menu 右缘探出列表边界。
- Oxford 是重新设计的紧凑 closed-book outline，视觉面积与 Collins/Groq/ChatGPT 对齐。

## Home

- Topbar 产品名：`Vocabulary Index`，使用独立 serif Product Wordmark；不复用绿色 uppercase eyebrow。
- Hero 保持 `VOCABULARY INDEX` eyebrow + 大字“词汇索引”。
- `全局` heading 与 Domain heading 同为 15px/740；不再是 12px tracking kicker。
- `全局` 去完整矩形框；heading 行采用“全局 — hairline — [切换][管理]”的 Index Rule。
- 切换按钮在左、管理在右；切换 icon 继续“上→ / 下←”平行开放半箭头。
- nonStructured 显示名：`全局非结构总表`。

## Back / Home

- depth 1：只显示 Back。
- depth >=2：显示 `Back + Home`；Home 是 outline house。
- Back：返回上一页并恢复递归快照。
- Home：一次回首页顶部，销毁当前导航递归语义，旧 pageSnapshot 不得再复活。
- Home 不清业务数据、浏览锚点或数据 Undo/Redo。

## Modal / PWA top

- DOM 变暗全凭真实 backdrop；父 modal 在子 modal backdrop 下自然变暗，当前子 card 正常显色。
- 不再人工染 Topbar/root/theme-color。
- iOS system status strip 若不在 Web viewport 中，可保持静态 `#fafafa`；这不是再次伪造 DOM 的理由。
