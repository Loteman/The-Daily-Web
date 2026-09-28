const router = require('express').Router();
const { requireAuth } = require('../../middlewares/auth');
const { getStatistics, getArticleList, listViews, updateView, deleteViews } = require('../../services/statsService');
router.use(requireAuth);
router.get('/', async (req, res) => {
  const articleId = typeof req.query.articleId === 'string' ? req.query.articleId : undefined;
  res.json(await getStatistics(req.user, articleId));
});
router.get('/articles', async (req, res) => {
  res.json(await getArticleList(req.user));
});
router.get('/views', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  res.json(await listViews(req.user, { articleId: req.query.articleId, skip, limit }));
});
router.patch('/views/:viewId', async (req, res) => {
  res.json(await updateView(req.params.viewId, req.user, req.body));
});
router.delete('/:articleId', async (req, res) => {
  res.json(await deleteViews(req.params.articleId, req.user));
});
module.exports = router;
