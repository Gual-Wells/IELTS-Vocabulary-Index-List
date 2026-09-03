# Seed5 来源、署名与使用边界

Seed5 同时使用官方、发布方认可镜像与社区资料。纳入集合表示“经基础质量过滤后适合本产品使用”，不表示所有来源均为考试机构或语料库权利人的官方发行。

| 内容 | 来源与固定版本 | 标记/许可 |
|---|---|---|
| A1–B2 | CEFR-J Wordlist 1.6 | 官方下载；允许研究和商业使用，但要求适当致谢。 |
| C1/C2 | Octanove Vocabulary Profile C1/C2 1.0，Open Language Profiles pin `d4e45b75…` | 发布方认可镜像；CC BY-SA 4.0。 |
| NAWL | New Academic Word List 1.2 | 官方文件；CC BY-SA 4.0。 |
| COCA 1–10000 | `llt22/coca-vocabulary-20000` pin `cee58af1…` | 社区镜像；仓库 MIT。不是官方 COCA 分发。 |
| CET 4/6 | `exam-data/CETVocabulary` pin `773cb8a9…` | 社区转录；数据 CC BY-NC-SA 4.0。包含非商业限制。 |
| TEM 4/8 | Qwerty Learner pin `122acd90…` | 社区汇编；仓库 GPL-3.0，但未单独声明词典数据许可。公开再分发前应由维护者复核权利边界。 |
| CET/TEM phrases | `2ndLA/english-phrases` pin `4362d151…` | 社区汇编；CC BY-SA 4.0；源项目说明 TEM 覆盖不完整。 |

完整 URL、文件 SHA-256、字节数、pin 和备注见 `data/sources/seed5/SOURCE_MANIFEST.json`。构建过程不伪造词项，并保留跨集合 Membership。

## 重要限制

- CET 数据的 CC BY-NC-SA 4.0 非商业条款可能限制商业部署或商业分发。
- ShareAlike/GPL 与 TEM 数据权属需要部署者结合整个项目许可证与分发方式复核；本说明不是法律意见。
- 如果产品未来需要不受非商业/不明确数据条款约束的商业发行，应替换相应来源并重新生成 Seed5，而不是删除来源标签。

