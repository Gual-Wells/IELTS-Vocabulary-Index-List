"""Extract the ALL_sep worksheet from the vendored CEFR-J 1.6 XLSX.

This intentionally uses only Python's standard library so the normalized
source can be reproduced without Excel, LibreOffice, or third-party packages.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "sources" / "seed5"
OUT = SOURCE / "cefrj-1.6.normalized.json"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value - 1


with zipfile.ZipFile(SOURCE / "CEFRJ_wordlist_ver1.6.zip") as outer:
    xlsx_name = next(name for name in outer.namelist() if name.lower().endswith(".xlsx"))
    xlsx_bytes = outer.read(xlsx_name)

with zipfile.ZipFile(io.BytesIO(xlsx_bytes)) as book:
    shared_root = ET.fromstring(book.read("xl/sharedStrings.xml"))
    shared = ["".join(node.text or "" for node in item.findall(".//x:t", NS)) for item in shared_root.findall("x:si", NS)]

    workbook = ET.fromstring(book.read("xl/workbook.xml"))
    relationships = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships.findall("r:Relationship", REL_NS)}
    sheet = next(node for node in workbook.findall(".//x:sheet", NS) if node.attrib["name"] == "ALL_sep")
    target = targets[sheet.attrib[OFFICE_REL]].lstrip("/")
    if not target.startswith("xl/"):
        target = "xl/" + target
    worksheet = ET.fromstring(book.read(target))

    rows = []
    for row in worksheet.findall(".//x:sheetData/x:row", NS):
        values = [""] * 6
        for cell in row.findall("x:c", NS):
            index = column_index(cell.attrib["r"])
            if index >= len(values):
                continue
            raw = cell.findtext("x:v", default="", namespaces=NS)
            values[index] = shared[int(raw)] if cell.attrib.get("t") == "s" and raw else raw
        if values[0] == "headword" or not values[0]:
            continue
        rows.append({"word": values[0], "pos": values[1], "level": values[2]})

payload = {
    "protocol": "vix-cefrj-normalized/1",
    "source": xlsx_name,
    "sourceSha256": hashlib.sha256(xlsx_bytes).hexdigest(),
    "sheet": "ALL_sep",
    "rows": rows,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"output": str(OUT), "rows": len(rows), "sha256": hashlib.sha256(OUT.read_bytes()).hexdigest()}))
