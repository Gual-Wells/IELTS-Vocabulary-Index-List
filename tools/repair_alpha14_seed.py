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


def phrase_sig(value: str) -> str:
    """Conservative phrase signature used only for secondary reference lookup.

    It normalizes common learner-dictionary placeholders without changing the
    stored VIX English text.  The signature is accepted only when it resolves
    to a unique source headword, so it cannot silently collapse ambiguous
    dictionary entries.
    """
    text = norm(value)
    text = text.replace("…", "...")
    text = re.sub(r"\.{2,}", " ", text)
    text = re.sub(r"[\[\]{}()]", " ", text)
    text = re.sub(r"\b(?:somebody|someone)\b", "sb", text)
    text = re.sub(r"\b(?:something)\b", "sth", text)
    text = re.sub(r"\b(?:somebody's|someone's|sb\.?['’]s|one['’]s)\b", "<poss>", text)
    text = re.sub(r"\bsb\.(?=\s|$)", "sb", text)
    text = re.sub(r"\bsth\.(?=\s|$)", "sth", text)
    text = re.sub(r"\bdoing sth\.?\b", "doing sth", text)
    text = re.sub(r"\bdo sth\.?\b", "do sth", text)
    text = re.sub(r"\s+", " ", text).strip(" ,;:.!?-")
    return text


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


def clean_reference(value: str, limit: int = 500) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\r", "\n")
    text = re.sub(r"\n+", "；", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"；{2,}", "；", text)
    return text.strip(" ；")[:limit]


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
            trans = clean_reference(row.get("translation", ""))
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
            chunks = [clean_reference(piece, 140) for piece in re.findall(r"[\u3400-\u9fff][^\n`]{0,140}", block)]
            zh = clean_reference("；".join(piece for piece in chunks if has_han(piece)))
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
            chunks = [str(piece).strip() for piece in elem.itertext() if str(piece).strip() and has_han(str(piece))]
            all_text = clean_reference("；".join(chunks))
            if has_han(all_text):
                for orth in orths:
                    result.setdefault(norm(orth), all_text)
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
                result.setdefault(key, clean_reference("；".join(chunks)))
    return result


def build_unique_signature_index(mapping: dict[str, str]) -> dict[str, tuple[str, str]]:
    buckets: dict[str, list[tuple[str, str]]] = {}
    for headword, gloss in mapping.items():
        signature = phrase_sig(headword)
        if not signature:
            continue
        buckets.setdefault(signature, []).append((headword, gloss))
    return {signature: rows[0] for signature, rows in buckets.items() if len(rows) == 1}


def is_blank_structured(entry: dict) -> bool:
    return not str(entry.get("glossHans") or "").strip() and not str(entry.get("glossHant") or "").strip()


def references_for(key: str, dictionaries: list[tuple[str, dict[str, str], dict[str, tuple[str, str]]]]) -> list[dict]:
    refs: list[dict] = []
    signature = phrase_sig(key)
    for name, exact_map, sig_map in dictionaries:
        if key in exact_map:
            refs.append({"source": name, "match": "exact", "headword": key, "gloss": exact_map[key]})
            continue
        hit = sig_map.get(signature)
        if hit:
            headword, gloss = hit
            refs.append({"source": name, "match": "signature", "headword": headword, "gloss": gloss})
    return refs


def evidence_for(candidate: str, refs: list[dict]) -> list[str]:
    evidence: list[str] = []
    for ref in refs:
        if similar_zh(candidate, ref.get("gloss", "")):
            label = ref["source"] if ref.get("match") == "exact" else f"{ref['source']}-signature"
            evidence.append(label)
    return evidence


def main() -> None:
    entries = load_runtime_entries()
    reference = load_seed9_reference()

    ecdict = load_ecdict()
    coca = load_coca()
    freedict = load_freedict()
    kaikki = load_kaikki()
    raw_dictionaries = [("ECDICT", ecdict), ("COCA-CN", coca), ("FreeDict", freedict), ("zhWiktionary", kaikki)]
    dictionaries = [(name, mapping, build_unique_signature_index(mapping)) for name, mapping in raw_dictionaries]

    missing_general = [e for e in entries if e.get("domainId") == GENERAL and e.get("kind") in {"word", "phrase"} and is_blank_structured(e)]
    missing_tech = [e for e in entries if e.get("domainId") == TECH and e.get("kind") in {"word", "phrase"} and is_blank_structured(e)]
    usage = [e for e in entries if e.get("domainId") == USAGE]
    if len(usage) != 595:
        raise SystemExit(f"expected 595 usage entries, got {len(usage)}")

    targets: list[list] = []
    source_counts: Counter[str] = Counter()
    evidence_counts: Counter[str] = Counter()
    match_counts: Counter[str] = Counter()
    fallback_rows: list[dict] = []

    for entry in missing_general + missing_tech + usage:
        candidate, ref_source = reference.get(entry["id"], ("", ""))
        if not candidate:
            raise SystemExit(f"no candidate Chinese gloss for {entry['id']} {entry.get('text')}")
        key = norm(entry.get("text", ""))
        refs = references_for(key, dictionaries)
        evidence = evidence_for(candidate, refs)
        for ref in refs:
            match_counts[f"{ref['source']}:{ref['match']}"] += 1

        if entry.get("domainId") == USAGE:
            if ref_source != "VIX-9-USAGE-REVIEWED":
                raise SystemExit(f"usage reference was not reviewed: {entry.get('text')} source={ref_source}")
            source = "VIX-A14-USAGE-REVIEWED"
        elif entry.get("domainId") == TECH:
            source = "VIX-A14-TECH-REFERENCE"
        elif ref_source == "VIX-9-ECDICT":
            exact = any(ref["source"] == "ECDICT" and ref["match"] == "exact" for ref in refs)
            signature = any(ref["source"] == "ECDICT" and ref["match"] == "signature" for ref in refs)
            if not exact and not signature:
                raise SystemExit(f"ECDICT-tagged reference missing pinned ECDICT headword/signature: {entry.get('text')}")
            source = "VIX-A14-ECDICT-VERIFIED"
            if not any(item.startswith("ECDICT") for item in evidence):
                evidence.append("ECDICT-headword")
        elif ref_source in {"VIX-9-CURATED", "VIX-9-PATTERN", "VIX-9-LANGUAGE-REVIEWED"}:
            source = "VIX-A14-CURATED"
        else:
            if evidence:
                source = "VIX-A14-FALLBACK-CORROBORATED"
            else:
                source = "VIX-A14-AI-FALLBACK"
                fallback_rows.append({
                    "id": entry["id"],
                    "text": entry.get("text"),
                    "kind": entry.get("kind"),
                    "seed9Source": ref_source,
                    "candidate": candidate,
                    "references": refs,
                })

        source_counts[source] += 1
        for item in evidence:
            evidence_counts[item] += 1
        targets.append([entry["id"], candidate, source, evidence, ref_source])

    target_ids = {row[0] for row in targets}
    expected_ids = {e["id"] for e in missing_general + missing_tech + usage}
    if target_ids != expected_ids:
        raise SystemExit("target-ID coverage mismatch")

    report = {
        "protocol": "vix-alpha14-source-repair-stage/2",
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
        "referenceCoverage": {name: len(mapping) for name, mapping in raw_dictionaries},
        "referenceSignatureCoverage": {name: len(build_unique_signature_index(mapping)) for name, mapping in raw_dictionaries},
        "sourceCounts": dict(source_counts),
        "evidenceCounts": dict(evidence_counts),
        "matchCounts": dict(match_counts),
        "fallbackRows": fallback_rows,
        "targets": targets,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("ALPHA14_SOURCE_STAGE_OK", json.dumps({k: v for k, v in report.items() if k not in {"targets", "fallbackRows"}}, ensure_ascii=False))
    print("AI_FALLBACK_COUNT", len(fallback_rows))


if __name__ == "__main__":
    main()
