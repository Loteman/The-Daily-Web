const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const { getPublishedArticles, getArticles, getRelatedArticles } = require('../../services/articleService');
const { database, httpError } = require('../../services/schemaService');

router.get('/', async (req, res) => {
  const { search = '', category = '', status = '', sort } = req.query;
  const readArticleIds = req.session.readArticleIds || [];
  // limit is opt-in: pass it to get { articles, hasMore } paging, omit it for the full list (tests, etc.).
  const limit = req.query.limit === undefined ? undefined : Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  res.json(await getArticles({ user: req.user, readArticleIds, search, category, status, sortBy: sort, skip, limit }));
});
router.get('/:id/related', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 10);
  res.json(await getRelatedArticles(req.params.id, req.query.category || '', limit));
});
router.use('/:id/comments', require('./commentsApi'));
router.post('/:id/views', async (req, res) => {
  const [article] = await getPublishedArticles(req.params.id);
  if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
  // Count a single visit per article per session; read status remains in Views for users.
  const read = req.session.readArticleIds || [];
  if (!read.includes(req.params.id)) {
    await database().collection('Views').insertOne({
      viewId: 'view_' + randomUUID(), articleId: req.params.id,
      idNumber: req.user?.idNumber || null, viewedAt: new Date().toISOString()
    });
    req.session.readArticleIds = [...read, req.params.id].slice(-1000);
  }
  res.json({ isRead: true });
});
router.get('/:id', async (req, res) => {
  const [article] = await getPublishedArticles(req.params.id, req.user, req.session.readArticleIds || []);
  if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
  res.json(article);
});
module.exports = router;
