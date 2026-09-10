# Vocabulary Index 3.5.2 测试报告

- 测试日期：2026-08-04
- 直接基线：3.5.1 Clean Rebuild
- 基线 ZIP SHA-256：`66a43ed0dc2f83cc789e6003b96b21bea1cecf8672a0f36ac7ed1d03ada9cd38`
- 数据契约：Backup Schema 5 / IndexedDB 4 / Seed revision 3 / VIX 1（均未改变）

## 1. 自动测试结果

在工作目录完成全套测试，并对预封装 ZIP 解压到全新目录后再次执行。最终正式 ZIP 亦按相同命令重新解压复验。

| 命令 | 工作目录 | 全新解压目录 | 主要观测 |
|---|---:|---:|---|
| `npm test` | 通过 | 通过 | 模型、迁移、投影、事务和状态测试通过 |
| `npm run test:static` | 通过 | 通过 | 版本、资源、文档、CSS/JS 静态契约通过 |
| `npm run test:runtime` | 通过 | 通过 | 关键运行时函数、未定义符号和防截断契约通过 |
| `npm run test:stress` | 通过 | 通过 | 126 Entries / 156 Memberships / 45 Study Stamps |
| `npm run test:integrations` | 通过 | 通过 | 最大测试 URL 30,636 字符 |
| `npm run test:performance` | 通过 | 通过 | 工作目录：25 次搜索 27.3ms，词表预检 2581.8ms；预封装解压：26.3ms / 2840.5ms |
| `npm run test:layout` | 通过 | 通过 | Entry 四组合、底栏、Dialog 和 sticky 布局契约通过 |
| `sha256sum -c SHA256SUMS.txt` | — | 通过 | 完整源文件校验通过 |

## 2. 3.5.2 新增／更新契约

### 页面状态

- 词汇／短语普通切换删除目标页快照恢复；
- 字母／日期普通切换删除 Entry 映射；
- 两类切换均进入顶部、全部分组收起；
- 返回快照包含 `mode`、`calendarMonth`、`expandedGroups`、关系和滚动；
- 搜索、关系、PIN、学习日期和浏览锚点仍展开目标组并定位。

### 运行时与布局

- 日期和“未标注”标题可折叠；
- 长按保存只在 `pointerup` 显示结果，并清理 Selection；
- `pointercancel` 不弹成功 Toast；
- 字母轨道采用人工锁，无 180/205ms 固定回弹；
- 一级表项无隐藏繁体占位，序号／词汇栈／控件栈独立居中；
- 繁体释义与来源使用相同次级行指标；
- 底栏高度为 58px，禁用按钮容器不透明且结构线不变；
- Dialog 根层覆盖完整 Layout Viewport，卡片使用 VisualViewport 几何；
- Manifest、Service Worker Cache 和最新 CSS 版本一致。

## 3. 数据与功能防退化检查

自动测试确认本版没有改变：

- Entry、Membership、PhraseToken 和 Seed 实体内容；
- 词汇优先级占有与短语 Membership 投影；
- 跨域同形具体 Entry 的个人状态隔离；
- Backup Schema 5、DB 4、Seed revision 3、VIX 1；
- Oxford／ChatGPT 现有集成协议；
- 3.5.1 既有关系发现与三态跳转语义；
- AI 核查、导入、完整恢复和 Undo／Redo 的数据契约。

3.6.0 搜索／查询 Provider 和 4.0.0 Seed／Domain／关系模型均未提前进入本版。

## 4. 未冒充完成的真机验收

当前执行环境不能替代 iPhone 17 standalone PWA。以下仍标记为待验证：

- 固定 58px 底栏是否与底部系统 Home 手势发生误触；
- native `<dialog>` 是否在真实 iOS 中完全消除底部白带和首帧抖动；
- 字母轨道人工锁在 A/#、惯性滚动和橡皮筋回弹中的解除时机；
- sticky 标题在状态栏、更新 Banner 和实际设备像素取整下是否零缝隙；
- 长按 20 次是否完全不再触发 iOS 文本选择；
- 外部 Oxford／ChatGPT 返回、后台恢复和 Service Worker 升级生命周期。

真机验收依据：`tests/MANUAL_CHECKLIST.md`。

## 5. 判定

3.5.2 已通过源码、静态、运行时、压力、集成、性能、布局和全新目录校验，可作为第一次预更新的正式候选交付。是否进入 3.6.0 或 4.0.0，必须等待本包真机验收结果。
