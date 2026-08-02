# Vocabulary Index 3.4.0 测试报告

## 测试对象

- 版本：3.4.0
- Backup schema：5
- IndexedDB DB version：4
- Seed revision：3
- 运行环境：Linux 容器、Node.js（交付构建环境）
- 测试基准：完整工作目录；最终 ZIP 另在全新目录重新解压复验

## 自动化测试结果

### `npm test` / `tests/run-tests.mjs`

结果：`OK`

覆盖重点：

- Schema 3/4/5 迁移与规范化；
- 具体 Entry StudyStamp；
- 跨域同形词与短语的全局多行投影；
- 唯一规范文本计数；
- 独立域顺序变化；
- 日期冲突合并；
- PIN、Annotation 与位置引用；
- VIX 歧义裸键跳过和问题报告；
- 搜索范围；
- 序号基础规则。

### `tests/static-tests.mjs`

结果：`OK`

覆盖重点：

- 版本与 Schema 常量；
- Service Worker 资源；
- 3.4.0 CSS 加载；
- PIN 具体 Entry 语义；
- 范围优先搜索守卫；
- AI Abort、单任务历史和快照校验；
- 导入 Revision 守卫；
- 三态跳转与多目标菜单；
- 脏 VIX Membership 处理；
- 动态字母和视觉规则存在性。

### `tests/stress-tests.mjs`

结果：`OK`

本次工作目录输出：

```text
126 entries, 156 memberships, 45 study stamps
```

验证大批量随机/组合状态经过规范化、投影和迁移后保持约束。

### `tests/integration-tests.mjs`

结果：`OK`

本次工作目录输出：

```text
largest tested URL 30636 chars
```

覆盖完整备份、VIX、导入计划、外部查询上下文和大 URL 组合。

### `tests/performance-tests.mjs`

结果：`OK`

本次工作目录测量：

```text
25 searches: 27.3 ms
collection preflight: 2220.9 ms
```

性能结果受共享容器负载影响，只用于版本内回归判断，不代表 iPhone 绝对耗时。

### 最终 ZIP 全新解压副本

发布候选源码在两个全新目录重新解压后，五组测试均再次通过。两次独立性能运行区间：

```text
25 searches: 25.7–27.4 ms
collection preflight: 2301.2–2473.9 ms
```

该区间反映共享容器负载波动；两次运行使用相同 3.4.0 代码。

## 语法与格式验证

- 所有 `js/*.js`：`node --check` 通过；
- 所有 JSON：完整解析通过；
- CSS：完整解析／括号结构检查通过；
- `git diff --check`：无空白错误；
- ZIP 完整性：最终打包后使用 `zip -T` 验证；
- SHA-256：最终包内使用 `SHA256SUMS.txt` 在全新解压目录验证。

## 3.4.0 新增回归项目

1. 全局词汇跨域同形多行；
2. 全局短语跨域同形多行；
3. 全局唯一总数与渲染行数分离；
4. 域重排只改变同形组内顺序；
5. 具体 Entry PIN／Annotation／StudyStamp 不迁移；
6. 连续、字母小标题和日期小标题编号；
7. 范围优先搜索；
8. 全局繁体释义搜索；
9. 三态关系目标；
10. VIX 歧义裸键跳过；
11. AI 过期结果保留旧标注；
12. AI Abort；
13. 单 AI 任务一条 Undo；
14. 导入计划 Revision 过期；
15. 零分区 0↔1；
16. PointerCancel 排序恢复；
17. 横滑状态；
18. 可见短语真实溢出升级。

## 自动化测试不能替代的项目

Node 测试无法证明以下真实设备行为：

- iPhone 安全区和动态顶栏像素；
- sticky 字母推出、点击折叠和滚动补偿；
- Safari 字体下的实际文字宽度；
- 触控横滑与纵向滚动冲突；
- 键盘、VoiceOver、Home Indicator；
- Service Worker 真实缓存升级；
- Oxford、ChatGPT 和快捷指令返回；
- iOS 长时间滚动的内存回收。

这些项目必须执行 `tests/MANUAL_CHECKLIST.md`。本报告不将未执行的真机测试标为通过。
