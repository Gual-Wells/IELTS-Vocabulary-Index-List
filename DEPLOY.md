# Vocabulary Index 5.0.0-alpha.7 部署

alpha.7 沿用固定 `vix-private` Worker、同一个 Access 应用和同一个 `COLLINS_ACCESS_KEY` Secret；从 alpha.6 更新时不需要重建或修改这些 Cloudflare 配置。

本版本使用固定 Worker 名 `vix-private`。完成一次迁移后，后续版本只需推送 GitHub；通常不再修改 Cloudflare 变量、Access 应用或 Secret。

## 一、删除旧的 alpha.2 配置

确认新包已经上传 GitHub 后再执行：

1. Cloudflare Zero Trust → Access controls → Applications。
2. 删除旧的 `VIX hostname access`。
3. 删除旧的 `vix-5-alpha2 - Cloudflare Workers`。
4. 返回主 Cloudflare 控制台 → Compute → Workers & Pages。
5. 打开旧的 `vix-5-alpha2` → Settings → Delete Worker。

不要删除 Zero Trust 账户、付款资料或 GitHub 仓库。若旧项目创建了仅供它使用的 API Token，可在新部署成功后再撤销；无法确认用途时不要删。

## 二、一次性创建稳定私域版

1. Workers & Pages → Create application → Import a repository / Connect to Git。
2. 选择 VIX GitHub 仓库。
3. 填写：
   - Project name：`vix-private`
   - Build command：`npm run build`
   - Deploy command：`npx wrangler deploy`
   - Path：`/`
4. 关闭非生产分支构建（除非确实需要预览）。
5. 打开 Protect with Cloudflare Access：
   - Scope：All traffic
   - Policy：Cloudflare account members / Allow
6. 点击 Deploy。

部署完成后，Access controls → Applications 中应当只有一个与 `vix-private` 对应的 Worker 应用。不要再额外创建 hostname 应用。

## 三、配置 Collins Secret

1. Workers & Pages → `vix-private` → Settings → Variables and Secrets。
2. Add variable，类型选 Secret。
3. Name：`COLLINS_ACCESS_KEY`。
4. Value：填写 Collins Key，保存并让 Cloudflare 完成配置部署。

仓库中的 `wrangler.jsonc` 已启用 `keep_vars`。未来 GitHub 自动部署不会清除此 Secret。

## 四、验收

先在浏览器访问：

```text
https://vix-private.<你的 workers.dev 子域>.workers.dev/api/health
```

登录 Access 后应看到：

```json
{
  "protocol": "vix-runtime-health/1",
  "version": "5.0.0-alpha.7",
  "status": "ok",
  "checks": {
    "assets": true,
    "collinsSecret": true,
    "usageLedger": true,
    "sessionStore": true
  }
}
```

再访问站点首页，设置中选择 Collins 词典并查一个常见词。若健康检查是 `ok` 但查询返回 `upstream_authorization`，说明 Cloudflare 已工作，问题只在 Collins Key 或该 Key 的词典授权。

最后用一个未登录的无痕窗口访问首页：必须先出现 Cloudflare Access 登录页，不能直接进入 VIX。

这是必要的安全验收。Workers Static Assets 的内部路由器会在 Worker 之前执行 Access，但不会把 `ctx.access` 继续传给 Worker；因此应用不能再用内部 401 判断 Access 是否存在。若无痕窗口可直接进入 VIX，应立即回到 Worker 的 Access 标签启用 All traffic，而不是继续使用私域功能。

## GitHub Pages

Pages 继续使用仓库根目录，不需要为私域版单独修改。它会自动识别为静态形态并隐藏 Collins；本地词库、Groq 和文件式 Mirror 仍可用。
