# Seed Access Index

`data/seed-access/` is a non-authoritative repository-internal access layer derived one-way from `data/seed5-runtime/`.

## Authority boundary

- `data/seed5-runtime/` is the only data authority.
- `data/seed-access/` is derived and read-only with respect to Seed. It must never be an input to Seed migration or reconstruction.
- `manifest.json -> source.manifestSnapshot` binds the access layer to one exact Seed runtime manifest. A mismatch means the index is stale.
- The generator reads Seed and writes only generated JSON under `data/seed-access/`; it never edits Seed.

## Indexed structure

Priority ownership uses only `normal && !hidden` collections. If an entry appears in multiple wordlists, the first candidate by collection `order`, membership `sourceOrder`, collection name/id, then membership id owns the priority slot.

Runtime-derived system/global collections are intentionally excluded from ownership. Their entries remain reachable through the owning normal collection and the `word`, `phrase`, or `content` section.

All ordinals and ranks are 1-based.

## Files and lookup

- `manifest.json`: binding, ordering semantics, tuple schema, and record-shard rank ranges.
- `structure.json`: `Domain -> Collection -> Section -> Letter` with absolute/relative ordinals plus priority/display global-rank arrays.
- `records-*.json`: compact tuples in contiguous global-priority ranges.
- `tools/build-seed-access.mjs`: zero-dependency generator/checker.

The tuple order in `manifest.json -> recordTuple` is authoritative. `entryShardIndex` points to `source.manifestSnapshot.entries[index]` when full Seed data such as glosses is needed.

For a structural position, read either `displayGlobalRanks[n - 1]` for the Pages alphabetical position or `priorityGlobalRanks[n - 1]` for priority occupancy. The resulting global rank selects exactly one record shard through the ranges in `manifest.json`.

Seed revision 8 example: `通用英语 -> B2 -> word -> C -> display #193` resolves to global priority rank `5000`, entry `costume`; its B2 priority-new-entry rank is `462`.

## Regenerate / verify

```bash
node tools/build-seed-access.mjs
node tools/build-seed-access.mjs --check
```

Before deriving, the generator validates Seed input byte lengths and SHA-256 values declared by the Seed manifest. `--check` writes nothing and rejects missing, stale, or extra generated record shards.
