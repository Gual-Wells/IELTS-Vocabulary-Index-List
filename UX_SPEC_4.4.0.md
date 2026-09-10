# Vocabulary Index 4.4.0 UX 规格

## 1. Sticky

- 可见标题始终是真实 native Sticky heading。
- 长 section 深处收起时，最终 heading 保持当前阅读锚点，不得先整页闪白或逐次向上爬。
- 同一 section 反复展开/收起 100 次，视觉位置不得形成可感累计漂移。
- 用户不应看到 View Transition 动画；该 API 只用于隐藏不可接受的中间渲染状态。
- Alphabet/Date 的最终吸顶边界继续来自当前真实 chrome geometry。

## 2. Back / Home / Forward

- Back button 与 iPhone 合法 swipe Back = 同一 destructive POP。
- 合法返回只出现 Safari 一套连续交互动画；VIX 不再叠第二套 page-transition。
- 恢复页的 mode/calendar/expanded/relations 在首个可见目标帧中已经正确；不得先显示默认页再跳一次。
- POP 后离开页不可通过 Forward 恢复。
- Home 立即成为新的 VIX root generation；不等待按 depth 倒退多个 browser slots。
- 右缘只有在真实存在 forbidden next entry 时才被 guard；没有非法 Forward 时不制造永久死区。
- 永久底色来自 page canvas，不存在独立 navigation underlay。

## 3. Modal

- 打开 Settings/Search/Confirm/nested 时，背景页面只被 backdrop 视觉变暗；背景 Sticky/Entry 的几何和 DOM 不改变。
- 背景不可点击、不可滚、不可获得焦点；dialog-body 可滚，到边界继续拖不传给正文。
- Search 键盘仅改变 modal card 的 VisualViewport placement，不重新测背景 Sticky。
- Parent→Child→close Child：parent DOM identity、字段值、内部滚动位置原样保留。

## 4. 保留视觉

Query/Relation Popover、PIN/Review Dock、Home wordmark/Global Index Rule、Oxford/Collins/Groq/ChatGPT、Entry compact layout、58px toolbar 和 4.3 已稳定视觉不重设计。
