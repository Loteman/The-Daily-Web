const router = require('express').Router();
const { requireAuth } = require('../middlewares/auth');
const { getArticles } = require('../services/articleService');
const { httpError } = require('../services/schemaService');
const { createDraft, saveDraft, startRevision, changeStatus, deleteArticle } = require('../services/managementService');
router.use(requireAuth);
router.get('/', async (req, res) => {
  const { search = '', category = '', status = '', sort } = req.query;
  const limit = req.query.limit === undefined ? undefined : Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  res.json(await getArticles({ user: req.user, management: true, search, category, status, sortBy: sort, skip, limit }));
});
router.get('/:id', async (req, res) => {
  const [article] = await getArticles({ articleId: req.params.id, user: req.user, management: true });
  if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
  res.json(article);
});
router.post('/', async (req, res) => res.status(201).json(await createDraft(req.user, req.body)));
router.put('/:id', async (req, res) => res.json(await saveDraft(req.params.id, req.user, req.body)));
router.post('/:id/revisions', async (req, res) => res.status(201).json(await startRevision(req.params.id, req.user, req.body)));
router.patch('/:id/status', async (req, res) => res.json(await changeStatus(req.params.id, req.user, req.body)));
router.delete('/:id', async (req, res) => { await deleteArticle(req.params.id, req.user); res.status(204).end(); });
module.exports = router;
