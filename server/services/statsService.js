const { randomUUID } = require('node:crypto');
const { Article, Update, View, Statistic } = require('../models');
const { httpError, transaction } = require('./schemaService');
const { getManagementStatuses, getStatisticsArticles, isPublished } = require('./articleService');
const { SITE, addToHour, removeArticleHours } = require('./derivedDataService');
const { hourKey } = require('../utils/hours');

// Create on the view-events model. Every visit counts: the raw view is stored (signed-in readers' read status
// comes from it), and the article's view count and its hour's totals (the article's and the site's) go up by one.
// These are single-document increments, so thousands of simultaneous readers don't wait on a recount.
async function recordView(articleId, user) {
  if (!(await isPublished(articleId))) throw httpError(404, 'הכתבה לא נמצאה.');
  const viewedAt = new Date();
  await Promise.all([
    View.create({ viewId: 'view_' + randomUUID(), articleId, idNumber: user?.idNumber || null, viewedAt: viewedAt.toISOString() }),
    addToHour(articleId, hourKey(viewedAt), 1),
    Article.updateOne({ articleId }, { $inc: { viewCount: 1 } })
  ]);
}

async function getStatistics(user, articleId) {
  const rows = await getManagementStatuses(user);
  if (articleId && !rows.some(row => row.id === articleId)) throw httpError(404, 'הכתבה לא נמצאה.');
  const ids = articleId ? [articleId] : rows.map(row => row.id);
  const statuses = { draft: 0, pending: 0, published: 0, returned: 0 };
  const selected = new Set(ids);
  rows.filter(row => selected.has(row.id)).forEach(row => { if (row.status in statuses) statuses[row.status]++; });
  // These three don't depend on each other, only on `ids` above - running them together turns 3
  // sequential round-trips to the database into 1, which is most of what made this endpoint slow.
  const [hourlyViews, publications, versionChanges] = await Promise.all([
    // Grouped by hour (not day) so a single selected day can be broken down hour-by-hour on the client;
    // longer periods sum these back up into daily buckets there. Read from the stored hourly totals: an editor's
    // chart of every article reads the site's own totals, other charts add up their articles' totals.
    user?.role === 'editor' && !articleId
      ? Statistic.find({ articleId: SITE }, { _id: 0, hour: 1, views: 1 }).sort({ hour: 1 }).lean()
      : Statistic.aggregate([
        { $match: { articleId: { $in: ids } } },
        { $group: { _id: '$hour', views: { $sum: '$views' } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, hour: '$_id', views: 1 } }
      ]),
    Update.find(
      { articleId: { $in: ids }, status: 'published' },
      { _id: 0, articleId: 1, version: 1, publishedAt: 1 }
    ).sort({ publishedAt: 1 }).lean(),
    // "Edited" markers on the chart: whenever a version was sent in for review, not just when it was published.
    Update.find(
      { articleId: { $in: ids }, status: 'pending' },
      { _id: 0, articleId: 1, version: 1, status: 1, updatedAt: 1 }
    ).sort({ updatedAt: 1, version: 1 }).lean()
  ]);
  return { statuses, totalViews: hourlyViews.reduce((total, hour) => total + hour.views, 0), hourlyViews, publications, versionChanges };
}

// The article list the statistics page needs (id, title, views), for the articles the user can manage.
function getArticleList(user) {
  return getStatisticsArticles(user);
}

// Read on the view-events model for editors: one article's recorded views, newest first, so a single record can
// be found and corrected.
async function listViews(user, { articleId, skip = 0, limit = 50 } = {}) {
  if (user?.role !== 'editor') throw httpError(403, 'רק עורך יכול לצפות בנתוני צפייה.');
  if (typeof articleId !== 'string' || !articleId) throw httpError(400, 'יש לבחור כתבה.');
  return View.find({ articleId }, { _id: 0, viewId: 1, articleId: 1, idNumber: 1, viewedAt: 1 })
    .sort({ viewedAt: -1, viewId: 1 }).skip(skip).limit(limit).lean();
}

// Update on the view-events model: lets an editor correct when a view happened (for example a clock error or
// imported data). The view moves to its new hour's total, so the charts stay in step.
async function updateView(viewId, user, input) {
  if (user?.role !== 'editor') throw httpError(403, 'רק עורך יכול לעדכן נתוני צפייה.');
  const viewedAt = typeof input?.viewedAt === 'string' ? new Date(input.viewedAt) : null;
  if (!viewedAt || Number.isNaN(viewedAt.getTime()) || viewedAt.getTime() > Date.now() + 60000) {
    throw httpError(400, 'יש להזין מועד צפייה תקין שאינו בעתיד.');
  }
  return transaction(async session => {
    const view = await View.findOne({ viewId }, null, { session }).lean();
    if (!view) throw httpError(404, 'נתון הצפייה לא נמצא.');
    const previous = new Date(view.viewedAt);
    const previousHour = Number.isNaN(previous.getTime()) ? null : hourKey(previous);
    const hour = hourKey(viewedAt);
    await View.updateOne({ viewId }, { $set: { viewedAt: viewedAt.toISOString() } }, { session });
    if (previousHour !== hour) {
      if (previousHour) await addToHour(view.articleId, previousHour, -1, session);
      await addToHour(view.articleId, hour, 1, session);
    }
    return { viewId: view.viewId, articleId: view.articleId, idNumber: view.idNumber, viewedAt: viewedAt.toISOString() };
  });
}

// Delete on the view-events model: lets an editor clear an article's recorded view history (e.g. test/demo data).
async function deleteViews(articleId, user) {
  if (user?.role !== 'editor') throw httpError(403, 'רק עורך יכול לאפס נתוני צפייה.');
  return transaction(async session => {
    const result = await View.deleteMany({ articleId }, { session });
    await removeArticleHours(articleId, session);
    await Article.updateOne({ articleId }, { $set: { viewCount: 0 } }, { session });
    return { deletedCount: result.deletedCount };
  });
}

module.exports = { recordView, getStatistics, getArticleList, listViews, updateView, deleteViews };
