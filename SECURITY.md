# 安全边界

- GitHub Pages 与公开仓库只发布 VIX 静态运行时和 Seed，不包含 Groq Key、Personal Mirror token、个人数据库快照或 MirrorFS 文件。
- Personal Mirror Site 使用仅所有者可访问的 ChatGPT Site 身份边界；D1 保存一份最新数据库快照及节点元数据，R2 保存 MirrorFS 文件正文。
- Site 页面中的用户文件操作由所有者会话发起；VIX 与 VIX Function 的写入接口必须携带配对后签发的 bearer token，并按协议和 capability 校验。
- ChatGPT 对 Mirror 内容的自动化访问保持只读；需要写入时由本地 `VIX-Function.ps1` 按 `vix-function/1` 与 `vix-mirror-service/1` 协议提交，不能绕过协议直接改库。
- Groq Key 只在 Site 内用 `VIX_GROQ_MASTER_KEY` 通过 AES-GCM 加密保存；主密钥、明文 Key 与 bearer token 均不写入前端、仓库或普通日志。
- VIX 数据交换文件与 Mirror 文件不包含 Personal Mirror 或 Groq 凭据。
- Personal Mirror 是个人最新真源，但不提供历史、墓碑或并发合并；同步期间使用互斥锁，同一用户不应同时在多设备写入。
