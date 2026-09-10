# Vocabulary Index 4.0.0 迁移与断代说明

4.0.0 不是增量 Schema 兼容版本，而是内容世代替换。

## 已安装 3.5.x 升级

检测旧 DB 后，应用阻断进入旧内容并提供：

1. 下载旧完整备份；或明确不备份继续；
2. 二次确认内容世代替换；
3. 清除旧 Domain/Collection/Entry/Membership/PhraseToken、PIN、日期、Annotation、浏览状态与 Undo/Redo；
4. 写入 Seed revision 4 / Schema 6；
5. 校验后进入 4.0.0。

Groq/Collins Key、模型选择及一般显示偏好不作为旧内容对象删除。

## 不兼容导入

- Full Backup Schema 5 及更早：拒绝。
- VIX v1：拒绝。
- 旧 category/object 备份：拒绝。

旧备份只用于恢复对应旧版本。4.0.0 不做按文本猜测迁移 PIN/日期/标注，避免跨域同形和新 Seed 重分类导致错误状态套用。

## 回退

若需要回滚，部署旧源码并恢复升级前旧备份；不要把 Schema6 文件导入旧版本。
