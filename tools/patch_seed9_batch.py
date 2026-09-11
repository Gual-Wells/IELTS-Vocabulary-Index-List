#!/usr/bin/env python3
from pathlib import Path

p = Path('tools/rebuild_seed9.py')
s = p.read_text(encoding='utf-8')
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
