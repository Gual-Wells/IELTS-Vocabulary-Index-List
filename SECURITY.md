# Vocabulary Index 4.1.0 安全与数据边界

Vocabulary Index 是个人本地 PWA，不提供服务端账户或云同步。

## 本地数据

业务内容与个人状态保存在 IndexedDB。Groq/Collins API Key 保存在浏览器本地存储；这是便捷的单设备存储，不是硬件级/服务端秘密存储，用户应按可被当前站点脚本读取的凭据理解。

## 外部请求

- Oxford：外部 App URL scheme，只发送当前英文文本。
- Collins：向 `api.collinsdictionary.com` 发送 Key 与查询词；若直接 API 失败，可跳转 Collins 网站。
- Groq：向 Groq API 发送用户发起的查询/核查内容。
- ChatGPT：通过 iOS Shortcuts URL 发送紧凑 Entry context。

查询 Provider 不自动写入 Seed；Groq 单条查询与 Collins 结果是临时 UI。

## DOM 与文本

普通应用文本默认不可原生选择和 iOS callout；可编辑控件显式恢复选择。动态内容使用 DOM 构造/文本节点而不是持久化 HTML 拼接作为主要路径。CSP 仅开放当前需要的网络来源。

## 备份

Full Backup 可能包含完整个人学习状态，但不包含 Groq/Collins API Key。VIX 只包含内容，不含个人状态。删除、整代替换等大范围操作继续提供备份选择。

## 公开仓库注意

当前大型 Seed 数据的质量/来源记录与公开再分发授权是两个不同问题。项目长期自用时可先以质量和可重建性为主，但任何未来公开提交第三方大词表前应重新审核其公开分发条件。
