#!/usr/bin/env python3
from __future__ import annotations
import glob,json,os,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'data'/'seed5-runtime'
STAGE=Path(os.environ.get('SEED9_HANS_OUT','/tmp/seed9-hans.json'))

# Exact corrections from a complete 595/595 review of the general-usage domain.
# Correct existing glosses are intentionally retained; only semantically wrong,
# incomplete, dictionary-noisy, or unnatural learning glosses are rewritten.
OVERRIDES={
    "... enough for ... to do":"……足以让……做……",
    "[someone] finds it [adjective] to ...":"[某人]认为做……是[形容词]的",
    "[someone] is expected to ...":"预计[某人]会……；[某人]应当……",
    "[something] is responsible for ...":"[某事]是……的原因；[某事]导致……",
    "[something] ranges from ... to ...":"[某事物]从……到……不等",
    "[something] varies according to ...":"[某事物]随……而变化",
    "a balanced approach would be to ...":"一种平衡的做法是……",
    "a further consideration is ...":"另一个需要考虑的因素是……",
    "admit doing":"承认做过……",
    "address a problem":"处理；应对问题",
    "after doing":"做……之后",
    "all in all":"总而言之",
    "alternatively":"或者；作为另一种选择",
    "although this is true":"尽管如此；虽然确实如此",
    "as [adjective] as ...":"和……一样[形容词]",
    "as opposed to ...":"与……相对；而不是……",
    "as soon as ...":"一……就……",
    "at this point":"此时；在这一点上",
    "avoid doing":"避免做……",
    "be able to do":"能够做……",
    "be about to do":"即将做……",
    "be accessible to":"可供……访问；对……开放",
    "be accustomed to doing":"习惯于做……",
    "be available to":"可供……使用；对……可用",
    "be closely related to":"与……密切相关",
    "be committed to doing":"致力于做……",
    "be compatible with":"与……兼容",
    "be concerned about":"担心；关心……",
    "be due to do":"预定做……；预计将做……",
    "be essential for":"对……至关重要",
    "be exposed to":"暴露于；接触到……",
    "be involved in":"参与；涉及；卷入……",
    "be subject to":"受……影响或约束；须经……",
    "be supposed to ...":"应该……；据认为……",
    "be supposed to do":"应该做……",
    "be used to [do] ...":"被用于[做]……",
    "be used to [doing] ...":"习惯于[做]……",
    "be used to doing":"习惯于做……",
    "be vulnerable to":"易受……影响；易遭……侵害",
    "both ... and ...":"既……又……；……和……都",
    "cannot afford to do":"承担不起做……；不能冒险做……",
    "cannot help [doing] ...":"忍不住[做]……",
    "cannot help doing":"忍不住做……",
    "challenge an assumption":"质疑假设",
    "considering that ..., ...":"考虑到……，……",
    "conversely":"反过来说；相反",
    "create an incentive":"提供激励；形成激励作用",
    "deny doing":"否认做过……",
    "despite doing":"尽管做了……",
    "draw a distinction":"作出区分；划清界限",
    "find it ... to do":"认为做……是……的",
    "finish doing":"做完……",
    "first and foremost":"首先；最重要的是",
    "for another":"其次；另一方面",
    "for the purposes of this discussion, ...":"就本次讨论而言，……",
    "for this reason":"因此；出于这个原因",
    "granted":"诚然；即便如此",
    "had better do":"最好做……",
    "had it not been for ..., ...":"若不是……，……",
    "have difficulty doing":"做……有困难",
    "have no choice but to do":"别无选择，只能做……",
    "hear someone doing":"听到某人正在做……",
    "help someone do":"帮助某人做……",
    "however":"然而；不过",
    "identify a gap":"发现缺口；发现差距",
    "in addition to ...":"除了……之外；还……",
    "in brief":"简言之",
    "in conclusion":"总之；最后",
    "in contrast":"相比之下；相反",
    "in general":"一般来说；总体上",
    "in order that ...":"为了使……；以便……",
    "in order to do":"为了做……",
    "in practical terms":"从实际角度看；具体地说",
    "in the long term":"从长远来看；长期而言",
    "in turn":"继而；反过来",
    "it follows that ...":"由此可见；因此可以得出……",
    "it is [adjective] that ...":"……是[形容词]的",
    "it is [adjective] to [verb] ...":"[动词]……是[形容词]的",
    "it is not until ... that ...":"直到……才……",
    "it is often argued that ...":"常有人认为；主张……",
    "it is worth considering whether ...":"值得考虑是否……",
    "it takes ... to do":"做……需要……",
    "it takes [time] to ...":"做……需要[时间]",
    "it was [someone] who ...":"正是[某人]……",
    "it was not until ... that ...":"直到……才……",
    "it would be reasonable to ...":"……是合理的；可以合理地……",
    "keep track of":"跟踪；掌握……的动态",
    "look forward to doing":"期待做……",
    "maintain quality":"保持质量",
    "make a decision":"做出决定",
    "make progress":"取得进展；取得进步",
    "manage expectations":"管理预期",
    "meet demand":"满足需求",
    "mind doing":"介意做……",
    "most importantly":"最重要的是",
    "on balance":"综合来看；总的来说",
    "on closer inspection, ...":"仔细观察后；进一步审视后，……",
    "only when ... can [someone] ...":"只有当……时，[某人]才能……",
    "overall":"总体而言；总的来说",
    "postpone doing":"推迟做……",
    "previously":"此前；以前",
    "put differently":"换句话说；换一种说法",
    "recommend doing":"建议做……",
    "risk doing":"冒险做……",
    "see someone do":"看到某人做……",
    "see someone doing":"看到某人正在做……",
    "several factors contribute to ...":"有若干因素促成；造成……",
    "similarly":"同样地；类似地",
    "since":"因为；由于；自……以来",
    "so ... that ...":"如此……以至于……",
    "so [adjective] that ...":"如此[形容词]，以至于……",
    "so as to do":"以便做……",
    "specifically":"具体来说；具体地；尤其",
    "still":"仍然；不过；尽管如此",
    "such ... that ...":"如此……以至于……",
    "such [noun] that ...":"如此……的[名词]，以至于……",
    "suggest doing":"建议做……",
    "take advantage of":"利用；充分利用……",
    "taking everything into account, ...":"综合考虑各方面因素，……",
    "thanks to ...":"由于；多亏……",
    "the fact that ...":"……这一事实",
    "the findings suggest that ...":"研究结果表明……",
    "the implications are significant.":"其影响和意义重大",
    "the more [someone] ..., the less ...":"[某人]越……，……就越少",
    "the question is whether ...":"问题在于是否……",
    "the way in which ...":"……的方式；……的方法",
    "there are several reasons for ...":"……有若干原因",
    "there is a growing tendency to ...":"越来越倾向于……；有日益……的趋势",
    "thereby":"从而；由此",
    "think it ... to do":"认为做……是……的",
    "this has the effect of [doing] ...":"这会起到[做]……的作用",
    "this is partly due to ...":"这在一定程度上是由于……",
    "this may be explained by ...":"这可以用……来解释",
    "this raises the question of ...":"这引出了……的问题",
    "this section examines ...":"本节探讨……",
    "this supports the view that ...":"这支持……这一观点",
    "thus":"因此；从而",
    "to conclude":"总之；最后",
    "to illustrate":"为了说明；举例说明",
    "too ... for ... to do":"太……，以至于……无法做……",
    "too ... to ...":"太……而不能……",
    "too [adjective] to ...":"太[形容词]而无法……",
    "used to do":"过去常常做……",
    "waste time doing":"浪费时间做……",
    "were [someone] to ..., ...":"如果[某人]……，那么……",
    "what makes [something] [adjective] is ...":"使[某事物]显得[形容词]的是……",
    "while it is true that ...":"虽然……确实如此，但……",
    "with the aim of [doing] ...":"旨在[做]……；以[做]……为目的",
    "without [doing] ...":"不[做]……；没有[做]……",
    "without doing":"不做……；没有做……",
    "would rather do than do":"宁愿做……也不愿做……",
    "yet":"然而；但是；仍然",
}

entries=[]
for p in sorted(glob.glob(str(RUNTIME/'entries-*.json'))):
    entries.extend(json.load(open(p,encoding='utf-8')))
by_id={e['id']:e for e in entries}
usage=[e for e in entries if e.get('domainId')=='domain_general_collocations']
if len(usage)!=595:
    raise SystemExit(f'expected 595 general-usage entries, got {len(usage)}')

stage=json.load(STAGE.open(encoding='utf-8'))
if stage.get('protocol')!='vix-seed9-hans-stage/1' or len(stage.get('entries',[]))!=23917:
    raise SystemExit('invalid Seed 9 stage')

reviewed=0
changed=0
override_hits=set()
out=[]
for row in stage['entries']:
    eid,hans,source=row
    e=by_id[eid]
    if e.get('domainId')=='domain_general_collocations':
        reviewed+=1
        key=str(e.get('text') or '').strip().casefold()
        if key in OVERRIDES:
            override_hits.add(key)
            new=OVERRIDES[key]
            if new!=hans:
                changed+=1
            hans=new
        if not str(hans).strip():
            raise SystemExit(f'empty usage gloss: {eid} {e.get("text")}')
        # Every usage item has now received an explicit review decision.
        source='VIX-9-USAGE-REVIEWED'
    out.append([eid,hans,source])

missing=set(OVERRIDES)-override_hits
if missing:
    raise SystemExit('usage override keys not found: '+json.dumps(sorted(missing),ensure_ascii=False))
if reviewed!=595:
    raise SystemExit(f'usage review coverage mismatch: {reviewed}')

review=dict(stage.get('semanticReview') or {})
review.update({
    'generalUsageReviewed':reviewed,
    'generalUsageChanged':changed,
    'generalUsageOverrideCount':len(OVERRIDES),
    'generalUsageDecisionCoverage':'595/595',
})
stage['semanticReview']=review
stage['entries']=out
STAGE.write_text(json.dumps(stage,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('USAGE_REFINEMENT_OK',json.dumps(review,ensure_ascii=False))
