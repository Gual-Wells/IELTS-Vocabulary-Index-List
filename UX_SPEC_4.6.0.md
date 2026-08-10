# Vocabulary Index 4.6.0 UX 规范

## Programmatic positioning

任何由 VIX 发起的跳转都必须有唯一 semantic target。一个用户操作完成前，不允许旧 IO/rAF/observer correction 抢占 viewport。

### Alphabet

- 点击字母时，目标是该 section 的 natural flow anchor。
- 如果 document 后续空间足够，anchor 对齐 ContentTop；不足则只允许标准 maxScroll bottom clamp。
- direct X 与 A→B→…→X 最终结果必须相同，除 bottom clamp 外不得因先前 materialization 历史改变。
- active letter、LetterNav track 与 Sticky/正文的第一次可见提交应一致，不接受明显后刷新。

### Back

- App Back 的最终语义位置必须等于离开 source frame 时的 semantic position。
- UA 可作为第一遍物理 restore，但错误结果不能成为最终 live VIX 状态，也不能污染下一次 snapshot。
- Bottom 是语义状态：例如最后一项 + `bottomGap=0`，不是一个永久 absolute Y。

## Native swipe

Safari 可在 gesture 阶段展示 browser-owned frozen snapshot；深 history 可因系统 snapshot image 淘汰只显示背景。VIX 不叠加第二套 swipe/page animation。

Safari 交回 live page 后，不允许 VIX 再出现 Search 消失、active letter 更新、Sticky 修正或明显位置二跳。

## Search

same-Collection：关闭 Search 后在当前 frame 定位，不新增 Back layer。

cross-Collection：Search layer 在 browser slot 建立前必须从 source visual surface 移除，减少 stale history preview。

## Sticky / Modal

4.4 语义冻结：Sticky collapse 无闪/无累计漂移；Modal 覆盖未改变背景几何，背景不可交互且焦点约束继续成立。

## 启动

首次安装正常路径为 `V → Home` 一次。iOS 进程启动时短暂显示系统保存的旧 launch snapshot 不视为 VIX recursive state restore。
