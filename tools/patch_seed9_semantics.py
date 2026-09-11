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
    # Mainland wording/orthography fixes that are valid across domains.
    text = text.replace("做为", "作为").replace("想像", "想象")
    text = re.sub(r"…{3,}", "……", text)
    # Keep the gloss compact and remove source-specific metadata remnants.
'''
if old in s:
    s=s.replace(old,new,1)

# Curate phrases/frames where dictionary lookup or isolated MT loses the intended
# learning pattern. These remain keyed by the exact English seed text.
marker='PHRASE_OVERRIDES = {\n'
extras='''    "a spot on one's fame": "名誉上的污点",
    "enforce sth. upon sb.": "强迫某人接受某事",
    "in the presence of ...": "在有……的情况下",
    "what remains unclear is ...": "尚不清楚的是……",
    "favor of": "赞同；支持",
    "succeed in doing": "成功做成某事",
    "be capable of doing": "有能力做某事",
    "as an illustration": "作为例证",
    "be responsible for doing": "负责做某事",
    "allow someone to do": "允许某人做……",
    "in this case": "在这种情况下",
    "it is essential that ...": "……是必要的；必须……",
    "hardly had ... when ...": "刚……就……",
    "prefer doing to doing": "比起做……更喜欢做……",
    "hear someone do": "听到某人做……",
    "by doing": "通过做……",
    "so that ...": "以便……；使得……",
    "whereas": "然而；而",
    "second": "第二；其次",
    "next": "接下来；其次",
    "object to doing": "反对做……",
    "that is": "也就是说",
    "such as": "例如；诸如",
    "be resistant to": "抵抗……；对……有抵抗力",
    "one of the most [adjective] ...": "最[形容词]的……之一",
    "as": "作为；如同；当……时；因为",
    "given that ..., ...": "鉴于……，……",
    "in contrast to ...": "与……相比；与……形成对比",
    "there are several reasons why ...": "……有若干原因",
    "analogy between": "……之间的类比",
'''
if '"in this case": "在这种情况下"' not in s:
    assert marker in s
    s=s.replace(marker,marker+extras,1)
elif '"given that ..., ...":' not in s:
    # Previous semantic pass already inserted the first block; append only new polish rules.
    polish='''    "as": "作为；如同；当……时；因为",
    "given that ..., ...": "鉴于……，……",
    "in contrast to ...": "与……相比；与……形成对比",
    "there are several reasons why ...": "……有若干原因",
    "analogy between": "……之间的类比",
'''
    s=s.replace(marker,marker+polish,1)

# Known ordinary-English dictionary failures or strongly outdated/irrelevant senses.
gmarker='GENERAL_OVERRIDES = {\n'
gextras='''    "preside at": "主持；担任……主席",
    "ye": "你们；你（古语）",
    "fall under sb.'s observation": "引起某人的注意；被某人观察到",
    "lose one's nerves": "惊慌失措；失去勇气",
    "be reputed to be sth.": "据称是……；被认为是……",
    "tolerance for": "对……的容忍度；对……的耐受性",
    "go ahead": "继续；进行；先走",
    "transcription": "转录；文字记录；抄写",
    "artificial": "人工的；人造的；虚假的",
    "essay": "文章；短文；论文",
    "plastic": "塑料；塑料制的；可塑的",
    "publicly": "公开地；公然地",
    "foster": "培养；促进；收养；养育的",
    "shortsighted": "近视的；目光短浅的",
    "under oath": "宣誓后；在誓言约束下",
    "converge": "汇聚；会聚；趋同",
    "build on": "以……为基础；在……上发展",
    "sportsman": "运动员；体育爱好者",
    "live up to": "达到；不辜负（期望）",
    "openness": "开放；开放性；坦诚",
    "reverend": "牧师；教士；可敬的",
    "unencumbered": "不受束缚的；没有负担的",
    "filial": "子女的；孝顺的",
    "stutter": "口吃；结巴；结结巴巴地说",
    "sphere": "球；球体；天体；范围；领域",
'''
if '"preside at": "主持；担任……主席"' not in s:
    assert gmarker in s
    s=s.replace(gmarker,gmarker+gextras,1)
elif '"plastic": "塑料；塑料制的；可塑的"' not in s:
    polish='''    "plastic": "塑料；塑料制的；可塑的",
    "publicly": "公开地；公然地",
    "foster": "培养；促进；收养；养育的",
    "shortsighted": "近视的；目光短浅的",
    "under oath": "宣誓后；在誓言约束下",
    "converge": "汇聚；会聚；趋同",
    "build on": "以……为基础；在……上发展",
    "sportsman": "运动员；体育爱好者",
    "live up to": "达到；不辜负（期望）",
    "openness": "开放；开放性；坦诚",
    "reverend": "牧师；教士；可敬的",
    "unencumbered": "不受束缚的；没有负担的",
    "filial": "子女的；孝顺的",
    "stutter": "口吃；结巴；结结巴巴地说",
    "sphere": "球；球体；天体；范围；领域",
'''
    s=s.replace(gmarker,gmarker+polish,1)

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
