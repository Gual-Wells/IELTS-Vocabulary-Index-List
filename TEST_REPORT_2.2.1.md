# Vocabulary Index 2.2.1 自动核验报告

## 已执行检查

### 1. 纯模块回归测试

命令：

```bash
npm test
```

覆盖：

- 词汇规范化；
- 词表名称规范化；
- 词性解析、合并和排序；
- 全局归属和来源回落模型；
- 人工改名同步来源词形；
- Markdown/TXT/CSV/JSON 解析；
- 异常行和未闭合 CSV 引号；
- JSON 完整备份结构与关联验证；
- 规范化幂等性和未知字段删除；
- PIN 顺序规范化及缺失时间处理；
- 七份源文件完整解析；
- 5,005 个 seed 全局唯一词条；
- 每个词表、每个字母的 view model 行数；
- 默认全部收起和目标字母展开规则；
- Markdown/CSV 导出再解析往返；
- 50,000 词纯数据 view model 不变量；
- HTML ID、CSP、无内联事件和无动态 HTML 注入；
- 本地模块 import/export 链接；
- 图标尺寸；
- Manifest 和 Service Worker 相对路径；
- 云运行时代码不存在；
- 旧云设置清理迁移存在；
- 全部 JavaScript 语法检查。

结果：`All tests passed.`

### 2. JavaScript 静态类型检查

页面 ES Modules 使用 DOM 类型库单独检查；Service Worker 使用 WebWorker 类型库单独检查，避免 DOM/WebWorker 全局定义冲突。

结果：零类型错误。

### 3. 资源完整性

- Service Worker 预缓存清单共 22 个相对资源，全部存在。
- HTML 引用的 Manifest、图标、CSS 和入口模块全部存在。
- Manifest 图标路径全部存在。
- 图标尺寸：180×180、192×192、512×512。
- Service Worker 只清理 `gual-vocabulary-index-` 前缀缓存。

### 4. 数据核验

| 项目 | 结果 |
|---|---:|
| 原始记录 | 6,421 |
| 全局唯一词条 | 5,005 |
| 初始词表 | 7 |
| AWL 独占 | 53 |
| AVL 独占 | 0 |
| seed normalizedWord 重复 | 0 |
| 无来源词条 | 0 |
| 空词性词条 | 0 |

## 自动测试不能覆盖的部分

- 未安装可用的 IndexedDB Node 模拟器，无法在 Node 中执行真实 IDB 事务端到端测试；事务逻辑通过静态审计、模块检查和浏览器侧防护设计核验。
- 当前受管 Chromium 即使访问简单本地页面也不可用，因此没有浏览器自动化结果。
- 没有 iPhone Safari 真机执行环境。

这些限制已在交付结论中明确保留，不将其描述为“真机通过”。
