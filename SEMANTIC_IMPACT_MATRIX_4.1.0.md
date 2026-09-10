# Vocabulary Index 4.1.0 全相联影响矩阵

| 变更 | Data identity / Seed | Projection / Search / Relation | Navigation / State | UI / PWA | Import / Backup | Tests |
|---|---|---|---|---|---|---|
| Sticky Top Chrome 根修 | 无 | 无 | active/跳转语义不变 | 删除混合坐标硬下限；nav attached 后才显示字母 Sticky | 无 | static/runtime/iPhone |
| Alphabet cell border | 无 | 无 | 无 | cell-owned border；disabled 只灰前景 | 无 | layout + iPhone |
| 日期刷新原位 | 无 | 无 | StudyStamp 不触发 target jump | viewport continuity | 无 | runtime + iPhone |
| Query/Oxford | 无 | Provider 顺序不变 | 无 | 22px edge inset；参考图闭合书本 | 无 | static + iPhone |
| Entry secondary gap | 无 | 无 | 无 | 繁体/来源同 Y，间距更紧 | 无 | layout |
| Home switch/identity | 无 | 仅 virtual display name 变化 | Home mode 不持久化规则不变 | switch icon 左、管理右；topbar/PWA 名称更新 | 无 | static + reinstall |
| System Shell depth | 无 | 无 | Modal stack 语义不变 | 48%/20% 累计合成，topbar/theme/root 同步 | 无 | static + nested-modal iPhone |

## 明确不受影响

Schema 6、DB 5、Seed 4、VIX 2；structured/nonStructured；word/phrase/content 优先级占有；fuzzy Search / exact Relation；Raw/Effective Relation；四态关系；Provider session；递归返回；长按模型；58px bottom toolbar。
