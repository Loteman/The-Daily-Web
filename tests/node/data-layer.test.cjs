const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startFixture } = require('./fixtures.cjs');

test('Mongoose models, indexes and the stored listing data', { timeout: 180000 }, async t => {
    const fixture = await startFixture();
    t.after(() => fixture.close());
    const models = require('../../server/models');
    const { ensureDerivedData } = require('../../server/services/derivedDataService');
    const getJson = async path => (await fetch(fixture.base + path)).json();

    await t.test('each model maps to the existing collection', () => {
        const collections = Object.fromEntries(Object.entries(models)
            .filter(([, model]) => model.collection)
            .map(([name, model]) => [name, model.collection.collectionName]));
        assert.deepEqual(collections, {
            User: 'Users', UserType: 'User_type', Category: 'Categories', Article: 'Articles',
            Update: 'Updates', Comment: 'Commnents', View: 'Views', Statistic: 'Statistics'
        });
    });

    await t.test('the indexes the listings and statistics rely on exist', async () => {
        const keys = async name => (await fixture.db.collection(name).indexes()).map(index => JSON.stringify(index.key));
        const expected = {
            Articles: [{ articleId: 1 }, { 'published.sortDate': -1, articleId: 1 }, { viewCount: -1, articleId: 1 },
                { 'current.sortDate': -1, articleId: 1 }, { reporterIdNumber: 1, 'current.sortDate': -1 }],
            Updates: [{ articleId: 1, version: -1 }, { articleId: 1, status: 1, version: -1 }],
            Views: [{ articleId: 1, viewedAt: -1 }, { idNumber: 1, articleId: 1 }, { viewId: 1 }],
            Statistics: [{ articleId: 1, hour: 1 }],
            Commnents: [{ articleId: 1, createdAt: -1 }, { commentId: 1 }],
            Users: [{ idNumber: 1 }, { username: 1 }]
        };
        for (const [collection, indexes] of Object.entries(expected)) {
            const existing = await keys(collection);
            for (const index of indexes) assert.ok(existing.includes(JSON.stringify(index)), collection + ' ' + JSON.stringify(index));
        }
    });

    await t.test('the feed is ordered by publication date, not by the last edit', async () => {
        // art_fixture was edited last but published first.
        await fixture.db.collection('Updates').updateOne({ updateId: 'upd_fixture' }, { $set: { publishedAt: '2026-09-18T08:00:00Z', updatedAt: '2026-09-25T08:00:00Z' } });
        await fixture.db.collection('Updates').updateOne({ updateId: 'upd_other' }, { $set: { publishedAt: '2026-09-20T08:00:00Z', updatedAt: '2026-09-20T08:00:00Z' } });
        await fixture.rebuild();
        const feed = (await getJson('/api/articles?sort=date&limit=10')).articles;
        assert.deepEqual(feed.map(article => [article.id, article.date]), [['art_other', '2026-09-20T08:00:00Z'], ['art_fixture', '2026-09-18T08:00:00Z']]);
    });

    await t.test('stored data is rebuilt when it is out of step, and left alone when it is not', async () => {
        assert.equal(await ensureDerivedData(), null);
        // A view and a new version written straight to the database, as an older copy of the site would.
        await fixture.db.collection('Views').insertOne({ viewId: 'view_old', articleId: 'art_other', idNumber: null, viewedAt: '2026-09-22T10:00:00Z' });
        await fixture.db.collection('Updates').insertOne({ updateId: 'upd_old', articleId: 'art_other', version: 2, title: 'Newer version', summary: 'Newer summary', content: 'Newer content', status: 'published', updatedAt: '2026-09-23T10:00:00Z', publishedAt: '2026-09-23T10:00:00Z' });
        assert.ok(await ensureDerivedData());
        const article = await getJson('/api/articles/art_other');
        assert.equal(article.views, 1);
        assert.equal(article.title, 'Newer version');
        assert.equal(article.date, '2026-09-23T10:00:00Z');
        const hours = await fixture.db.collection('Statistics').find({ articleId: 'art_other' }, { projection: { _id: 0 } }).toArray();
        assert.deepEqual(hours, [{ articleId: 'art_other', hour: '2026-09-22T13:00', views: 1 }]);
        const site = await fixture.db.collection('Statistics').find({ articleId: null }, { projection: { _id: 0 } }).toArray();
        assert.deepEqual(site, [{ articleId: null, hour: '2026-09-22T13:00', views: 1 }]);
        assert.equal(await ensureDerivedData(), null);
        // Missing site totals are rebuilt too.
        await fixture.db.collection('Statistics').deleteMany({ articleId: null });
        assert.ok(await ensureDerivedData());
        assert.equal(await fixture.db.collection('Statistics').countDocuments({ articleId: null }), 1);
    });

    await t.test('views of articles that no longer exist stay out of the site\'s totals', async () => {
        await fixture.db.collection('Views').insertMany([
            { viewId: 'view_orphan', articleId: 'art_deleted', idNumber: null, viewedAt: '2026-09-22T10:30:00Z' },
            { viewId: 'view_no_article', idNumber: null, viewedAt: '2026-09-22T10:40:00Z' }
        ]);
        await fixture.rebuild();
        const site = await fixture.db.collection('Statistics').find({ articleId: null }, { projection: { _id: 0 } }).toArray();
        assert.deepEqual(site, [{ articleId: null, hour: '2026-09-22T13:00', views: 1 }]);
    });
});
