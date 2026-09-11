#!/usr/bin/env python3
from pathlib import Path

p=Path('tools/rebuild_seed9.py')
s=p.read_text(encoding='utf-8')

# Mainland lexical normalization must not destroy legitimate Mainland senses such
# as 资料/档案 in ordinary English; those broad replacements are technical-only.
old='''    for src, dst in MAINLAND_TECH_REPLACEMENTS.items():
        text = text.replace(src, dst)
    # Keep the gloss compact and remove source-specific metadata remnants.
'''
new='''    for src, dst in MAINLAND_TECH_REPLACEMENTS.items():
        if domain != "domain_computer_terms" and src in {"资料", "档案"}:
            continue
        text = text.replace(src, dst)
    text = re.sub(r"…{3,}", "……", text)
    # Keep the gloss compact and remove source-specific metadata remnants.
'''
if old in s:
    s=s.replace(old,new,1)

# Curate high-risk grammatical phrases that isolated MT tends to translate too literally.
marker='PHRASE_OVERRIDES = {\n'
extras='''    "enforce sth. upon sb.": "强迫某人接受某事",
    "in the presence of ...": "在有……的情况下",
    "what remains unclear is ...": "尚不清楚的是……",
    "favor of": "赞同；支持",
    "succeed in doing": "成功做成某事",
    "be capable of doing": "有能力做某事",
    "as an illustration": "作为例证",
    "be responsible for doing": "负责做某事",
    "allow someone to do": "允许某人做……",
'''
if '"enforce sth. upon sb.":' not in s:
    assert marker in s
    s=s.replace(marker,marker+extras,1)

# Expand textbook abbreviations before MT while preserving the original Entry text.
main_marker='def main():\n'
helper='''def mt_source_text(entry):
    text = entry["text"]
    if entry["domainId"] != "domain_computer_terms":
        text = re.sub(r"\\bsth\\.(?=\\s|$)", "something", text, flags=re.I)
        text = re.sub(r"\\bsb\\.(?=\\s|$)", "someone", text, flags=re.I)
        text = re.sub(r"\\bone's\\b", "someone's", text, flags=re.I)
    return text


'''
if 'def mt_source_text(entry):' not in s:
    assert main_marker in s
    s=s.replace(main_marker,helper+main_marker,1)
s=s.replace('f"<<<VIX:{i:03d}>>>{entry[\'text\']}"', 'f"<<<VIX:{i:03d}>>>{mt_source_text(entry)}"')

p.write_text(s,encoding='utf-8')
print('SEMANTIC_GENERATOR_PATCH_OK')
