require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
const mongoose = require('mongoose');
const { getCategories } = require('../services/schemaService');

// Unsplash photographs served at a size suitable for feed cards and article headers.
const photos = {
  Food: ['1490645935967-10de6ba17061', '1512621776951-a57141f2eefd', '1504674900247-0877df9cc836'],
  Politics: ['1450101499163-c8848c66ca85', '1497366754035-f200968a6e72'],
  Travel: ['1500530855697-b586d89ba3ee', '1476514525535-07fb3b4ae5f1', '1488646953014-85cb44e25828'],
  Technology: ['1498050108023-c5249f4df085']
};
const imageUrl = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
const missingImage = value => !value || /^https?:\/\/example\.com\//i.test(value);
const technologyTitle = value => /פיתוח|תוכנה|בינה מלאכותית|MongoDB|\bAI\b/i.test(value || '');

async function main() {
  for (const id of Object.values(photos).flat()) {
    const response = await fetch(imageUrl(id), { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error(`Image unavailable: ${id} (${response.status})`);
    }
  }
  await require('../config/db')();
  const db = mongoose.connection.db;
  const categories = new Map((await getCategories()).map(item => [String(item.id), item.name]));
  const articles = await db.collection('Articles').find({}).sort({ articleId: 1 }).toArray();
  const counters = {};
  const assignments = articles.map(article => {
    const category = technologyTitle(article.title) ? 'Technology' : categories.get(String(article.categoryId));
    const choices = photos[category];
    if (!choices) return null;
    const index = counters[category] || 0;
    counters[category] = index + 1;
    return { article, url: missingImage(article.mainImage) ? imageUrl(choices[index % choices.length]) : article.mainImage };
  }).filter(Boolean);
  console.log(JSON.stringify({ articles: articles.length, availablePhotos: Object.values(photos).flat().length,
    missingArticleImages: assignments.filter(item => missingImage(item.article.mainImage)).length }));
  if (!process.argv.includes('--apply')) return;
  const session = await mongoose.startSession();
  let articleChanges = 0, updateChanges = 0;
  try {
    await session.withTransaction(async () => {
      articleChanges = 0; updateChanges = 0;
      for (const { article, url } of assignments) {
        if (missingImage(article.mainImage)) {
          const result = await db.collection('Articles').updateOne({ _id: article._id, mainImage: article.mainImage ?? null }, { $set: { mainImage: url } }, { session });
          articleChanges += result.modifiedCount;
        }
        const versions = await db.collection('Updates').find({ articleId: article.articleId }, { session }).toArray();
        for (const version of versions) {
          const generatedImage = Object.values(photos).flat().some(id => imageUrl(id) === version.mainImage);
          if (!missingImage(version.mainImage) && !generatedImage) continue;
          const category = technologyTitle(version.title ?? article.title) ? 'Technology' : categories.get(String(version.categoryId ?? article.categoryId));
          const choices = photos[category];
          const versionUrl = choices && !choices.some(id => imageUrl(id) === url) ? imageUrl(choices[0]) : url;
          const result = await db.collection('Updates').updateOne({ _id: version._id }, { $set: { mainImage: versionUrl } }, { session });
          updateChanges += result.modifiedCount;
        }
      }
    });
  } finally { await session.endSession(); }
  const feed = await require('../services/articleService').getPublishedArticles();
  console.log(JSON.stringify({ articleChanges, updateChanges, publishedArticlesWithImages: feed.filter(article => !missingImage(article.mainImage)).length }));
}
main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
