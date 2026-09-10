# Vocabulary Index 3.2.0 变更报告

## 版本性质

3.2.0 是 iPhone 主屏幕 PWA 专项的前端、交互与性能收敛版本。数据库 Schema 4、Seed revision 3、词汇内容、短语分类和外部查询协议均不改变。

## 用户界面

- 删除首页重复的英文眉题与“我的词表”大标题；
- 首页顶栏副标题只显示全局词汇数；
- 管理与待核查入口并入全局标题行；
- 卡片计数改用系统无衬线字体并降低字号；
- 普通表 `N 词 · M 短语` 强制保持单行；
- 全局与域内系统总表增加低强度侧向渐变光晕；
- 系统总表列表页延续淡侧光；
- 一级表项改成“文本信息行＋操作行”；
- 英文取消任意断字，超长内容使用省略；
- 繁体释义获得独立可读宽度；
- 所有一级操作按钮保持 44×44 触控区域；
- 顶栏返回和搜索改用统一 SVG；
- 删除触控环境下隐藏 `:focus-visible` 的旧规则。

## 性能

- 长列表按 42 行分块，接近视口时再渲染；
- 跳转目标所在块可立即物化；
- SVG 图标只解析一次，后续克隆缓存模板；
- 未展开条目只判断是否存在关联，不构造完整目的地；
- 滚动位置优先通过 `elementFromPoint` 采样；
- 滚动 UI 更新进入 `requestAnimationFrame`；
- 支持 `scrollend` 时只在结束后保存位置；
- Store 预建各视图可见 Entry ID 集合；
- sticky 层取消实时背景模糊；
- 返回顶部使用即时滚动。

## iOS PWA

- 识别 standalone 模式并添加根节点状态类；
- 增加 `format-detection=telephone=no`；
- 关闭 Safari 文本自动缩放漂移；
- 输入控件至少 16px，避免聚焦放大；
- 后台恢复时检测异常 viewport 宽度并进行防御性修复；
- Service Worker 使用 3.2.0 独立缓存；
- 缓存升级桥与实际缓存名保持一致。

## 数据与兼容

- IndexedDB DB version：4；
- Backup schemaVersion：4；
- builtInSeedRevision：3；
- `data/seed.json` 仅更新 `appVersion`；
- 不迁移 Entry、Membership、PIN、标注、学习日期或视图状态；
- Oxford 与 ChatGPT 快捷指令集成保持 3.1.1 行为。
