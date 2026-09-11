#!/usr/bin/env python3
"""Rebuild VIX Seed 9 Simplified-Chinese glosses from English entry data.

The output of this stage is authoritative Mainland Simplified Chinese.  Runtime
canonical conversion is deliberately deferred to tools/apply_seed9.mjs, which
uses VIX's own js/v3-model.js::toTraditional implementation.
"""
from __future__ import annotations

import csv
import glob
import json
import os
import random
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "data" / "seed5-runtime"
ECDICT_PATH = Path(os.environ.get("ECDICT_PATH", "/tmp/ecdict.csv"))
OUT = Path(os.environ.get("SEED9_HANS_OUT", "/tmp/seed9-hans.json"))

try:
    from opencc import OpenCC
except Exception as exc:  # pragma: no cover - workflow installs it
    raise SystemExit(f"opencc is required: {exc}")

T2S = OpenCC("t2s")

# Exact corrections are intentionally small and high-confidence.  They fix
# context-sensitive terms that a context-free translator routinely mistranslates.
TECH_OVERRIDES = {
    "access": "访问",
    "accessibility": "无障碍",
    "adapter": "适配器",
    "address": "地址",
    "admission": "准入",
    "agent": "智能体",
    "alias": "别名",
    "alignment": "对齐",
    "allocation": "分配",
    "ancestor": "祖先节点",
    "argument": "实参",
    "array": "数组",
    "artifact": "制品",
    "assembly": "汇编",
    "assurance": "保障",
    "base64": "Base64 编码",
    "big-endian": "大端序",
    "branch": "分支",
    "cache": "缓存",
    "class": "类",
    "closure": "闭包",
    "commit": "提交",
    "container": "容器",
    "cookie": "Cookie",
    "daemon": "守护进程",
    "deadlock": "死锁",
    "domain": "域",
    "driver": "驱动程序",
    "extension": "扩展",
    "garbage collection": "垃圾回收",
    "hallucination": "幻觉",
    "heap": "堆",
    "hook": "钩子",
    "instance": "实例",
    "interrupt": "中断",
    "kernel": "内核",
    "latency": "延迟",
    "library": "库",
    "little-endian": "小端序",
    "lock": "锁",
    "middleware": "中间件",
    "namespace": "命名空间",
    "node": "节点",
    "package": "包",
    "pipeline": "流水线",
    "port": "端口",
    "process": "进程",
    "queue": "队列",
    "repository": "仓库",
    "runtime": "运行时",
    "scheduler": "调度器",
    "socket": "套接字",
    "stack": "栈",
    "state": "状态",
    "tag": "标签",
    "thread": "线程",
    "trigger": "触发器",
    "watchdog": "看门狗",
    "abstract data type": "抽象数据类型",
    "access control": "访问控制",
    "access token": "访问令牌",
    "application programming interface": "应用程序编程接口",
    "retrieval augmented generation": "检索增强生成",
    "retrieval-augmented generation": "检索增强生成",
    "large language model": "大语言模型",
    "load balancer": "负载均衡器",
    "server-side rendering": "服务器端渲染",
    "server side rendering": "服务器端渲染",
    "virtual machine": "虚拟机",
    "operating system": "操作系统",
    "source code": "源代码",
    "source code repository": "源代码仓库",
    "memory leak": "内存泄漏",
    "memory management": "内存管理",
    "memory mapped file": "内存映射文件",
    "memory-mapped file": "内存映射文件",
    "network address translation": "网络地址转换",
    "role-based access control": "基于角色的访问控制",
    "multi factor authentication": "多因素身份验证",
    "multi-factor authentication": "多因素身份验证",
    "continuous integration": "持续集成",
    "continuous deployment": "持续部署",
    "continuous delivery": "持续交付",
    "blue green deployment": "蓝绿部署",
    "blue-green deployment": "蓝绿部署",
    "canary deployment": "金丝雀部署",
    "canary release": "金丝雀发布",
    "full-text search": "全文搜索",
    "batch inference": "批量推理",
    "data augmentation": "数据增强",
    "infrastructure automation": "基础设施自动化",
    "disjoint set": "不相交集合",
    "counting sort": "计数排序",
    "risk assessment": "风险评估",
}

PHRASE_OVERRIDES = {
    "a spot on one's fame": "名誉上的污点",
    "enforce sth. upon sb.": "强迫某人接受某事",
    "in the presence of ...": "在有……的情况下",
    "what remains unclear is ...": "尚不清楚的是……",
    "favor of": "赞同；支持",
    "succeed in doing": "成功做成某事",
    "be capable of doing": "有能力做某事",
    "as an illustration": "作为例证",
    "be responsible for doing": "负责做某事",
    "allow someone to do": "允许某人做……",
    "from various circles": "来自各界；来自不同圈子",
    "jeopardize one's reputation": "损害自己的声誉",
    "of the question": "关于该问题；问题的",
    "to one's knowledge": "据某人所知",
    "[someone] is capable of [doing] ...": "[某人]有能力[做]……",
    "make it possible to do": "使做……成为可能",
    "there is little evidence that ...": "几乎没有证据表明……",
    "in the same way": "以同样的方式",
    "gain access": "获得访问权限；得以进入",
    "reach consensus": "达成共识",
    "be aware of": "意识到；知道",
    "to take a simple example, ...": "举一个简单的例子，……",
    "from this perspective": "从这个角度看",
    "seize an opportunity": "抓住机会",
    "consider the case of ...": "以……的情况为例；考虑……的情况",
    "at first glance, ...": "乍一看，……",
    "there is no point in [doing] ...": "[做]……没有意义",
    "on condition that ...": "条件是……；只要……",
    "for example, ...": "例如，……",
    "have something done": "让某事由他人完成；使某事被完成",
    "be responsible for": "对……负责；是……的原因",
    "have an impact": "产生影响",
    "... enough to ...": "……足以……",
    "while ...": "当……时；而；虽然",
    "account for differences": "解释差异；说明差异",
    "the aim of this analysis is to ...": "本分析旨在……",
    "be likely to do": "很可能做……",
    "in spite of ...": "尽管……；不顾……",
    "require someone to do": "要求某人做……",
    "give one's attention": "给予关注；注意",
    "discriminate between...and": "区分……和……",
    "be in sympathy with": "同情；赞同",
    "compare to": "与……相比；把……比作",
}

GENERAL_OVERRIDES = {
    "'m": "是；处于",
    "overemphasise": "过分强调",
    # Known legacy failures / misleading specialty-only entries.
    "bourbon": "波旁威士忌；波旁王朝成员",
    "compel": "强迫；迫使",
    "commitment": "承诺；投入；承担的义务",
    "screwdriver": "螺丝刀",
    "pharmacist": "药剂师",
    "statesman": "政治家",
}

POS_PREFIXES = {
    "noun": ("n",),
    "verb": ("v", "vt", "vi"),
    "vern": ("v", "vt", "vi"),
    "adjective": ("a", "adj"),
    "adverb": ("ad", "adv"),
    "pronoun": ("pron",),
    "preposition": ("prep",),
    "conjunction": ("conj",),
    "number": ("num",),
    "interjection": ("int", "interj"),
    "determiner": ("det", "art"),
}

POS_RE = re.compile(r"^\s*(n|v|vt|vi|a|adj|ad|adv|pron|prep|conj|num|int|interj|det|art)\.\s*", re.I)
BRACKET_RE = re.compile(r"\[[^\]]{1,12}\]\s*")
DOMAIN_TAG_RE = re.compile(r"\[(?:法|医|化|计|机|電|电|通信|语|经|贸|数|物|生|农|商|测|地|矿|纺|冶|航|建|军)\]\s*")
NAME_NOISE_RE = re.compile(r"(?:人名|姓氏|地名|\([A-Z][^)]{0,40}\)人名)")
SPACE_RE = re.compile(r"\s+")

MAINLAND_TECH_REPLACEMENTS = {
    "软体": "软件",
    "网路": "网络",
    "资讯": "信息",
    "资料库": "数据库",
    "资料": "数据",
    "程式": "程序",
    "记忆体": "内存",
    "硬碟": "硬盘",
    "伺服器": "服务器",
    "滑鼠": "鼠标",
    "印表机": "打印机",
    "作业系统": "操作系统",
    "档案": "文件",
}


def load_entries():
    entries = []
    for path in sorted(glob.glob(str(RUNTIME / "entries-*.json"))):
        with open(path, encoding="utf-8") as fh:
            entries.extend(json.load(fh))
    if len(entries) != 23917:
        raise RuntimeError(f"expected 23917 entries, got {len(entries)}")
    return entries


def load_ecdict():
    if not ECDICT_PATH.exists():
        raise FileNotFoundError(ECDICT_PATH)
    rows = {}
    with ECDICT_PATH.open(encoding="utf-8", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            word = (row.get("word") or "").strip().lower()
            if word and word not in rows:
                rows[word] = row
    return rows


def normalize_key(text: str) -> str:
    return SPACE_RE.sub(" ", text.strip().lower())


def desired_pos(parts):
    out = set()
    for p in parts or []:
        out.update(POS_PREFIXES.get(str(p).lower(), ()))
    return out


def strip_pos(line: str):
    m = POS_RE.match(line)
    return (m.group(1).lower() if m else None, POS_RE.sub("", line, count=1))


def split_senses(text: str):
    text = text.replace("\\n", "\n")
    text = text.replace("；", ";").replace("，", ",")
    pieces = []
    for part in re.split(r"[;\n]+", text):
        part = part.strip(" ,;。；")
        if not part:
            continue
        # ECDICT often separates genuinely distinct short senses with commas.
        subparts = [x.strip() for x in part.split(",")]
        if len(subparts) <= 5 and all(0 < len(x) <= 24 for x in subparts):
            pieces.extend(subparts)
        else:
            pieces.append(part)
    return pieces


def clean_sense(s: str):
    s = BRACKET_RE.sub("", s)
    s = re.sub(r"^\s*(?:vt|vi|v|n|adj|adv|a|ad|prep|pron|conj|num|int|det|art)\.\s*", "", s, flags=re.I)
    s = re.sub(r"\([^)]*\)人名.*$", "", s)
    s = s.strip(" ,;。；")
    s = SPACE_RE.sub(" ", s)
    return s


def dedupe_senses(senses, limit=4):
    out = []
    seen = set()
    for s in senses:
        s = clean_sense(s)
        if not s or NAME_NOISE_RE.search(s):
            continue
        key = re.sub(r"[\s，,；;。]", "", s)
        if not key or key in seen:
            continue
        # Drop a longer sense if it is just a duplicate expansion of a shorter one.
        if any(key == old or (len(key) > len(old) + 5 and old in key) for old in seen):
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= limit:
            break
    return out


def ecdict_candidate(entry, row):
    raw = (row or {}).get("translation") or ""
    if not raw.strip():
        return ""
    lines = [x.strip() for x in raw.replace("\\n", "\n").splitlines() if x.strip()]
    if not lines:
        return ""

    domain = entry["domainId"]
    pos_need = desired_pos(entry.get("partsOfSpeech"))
    parsed = []
    for line in lines:
        pfx, body = strip_pos(line)
        tagged = bool(BRACKET_RE.search(body))
        computer_tagged = bool(re.search(r"\[(?:计|電|电|通信|网络|电脑|自)\]", body))
        parsed.append((pfx, body, tagged, computer_tagged))

    chosen = []
    if domain == "domain_computer_terms":
        specialist = [body for _, body, _, comp in parsed if comp]
        if specialist:
            chosen = specialist
        elif entry["kind"] == "word":
            chosen = [body for _, body, _, _ in parsed]
        else:
            # Generic phrase translations are useful only when they are concise.
            chosen = [body for _, body, _, _ in parsed if len(body) <= 80]
    else:
        if pos_need:
            matched = [body for pfx, body, _, _ in parsed if pfx in pos_need]
            if matched:
                chosen = matched
        if not chosen:
            untagged = [body for _, body, tagged, _ in parsed if not tagged]
            chosen = untagged or [body for _, body, _, _ in parsed]

    senses = []
    for body in chosen:
        senses.extend(split_senses(body))
    senses = dedupe_senses(senses, limit=4 if entry["kind"] == "word" else 3)
    return "；".join(senses)


def mainland_normalize(text: str, domain: str):
    text = T2S.convert(str(text or ""))
    text = text.replace("...", "……")
    text = text.replace("…...", "……")
    text = text.replace(";", "；")
    text = re.sub(r"\s*；\s*", "；", text)
    text = re.sub(r"\s*，\s*", "，", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^[：:;,；，\s]+|[：:;,；，\s]+$", "", text)
    for src, dst in MAINLAND_TECH_REPLACEMENTS.items():
        if domain != "domain_computer_terms" and src in {"资料", "档案"}:
            continue
        text = text.replace(src, dst)
    text = re.sub(r"…{3,}", "……", text)
    # Keep the gloss compact and remove source-specific metadata remnants.
    text = DOMAIN_TAG_RE.sub("", text)
    text = text.replace("\\n", "；").replace("\n", "；")
    text = re.sub(r"；{2,}", "；", text).strip("；。 ")
    return text


_translate_lock = threading.Lock()
_translate_cache = {}


def google_translate(text: str):
    with _translate_lock:
        if text in _translate_cache:
            return _translate_cache[text]
    query = urllib.parse.urlencode({"client": "gtx", "sl": "en", "tl": "zh-CN", "dt": "t", "q": text})
    url = "https://translate.googleapis.com/translate_a/single?" + query
    last = None
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 VIX-Seed-Rebuild/9"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            value = "".join(seg[0] for seg in data[0] if seg and seg[0]).strip()
            if not value:
                raise RuntimeError("empty translation")
            with _translate_lock:
                _translate_cache[text] = value
            return value
        except Exception as exc:
            last = exc
            time.sleep(min(12.0, 0.7 * (2 ** attempt)) + random.random() * 0.35)
    raise RuntimeError(f"translation failed for {text!r}: {last}")


def initial_candidate(entry, ecdict):
    key = normalize_key(entry["text"])
    domain = entry["domainId"]
    if domain == "domain_computer_terms" and key in TECH_OVERRIDES:
        return TECH_OVERRIDES[key], "VIX-9-TECH"
    if domain in {"domain_general_collocations", "domain_general_english"} and key in PHRASE_OVERRIDES:
        return PHRASE_OVERRIDES[key], "VIX-9-PATTERN"
    if domain == "domain_general_english" and key in GENERAL_OVERRIDES:
        return GENERAL_OVERRIDES[key], "VIX-9-CURATED"

    row = ecdict.get(key)
    if row:
        candidate = ecdict_candidate(entry, row)
        candidate = mainland_normalize(candidate, domain)
        if candidate and len(candidate) <= 180 and not NAME_NOISE_RE.search(candidate):
            # Phrases whose dictionary text remains clearly source-labelled are better regenerated.
            return candidate, "VIX-9-ECDICT"
    return "", ""


def postprocess_translation(entry, translated):
    key = normalize_key(entry["text"])
    domain = entry["domainId"]
    # Re-apply exact corrections after fallback translation.
    if domain == "domain_computer_terms" and key in TECH_OVERRIDES:
        translated = TECH_OVERRIDES[key]
    elif key in PHRASE_OVERRIDES and domain != "domain_computer_terms":
        translated = PHRASE_OVERRIDES[key]
    translated = mainland_normalize(translated, domain)
    # Translate common structural placeholders consistently.
    translated = translated.replace("[Someone]", "[某人]").replace("[someone]", "[某人]")
    translated = translated.replace("[Doing]", "[做]").replace("[doing]", "[做]")
    translated = translated.replace("[Something]", "[某事]").replace("[something]", "[某事]")
    return translated


def validate_hans(entry, gloss):
    if not gloss:
        return "empty"
    if len(gloss) > 240:
        return "too-long"
    if "\\n" in gloss or "\n" in gloss:
        return "newline"
    if NAME_NOISE_RE.search(gloss):
        return "name-noise"
    if re.search(r"\[(?:法|医|化|计|机|電|电|通信|语|經|经|貿|贸)\]", gloss):
        return "domain-label"
    if T2S.convert(gloss) != gloss:
        return "traditional-char"
    if entry["domainId"] == "domain_computer_terms" and any(x in gloss for x in MAINLAND_TECH_REPLACEMENTS):
        return "non-mainland-tech-term"
    # Ordinary English entries should normally produce a Chinese gloss.  Permit identifiers/acronyms.
    if re.search(r"[A-Za-z]", entry["text"]) and not re.search(r"[\u3400-\u9fff]", gloss):
        if not re.fullmatch(r"[A-Za-z0-9+.#/_ -]{1,40}(?: 编码| 协议| 模型| API| 对象)?", gloss):
            return "no-han"
    return ""


def mt_source_text(entry):
    text = entry["text"]
    if entry["domainId"] != "domain_computer_terms":
        text = re.sub(r"\bsth\.(?=\s|$)", "something", text, flags=re.I)
        text = re.sub(r"\bsb\.(?=\s|$)", "someone", text, flags=re.I)
        text = re.sub(r"\bone's\b", "someone's", text, flags=re.I)
    return text


def main():
    entries = load_entries()
    ecdict = load_ecdict()
    results = {}
    sources = {}
    pending = []

    for entry in entries:
        gloss, source = initial_candidate(entry, ecdict)
        if gloss:
            results[entry["id"]] = gloss
            sources[entry["id"]] = source
        else:
            pending.append(entry)

    print(f"PRIMARY {len(results)} FALLBACK {len(pending)}", flush=True)

    # Batch unresolved entries so the public fallback is not rate-limited by thousands
    # of tiny requests. Strong sentinels preserve one-to-one entry boundaries; any malformed
    # batch recursively splits until every entry has an individually validated result.
    def translate_batch(batch):
        if not batch:
            return []
        tagged = "\n".join(f"<<<VIX:{i:03d}>>>{mt_source_text(entry)}" for i, entry in enumerate(batch))
        raw = google_translate(tagged)
        pattern = re.compile(r"<<<VIX:(\d{3})>>>(.*?)(?=(?:\n?<<<VIX:\d{3}>>>)|\Z)", re.S)
        matches = pattern.findall(raw)
        parsed = {}
        for idx, value in matches:
            parsed[int(idx)] = value.strip()
        if len(parsed) == len(batch) and all(i in parsed for i in range(len(batch))):
            return [parsed[i] for i in range(len(batch))]
        if len(batch) == 1:
            stripped = re.sub(r"^<<<VIX:\d{3}>>>", "", raw).strip()
            return [stripped]
        mid = len(batch) // 2
        return translate_batch(batch[:mid]) + translate_batch(batch[mid:])

    batch_size = 12
    batches = [pending[i:i + batch_size] for i in range(0, len(pending), batch_size)]
    print(f"FALLBACK_BATCHES {len(batches)} SIZE {batch_size}", flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        future_to_batch = {pool.submit(translate_batch, batch): batch for batch in batches}
        done = 0
        for fut in as_completed(future_to_batch):
            batch = future_to_batch[fut]
            translations = fut.result()
            if len(translations) != len(batch):
                raise RuntimeError(f"batch translation cardinality mismatch: {len(translations)} != {len(batch)}")
            for entry, raw in zip(batch, translations):
                gloss = postprocess_translation(entry, raw)
                results[entry["id"]] = gloss
                sources[entry["id"]] = "VIX-9-MT"
            done += len(batch)
            if done % 240 < len(batch) or done == len(pending):
                print(f"FALLBACK_PROGRESS {done}/{len(pending)}", flush=True)

    errors = []
    for entry in entries:
        gloss = results.get(entry["id"], "")
        issue = validate_hans(entry, gloss)
        if issue:
            errors.append((entry["id"], entry["text"], issue, gloss, sources.get(entry["id"], "")))

    smoke_expected = {
        ("domain_computer_terms", "agent"): "智能体",
        ("domain_computer_terms", "abstract data type"): "抽象数据类型",
        ("domain_computer_terms", "base64"): "Base64 编码",
        ("domain_general_english", "compel"): "强迫；迫使",
        ("domain_general_english", "bourbon"): "波旁威士忌；波旁王朝成员",
        ("domain_general_english", "give one's attention"): "给予关注；注意",
        ("domain_general_collocations", "require someone to do"): "要求某人做……",
        ("domain_general_collocations", "account for differences"): "解释差异；说明差异",
        ("domain_general_collocations", "be responsible for"): "对……负责；是……的原因",
        ("domain_general_collocations", "there is no point in [doing] ..."): "[做]……没有意义",
    }
    smoke = []
    index = {(e["domainId"], normalize_key(e["text"])): e for e in entries}
    for key, expected in smoke_expected.items():
        e = index.get(key)
        actual = results.get(e["id"], "") if e else "<missing-entry>"
        smoke.append({"domainId": key[0], "text": key[1], "expected": expected, "actual": actual, "ok": actual == expected})
        if actual != expected:
            errors.append((e["id"] if e else "", key[1], "smoke-mismatch", actual, expected))

    if len(results) != len(entries):
        errors.append(("", "", "coverage", str(len(results)), str(len(entries))))

    if errors:
        print("VALIDATION_ERRORS", len(errors))
        for row in errors[:100]:
            print("ERROR", json.dumps(row, ensure_ascii=False))
        raise SystemExit(2)

    payload = {
        "protocol": "vix-seed9-hans-stage/1",
        "seedRevision": 9,
        "entries": [[e["id"], results[e["id"]], sources[e["id"]]] for e in entries],
        "stats": {
            "count": len(entries),
            "sourceCounts": dict(Counter(sources.values())),
            "fallbackCount": sum(1 for x in sources.values() if x == "VIX-9-MT"),
            "smoke": smoke,
        },
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("WROTE", OUT, "COUNT", len(entries), "SOURCES", payload["stats"]["sourceCounts"], flush=True)


if __name__ == "__main__":
    main()
