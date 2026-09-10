# 5.0.0-alpha.10.3 测试报告

## 自动测试

- Bridge：8/8 通过；覆盖 12 位以上 Master Key、Groq 保存前鉴权、AES-GCM 加密、写后解密、失败回滚、密钥指纹、Master Key 不匹配诊断与上游失败分类。
- Provider：6/6 通过；覆盖候选 Bridge 配置、Groq 模型目录返回、Master Key 不匹配阻止提交和错误透传。
- Mirror 3：4/4 通过；覆盖请求、结果、选择提交与 Context 同步。
- Seed5 迁移：5/5 通过；保留用户编辑、记录、删除和学习状态。
- 词库、关系、Runtime symbol、Runtime behavior、压力与集成测试：通过；23,917 条 Entry、20,793 个关系组件。
- 冷启动恢复：通过；首次导入在 9,027 条处中断，第二次恢复完成 23,917 条 Entry，恢复耗时 280,753 ms。
- 窄屏布局：通过；402×874 视口下 Bridge/Mirror 嵌套层可见，Oxford/Groq 查询菜单为两列紧凑宽度。
- 性能：25 次搜索 238.8 ms；关系查询 94.5 ms；完整 VIX Mirror 预检 4,798.5 ms。
- Pages allowlist 构建：通过。
- Wrangler dry-run：通过；19.36 KiB / gzip 5.36 KiB，识别 Durable Object 和固定 Pages origin。

## 真机验收项

- 在 Cloudflare 保留原三项 Secret，部署 Bridge 1.0.3。
- 若旧 Groq 密文由不同 Master Key 生成，在 VIX 的 Bridge 页重新填写一次 Groq Key。
- Bridge 保存成功后，设置页立即显示已连接、模型目录可选、Mirror 不再显示未同步。
- 词条查询按钮只展开 Oxford、Groq 两项，并完成一次 Groq 查询。
