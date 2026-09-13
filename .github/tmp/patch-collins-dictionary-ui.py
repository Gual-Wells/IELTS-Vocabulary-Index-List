from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


ui = Path('js/v3-ui.js')
s = ui.read_text()
s = replace_once(
    s,
    "import { deleteCollinsSecret, saveCollinsSecret, validateCollinsSecret } from './v5-collins-bridge.js';",
    """import {
  COLLINS_DICTIONARY_OPTIONS, deleteCollinsSecret, getCollinsDictionaryPreference,
  saveCollinsSecret, setCollinsDictionaryPreference, validateCollinsSecret,
} from './v5-collins-bridge.js';""",
    'Collins import',
)

start = s.index('function openBridgeDialog')
end = s.find('\nfunction ', start + 1)
if end < 0:
    raise SystemExit('openBridgeDialog end not found')
segment = s[start:end]

test_anchor = "  const test = button('测试', 'secondary-button', async () => {"
selector = """  const collinsDictionary = el('select', {
    name: 'vix-collins-dictionary', autocomplete: 'off',
  });
  for (const option of COLLINS_DICTIONARY_OPTIONS) {
    collinsDictionary.append(el('option', { value: option.code, text: option.label }));
  }
  collinsDictionary.value = getCollinsDictionaryPreference();
"""
segment = replace_once(segment, test_anchor, selector + test_anchor, 'dictionary selector')
segment = replace_once(
    segment,
    "      const candidateCollinsKey = collinsKey.value.trim();",
    "      const candidateCollinsKey = collinsKey.value.trim();\n      const selectedCollinsDictionary = collinsDictionary.value;",
    'test dictionary selection',
)
segment = replace_once(
    segment,
    "if (candidateCollinsKey) await validateCollinsSecret(candidateCollinsKey, { config });",
    "if (candidateCollinsKey) await validateCollinsSecret(candidateCollinsKey, { config, dictionaryCode: selectedCollinsDictionary });",
    'test Collins validation',
)
segment = replace_once(
    segment,
    "      field('Collins API Key', collinsKey),",
    "      field('Collins API Key', collinsKey),\n      field('Collins 目标词典', collinsDictionary, '仅列出当前 Collins API 申请中的两部 American English 词典。'),",
    'dictionary field',
)

submit = segment.index('onSubmit:')
save_anchor = "      if (collinsKey.value.trim()) {"
save_pos = segment.find(save_anchor, submit)
if save_pos < 0:
    raise SystemExit('Collins save block not found')
segment = segment[:save_pos] + "      const selectedCollinsDictionary = collinsDictionary.value;\n" + segment[save_pos:]
segment = replace_once(
    segment,
    "await saveCollinsSecret(collinsKey.value, { config: nextConfig });",
    "await saveCollinsSecret(collinsKey.value, { config: nextConfig, dictionaryCode: selectedCollinsDictionary });",
    'Collins save call',
)
config_pos = segment.find("      setBridgeConfig(nextConfig);", save_pos)
if config_pos < 0:
    raise SystemExit('setBridgeConfig in submit not found')
segment = segment[:config_pos] + "      setCollinsDictionaryPreference(selectedCollinsDictionary);\n" + segment[config_pos:]
s = s[:start] + segment + s[end:]
ui.write_text(s)

providers = Path('js/v5-query-providers.js')
p = providers.read_text()
p = p.replace("'Collins COBUILD'", "'Collins Dictionary'")
p = p.replace('Collins COBUILD 单条词条', 'Collins 单条词典词条')
p = p.replace('Collins COBUILD 词典内容', 'Collins 词典内容')
providers.write_text(p)

sw = Path('sw.js')
w = sw.read_text()
w = replace_once(
    w,
    'v5.0.0-alpha.14-providers-20260913-4',
    'v5.0.0-alpha.14-providers-20260914-5',
    'service worker cache generation',
)
sw.write_text(w)
