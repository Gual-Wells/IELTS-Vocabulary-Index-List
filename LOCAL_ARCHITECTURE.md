# Vocabulary Index 4.1.0 本地架构

## 1. 架构目标

单设备、local-first、iPhone standalone PWA。架构优先保证数据身份、投影一致性、可恢复导航和低摩擦浏览；不为桌面、多端同步或服务端架构增加额外复杂度。

## 2. 模块

- `js/v3-model.js`：Schema 6 实体、规范化、投影、精确关系组件、搜索、校验。
- `js/v3-db.js`：IndexedDB 5、Seed 4、完整备份、硬断代内容世代替换。
- `js/v3-store.js`：内存状态、Projection、Raw/Effective Relation Graph、事务操作。
- `js/v3-ui.js`：Home/Collection shell、导航历史、Top Chrome 几何、单一 Sticky Heading Layer、retained Modal Stack、System Shell Surface Controller、longpress、搜索和 Provider UI。
- `js/v3-exchange.js`：VIX v2 导入/导出与预检。
- `js/v3-import.js`：文本/CSV/JSON 输入；拒绝旧世代 Full Backup。
- `js/v3-ai.js`：Groq 模型发现、批量 AI 核查、临时词汇查询。
- `js/v3-integrations.js`：Oxford、Collins、ChatGPT 紧凑上下文。
- `js/v3-upgrade.js`：4.0 cache bridge。
- `sw.js`：离线外壳与版本化缓存。

## 3. 数据身份与投影

`Domain → Collection ← Membership → Entry` 是内容事实链。所有 Entry kind 都执行普通 Collection 优先级占有。系统总表为虚拟投影；global 包括全局词汇、全局短语、**全局非结构总表**。稳定全局 content ID 仍为 `__global_all_content`。

## 4. 关系层

`RelationComponent → Raw Graph → Effective Graph`。Search fuzzy 与 Relation exact 完全分离；Domain relationExcluded 与低级词汇开关只做 Effective projection。

## 5. 导航与 History

Fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive return 恢复 collection/viewKind/mode/calendarMonth/scroll/expandedGroups/relation state。搜索/PIN/关系/浏览锚点属于显式 target jump。

## 6. Top Chrome / Sticky

- 基础 Top Chrome 从 `.topbar/.update-banner/.home-annotation-banner` 连续可见 DOM rect 实测；不再使用 VisualViewport + 固定 72px 的混合下限。
- `--sticky-base-top` = 基础 Chrome 底边；alphabet 下 `--content-sticky-top` = 基础边界 + 字母栏实测高度；date 下二者相同。
- `alphabetNavAttached()` 判断字母栏是否实际贴到 sticky base；只在 attached 后展示 `sticky-letter-heading`。
- section metrics + 二分查找继续用于 active section；同函数覆盖 global/domain/normal 与 word/phrase/content。
- 字母栏视觉结构属于每个 button cell，不属于 wrapper；disabled 只改变 glyph color。

## 7. Modal / System Shell

Custom application dialogs 使用 retained stack：父层 DOM 保留/inert，子层追加自己的 20% backdrop；第一层 backdrop 为 48%。

`syncSystemShellSurface(depth)` 用真实 backdrop alpha 做逐层合成：

- depth 0：`#fafafa`
- depth 1：`#8f8f8e`
- depth 2：约 `#787877`
- 后续继续按 20% 递推。

最终 surface 同步给 `meta theme-color`、root shell 和 fixed topbar/safe-top。Custom `.modal-layer-backdrop` 从实测 topbar bottom 以下开始，因此 topbar 只接收一次合成，不被实际 backdrop 二次加深。

Safari 26/WebKit 会参考贴近 viewport edge 的 fixed/sticky opaque surface 做 top tint；因此 topbar 与 theme/root 必须保持同一 shell signal。若 iOS 26.5.2 命中 viewport 外 system strip，Web DOM 无原生 UIKit status-bar API，真机仍可能受平台回归限制。

## 8. Entry / Provider / Input

- secondary Traditional gloss 与 source-domain 使用同一 bottom metric；4.1.0 进一步压缩 padding，不缩 44px action hit target。
- Query Provider 顺序固定 Oxford → Collins → Groq → ChatGPT；Collins/Groq 共享可取消 session。
- 非编辑文本默认不可选择；编辑控件显式恢复原生选择。
- 长按浏览锚点保持 520ms + 350ms grace。

## 9. PWA 生命周期

安装名称统一 `Vocabulary Index`。4.1.0 使用独立 SW cache generation，Schema/Seed 世代不变。PWA shell 元数据变化建议真机验收时重新添加到主屏幕。
