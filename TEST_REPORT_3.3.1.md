# Vocabulary Index 3.3.1 测试报告

测试日期：2026-08-02

## 1. 工作副本自动测试

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
performance-tests: OK (27.3ms / 25 searches; 2234.7ms collection preflight)
```

另行完成：

- 所有 `js/*.js` 和 `tests/*.mjs` 执行 `node --check`；
- `git diff --check`；
- `css/v3.css` 与 `css/v3.3.1.css` 使用 `tinycss2` 完整解析；
- Seed 业务语义比较；
- Service Worker 预缓存资源存在性和去重检查。

## 2. 3.3.1 专项覆盖

### 虚拟总表与位置

- 全局虚拟词表作用域固定为 `global`；
- 全局词汇／短语位置读写键对称；
- 位置去重包含 Collection、模式、分区和 Entry；
- 全局代表 Entry 变化时可按规范英文重映射。

### 数据完整性

- 清理失效 Entry StudyStamp；
- 清理没有聚合内容的 Global StudyStamp；
- 重命名迁移全局日期键；
- 系统短语表 VIX 替换不留下孤儿 Membership；
- 替换计划经 `canonicalizeBackup()` 和 `validateBackup()` 验证。

### 关系

- 关系目的地只接受 `visibleEntryIdsByCollection` 中真实可见的普通表；
- Seed 中 `access` 的关联短语均能解析到实际普通表目标；
- 二级文字复制与内部跳转保持分离。

### 标注与 AI

- 当前词表和全局全部撤销存在；
- Annotation 使用局部 `commitChanges`；
- `replaceAnnotations` 热路径不调用 `backupFromState()`；
- iPhone Review 的编辑和逐条撤销控件由最终 CSS 恢复；
- AI 批次支持 Entry 快照和 Revision 校验。

### 高危操作

- 存在不可跳过的“下载备份／不下载”选择；
- 两个选择都会继续；
- Seed、恢复、替换和删除路径均有后续实际确认；
- 增量 VIX 合并不进入高危备份选择；
- 不存在旧复选框或确认文字许可门槛。

### UI 结构

- 首页固定顶栏使用显式 Grid Area；
- 序号、主体和关联轨道独立；
- 返回顶部位于固定导航工具区；
- 固定顶部表面不使用模糊或半透明透底；
- 长文本具备起点／中段／末端渐隐状态；
- Review 控件、关系方向和二级跳转使用统一图标缓存。

## 3. Seed 一致性

3.3.0 与 3.3.1 的 `data/seed.json`：

- 仅 `appVersion` 从 3.3.0 改为 3.3.1；
- 删除 `appVersion` 后对象完全一致；
- 规范化 SHA-256：

```text
c223f2f363a60b9580ad9e95dbafb57525570924a56a653c0707a75dec2fe5c8
```

保持：

- Schema 4；
- Seed revision 3；
- 6,126 Entry；
- 8,072 Membership；
- 1,312 PhraseToken。

## 4. 外部集成

Oxford URL 构造测试通过。

ChatGPT 协议保持：

```text
shortcuts://run-shortcut?name=AI查询&input=text&text=...
```

JSON、URL 编码和反解测试通过；最大代表 URL 为 33,726 字符。该测试不证明 iOS Shortcuts 或 ChatGPT App 会接受全部长度，也不证明用户快捷指令已正确绑定输入。

## 5. 环境限制

自动测试不能代替真实 iPhone standalone PWA。以下仍列入人工清单：

- 状态栏和灵动岛视觉；
- 键盘／Visual Viewport；
- Oxford／ChatGPT 返回；
- 横滑与纵向滚动手势竞争；
- 多覆盖层组合；
- iOS 系统级缩放；
- 惰性块在大量展开关系下的视觉稳定性。

## 6. 完整包复测

预交付 ZIP 已重新解压到全新目录：

- `sha256sum -c SHA256SUMS.txt`：全部通过；
- `run-tests`：通过；
- `static-tests`：通过；
- `stress-tests`：通过；
- `integration-tests`：通过；
- `performance-tests`：通过（44.8ms / 25 searches；2235.8ms collection preflight）。

最终包在更新本报告、文件清单和校验表后再次生成，并再次执行校验与分组测试。
