# Bridge 配置事故复盘（2026-09-06）

## 现象

- Device Token 可以通过 `/v1/status`。
- 状态显示 Groq 已配置，但刷新模型返回 `Bridge 无法完成请求`。
- 新配置完成后 Mirror 仍显示未同步。

## 根因

1. Worker Secret 是 Worker 版本配置；Durable Object 中的 Groq 密钥信封和 Mirror Context 是独立持久状态，不随 Worker 版本部署或回滚。二者原先没有一致性标记。
2. `/v1/status` 只用 `Boolean(groqSecret)` 判断“已配置”，没有验证当前 `VIX_BRIDGE_MASTER_KEY` 能否解密，因此产生假阳性。
3. 旧密钥信封没有 Master Key 指纹。Master Key 缺失、被替换或版本错配时只能落入笼统 500。
4. PWA 先保存 Bridge URL/Device Token，再分别保存 Groq Key、刷新模型；后续失败会留下本机半配置。
5. Bridge 在当前会话中刚保存后没有立即上传 Mirror Context，自动同步只在应用初始化或后续数据变化触发。
6. 查询弹窗仍保留已删除 Collins/ChatGPT 后的四列网格，因此两项入口右侧空白。

## 修正

- Bridge 1.0.3 的 AES-GCM 信封增加非秘密 `keyId`；状态检查实际解密并报告 `ready`、`missing`、`master_key_mismatch` 或 `unreadable`。
- PWA 以表单中的候选 URL/Token 完成 status、Groq `/models` 和 Mirror Context 上传后，才提交本机配置并更新模型目录。
- Bridge 子页成功后主动更新父设置页，不再保留失效状态。
- 部署文档要求三个 Secret 一次配置、一次 Deploy；日常代码升级不得重建 Master Key。
- 查询弹窗按现存两个 Provider 收缩为两列。

## 恢复规则

升级 Bridge 时保留三个 Secret 的原值。若当前 Groq 记录已由旧 Master Key 加密或无法读取，在 VIX Bridge 页重新填写一次 Groq Key 并保存；新记录会绑定当前 Master Key 指纹。以后普通 PWA 或 Bridge 代码升级不需要再次填写。

Cloudflare 参考：[Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。
