from playwright.sync_api import sync_playwright
from uuid import uuid4

base = 'http://127.0.0.1:3100'
title = 'Browser draft ' + uuid4().hex[:8]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context()
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/articlesFeed/index.html')
    page.wait_for_selector('.article-card[data-id="art_fixture"]')
    assert page.locator('.filter-group select').first.locator('option').count() == 4
    page.locator('[data-id="art_fixture"]').click()
    page.wait_for_url('**/article/index.html?id=art_fixture')
    page.wait_for_function("document.querySelector('.article-body').textContent.includes('Published content')")
    page.locator('.add-comment input').fill('Browser Guest')
    page.locator('.add-comment textarea').fill('Saved browser comment')
    page.locator('.submit-comment').click()
    page.wait_for_function("document.querySelector('.form-msg').textContent.includes('בהצלחה')")
    page.reload()
    page.wait_for_function("document.querySelector('.comments-section').textContent.includes('Saved browser comment')")
    page.goto(base + '/login/index.html')
    page.locator('input[type="text"]').fill('reporter')
    page.locator('input[type="password"]').fill('test-password')
    page.locator('.btn-submit').click()
    page.wait_for_url('**/articlesManagement/index.html')
    page.goto(base + '/articlesManagement/index.html')
    page.wait_for_selector('.action-main-btn')
    page.locator('.btn-new-article').click()
    page.wait_for_selector('.article-dialog[open]')
    assert page.locator('.editor-note').is_hidden()  # a new article has no editor's note (the line used to read "undefined")
    page.locator('[name="title"]').fill(title)
    page.locator('[name="summary"]').fill('Browser summary')
    page.locator('[name="content"]').fill('Browser article body')
    page.wait_for_function("document.querySelector('.autosave-status').textContent.includes('נשמרה אוטומטית')", timeout=15000)
    page.locator('.close-dialog').click()
    row = page.locator('.data-table tbody tr').filter(has_text=title)
    row.locator('[data-action="send"]').click()
    page.wait_for_function("title => Array.from(document.querySelectorAll('.data-table tr')).some(row => row.textContent.includes(title) && row.textContent.includes('ממתינה לאישור'))", arg=title)
    page.locator('.logout-link').click()
    page.wait_for_url('**/articlesFeed/index.html')
    page.goto(base + '/login/index.html')
    page.locator('input[type="text"]').fill('editor')
    page.locator('input[type="password"]').fill('test-password')
    page.locator('.btn-submit').click()
    page.wait_for_url('**/articlesManagement/index.html')
    page.goto(base + '/articlesManagement/index.html')
    row = page.locator('.data-table tbody tr').filter(has_text=title)
    row.locator('[data-action="review"]').click()
    page.wait_for_selector('.article-dialog[open]')
    assert page.locator('[name="content"]').input_value() == 'Browser article body'
    page.locator('.publish-article').click()
    page.wait_for_function("!document.querySelector('.article-dialog').open")
    page.goto(base + '/articlesFeed/index.html')
    page.wait_for_function("title => document.querySelector('.articles-grid').textContent.includes(title)", arg=title)
    # A returned article's dialog shows the editor's note.
    returned_title = 'Returned ' + title
    context.request.post(base + '/api/auth/logout', data={})
    assert context.request.post(base + '/api/auth/login', data={'username': 'reporter', 'password': 'test-password'}).ok
    draft = context.request.post(base + '/api/management/articles', data={'title': returned_title, 'summary': 'Summary', 'content': 'Body', 'categoryId': 1, 'mainImage': ''}).json()
    draft = context.request.patch(base + '/api/management/articles/' + draft['id'] + '/status', data={'status': 'pending', 'updateId': draft['updateId'], 'updatedAt': draft['updatedAt']}).json()
    context.request.post(base + '/api/auth/logout', data={})
    assert context.request.post(base + '/api/auth/login', data={'username': 'editor', 'password': 'test-password'}).ok
    assert context.request.patch(base + '/api/management/articles/' + draft['id'] + '/status', data={'status': 'returned', 'editorNote': 'Please add a source', 'updateId': draft['updateId'], 'updatedAt': draft['updatedAt']}).ok
    page.goto(base + '/articlesManagement/index.html')
    page.locator('.data-table tbody tr').filter(has_text=returned_title).locator('[data-action="edit"]').click()
    page.wait_for_selector('.article-dialog[open]')
    assert page.locator('.editor-note').inner_text() == 'הערות העורך: Please add a source'
    assert not errors, errors
    print('Browser passed: feed, categories, persistent comments, login/logout, reporter autosave/submit, editor review/publish, published feed, editor notes, no JavaScript errors.')
    browser.close()
