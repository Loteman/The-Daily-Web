const { database, httpError } = require('./schemaService');
const { getManagementStatuses } = require('./articleService');

async function getStatistics(user, articleId) {
  const rows = await getManagementStatuses(user);
  if (articleId && !rows.some(row => row.id === articleId)) throw httpError(404, 'הכתבה לא נמצאה.');
  const ids = articleId ? [articleId] : rows.map(row => row.id);
  const statuses = { draft: 0, pending: 0, published: 0, returned: 0 };
  rows.filter(row => ids.includes(row.id)).forEach(row => { if (row.status in statuses) statuses[row.status]++; });
  const db = database();
  // These three don't depend on each other, only on `ids` above - running them together turns 3
  // sequential round-trips to the database into 1, which is most of what made this endpoint slow.
  const [hourlyViews, publications, versionChanges] = await Promise.all([
    // Grouped by hour (not day) so a single selected day can be broken down hour-by-hour on the client;
    // longer periods sum these back up into daily buckets there.
    db.collection('Views').aggregate([
      { $match: { articleId: { $in: ids } } },
      { $set: { date: { $convert: { input: '$viewedAt', to: 'date', onError: null, onNull: null } } } },
      { $match: { date: { $ne: null } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$date', timezone: 'Asia/Jerusalem' } }, views: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', views: 1 } }
    ]).toArray(),
    db.collection('Updates').find(
      { articleId: { $in: ids }, status: 'published' },
      { projection: { _id: 0, articleId: 1, version: 1, publishedAt: 1 } }
    ).sort({ publishedAt: 1 }).toArray(),
    // "Edited" markers on the chart: whenever a version was sent in for review, not just when it was published.
    db.collection('Updates').find(
      { articleId: { $in: ids }, status: 'pending' },
      { projection: { _id: 0, articleId: 1, version: 1, status: 1, updatedAt: 1 } }
    ).sort({ updatedAt: 1, version: 1 }).toArray()
  ]);
  return { statuses, totalViews: hourlyViews.reduce((total, hour) => total + hour.views, 0), hourlyViews, publications, versionChanges };
}

// Delete on the view-events model: lets an editor clear an article's recorded view history (e.g. test/demo data).
async function deleteViews(articleId, user) {
  if (user?.role !== 'editor') throw httpError(403, 'רק עורך יכול לאפס נתוני צפייה.');
  const result = await database().collection('Views').deleteMany({ articleId });
  return { deletedCount: result.deletedCount };
}

module.exports = { getStatistics, deleteViews };
