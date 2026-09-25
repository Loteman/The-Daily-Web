const router = require('express').Router({ mergeParams: true });
const { randomUUID } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { database, text, httpError } = require('../../services/schemaService');
const { getPublishedArticles } = require('../../services/articleService');

function present(comment, mine) {
  return { id: comment.commentId, name: comment.fullName, text: comment.content, date: comment.createdAt,
    edited: Boolean(comment.editedAt), mine };
}
// Logged-in users own comments posted under their idNumber. Guests have no login, so ownership of their
// own (idNumber: null) comments is tracked per browser session instead - never trust a client-supplied flag.
function isOwner(comment, req) {
  if (comment.idNumber !== null) return req.user?.idNumber === comment.idNumber;
  return (req.session.guestCommentIds || []).includes(comment.commentId);
}
router.use(async (req, res, next) => {
  if (!(await getPublishedArticles(req.params.id)).length) throw httpError(404, 'הכתבה לא נמצאה.');
  next();
});
router.get('/', async (req, res) => {
  const comments = await database().collection('Commnents').find({ articleId: req.params.id })
    .sort({ createdAt: -1, _id: -1 }).toArray();
  res.json(comments.map(comment => present(comment, isOwner(comment, req))));
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
  if (!req.user) {
    req.session.guestCommentIds = [...(req.session.guestCommentIds || []), comment.commentId].slice(-200);
  }
  res.status(201).json(present(comment, true));
});
router.put('/:commentId', async (req, res) => {
  const comment = await database().collection('Commnents').findOne({ commentId: req.params.commentId, articleId: req.params.id });
  if (!comment) throw httpError(404, 'התגובה לא נמצאה.');
  if (!isOwner(comment, req)) throw httpError(403, 'ניתן לערוך רק את התגובה שלך.');
  const content = text(req.body.content, 5000, 'תוכן התגובה', true);
  if (content.length < 3) throw httpError(400, 'תוכן התגובה קצר מדי.');
  await database().collection('Commnents').updateOne({ commentId: req.params.commentId },
    { $set: { content, editedAt: new Date().toISOString() } });
  res.json(present({ ...comment, content, editedAt: new Date().toISOString() }, true));
});
router.delete('/:commentId', async (req, res) => {
  const comment = await database().collection('Commnents').findOne({ commentId: req.params.commentId, articleId: req.params.id });
  if (!comment) throw httpError(404, 'התגובה לא נמצאה.');
  if (!isOwner(comment, req)) throw httpError(403, 'ניתן למחוק רק את התגובה שלך.');
  await database().collection('Commnents').deleteOne({ commentId: req.params.commentId });
  res.status(204).end();
});
module.exports = router;
