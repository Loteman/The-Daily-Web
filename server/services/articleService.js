const { Article, Update, User, View } = require('../models');
const { getCategories } = require('./schemaService');

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// Category ids are numbers in some documents and strings in others; match either form.
function sameCategory(id) {
  return { $in: [...new Set([id, String(id), ...(Number.isFinite(Number(id)) ? [Number(id)] : [])])] };
}

// Readers see each article's stored published version (Articles.published); management sees the latest version
// of any status (Articles.current). Both are kept in step with Updates by the services that write versions, so a
// listing is one indexed query on Articles plus one lookup each for the page's content, authors and read status.
async function getArticles({
  articleId, user = null, management = false, readArticleIds = [],
  search = '', category = '', status = '', sortBy, skip = 0, limit
} = {}) {
  const categories = await getCategories();
  const version = management ? 'current' : 'published';
  const filter = {
    [version]: { $ne: null },
    ...(articleId === undefined ? {} : { articleId }),
    ...(management && user?.role === 'reporter' ? { reporterIdNumber: user.idNumber } : {})
  };
  // Single-article / "my management list" lookups skip search, filters, sort and paging entirely -
  // only the listing endpoints (public feed, management table) ever pass those in.
  if (articleId === undefined) {
    const categoryId = category ? categories.find(item => item.name === category)?.id : undefined;
    if (categoryId !== undefined) filter[version + '.categoryId'] = sameCategory(categoryId);
    if (search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ [version + '.title']: regex }, { [version + '.summary']: regex }];
    }
    if (!management && (status === 'read' || status === 'unread')) {
      // Signed-in readers' history is in Views; guests' is the list of article ids kept in their session.
      const readIds = user ? await View.distinct('articleId', { idNumber: user.idNumber }) : readArticleIds;
      filter.articleId = { [status === 'read' ? '$in' : '$nin']: readIds };
    }
    if (management && ['draft', 'pending', 'published', 'returned'].includes(status)) {
      filter['current.status'] = status;
    }
  }
  const sort = sortBy === 'popularity' ? { viewCount: -1, articleId: 1 } : { [version + '.sortDate']: -1, articleId: 1 };
  const query = Article.find(filter, { _id: 0, articleId: 1, reporterIdNumber: 1, viewCount: 1, [version]: 1 }).sort(sort).lean();
  if (limit !== undefined) query.skip(skip).limit(limit);
  // The page and an exact total count, so the UI can show real page numbers instead of just "is there more".
  const [rows, total] = await Promise.all([query, limit !== undefined ? Article.countDocuments(filter) : undefined]);

  const pageIds = rows.map(row => row.articleId);
  const [contents, users, readRows] = rows.length ? await Promise.all([
    Update.find({ _id: { $in: rows.map(row => row[version].versionId) } }, { content: 1 }).lean(),
    User.find({ idNumber: { $in: [...new Set(rows.map(row => row.reporterIdNumber))] } },
      { _id: 0, idNumber: 1, username: 1, fullName: 1 }).lean(),
    user ? View.distinct('articleId', { idNumber: user.idNumber, articleId: { $in: pageIds } }) : []
  ]) : [[], [], []];
  const contentMap = new Map(contents.map(row => [String(row._id), row.content]));
  const userMap = new Map(users.map(row => [row.idNumber, row]));
  const readSet = new Set(readRows);

  const categoryMap = new Map(categories.map(item => [String(item.id), item.name]));
  const mapped = rows.map(article => {
    const update = article[version];
    const reporter = userMap.get(article.reporterIdNumber) || {};
    const content = String(contentMap.get(String(update.versionId)) || '');
    const result = {
      id: article.articleId,
      title: update.title,
      summary: update.summary,
      paragraphs: content.split(/\r?\n\s*\r?\n/).filter(Boolean),
      category: categoryMap.get(String(update.categoryId)) || '',
      categoryId: update.categoryId,
      author: reporter.fullName || reporter.username || '',
      date: update.date,
      mainImage: update.mainImage,
      views: article.viewCount || 0,
      isRead: user ? readSet.has(article.articleId) : readArticleIds.includes(article.articleId),
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
async function isPublished(articleId) {
  return Boolean(await Article.exists({ articleId, published: { $ne: null } }));
}

// Lightweight lookup for the article page's "related posts" widget: only the few fields it renders,
// no Users/Views lookups and no article content, so it stays cheap however many articles exist.
async function getRelatedArticles(excludeId, categoryName, limit = 3) {
  const categories = await getCategories();
  const categoryId = categories.find(item => item.name === categoryName)?.id;
  if (categoryId === undefined) return [];
  const rows = await Article.find(
    { articleId: { $ne: excludeId }, published: { $ne: null }, 'published.categoryId': sameCategory(categoryId) },
    { _id: 0, articleId: 1, 'published.title': 1, 'published.publishedAt': 1, 'published.updatedAt': 1, 'published.mainImage': 1 }
  ).sort({ 'published.sortDate': -1, articleId: 1 }).limit(limit).lean();
  return rows.map(row => ({ id: row.articleId, title: row.published.title,
    date: row.published.publishedAt ?? row.published.updatedAt, category: categoryName, mainImage: row.published.mainImage }));
}

// The id and current status of every article the user can manage (reporters: their own; editors: all), for the
// statistics screen. Read from the stored current version, so it is one indexed query.
async function getManagementStatuses(user) {
  const rows = await Article.find(
    { current: { $ne: null }, ...(user?.role === 'reporter' ? { reporterIdNumber: user.idNumber } : {}) },
    { _id: 0, articleId: 1, 'current.status': 1 }
  ).lean();
  return rows.map(row => ({ id: row.articleId, status: row.current.status }));
}

// The statistics page's article list: only the id, current title and view count it shows, newest change first
// (the management list's order), instead of the whole management listing with every article's content.
async function getStatisticsArticles(user) {
  const rows = await Article.find(
    { current: { $ne: null }, ...(user?.role === 'reporter' ? { reporterIdNumber: user.idNumber } : {}) },
    { _id: 0, articleId: 1, 'current.title': 1, viewCount: 1 }
  ).sort({ 'current.sortDate': -1, articleId: 1 }).lean();
  return rows.map(row => ({ id: row.articleId, title: row.current.title, views: row.viewCount || 0 }));
}

module.exports = { getArticles, getPublishedArticles, isPublished, getRelatedArticles, getManagementStatuses, getStatisticsArticles };
