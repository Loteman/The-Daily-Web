const { randomUUID } = require('node:crypto');
const { Comment } = require('../models');
const { text, httpError } = require('./schemaService');

function listComments(articleId) {
  return Comment.find({ articleId }).sort({ createdAt: -1, _id: -1 }).lean();
}
function findComment(articleId, commentId) {
  return Comment.findOne({ commentId, articleId }).lean();
}
// Signed-in users comment under their own name; guests must give one.
async function addComment(articleId, user, input) {
  const content = text(input.content, 5000, 'תוכן התגובה', true);
  const fullName = user?.fullName || text(input.fullName, 100, 'שם מלא', true);
  if (content.length < 3 || fullName.length < 2) throw httpError(400, 'יש למלא שם ותוכן תגובה תקינים.');
  const comment = { commentId: 'com_' + randomUUID(), articleId,
    idNumber: user?.idNumber || null, fullName, content, createdAt: new Date().toISOString() };
  await Comment.create(comment);
  return comment;
}
async function editComment(comment, input) {
  const content = text(input.content, 5000, 'תוכן התגובה', true);
  if (content.length < 3) throw httpError(400, 'תוכן התגובה קצר מדי.');
  const editedAt = new Date().toISOString();
  await Comment.updateOne({ commentId: comment.commentId }, { $set: { content, editedAt } });
  return { ...comment, content, editedAt };
}
async function deleteComment(comment) {
  await Comment.deleteOne({ commentId: comment.commentId });
}

module.exports = { listComments, findComment, addComment, editComment, deleteComment };
