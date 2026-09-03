# Vocabulary Index 5.0.0-alpha.3 迁移说明

## 自动迁移

本版本保持 Schema 6、IndexedDB 5 和 VIX JSON 2，不要求清空或重装 PWA。Built-in Seed revision 从 5 升到 6。

启动时如果设备仍是 revision 5，VIX 会以 Seed4 为共同祖先执行“基础 Seed → 当前设备 → revision 6”三方合并：

- 添加新的计算机术语与通用英语搭配；
- 保留用户新增词域、词表、词条和 Membership；
- 保留用户对内置记录的字段修改与明确删除；
- 保留 PIN、标注、学习日期和有效页面位置；
- 写入前创建独立迁移快照，失败时不提交半成品。

Service Worker cache generation 已更新。部署后已安装的 PWA 会先提示新版本，确认更新或彻底关闭后再次打开即可进入 alpha.3。

## Cloudflare

Worker 名仍为 `vix-5-alpha2`。继续使用同一个 GitHub 集成、Access Application、Durable Objects 和 `COLLINS_ACCESS_KEY` Secret；无需新建 Worker 或重复填写 Secret。

本版本的 `wrangler.jsonc` 已固定现有 Team domain 和 Audience，并关闭 preview URLs。上传到原仓库后由现有 Cloudflare Git 集成重新构建即可。

## 回滚

不要直接用 4.7.3 覆盖已经运行 Schema 6 的站点作为数据回滚。需要回滚时先导出完整备份，在隔离站点验证旧版本是否能读取，再决定是否切换部署版本。
