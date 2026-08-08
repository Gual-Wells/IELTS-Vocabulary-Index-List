# Vocabulary Index 4.0.1

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.0.1 延续 4.0.0 的内容世代与全部业务语义，专门收口 iPhone 真机暴露的 Sticky、Modal Stack、长内容和管理窗口体验。

## 当前正式边界

- 版本：`4.0.1`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX：`2`
- 主目标设备：iPhone 17 标准版，Safari 添加到主屏幕
- 数据：IndexedDB，本地优先；Service Worker 离线外壳
- 不包含账号、云同步、学习计划、Dashboard、streak 或后端服务

## 核心语义

1. **Domain** 分 `structured` 与 `nonStructured`，创建后 `contentMode` 不可变。
2. **Entry** 分 `word | phrase | content`。PIN、学习日期、标注、查询和关系都绑定具体 Entry；跨域同形条目不共享个人状态。
3. **Membership 是来源事实，Projection 是可见归属。** word、phrase、content 全部使用普通 Collection 优先级占有：可保留多个 Membership，但只在最高优先级普通表中可见。
4. 系统总表始终是投影，不拥有独立 Entry 状态，也不接受直接写入。
5. 搜索允许模糊召回；关系只使用精确、确定性的结构匹配，两者完全解耦。
6. 原始关系图始终全局、精确、双向完整；Domain “不参与关联”和“关闭低级词汇关联”只做逻辑过滤，不删除原始边。
7. 关系导航按当前有效目标集合分类：域内唯一、域外唯一、非结构唯一、多目标；多个目标不再被旧“同域优先”过滤。
8. 从首页 fresh 进入词表总是字母模式、顶部、全部收起；结构化普通表有词汇时优先词汇视图。只有真实递归返回恢复离开前快照。

## 首页与非结构内容

首页全局区默认显示“全局词汇 / 全局短语”，可临时切换到“全局非结构内容”；这个切换不持久化。内置非结构 Domain 名为 **通用英语搭配**，当前包含句型、语法框架、模板表达、语篇标记四个普通内容表。非结构页面复用同一浏览外壳，不相关的词汇/短语布局按钮保留位置但禁用。

## 查询 Provider

一级 Entry 查询菜单固定顺序：

**Oxford → Collins → Groq → ChatGPT**

- Oxford：只发送英文纯文本到 Oxford App URL scheme。
- Collins：本机保存 API Key；优先直接 Collins REST API，CORS/网络不可用时提供 Collins 网站降级入口。
- Groq：使用当前设置模型，返回临时核查卡，不自动写入 Seed/Entry。
- ChatGPT：继续调用 iOS 快捷指令 `AI查询`，发送紧凑 `vix-entry-context` v2；不再附带 PIN、日期、标注、全量 Membership 或原始关系组件。

## iOS 运行时收口

- 普通非编辑文本默认不可原生选中/Callout；编辑控件恢复原生选择。浏览锚点继续 520ms + 350ms invisible grace。
- 字母真实 heading 回归普通文档流；单一 `sticky-letter-heading` 展示当前字母，active section 由预计算 metrics + 二分定位，ResizeObserver 处理惰性渲染/展开后的高度变化。
- 应用级 form/action 使用 retained modal stack：父层保留真实 DOM，子层新增轻 backdrop 并将父层 inert；关闭只 pop 顶层。Settings/管理词库/action 使用受限管理高度，body 自滚动。
- modal backdrop 先建立，card 稳定两帧后一次性 reveal，避免首帧闪现；全屏 Modal Host 覆盖 safe-area，状态栏保持 `default` 以适配浅色常态页面。
- content Entry 补齐 normal/two-line/extreme 长文本；繁体/来源 secondary line 更紧凑。
- 查询菜单显示 Provider 副字；只重绘 Oxford/ChatGPT，使其与现有 Collins/Groq 协调。
- 底部工具栏保持 58px；PWA Home Screen 继续使用自有 `V`。

## 数据世代与兼容

4.0.0 建立的硬断代继续有效。旧 VIX v1 和旧 Full Backup 不导入 4.0.1。已安装的 3.5.x 首次升级会先提供旧完整备份选项，再确认全量替换内容世代；旧内容、自建内容以及内容绑定状态被清除，API Key、模型选择和一般显示偏好保留。

## 当前 Seed

当前包内 Seed 经过 Schema/引用/关系校验：

- Domain：3
- Collection：17
- Entry：6176（5539 word / 587 phrase / 50 content）
- Membership：7574
- Relation component：1240

当前内置通用英语仍以本地可验证的 A1/A2/B1/B2/C1/AWL 为完整来源基线；计算机术语保留并按新模型重建；“通用英语搭配”提供 50 项非结构 starter content。当前工作包也没有可直接用于正式重建的清洁通用英语中文释义源，因此 5,005 个通用英语 Entry 暂不伪造 `glossHant/glossSource`。NAWL、CET、TEM、COCA 的候选方向保留在数据生命周期 backlog 中，但当前交接包没有可直接复用且质量达标的原始本地源，因此本版没有伪造或用旧人工扩容表冒充正式数据。详见 `DATA_REPORT.md`。

## 开发与验证

```bash
npm run test:all
```

测试覆盖模型、VIX v2、硬断代、优先级占有、精确对称关系、搜索、运行时符号、压力、Provider 上下文、性能与 402×874 布局合同。自动测试不等同于真实 iPhone standalone 验收；最终真机清单见 `tests/MANUAL_CHECKLIST.md`。

## 现行规范入口

- `REQUIREMENT_BASELINE_4.0.1.md`
- `SEMANTIC_IMPACT_MATRIX_4.0.1.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.0.1.md`
- `PRODUCT_MANUAL_4.0.1.md`
- `PROJECT_HISTORY.md`

`PREUPDATE_ROADMAP_2026-08-04.md` 仅保留为历史决策来源；原 3.6.0/4.0.0 暂定分版本路线已被本版统一基线取代。
