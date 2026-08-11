# Vocabulary Index 4.7.3 测试报告

## 新增自动合同

- `runBufferedCollectionCommit`不得存在，`runAtomicCollectionCommit`必须唯一存在；
- Atomic Collection commit不得对surface执行opacity 1→0或写`opacity=0`；
- Manual View/Mode继续要求TOP+collapsed与4.7.2 calendar规则；
- Relation toggle必须操作`.entry-relation-slot`，不得`replaceWith()`，不得创建root scroll transaction；
- 必须存在`parkEntryChunk`、resident-window sweep、`data-parked=true`与重新observe；
- programmatic scroll必须包含rolling resident sweep；
- SW/index/layout必须包含`css/v4.7.3.css`；
- Single Slot静态合同继续保持。

## 当前工作树

正式封装前工作树验证结果：

- `npm run test:all`：PASS；
  - seed/relation：6176 seed entries / 1240 relation components；
  - static：38 precache resources；
  - runtime-symbol：PASS；
  - runtime-behavior：PASS；
  - stress：125 entries / 158 memberships / 31 relation components；
  - integrations：max Shortcut URL 8042 chars @ data；
  - performance：31.1 ms / 25 searches，4.1 ms relations，2780.7 ms VIX preflight；
  - layout contract：402×874 PASS。
- `js/`、`tests/`、`tools/` 全部 JS/MJS `node --check`：PASS。
- JSON/WebManifest 解析：16 files PASS。
- manifest/checksum/ZIP/fresh-extract 正式封装门禁：PASS；274 个受校验项目文件与实际 inventory 完全一致，`sha256sum -c SHA256SUMS.txt` 全部通过，ZIP integrity PASS。
- 正式候选 ZIP 全新解压后再次执行 `npm run test:all`：全部 PASS；fresh-extract performance 29.2 ms / 25 searches，3.9 ms relations，3157.2 ms VIX preflight；402×874 layout contract PASS。
- fresh extract 全部 JS/MJS `node --check` 与 16 个 JSON/WebManifest 解析：PASS。

## 真机重点

自动测试不能证明：iOS 26.5 compositor是否完全无闪、Relation grid reveal手感、A→Z resident set是否在真机帧预算内保持稳定，以及parked chunk回访是否完全无可感位置漂移。
