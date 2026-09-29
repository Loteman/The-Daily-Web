const { Article, Update, View, Statistic } = require('../models');
const { TIMEZONE, HOUR_FORMAT } = require('../utils/hours');

// The newest version first; the same order the site has always used to pick an article's current version.
const versionOrder = { version: -1, updatedAt: -1, _id: -1 };
// Statistics keeps the whole site's hourly totals under this articleId, next to each article's own.
const SITE = null;

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

// Builds the stored copy of one version (Articles.published or Articles.current), resolving the same fallbacks
// the listings always applied when they joined Updates on every request.
function versionSummary(update, article, kind) {
  if (!update) return null;
  const date = (kind === 'published' ? update.publishedAt || update.updatedAt : update.updatedAt) || article.createdAt;
  return {
    versionId: update._id,
    updateId: update.updateId,
    version: update.version,
    status: update.status,
    title: update.title ?? article.title ?? '',
    summary: update.summary ?? String(update.content || '').slice(0, 200),
    categoryId: update.categoryId ?? article.categoryId,
    mainImage: update.mainImage ?? article.mainImage ?? '',
    editorNote: update.editorNote || '',
    updatedAt: update.updatedAt,
    publishedAt: update.publishedAt ?? null,
    date,
    sortDate: toDate(date)
  };
}

// Recomputes one article's stored published and current versions from Updates. Every service that writes to
// Updates calls this in the same transaction, so the stored copies never disagree with the versions.
async function refreshArticle(articleId, session = null) {
  const article = await Article.findOne({ articleId }, { title: 1, categoryId: 1, mainImage: 1, createdAt: 1 }, { session }).lean();
  if (!article) return;
  const latest = await Update.findOne({ articleId }, null, { session }).sort(versionOrder).lean();
  const published = latest?.status === 'published' ? latest
    : await Update.findOne({ articleId, status: 'published' }, null, { session }).sort(versionOrder).lean();
  await Article.updateOne({ articleId }, {
    $set: { published: versionSummary(published, article, 'published'), current: versionSummary(latest, article, 'current') }
  }, { session });
}

// Adds views (negative to remove them) to an hour's total, for the article and for the whole site. Totals that
// reach 0 are removed, so the documents stay exactly what rebuildDerivedData would produce.
async function addToHour(articleId, hour, views, session = null) {
  for (const id of [articleId, SITE]) {
    await Statistic.updateOne({ articleId: id, hour }, { $inc: { views } }, { upsert: views > 0, session });
  }
  if (views < 0) await Statistic.deleteMany({ articleId: { $in: [articleId, SITE] }, hour, views: { $lte: 0 } }, { session });
}

// Removes an article's hourly totals and takes its views off the site's totals.
async function removeArticleHours(articleId, session = null) {
  const hours = await Statistic.find({ articleId }, { _id: 0, hour: 1, views: 1 }, { session }).lean();
  if (!hours.length) return;
  await Statistic.bulkWrite(hours.map(({ hour, views }) => ({
    updateOne: { filter: { articleId: SITE, hour }, update: { $inc: { views: -views } } }
  })), { session });
  await Statistic.deleteMany({ articleId: SITE, hour: { $in: hours.map(row => row.hour) }, views: { $lte: 0 } }, { session });
  await Statistic.deleteMany({ articleId }, { session });
}

// Rebuilds every stored copy from the source collections: each article's published and current versions and view
// count from Updates and Views, and the hourly totals in Statistics from Views. Safe to run any time; run it after
// changing Articles, Updates or Views outside the site (npm run db:rebuild).
async function rebuildDerivedData() {
  // Only the fields the stored copy needs; content only where a version has no summary to fall back on.
  const fields = {
    updateId: 1, articleId: 1, version: 1, status: 1, title: 1, summary: 1, categoryId: 1, mainImage: 1,
    editorNote: 1, updatedAt: 1, publishedAt: 1,
    content: { $cond: [{ $eq: [{ $ifNull: ['$summary', null] }, null] }, '$content', '$$REMOVE'] }
  };
  const newestPerArticle = [
    { $sort: { articleId: 1, ...versionOrder } },
    { $group: { _id: '$articleId', update: { $first: '$$ROOT' } } }
  ];
  const [articles, latestRows, publishedRows, viewRows] = await Promise.all([
    Article.find({}, { articleId: 1, title: 1, categoryId: 1, mainImage: 1, createdAt: 1 }).lean(),
    Update.aggregate([{ $project: fields }, ...newestPerArticle]).allowDiskUse(true),
    Update.aggregate([{ $match: { status: 'published' } }, { $project: fields }, ...newestPerArticle]).allowDiskUse(true),
    View.aggregate([{ $group: { _id: '$articleId', count: { $sum: 1 } } }]).allowDiskUse(true)
  ]);
  const latest = new Map(latestRows.map(row => [row._id, row.update]));
  const published = new Map(publishedRows.map(row => [row._id, row.update]));
  const views = new Map(viewRows.map(row => [row._id, row.count]));
  const operations = articles.map(article => ({ updateOne: {
    filter: { _id: article._id },
    update: { $set: {
      published: versionSummary(published.get(article.articleId), article, 'published'),
      current: versionSummary(latest.get(article.articleId), article, 'current'),
      viewCount: views.get(article.articleId) || 0
    } }
  } }));
  for (let index = 0; index < operations.length; index += 1000) {
    await Article.bulkWrite(operations.slice(index, index + 1000), { ordered: false });
  }

  // Hourly totals: the same grouping the statistics page used to compute from Views on every request. $out
  // replaces the collection's documents in one step and keeps its indexes.
  await View.aggregate([
    { $set: { date: { $convert: { input: '$viewedAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { date: { $ne: null }, articleId: { $type: 'string' } } },
    { $group: { _id: { articleId: '$articleId', hour: { $dateToString: { format: HOUR_FORMAT, date: '$date', timezone: TIMEZONE } } }, views: { $sum: 1 } } },
    { $project: { _id: 0, articleId: '$_id.articleId', hour: '$_id.hour', views: 1 } },
    { $out: Statistic.collection.collectionName }
  ]).allowDiskUse(true);
  // The whole site's totals: the articles' hours added up, leaving out views of articles that no longer exist.
  const siteHours = await Statistic.aggregate([
    { $match: { articleId: { $in: articles.map(article => article.articleId) } } },
    { $group: { _id: '$hour', views: { $sum: '$views' } } }
  ]).allowDiskUse(true);
  if (siteHours.length) await Statistic.insertMany(siteHours.map(row => ({ articleId: SITE, hour: row._id, views: row.views })), { lean: true });
  return { articles: articles.length, views: viewRows.reduce((total, row) => total + row.count, 0) };
}

// Rebuilds the stored copies when they are missing or out of step with Updates and Views: the first start after
// this version is installed, data added by an older script, or edits and views made by an older copy of the
// site. Only a few fields per article are compared, so a database that is already in step is left untouched.
async function ensureDerivedData() {
  const newest = [
    { $sort: { articleId: 1, ...versionOrder } },
    { $group: { _id: '$articleId', updateId: { $first: '$updateId' }, updatedAt: { $first: '$updatedAt' }, status: { $first: '$status' } } }
  ];
  const [articles, latestRows, publishedRows, viewRows, siteTotals] = await Promise.all([
    Article.find({}, { _id: 0, articleId: 1, viewCount: 1, 'current.updateId': 1, 'current.updatedAt': 1, 'current.status': 1,
      'published.updateId': 1, 'published.updatedAt': 1, 'published.status': 1 }).lean(),
    Update.aggregate(newest).allowDiskUse(true),
    Update.aggregate([{ $match: { status: 'published' } }, ...newest]).allowDiskUse(true),
    View.aggregate([{ $group: { _id: '$articleId', count: { $sum: 1 } } }]).allowDiskUse(true),
    Statistic.exists({ articleId: SITE })
  ]);
  const latest = new Map(latestRows.map(row => [row._id, row]));
  const published = new Map(publishedRows.map(row => [row._id, row]));
  const views = new Map(viewRows.map(row => [row._id, row.count]));
  const differs = (stored, source) => Boolean(stored) !== Boolean(source) || Boolean(source && (
    stored.updateId !== source.updateId || String(stored.updatedAt) !== String(source.updatedAt) || stored.status !== source.status));
  const outOfStep = articles.some(article => article.viewCount !== (views.get(article.articleId) || 0) ||
    differs(article.current, latest.get(article.articleId)) || differs(article.published, published.get(article.articleId)));
  const viewed = articles.some(article => views.get(article.articleId));
  if (outOfStep || (viewed && !siteTotals)) return rebuildDerivedData();
  return null;
}

module.exports = { SITE, refreshArticle, addToHour, removeArticleHours, rebuildDerivedData, ensureDerivedData, versionSummary };
