from pathlib import Path
import re


def top_span(text, name):
    p = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+" + re.escape(name) + r"\s*\(", re.M)
    m = p.search(text)
    if not m:
        return None
    n = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(", re.M).search(text, m.end())
    return m.start(), n.start() if n else len(text)


def remove_function(text, name):
    span = top_span(text, name)
    if not span:
        return text
    a, b = span
    return text[:a] + text[b:]


def replace_function(text, name, replacement):
    span = top_span(text, name)
    if not span:
        raise SystemExit(f"function not found: {name}")
    a, b = span
    return text[:a] + replacement.rstrip() + "\n\n" + text[b:]


p = Path("js/v3-ui.js")
s = p.read_text(encoding="utf-8")

for name in ["providerQueryIsCurrent", "providerResultBody", "isChineseQuery", "collectionCountSummary"]:
    s = remove_function(s, name)

s = replace_function(s, "cancelActiveTaskForDataChange", "async function cancelActiveTaskForDataChange() {}")
s = s.replace("let activeTask = null;\n", "")
s = s.replace("let taskPanelExpanded = true;\n", "")
s = s.replace("  if (activeProviderQuery) { activeProviderQuery.controller.abort(); activeProviderQuery = null; }\n", "")

s, subscriber_count = re.subn(
    r"\n\s*if \(activeTask && detail\?\.kind !== 'batch'\) \{\n\s*for \(const entryId of detail\?\.entryIds \|\| \[\]\) activeTask\.manualAnnotationEntryIds\?\.add\(entryId\);\n\s*\}",
    "",
    s,
    count=1,
)
if subscriber_count != 1:
    raise SystemExit(f"activeTask subscriber block: expected 1, found {subscriber_count}")

s = s.replace(
    "reorderLibrary, recordAiAnnotationChanges, replaceAnnotations, resetToSeed, restoreBackup,",
    "reorderLibrary, resetToSeed, restoreBackup,",
)

s, dictionary_count = re.subn(r"^\s*dictionary:\s*'.*?',\n", "", s, count=1, flags=re.M)
s, switch_count = re.subn(r"^\s*switchParallel:\s*'.*?',\n", "", s, count=1, flags=re.M)
if dictionary_count != 1 or switch_count != 1:
    raise SystemExit(f"icon cleanup counts dictionary={dictionary_count} switch={switch_count}")

s = s.replace("collection?.type === 'system-global-content' || ", "")
s = s.replace("collection.type === 'system-global-content' || ", "")

for token in [
    "activeProviderQuery",
    "providerQueryIsCurrent",
    "providerResultBody",
    "provider-result-",
    "activeTask",
    "taskPanelExpanded",
    "renderTaskPanel",
    "isChineseQuery",
    "system-global-content",
    "recordAiAnnotationChanges",
    "replaceAnnotations",
]:
    if token in s:
        raise SystemExit(f"v3-ui retired token remains: {token}")

p.write_text(s.rstrip() + "\n", encoding="utf-8")

# Remove the newest stylesheet's dead provider/query chooser block only.
p = Path("css/v5.0.0.css")
css = p.read_text(encoding="utf-8")
marker = "/* Only the providers that still exist own columns in the query chooser. */"
start = css.find(marker)
if start >= 0:
    css = re.sub(
        r"/\* Only the providers that still exist own columns in the query chooser\. \*/[\s\S]*?(?=\n/\*|\n\.home-mirror-button|\Z)",
        "",
        css,
        count=1,
    )
p.write_text(css.rstrip() + "\n", encoding="utf-8")

print("FINAL_UI_CLEANUP_OK")
