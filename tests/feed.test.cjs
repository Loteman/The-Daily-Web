const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(require.resolve(file)).href);
const records = [
    { id: 'a', title: 'Bread', summary: 'Baking', author: 'Writer', category: 'Food', date: '2026-09-20', views: 2, isRead: false },
    { id: 'b', title: 'Travel', summary: 'Walking', author: 'Writer', category: 'Travel', date: '2026-09-21', views: 8, isRead: true }
];

test('feed shares one request across initial load, filters and pagination', async () => {
    const { ArticlesFeedModel } = await load('../articlesFeed/model.js');
    let requests = 0;
    const model = new ArticlesFeedModel({ async getAll() { requests++; return records; } });
    const [first, filtered] = await Promise.all([model.getArticles({}, 1), model.getArticles({ search: 'bread' })]);
    assert.equal(first.articles[0].id, 'b');
    assert.equal(first.hasMore, true);
    assert.deepEqual(filtered.articles.map(article => article.id), ['a']);
    assert.equal((await model.getArticles({}, 28)).hasMore, false);
    assert.deepEqual((await model.getArticles({ category: 'Food' })).articles.map(article => article.id), ['a']);
    assert.deepEqual((await model.getArticles({ status: 'נקראו' })).articles.map(article => article.id), ['b']);
    assert.equal(requests, 1);
    assert.equal(records[0].id, 'a'); // Sorting does not change the cached source array.
});

test('failed requests can retry, and a new page instance fetches fresh data', async () => {
    const { ArticlesFeedModel } = await load('../articlesFeed/model.js');
    let requests = 0;
    const repository = { async getAll() { if (++requests === 1) throw new Error('offline'); return records; } };
    const model = new ArticlesFeedModel(repository);
    await assert.rejects(model.getArticles(), /offline/);
    assert.equal((await model.getArticles()).articles.length, 2);
    await new ArticlesFeedModel(repository).getArticles();
    assert.equal(requests, 3);
});

test('read tracking updates the cached feed without refetching articles', async () => {
    const { ArticlesFeedModel } = await load('../articlesFeed/model.js');
    let requests = 0;
    const model = new ArticlesFeedModel({
        async getAll() { requests++; return records.map(article => ({ ...article })); },
        async recordView() { return { isRead: true }; }
    });
    await model.getArticles();
    await model.toggleReadStatus('a');
    assert.equal((await model.getArticles({ status: 'נקראו' })).articles.length, 2);
    assert.equal(requests, 1);
});

test('controller starts category and article requests together', async () => {
    const { ArticlesFeedModel } = await load('../articlesFeed/model.js');
    const { ArticlesFeedController } = await load('../articlesFeed/controller.js');
    let resolveArticles, requests = 0, categoriesStarted = false;
    const model = new ArticlesFeedModel({
        getAll() { requests++; return new Promise(resolve => { resolveArticles = resolve; }); },
        async getCategories() { categoriesStarted = true; return [{ name: 'Food' }]; }
    });
    const view = {
        renderFeaturedArticle() {}, renderCategoryOptions() {}, getFilterValues() { return {}; },
        renderArticles() {}, updateLoadMoreVisibility() {}, bindFilterChange() {}, bindArticleClick() {}, bindLoadMore() {},
        showLoadError() { assert.fail('Unexpected loading error'); }
    };
    const controller = new ArticlesFeedController(model, view);
    assert.equal(categoriesStarted, true);
    resolveArticles(records);
    await controller.ready;
    await controller.handleLoadMore();
    await controller.handleFilterChange();
    assert.equal(requests, 1);
});
