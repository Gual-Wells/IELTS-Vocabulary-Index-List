#!/usr/bin/env python3
from __future__ import annotations

import csv
import glob
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "data" / "seed5-runtime"
ECDICT = Path(os.environ.get("ECDICT_PATH", "/tmp/ecdict.csv"))
COCA_DIR = Path(os.environ.get("COCA_DIR", "/tmp/coca"))
FREEDICT = Path(os.environ.get("FREEDICT_PATH", "/tmp/eng-zho.tei"))
KAIKKI = Path(os.environ.get("KAIKKI_PATH", "/tmp/kaikki-en.jsonl"))
PHRASE_REF_DIR = Path(os.environ.get("PHRASE_REF_DIR", "/tmp/phrase-ref"))
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

# Small, explicit overrides for items already caught as semantically wrong during
# source audit. They are ordinary dictionary meanings, not broad model-generated
# rewrites. More entries should be solved through evidence layers below.
EXACT_FIXES = {
    "a drugs ring": "贩毒集团；贩毒团伙",
    "a grant-aided student": "领取助学金的学生",
    "a flow of sb.": "一批接一批的某人；某人不断涌来",
    "a passing vogue": "一时的风尚；短暂流行",
    "a nominal check": "名义上的检查；形式上的检查",
    "a drastic debate": "激烈的辩论",
}


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text).strip().casefold()
    return text


def phrase_key(value: str) -> str:
    text = norm(value)
    text = re.sub(r"\bsb\.?\b|\bsomebody\b|\bsomeone\b", "{person}", text)
    text = re.sub(r"\bsth\.?\b|\bsomething\b", "{thing}", text)
    text = re.sub(r"\bone['’]s\b", "{poss}", text)
    text = text.replace("…", "...")
    text = re.sub(r"\s*\.\.\.\s*", " ... ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def has_han(value: str) -> bool:
    return bool(HAN_RE.search(str(value or "")))


def clean_cn(value: str, limit: int = 140) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\r", " ").replace("\n", "；")
    text = re.sub(r"\b(?:n|v|vt|vi|adj|adv|prep|pron|conj|abbr)\.\s*", "", text, flags=re.I)
    text = re.sub(r"\s*；\s*", "；", text)
    text = re.sub(r"；{2,}", "；", text)
    text = re.sub(r"\s+", " ", text).strip(" ；,，")
    return text[:limit]


def compact_zh(value: str) -> str:
    text = re.sub(r"\[[^\]]{0,20}\]", "", str(value or ""))
    text = re.sub(r"\b(?:n|v|vt|vi|adj|adv|prep|pron|conj|abbr)\.\s*", "", text, flags=re.I)
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
        entries.extend(json.loads(Path(filename).read_text(encoding="utf-8")))
    if len(entries) != 23917:
        raise SystemExit(f"expected 23917 alpha entries, got {len(entries)}")
    return entries


def load_seed9_reference() -> dict[str, tuple[str, str]]:
    raw = json.loads(SEED9_REF.read_text(encoding="utf-8"))
    if raw.get("protocol") != "vix-seed-field-baseline/1" or int(raw.get("seedRevision", 0)) != 9:
        raise SystemExit("invalid Seed 9 reference baseline")
    result: dict[str, tuple[str, str]] = {}
    for row in raw.get("entries", []):
        if len(row) >= 4:
            result[str(row[0])] = (str(row[1] or "").strip(), str(row[3] or ""))
    if len(result) != 23917:
        raise SystemExit(f"Seed 9 reference coverage mismatch: {len(result)}")
    return result


def load_ecdict() -> tuple[dict[str, str], dict[str, str]]:
    exact: dict[str, str] = {}
    phrase: dict[str, str] = {}
    if not ECDICT.exists():
        return exact, phrase
    with ECDICT.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
        for row in csv.DictReader(handle):
            word = str(row.get("word", "") or "").strip()
            trans = clean_cn(row.get("translation", ""))
            if not word or not has_han(trans):
                continue
            exact.setdefault(norm(word), trans)
            phrase.setdefault(phrase_key(word), trans)
    return exact, phrase


def load_coca() -> dict[str, str]:
    result: dict[str, str] = {}
    for path in sorted(COCA_DIR.glob("part*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        matches = list(RANK_RE.finditer(text))
        for index, match in enumerate(matches):
            key = norm(match.group(2))
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            block = text[match.end():end]
            chunks = [clean_cn(x, 90) for x in re.findall(r"[\u3400-\u9fff][^\n`]{0,100}", block)]
            zh = "；".join(x for x in chunks if has_han(x))[:300]
            if key and has_han(zh):
                result.setdefault(key, zh)
    return result


def load_freedict() -> tuple[dict[str, str], dict[str, str]]:
    exact: dict[str, str] = {}
    phrase: dict[str, str] = {}
    if not FREEDICT.exists() or FREEDICT.stat().st_size < 1000:
        return exact, phrase
    try:
        for _event, elem in ET.iterparse(FREEDICT, events=("end",)):
            if not elem.tag.endswith("entry"):
                continue
            orths = [str(node.text or "").strip() for node in elem.iter() if node.tag.endswith("orth") and str(node.text or "").strip()]
            translations: list[str] = []
            for node in elem.iter():
                value = clean_cn(node.text or "")
                if value and has_han(value) and value not in translations:
                    translations.append(value)
            zh = "；".join(translations)[:300]
            if has_han(zh):
                for orth in orths:
                    exact.setdefault(norm(orth), zh)
                    phrase.setdefault(phrase_key(orth), zh)
            elem.clear()
    except ET.ParseError:
        return {}, {}
    return exact, phrase


def load_kaikki() -> tuple[dict[str, str], dict[str, str]]:
    exact: dict[str, str] = {}
    phrase: dict[str, str] = {}
    if not KAIKKI.exists() or KAIKKI.stat().st_size < 1000:
        return exact, phrase
    with KAIKKI.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except Exception:
                continue
            word = str(row.get("word", "") or "").strip()
            chunks: list[str] = []
            for sense in row.get("senses", []) or []:
                for gloss in sense.get("glosses", []) or []:
                    cleaned = clean_cn(gloss)
                    if has_han(cleaned) and cleaned not in chunks:
                        chunks.append(cleaned)
            zh = "；".join(chunks)[:300]
            if word and zh:
                exact.setdefault(norm(word), zh)
                phrase.setdefault(phrase_key(word), zh)
    return exact, phrase


def load_phrase_reference() -> dict[str, list[str]]:
    values: dict[str, list[str]] = defaultdict(list)
    for path in sorted(PHRASE_REF_DIR.glob("*.jsonl")):
        with path.open(encoding="utf-8", errors="replace") as handle:
            for line in handle:
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                for item in row.get("phrases", []) or []:
                    phrase = str(item.get("phrase", "") or "").strip()
                    zh = clean_cn(item.get("translation", ""), 100)
                    if not phrase or not has_han(zh):
                        continue
                    key = phrase_key(phrase)
                    if zh not in values[key]:
                        values[key].append(zh)
    return dict(values)


def choose_phrase_reference(items: list[str]) -> str:
    cleaned = []
    for item in items:
        value = clean_cn(item, 100)
        if not has_han(value):
            continue
        # Avoid sentence/example-like reference material; phrase glosses should be concise.
        if len(value) > 80:
            continue
        if value not in cleaned:
            cleaned.append(value)
    if not cleaned:
        return ""
    cleaned.sort(key=lambda x: (len(x), x))
    return cleaned[0]


def is_blank_structured(entry: dict) -> bool:
    return not str(entry.get("glossHans") or "").strip() and not str(entry.get("glossHant") or "").strip()


def evidence_for(key: str, pkey: str, candidate: str, refs: list[tuple[str, dict[str, str], dict[str, str]]], phrase_ref: dict[str, list[str]]) -> list[str]:
    evidence: list[str] = []
    for name, exact, phrases in refs:
        ref = exact.get(key) or phrases.get(pkey) or ""
        if ref and similar_zh(candidate, ref):
            evidence.append(name)
    phrase_zh = choose_phrase_reference(phrase_ref.get(pkey, []))
    if phrase_zh and similar_zh(candidate, phrase_zh):
        evidence.append("CN-Phrase-Reference")
    return evidence


def main() -> None:
    entries = load_runtime_entries()
    reference = load_seed9_reference()
    ecdict, ecdict_phrase = load_ecdict()
    coca = load_coca()
    freedict, freedict_phrase = load_freedict()
    kaikki, kaikki_phrase = load_kaikki()
    phrase_ref = load_phrase_reference()
    refs = [
        ("ECDICT", ecdict, ecdict_phrase),
        ("FreeDict", freedict, freedict_phrase),
        ("zhWiktionary", kaikki, kaikki_phrase),
        ("COCA-CN", coca, {}),
    ]

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
        seed9_candidate, ref_source = reference.get(entry["id"], ("", ""))
        if not seed9_candidate:
            raise SystemExit(f"no candidate Chinese gloss for {entry['id']} {entry.get('text')}")
        text = str(entry.get("text", "") or "")
        key = norm(text)
        pkey = phrase_key(text)
        candidate = seed9_candidate
        evidence = evidence_for(key, pkey, candidate, refs, phrase_ref)

        explicit = EXACT_FIXES.get(key)
        phrase_cn = choose_phrase_reference(phrase_ref.get(pkey, []))
        ecdict_variant = ecdict_phrase.get(pkey, "")
        freedict_variant = freedict_phrase.get(pkey, "")
        kaikki_variant = kaikki_phrase.get(pkey, "")

        if entry.get("domainId") == USAGE:
            if ref_source != "VIX-9-USAGE-REVIEWED":
                raise SystemExit(f"usage reference was not reviewed: {text} source={ref_source}")
            source = "VIX-A14-USAGE-REVIEWED"
        elif entry.get("domainId") == TECH:
            source = "VIX-A14-TECH-REFERENCE"
        elif explicit:
            candidate = explicit
            source = "VIX-A14-CURATED"
            evidence.append("explicit-audit-fix")
        elif ref_source == "VIX-9-ECDICT":
            if key not in ecdict and not ecdict_variant:
                raise SystemExit(f"ECDICT-tagged reference missing pinned ECDICT entry: {text}")
            source = "VIX-A14-ECDICT-VERIFIED"
            if "ECDICT" not in evidence:
                evidence.append("ECDICT-headword")
        elif ref_source in {"VIX-9-CURATED", "VIX-9-PATTERN", "VIX-9-LANGUAGE-REVIEWED"}:
            source = "VIX-A14-CURATED"
        elif phrase_cn:
            # The external phrase collection is used as a reference to correct an
            # otherwise unverified MT fallback. We store only the concise ordinary
            # Chinese meaning, never the reference database or examples.
            candidate = phrase_cn
            source = "VIX-A14-PHRASE-REFERENCE"
            evidence.append("CN-Phrase-Reference")
        elif ecdict_variant:
            candidate = ecdict_variant
            source = "VIX-A14-ECDICT-VARIANT"
            evidence.append("ECDICT-variant")
        elif freedict_variant:
            candidate = freedict_variant
            source = "VIX-A14-FREEDICT"
            evidence.append("FreeDict-variant")
        elif kaikki_variant:
            candidate = kaikki_variant
            source = "VIX-A14-WIKTIONARY"
            evidence.append("zhWiktionary-variant")
        elif evidence:
            source = "VIX-A14-FALLBACK-CORROBORATED"
        else:
            source = "VIX-A14-AI-FALLBACK"
            fallback_rows.append({
                "id": entry["id"], "text": text, "kind": entry.get("kind"),
                "seed9Source": ref_source, "candidate": candidate,
            })

        candidate = clean_cn(candidate, 140)
        if not candidate or not has_han(candidate):
            raise SystemExit(f"invalid final Chinese candidate: {text} -> {candidate!r}")
        source_counts[source] += 1
        for item in dict.fromkeys(evidence):
            evidence_counts[item] += 1
        targets.append([entry["id"], candidate, source, list(dict.fromkeys(evidence)), ref_source])

    expected_ids = {e["id"] for e in missing_general + missing_tech + usage}
    target_ids = {row[0] for row in targets}
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
            "ECDICTPhraseKeys": len(ecdict_phrase),
            "COCA-CN": len(coca),
            "FreeDict": len(freedict),
            "FreeDictPhraseKeys": len(freedict_phrase),
            "zhWiktionary": len(kaikki),
            "zhWiktionaryPhraseKeys": len(kaikki_phrase),
            "CN-Phrase-Reference": len(phrase_ref),
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
