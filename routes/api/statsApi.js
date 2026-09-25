const router = require('express').Router();
const { requireAuth } = require('../../middlewares/auth');
const { getStatistics, deleteViews } = require('../../services/statsService');
router.use(requireAuth);
router.get('/', async (req, res) => {
  const articleId = typeof req.query.articleId === 'string' ? req.query.articleId : undefined;
  res.json(await getStatistics(req.user, articleId));
});
router.delete('/:articleId', async (req, res) => {
  res.json(await deleteViews(req.params.articleId, req.user));
});
module.exports = router;
