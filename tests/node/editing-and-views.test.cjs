const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Types: { ObjectId } } = require('mongoose');
const { startFixture } = require('./fixtures.cjs');

test('editors edit every article, statuses only change as allowed, and every view reaches the statistics', { timeout: 180000 }, async t => {
    const fixture = await startFixture();
    t.after(() => fixture.close());
    function client() {
        let cookie = '';
        return async (path, method = 'GET', body) => {
            const response = await fetch(fixture.base + path, {
                method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {})
            });
            if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
            return { status: response.status, body: response.status === 204 ? null : await response.json() };
        };
    }
    const guest = client(), reporter = client(), editor = client();
    for (const [api, username] of [[reporter, 'reporter'], [editor, 'editor']]) {
        assert.equal((await api('/api/auth/login', 'POST', { username, password: 'test-password' })).status, 200);
    }
    const revision = row => ({ updateId: row.updateId, updatedAt: row.updatedAt });
    const snapshot = async () => ({
        articles: await fixture.db.collection('Articles').find({}, { projection: { _id: 0 } }).sort({ articleId: 1 }).toArray(),
        hours: await fixture.db.collection('Statistics').find({}, { projection: { _id: 0 } }).sort({ articleId: 1, hour: 1 }).toArray()
    });
    const fields = { title: 'Draft by the reporter', summary: 'Summary', content: 'Body text.', categoryId: 2, mainImage: '' };
    let draftId;

    await t.test('an editor can edit drafts and returned versions, and saving never changes the status', async () => {
        let draft = (await reporter('/api/management/articles', 'POST', fields)).body;
        draftId = draft.id;
        const path = '/api/management/articles/' + draft.id;
        const firstVersion = await fixture.db.collection('Updates').findOne({ articleId: draft.id });
        assert.ok(firstVersion._id instanceof ObjectId); // first versions keep ObjectId ids, like the existing documents

        let result = await editor(path, 'PUT', { ...fields, title: 'Title fixed by the editor', ...revision(draft) });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'draft');
        assert.equal(result.body.title, 'Title fixed by the editor');
        draft = result.body;

        draft = (await reporter(path + '/status', 'PATCH', { status: 'pending', ...revision(draft) })).body;
        draft = (await editor(path + '/status', 'PATCH', { status: 'returned', editorNote: 'Shorten the summary', ...revision(draft) })).body;
        result = await editor(path, 'PUT', { ...fields, summary: 'Summary shortened by the editor', ...revision(draft) });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'returned');
        result = await reporter(path, 'PUT', { ...fields, summary: 'Summary shortened by the reporter', ...revision(result.body) });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'returned');
        assert.equal(result.body.editorNote, 'Shorten the summary');
        draft = result.body;

        // Only the listed transitions exist: a returned version goes back to pending, and nobody skips review.
        assert.equal((await reporter(path + '/status', 'PATCH', { status: 'published', ...revision(draft) })).status, 403);
        assert.equal((await editor(path + '/status', 'PATCH', { status: 'published', ...revision(draft) })).status, 403);
        assert.equal((await editor(path + '/status', 'PATCH', { status: 'draft', ...revision(draft) })).status, 403);
        result = await reporter(path + '/status', 'PATCH', { status: 'pending', ...revision(draft) });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'pending');
    });

    await t.test('an editor can revise a published article: the new version is pending until the editor publishes it', async () => {
        const path = '/api/management/articles/art_other'; // written by another reporter
        const published = (await guest('/api/articles/art_other')).body;
        let result = await editor(path + '/revisions', 'POST', revision((await editor(path)).body));
        assert.equal(result.status, 201);
        assert.equal(result.body.status, 'pending');
        assert.equal(result.body.version, 2);
        const stored = await fixture.db.collection('Updates').findOne({ articleId: 'art_other', version: 2 });
        assert.equal(stored._id, 'art_other:v2');

        result = await editor(path, 'PUT', { title: 'Revised by the editor', summary: 'Revised summary', content: 'Revised body.', categoryId: 1, mainImage: '', ...revision(result.body) });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'pending');
        assert.deepEqual((await guest('/api/articles/art_other')).body, published); // readers still see the published version

        result = await editor(path + '/status', 'PATCH', { status: 'published', ...revision(result.body) });
        assert.equal(result.status, 200);
        const updated = (await guest('/api/articles/art_other')).body;
        assert.equal(updated.title, 'Revised by the editor');
        assert.deepEqual(updated.paragraphs, ['Revised body.']);
        assert.equal(updated.version, 2);
        // A reporter still can't touch another reporter's article.
        assert.equal((await reporter(path + '/revisions', 'POST', revision(result.body))).status, 403);
    });

    await t.test('every visit counts in the view count, the popularity order and the hourly totals', async () => {
        for (let i = 0; i < 3; i++) assert.equal((await guest('/api/articles/art_fixture/views', 'POST', {})).status, 200);
        assert.equal((await guest('/api/articles/art_hidden/views', 'POST', {})).status, 404);
        assert.equal((await guest('/api/articles/art_fixture')).body.views, 3);
        const popular = (await guest('/api/articles?sort=popularity&limit=5')).body.articles;
        assert.deepEqual(popular.map(article => [article.id, article.views]), [['art_fixture', 3], ['art_other', 0]]);
        const statistics = (await editor('/api/statistics?articleId=art_fixture')).body;
        assert.equal(statistics.totalViews, 3);
        assert.equal(statistics.hourlyViews.length, 1);
        const stored = await fixture.db.collection('Statistics').find({ articleId: 'art_fixture' }).toArray();
        assert.deepEqual(stored.map(({ hour, views }) => ({ hour, views })), statistics.hourlyViews);
        // The editor's chart of every article reads the site's own hourly totals.
        const all = (await editor('/api/statistics')).body;
        assert.equal(all.totalViews, 3);
        assert.deepEqual(all.hourlyViews, statistics.hourlyViews);
        const site = await fixture.db.collection('Statistics').find({ articleId: null }).toArray();
        assert.deepEqual(site.map(({ hour, views }) => ({ hour, views })), all.hourlyViews);
    });

    await t.test('editors can list and correct view records, and the hourly totals follow', async () => {
        assert.equal((await reporter('/api/statistics/views?articleId=art_fixture')).status, 403);
        const views = (await editor('/api/statistics/views?articleId=art_fixture')).body;
        assert.equal(views.length, 3);
        const path = '/api/statistics/views/' + views[0].viewId;
        assert.equal((await reporter(path, 'PATCH', { viewedAt: '2026-09-01T09:30:00Z' })).status, 403);
        assert.equal((await editor(path, 'PATCH', { viewedAt: 'not a date' })).status, 400);
        assert.equal((await editor(path, 'PATCH', { viewedAt: '2999-01-01T00:00:00Z' })).status, 400);
        assert.equal((await editor('/api/statistics/views/view_missing', 'PATCH', { viewedAt: '2026-09-01T09:30:00Z' })).status, 404);
        const updated = await editor(path, 'PATCH', { viewedAt: '2026-09-01T09:30:00Z' });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.viewedAt, '2026-09-01T09:30:00.000Z');
        const statistics = (await editor('/api/statistics?articleId=art_fixture')).body;
        assert.equal(statistics.totalViews, 3);
        // 09:30 UTC is 12:30 in Israel (summer time), so the view moved to the 12:00 hour of September 1st.
        assert.deepEqual(statistics.hourlyViews[0], { hour: '2026-09-01T12:00', views: 1 });
        assert.equal(statistics.hourlyViews.reduce((total, hour) => total + hour.views, 0), 3);
        assert.deepEqual((await editor('/api/statistics')).body.hourlyViews, statistics.hourlyViews); // the site's totals moved too
    });

    await t.test('the statistics page gets a short article list with the same articles, order and counts', async () => {
        const managed = (await editor('/api/management/articles')).body;
        const list = (await editor('/api/statistics/articles')).body;
        assert.deepEqual(list, managed.map(article => ({ id: article.id, title: article.title, views: article.views })));
        assert.deepEqual((await reporter('/api/statistics/articles')).body.map(article => article.id).sort(), ['art_fixture', 'art_hidden', draftId].sort());
        assert.equal((await guest('/api/statistics/articles')).status, 401);
    });

    await t.test('rebuilding the stored data from Updates and Views gives exactly what the site kept up to date', async () => {
        const before = await snapshot();
        await fixture.rebuild();
        assert.deepEqual(await snapshot(), before);
    });

    await t.test('resetting an article\'s views clears its count and hourly totals', async () => {
        assert.equal((await reporter('/api/statistics/art_fixture', 'DELETE', {})).status, 403);
        assert.equal((await editor('/api/statistics/art_fixture', 'DELETE', {})).body.deletedCount, 3);
        assert.equal((await guest('/api/articles/art_fixture')).body.views, 0);
        assert.equal((await editor('/api/statistics?articleId=art_fixture')).body.totalViews, 0);
        assert.equal(await fixture.db.collection('Statistics').countDocuments({ articleId: 'art_fixture' }), 0);
        assert.equal((await editor('/api/statistics')).body.totalViews, 0);
        assert.equal(await fixture.db.collection('Statistics').countDocuments({}), 0);
    });

    await t.test('deleting an article takes its views off the site\'s totals', async () => {
        for (let i = 0; i < 2; i++) assert.equal((await guest('/api/articles/art_other/views', 'POST', {})).status, 200);
        assert.equal((await guest('/api/articles/art_fixture/views', 'POST', {})).status, 200);
        assert.equal((await editor('/api/statistics')).body.totalViews, 3);
        assert.equal((await editor('/api/management/articles/art_other', 'DELETE', {})).status, 204);
        const all = (await editor('/api/statistics')).body;
        assert.equal(all.totalViews, 1);
        assert.deepEqual(all.hourlyViews, (await editor('/api/statistics?articleId=art_fixture')).body.hourlyViews);
        const before = await snapshot();
        await fixture.rebuild();
        assert.deepEqual(await snapshot(), before);
    });
});
