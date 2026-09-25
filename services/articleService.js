const { database, getCategories } = require('./schemaService');

async function getArticles({ articleId, user = null, management = false, readArticleIds = [] } = {}) {
  const db = database();
  const match = {
    ...(articleId === undefined ? {} : { articleId }),
    ...(management && user?.role === 'reporter' ? { reporterIdNumber: user.idNumber } : {})
  };
  const rows = await db.collection('Articles').aggregate([
    { $match: match },
    { $lookup: {
      from: 'Updates', let: { id: '$articleId' },
      pipeline: [
        { $match: { ...(management ? {} : { status: 'published' }), $expr: { $eq: ['$articleId', '$$id'] } } },
        { $sort: { version: -1, updatedAt: -1, _id: -1 } }, { $limit: 1 }
      ], as: 'currentUpdate'
    } },
    { $unwind: '$currentUpdate' },
    { $lookup: {
      from: 'Users', let: { reporter: '$reporterIdNumber' },
      pipeline: [
        { $match: { $expr: { $eq: ['$idNumber', '$$reporter'] } } },
        { $project: { _id: 0, username: 1, fullName: 1 } }
      ], as: 'reporter'
    } },
    { $lookup: {
      from: 'Views', let: { id: '$articleId' },
      pipeline: [
        { $match: { $expr: { $eq: ['$articleId', '$$id'] } } },
        { $group: { _id: null, total: { $sum: 1 },
          read: { $max: user ? { $cond: [{ $eq: ['$idNumber', { $literal: user.idNumber }] }, 1, 0] } : 0 }
        } }
      ], as: 'viewCount'
    } },
    { $sort: { 'currentUpdate.updatedAt': -1, articleId: 1 } }
  ]).toArray();
  const categories = new Map((await getCategories()).map(category => [String(category.id), category.name]));
  return rows.map(article => {
    const update = article.currentUpdate;
    const reporter = article.reporter[0] || {};
    const content = String(update.content || '');
    const date = management ? update.updatedAt : update.publishedAt || update.updatedAt;
    const result = {
      id: article.articleId,
      title: update.title ?? article.title ?? '',
      summary: update.summary ?? content.slice(0, 200),
      paragraphs: content.split(/\r?\n\s*\r?\n/).filter(Boolean),
      category: categories.get(String(update.categoryId ?? article.categoryId)) || '',
      categoryId: update.categoryId ?? article.categoryId,
      author: reporter.fullName || reporter.username || '',
      date: date || article.createdAt,
      mainImage: update.mainImage ?? article.mainImage ?? '',
      views: article.viewCount[0]?.total || 0,
      isRead: Boolean(article.viewCount[0]?.read || (!user && readArticleIds.includes(article.articleId))),
      status: update.status, version: update.version, updateId: update.updateId
    };
    if (management) Object.assign(result, {
      creator: reporter.username || '', editorNote: update.editorNote || '', updatedAt: update.updatedAt,
      time: new Date(update.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    });
    return result;
  });
}
function getPublishedArticles(articleId, user, readArticleIds) {
  return getArticles({ articleId, user, readArticleIds });
}
module.exports = { getArticles, getPublishedArticles };
