# Vocabulary Index 3.0.5 变更报告

## 首页

- 全局索引使用独立的浅墨绿容器；
- 每个独立词域使用各自的柔和纸张容器与词域标题；
- 通过背景、间距、圆角和左侧细标记表达层级，不增加多重厚边框；
- 多个独立词域之间不再仅依赖空白分隔。

## 计算机术语 Seed

- 新增“计算机术语”词域；
- 544 个单词、577 条短语；
- 默认开启繁体释义，100% 覆盖；
- 用户界面只显示总词表和短语表；
- 隐藏来源 Collection 保持 Schema 3 的普通词来源约束；
- 既有 3.0 数据库通过 `builtInSeedRevision=1` 幂等合并，不覆盖用户数据。

## 术语来源

综合 MDN、Python、GitHub、Kubernetes、CNCF、NIST CSRC、NIST AI、RFC Editor 与稳定计算机核心课程词汇。只收录术语及本项目整理的简短对译，不复制定义正文。

## 数据格式

- Collection 新增可选 `hidden`；
- settings 新增 `builtInSeedRevision`；
- Seed 升级为完整 Schema 3 备份。
