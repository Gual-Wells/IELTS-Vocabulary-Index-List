#!/usr/bin/env python3
from __future__ import annotations
import glob, json, os, re, subprocess
from pathlib import Path
from opencc import OpenCC

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'data'/'seed5-runtime'
STAGE=Path(os.environ.get('SEED9_HANS_OUT','/tmp/seed9-hans.json'))
SEED8_COMMIT='baf07a50b195d1a0d24d192ceccb47c584d2d25a'
T2S=OpenCC('t2s')

TECH_REPL={
    '软体':'软件','网路':'网络','资讯':'信息','资料库':'数据库','资料':'数据','程式':'程序',
    '记忆体':'内存','硬碟':'硬盘','伺服器':'服务器','滑鼠':'鼠标','印表机':'打印机',
    '作业系统':'操作系统','档案':'文件','二进位':'二进制','函式':'函数','物件':'对象',
    '超文字':'超文本','协定':'协议','非同步':'异步','可延伸':'可扩展','位元':'比特',
    '快取':'缓存','预设':'默认','外挂':'插件','资料结构':'数据结构','演算法':'算法',
}

# High-confidence terminology where an old dictionary, generic MT, or historical
# naming convention is especially likely to choose the wrong semantic domain.
TECH_EXACT={
    'abstraction':'抽象',
    'accelerator':'加速器',
    'acceptance test':'验收测试',
    'accessibility tree':'无障碍树',
    'accessible name':'无障碍名称',
    'accountability':'可追责性',
    'activation':'激活',
    'activation function':'激活函数',
    'active learning':'主动学习',
    'actor model':'参与者模型',
    'actuator':'执行器',
    'addon':'附加组件',
    'addressing':'寻址',
    'adjacency':'邻接',
    'adversarial example':'对抗样本',
    'adversary':'对手',
    'agent loop':'智能体循环',
    'agentic workflow':'智能体工作流',
    'aggregation':'聚合',
    'ahead-of-time compilation':'预先编译（AOT）',
    'ai guardrail':'AI 护栏',
    'ai red teaming':'AI 红队测试',
    'ajax':'Ajax',
    'analytics':'数据分析',
    'annotation':'注解',
    'anycast':'任播',
    'artifact':'制品',
    'assembly':'汇编',
    'assurance':'保障',
    'async':'异步',
    'asynchronous':'异步',
    'authentication':'身份验证',
    'authorization':'授权',
    'backpropagation':'反向传播',
    'cache':'缓存',
    'callback':'回调',
    'checkpoint':'检查点',
    'class':'类',
    'closure':'闭包',
    'commit':'提交',
    'container':'容器',
    'daemon':'守护进程',
    'deduplication':'去重',
    'dependency':'依赖项',
    'descriptor':'描述符',
    'dispatcher':'分派器',
    'driver':'驱动程序',
    'embedding':'嵌入',
    'endpoint':'端点',
    'executor':'执行器',
    'garbage collection':'垃圾回收',
    'hallucination':'幻觉',
    'handler':'处理程序',
    'heap':'堆',
    'host':'主机',
    'hook':'钩子',
    'html':'超文本标记语言',
    'http':'超文本传输协议',
    'https':'超文本传输安全协议',
    'inference':'推理',
    'instance':'实例',
    'interrupt':'中断',
    'kernel':'内核',
    'latency':'延迟',
    'listener':'监听器',
    'memoization':'记忆化',
    'middleware':'中间件',
    'namespace':'命名空间',
    'node':'节点',
    'package':'包',
    'pipeline':'流水线',
    'port':'端口',
    'process':'进程',
    'promise':'Promise 对象',
    'proxy':'代理',
    'queue':'队列',
    'repository':'仓库',
    'retry':'重试',
    'runtime':'运行时',
    'scheduler':'调度器',
    'serialization':'序列化',
    'socket':'套接字',
    'stack':'栈',
    'state':'状态',
    'synchronous':'同步',
    'tag':'标签',
    'thread':'线程',
    'token':'词元',
    'trigger':'触发器',
    'watchdog':'看门狗',
    'websocket':'WebSocket',
    'xml':'可扩展标记语言',
}

DOMAIN_TAG_RE=re.compile(r'\[(?:法|医|化|计|机|電|电|通信|语|经|贸|数|物|生|农|商|测|地|矿|纺|冶|航|建|军)\]\s*')

def normalize_tech(text:str)->str:
    text=T2S.convert(str(text or ''))
    text=DOMAIN_TAG_RE.sub('',text)
    text=text.replace('\\n','；').replace('\n','；').replace(';','；')
    for a,b in TECH_REPL.items(): text=text.replace(a,b)
    text=re.sub(r'\s*；\s*','；',text)
    text=re.sub(r'；{2,}','；',text)
    text=re.sub(r'…{3,}','……',text)
    return text.strip(' ；。')

def git_json(commit:str,path:str):
    raw=subprocess.check_output(['git','show',f'{commit}:{path}'])
    return json.loads(raw.decode('utf-8'))

def load_entries():
    out=[]
    for p in sorted(glob.glob(str(RUNTIME/'entries-*.json'))):
        out.extend(json.load(open(p,encoding='utf-8')))
    return out

stage=json.load(STAGE.open(encoding='utf-8'))
if stage.get('protocol')!='vix-seed9-hans-stage/1' or len(stage.get('entries',[]))!=23917:
    raise SystemExit('invalid input stage')
entries=load_entries()
by_entry={e['id']:e for e in entries}
old=[]
for name in ('entries-000.json','entries-001.json'):
    old.extend(git_json(SEED8_COMMIT,f'data/seed5-runtime/{name}'))
old_by_id={e['id']:e for e in old}
if len(old_by_id)!=23917: raise SystemExit('Seed 8 reference coverage mismatch')

reviewed=0
changed=0
fallback_to_new=0
out=[]
for row in stage['entries']:
    eid,hans,source=row
    entry=by_entry[eid]
    if entry['domainId']=='domain_computer_terms':
        reviewed+=1
        key=entry['normalizedText']
        chosen=hans
        chosen_source=source
        if source!='VIX-9-TECH':
            old_gloss=normalize_tech(old_by_id[eid].get('gloss',''))
            if old_gloss and len(old_gloss)<=120 and re.search(r'[\u3400-\u9fffA-Za-z0-9]',old_gloss):
                chosen=old_gloss
                chosen_source='VIX-9-TECH-REVIEWED'
            else:
                fallback_to_new+=1
                chosen_source='VIX-9-TECH-REVIEWED-NEW'
        if key in TECH_EXACT:
            chosen=TECH_EXACT[key]
            chosen_source='VIX-9-TECH-REVIEWED'
        chosen=normalize_tech(chosen)
        if chosen!=hans: changed+=1
        hans,source=chosen,chosen_source
    else:
        # Final punctuation normalization for rebuilt general/collocation glosses.
        cleaned=re.sub(r'…{3,}','……',hans).strip()
        if cleaned!=hans: changed+=1
        hans=cleaned
    if not hans: raise SystemExit(f'empty refined gloss {eid}')
    out.append([eid,hans,source])

stage['entries']=out
stage['semanticReview']={
    'computerReviewed':reviewed,
    'computerChanged':changed,
    'fallbackToNew':fallback_to_new,
    'reference':'Seed 8 technical glosses used only as domain-disambiguation cross-check',
}
STAGE.write_text(json.dumps(stage,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('SEMANTIC_REFINEMENT_OK',json.dumps(stage['semanticReview'],ensure_ascii=False))
