const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startFixture } = require('./fixtures.cjs');

test('database website workflows on an isolated local replica set', { timeout: 180000 }, async t => {
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
            return { status: response.status, body: await response.json(), cookie };
        };
    }
    const guest = client(), reporter = client(), editor = client(), other = client();
    const revision = row => ({ updateId: row.updateId, updatedAt: row.updatedAt });
    const fields = { title: 'New article', summary: 'Summary', content: 'First paragraph.\n\nSecond paragraph.', categoryId: 1, mainImage: '' };

    await t.test('public feed hides drafts and personal fields; management requires login', async () => {
        const feed = await guest('/api/articles');
        assert.equal(feed.status, 200);
        assert.equal(feed.body.length, 2);
        assert.equal(feed.body.find(row => row.id === 'art_fixture').author, 'Test Reporter');
        assert.equal(JSON.stringify(feed.body).includes('passwordHash'), false);
        assert.equal(JSON.stringify(feed.body).includes('reporterIdNumber'), false);
        assert.equal((await guest('/api/articles/art_hidden')).status, 404);
        assert.equal((await guest('/api/management/articles')).status, 401);
        assert.equal((await guest('/api/statistics')).status, 401);
    });
    await t.test('bcrypt login, database roles and persisted sessions', async () => {
        assert.equal((await guest('/api/auth/login', 'POST', { username: 'bad-hash', password: 'test-password' })).status, 401);
        assert.equal((await guest('/api/auth/login', 'POST', { username: { $ne: null }, password: 'test-password' })).status, 400);
        for (const [api, username] of [[reporter, 'reporter'], [editor, 'editor'], [other, 'other']]) {
            assert.equal((await api('/api/auth/login', 'POST', { username, password: 'test-password' })).status, 200);
        }
        assert.equal((await reporter('/api/auth/me')).body.user.role, 'reporter');
        assert.equal((await editor('/api/auth/me')).body.user.role, 'editor');
        assert.equal(await fixture.db.collection('Sessions').countDocuments(), 3);
        const own = (await reporter('/api/management/articles')).body;
        assert.equal(own.some(row => row.id === 'art_other'), false);
    });

    let draft;
    await t.test('create and autosave a draft, validate category and prevent stale saves', async () => {
        assert.equal((await editor('/api/management/articles', 'POST', fields)).status, 403);
        assert.equal((await reporter('/api/management/articles', 'POST', { ...fields, categoryId: 999 })).status, 400);
        const created = await reporter('/api/management/articles', 'POST', fields);
        assert.equal(created.status, 201);
        draft = created.body;
        assert.equal(draft.status, 'draft');
        assert.equal((await guest('/api/articles/' + draft.id)).status, 404);
        assert.equal((await other('/api/management/articles/' + draft.id, 'PUT', { ...fields, ...revision(draft) })).status, 403);
        const stale = revision(draft);
        const saved = await reporter('/api/management/articles/' + draft.id, 'PUT', { ...fields, title: 'Saved title', ...stale });
        assert.equal(saved.status, 200);
        draft = saved.body;
        assert.equal(draft.title, 'Saved title');
        assert.equal((await reporter('/api/management/articles/' + draft.id, 'PUT', { ...fields, ...stale })).status, 409);
    });
    await t.test('submit, return with editor note, revise and publish', async () => {
        const path = '/api/management/articles/' + draft.id;
        let result = await reporter(path + '/status', 'PATCH', { status: 'published', ...revision(draft) });
        assert.equal(result.status, 403);
        result = await reporter(path + '/status', 'PATCH', { status: 'pending', ...revision(draft) });
        assert.equal(result.status, 200); draft = result.body;
        assert.equal((await reporter(path, 'PUT', { ...fields, ...revision(draft) })).status, 409);
        assert.equal((await editor(path + '/status', 'PATCH', { status: 'returned', ...revision(draft) })).status, 400);
        result = await editor(path + '/status', 'PATCH', { status: 'returned', editorNote: 'Please expand the summary', ...revision(draft) });
        assert.equal(result.status, 200); draft = result.body;
        assert.equal(draft.editorNote, 'Please expand the summary');
        result = await reporter(path, 'PUT', { ...fields, summary: 'Expanded summary', ...revision(draft) });
        assert.equal(result.status, 200); draft = result.body;
        result = await reporter(path + '/status', 'PATCH', { status: 'pending', ...revision(draft) });
        assert.equal(result.status, 200); draft = result.body;
        result = await editor(path + '/status', 'PATCH', { status: 'published', ...revision(draft) });
        assert.equal(result.status, 200); draft = result.body;
        const published = await guest('/api/articles/' + draft.id);
        assert.equal(published.status, 200);
        assert.equal(published.body.summary, 'Expanded summary');
        assert.equal('editorNote' in published.body, false);
    });
    await t.test('new draft preserves all published fields; concurrent revisions cannot duplicate', async () => {
        const path = '/api/management/articles/' + draft.id;
        const published = (await guest('/api/articles/' + draft.id)).body;
        const results = await Promise.all([
            reporter(path + '/revisions', 'POST', revision(draft)),
            reporter(path + '/revisions', 'POST', revision(draft))
        ]);
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
        draft = results.find(result => result.status === 201).body;
        assert.equal(draft.version, 2);
        const result = await reporter(path, 'PUT', { ...fields, title: 'Unapproved title', categoryId: 3, mainImage: 'https://example.com/new.jpg', content: 'Secret draft', ...revision(draft) });
        assert.equal(result.status, 200);
        assert.deepEqual((await guest('/api/articles/' + draft.id)).body, published);
    });
    await t.test('views and read filters persist, comments use DB names and guest limit', async () => {
        assert.equal((await guest('/api/articles/art_fixture/views', 'POST', {})).status, 200);
        assert.equal((await guest('/api/articles/art_fixture/views', 'POST', {})).status, 200);
        assert.equal(await fixture.db.collection('Views').countDocuments({ articleId: 'art_fixture' }), 1);
        assert.equal((await guest('/api/articles/art_fixture')).body.isRead, true);
        assert.equal((await reporter('/api/articles/art_fixture/views', 'POST', {})).status, 200);
        const view = await fixture.db.collection('Views').findOne({ idNumber: 'reporter-1' });
        assert.equal(view.articleId, 'art_fixture');
        assert.equal((await reporter('/api/articles/art_fixture')).body.isRead, true);
        for (let i = 0; i < 3; i++) {
            assert.equal((await guest('/api/articles/art_fixture/comments', 'POST', { fullName: 'Guest name', content: 'Guest comment ' + i })).status, 201);
        }
        const limited = await guest('/api/articles/art_fixture/comments', 'POST', { fullName: 'Guest name', content: 'Fourth comment' });
        assert.equal(limited.status, 429);
        assert.equal(limited.body.code, 'GUEST_COMMENT_LIMIT');
        const authored = await reporter('/api/articles/art_fixture/comments', 'POST', { fullName: 'Spoofed name', content: 'Reporter comment' });
        assert.equal(authored.status, 201);
        assert.equal(authored.body.name, 'Test Reporter');
        assert.equal((await guest('/api/articles/art_fixture/comments')).body.length, 4);
        assert.equal((await guest('/api/articles/art_hidden/comments')).status, 404);
        const stored = await fixture.db.collection('Commnents').findOne({ commentId: authored.body.id });
        assert.equal(stored.idNumber, 'reporter-1');
        assert.equal(stored.content, 'Reporter comment');
    });
    await t.test('statistics obey ownership, cross-origin writes blocked, logout revokes access', async () => {
        assert.equal((await reporter('/api/statistics')).body.totalViews, 2);
        assert.equal((await other('/api/statistics')).body.totalViews, 0);
        assert.equal((await other('/api/statistics?articleId=art_fixture')).status, 404);
        const crossOrigin = await fetch(fixture.base + '/api/auth/logout', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(crossOrigin.status, 403);
        assert.equal((await reporter('/api/auth/logout', 'POST', {})).status, 200);
        assert.equal((await reporter('/api/management/articles')).status, 401);
    });
});
