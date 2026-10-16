"""Check retrieval editions against source text, not just their own manifest.

Usage: python tools/check-etymology-textbooks.py CONFIG.json
Checks text conservation, all page locators, hashes, encoding, representative
retrievals and actual reading order on a page where Oxford OCR interleaves columns.
"""
import collections
import hashlib
import html
import importlib.util
import json
import pathlib
import re
import subprocess
import sys
import unicodedata

spec = importlib.util.spec_from_file_location('prepare', pathlib.Path(__file__).with_name('prepare-etymology-textbooks.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def chars(text):
    text = prepare.CONTROL.sub('', unicodedata.normalize('NFC', text))
    return collections.Counter(c for c in text if not c.isspace())


def source_payload(markdown):
    pages = {}
    page = None
    for line in markdown.splitlines():
        match = re.fullmatch(r'<!-- SOURCE_PAGE:(\d+) -->', line)
        if match:
            page = int(match.group(1))
            assert page not in pages, 'Duplicate page locator'
            pages[page] = []
        elif page is not None:
            if line.startswith('<!-- PAGE_MARGIN: '):
                pages[page].append(html.unescape(line[len('<!-- PAGE_MARGIN: '):-len(' -->')]).replace(' | ', ' '))
            elif line.startswith('<!-- ') or line.startswith('## '):
                continue
            else:
                pages[page].append(line)
    return {p:'\n'.join(lines) for p,lines in pages.items()}


config = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
root = pathlib.Path(config['output_dir'])
manifest = json.loads((root/'Etymology_Sources.json').read_text(encoding='utf-8'))
results = []
for book,meta in zip(config['books'],manifest['books']):
    data = (root/book['output']).read_bytes()
    text = data.decode('utf-8')
    assert hashlib.sha256(data).hexdigest() == meta['output_sha256']
    assert len(data) < 32*1024*1024 and text.endswith('\n')
    assert not prepare.CONTROL.search(text)
    payload = source_payload(text)
    assert set(payload) == set(range(1,meta['counts']['pages']+1)), 'Missing page'
    expected = collections.Counter()
    actual = collections.Counter()
    if book['key']=='klein':
        raw = subprocess.run([config['djvutxt'],book['path']],capture_output=True,check=True).stdout.decode('utf-8')
        raw_pages = raw.split('\f')
        if not raw_pages[-1].strip():
            raw_pages.pop()
        assert len(raw_pages)==len(payload)
        for p,raw in enumerate(raw_pages,1):
            expected.update(chars(raw))
            actual.update(chars(payload[p]))
        n = meta['counts']['grammar_label_n_repairs']
        expected['п']-=n
        expected['n']+=n
    else:
        doc = prepare.fitz.open(book['path'])
        for p,page in enumerate(doc,1):
            expected.update(chars(page.get_text()))
            actual.update(chars(payload[p]))
    missing = expected-actual
    extra = actual-expected
    # Known comment escaping does not affect dictionary body. Reject any other
    # unexplained dropped/added non-whitespace characters, including symbols.
    assert not missing and not extra, (book['key'],'source mismatch',dict(missing),dict(extra))
    terms = {}
    for word in ['female','salary','cleave','record','island','poison','robot','zymurgy']:
        terms[word] = bool(re.search(r'(?im)^## '+word+r'(?:\d|[ ,\n])',text))
        assert re.search(r'(?i)\b'+word+r'\b',text), ('Missing sample word',word)
    if book['key']=='oxford':
        sample = payload[519]
        assert sample.index('kitool') < sample.index('knack'), 'Interleaved Oxford columns'
        sample = payload[45]
        assert sample.index('am pulla') < sample.index('am putate'), 'Wrong Oxford gutter position'
        assert not re.search(r'(?m)^## recorded$',text), 'Continuation misidentified as Oxford headword'
    assert meta['counts']['source_units']==meta['counts']['accounted_source_units']
    results.append({'book':book['key'],'pages':len(payload),'sha256':meta['output_sha256'],
                    'non_whitespace_character_conservation':'passed','sample_heading_hits':terms,
                    'source_units_accounted':meta['counts']['source_units']})
    print(book['key'],'source conservation and retrieval checks passed',flush=True)
out = pathlib.Path(config['cache_dir'])/'validation.json'
out.write_text(json.dumps({'passed':True,'books':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
