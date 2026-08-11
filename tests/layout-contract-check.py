from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CSS = "\n".join((ROOT / p).read_text() for p in [
    'css/v3.css', 'css/v3.3.1.css', 'css/v3.4.0.css', 'css/v4.0.0.css', 'css/v4.0.1.css', 'css/v4.0.2.css', 'css/v4.1.0.css', 'css/v4.2.0.css', 'css/v4.3.0.css', 'css/v4.4.0.css', 'css/v4.5.0.css', 'css/v4.6.0.css', 'css/v4.7.0.css', 'css/v4.7.1.css', 'css/v4.7.2.css', 'css/v4.7.3.css'
])

ACTIONS = '<div class="entry-actions"><span class="entry-action-placeholder relation-placeholder"></span><button></button><button></button><button></button><button></button></div>'

def row(row_id, index, word, gloss='', source='', date=''):
    gloss_html = f'<span class="entry-gloss">{gloss}</span>' if gloss else ''
    source_html = f'<span class="entry-source-domain">{source}</span>' if source else ''
    date_html = f'<span class="entry-study-date marked">{date}</span>' if date else ''
    classes = ['entry-row', 'word-normal', 'has-index', 'has-gloss' if gloss else 'no-gloss']
    if source: classes.append('has-source-domain')
    line_classes = ['entry-line']
    if gloss: line_classes.append('has-left-meta')
    if source: line_classes.append('has-right-meta')
    return f'''<article id="{row_id}" class="{' '.join(classes)}"><div class="entry-primary-shell"><div class="{' '.join(line_classes)}">
      <span class="entry-index-inline">{index}</span>
      <div class="entry-text-viewport horizontally-scrollable {'has-gloss' if gloss else 'no-gloss'}"><div class="entry-text-content"><div class="entry-lexeme-stack"><span class="entry-text">{word}</span>{gloss_html}</div></div></div>
      <div class="entry-control-stack{' has-source' if source else ''}"><div class="entry-control-main">{date_html}{ACTIONS}</div>{source_html}</div>
    </div></div></article>'''

HTML = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{CSS}</style></head><body>
<div id="app"></div>
<div id="entry-fixture" style="width:100%;max-width:520px;margin:0 auto">
  {row('plain-row', '12', 'access', date='8·8')}
  {row('gloss-row', '13', 'thread', gloss='線程')}
  {row('source-row', '14', 'edge', source='计算机术语')}
  {row('both-row', '15', 'rendering pipeline', gloss='渲染管線', source='一个非常长的独立域来源名称', date='8·8')}
</div>
<nav id="letter-fixture" class="letter-nav"><div class="letter-nav-track"><button>A</button><button>B</button><button class="empty" disabled>#</button></div></nav>
<nav id="bottom-toolbar" class="bottom-toolbar"><button><span class="ui-icon"></span></button><button disabled><span class="ui-icon"></span></button><button><span class="ui-icon"></span></button><button disabled><span class="ui-icon"></span></button><button><span class="ui-icon"></span></button></nav>
<div id="app-dialog" class="modal-host">
  <section id="management-layer" class="modal-layer" data-depth="1" data-variant="management"><div class="modal-layer-backdrop"></div><form id="dialog-form" class="modal-card modal-card-management"><header class="dialog-header"><div><h2>设置</h2></div><button class="icon-button" type="button"></button></header><div class="dialog-body"><label class="field"><span>文本</span><input value="test"></label></div><footer class="dialog-actions"><button>取消</button><button>保存</button></footer></form></section>
  <section id="search-layer" class="modal-layer" data-depth="2" data-variant="search"><div class="modal-layer-backdrop"></div><div id="search-card" class="modal-card modal-card-search"><header class="dialog-header"><div><h2>搜索</h2></div><button class="icon-button" type="button"></button></header><div class="dialog-body"><div class="search-controls"><input value="edge"><select><option>全部</option></select><button class="secondary-button">搜索</button></div></div></div></section>
  <section id="confirm-layer" class="modal-layer" data-depth="3" data-variant="confirm"><div class="modal-layer-backdrop"></div><form id="confirm-card" class="modal-card modal-card-confirm"><header class="dialog-header"><div><h2>确认操作</h2></div><button class="icon-button" type="button"></button></header><div class="dialog-body"><p>确认内容</p></div><footer class="dialog-actions"><button>取消</button><button>确认</button></footer></form></section>
</div>
<section id="pin-fixture" class="context-bar pin-bar" aria-hidden="true"><div class="pin-bar-content"><span>PIN</span></div></section>
</body></html>'''

def center_y(box): return box['y'] + box['height'] / 2

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 402, 'height': 874})
    page.set_content(HTML)
    page.evaluate("""
      document.documentElement.style.setProperty('--visual-width', innerWidth + 'px');
      document.documentElement.style.setProperty('--visual-height', innerHeight + 'px');
      document.documentElement.style.setProperty('--visual-center-x', (innerWidth / 2) + 'px');
      document.documentElement.style.setProperty('--visual-center-y', (innerHeight / 2) + 'px');
    """)

    # Application modal host covers the viewport; its management card remains bounded and fully visible.
    host = page.locator('#app-dialog').bounding_box(); app_card = page.locator('#dialog-form').bounding_box()
    assert host and app_card
    assert abs(host['width'] - 402) < 1 and abs(host['height'] - 874) < 1, host
    assert app_card['width'] <= 374.5, app_card
    assert app_card['height'] <= 666.5, app_card
    assert app_card['y'] > 12 and app_card['y'] + app_card['height'] < 862, app_card
    assert abs((app_card['x'] + app_card['width']/2) - 201) < 1.5, app_card

    # Search/confirm use the same retained custom modal engine and stay task-sized.
    search_box = page.locator('#search-card').bounding_box(); confirm_box = page.locator('#confirm-card').bounding_box()
    assert search_box and confirm_box
    assert search_box['width'] <= 374.5 and search_box['height'] < 874 - 24, search_box
    assert confirm_box['width'] <= 322.5 and confirm_box['height'] < 520.5, confirm_box
    assert abs((search_box['x'] + search_box['width']/2) - 201) < 1.5, search_box
    assert abs((confirm_box['x'] + confirm_box['width']/2) - 201) < 1.5, confirm_box

    # All card titles remain centered.
    for card_selector in ('#dialog-form','#search-card','#confirm-card'):
        card = page.locator(card_selector).bounding_box(); title = page.locator(f'{card_selector} .dialog-header h2').bounding_box()
        assert card and title and abs((title['x'] + title['width']/2) - (card['x'] + card['width']/2)) < 2.5

    # Every retained layer/backdrop owns the full Web drawable viewport; no native dialog is needed.
    for layer_selector in ('#management-layer', '#search-layer', '#confirm-layer'):
        layer_box = page.locator(layer_selector).bounding_box()
        backdrop_box = page.locator(f'{layer_selector} .modal-layer-backdrop').bounding_box()
        assert layer_box and backdrop_box
        assert abs(layer_box['width'] - 402) < 1 and abs(layer_box['height'] - 874) < 1, (layer_selector, layer_box)
        assert abs(backdrop_box['width'] - 402) < 1 and abs(backdrop_box['height'] - 874) < 1, (layer_selector, backdrop_box)

    # PIN is a persistent DOM dock: hidden by presentation state, never display:none.
    pin = page.locator('#pin-fixture')
    assert pin.evaluate("e => getComputedStyle(e).display") == 'grid'
    assert pin.evaluate("e => getComputedStyle(e).visibility") == 'hidden'
    page.eval_on_selector('#pin-fixture', "e => e.classList.add('dock-visible')")
    assert pin.evaluate("e => getComputedStyle(e).visibility") == 'visible'

    # Source and Traditional gloss share the same bottom-relative secondary-line Y metric.
    both_gloss = page.locator('#both-row .entry-gloss').bounding_box()
    both_source = page.locator('#both-row .entry-source-domain').bounding_box()
    line = page.locator('#both-row .entry-line').bounding_box()
    assert both_gloss and both_source and line
    gloss_bottom_gap = line['y'] + line['height'] - (both_gloss['y'] + both_gloss['height'])
    source_bottom_gap = line['y'] + line['height'] - (both_source['y'] + both_source['height'])
    assert abs(gloss_bottom_gap - source_bottom_gap) <= 1.2, (gloss_bottom_gap, source_bottom_gap)

    # Index/text/control stacks keep independent vertical centering in all metadata combinations.
    for row_id in ('plain-row', 'gloss-row', 'source-row', 'both-row'):
        line_box = page.locator(f'#{row_id} .entry-line').bounding_box()
        index_box = page.locator(f'#{row_id} .entry-index-inline').bounding_box()
        assert line_box and index_box
        assert abs(center_y(index_box) - center_y(line_box)) <= 1.5, (row_id, index_box, line_box)

    # Alphabet borders are owned by cells, including the A/first left edge; disabled glyphs do not dim structure.
    first = page.locator('#letter-fixture .letter-nav-track button:nth-child(1)')
    second = page.locator('#letter-fixture .letter-nav-track button:nth-child(2)')
    disabled = page.locator('#letter-fixture .letter-nav-track button:nth-child(3)')
    assert first.evaluate("e => getComputedStyle(e).borderLeftWidth") == '1px'
    for node in (first, second, disabled):
        assert node.evaluate("e => getComputedStyle(e).borderTopWidth") == '1px'
        assert node.evaluate("e => getComputedStyle(e).borderRightWidth") == '1px'
        assert node.evaluate("e => getComputedStyle(e).borderBottomWidth") == '1px'
    assert disabled.evaluate("e => getComputedStyle(e).opacity") == '1'
    assert disabled.evaluate("e => getComputedStyle(e).borderRightColor") == second.evaluate("e => getComputedStyle(e).borderRightColor")

    toolbar = page.locator('#bottom-toolbar').bounding_box()
    assert toolbar and abs(toolbar['height'] - 58) <= .7, toolbar
    disabled_opacity = page.locator('#bottom-toolbar button:nth-child(2)').evaluate("e => getComputedStyle(e).opacity")
    icon_opacity = page.locator('#bottom-toolbar button:nth-child(2) .ui-icon').evaluate("e => getComputedStyle(e).opacity")
    assert disabled_opacity == '1' and float(icon_opacity) < 1

    # Default application text is not selectable, actual editors are.
    body_select = page.locator('body').evaluate("e => getComputedStyle(e).userSelect")
    input_select = page.locator('#dialog-form input').evaluate("e => getComputedStyle(e).userSelect")
    assert body_select == 'none', body_select
    assert input_select == 'text', input_select

    page.close(); browser.close()
print('layout-contract-check: OK (402x874)')
