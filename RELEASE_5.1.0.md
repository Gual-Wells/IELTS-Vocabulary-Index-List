# Vocabulary Index 5.1.0

5.1.0 正式结束 alpha 系列，并把数据权威、Mirror 文件、ChatGPT 自动化和 Provider 能力重新划成稳定边界。

## 主要交付

- Personal Mirror ChatGPT Site：隐藏最新数据库快照、MirrorFS 文件管理器、VIX 嵌入式选择页、配对与 Groq 代理。
- 版本无关协议：Site、VIX Function 与接口不再跟随应用版本或 Seed 世代无意义变更。
- 两个同步入口：设置页手动全量同步；Layer 2 候选提交后的自动同步。
- 统一 VIX JSON 数据交换：支持完整包与增量包，同域去重、跨域独立、词表优先级投影。
- 单一繁体 `gloss`、Entry 级词性、Entry 上下文 PIN；清除运行时来源与双释义字段。
- 取消撤销、AI 核验、annotations、Cloudflare Bridge、WebMCP 与 Google TTS。
- Groq 查询/语音独立配置，iOS 系统 TTS 兜底。
- 多层页周边悬浮阴影与层级 inset；当前词表“全部展开”保持虚拟化。
- 下一 Seed 的独立固化器与强质量门禁；当前 Seed 的缺失和废话释义已形成可执行债务清单。

## 有意保留

IndexedDB 即时层、关系组件、优先级投影、学习日期、显示/关系偏好、PIN、Service Worker 离线能力均直接服务于稳定性、功能或性能，不因“裁撤”而删除。

完整决策见 `AUDIT_REPORT_5.1.0.md` 与 `REQUIREMENT_BASELINE_5.1.0.md`。
