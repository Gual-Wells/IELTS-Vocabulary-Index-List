#!/usr/bin/env python3
from __future__ import annotations

import csv
import glob
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "data" / "seed5-runtime"
ECDICT = Path(os.environ.get("ECDICT_PATH", "/tmp/ecdict.csv"))
COCA_DIR = Path(os.environ.get("COCA_DIR", "/tmp/coca"))
FREEDICT = Path(os.environ.get("FREEDICT_PATH", "/tmp/eng-zho.tei"))
KAIKKI = Path(os.environ.get("KAIKKI_PATH", "/tmp/kaikki-en.jsonl"))
SEED9_REF = Path(os.environ.get("SEED9_REFERENCE", "/tmp/seed9-glosses.json"))
OUT = Path(os.environ.get("ALPHA14_REPAIR_STAGE", "/tmp/alpha14-seed-repair-stage.json"))

GENERAL = "domain_general_english"
TECH = "domain_computer_terms"
USAGE = "domain_general_collocations"
HAN_RE = re.compile(r"[\u3400-\u9fff]")
RANK_RE = re.compile(r"(?m)^\s*(\d+)\s+([^\s]+)\s*$")
GENERIC_USAGE = {
    "常用英语句型；方括号或省略号部分需结合语境替换。",
    "常用语法框架；使用时需根据句法和语境补全。",
    "常用表达模板；适合在写作或口语中按语境改写。",
    "语篇连接表达；用于组织信息和标明逻辑关系。",
    "常用英语表达。",
}


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip().casefold()


def has_han(value: str) -> bool:
    return bool(HAN_RE.search(str(value or "")))


def compact_zh(value: str) -> str:
    text = re.sub(r"\[[^\]]{0,20}\]", "", str(value or ""))
    text = re.sub(r"\b(?:n|v|vt|vi|adj|adv|prep|pron|conj|abbr)\.\s*", "", text, flags=re.I)
    text = re.sub(r"\s+", "", text)
    return "".join(ch for ch in text if "\u3400" <= ch <= "\u9fff")


def similar_zh(left: str, right: str) -> bool:
    a, b = compact_zh(left), compact_zh(right)
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    sa, sb = set(a), set(b)
    return len(sa & sb) / max(1, min(len(sa), len(sb))) >= 0.45


def load_runtime_entries() -> list[dict]:
    entries: list[dict] = []
    for filename in sorted(glob.glob(str(RUNTIME / "entries-*.json"))):
        with open(filename, encoding="utf-8") as handle:
            entries.extend(json.load(handle))
    if len(entries) != 23917:
        raise SystemExit(f"expected 23917 alpha entries, got {len(entries)}")
    return entries


def load_seed9_reference() -> dict[str, tuple[str, str]]:
    with SEED9_REF.open(encoding="utf-8") as handle:
        raw = json.load(handle)
    if raw.get("protocol") != "vix-seed-field-baseline/1" or int(raw.get("seedRevision", 0)) != 9:
        raise SystemExit("invalid Seed 9 reference baseline")
    result: dict[str, tuple[str, str]] = {}
    for row in raw.get("entries", []):
        if len(row) < 4:
            continue
        entry_id, hans, _hant, source = row[:4]
        result[str(entry_id)] = (str(hans or "").strip(), str(source or ""))
    if len(result) != 23917:
        raise SystemExit(f"Seed 9 reference coverage mismatch: {len(result)}")
    return result


def load_ecdict() -> dict[str, str]:
    result: dict[str, str] = {}
    if not ECDICT.exists():
        return result
    with ECDICT.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = norm(row.get("word", ""))
            trans = str(row.get("translation", "") or "").strip()
            if key and has_han(trans) and key not in result:
                result[key] = trans
    return result


def load_coca() -> dict[str, str]:
    result: dict[str, str] = {}
    for path in sorted(COCA_DIR.glob("part*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        matches = list(RANK_RE.finditer(text))
        for index, match in enumerate(matches):
            key = norm(match.group(2))
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            block = text[match.end():end]
            zh = "；".join(re.findall(r"[\u3400-\u9fff][^\n`]{0,100}", block))[:500]
            if key and has_han(zh):
                result.setdefault(key, zh)
    return result


def load_freedict() -> dict[str, str]:
    result: dict[str, str] = {}
    if not FREEDICT.exists() or FREEDICT.stat().st_size < 1000:
        return result
    try:
        context = ET.iterparse(FREEDICT, events=("end",))
        for _event, elem in context:
            if not elem.tag.endswith("entry"):
                continue
            orths = [str(node.text or "").strip() for node in elem.iter() if node.tag.endswith("orth") and str(node.text or "").strip()]
            all_text = "；".join(str(node.text or "").strip() for node in elem.iter() if has_han(str(node.text or "")))
            if has_han(all_text):
                for orth in orths:
                    result.setdefault(norm(orth), all_text[:500])
            elem.clear()
    except ET.ParseError:
        return {}
    return result


def load_kaikki() -> dict[str, str]:
    result: dict[str, str] = {}
    if not KAIKKI.exists() or KAIKKI.stat().st_size < 1000:
        return result
    with KAIKKI.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except Exception:
                continue
            key = norm(row.get("word", ""))
            chunks: list[str] = []
            for sense in row.get("senses", []) or []:
                for gloss in sense.get("glosses", []) or []:
                    if has_han(gloss):
                        chunks.append(str(gloss).strip())
            if key and chunks:
                result.setdefault(key, "；".join(chunks)[:500])
    return result


def is_blank_structured(entry: dict) -> bool:
    return not str(entry.get("glossHans") or "").strip() and not str(entry.get("glossHant") or "").strip()


def evidence_for(key: str, candidate: str, dictionaries: list[tuple[str, dict[str, str]]]) -> list[str]:
    evidence: list[str] = []
    for name, mapping in dictionaries:
        ref = mapping.get(key, "")
        if ref and similar_zh(candidate, ref):
            evidence.append(name)
    return evidence


def main() -> None:
    entries = load_runtime_entries()
    by_id = {entry["id"]: entry for entry in entries}
    reference = load_seed9_reference()

    ecdict = load_ecdict()
    coca = load_coca()
    freedict = load_freedict()
    kaikki = load_kaikki()
    dictionaries = [("ECDICT", ecdict), ("COCA-CN", coca), ("FreeDict", freedict), ("zhWiktionary", kaikki)]

    missing_general = [e for e in entries if e.get("domainId") == GENERAL and e.get("kind") in {"word", "phrase"} and is_blank_structured(e)]
    missing_tech = [e for e in entries if e.get("domainId") == TECH and e.get("kind") in {"word", "phrase"} and is_blank_structured(e)]
    usage = [e for e in entries if e.get("domainId") == USAGE]
    if len(usage) != 595:
        raise SystemExit(f"expected 595 usage entries, got {len(usage)}")

    targets: list[list] = []
    source_counts: Counter[str] = Counter()
    evidence_counts: Counter[str] = Counter()
    fallback_rows: list[dict] = []

    for entry in missing_general + missing_tech + usage:
        candidate, ref_source = reference.get(entry["id"], ("", ""))
        if not candidate:
            raise SystemExit(f"no candidate Chinese gloss for {entry['id']} {entry.get('text')}")
        key = norm(entry.get("text", ""))
        evidence = evidence_for(key, candidate, dictionaries)

        if entry.get("domainId") == USAGE:
            if ref_source != "VIX-9-USAGE-REVIEWED":
                raise SystemExit(f"usage reference was not reviewed: {entry.get('text')} source={ref_source}")
            source = "VIX-A14-USAGE-REVIEWED"
        elif entry.get("domainId") == TECH:
            source = "VIX-A14-TECH-REFERENCE"
        elif ref_source == "VIX-9-ECDICT":
            if key not in ecdict:
                raise SystemExit(f"ECDICT-tagged reference missing exact pinned ECDICT headword: {entry.get('text')}")
            source = "VIX-A14-ECDICT-VERIFIED"
            if "ECDICT" not in evidence:
                # Seed9's cleaned/POS-filtered gloss may be shorter than the raw line; exact
                # headword presence is still sufficient provenance, but record weak semantic overlap.
                evidence.append("ECDICT-headword")
        elif ref_source in {"VIX-9-CURATED", "VIX-9-PATTERN", "VIX-9-LANGUAGE-REVIEWED"}:
            source = "VIX-A14-CURATED"
        else:
            if evidence:
                source = "VIX-A14-FALLBACK-CORROBORATED"
            else:
                source = "VIX-A14-AI-FALLBACK"
                fallback_rows.append({"id": entry["id"], "text": entry.get("text"), "kind": entry.get("kind"), "seed9Source": ref_source, "candidate": candidate})

        source_counts[source] += 1
        for item in evidence:
            evidence_counts[item] += 1
        targets.append([entry["id"], candidate, source, evidence, ref_source])

    target_ids = {row[0] for row in targets}
    expected_ids = {e["id"] for e in missing_general + missing_tech + usage}
    if target_ids != expected_ids:
        raise SystemExit("target-ID coverage mismatch")

    report = {
        "protocol": "vix-alpha14-source-repair-stage/1",
        "fromSeedRevision": 8,
        "toSeedRevision": 9,
        "counts": {
            "entries": len(entries),
            "generalMissing": len(missing_general),
            "generalMissingWords": sum(e.get("kind") == "word" for e in missing_general),
            "generalMissingPhrases": sum(e.get("kind") == "phrase" for e in missing_general),
            "computerMissing": len(missing_tech),
            "usageReviewed": len(usage),
            "targets": len(targets),
            "aiFallback": len(fallback_rows),
        },
        "referenceCoverage": {
            "ECDICT": len(ecdict),
            "COCA-CN": len(coca),
            "FreeDict": len(freedict),
            "zhWiktionary": len(kaikki),
        },
        "sourceCounts": dict(source_counts),
        "evidenceCounts": dict(evidence_counts),
        "fallbackRows": fallback_rows,
        "targets": targets,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("ALPHA14_SOURCE_STAGE_OK", json.dumps({k: v for k, v in report.items() if k not in {"targets", "fallbackRows"}}, ensure_ascii=False))
    print("AI_FALLBACK_COUNT", len(fallback_rows))


if __name__ == "__main__":
    main()
