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

## Real calendar date marks

Marks live in one flat source folder: `data/seed-access/dates/<YY-MM-DD>.json`.

The label records the actual study date in Asia/Shanghai. `YY` denotes 2000–2099; full chapter dates remain `YYYY-MM-DD`. Calendar validation rejects invalid dates, including non-leap-year February 29. There is no artificial start label. A date file is the mark authority:

```json
{"protocol":"vix-seed-access-date/1","schemaVersion":1,"date":"26-10-02","globalRanks":[]}
```

`globalRanks` must be strictly increasing, unique, and in the reduced index range. A rank may occur on multiple real dates. The last tuple field, `markDates`, derives only from these files; `[]` means unmarked.

On 2026-10-04, the existing 40 marks under `10-02` were migrated to `26-10-02`, matching commit `8836e601cad6a5f7ff3c04c2a341faf782450dd1` ("Mark Second Language 2026-10-02 vocabulary"). No vocabulary ranks were added or removed. The empty `01-01` placeholder was removed rather than assigned a fictitious date. Seed data and priority ownership remain unchanged.

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
- `dates/<YY-MM-DD>.json`: editable mark source
- `tools/build-seed-access.mjs`: zero-dependency generator/checker

## Regenerate / verify

```bash
node tools/build-seed-access.mjs
node tools/build-seed-access.mjs --check
```

The generator verifies Seed byte lengths/SHA-256 values, validates the real `YY-MM-DD` calendar source files and rank ranges, preserves date files, writes only generated artifacts, and rejects stale or extra record shards in `--check` mode.
