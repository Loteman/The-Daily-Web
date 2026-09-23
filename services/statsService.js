const { database, httpError } = require('./schemaService');
const { getArticles } = require('./articleService');

async function getStatistics(user, articleId) {
  const articles = await getArticles({ user, management: true });
  if (articleId && !articles.some(article => article.id === articleId)) throw httpError(404, 'הכתבה לא נמצאה.');
  const ids = articleId ? [articleId] : articles.map(article => article.id);
  const statuses = { draft: 0, pending: 0, published: 0, returned: 0 };
  articles.forEach(article => { if (article.status in statuses) statuses[article.status]++; });
  const dailyViews = await database().collection('Views').aggregate([
    { $match: { articleId: { $in: ids } } },
    { $set: { date: { $convert: { input: '$viewedAt', to: 'date', onError: null, onNull: null } } } },
    { $match: { date: { $ne: null } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Jerusalem' } }, views: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', views: 1 } }
  ]).toArray();
  const publications = await database().collection('Updates').find(
    { articleId: { $in: ids }, status: 'published' },
    { projection: { _id: 0, articleId: 1, version: 1, publishedAt: 1 } }
  ).sort({ publishedAt: 1 }).toArray();
  return { statuses, totalViews: dailyViews.reduce((total, day) => total + day.views, 0), dailyViews, publications };
}
module.exports = { getStatistics };
