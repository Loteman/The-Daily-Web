const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFile } = require('node:fs/promises');
const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

// Read-only integration checks against the configured database.
test('published articles API and browser repository', async t => {
  await require('../config/db')();
  const server = require('../app')({ sessionStore: new (require('express-session').MemoryStore)() }).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/articles`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const actual = await response.json();
  const db = mongoose.connection.db;
  const articles = await db.collection('Articles').find({}).toArray();
  const updates = await db.collection('Updates').find({}).toArray();
  const expected = articles.flatMap(article => {
    const published = updates.filter(update => update.articleId === article.articleId && update.status === 'published');
    published.sort((a, b) => b.version - a.version || new Date(b.updatedAt) - new Date(a.updatedAt) || String(b._id).localeCompare(String(a._id)));
    return published.length ? [{ article, update: published[0] }] : [];
  });
  assert.equal(actual.length, expected.length);
  assert.equal(new Set(actual.map(article => article.id)).size, actual.length);
  for (const { article, update } of expected) {
    const result = actual.find(item => item.id === article.articleId);
    assert.ok(result);
    assert.equal(result.version, update.version);
    assert.equal(result.updateId, update.updateId);
    assert.equal(result.status, 'published');
    assert.deepEqual(result.paragraphs, String(update.content || '').split(/\r?\n\s*\r?\n/).filter(Boolean));
    assert.equal('reporterIdNumber' in result, false);
    const detail = await fetch(`${base}/api/articles/${encodeURIComponent(article.articleId)}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), result);
  }
  assert.equal((await fetch(`${base}/api/articles/__missing_article__`)).status, 404);
  for (const path of ['/articlesFeed/index.html', '/article/index.html', '/data/articleRepository.js', '/header/index.html']) {
    assert.equal((await fetch(base + path)).status, 200);
  }
  for (const path of ['/.env', '/config/db.js', '/server.js']) {
    assert.equal((await fetch(base + path)).status, 404);
  }

  const { pathToFileURL } = require('node:url');
  const { ArticleRepository } = await import(pathToFileURL(require.resolve('../data/articleRepository.js')).href);
  const originalFetch = global.fetch;
  global.fetch = (path, options) => originalFetch(new URL(path, base), options);
  try {
    const repository = new ArticleRepository();
    assert.deepEqual(await repository.getAll(), actual);
    assert.equal(await repository.getById('__missing_article__'), null);
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'Unavailable' }) });
    await assert.rejects(repository.getAll(), /Unavailable/);
  } finally {
    global.fetch = originalFetch;
  }
});
