from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CSS = "\n".join((ROOT / p).read_text() for p in [
    'css/v3.css', 'css/v3.3.1.css', 'css/v3.4.0.css', 'css/v3.5.1.css'
])

HTML = r'''
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>__CSS__</style></head><body>
<div id="entry-fixture" style="width:100%;max-width:520px;margin:0 auto">
  <article class="entry-row word-normal has-index no-gloss"><div class="entry-primary-shell"><div class="entry-line">
    <div class="entry-text-viewport horizontally-scrollable no-gloss"><div class="entry-text-content"><span class="entry-index-inline">12</span><div class="entry-lexeme-stack"><span class="entry-text">access</span></div></div></div>
    <span class="entry-study-date marked">8·3</span><div class="entry-actions"><button></button><button></button><button></button><button></button><button></button></div>
  </div></div></article>
  <article id="gloss-row" class="entry-row word-normal has-index has-gloss"><div class="entry-primary-shell"><div class="entry-line has-meta-line">
    <div class="entry-text-viewport horizontally-scrollable has-gloss has-meta-line"><div class="entry-text-content"><span class="entry-index-inline">13</span><div class="entry-lexeme-stack"><span class="entry-text">thread</span><span class="entry-gloss">線程</span></div></div></div>
    <div class="entry-actions"><span class="entry-action-placeholder relation-placeholder"></span><button></button><button></button><button></button><button></button></div>
  </div></div></article>
  <article id="source-row" class="entry-row word-normal has-index no-gloss has-source-domain"><div class="entry-primary-shell"><div class="entry-line has-meta-line">
    <div class="entry-text-viewport horizontally-scrollable no-gloss has-meta-line"><div class="entry-text-content"><span class="entry-index-inline">14</span><div class="entry-lexeme-stack"><span class="entry-text">edge</span><span class="entry-gloss entry-gloss-placeholder"></span></div></div></div>
    <div class="entry-actions"><button></button><button></button><button></button><button></button><button></button></div>
    <span class="entry-source-domain">计算机术语</span>
  </div></div></article>
  <article id="both-row" class="entry-row word-normal has-index has-gloss has-source-domain"><div class="entry-primary-shell"><div class="entry-line has-meta-line">
    <div class="entry-text-viewport horizontally-scrollable has-gloss has-meta-line"><div class="entry-text-content"><span class="entry-index-inline">15</span><div class="entry-lexeme-stack"><span class="entry-text">edge</span><span class="entry-gloss">邊</span></div></div></div>
    <div class="entry-actions"><span class="entry-action-placeholder relation-placeholder"></span><button></button><button></button><button></button><button></button></div>
    <span class="entry-source-domain">计算机术语</span>
  </div></div></article>
</div>
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
'''.replace('__CSS__', CSS)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in (320, 375, 390):
        page = browser.new_page(viewport={'width': width, 'height': 844})
        page.set_content(HTML)
        page.evaluate("document.documentElement.style.setProperty('--visual-width', innerWidth + 'px'); document.documentElement.style.setProperty('--visual-height', innerHeight + 'px')")
        for card_selector in ('#dialog-form', '#action-card', '#search-card', '#confirm-card'):
            card = page.locator(card_selector).bounding_box()
            title = page.locator(f'{card_selector} .dialog-header h2').bounding_box()
            body = page.locator(f'{card_selector} .dialog-body').bounding_box()
            assert card and card['x'] >= 0 and card['x'] + card['width'] <= width + .5, (width, card_selector, card)
            assert title and abs((title['x'] + title['width']/2) - (card['x'] + card['width']/2)) < 2.5, (width, card_selector, title, card)
            assert body and body['x'] >= card['x'] - .5 and body['x'] + body['width'] <= card['x'] + card['width'] + .5, (width, card_selector, body, card)
        for control_selector in ('#dialog-form input', '#dialog-form select', '#search-card input', '#search-card select', '#search-card .secondary-button'):
            control = page.locator(control_selector).bounding_box()
            body = page.locator(f'{control_selector.split()[0]} .dialog-body').bounding_box()
            assert control and body and control['x'] >= body['x'] - .5 and control['x'] + control['width'] <= body['x'] + body['width'] + .5, (width, control_selector, control, body)
        h_gloss = page.locator('#gloss-row .entry-line').bounding_box()['height']
        h_source = page.locator('#source-row .entry-line').bounding_box()['height']
        h_both = page.locator('#both-row .entry-line').bounding_box()['height']
        assert max(h_gloss, h_source, h_both) - min(h_gloss, h_source, h_both) <= 1.1, (width, h_gloss, h_source, h_both)
        action_widths = [page.locator(selector).bounding_box()['width'] for selector in ('#gloss-row .entry-actions', '#source-row .entry-actions', '#both-row .entry-actions')]
        assert max(action_widths) - min(action_widths) <= 1.1, (width, action_widths)
        text = page.locator('#gloss-row .entry-text').bounding_box()
        gloss = page.locator('#gloss-row .entry-gloss').bounding_box()
        assert abs(text['x'] - gloss['x']) <= 1.1, (width, text, gloss)
        row = page.locator('#source-row .entry-line').bounding_box()
        source = page.locator('#source-row .entry-source-domain').bounding_box()
        assert source['x'] + source['width'] <= row['x'] + row['width'] + .5
        assert source['y'] + source['height'] <= row['y'] + row['height'] + .5
        calendar = page.locator('.calendar-header').bounding_box()
        assert calendar and calendar['width'] <= width + .5
        page.close()
    browser.close()
print('layout-contract-check: OK')
