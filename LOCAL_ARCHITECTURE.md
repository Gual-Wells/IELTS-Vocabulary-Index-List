# Vocabulary Index 4.7.2 本地架构

## Data

Schema6 / IndexedDB5 / Seed4 / VIX2。业务数据与runtime navigation/presentation/scroll/virtual state分离。

## Single-Slot Navigation

当前继续使用4.7 `single-slot-vix-v1`：Browser session history只保留一个VIX root slot；内部页面由`navigationStack`保存live recursive Collection frames；Back直接POP，Home直接clear；kill/reopen从Home开始。

**生命周期限定**：4.6.0曾冻结`destructive-v3` Browser History Rail。4.7.2不宣称Single Slot与之等价，也不在本次switch repair中回滚；该差异单列待决。

## Presentation Intent Queue

`enqueuePresentationIntent()`串行化 Collection navigation、Back、Home、Word/Phrase与Alphabet/Date toggle。Promise tail在前一任务reject后仍可继续。View/Mode toggle的目标在实际执行时读取current state，避免buffer中的重复点击使用陈旧闭包target。

## ScrollCoordinator

`js/v3-scroll-runtime.js`继续是唯一root-scroll ownership。Programmatic semantic target、Back restore、Sticky collapse、virtual materialize等都经coordinator/adapter提交；stale epoch write被拒绝。

## Semantic Motion Gate

- Spatial Motion：新Collection Push、Back Pop；
- Semantic Scroll：同页Letter/Entry/PIN/Date/Return Top；
- Local Reveal：Modal/Relation；
- Buffered State Commit：Word/Phrase、Alphabet/Date、Home global mode；
- Root Buffer：Home；
- Discrete Follower：LetterRail。

## Semantic Transition Contract

4.7.2把“结果”和“呈现”重新分层：

- 手动Word/Phrase：目标view `TOP + collapsed`；Date下使用目标view自身calendar month；
- 手动Alphabet/Date：目标mode `TOP + collapsed`；Alphabet→Date使用目标section latest-valid-month；
- Same-Collection明确Entry target：允许hidden view change/target expansion，但只执行一次标准Entry semantic landing。

4.7.1 transient letter/date neighborhood mapping已从active manual switch删除。

## Buffered State Commit

`runBufferedCollectionCommit()`隐藏Collection content plane，完成semantic state/render/geometry/position commit后reveal。old/new内容不同时可见，也不调用document View Transition。

Buffer期间Collection content inert；底栏浏览锚点/回顶/搜索暂时inert；两个View/Mode toggle保持可接受后续queued intent。Topbar Back/Home通过同一queue串行。

## One Semantic Entry Target

`entryJumpSemanticPosition()`统一普通`jumpToEntry()`与hidden same-Collection target的38% reading-anchor几何。4.7.1“hidden restore后再jump一次”的双viewport求解已移除。

## Root Home Buffer

`runRootBufferedCommit()`用于Home：旧root context释放，更新Home，topbar/wordmark与main内容在稳定DOM上恢复，无scale/translate。

## Alphabet Semantic Axis / LetterRail

`js/v3-motion-runtime.js`继续提供A–Z/# ordinal、piecewise physical↔semantic映射与duration/easing。LetterRail UI只有离散active cell；`cameraTargetForActiveCell()`使用38%–62%safe zone与hysteresis；manual drag lock规则保留。

## Modal / Relation

4.7.1 retained Modal/inert/geometry/focus restoration、transparent interaction backdrop、`@starting-style`与快速exit全部保留。Relation layout直接提交最终高度，只动画panel本身。

## VirtualEntryList / Target Prewarm

42 Entry / 960px prefetch冻结。Chunk descriptor与frame-local measured cache保留。Virtualizer不得直接拥有root scroll。

## Failure Containment

Manual View switch失败恢复previous view/frame snapshot；Mode switch若持久层写入失败则best-effort恢复previous mode/calendar与frame。回滚异常不覆盖原始异常。

## Presentation CSS

`css/v4.7.0.css`保留历史motion基础；`css/v4.7.1.css`继续承载Pop/LetterRail/Modal视觉修订；`css/v4.7.2.css`为runtime-only marker，无新增视觉参数。
