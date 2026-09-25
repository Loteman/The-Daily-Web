const { database, httpError } = require('./schemaService');
const { getArticles } = require('./articleService');

async function getStatistics(user, articleId) {
  const articles = await getArticles({ user, management: true });
  if (articleId && !articles.some(article => article.id === articleId)) throw httpError(404, 'הכתבה לא נמצאה.');
  const ids = articleId ? [articleId] : articles.map(article => article.id);
  const statuses = { draft: 0, pending: 0, published: 0, returned: 0 };
  articles.filter(article => ids.includes(article.id)).forEach(article => { if (article.status in statuses) statuses[article.status]++; });
  // Grouped by hour (not day) so a single selected day can be broken down hour-by-hour on the client;
  // longer periods sum these back up into daily buckets there.
  const hourlyViews = await database().collection('Views').aggregate([
    { $match: { articleId: { $in: ids } } },
    { $set: { date: { $convert: { input: '$viewedAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { date: { $ne: null } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$date', timezone: 'Asia/Jerusalem' } }, views: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, hour: '$_id', views: 1 } }
  ]).toArray();
  const publications = await database().collection('Updates').find(
    { articleId: { $in: ids }, status: 'published' },
    { projection: { _id: 0, articleId: 1, version: 1, publishedAt: 1 } }
  ).sort({ publishedAt: 1 }).toArray();
  // "Edited" markers on the chart: whenever a version was sent in for review, not just when it was published.
  const versionChanges = await database().collection('Updates').find(
    { articleId: { $in: ids }, status: 'pending' },
    { projection: { _id: 0, articleId: 1, version: 1, status: 1, updatedAt: 1 } }
  ).sort({ updatedAt: 1, version: 1 }).toArray();
  return { statuses, totalViews: hourlyViews.reduce((total, hour) => total + hour.views, 0), hourlyViews, publications, versionChanges };
}
module.exports = { getStatistics };
