# VIX Seed 数据来源与使用边界

这份清单说明 VIX 内置初始词库的出处、版本和已知许可边界。它是透明度与审计文档，不会联网、上传数据或修改用户词库。

“收录”只表示内容经过规范化、基础质量过滤和精确去重后适合在 VIX 中使用，不表示所有来源都具有同等权威性。官方资料、发布方认可镜像、社区整理和 VIX 人工整理会分开标记。

## 通用英语 Seed5

| 集合 | 来源或固定版本 | 权威与许可说明 |
|---|---|---|
| A1–B2 | CEFR-J Wordlist 1.6 | 官方下载；允许研究和商业使用，要求适当致谢。 |
| C1/C2 | Octanove Vocabulary Profile C1/C2 1.0，Open Language Profiles pin `d4e45b75…` | 发布方认可镜像；CC BY-SA 4.0。 |
| NAWL | New Academic Word List 1.2 | 官方文件；CC BY-SA 4.0。 |
| COCA 1–10000 | `llt22/coca-vocabulary-20000` pin `cee58af1…` | 社区镜像；仓库 MIT；不是 COCA 官方再发布。 |
| CET 4/6 | `exam-data/CETVocabulary` pin `773cb8a9…` | 社区转录；数据标注 CC BY-NC-SA 4.0，含非商业限制。 |
| TEM 4/8 | Qwerty Learner pin `122acd90…` | 社区整理；仓库 GPL-3.0，未单独声明词表数据许可。正式再发布前应重新核查。 |
| CET/TEM phrases | `2ndLA/english-phrases` pin `4362d151…` | 社区整理；CC BY-SA 4.0；原项目说明 TEM 数据不完整。 |

完整 URL、文件 SHA-256、字节数、pin 和备注位于 `data/sources/seed5/SOURCE_MANIFEST.json`。运行时保留同一词条属于多个集合的 Membership，不会把多来源压成一个伪造标签。

## Seed6 词域扩充

Seed revision 6 在保留 Seed5 通用英语数据的基础上，补充了两部分 VIX 人工整理内容：

- 计算机术语：补充现代硬件与操作系统、软件工程与数据、网络云安全、生成式 AI 与模型评测术语。
- 通用英语搭配：补充句型、语法框架、写作模板和语篇连接表达。

这些条目标记为 `VIX-6-CURATED`，目标是扩大实用覆盖，不冒充外部标准或官方词表。机器可读原始清单位于 `data/sources/seed6/VIX6_DOMAIN_EXPANSION.json`。

## 重要边界

- CET 数据的 CC BY-NC-SA 4.0 含非商业限制，应与商业发行边界一起重新核查。
- ShareAlike/GPL 与 TEM 数据权利边界需要维护者在公开发行前再次确认。
- 如果产品需要完全商业化或权利边界完全统一，应替换相关社区来源并重新生成 Seed，而不是删除来源标签。
- 用户自行创建、编辑或删除的词条不属于本清单；Seed 升级通过三方合并保留这些本地变化。
