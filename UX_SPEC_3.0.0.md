# Vocabulary Index 3.0.0 交互契约

## 主任务

浏览词表 → 点按英文复制 → 进入外部词典 → 返回原位置继续。

## 不变量

1. 词条主体点击永远只复制英文。
2. PIN 跳转后前后控制仍在视口内。
3. PIN 与标注审阅不能同时占用上下文区。
4. 搜索、PIN、上次位置和标注跳转只滚动一次。
5. 目标字母按需局部展开；定位不得重建整张词表。
6. 普通进入词表不自动跳到上次位置。
7. 主列表不常驻繁体释义、全部来源和短语关系。
8. 每行只保留一个管理入口。
9. 没有永久移动端底部工具栏。
10. 危险操作必须经过独立确认。
11. AI 核查只生成标注，不直接改词。
12. 新 PWA 版本必须由用户确认激活。

## 层级

- Topbar：返回、标题、搜索、更多；
- Context：PIN 或 Annotation Review；
- Letter Nav：位于 Context 下；
- Main List：复制主平面；
- Action Sheet：低频动作；
- Detail Sheet：只读扩展信息；
- Form Dialog：新增、编辑、设置；
- Confirm Dialog：危险操作；
- Task Capsule/Panel：临时 AI 任务。
