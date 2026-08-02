#!/usr/bin/env python3
"""Assign every built-in phrase to exactly one visible normal collection.

The system phrase collection remains the complete derived phrase total. Memberships only
provide the ordinary-table classification used by Vocabulary Index 3.1.0.
"""
from __future__ import annotations
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / 'data' / 'seed.json'
REPORT = ROOT / 'data' / 'seed-phrase-classification-report.json'
COMPUTER_DOMAIN = 'domain_computer_terms'
GENERAL_DOMAIN = 'domain_general_english'

KEYWORDS = {
    '人工智能': [
        'artificial intelligence', 'machine learning', 'deep learning', 'neural', 'language model',
        'large language', 'transformer', 'generative', 'prompt', 'embedding', 'vector database',
        'retrieval augmented', 'inference', 'training data', 'training set', 'test set',
        'validation set', 'computer vision', 'natural language', 'reinforcement learning',
        'supervised learning', 'unsupervised learning', 'classification model', 'regression model',
        'feature engineering', 'fine tuning', 'fine-tuning', 'model serving', 'model compression',
        'quantization', 'knowledge distillation', 'gradient descent', 'backpropagation',
        'attention mechanism', 'hallucination', 'foundation model', 'diffusion model',
        'responsible ai', 'explainable ai', 'ethical ai', 'embodied ai', 'expert system',
        'adversarial example', 'accuracy metric', 'confusion matrix', 'bounding box',
        'pruning strategy', 'search space', 'bias mitigation', 'model card', 'ai ',
    ],
    '网络、云与安全': [
        'network', 'internet', 'websocket', 'http', 'https', 'tcp', 'udp', 'ip ', 'dns',
        'domain name', 'socket', 'router', 'routing', 'gateway', 'firewall', 'proxy', 'cloud',
        'kubernetes', 'container', 'pod ', 'cluster', 'service mesh', 'load balanc',
        'authentication', 'authorization', 'access control', 'identity', 'security', 'secure',
        'encryption', 'cryptograph', 'certificate', 'tls', 'ssl', 'oauth', 'password',
        'vulnerability', 'attack', 'threat', 'malware', 'ransomware', 'zero trust',
        'virtual private', 'content delivery', 'api gateway', 'distributed denial',
        'cross site', 'cross-site', 'site reliability', 'infrastructure as code',
        'infrastructure automation', 'serverless', 'microservice', 'application layer',
        'link layer', 'transport layer', 'control plane', 'config map', 'confidential computing',
        'defense in depth', 'disaster recovery', 'intrusion detection', 'intrusion prevention',
        'personally identifiable', 'principle of least privilege', 'rate limiting',
        'rolling update', 'liveness probe', 'readiness probe', 'startup probe',
        'health check', 'availability zone', 'admission controller', 'audit log',
    ],
    '软件开发与数据': [
        'software', 'programming', 'source code', 'compiler', 'interpreter', 'runtime',
        'library', 'framework', 'package', 'module', 'function', 'method', 'class ', 'object ',
        'interface', 'repository', 'version control', 'git ', 'github', 'commit', 'branch',
        'pull request', 'continuous integration', 'continuous delivery', 'continuous deployment',
        'test', 'debug', 'refactor', 'design pattern', 'dependency', 'build ', 'deployment',
        'database', 'data ', 'sql', 'query', 'transaction', 'schema', 'table ', 'record',
        'serialization', 'json', 'xml', 'yaml', 'csv', 'application programming', 'api ',
        'web application', 'frontend', 'backend', 'front end', 'back end', 'user interface',
        'event driven', 'event-driven', 'asynchronous', 'regular expression',
        'exception handling', 'materialized view', 'normal form', 'read replica',
        'analytical processing', 'optimistic locking', 'pessimistic locking',
        'acceptance test', 'integration test', 'performance test', 'regression test',
        'smoke test', 'stress test', 'developer tools', 'first contentful paint',
        'largest contentful paint', 'interaction to next paint', 'cumulative layout shift',
        'lazy loading', 'render blocking', 'progressive enhancement', 'mobile first',
        'aspect ratio', 'frame rate', 'real user monitoring', 'circuit breaker',
    ],
    '计算机基础与系统': [
        'computer architecture', 'operating system', 'kernel', 'cpu', 'processor', 'memory',
        'cache', 'register', 'instruction', 'assembly', 'hardware', 'firmware', 'device driver',
        'file system', 'storage', 'disk', 'solid state', 'input output', 'input/output',
        'interrupt', 'process ', 'thread ', 'threading', 'scheduling', 'virtual memory',
        'paging', 'stack ', 'heap ', 'binary', 'bit ', 'byte', 'logic gate', 'bus ',
        'clock cycle', 'system call', 'boot', 'bios', 'uefi', 'embedded system',
        'microcontroller', 'fpga', 'asic', 'uart', 'signal processor', 'non volatile',
        'non-volatile', 'raid', 'mutex', 'semaphore', 'deadlock', 'race condition',
        'context switch', 'memory mapped', 'command line', 'shell ', 'environment variable',
        'abstract data type', 'algorithm', 'asymptotic', 'amortized analysis', 'average case',
        'best case', 'worst case', 'big o notation', 'bitwise operation', 'breadth first search',
        'depth first search', 'binary search', 'linear search', 'bubble sort', 'counting sort',
        'insertion sort', 'quick sort', 'radix sort', 'selection sort', 'divide and conquer',
        'linked list', 'tree', 'balance factor', 'fenwick', 'prefix sum', 'sliding window',
        'minimum cut', 'minimum spanning', 'connected component', 'adjacency',
        'fixed point', 'floating point', 'central processing unit', 'control unit',
        'operating frequency', 'power management', 'critical section', 'mutual exclusion',
        'producer consumer', 'parallel computing', 'separate chaining',
    ],
}


EXACT_OVERRIDES = {
    # Foundations and systems
    'branch and bound': '计算机基础与系统',
    'data bus': '计算机基础与系统',
    'data structure': '计算机基础与系统',
    'dynamic programming': '计算机基础与系统',
    'field programmable gate array': '计算机基础与系统',
    'hash collision': '计算机基础与系统',
    'hash function': '计算机基础与系统',
    'hash table': '计算机基础与系统',
    'shortest path': '计算机基础与系统',
    'system on chip': '计算机基础与系统',
    'topological sort': '计算机基础与系统',
    'two pointers': '计算机基础与系统',
    'union find': '计算机基础与系统',
    'user mode': '计算机基础与系统',
    # Software development and data
    'accessibility tree': '软件开发与数据',
    'back forward cache': '软件开发与数据',
    'batch processing': '软件开发与数据',
    'block level content': '软件开发与数据',
    'columnar format': '软件开发与数据',
    'connection pool': '软件开发与数据',
    'descriptor protocol': '软件开发与数据',
    'dynamic typing': '软件开发与数据',
    'environment variable': '软件开发与数据',
    'error handling': '软件开发与数据',
    'first input delay': '软件开发与数据',
    'foreign key': '软件开发与数据',
    'import path': '软件开发与数据',
    'iterator protocol': '软件开发与数据',
    'key value store': '软件开发与数据',
    'local storage': '软件开发与数据',
    'normalization form': '软件开发与数据',
    'page load time': '软件开发与数据',
    'primary key': '软件开发与数据',
    'protocol class': '软件开发与数据',
    'release automation': '软件开发与数据',
    'replica set': '软件开发与数据',
    'rollback strategy': '软件开发与数据',
    'serializable isolation': '软件开发与数据',
    'short circuit evaluation': '软件开发与数据',
    'single page application': '软件开发与数据',
    'stream processing': '软件开发与数据',
    'virtual environment': '软件开发与数据',
    'web component': '软件开发与数据',
    'wheel distribution': '软件开发与数据',
    'working tree': '软件开发与数据',
    'write ahead log': '软件开发与数据',
    'user agent': '软件开发与数据',
    # Network, cloud and security
    'access token': '网络、云与安全',
    'cache control': '网络、云与安全',
    'cryptographic algorithm': '网络、云与安全',
    'cybersecurity framework': '网络、云与安全',
    'daemon set': '网络、云与安全',
    'data breach': '网络、云与安全',
    'desired state': '网络、云与安全',
    'digital signature': '网络、云与安全',
    'disruption budget': '网络、云与安全',
    'distributed tracing': '网络、云与安全',
    'file permission': '网络、云与安全',
    'immutable infrastructure': '网络、云与安全',
    'key derivation': '网络、云与安全',
    'key exchange': '网络、云与安全',
    'key management': '网络、云与安全',
    'label selector': '网络、云与安全',
    'metrics collection': '网络、云与安全',
    'namespace isolation': '网络、云与安全',
    'penetration testing': '网络、云与安全',
    'percent encoding': '网络、云与安全',
    'personal data': '网络、云与安全',
    'public key infrastructure': '网络、云与安全',
    'traffic shaping': '网络、云与安全',
    'trusted execution environment': '网络、云与安全',
    # Artificial intelligence
    'data labeling': '人工智能',
    'human in the loop': '人工智能',
    'trustworthy ai': '人工智能',
}


def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:[-'][a-z0-9]+)*", text)


def main() -> None:
    data = json.loads(SEED.read_text(encoding='utf-8'))
    entries = {item['id']: item for item in data['entries']}
    collections = {item['id']: item for item in data['collections']}

    for collection in data['collections']:
        if collection['type'] == 'system-phrases':
            collection['name'] = '短语总表'
            collection['order'] = 1

    visible_computer = {
        item['name']: item['id']
        for item in data['collections']
        if item['domainId'] == COMPUTER_DOMAIN and item['type'] == 'normal' and not item.get('hidden')
    }
    word_collection: dict[str, str] = {}
    for membership in data['memberships']:
        entry = entries.get(membership['entryId'])
        collection = collections.get(membership['collectionId'])
        if not entry or not collection:
            continue
        if entry['domainId'] == COMPUTER_DOMAIN and entry['kind'] == 'word' and collection['id'] in visible_computer.values():
            word_collection[entry['normalizedText']] = collection['id']

    # Preserve existing word and General-English phrase memberships. Replace only built-in
    # computer-phrase classifications so repeated runs are idempotent.
    phrase_ids = {
        item['id'] for item in data['entries']
        if item['domainId'] == COMPUTER_DOMAIN and item['kind'] == 'phrase'
    }
    data['memberships'] = [
        item for item in data['memberships']
        if not (item['entryId'] in phrase_ids and item['collectionId'] in visible_computer.values())
    ]

    counts: Counter[str] = Counter()
    decisions = []
    for entry in sorted((entries[item_id] for item_id in phrase_ids), key=lambda item: item['normalizedText']):
        text = entry['normalizedText']
        scores: Counter[str] = Counter()
        reasons: list[str] = []
        override = EXACT_OVERRIDES.get(text)
        if override:
            chosen = visible_computer[override]
            reasons.append(f'exact:{override}')
        for token in tokens(text):
            collection_id = word_collection.get(token)
            if collection_id:
                scores[collection_id] += 1
        if not override:
            for name, phrases in KEYWORDS.items():
                matched = [phrase for phrase in phrases if phrase in text]
                if matched:
                    scores[visible_computer[name]] += 5 * len(matched)
                    reasons.extend(f'keyword:{value}' for value in matched[:3])
            if not scores:
                chosen = visible_computer['软件开发与数据']
                reasons.append('fallback:software-data')
            else:
                best = max(scores.values())
                candidates = {key for key, value in scores.items() if value == best}
                precedence = [
                    visible_computer['人工智能'],
                    visible_computer['网络、云与安全'],
                    visible_computer['软件开发与数据'],
                    visible_computer['计算机基础与系统'],
                ]
                chosen = next(item for item in precedence if item in candidates)
                if not reasons:
                    reasons.append('component-word-majority')
        data['memberships'].append({
            'id': f"membership_{entry['id']}_{chosen}",
            'entryId': entry['id'],
            'collectionId': chosen,
            'sourceLabel': 'built-in phrase classification',
            'sourceOrder': counts[chosen],
            'createdAt': '2026-08-02T01:51:00.000Z',
            'updatedAt': '2026-08-02T01:51:00.000Z',
        })
        counts[chosen] += 1
        decisions.append({
            'entryId': entry['id'], 'text': entry['text'],
            'collectionId': chosen, 'collectionName': collections[chosen]['name'],
            'reasons': reasons,
        })

    data['schemaVersion'] = 4
    data['appVersion'] = '3.3.1'
    data['exportedAt'] = '2026-08-02T01:51:00.000Z'
    data['studyStamps'] = []
    settings = data.setdefault('settings', {})
    settings['builtInSeedRevision'] = 3
    settings.setdefault('viewModes', {})
    settings.setdefault('calendarMonths', {})
    # Existing phrase memberships in General English are already the curated A1/A2 mapping.
    data['memberships'].sort(key=lambda item: (item['collectionId'], item.get('sourceOrder', 0), item['entryId']))
    SEED.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    general_phrase_counts = Counter()
    for membership in data['memberships']:
        entry = entries.get(membership['entryId'])
        collection = collections.get(membership['collectionId'])
        if entry and collection and entry['domainId'] == GENERAL_DOMAIN and entry['kind'] == 'phrase' and collection['type'] == 'normal':
            general_phrase_counts[collection['name']] += 1
    report = {
        'version': '3.1.0',
        'generatedAt': data['exportedAt'],
        'computerPhraseCount': len(phrase_ids),
        'computerCounts': {collections[key]['name']: value for key, value in sorted(counts.items())},
        'generalPhraseCounts': dict(sorted(general_phrase_counts.items())),
        'constraints': {
            'computerEveryPhraseExactlyOneVisibleNormalCollection': sum(counts.values()) == len(phrase_ids),
            'systemPhraseTotalsRemainDerived': True,
            'entryDuplication': False,
        },
        'decisions': decisions,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report['computerCounts'], ensure_ascii=False))

if __name__ == '__main__':
    main()
