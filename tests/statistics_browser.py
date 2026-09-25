from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    base = 'http://127.0.0.1:3100'
    page.goto(base + '/public/statistics/index.html')
    page.wait_for_selector('#message a')
    assert page.locator('#dashboard').is_hidden()
    assert context.request.post(base + '/api/auth/login', data={'username':'reporter','password':'test-password'}).status == 200
    context.request.post(base + '/api/articles/art_fixture/views', data={})
    page.reload()
    page.wait_for_selector('#dashboard:not([hidden])')
    assert page.locator('#article-count').inner_text() == '2'
    assert page.locator('#total-views').inner_text() == '1'
    assert page.locator('#chart svg').count() == 1
    assert page.locator('#article-filter option[value="art_other"]').count() == 0
    page.locator('#article-filter').select_option('art_hidden')
    page.wait_for_function("document.querySelector('#article-count').textContent === '1' && document.querySelector('#dashboard').getAttribute('aria-busy') === 'false'")
    assert page.locator('#total-views').inner_text() == '0'
    assert page.locator('#chart svg').count() == 0
    page.locator('#period-filter').select_option('7')
    page.locator('#article-filter').select_option('art_fixture')
    page.wait_for_function("document.querySelector('#total-views').textContent === '1'")
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    context.request.post(base + '/api/auth/logout', data={})
    context.request.post(base + '/api/auth/login', data={'username':'editor','password':'test-password'})
    page.reload()
    page.wait_for_selector('#dashboard:not([hidden])')
    assert page.locator('#article-count').inner_text() == '3'
    assert page.locator('#article-filter option[value="art_other"]').count() == 1
    page.route('**/api/statistics*', lambda route: route.fulfill(status=500, content_type='application/json', body='{}'))
    page.locator('#refresh').click()
    page.wait_for_selector('#message button')
    assert page.locator('#dashboard').is_hidden()
    page.unroute('**/api/statistics*')
    page.locator('#message button').click()
    page.wait_for_selector('#dashboard:not([hidden])')
    assert not errors, errors
    print('PASS: login gate, role scope, filters, chart, empty state, mobile layout, error recovery, no JavaScript errors.')
    browser.close()
