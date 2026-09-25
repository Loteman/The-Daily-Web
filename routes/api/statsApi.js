const router = require('express').Router();
const { requireAuth } = require('../../middlewares/auth');
const { getStatistics } = require('../../services/statsService');
router.use(requireAuth);
router.get('/', async (req, res) => {
  const articleId = typeof req.query.articleId === 'string' ? req.query.articleId : undefined;
  res.json(await getStatistics(req.user, articleId));
});
module.exports = router;
