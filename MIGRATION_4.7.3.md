# Vocabulary Index 4.7.3 迁移说明

## 数据

无数据迁移。Schema6 / IndexedDB5 / Seed4 / VIX2不变。

## 文件树

必须全量覆盖4.7.3文件树。新增`css/v4.7.3.css`并由`index.html`及Service Worker precache加载。

Service Worker cache generation：`gual-vocabulary-index-v4.7.3-presentation-lifecycle-20260811-1`。

## Runtime变化

- Manual View/Mode从opacity Buffer迁移到Atomic Visual Commit；完成态仍是4.7.2的TOP+collapsed。
- Relation展开不再替换整个Entry Row；历史expanded状态无需迁移。
- Virtual chunk可以在保留语义展开状态时park并回访materialize；layout cache仍属当前recursive frame runtime，不写入数据Schema。

## 回滚

如回滚4.7.2必须完整回滚JS/CSS/SW/tests/docs；4.7.3 parked chunk没有新增持久化字段，因此不存在数据清理要求。
