# Vocabulary Index 4.7.3 变更报告

1. App/package/SW升级到4.7.3；cache generation：`v4.7.3-presentation-lifecycle-20260811-1`。
2. 新增`css/v4.7.3.css`。
3. `runBufferedCollectionCommit()`退役；新增`runAtomicCollectionCommit()`。
4. Word/Phrase与Alphabet/Date保留4.7.2 TOP+collapsed合同，但不再把整个Collection opacity降到0。
5. Mode切换的runtime hydrate/render/TOP先于durable IndexedDB persistence。
6. Home Global取消34ms灭屏+52ms回亮，改为atomic card replace + 非零轻settle。
7. Root Home取消整App fade-to-zero，改为root commit + Home轻settle。
8. Relation改为Stable Row Shell：新增`.entry-relation-slot/.entry-relation-reveal`，toggle不再`replaceWith()`或root scroll correction。
9. 新增Virtual Chunk park/retire：保存measured height、清空远端row DOM、保留Entry映射、重新observe。
10. programmatic semantic scroll每72ms可做rolling resident sweep；scroll transaction finish与user scrollend再次sweep。
11. 测试合同新增“禁止opacity blink”“Relation不得重建Row”“必须存在双向virtual lifecycle”。
12. 生命周期表述更正：Single Slot是4.7.x已继承现行架构，不是4.7.3待决事项。
