# Vocabulary Index 4.1.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 自动化通过不等于真机通过。以下项目必须在 iPhone 17 标准版 standalone PWA 验证。

## A. 部署 / PWA identity

- [ ] 4.0.2 → 4.1.0 不清空 Entry、PIN、StudyStamp、Annotation、Settings。
- [ ] 重新添加到主屏幕后名称显示 `Vocabulary Index`，V 图标正常。
- [ ] Home 顶部栏显示 `Vocabulary Index`；首页大字仍为“词汇索引”。
- [ ] 离线冷启动、进程回收后启动正常。

## B. Top Chrome / Sticky

- [ ] alphabet 模式 topbar 与字母栏之间无空白/正文穿透。
- [ ] date 模式 topbar 与日期 Sticky 之间无空白/上一条内容穿透。
- [ ] 字母栏还在大标题下方、尚未吸顶时，不提前出现字母 Sticky mirror。
- [ ] 字母栏吸顶后当前字母 Sticky 紧贴其下缘，无抖动、无第二次跳位。
- [ ] 慢滚、快速 fling、rubber-band 后 active 字母与 Sticky 一致。
- [ ] global words / global phrases / global nonStructured、domain total、normal Collection、word/phrase/content 全部一致。
- [ ] 展开/折叠、惰性 chunk 物化后 Sticky 仍稳定。

## C. Alphabet cell border

- [ ] 字母栏每个字母按钮顶部边框连续可见。
- [ ] A/第一格左侧竖线存在。
- [ ] 每格右侧分隔线与底边连续。
- [ ] `#` 或其他 disabled/empty 字母仅字形变淡；其 top/right/bottom 结构线不变灰。
- [ ] active 填充/底部强调线不破坏 cell 结构线。
- [ ] 横向滚动时边框不闪断、不出现 wrapper 额外双框。

## D. 日期刷新

- [ ] date mode 刷新某 Entry 学习日期后，当前屏幕 scroll 位置保持不动。
- [ ] 不跟随该 Entry 跳到今天分组。
- [ ] 无二次滚动、overflow-anchor 回弹或短暂闪到目标 Entry。

## E. Query chooser / Oxford

- [ ] Query chooser 顺序 Oxford / Collins / Groq / ChatGPT。
- [ ] 菜单右侧与屏幕边缘存在明显但不夸张的呼吸空间，不贴边、不越界。
- [ ] Oxford 图标与用户参考图同构：合上的竖向书本、上部短横线、下方两层底线；没有擅自改造/封口造型。
- [ ] Oxford 只做 stroke/viewBox/尺寸统一；Collins/Groq/ChatGPT 既有造型无无关变化。

## F. Entry row density

- [ ] 有繁体：英文与繁体之间空隙比 4.0.2 更紧，但不拥挤。
- [ ] 有独立域来源：控件行与来源之间空隙同步收紧。
- [ ] 同时有繁体+来源时两者保持同一 Y/bottom 基线。
- [ ] 44px 操作触控区域不缩；普通无副信息 row 高度无异常回归。
- [ ] phrase/content two-line/extreme 不因压缩而碰撞或裁切。

## G. Home global switch

- [ ] 全局区右上左侧是切换图标，右侧是“管理”；顺序与 4.0.2 相反。
- [ ] 切换图标是两条平行反向开放箭头：上方向右、下方向左；不是刷新、循环箭头或双三角。
- [ ] 点击切换 structured/nonStructured；图标本体不需要随状态换形，VoiceOver label 表达目标状态。
- [ ] nonStructured 卡片名称为“全局非结构总表”。

## H. Retained Modal Stack / System shell

- [ ] 第一层 Modal：页面正文与 topbar/系统顶部可控 tint 的视觉暗度一致，对应 48% 第一层蒙版。
- [ ] 第二层 Modal：父卡片继续存在且被额外 20% 蒙版压暗；topbar/system shell 也同步到第二层累计颜色，不停留在第一层 `#8f8f8e`。
- [ ] 关闭第二层时 topbar/system shell 回到第一层颜色；关闭最后一层回到 `#fafafa`。
- [ ] topbar 本身没有因为“直接合成色 + backdrop”被双重加深。
- [ ] 父层 inert、焦点恢复、body lock、卡片 reveal、四角/上下 backdrop 规则无回归。
- [ ] 若 iOS 26.5.2 Dynamic Island/status system strip 仍保持固定白色，记录 `screen.height / innerHeight / visualViewport.height / offsetTop`；区分 WebKit system strip 与 DOM 回归。

## I. 4.0.x 业务回归

- [ ] Schema6 / DB5 / Seed4 / VIX2。
- [ ] word/phrase/content 优先级占有不变。
- [ ] Search fuzzy；Relation exact/Raw Graph symmetric；四态关系不变。
- [ ] Fresh navigation / recursive return 不变。
- [ ] Collins/Groq abort/stale ownership、ChatGPT context v2 不变。
- [ ] 520ms + 350ms longpress、全局不可选、58px bottom toolbar、Home Indicator 无回归。
