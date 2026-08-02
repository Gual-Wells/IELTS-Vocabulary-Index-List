# Vocabulary Index 3.3.0 测试报告

测试日期：2026-08-02

## 1. 自动测试结果

执行：

```bash
npm run test:all
```

结果：

```text
run-tests: OK
static-tests: OK
stress-tests: OK (126 entries, 156 memberships, 45 study stamps)
integration-tests: OK (largest tested URL 33726 chars)
performance-tests: OK
工作副本：25.8ms / 25 searches；2527.9ms collection preflight
首次 ZIP 解压副本：26.9ms / 25 searches；2677.2ms collection preflight
```

所有 JavaScript 文件另行执行 `node --check`，全部通过。

CSS 使用 `tinycss2` 完整解析，未发现语法错误。

## 2. 3.3.0 专项静态断言

覆盖：

- HTML、模块、manifest、package 和 Seed 的 3.3.0 版本一致；
- viewport 包含 `maximum-scale=1`、`user-scalable=no` 和 `viewport-fit=cover`；
- 固定安全区顶部、滚动大标题和 standalone viewport 防御存在；
- Visual Viewport 同时使用高度、`offsetTop` 和 `offsetLeft`；
- 弹窗不再使用 `body position: fixed` 锁滚动；
- 表单与搜索窗口默认不聚焦输入框；
- 首页位置恢复状态、首页标注警告条和全局撤销存在；
- 一级表项使用固定主体＋固定关联轨道；
- 关联附着件使用统一 `disclosure` SVG 并通过状态旋转；
- 一级行只有日期刷新、PIN、查询、更多四个高频槽；
- 普通词汇和繁体释义共享横向滚动区；
- 短语存在普通、两行和极限三类布局；
- 极限短语功能区只按实际节点数分配；
- 被标注条目点按进入审阅；
- 当前词表与全局标注撤销存在；
- Oxford／ChatGPT 使用双图标锚定菜单；
- 固定工具区和横向字母轨道分离；
- 标题与条目使用不同的跳转定位函数；
- PIN 与标注审阅使用覆盖层；
- 返回顶部在词表中常驻；
- Seed 重置、完整备份恢复和 VIX 完整替换均先下载当前状态备份，再打开确认窗口，且无复选框许可门槛；
- 42 条分块、关系索引、SVG 缓存和搜索合并仍然存在；
- 分块高度按普通行、两行短语和极限短语分别估算。

## 3. 数据一致性

对 3.2.0 与 3.3.0 的 `data/seed.json` 进行规范化比较：

- 3.2.0 `appVersion`：3.2.0；
- 3.3.0 `appVersion`：3.3.0；
- 删除 `appVersion` 后，两份 Seed 完全一致；
- 规范化 SHA-256：

```text
c223f2f363a60b9580ad9e95dbafb57525570924a56a653c0707a75dec2fe5c8
```

Schema 4、Seed revision 3、6,126 个 Entry、8,072 个 Membership、1,312 个 PhraseToken 和全部业务内容保持不变。

## 4. 性能结果解释

### 搜索

25 次代表性搜索在工作副本耗时 25.8ms，在首次 ZIP 解压副本耗时 26.9ms。测试仍验证搜索热路径不调用 `backupFromState()`。

### 词表导入预检

代表性普通词表 VIX 预检在工作副本耗时 2527.9ms，在首次 ZIP 解压副本耗时 2677.2ms，均低于现有测试阈值。

### UI 热路径结构

代码审计确认：

- PIN 和日期刷新使用局部事务和局部行替换；
- 查询菜单每次只创建两个选项；
- 文字横滑由浏览器原生滚动处理；
- 短语类型只在渲染时进行一次轻量估算；
- 关系内容只在展开后生成；
- 滚动期间不持续写入 IndexedDB。

## 5. 外部集成

### Oxford

URL 构造测试通过。

### ChatGPT

当前协议保持：

```text
shortcuts://run-shortcut?name=AI查询&input=text&text=...
```

JSON 构造、URL 编码和反解测试通过。代表性最大 URL 为 33,726 字符。

该结果不能证明 iOS Shortcuts 或 ChatGPT App 会接受全部长度；快捷指令动作的实际输入绑定需要用户在交付后真机调试。

## 6. 浏览器与真机限制

执行环境的 Chromium 管理策略禁止访问 localhost、file URL 和测试域，因此未能对完整 IndexedDB 应用进行真实浏览器端到端启动。已完成：

- 模型、迁移、导入、交换、集成和性能自动测试；
- JavaScript 语法检查；
- CSS 完整解析；
- 390px 与 420px 静态组件布局渲染检查。

以下不能据此声明已通过：

- 真实 iPhone Safari standalone 生命周期；
- 灵动岛和状态栏视觉；
- iOS 键盘与 Visual Viewport；
- Oxford／ChatGPT 返回；
- 手势横滑与纵向滚动竞争；
- 系统级缩放边界。

这些项目已列入 `tests/MANUAL_CHECKLIST.md`。

## 7. 完整包复测

首次生成完整 ZIP 后，已执行：

1. 解压到全新目录；
2. `sha256sum -c SHA256SUMS.txt`；
3. 在解压副本运行 `npm run test:all`。

校验与五组测试全部通过。最终交付包在更新本报告和校验清单后再次重新生成并复测。
