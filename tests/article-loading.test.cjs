const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(require.resolve(file)).href);

test('article model loads the selected article without waiting for secondary data', async () => {
    const { ArticleModel } = await load('../article/model.js');
    const article = { id: 'a', title: 'Ready to read' };
    const model = new ArticleModel({
        async getById() { return article; },
        getAll() { assert.fail('Related articles must not block article loading'); },
        getComments() { assert.fail('Comments must not block article loading'); }
    }, () => assert.fail('User lookup must not block article loading'));
    assert.equal(await model.loadArticle('a'), article);
});

test('controller renders immediately and isolates slow or failing secondary sections', async () => {
    const { ArticleController } = await load('../article/controller.js');
    const previousWindow = global.window;
    global.window = { location: { search: '?id=a' } };
    let resolveComments, rejectRelated;
    const events = [];
    const model = {
        async loadArticle() { return { id: 'a' }; },
        loadComments() { events.push('comments-request'); return new Promise(resolve => { resolveComments = resolve; }); },
        loadRelatedPosts() { events.push('related-request'); return new Promise((resolve, reject) => { rejectRelated = reject; }); },
        async loadUser() { events.push('user-request'); return { fullName: 'Reader' }; },
        async fetchWeather() { return {}; },
        repository: { async recordView() {} }
    };
    const view = {
        renderArticle() { events.push('article-rendered'); },
        setCommentsLoading(value) { events.push(value ? 'comments-loading' : 'comments-ready'); },
        bindCommentSubmit() {}, renderWeatherData() {}, setCommentUser() {},
        renderComments() { events.push('comments-rendered'); },
        renderRelatedPosts(posts) { assert.deepEqual(posts, []); },
        showArticleError() { assert.fail('Secondary failure must not hide the article'); },
        showCommentsLoadError() { assert.fail('Comments should succeed'); }
    };
    try {
        const controller = new ArticleController(model, view);
        await controller.ready;
        assert.equal(events[0], 'article-rendered');
        assert.ok(events.includes('user-request'));
        assert.ok(!events.includes('comments-ready'));
        rejectRelated(new Error('Slow related service failed'));
        resolveComments([]);
        await controller.secondaryReady;
        assert.ok(events.includes('comments-ready'));
        assert.ok(events.includes('comments-rendered'));
    } finally { global.window = previousWindow; }
});
