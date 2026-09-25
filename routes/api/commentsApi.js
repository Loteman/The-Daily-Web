const router = require('express').Router({ mergeParams: true });
const { randomUUID } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { database, text, httpError } = require('../../services/schemaService');
const { getPublishedArticles } = require('../../services/articleService');

function present(comment) {
  return { id: comment.commentId, name: comment.fullName, text: comment.content, date: comment.createdAt };
}
router.use(async (req, res, next) => {
  if (!(await getPublishedArticles(req.params.id)).length) throw httpError(404, 'הכתבה לא נמצאה.');
  next();
});
router.get('/', async (req, res) => {
  const comments = await database().collection('Commnents').find({ articleId: req.params.id })
    .sort({ createdAt: -1, _id: -1 }).toArray();
  res.json(comments.map(present));
});
router.post('/', rateLimit({
  windowMs: 60000, limit: 3, standardHeaders: true, legacyHeaders: false,
  skip: req => Boolean(req.user),
  handler: (req, res) => res.status(429).json({
    error: 'אורחים יכולים לשלוח עד 3 תגובות בדקה.',
    code: 'GUEST_COMMENT_LIMIT', retryAfterSeconds: Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000))
  })
}), async (req, res) => {
  const content = text(req.body.content, 5000, 'תוכן התגובה', true);
  const fullName = req.user?.fullName || text(req.body.fullName, 100, 'שם מלא', true);
  if (content.length < 3 || fullName.length < 2) throw httpError(400, 'יש למלא שם ותוכן תגובה תקינים.');
  const comment = { commentId: 'com_' + randomUUID(), articleId: req.params.id,
    idNumber: req.user?.idNumber || null, fullName, content, createdAt: new Date().toISOString() };
  await database().collection('Commnents').insertOne(comment);
  res.status(201).json(present(comment));
});
module.exports = router;
