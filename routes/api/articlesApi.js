const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const { getPublishedArticles } = require('../../services/articleService');
const { database, httpError } = require('../../services/schemaService');

router.get('/', async (req, res) => {
  res.json(await getPublishedArticles(undefined, req.user, req.session.readArticleIds || []));
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
