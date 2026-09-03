# Vocabulary Index 5.0.0-alpha.3 人工验收

目标设备：iPhone 17 标准版，Safari 添加到主屏幕后 standalone 运行。每项记录设备、iOS 版本、部署 commit、时间、结果和截图。

## 部署与安全

- [ ] 未登录 Cloudflare Access 时 Collins 与 Session 创建返回 401。
- [ ] `TEAM_DOMAIN`/`POLICY_AUD` 保持占位值时返回 503；伪造 `Cf-Access-Jwt-Assertion` 或错误 AUD 时返回 401。
- [ ] 登录后主屏幕 PWA 可重新打开，不循环登录。
- [ ] Network 中没有 Collins Key、`accesskey` query 或官方 Collins 域直连。
- [ ] 纯 GitHub Pages 上 Collins 明确失败，本地词库/Groq/Mirror 文件交换正常。
- [ ] 测试限额达到后，在上游请求前返回 429。

## Seed4 → Seed5

- [ ] 升级前建立自定义域、词表、词条、内置释义修改、内置词删除、PIN、批注、学习日期。
- [ ] 升级后以上状态符合三方合并规则。
- [ ] 可见 A1/A2/B1/B2/C1/C2/NAWL/COCA 5000/COCA 10000/CET 4/CET 6/TEM 4/TEM 8。
- [ ] 首次加载与离线重开完成分片重组；缺片时失败关闭，不写半套数据库。
- [ ] 升级后 Schema6 备份可再次导入。

## Mirror / Session

- [ ] Request Capsule 没有 Entry ID。
- [ ] 导入 Result 后产生 CURRENT；已开启的 ACTIVE 不热替换。
- [ ] 关闭再开启采用最新 CURRENT；有效空结果显示 0 条。
- [ ] hash、sequence、slot、expiry 任一不匹配均拒绝。
- [ ] read/write/owner capability 正确；write token 第二次失败。

## Provider

- [ ] Collins 设置只有两本固定词典，没有浏览器 Key 和“获取账号词典”。
- [ ] 两本词典各查一次；一次点击只产生一个上游请求。
- [ ] 404、授权失败、预算耗尽、上游 HTML/challenge、断网分别正确显示。
- [ ] Collins HTML 的 script、事件属性、危险 URL、外部图片不执行；关闭后不持久化。
- [ ] Groq 查词/核查、模型目录、取消、迟到响应丢弃正常。

## 4.7.3 交互回归

- [ ] 显示 `5.0.0-alpha.3`，Home Screen 名仍为 `Vocabulary Index`。
- [ ] Collection Push、Back Pop、Home clear 符合 single-slot。
- [ ] Word/Phrase、Alphabet/Date 切换得到 TOP + collapsed，无重叠或闪白。
- [ ] Same-Collection Search/Relation 只落位一次。
- [ ] Relation 展开不重建主行，收合不跳动 root viewport。
- [ ] A→Z 正确；远端 chunk 会 park，返回位置稳定。
- [ ] LetterRail 单一 active，camera 只越过 safe zone 时移动。
- [ ] retained Modal、Mirror 管理、设置、搜索在横竖屏和 safe-area 下不溢出。
- [ ] Reduced Motion 下仍原子提交，无 opacity 1→0→1 假缓冲。
