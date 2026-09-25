require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const samples = require('./sample-articles.json');
const { getCategories, roleFor } = require('../services/schemaService');

async function main() {
  await require('../config/db')();
  const db = mongoose.connection.db;
  const target = 60;
  const categories = await getCategories();
  const users = await db.collection('Users').find({}).toArray();
  const reporters = [];
  for (const user of users) if (await roleFor(user) === 'reporter') reporters.push(user);
  if (!reporters.length) throw new Error('No existing reporter is available');
  const existing = await db.collection('Articles').find({}, { projection: { title: 1 } }).toArray();
  if (existing.length > target) throw new Error('Already above target; no records will be removed');
  const needed = target - existing.length;
  const titles = new Set(existing.map(article => article.title));
  const selected = samples.filter(sample => !titles.has(sample.title)).slice(0, needed);
  if (selected.length !== needed) throw new Error('Not enough unique sample articles');
  const articles = [], updates = [];
  selected.forEach((sample, index) => {
    const category = categories.find(item => item.name === sample.category);
    if (!category) throw new Error('Missing category: ' + sample.category);
    const articleId = 'art_' + randomUUID();
    const date = new Date(Date.now() - index * 3600000).toISOString();
    articles.push({ articleId, title: sample.title, reporterIdNumber: reporters[index % reporters.length].idNumber,
      categoryId: category.id, mainImage: '', createdAt: date });
    updates.push({ updateId: 'upd_' + randomUUID(), articleId, version: 1, title: sample.title,
      categoryId: category.id, mainImage: '', summary: sample.summary, content: sample.content,
      status: 'published', editorNote: '', updatedAt: date, publishedAt: date });
  });
  console.log(JSON.stringify({ database: db.databaseName, before: existing.length, toAdd: needed, target,
    categories: [...new Set(selected.map(article => article.category))] }));
  if (!process.argv.includes('--apply') || !needed) return;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (await db.collection('Articles').countDocuments({}, { session }) !== existing.length) {
        throw new Error('Article count changed; rerun to calculate the new target');
      }
      await db.collection('Articles').insertMany(articles, { session });
      await db.collection('Updates').insertMany(updates, { session });
      if (await db.collection('Articles').countDocuments({}, { session }) !== target) throw new Error('Target count mismatch');
    });
  } finally { await session.endSession(); }
  const published = await require('../services/articleService').getPublishedArticles();
  console.log(JSON.stringify({ added: needed, totalArticles: await db.collection('Articles').countDocuments(), publishedInFeed: published.length }));
}
main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
