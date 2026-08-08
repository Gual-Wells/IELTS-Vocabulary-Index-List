# Vocabulary Index 4.0.1 测试报告

## 自动化结果

4.0.1 工作树与封包候选 fresh-extract 均已完成全链验证：

- `npm test`：PASS（6176 Seed Entry / 1240 RelationComponent）
- `npm run test:static`：PASS（24 precache resources；含 retained modal stack / sticky layer / content 三档 / checkbox / query chooser 合同）
- `npm run test:runtime`：PASS（关键运行时符号 + TypeScript checkJs）
- `npm run test:stress`：PASS（125 Entry / 158 Membership / 31 RelationComponent 压力样本）
- `npm run test:integrations`：PASS（max Shortcut URL 8042 chars @ `data`）
- `npm run test:performance`：PASS（容器数值仅作非规范参考；搜索、关系与 VIX preflight 均在既有门槛内）
- `npm run test:layout`：PASS（402×874 管理型 modal、row secondary line、58px toolbar、不可选文本合同）
- `npm run test:all`：PASS
- `sha256sum -c SHA256SUMS.txt`：PASS（封包候选 fresh-extract 全部受校验文件）

## 真机边界

自动化不能替代 iPhone 17 standalone。4.0.1 必须重点复核：字母栏零镂空、Sticky 即时响应、fling/橡皮筋、多层 Modal 保留父状态、弹窗无闪现、管理窗口四角完整、content 极长、顶部状态栏背景连续、长按无 iOS Selection/callout、查询菜单位置和 Provider 图标。
