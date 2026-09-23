const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { once } = require('node:events');

async function startFixture(port = 0) {
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: 'daily_web_test', autoIndex: false, autoCreate: false });
    const db = mongoose.connection.db;
    const passwordHash = await bcrypt.hash('test-password', 4);
    await db.collection('Users').insertMany([
        { idNumber: 'reporter-1', username: 'reporter', fullName: 'Test Reporter', userType: 1, passwordHash },
        { idNumber: 'reporter-2', username: 'other', fullName: 'Other Reporter', userType: 1, passwordHash },
        { idNumber: 'editor-1', username: 'editor', fullName: 'Test Editor', userType: 2, passwordHash },
        { idNumber: 'bad-1', username: 'bad-hash', fullName: 'Bad Hash', userType: 2, passwordHash: 'not-a-bcrypt-hash' }
    ]);
    await db.collection('User_type').insertOne({ reporter: '1', editor: '2' });
    await db.collection('Categories').insertOne({ Food: 1, Politics: 2, Travel: 3 });
    await db.collection('Articles').insertMany([
        { articleId: 'art_fixture', title: 'Published title', reporterIdNumber: 'reporter-1', categoryId: 3, mainImage: '', createdAt: '2026-09-19T18:00:00Z' },
        { articleId: 'art_other', title: 'Other story', reporterIdNumber: 'reporter-2', categoryId: 1, mainImage: '', createdAt: '2026-09-19T18:00:00Z' },
        { articleId: 'art_hidden', title: 'Hidden draft', reporterIdNumber: 'reporter-1', categoryId: 2, mainImage: '', createdAt: '2026-09-19T18:00:00Z' }
    ]);
    await db.collection('Updates').insertMany([
        { updateId: 'upd_fixture', articleId: 'art_fixture', version: 1, content: 'Published content', summary: 'Published summary', status: 'published', updatedAt: '2026-09-19T18:00:00Z', publishedAt: '2026-09-19T18:00:00Z' },
        { updateId: 'upd_other', articleId: 'art_other', version: 1, content: 'Other published content', summary: 'Other summary', status: 'published', updatedAt: '2026-09-19T18:00:00Z', publishedAt: '2026-09-19T18:00:00Z' },
        { updateId: 'upd_hidden', articleId: 'art_hidden', version: 1, content: '', summary: '', status: 'draft', updatedAt: '2026-09-19T18:00:00Z', publishedAt: null }
    ]);
    const server = require('../app')().listen(port, '127.0.0.1');
    await once(server, 'listening');
    return {
        db, server, base: 'http://127.0.0.1:' + server.address().port,
        async close() {
            await new Promise(resolve => server.close(resolve));
            await mongoose.disconnect();
            await mongo.stop();
        }
    };
}
module.exports = { startFixture };
