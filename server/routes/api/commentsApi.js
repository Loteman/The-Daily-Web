const router = require('express').Router({ mergeParams: true });
const { rateLimit } = require('express-rate-limit');
const { httpError } = require('../../services/schemaService');
const { isPublished } = require('../../services/articleService');
const { listComments, findComment, addComment, editComment, deleteComment } = require('../../services/commentService');

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
  if (!(await isPublished(req.params.id))) throw httpError(404, 'הכתבה לא נמצאה.');
  next();
});
router.get('/', async (req, res) => {
  const comments = await listComments(req.params.id);
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
  const comment = await addComment(req.params.id, req.user, req.body);
  if (!req.user) {
    req.session.guestCommentIds = [...(req.session.guestCommentIds || []), comment.commentId].slice(-200);
  }
  res.status(201).json(present(comment, true));
});
router.put('/:commentId', async (req, res) => {
  const comment = await findComment(req.params.id, req.params.commentId);
  if (!comment) throw httpError(404, 'התגובה לא נמצאה.');
  if (!isOwner(comment, req)) throw httpError(403, 'ניתן לערוך רק את התגובה שלך.');
  res.json(present(await editComment(comment, req.body), true));
});
router.delete('/:commentId', async (req, res) => {
  const comment = await findComment(req.params.id, req.params.commentId);
  if (!comment) throw httpError(404, 'התגובה לא נמצאה.');
  if (!isOwner(comment, req)) throw httpError(403, 'ניתן למחוק רק את התגובה שלך.');
  await deleteComment(comment);
  res.status(204).end();
});
module.exports = router;
