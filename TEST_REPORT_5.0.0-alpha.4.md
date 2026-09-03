# Vocabulary Index 5.0.0-alpha.4 测试报告

## 自动验证结果

- 核心模型、投影、关系、导入导出与数据交换：通过。
- Provider、Collins Bridge、Cloudflare Access、Mirror、Session 与 Durable Objects：通过。
- Seed 6 到 Seed 7 三方迁移及用户编辑、删除、PIN、标注、学习状态保留：通过。
- Seed runtime 分片重组、字节长度与 SHA-256 篡改拒绝：通过。
- 管理词库拖动边界、草稿排序、取消不提交、保存时单事务提交：通过。
- iPhone 视口布局与拖动交互：真实 Chromium 402×874 通过。
- Cloudflare Wrangler 4.128.0：`deploy --dry-run` 通过，未执行线上部署。

## 当前数据规模

- 23,917 Entries。
- 61,905 Memberships。
- 20,793 Relation Components。
- 1,583 个计算机术语条目。
- 595 个通用英语搭配条目。
- 2,303 个由当前 Seed A1/A2 自动生成的低级词汇关系项。

Service Worker 预缓存 49 个入口资源，其余 Seed runtime 分片在安装时按 manifest 加载并校验。构建来源、测试、工具、完整审计 Seed 与报告均由 `.assetsignore` 排除，不进入 Cloudflare 静态资产。
