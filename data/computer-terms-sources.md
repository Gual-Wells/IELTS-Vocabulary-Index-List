# 计算机术语内置词域：来源与构建说明

构建日期：2026-08-01  
适用版本：Vocabulary Index 3.4.0

## 数据范围

“计算机术语”是一个经过筛选和规范化的复合术语集，覆盖：

- 计算机科学基础、算法与数据结构；
- 编程语言、软件工程与测试；
- 操作系统、并发、硬件与嵌入式；
- 网络、Web 与浏览器平台；
- 数据库与数据工程；
- Git、协作与交付流程；
- 云原生、Kubernetes、DevOps 与可观测性；
- 网络安全、隐私与密码学；
- 人工智能、机器学习与现代生成式 AI。

本数据集收录英文术语及简短中文对译，不复制来源站点的定义正文。

## 3.1.0 用户可见主分类

544 个普通词各自进入一个且仅一个用户可见普通词表：

- 计算机基础与系统：214；
- 软件开发与数据：197；
- 网络、云与安全：114；
- 人工智能：19。

577 条短语继续汇总在词域短语总表中，同时各自进入一个且仅一个用户可见普通表：计算机基础与系统 139、软件开发与数据 222、网络、云与安全 165、人工智能 51。分类审计见 `seed-phrase-classification-report.json`。

## 主要官方来源

- MDN Web Docs Glossary  
  https://developer.mozilla.org/en-US/docs/Glossary
- Python 3 Glossary  
  https://docs.python.org/3/glossary.html
- GitHub Glossary  
  https://docs.github.com/en/get-started/learning-about-github/github-glossary
- Kubernetes Glossary  
  https://kubernetes.io/docs/reference/glossary/
- CNCF Cloud Native Glossary  
  https://glossary.cncf.io/
- NIST CSRC Glossary  
  https://csrc.nist.gov/glossary
- NIST Trustworthy and Responsible AI Glossary  
  https://airc.nist.gov/glossary/
- RFC Editor networking and Internet-security terminology  
  https://www.rfc-editor.org/

## 选择与规范化原则

1. 优先选取跨产品、跨语言仍有长期价值的术语；不追求收录每个命令、产品品牌或短期流行语。
2. 同义或大小写变体合并为一个显示形式；英文按应用现有规范化规则去重。
3. 单一英文词作为“词汇”；含多个独立词元的术语作为“短语”。
4. 中文对译先采用大陆简体技术语境中的常用译法。
5. 繁体释义由简体译法一一转换为繁体，不进行台湾地区术语本地化，因此保留“軟件、數據庫、服務器、網絡”等对应形式。
6. NIST 术语只用于术语选择与语境校验。NIST 明确指出同一术语可能在不同出版物中有不同定义；本项目不合并或转述这些定义。
7. `CORE / DSA / DATA / OS / HW / DEVOPS` 标签表示从上述官方资料的交集及稳定计算机课程核心中整理出的复合类别，不声称每一条都来自单一页面。

## 文件

- `computer-terms-source.tsv`：英文、简体中文、来源标签；
- `computer-terms-source-report.json`：数量及来源分布；
- `seed.json`：应用实际加载的 Schema 6 / Seed revision 4 数据，其中计算机术语释义沿用已验证繁体结果，并进入 4.0.0 通用 RelationComponent 模型。

## 许可与归属

这里只分发术语名称和本项目整理的简短对译，不分发来源定义正文。各来源内容仍受其各自条款约束。CNCF Glossary 文档采用 CC BY 4.0；MDN 内容、GitHub 文档、Python 文档、Kubernetes 文档和 NIST/RFC 材料应分别依其站点条款使用。
