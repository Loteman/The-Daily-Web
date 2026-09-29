const router = require('express').Router();
const { getPublishedArticles, getArticles, getRelatedArticles } = require('../../services/articleService');
const { recordView } = require('../../services/statsService');
const { httpError } = require('../../services/schemaService');

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
  // Every visit counts toward views and statistics. The session keeps which articles a guest has read, for the
  // read/unread filter; signed-in readers' read status comes from their Views.
  await recordView(req.params.id, req.user);
  const read = req.session.readArticleIds || [];
  if (!read.includes(req.params.id)) req.session.readArticleIds = [...read, req.params.id].slice(-1000);
  res.json({ isRead: true });
});
router.get('/:id', async (req, res) => {
  const [article] = await getPublishedArticles(req.params.id, req.user, req.session.readArticleIds || []);
  if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
  res.json(article);
});
module.exports = router;
