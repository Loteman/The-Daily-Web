const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { startFixture } = require('./fixtures.cjs');
const load = file => import(pathToFileURL(require.resolve(file)).href);
const records = [
    { id: 'a', title: 'Bread', summary: 'Baking', author: 'Writer', category: 'Food', date: '2026-09-20', views: 2, isRead: false },
    { id: 'b', title: 'Travel', summary: 'Walking', author: 'Writer', category: 'Travel', date: '2026-09-21', views: 8, isRead: true }
];

// Search, filters, sort and paging run on the server (see articlesFeed/model.js), so this drives the real
// feed model and browser repository against the fixture website instead of a stub repository.
test('feed search, filters, sort and paging return the right articles from the server', { timeout: 120000 }, async t => {
    const fixture = await startFixture();
    t.after(() => fixture.close());
    // A later publication date for art_other, so newest-first and most-viewed orders differ. The feed sorts by
    // publication date, and this edit bypasses the site, so the stored listing copy is refreshed afterwards.
    await fixture.db.collection('Updates').updateOne({ updateId: 'upd_other' }, { $set: { updatedAt: '2026-09-21T18:00:00Z', publishedAt: '2026-09-21T18:00:00Z' } });
    await fixture.rebuild();
    for (let i = 0; i < 2; i++) { // two other readers open art_fixture
        await fetch(fixture.base + '/api/articles/art_fixture/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }
    // The browser repository requests relative URLs with the session cookie; send them to the fixture.
    const originalFetch = global.fetch;
    let cookie = '', requests = 0;
    global.fetch = async (path, options = {}) => {
        requests++;
        const response = await originalFetch(new URL(path, fixture.base), { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
        cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
        return response;
    };
    t.after(() => { global.fetch = originalFetch; });
    const { ArticlesFeedModel } = await load('../../client/articlesFeed/model.js');
    const model = new ArticlesFeedModel();
    assert.deepEqual(await model.toggleReadStatus('art_other'), { isRead: true }); // this reader has read art_other only
    const ids = async (...args) => (await model.getArticles(...args)).articles.map(article => article.id);
    requests = 0;
    assert.deepEqual(await ids(), ['art_other', 'art_fixture']);
    assert.deepEqual(await ids({ sortBy: 'תאריך פרסום' }), ['art_other', 'art_fixture']);
    assert.deepEqual(await ids({ sortBy: 'פופולריות' }), ['art_fixture', 'art_other']);
    assert.deepEqual(await ids({ search: ' published ' }), ['art_fixture']);
    assert.deepEqual(await ids({ category: 'Food' }), ['art_other']);
    assert.deepEqual(await ids({ category: 'הכל' }), ['art_other', 'art_fixture']);
    assert.deepEqual(await ids({ status: 'נקראו' }), ['art_other']);
    assert.deepEqual(await ids({ status: 'לא נקראו' }), ['art_fixture']);
    assert.equal(requests, 8); // one request per lookup
    const firstPage = await model.getArticles({}, 0, 1);
    assert.deepEqual([firstPage.articles.map(article => article.id), firstPage.hasMore], [['art_other'], true]);
    const lastPage = await model.getArticles({}, 1, 1);
    assert.deepEqual([lastPage.articles.map(article => article.id), lastPage.hasMore], [['art_fixture'], false]);
});

test('failed requests can retry, and a new page instance fetches fresh data', async () => {
    const { ArticlesFeedModel } = await load('../../client/articlesFeed/model.js');
    let requests = 0;
    const repository = { async search() { if (++requests === 1) throw new Error('offline'); return { articles: records, hasMore: false }; } };
    const model = new ArticlesFeedModel(repository);
    await assert.rejects(model.getArticles(), /offline/);
    assert.equal((await model.getArticles()).articles.length, 2);
    await new ArticlesFeedModel(repository).getArticles();
    assert.equal(requests, 3);
});

test('read tracking records the view without refetching articles', async () => {
    const { ArticlesFeedModel } = await load('../../client/articlesFeed/model.js');
    let requests = 0;
    const viewed = [];
    const model = new ArticlesFeedModel({
        async search() { requests++; return { articles: records.map(article => ({ ...article })), hasMore: false }; },
        async recordView(id) { viewed.push(id); return { isRead: true }; }
    });
    await model.getArticles();
    assert.deepEqual(await model.toggleReadStatus('a'), { isRead: true });
    assert.deepEqual(viewed, ['a']);
    assert.equal(requests, 1);
});

test('controller starts category and article requests together', async () => {
    const { ArticlesFeedModel } = await load('../../client/articlesFeed/model.js');
    const { ArticlesFeedController } = await load('../../client/articlesFeed/controller.js');
    const searches = [], pending = [];
    let categoriesStarted = false;
    const answer = page => pending.splice(0).forEach(resolve => resolve(page));
    const model = new ArticlesFeedModel({
        search(query) { searches.push([query.skip, query.limit]); return new Promise(resolve => { pending.push(resolve); }); },
        async getCategories() { categoriesStarted = true; return [{ name: 'Food' }]; }
    });
    const view = {
        renderFeaturedArticle() {}, renderCategoryOptions() {}, getFilterValues() { return {}; }, hideLoadingOverlay() {},
        renderArticles() {}, updateLoadMoreVisibility() {}, bindFilterChange() {}, bindArticleClick() {}, bindLoadMore() {},
        showLoadError() { assert.fail('Unexpected loading error'); }
    };
    const controller = new ArticlesFeedController(model, view);
    // Categories, the featured article and the first page are all requested before any of them answers.
    assert.equal(categoriesStarted, true);
    assert.deepEqual(searches, [[0, 1], [0, 8]]);
    answer({ articles: records, hasMore: true });
    await controller.ready;
    const loadMore = controller.handleLoadMore();
    answer({ articles: [], hasMore: false });
    await loadMore;
    const filterChange = controller.handleFilterChange();
    answer({ articles: records, hasMore: false });
    await filterChange;
    assert.deepEqual(searches.slice(2), [[2, 20], [0, 8]]);
});
