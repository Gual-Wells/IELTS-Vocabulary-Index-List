#!/usr/bin/env python3
from pathlib import Path

p = Path('tools/rebuild_seed9.py')
s = p.read_text(encoding='utf-8')

# Mainland terminology is a storage/content invariant for every domain, not only
# the dedicated computer-term domain. ECDICT can surface Taiwan/HK terminology in
# ordinary English entries too, so normalize it globally before canonical encoding.
old_scope = '''    if domain == "domain_computer_terms":
        for src, dst in MAINLAND_TECH_REPLACEMENTS.items():
            text = text.replace(src, dst)
'''
new_scope = '''    for src, dst in MAINLAND_TECH_REPLACEMENTS.items():
        text = text.replace(src, dst)
'''
if old_scope in s:
    s = s.replace(old_scope, new_scope, 1)

# Deterministic edge cases discovered by complete batched passes.
phrase_marker = 'PHRASE_OVERRIDES = {\n'
phrase_extra = '''    "from various circles": "来自各界；来自不同圈子",
    "jeopardize one's reputation": "损害自己的声誉",
    "of the question": "关于该问题；问题的",
    "to one's knowledge": "据某人所知",
'''
if '"from various circles":' not in s:
    assert phrase_marker in s
    s = s.replace(phrase_marker, phrase_marker + phrase_extra, 1)

general_marker = 'GENERAL_OVERRIDES = {\n'
general_extra = '''    "'m": "是；处于",
    "overemphasise": "过分强调",
'''
if '"overemphasise":' not in s:
    assert general_marker in s
    s = s.replace(general_marker, general_marker + general_extra, 1)

# The source entry lives in General English, not the collocation domain.
s = s.replace(
    '("domain_general_collocations", "give one\'s attention"): "给予关注；注意",',
    '("domain_general_english", "give one\'s attention"): "给予关注；注意",',
)

start_marker = '    # Fallback is used only where the bilingual lexicon / curated context rules do not resolve'
end_marker = '\n    errors = []'
start = s.index(start_marker)
end = s.index(end_marker, start)
replacement = '''    # Batch unresolved entries so the public fallback is not rate-limited by thousands
    # of tiny requests. Strong sentinels preserve one-to-one entry boundaries; any malformed
    # batch recursively splits until every entry has an individually validated result.
    def translate_batch(batch):
        if not batch:
            return []
        tagged = "\\n".join(f"<<<VIX:{i:03d}>>>{entry['text']}" for i, entry in enumerate(batch))
        raw = google_translate(tagged)
        pattern = re.compile(r"<<<VIX:(\\d{3})>>>(.*?)(?=(?:\\n?<<<VIX:\\d{3}>>>)|\\Z)", re.S)
        matches = pattern.findall(raw)
        parsed = {}
        for idx, value in matches:
            parsed[int(idx)] = value.strip()
        if len(parsed) == len(batch) and all(i in parsed for i in range(len(batch))):
            return [parsed[i] for i in range(len(batch))]
        if len(batch) == 1:
            stripped = re.sub(r"^<<<VIX:\\d{3}>>>", "", raw).strip()
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
'''
s = s[:start] + replacement + s[end:]
p.write_text(s, encoding='utf-8')
print('BATCH_PATCH_OK')
