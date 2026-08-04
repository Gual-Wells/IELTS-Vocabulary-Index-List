from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CSS = "\n".join((ROOT / p).read_text() for p in [
    'css/v3.css', 'css/v3.3.1.css', 'css/v3.4.0.css', 'css/v3.5.2.css'
])

ACTIONS = '<div class="entry-actions"><span class="entry-action-placeholder relation-placeholder"></span><button></button><button></button><button></button><button></button></div>'

def row(row_id, index, word, gloss='', source='', date=''):
    gloss_html = f'<span class="entry-gloss">{gloss}</span>' if gloss else ''
    source_html = f'<span class="entry-source-domain">{source}</span>' if source else ''
    date_html = f'<span class="entry-study-date marked">{date}</span>' if date else ''
    classes = ['entry-row', 'word-normal', 'has-index', 'has-gloss' if gloss else 'no-gloss']
    if source:
        classes.append('has-source-domain')
    line_classes = ['entry-line']
    if gloss:
        line_classes.append('has-left-meta')
    if source:
        line_classes.append('has-right-meta')
    return f'''<article id="{row_id}" class="{' '.join(classes)}"><div class="entry-primary-shell"><div class="{' '.join(line_classes)}">
      <span class="entry-index-inline">{index}</span>
      <div class="entry-text-viewport horizontally-scrollable {'has-gloss' if gloss else 'no-gloss'}"><div class="entry-text-content"><div class="entry-lexeme-stack"><span class="entry-text">{word}</span>{gloss_html}</div></div></div>
      <div class="entry-control-stack{' has-source' if source else ''}"><div class="entry-control-main">{date_html}{ACTIONS}</div>{source_html}</div>
    </div></div></article>'''

HTML = f'''
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>{CSS}</style></head><body>
<div id="entry-fixture" style="width:100%;max-width:520px;margin:0 auto">
  {row('plain-row', '12', 'access', date='8·3')}
  {row('gloss-row', '13', 'thread', gloss='線程')}
  {row('source-row', '14', 'edge', source='计算机术语')}
  {row('both-row', '15', 'rendering pipeline', gloss='渲染管線', source='一个非常长的独立域来源名称', date='8·4')}
</div>
<nav id="bottom-toolbar" class="bottom-toolbar">
  <button><span class="ui-icon"></span></button>
  <button disabled><span class="ui-icon"></span></button>
  <button><span class="ui-icon"></span></button>
  <button disabled><span class="ui-icon"></span></button>
  <button><span class="ui-icon"></span></button>
</nav>
<section class="study-calendar"><header class="calendar-header">
<button class="icon-button calendar-prev-year"></button><button class="icon-button calendar-prev"></button><strong>2026 年 8 月</strong><button class="icon-button calendar-next"></button><button class="icon-button calendar-next-year"></button>
</header></section>
<dialog id="app-dialog" class="app-dialog form-dialog" open><form id="dialog-form">
<header class="dialog-header"><div><h2>设置</h2><p>对齐检查</p></div><button class="icon-button" type="button"></button></header>
<div class="dialog-body"><label class="field"><span>选项</span><select><option>一</option></select></label><label class="field"><span>文本</span><input value="test"></label></div>
<footer class="dialog-actions"><button>取消</button><button>保存</button></footer>
</form></dialog>
<dialog id="action-dialog" class="sheet-dialog action-dialog" open><div id="action-card" class="dialog-card">
<header class="dialog-header"><div><h2>条目操作</h2></div><button class="icon-button" type="button"></button></header>
<div class="dialog-body"><div class="action-list"><button>编辑</button><button>删除</button></div></div>
</div></dialog>
<dialog id="search-dialog" class="sheet-dialog search-dialog" open><div id="search-card" class="dialog-card">
<header class="dialog-header"><div><h2>搜索</h2></div><button class="icon-button" type="button"></button></header>
<div class="dialog-body"><div class="search-controls"><input value="edge"><select><option>全部</option></select><button class="secondary-button">搜索</button></div></div>
</div></dialog>
<dialog id="confirm-dialog" class="confirm-dialog" open><form id="confirm-card" class="dialog-card">
<header class="dialog-header"><div><h2>确认操作</h2></div><button class="icon-button" type="button"></button></header>
<div class="dialog-body"><p>确认内容</p></div><footer class="dialog-actions"><button>取消</button><button>确认</button></footer>
</form></dialog>
</body></html>
'''


def center_y(box):
    return box['y'] + box['height'] / 2

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in (320, 375, 390):
        page = browser.new_page(viewport={'width': width, 'height': 844})
        page.set_content(HTML)
        page.evaluate("""
          document.documentElement.style.setProperty('--visual-width', innerWidth + 'px');
          document.documentElement.style.setProperty('--visual-height', innerHeight + 'px');
          document.documentElement.style.setProperty('--visual-center-x', (innerWidth / 2) + 'px');
          document.documentElement.style.setProperty('--visual-center-y', (innerHeight / 2) + 'px');
        """)

        # Every dialog root covers the entire layout viewport; cards remain inside the visual viewport.
        for root_selector in ('#app-dialog', '#action-dialog', '#search-dialog', '#confirm-dialog'):
            root_box = page.locator(root_selector).bounding_box()
            assert root_box and abs(root_box['x']) < .6 and abs(root_box['y']) < .6, (width, root_selector, root_box)
            assert abs(root_box['width'] - width) < 1.1 and abs(root_box['height'] - 844) < 1.1, (width, root_selector, root_box)
        for card_selector in ('#dialog-form', '#action-card', '#search-card', '#confirm-card'):
            card = page.locator(card_selector).bounding_box()
            title = page.locator(f'{card_selector} .dialog-header h2').bounding_box()
            body = page.locator(f'{card_selector} .dialog-body').bounding_box()
            assert card and card['x'] >= 0 and card['x'] + card['width'] <= width + .5, (width, card_selector, card)
            assert title and abs((title['x'] + title['width']/2) - (card['x'] + card['width']/2)) < 2.5, (width, card_selector, title, card)
            assert body and body['x'] >= card['x'] - .5 and body['x'] + body['width'] <= card['x'] + card['width'] + .5, (width, card_selector, body, card)

        # The four metadata combinations share the same basic expansion rule.
        h_gloss = page.locator('#gloss-row .entry-line').bounding_box()['height']
        h_source = page.locator('#source-row .entry-line').bounding_box()['height']
        h_both = page.locator('#both-row .entry-line').bounding_box()['height']
        assert max(h_gloss, h_source, h_both) - min(h_gloss, h_source, h_both) <= 1.1, (width, h_gloss, h_source, h_both)

        # Index is always vertically centered; left and right stacks center independently.
        for row_id in ('plain-row', 'gloss-row', 'source-row', 'both-row'):
            line = page.locator(f'#{row_id} .entry-line').bounding_box()
            index = page.locator(f'#{row_id} .entry-index-inline').bounding_box()
            text = page.locator(f'#{row_id} .entry-text-viewport').bounding_box()
            controls = page.locator(f'#{row_id} .entry-control-stack').bounding_box()
            assert abs(center_y(index) - center_y(line)) <= 1.2, (width, row_id, index, line)
            assert abs(center_y(text) - center_y(line)) <= 1.2, (width, row_id, text, line)
            assert abs(center_y(controls) - center_y(line)) <= 1.2, (width, row_id, controls, line)

        text = page.locator('#gloss-row .entry-text').bounding_box()
        gloss = page.locator('#gloss-row .entry-gloss').bounding_box()
        assert abs(text['x'] - gloss['x']) <= 1.1, (width, text, gloss)
        gloss_style = page.locator('#gloss-row .entry-gloss').evaluate("e => ({fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight})")
        source_style = page.locator('#source-row .entry-source-domain').evaluate("e => ({fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight})")
        assert gloss_style == source_style, (width, gloss_style, source_style)
        source = page.locator('#both-row .entry-source-domain').bounding_box()
        controls = page.locator('#both-row .entry-control-stack').bounding_box()
        assert source['x'] >= controls['x'] - .5 and source['x'] + source['width'] <= controls['x'] + controls['width'] + .5

        # Bottom dock has no appended safe-area band; disabled icons fade but dividers do not.
        toolbar = page.locator('#bottom-toolbar').bounding_box()
        assert toolbar and abs(toolbar['height'] - 58) <= .6, (width, toolbar)
        enabled_border = page.locator('#bottom-toolbar button:nth-child(1)').evaluate("e => getComputedStyle(e).borderRightColor")
        disabled_border = page.locator('#bottom-toolbar button:nth-child(2)').evaluate("e => getComputedStyle(e).borderRightColor")
        disabled_opacity = page.locator('#bottom-toolbar button:nth-child(2)').evaluate("e => getComputedStyle(e).opacity")
        icon_opacity = page.locator('#bottom-toolbar button:nth-child(2) .ui-icon').evaluate("e => getComputedStyle(e).opacity")
        assert enabled_border == disabled_border, (width, enabled_border, disabled_border)
        assert disabled_opacity == '1', (width, disabled_opacity)
        assert float(icon_opacity) < 1, (width, icon_opacity)

        calendar = page.locator('.calendar-header').bounding_box()
        assert calendar and calendar['width'] <= width + .5
        page.close()
    browser.close()
print('layout-contract-check: OK')
