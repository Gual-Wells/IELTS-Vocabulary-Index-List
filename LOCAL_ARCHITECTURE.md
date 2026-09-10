# VIX 5.1.0 本地与 Personal Mirror 架构

```text
GitHub repository
└─ immutable full Seed generation
          │ initialize
          ▼
VIX PWA / IndexedDB                 Personal Mirror ChatGPT Site
├─ immediate offline state ─sync──► D1: one latest hidden DB snapshot
├─ projection / relations           D1: MirrorFS node metadata
├─ pins / study / preferences       R2: Mirror file documents
└─ Layer 2 increment ─commit+sync─► Groq secret + query/speech proxy
          ▲                                  │
          │ /picker selection                │ read latest / submit file
          └────────────────────────── VIX Function + ChatGPT
```

## 权威与流向

- Seed 是安装与新世代初始化权威；每一代是独立完整快照。
- IndexedDB 是 VIX 用户操作的即时层，不承担跨设备真源职责。
- Personal Mirror 只保留一份最新完整数据库快照，不实现版本历史。
- MirrorFS 文件与隐藏数据库分开：VIX 文件管理器只读写文件视图。
- 数据只按 `VIX -> Mirror -> Seed -> VIX` 流动；新 Seed 由用户显式发布。

## 协议

应用版本与协议版本分离：

- `vix-data-exchange/1`：VIX full/increment 文件。
- `vix-mirror-service/1`：配对、快照、文件和 Provider capability。
- `vix-mirror-file/1`：两层语义提取文档。
- `vix-function/1` / `vix-function-context/1`：本地 Function 路由与最新快照上下文。

兼容由协议标识与 capability 决定，不读取 VIX 5.1.0 或 Seed revision 8 作为接口条件。

## Site 边界

- D1：principal、配对 token、唯一快照、文件节点、加密 Provider secret。
- R2：Mirror 文件 JSON 正文。
- 普通 Site 会话可读；写操作要求配对 token 并进行协议校验。
- Groq Key 由 `VIX_GROQ_MASTER_KEY` 进行 AES-GCM 加密；主密钥仅存在托管环境。
- `/` 是文件管理器，`/picker` 是 VIX 调用页，`/pair` 是配对页。

## 性能边界

IndexedDB、关系组件、投影缓存、Service Worker 分块和词表虚拟化不可裁剪。它们不增加产品概念，却避免 23k+ Entry 在冷启动、滚动、关系展开和“全部展开”时退化。
