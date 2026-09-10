# Vocabulary Index 4.0.1 全相联影响矩阵

| 变更 | Data identity | Projection/Search/Relation | Navigation/State | UI/PWA | Import/Seed | Tests |
|---|---|---|---|---|---|---|
| Sticky 重建 | 无 | 无 | active section 状态来源改变；历史快照语义不变 | 独立 sticky layer、零占位缝隙 | 无 | metrics/二分/402×874/真机滚动 |
| Modal Stack | 无 | 无 | 父层输入/滚动/focus 保留；pop 一层返回父层 | retained layers + layered backdrop + inert | 无 | nested modal/focus/body lock/真机 |
| 管理窗口限高 | 无 | 无 | 无 | body 单独滚动、四角完整 | 无 | layout contract/真机 |
| content 超长布局 | 无 | 无 | 点击复制/查询语义不变 | normal/two-line/extreme | 无 | row contract/真机 |
| row 副信息收紧 | 无 | 无 | 无 | secondary baseline 不变，仅密度调整 | 无 | source/gloss Y 对齐 |
| Query chooser | 无 | 无 | Provider 顺序/调用不变 | labels + Oxford/ChatGPT icon 重绘 | 无 | provider order/static |
| 自绘 checkbox | Settings 值不变 | 关系过滤行为不变 | 无 | 仅 appearance | Backup Schema 6 不变 | settings/static |
| modal 顶部 safe-area 融合 | 无 | 无 | 无 | 全屏 Modal Host + safe-area；状态栏 `default` | 无 | iPhone standalone |

## 明确不受影响

Schema 6、DB 5、Seed 4、VIX 2；Domain `contentMode`；word/phrase/content 优先级占有；fuzzy Search / exact Relation；Raw/Effective relation 语义；四态关系；Provider session；历史/递归返回；旧导入硬断代。
