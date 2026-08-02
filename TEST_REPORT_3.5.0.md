# Vocabulary Index 3.5.0 测试报告

## 测试对象

- App version：3.5.0
- Backup schema：5
- IndexedDB DB version：4
- Seed revision：3
- VIX version：1
- 测试目录：最终 ZIP 全新解压副本

## 自动测试结果

各测试套件在独立进程中执行并通过：

```text
run-tests: OK
static-tests: OK
stress-tests: OK (126 entries, 156 memberships, 45 study stamps)
integration-tests: OK (largest tested URL 30636 chars)
performance-tests: OK (26.8 ms / 25 searches; 2249.6 ms collection preflight)
```

本次容器内实测进程时长：

```text
run-tests                 17.84 s
static-tests               0.07 s
stress-tests              12.73 s
integration-tests          1.25 s
performance-tests          4.55 s
```

`npm run test:all` 的各前置套件均能通过；该串行总命令在当前受限执行容器中会在最后一套测试前后触发整条命令的总资源／时限限制。因此最终验收证据采用五套测试分别启动、分别完成。源码中的 `test:all` 命令仍保留。

## 语法与格式

- `node --check js/*.js tests/*.mjs`：通过；
- 全部 JSON 与 `manifest.webmanifest` 解析：通过（14 个文件）；
- 全部 CSS 使用 `tinycss2` 解析：通过；
- HTML ID 唯一性、相对 ES Module 依赖和 Service Worker 预缓存资源：由 static-tests 验证通过。

## 定向覆盖

3.5.0 新增或强化了以下自动检查：

- 普通词表词汇优先级占有及优先级重排后的归属变化；
- 普通表词汇／短语独立视图和 section 级模式／位置键；
- 五项底部工具栏与系统表禁用切换；
- 应用内部页面快照和返回栈结构；
- 字母栏无 smooth 追赶、A/# 端点和真实 sticky 标题；
- 序号正文前置、来源域边框副字、可选日期及无右侧关系轨道；
- 查询总入口图标保持，Oxford／ChatGPT 弹窗选项独立图标；
- PIN／标注底部不透明直角停靠栏；
- iOS 弹窗 body 固定和 touchmove 边界锁；
- 范围优先搜索；
- 三态关系跳转和扁平目标菜单排序；
- AI Abort、人工标注保护和聚合历史；
- 导入 Revision 防护及增量恢复事务等待；
- Schema 5、DB 4、Seed 3 与完整交付文档契约。

## 静态移动端几何抽样

使用 390×844 的 Chromium 静态 DOM/CSS 模型检查全部历史 CSS 层叠后的最终几何：

- 顶栏：52 px；
- 字母栏：53 px；
- 字母小标题：48 px；
- 无释义一级表项：49 px；
- 有释义一级表项：58 px；
- 短语主行：62 px；
- PIN 停靠栏：49 px；
- 底部工具栏：58 px；
- 无日期条目不保留日期列；
- 五控件条目在 390 px 视口仍保留可用正文区域；
- 冲突来源副字增加独立 7 px 顶边通道，不覆盖上一条目。

该检查只验证 CSS 层叠与静态尺寸，不等同于真实应用浏览器运行测试。

## 仍未由自动测试证明

必须按 `tests/MANUAL_CHECKLIST.md` 在真实 iPhone 主屏幕 PWA 复验：

1. sticky 小标题推出、点击折叠和 iOS 滚动锚定；
2. 惯性滚动中的 Chunk 物化与关系展开；
3. 字母栏触控拖动和即时跟随；
4. 固定／可滚动弹窗的滑动边界；
5. PIN／标注停靠栏与安全区、键盘、最后一行；
6. 内部返回栈、iOS 边缘返回和同页跳转；
7. Oxford／ChatGPT 外部返回；
8. Service Worker 从 3.4.0 的真实缓存升级；
9. VoiceOver；
10. 3.4.0 灾难录屏路径的完整对照录屏。
