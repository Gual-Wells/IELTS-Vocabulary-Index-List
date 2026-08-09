# Vocabulary Index 4.3.0 UX 规格

## 1. Native Sticky 与收起

- Alphabet/Date 的可见 heading 永远是真实 DOM heading，不存在 mirror。
- Alphabet：`heading.top = Top Chrome + LetterNav`；Date：`heading.top = Top Chrome`。运行时统一消费实测 `--content-sticky-top`。
- 收起必须从“展开 Sticky 画面”直接进入“collapsed heading 位于正确边界”的最终画面，不应先删除大 body、下一帧再修 scroll。
- Date/Alphabet 共用 transaction kernel；LetterNav 是否存在由当前几何系统决定，不分叉 magic number。
- collapsed section 不持续 Sticky；expanded section 到 parent bottom 时自然 push-off。
- 真机仍需专门观察首次 collapse 是否存在 WebKit compositor 闪帧；不得用“自动化 PASS”替代。

## 2. Collection mode

- 同一 Collection 的 word/phrase 使用同一个 alphabet/date mode。
- 在 `A1 word = date` 时切到 `A1 phrase` 仍为 date；反向亦然。
- scroll、expanded groups、calendar month、browse anchor 各 view 独立，避免“模式统一”错误演变为“页面位置强绑定”。

## 3. Back / Home / Edge Gesture

- Back 按钮和 iPhone 合法返回手势是同一个 destructive POP 语义。
- POP commit 后离开页的递归 snapshot 被销毁，Forward 不得恢复。
- 进入 Home 的任何路径立即清空全部 recursive frames；Home 不清业务数据。
- 合法 iOS Back 不叠 VIX 自定义 page transition，避免原生手势 + App transition 双动画。
- 非法 Forward：尽可能在 edge touch start 拦截；用户不得看到被 POP 的旧 Entry 页面重新成为可交互内容。
- 页面下方永久存在与 `#fafafa/var(--bg)` 同色的 Navigation Underlay；它不是可导航页面，不按需创建。
- Guard feedback 只是一条轻量固定 edge surface，不应推动/重绘整个 App。

## 4. Popover

- Query 与 Relation Target 共用 140ms opacity/translate/scale 生命周期。
- Query 仍为 Oxford → Collins → Groq → ChatGPT，保持 4.2.0 12px viewport inset / 13px row gap / right-anchor-left-expansion。
- Relation Target 保留既有 anchor 位置；“共用引擎”不等于“统一几何”。
- scroll 中立即关闭，普通 dismiss 使用柔和 exit。

## 5. Modal

- 一个 retained Modal Engine 覆盖 Settings/Manager/Actions/Provider/Search/Confirm。
- 第一层 backdrop 48%，child 20%；父 card 真实保留并 inert，child card 正常显色。
- Backdrop 覆盖全部 Web drawable viewport；不人工染 Topbar/system shell。
- Card 使用 VisualViewport 变量定位；Search 继续较大的 task card，Confirm 继续小型确认卡。
- 完整 layer 一次插入，backdrop/card 同步淡入；退出先动画后 remove。不出现“先黑屏两帧、再突然出 card”。
- Modal 打开/关闭不改变 body position/top，不通过 root scroll reset 锁页面。
- 非 modal App inert；modal body 可纵向滚，header/footer/backdrop 不允许 pan；到 body 顶/底不得把 gesture 链给背景。
- nested child close 后 parent DOM identity、输入值、内部 scroll 必须原样保留。

## 6. Dock

- PIN/Review 是 context dock，不是 modal。
- Dock DOM 常驻；隐藏只改变 opacity/visibility/transform/pointer-events。
- PIN 点击只原位更新按钮与 dock，不重建整个 Entry row。
- Dock reveal/exit 140ms；occupancy 的建立/释放与 reveal/exit 排好顺序，避免可见 surface 和页面 padding 竞争首帧。

## 7. 视觉连续性硬规则

1. Presentation 出现不得要求背景正文先经历错误中间状态。
2. Safari 原生返回动画出现时 App 不再额外做同方向页面动画。
3. 被销毁的递归页不得重新 render 作为 Forward preview 的 App 内容。
4. 任意 URL/hash 路径一旦要显示 Home，必须先满足 VIX recursive stack 已清空；不允许先渲染 Home 再异步清 frame。
5. Modal/Popover/Dock 的业务 caller 不自行决定 body lock、double RAF、display hard toggle 或 whole-row rerender。
6. reduced-motion 关闭非必要 presentation motion，但不改变状态事务语义。
