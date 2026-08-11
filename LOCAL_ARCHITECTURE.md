# Vocabulary Index 4.7.3 本地架构

## Data

Schema6 / IndexedDB5 / Seed4 / VIX2。业务数据与runtime navigation/presentation/scroll/virtual state分离。

## Single-Slot Navigation

当前继续使用4.7 `single-slot-vix-v1`：Browser session history只保留一个VIX root slot；内部页面由`navigationStack`保存live recursive Collection frames；Back直接POP，Home直接clear；kill/reopen从Home开始。

**生命周期更正**：4.6的`destructive-v3`冻结属于当时版本作用域；4.7在此前Safari visual/history rail问题链上继续解耦并建立Single Slot。4.7.3将Single Slot视为已继承现行架构，而不是待用户裁决事项。

## Presentation Intent Queue

`enqueuePresentationIntent()`串行化Collection navigation、Back、Home、Word/Phrase与Alphabet/Date toggle。Promise tail在前一任务reject后仍可继续；View/Mode目标在实际执行时读取current state。

## Atomic Visual Commit

`runAtomicCollectionCommit()`替代4.7.1/4.7.2的opacity buffer：

- stable Collection surface不fade-to-zero；
- update与首个authoritative position write尽量位于同一rendering opportunity；
- manual View/Mode仍服从TOP+collapsed；
- precise Entry target在render后先同步prewarm/restore，再只做必要settle；
- Mode durable persistence在target可见commit之后执行，不能成为视觉空窗。

Home使用`runRootCommit()`：root state先提交，再仅对Home/large-title执行非常弱的非零settle。

Home Global直接原子替换`.global-grid`，只允许0.97→1的轻settle。

## ScrollCoordinator

`js/v3-scroll-runtime.js`继续是唯一root-scroll ownership。Programmatic semantic target、Back restore、Sticky collapse、virtual materialize等都经coordinator/adapter提交；stale epoch write被拒绝。

## Semantic Transition Contract

- 手动Word/Phrase：目标view `TOP + collapsed`；Date下使用目标view自身calendar month；
- 手动Alphabet/Date：目标mode `TOP + collapsed`；Alphabet→Date使用目标section latest-valid-month；
- Same-Collection明确Entry target：跨view后只执行一次标准Entry semantic landing。

## Stable Relation Row

`renderEntryRow()`永久创建`.entry-relation-slot`。展开时只插入`.entry-relation-reveal > .relation-panel`并切换`relations-open`；收起先关闭slot再清child。Entry primary shell、文本viewport和操作按钮不重建。Relation toggle不启动root ScrollCoordinator correction。

## Bidirectional VirtualEntryList

42 Entry / 960px prefetch保留。Chunk生命周期：

`placeholder → materialized → parked → materialized`

`parkEntryChunk()`在退休前measure并写frame-local`virtualLayoutCache`；清空row DOM、保留Entry→chunk映射和等高min-height，再交回IntersectionObserver。`parkEntryChunksOutsideResidentWindow()`使用`max(1500px, 2.4×viewportHeight)`resident margin。

Programmatic semantic scroll约每72ms允许一次rolling sweep；transaction finish与user scrollend再次sweep。expandedLetters/expandedRelations不受DOM park影响。

## LetterRail

Alphabet semantic axis仍是真实flow-anchor的内部定位数学模型。LetterRail UI只有离散active cell；`cameraTargetForActiveCell()`使用38%–62%safe zone与hysteresis；manual drag lock规则保留。

## Modal / Sticky

4.7.1 retained Modal/inert/geometry/focus restoration、transparent interaction backdrop、`@starting-style`与快速exit保持。4.4 native Sticky collapse保持。

## Presentation CSS

`css/v4.7.0.css`保留历史motion基础；`css/v4.7.1.css`承载Pop/LetterRail/Modal修订；`css/v4.7.2.css`保留历史marker；`css/v4.7.3.css`只新增Relation slot与parked chunk生命周期规则。
