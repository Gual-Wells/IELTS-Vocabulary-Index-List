"""Build source-preserving retrieval editions from existing PDF/DjVu text layers.

Usage: python tools/prepare-etymology-textbooks.py CONFIG.json
Requires PyMuPDF for PDFs and DjVuLibre djvutxt for DjVu. Config supplies local
paths, output/cache directories, edition data and verified main-text page ranges.
No OCR/model calls, translations, inferred etymologies or automatic word repairs.
"""
import ast
import collections
import hashlib
import json
import pathlib
import re
import statistics
import subprocess
import sys
import unicodedata

try:
    import pymupdf as fitz
except ImportError:
    # Optional task-local dependencies; no environment-wide installation needed.
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] /
                           'second-language-maintenance/.cache/pdf-inspection-tools'))
    import pymupdf as fitz

CONTROL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
LINE = re.compile(r'\(line\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+("(?:[^"\\]|\\.)*")\s*\)', re.S)
POS = re.compile(r'^(.{1,100}?)\s+(?:n[.,]|v[.,]|adj[.,]|adv[.,]|prep[.,]|pron[.,]|conj[.,]|interj[.,]|prefix\b|suffix\b|a form of\b|see\b)', re.I)


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for part in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def clean(text):
    # Preserve scripts, accents, superscripts, stars, daggers and hyphens.
    return CONTROL.sub('', unicodedata.normalize('NFC', text)).strip()


def pdf_pages(path):
    doc = fitz.open(path)
    for page in doc:
        lines = []
        # Some OCR "lines" already combine both printed columns. Reconstruct
        # from positioned words, so source line grouping cannot mix entries.
        for word in page.get_text('words', flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES):
            if clean(word[4]):
                lines.append({'box': list(word[:4]), 'text': word[4]})
        yield float(page.rect.width), float(page.rect.height), lines


def djvu_pages(path, config):
    cache = pathlib.Path(config['cache_dir']) / 'klein-lines.sexp'
    # Bind an existing extraction to source identity, not merely its filename.
    stamp = cache.with_suffix('.source-sha256')
    identity = digest(path)
    if not cache.exists() or not stamp.exists() or stamp.read_text() != identity:
        subprocess.run([config['djvutxt'], '-detail=line', str(path), str(cache)], check=True)
        stamp.write_text(identity)
    data = cache.read_text(encoding='utf-8')
    for section in re.split(r'(?m)^\(page\s+', data)[1:]:
        match = re.match(r'(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)', section)
        if not match:
            raise ValueError('Invalid DjVu page geometry')
        _, _, width, height = map(int, match.groups())
        lines = []
        for match in LINE.finditer(section):
            x0, y0, x1, y1 = map(int, match.groups()[:4])
            text = ast.literal_eval(match.group(5))
            if clean(text):
                lines.append({'box': [x0, height-y1, x1, height-y0], 'text': text})
        yield width, height, lines


def gutter_positions(units, count):
    if count == 1 or not units:
        return []
    xs0 = sorted(u['box'][0] for u in units)
    xs1 = sorted(u['box'][2] for u in units)
    # Derive gutters from actual print extents, not the cropped PDF canvas.
    # Its crop/margin varies across Chambers pages and can exclude valid OCR.
    trim = max(0, int(len(units)*.005))
    left, right = xs0[trim], xs1[-1-trim]
    return [left+(right-left)*i/count for i in range(1,count)]


def column_for(unit, gutters):
    center = (unit['box'][0]+unit['box'][2])/2
    return sum(center >= cut for cut in gutters)


def merge_rows(lines):
    """Join OCR fragments on the same printed baseline within one column."""
    rows = []
    for line in sorted(lines, key=lambda x: (x['box'][1], x['box'][0])):
        mid = (line['box'][1] + line['box'][3]) / 2
        target = next((r for r in reversed(rows[-4:])
                       if abs(r['mid']-mid) < min(r['height'], line['box'][3]-line['box'][1])*.40), None)
        if target is None:
            target = {'parts': [], 'mid': mid, 'height': line['box'][3]-line['box'][1]}
            rows.append(target)
        target['parts'].append(line)
    result = []
    for row in rows:
        parts = sorted(row['parts'], key=lambda x: x['box'][0])
        result.append({'box': [min(x['box'][0] for x in parts), min(x['box'][1] for x in parts),
                               max(x['box'][2] for x in parts), max(x['box'][3] for x in parts)],
                       'text': ' '.join(clean(x['text']) for x in parts),
                       'ids': [x['id'] for x in parts]})
    return sorted(result, key=lambda x: (x['box'][1], x['box'][0]))


def hanging_threshold(rows, width):
    xs = [r['box'][0] for r in rows if len(r['text']) > 6]
    if not xs:
        return -1
    floor = min(xs)
    xs = [x for x in xs if x < floor + width * .04]
    lo, hi = min(xs), max(xs)
    for _ in range(12):
        split = (lo+hi)/2
        left, right = [x for x in xs if x <= split], [x for x in xs if x > split]
        if not left or not right:
            break
        lo, hi = statistics.mean(left), statistics.mean(right)
    return (lo+hi)/2 if hi-lo > width*.003 else floor + width*.002


def heading(row, key, threshold, previous, median_step):
    text = row['text']
    if not re.match(r"[-A-Za-z][A-Za-z\d'’() .,/\-]*", text):
        return None
    if key == 'chambers':
        match = POS.match(text)
        if not match:
            return None
        prefix = match.group(1)
        prefix = re.sub(r'\s*\([^)]*\)\s*$', '', prefix).strip()
        if len(prefix) > 65 or len(prefix.split()) > 6 or not re.fullmatch(r"[A-Za-z][A-Za-z’' /\-]*(?:[0-9¹²³])?", prefix):
            return None
        if previous and row['box'][1]-previous['box'][1] < median_step*1.10:
            return None
        return prefix
    if row['box'][0] > threshold:
        return None
    if key == 'klein':
        match = re.match(r'^([-A-Za-z][A-Za-z\d’\' .()/\-]{0,75}),', text)
        return match.group(1).strip() if match else None
    # Oxford has a consistent extra inter-entry leading. Hanging indentation
    # alone over-detects words when an OCR column has few real entry starts.
    # At a column's first row continuation vs a new entry remains uncertain;
    # retain that source text without inventing a dictionary-entry heading.
    if previous is None or row['box'][1]-previous['box'][1] < median_step*1.14:
        return None
    # Oxford headwords precede pronunciation/gloss. Keep uncertain OCR unchanged.
    match = re.match(r"^([-A-Za-z][A-Za-z\d’'\-]*(?:,\s+[A-Za-z][A-Za-z\d’'\-]*)*)", text)
    return match.group(1) if match else None


def write_book(book, config):
    src = pathlib.Path(book['path'])
    dest = pathlib.Path(config['output_dir']) / book['output']
    pages = djvu_pages(src, config) if src.suffix.lower() == '.djvu' else pdf_pages(src)
    counts = collections.Counter()
    heads = []
    empty = []
    page_records = []
    with dest.open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(f"# {book['title']}\n\nSOURCE_FILE: {src.name}\nEDITION: {book['edition']}\n")
        stream.write('FORMAT: Chat project retrieval edition\n')
        stream.write('NOTE: Headings are retrieval aids inferred from existing OCR and layout, not verified dictionary identities. '
                     'Body text, front matter, abbreviations and appendices are retained. '
                     'Page/column comments locate the original. OCR can corrupt spellings, language labels and special symbols; '
                     'check the original before relying on uncertain etymological claims. No translations or inferred lexical repairs.\n\n')
        for page_no, (width, height, raw) in enumerate(pages, 1):
            counts['pages'] += 1
            counts['source_units'] += len(raw)
            if not raw:
                empty.append(page_no)
            for i, line in enumerate(raw):
                line['id'] = i
            main = book['main_first'] <= page_no <= book['main_last']
            # Front/back matter stays complete; use columns only for narrow text.
            columns = book['columns'] if page_no >= book['main_first'] else 1
            marginal = [r for r in raw if main and
                        (r['box'][3] < height*.045 or r['box'][1] > height*.965)]
            marginal_ids = {r['id'] for r in marginal}
            content = [r for r in raw if r['id'] not in marginal_ids]
            gutters = gutter_positions(content, columns)
            # Running heads/page numbers are retained visibly, outside entry bodies.
            margin_text = ' | '.join(clean(r['text']) for r in marginal)
            stream.write(f'<!-- SOURCE_PAGE:{page_no} -->\n')
            if margin_text:
                stream.write(f'<!-- PAGE_MARGIN: {margin_text.replace("--", "&#45;&#45;")} -->\n')
            emitted = set(marginal_ids)
            page_records.append({'page': page_no, 'raw_units': len(raw), 'margin_units': len(marginal)})
            for col in range(columns):
                rows = merge_rows([r for r in content if column_for(r, gutters)==col])
                if not rows:
                    continue
                stream.write(f'<!-- SOURCE_PAGE:{page_no} COLUMN:{col+1} -->\n')
                if not main:
                    stream.write(f'\n## Source page {page_no}, section {col+1}\n\n')
                threshold = hanging_threshold(rows, width)
                steps = [b['box'][1]-a['box'][1] for a,b in zip(rows,rows[1:])
                         if 0 < b['box'][1]-a['box'][1] < height*.03]
                step = statistics.median(steps) if steps else 1
                previous = None
                for row in rows:
                    candidate = heading(row, book['key'], threshold, previous, step) if main else None
                    if candidate:
                        stream.write(f'\n## {candidate}\n')
                        heads.append({'heading': candidate, 'page': page_no, 'column': col+1})
                    text = clean(row['text'])
                    # Safe, narrow grammar-label correction. Never transliterate
                    # all Cyrillic/Greek lookalikes in historical word forms.
                    if book['key']=='klein':
                        text, n = re.subn(r'(?<=, )п\.(?=\s|$)', 'n.', text)
                        counts['grammar_label_n_repairs'] += n
                    stream.write(text+'\n')
                    emitted.update(row['ids'])
                    counts['body_rows'] += 1
                    previous = row
                stream.write('\n')
            if emitted != set(range(len(raw))):
                raise ValueError(f"Lost or duplicate source lines: {book['key']} p{page_no}")
            counts['accounted_source_units'] += len(emitted)
    data = dest.read_bytes()
    if len(data)>32*1024*1024:
        raise ValueError('Retrieval file exceeds existing 32 MiB convention')
    result = {k:v for k,v in book.items() if k!='path'}
    result.update({'preparer_sha256':digest(__file__), 'source_file':src.name, 'source_bytes':src.stat().st_size,
                   'source_sha256':digest(src), 'output_bytes':len(data),
                   'output_sha256':hashlib.sha256(data).hexdigest(),
                   'source_unit_kind': 'OCR lines' if src.suffix.lower()=='.djvu' else 'OCR words',
                   'counts':dict(counts), 'empty_text_pages':empty,
                   'heading_count':len(heads), 'replacement_characters':data.decode().count('\ufffd'),
                   'limitations':'Existing OCR, not full semantic or character-level proofreading; headings are inferred. '
                                 'Explicit line wraps/hyphens retained to avoid changing historical forms.',
                   'corrections':"Klein only: comma-space followed by Cyrillic п. in a grammar-label position -> Latin n.; NFC and control removal."})
    (pathlib.Path(config['cache_dir'])/(book['key']+'-heading-index.json')).write_text(json.dumps(heads,ensure_ascii=False),encoding='utf-8')
    (pathlib.Path(config['cache_dir'])/(book['key']+'-page-accounting.json')).write_text(json.dumps(page_records),encoding='utf-8')
    print(json.dumps({'book':book['key'],'headings':len(heads),'bytes':len(data),'pages':counts['pages']},ensure_ascii=False),flush=True)
    return result


if __name__ == '__main__':
    config = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    pathlib.Path(config['output_dir']).mkdir(parents=True,exist_ok=True)
    pathlib.Path(config['cache_dir']).mkdir(parents=True,exist_ok=True)
    results = []
    for book in config['books']:
        checkpoint = pathlib.Path(config['cache_dir'])/(book['key']+'-prepared.json')
        dest = pathlib.Path(config['output_dir'])/book['output']
        previous = json.loads(checkpoint.read_text(encoding='utf-8')) if checkpoint.exists() else None
        if previous and previous.get('preparer_sha256')==digest(__file__) and dest.exists() and digest(dest)==previous['output_sha256'] and digest(book['path'])==previous['source_sha256']:
            results.append(previous)
            print(book['key'], 'reused verified completed extraction', flush=True)
        else:
            result = write_book(book, config)
            checkpoint.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            results.append(result)
    manifest = {'format':'etymology-retrieval-sources/1','prepared_on':'2026-10-16',
                'scope':'Three user-supplied etymology books; existing Collins/Oxford learner books unchanged.',
                'books':results}
    (pathlib.Path(config['output_dir'])/'Etymology_Sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
