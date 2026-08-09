# Vocabulary Index 4.4.0 本地架构

## 1. 总览

Vocabulary Index 是静态 GitHub Pages / Home Screen PWA。业务数据库完全本地化；4.4 不改变 Schema6 / DB5 / Seed4 / VIX2。

主要模块：

- `js/v3-db.js`：IndexedDB、备份/恢复、Settings 持久层。
- `js/v3-store.js`：业务状态、Projection、Mutation、runtime view hydration。
- `js/v3-model.js`：canonical model / relation / backup normalization。
- `js/v3-ui.js`：页面渲染、Sticky、Navigation、Presentation。
- `js/v3-runtime-geometry.js`：可单测的 Sticky collapse 几何纯函数。
- `js/v3-navigation-runtime.js`：可单测的 destructive-v2 destination classifier。
- `js/v3-integrations.js` / `v3-ai.js`：Oxford/Collins/Groq/ChatGPT。
- `css/v4.4.0.css`：4.4 runtime correctness 覆盖层。

## 2. 数据 ownership

Domain / Collection / Entry / Membership / RelationComponent / Pin / Annotation / StudyStamp / Settings / UndoRedo 语义不变。系统总表仍为投影，不拥有写入身份。

## 3. View state

- alphabet/date：Collection-level。
- scroll/expanded/calendar/browse anchor/recursive snapshot：具体 viewKind。
- Back restore：snapshot 先同步 hydrate 到 Store memory，再 render；持久化延后。

## 4. Sticky runtime

每个 collapsible section：

`section-flow-anchor → native sticky heading → optional body`

flow anchor 是 natural geometry source-of-truth。`computeStickyCollapseTarget()` 输入真实 rect/body/document metrics，输出 targetY/delta/postCollapseMaxY。

长位移时：

`old layout → root scroll settle → body collapse`

支持 View Transition 的目标机用其 rendering suppression 隐藏中间状态；没有产品动画。

## 5. Navigation destructive-v2

### 5.1 VIX logical stack

`navigationStack = [{token, snapshot}, ...]`

VIX owns PUSH / destructive POP / HOME CLEAR。

### 5.2 Browser transport

Browser state 只存 immutable identity：`vix/navModel/generation/navToken/routeKind/depth`。`depth` 只诊断；token 才是 frame identity。

- snapshot persistence 不 rewrite history state；
- legal Navigation API Back 通过 destination state 分类；
- stale/Forward pre-commit reject；
- Home 建新 generation root PUSH；
- browser history 不再被假设与 VIX depth 一一同构。

## 6. Presentation families

- Popover：Query / Relation Target。
- Modal：Settings / Manager / Action / Search / Confirm / Provider，retained stack。
- Dock：PIN / Review。

4.4 Modal 不拥有 root document geometry：不改 html/body overflow，不重算 background Sticky vars。root `#app.inert` 仍用于 modality；若真机证明其 compositor 组合异常，才进入 custom modality fallback。

## 7. Layering

4.3 permanent `navigation-underlay` 已删除，whole-app stacking context 已撤销。html/body canvas 是永久安全底色；fixed Topbar/Dock/Popover/Modal 各自按已有 z-index 层级工作。

## 8. PWA/cache

4.4 使用独立 SW cache generation `v4.4.0-runtime-correctness-20260810-1`；数据世代不变。
