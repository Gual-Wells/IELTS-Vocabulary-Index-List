# Etymology retrieval sources

These three retrieval editions supplement the existing Collins and Oxford
learner dictionaries in this folder. They do not replace their definitions,
usage labels, example sentences or existing chapter protocols.

| File | Work | Role |
| --- | --- | --- |
| `Chambers_Etymology_Chat_Project.md` | Chambers Dictionary of Etymology, Barnhart editorial text | Word history, dated senses and borrowing explanations |
| `Oxford_Etymology_Chat_Project.md` | The Oxford Dictionary of English Etymology, C. T. Onions | Concise historical forms, relationships and cross-references |
| `Klein_Etymology_Chat_Project.md` | Ernest Klein, unabridged one-volume edition | Comparative forms, word families, borrowing and related entries |

## Retrieval and interpretation

1. Search the complete body as well as `##` headings. These headings are aids
   inferred from existing OCR and page geometry, not a proof that every original
   headword was recognized correctly. Preserve distinct homographs and numbered
   entries; a common spelling does not establish a common origin.
2. Read the full entry, including material continuing into the next column or
   source page. Page comments are locators, not entry boundaries. Follow relevant
   cross-references and consult the retained abbreviation/symbol explanations.
3. `SOURCE_PAGE` is the one-based PDF/DjVu file page, not necessarily the printed
   book page. `COLUMN` numbers run left to right. `PAGE_MARGIN` preserves running
   heads and printed page labels separately from the body.
4. Original scans remain necessary for checking uncertain forms and symbols.
   OCR may confuse Latin/Cyrillic/Greek letters, diacritics, stars, daggers,
   superscripts and relationship signs. Never silently invent a correction.
   Line-end hyphens and explicit line breaks are retained; do not assume that
   every split form is a compound or a morphological boundary.
5. State uncertainty where the source states it. Distinguish the source's
   historical explanation from a model-created teaching analogy or mnemonic.
   A memorable segmentation is not evidence for a historical derivation.
6. Sources may disagree or share references. Do not decide by simple majority
   vote. Chambers and the Barnhart dictionary are the same editorial lineage;
   citing both names does not provide two independent confirmations.
7. These are historical books/reprints, not current continuously revised
   dictionaries. A late reprint date is not a claim of updated scholarship.

## Preparation boundary

The source files were supplied by the owner. Existing text layers were extracted
without external inference services, OCR regeneration or translation. Reading
order was reconstructed by page and column, and inferred entry headings were
added while retaining source text. Front matter and appendices are included.
The manifest `Etymology_Sources.json` binds source and output hashes, editions,
page ranges, preparation counts and limitations. It does not certify semantic
accuracy, character-level proofreading or complete VIX coverage.

Klein's easily confused Cyrillic `п.` is changed to Latin `n.` only immediately
after comma-space in a grammatical-label position. Other historical forms and
scripts are preserved. Normalization is NFC, not compatibility normalization.

The reproducible extractor is `tools/prepare-etymology-textbooks.py`. Its config
supplies original local paths, output/cache folders, the verified main-body
page ranges recorded in the manifest and the DjVuLibre executable when needed.
PyMuPDF and DjVuLibre are local dependencies. Original PDFs/DjVu and transient
position data are not added to the repository.

Copy `tools/etymology-textbooks.config.example.json` to a local configuration,
set original source and cache paths, then run:

```text
python tools/prepare-etymology-textbooks.py LOCAL_CONFIG.json
python tools/check-etymology-textbooks.py LOCAL_CONFIG.json
```

The sample page ranges apply only to the source hashes in the manifest; do not
reuse them for another scan without verifying its front matter and pagination.
