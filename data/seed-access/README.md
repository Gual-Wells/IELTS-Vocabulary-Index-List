# Seed Access Index

`data/seed-access/` is a repository-internal access layer bound one-way to `data/seed5-runtime/`.

## Scope

This index serves only **通用英语 vocabulary**:

- domain: `domain_general_english`
- section: `word`
- phrases, content blocks, collocations and every other domain are excluded
- the current Seed 8 scope contains 15,644 records in 13 wordlists

The Seed remains authoritative. Nothing under `data/seed-access/` writes back into Seed or participates in Seed migration/reconstruction.

## Structural lookup

`structure.json` keeps only the fixed General-English word scope and its useful navigation hierarchy:

`Collection -> Letter -> global rank`

All ranks and ordinals are 1-based. Each collection and letter retains priority-order and alphabetical-display rank arrays, so a structural position can resolve to one compact record without loading the Pages runtime.

`records-*.json` contains the tuple declared by `manifest.json -> recordTuple`. Domain and section are not repeated in every record because they are fixed by the manifest scope.

## Internal date marks

Marks live directly in one flat source folder:

`data/seed-access/dates/<MM-DD>.json`

There is **no year field or year directory**. The label starts from `01-01` and is only an internal month-day marker; it has no connection to the external/current date. The namespace is zero-padded `MM-DD`, with ordinary month/day bounds. Because there is no year component, `02-29` is simply a valid internal label.

A date file is the authoritative mark source for that internal label:

```json
{"protocol":"vix-seed-access-date/1","schemaVersion":1,"date":"01-01","globalRanks":[]}
```

`globalRanks` must be strictly increasing, unique, and in the current reduced index range. The same rank may appear in multiple date files.

The last field of every record is `markDates`, derived only from the date folder. `[]` means unmarked; one or more `MM-DD` strings mean marked by those internal labels.

## Mark hash

`mark-hash.json` provides O(1)-style lookup over the whole auxiliary index:

```text
byGlobalRank[rank] = [entryId, markDates]
```

Every one of the 15,644 ranks is present, including unmarked entries, so marked/unmarked state and all date marks can be inspected without scanning date files. The hash is generated; the date folder is the mark authority.

## Files

- `manifest.json`: Seed binding, fixed scope, tuple schema, date-source inventory and generated artifact hashes
- `structure.json`: General-English wordlist/letter navigation
- `records-*.json`: compact vocabulary records with the derived `markDates` slot
- `mark-hash.json`: complete rank -> entry/date-state hash
- `dates/<MM-DD>.json`: editable mark source
- `tools/build-seed-access.mjs`: zero-dependency generator/checker

## Regenerate / verify

```bash
node tools/build-seed-access.mjs
node tools/build-seed-access.mjs --check
```

The generator verifies Seed byte lengths/SHA-256 values, validates the flat `MM-DD` source files and rank ranges, preserves date files, writes only generated artifacts, and rejects stale or extra record shards in `--check` mode.
