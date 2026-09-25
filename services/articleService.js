const { database, getCategories } = require('./schemaService');

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function getArticles({
  articleId, user = null, management = false, readArticleIds = [],
  search = '', category = '', status = '', sortBy, skip = 0, limit
} = {}) {
  const db = database();
  const categories = await getCategories(db);
  const categoryId = category ? categories.find(item => item.name === category)?.id : undefined;
  const match = {
    ...(articleId === undefined ? {} : { articleId }),
    ...(management && user?.role === 'reporter' ? { reporterIdNumber: user.idNumber } : {})
  };
  const isListing = articleId === undefined;
  // Views are only needed before pagination when a query actually filters/sorts by them; otherwise
  // (the common case - default feed and management views) they're fetched afterwards for just the
  // page being returned, instead of joining every matching article to compute a page of 8-50 rows.
  const needsViewsUpfront = sortBy === 'popularity' || (!management && isListing && (status === 'read' || status === 'unread'));
  // Users (author name) is never used for filtering/sorting, so listings always defer it; single-
  // article lookups keep it inline since there's only one document, so there's no fan-out to save.
  const deferLookups = isListing;
  const usersLookupStage = { $lookup: {
    from: 'Users', let: { reporter: '$reporterIdNumber' },
    pipeline: [
      { $match: { $expr: { $eq: ['$idNumber', '$$reporter'] } } },
      { $project: { _id: 0, username: 1, fullName: 1 } }
    ], as: 'reporter'
  } };
  const viewsLookupStage = { $lookup: {
    from: 'Views', let: { id: '$articleId' },
    pipeline: [
      { $match: { $expr: { $eq: ['$articleId', '$$id'] } } },
      { $group: { _id: null, total: { $sum: 1 },
        read: { $max: user ? { $cond: [{ $eq: ['$idNumber', { $literal: user.idNumber }] }, 1, 0] } : 0 }
      } }
    ], as: 'viewCount'
  } };
  const pipeline = [
    { $match: match },
    { $lookup: {
      from: 'Updates', let: { id: '$articleId' },
      pipeline: [
        { $match: { ...(management ? {} : { status: 'published' }), $expr: { $eq: ['$articleId', '$$id'] } } },
        { $sort: { version: -1, updatedAt: -1, _id: -1 } }, { $limit: 1 }
      ], as: 'currentUpdate'
    } },
    { $unwind: '$currentUpdate' }
  ];
  if (!deferLookups) pipeline.push(usersLookupStage);
  if (!deferLookups || needsViewsUpfront) pipeline.push(viewsLookupStage);
  // Single-article / "my management list" lookups skip search, filters, sort and paging entirely -
  // only the listing endpoints (public feed, management table) ever pass those in.
  if (isListing) {
    if (categoryId !== undefined) {
      pipeline.push({ $match: { $expr: { $eq: [
        { $toString: { $ifNull: ['$currentUpdate.categoryId', '$categoryId'] } }, String(categoryId)
      ] } } });
    }
    if (search.trim()) {
      const regex = { $regex: escapeRegex(search.trim()), $options: 'i' };
      pipeline.push({ $match: { $or: [{ 'currentUpdate.title': regex }, { 'currentUpdate.summary': regex }] } });
    }
    if (!management && (status === 'read' || status === 'unread')) {
      pipeline.push({ $addFields: { isReadComputed: {
        $cond: [{ $literal: Boolean(user) },
          { $eq: [{ $ifNull: [{ $arrayElemAt: ['$viewCount.read', 0] }, 0] }, 1] },
          { $in: ['$articleId', readArticleIds] }]
      } } });
      pipeline.push({ $match: { isReadComputed: status === 'read' } });
    }
    if (management && ['draft', 'pending', 'published', 'returned'].includes(status)) {
      pipeline.push({ $match: { 'currentUpdate.status': status } });
    }
    if (sortBy === 'popularity') {
      pipeline.push({ $addFields: { viewsTotal: { $ifNull: [{ $arrayElemAt: ['$viewCount.total', 0] }, 0] } } });
      pipeline.push({ $sort: { viewsTotal: -1, articleId: 1 } });
    } else {
      pipeline.push({ $sort: { 'currentUpdate.updatedAt': -1, articleId: 1 } });
    }
    // $facet returns the requested page and an exact total count in a single pass, so the UI can show
    // real page numbers instead of just "is there more" - cheap, since it reuses the already-filtered set.
    if (limit !== undefined) pipeline.push({ $facet: { data: [{ $skip: skip }, { $limit: limit }], totalCount: [{ $count: 'count' }] } });
  } else {
    pipeline.push({ $sort: { 'currentUpdate.updatedAt': -1, articleId: 1 } });
  }
  const rows = await db.collection('Articles').aggregate(pipeline).toArray();
  const facet = limit !== undefined ? (rows[0] || { data: [], totalCount: [] }) : null;
  const total = facet ? facet.totalCount[0]?.count || 0 : undefined;
  const sliced = facet ? facet.data : rows;

  let userMap = new Map(), viewMap = null;
  if (deferLookups && sliced.length) {
    const reporterIds = [...new Set(sliced.map(article => article.reporterIdNumber))];
    const promises = [
      db.collection('Users').find(
        { idNumber: { $in: reporterIds } }, { projection: { _id: 0, idNumber: 1, username: 1, fullName: 1 } }
      ).toArray()
    ];
    if (!needsViewsUpfront) {
      const articleIds = sliced.map(article => article.articleId);
      promises.push(db.collection('Views').aggregate([
        { $match: { articleId: { $in: articleIds } } },
        { $group: { _id: '$articleId', total: { $sum: 1 },
          read: { $max: user ? { $cond: [{ $eq: ['$idNumber', { $literal: user.idNumber }] }, 1, 0] } : 0 }
        } }
      ]).toArray());
    }
    const [users, viewRows] = await Promise.all(promises);
    userMap = new Map(users.map(row => [row.idNumber, row]));
    if (viewRows) viewMap = new Map(viewRows.map(row => [row._id, row]));
  }

  const categoryMap = new Map(categories.map(item => [String(item.id), item.name]));
  const mapped = sliced.map(article => {
    const update = article.currentUpdate;
    const reporter = deferLookups ? (userMap.get(article.reporterIdNumber) || {}) : (article.reporter[0] || {});
    const viewEntry = viewMap ? viewMap.get(article.articleId) : article.viewCount[0];
    const content = String(update.content || '');
    const date = management ? update.updatedAt : update.publishedAt || update.updatedAt;
    const result = {
      id: article.articleId,
      title: update.title ?? article.title ?? '',
      summary: update.summary ?? content.slice(0, 200),
      paragraphs: content.split(/\r?\n\s*\r?\n/).filter(Boolean),
      category: categoryMap.get(String(update.categoryId ?? article.categoryId)) || '',
      categoryId: update.categoryId ?? article.categoryId,
      author: reporter.fullName || reporter.username || '',
      date: date || article.createdAt,
      mainImage: update.mainImage ?? article.mainImage ?? '',
      views: viewEntry?.total || 0,
      isRead: Boolean(viewEntry?.read || (!user && readArticleIds.includes(article.articleId))),
      status: update.status, version: update.version, updateId: update.updateId
    };
    if (management) Object.assign(result, {
      creator: reporter.username || '', editorNote: update.editorNote || '', updatedAt: update.updatedAt,
      time: new Date(update.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    });
    return result;
  });
  return limit !== undefined ? { articles: mapped, hasMore: skip + mapped.length < total, total } : mapped;
}
function getPublishedArticles(articleId, user, readArticleIds) {
  return getArticles({ articleId, user, readArticleIds });
}

// Lightweight lookup for the article page's "related posts" widget: only the few fields it renders,
// no Users/Views lookups and no article content, so it stays cheap however many articles exist.
async function getRelatedArticles(excludeId, categoryName, limit = 3) {
  const db = database();
  const categories = await getCategories(db);
  const categoryId = categories.find(item => item.name === categoryName)?.id;
  if (categoryId === undefined) return [];
  const rows = await db.collection('Articles').aggregate([
    { $match: { articleId: { $ne: excludeId } } },
    { $lookup: {
      from: 'Updates', let: { id: '$articleId' },
      pipeline: [
        { $match: { status: 'published', $expr: { $eq: ['$articleId', '$$id'] } } },
        { $sort: { version: -1, updatedAt: -1, _id: -1 } }, { $limit: 1 }
      ], as: 'currentUpdate'
    } },
    { $unwind: '$currentUpdate' },
    { $match: { $expr: { $eq: [
      { $toString: { $ifNull: ['$currentUpdate.categoryId', '$categoryId'] } }, String(categoryId)
    ] } } },
    { $sort: { 'currentUpdate.publishedAt': -1, 'currentUpdate.updatedAt': -1 } },
    { $limit: limit },
    { $project: { _id: 0, id: '$articleId', title: '$currentUpdate.title',
      date: { $ifNull: ['$currentUpdate.publishedAt', '$currentUpdate.updatedAt'] } } }
  ]).toArray();
  return rows.map(row => ({ ...row, category: categoryName }));
}

// Lightweight lookup for the statistics screen: only the id + current status of every article the
// user can manage, no Users/Views lookups and no content - the full getArticles({management:true})
// pipeline was overkill just to count statuses and know which article ids to aggregate views for.
// A $lookup-per-article (like getArticles uses) re-runs a sub-query for each of the user's articles
// one at a time, which doesn't scale; grouping directly on Updates does it in a single indexed pass.
async function getManagementStatuses(user) {
  const db = database();
  let match = {};
  if (user?.role === 'reporter') {
    const owned = await db.collection('Articles').find(
      { reporterIdNumber: user.idNumber }, { projection: { _id: 0, articleId: 1 } }
    ).toArray();
    match = { articleId: { $in: owned.map(row => row.articleId) } };
  }
  return db.collection('Updates').aggregate([
    { $match: match },
    { $sort: { articleId: 1, version: -1, updatedAt: -1, _id: -1 } },
    { $group: { _id: '$articleId', status: { $first: '$status' } } },
    { $project: { _id: 0, id: '$_id', status: 1 } }
  ]).toArray();
}

module.exports = { getArticles, getPublishedArticles, getRelatedArticles, getManagementStatuses };
