# Vocabulary Index 4.0.2 全相联影响矩阵

| 变更 | Data identity / Seed | Projection / Search / Relation | Navigation / State | UI / PWA | Import / Backup | Tests |
|---|---|---|---|---|---|---|
| Sticky 几何修正 | 无 | 无 | active 字母语义不变；共享阅读边界修正 | 字母栏下方真实测量边界，消除遮挡/镂空 | 无 | 全局/域/普通、word/phrase/content、日期回归 |
| 日期刷新原位 | 无 | 无 | StudyStamp 更新但不触发目标跳转；保留 scrollY | 无感刷新 | 无 | 禁止 `study-date` pending jump；真机位置保持 |
| Query chooser 校准 | 无 | 无 | Provider 顺序/调用不变 | 左移、右边框露出；Oxford 闭合书本；四 Provider 深色描边 | 无 | static + 真机 |
| Modal 系统壳融合 | 无 | 无 | Modal Stack 不变 | theme-color/page surface best-effort 同步 | 无 | iOS standalone；26.5.2 平台边界记录 |

## 明确不受影响

Schema 6、DB 5、Seed 4、VIX 2；structured/nonStructured；word/phrase/content 优先级占有；fuzzy Search / exact Relation；Raw/Effective Relation；四态关系；Provider session；递归返回；4.0.1 Modal Stack 与长按模型。
