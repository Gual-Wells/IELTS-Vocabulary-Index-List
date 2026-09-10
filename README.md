# Vocabulary Index 5.1.0

VIX 是以 Entry 为核心的本地优先词汇索引 PWA。5.1.0 将数据职责固定为：

```text
完整 GitHub Seed -> VIX / IndexedDB 即时层 -> Personal Mirror 最新快照
                                                + MirrorFS 文件
Personal Mirror -> 经人工发布的下一完整 Seed -> VIX
```

IndexedDB 保证离线、首屏与交互性能，但不再被视为跨设备真源。Personal Mirror ChatGPT Site 保存唯一最新数据库快照和可见 Mirror 文件；Site、VIX Function 与各接口使用独立协议/capability，不绑定 VIX 版本或 Seed 世代。

核心能力包括精确结构关系、普通词表优先级投影、Entry 上下文 PIN、学习日期、显示/关系偏好、Oxford 查询、Groq 查询与语音，以及 iOS 系统 TTS 兜底。5.1.0 取消撤销、AI 核验、annotations、运行时来源字段、双释义、Cloudflare Bridge、WebMCP 和 Google TTS。

Mirror Layer 2 候选通过统一 VIX increment 事务提交，随后自动同步完整最新快照与文件状态；设置页也提供手动“同步到 Mirror”。

## 验证

```powershell
npm run test:all
npm run build
cd mirror-site
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vinext/dist/cli.js build
```

当前 Seed revision 8 仍可运行，但存在已量化的释义质量债务。下一世代必须先经过 `seed:finalize-next` 和 `seed:validate-next`，并以独立完整快照发布。

详见 [5.1.0 架构审计](AUDIT_REPORT_5.1.0.md)、[需求基线](REQUIREMENT_BASELINE_5.1.0.md)、[迁移说明](MIGRATION_5.1.0.md)、[发布说明](RELEASE_5.1.0.md) 与 [测试报告](TEST_REPORT_5.1.0.md)。
