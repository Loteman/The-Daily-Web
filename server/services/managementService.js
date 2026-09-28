const { randomUUID } = require('node:crypto');
const { Article, Update, Comment, View } = require('../models');
const { getCategories, text, httpError, transaction } = require('./schemaService');
const { getArticles } = require('./articleService');
const { refreshArticle, removeArticleHours } = require('./derivedDataService');
const { logEvent } = require('../utils/logger');

function requireReporter(user) {
  if (user?.role !== 'reporter') throw httpError(403, 'רק כתב יכול לערוך כתבות.');
}
function requireStaff(user) {
  if (!['reporter', 'editor'].includes(user?.role)) throw httpError(403, 'אין לך הרשאה לפעולה זו.');
}
async function draftFields(input) {
  const title = text(input.title, 200, 'כותרת');
  const summary = text(input.summary, 2000, 'תקציר');
  const content = text(input.content, 100000, 'תוכן');
  const mainImage = text(input.mainImage || '', 2000, 'תמונה');
  if (mainImage && !/^https?:\/\//i.test(mainImage)) throw httpError(400, 'יש להזין כתובת תמונה שמתחילה ב-http או https.');
  const category = (await getCategories()).find(item => String(item.id) === String(input.categoryId));
  if (!category) throw httpError(400, 'יש לבחור קטגוריה מתוך מסד הנתונים.');
  return { title, summary, content, mainImage, categoryId: category.id };
}
async function latest(articleId, session) {
  return Update.findOne({ articleId }, null, { session }).sort({ version: -1, updatedAt: -1, _id: -1 }).lean();
}
async function ownedArticle(articleId, user, session) {
  const article = await Article.findOne({ articleId }, null, { session }).lean();
  if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
  if (user.role === 'reporter' && article.reporterIdNumber !== user.idNumber) throw httpError(403, 'אין לך הרשאה לכתבה זו.');
  return article;
}
function checkRevision(update, input) {
  if (!update || input.updateId !== update.updateId || input.updatedAt !== update.updatedAt) {
    throw httpError(409, 'הכתבה השתנתה. יש לרענן לפני שמירה.');
  }
}
async function createDraft(user, input) {
  requireReporter(user);
  const fields = await draftFields(input);
  const articleId = 'art_' + randomUUID();
  const now = new Date().toISOString();
  await transaction(async session => {
    await Article.create([{
      articleId, title: fields.title, reporterIdNumber: user.idNumber,
      categoryId: fields.categoryId, mainImage: fields.mainImage, createdAt: now
    }], { session });
    await Update.create([{
      updateId: 'upd_' + randomUUID(), articleId, version: 1, ...fields,
      status: 'draft', editorNote: '', updatedAt: now, publishedAt: null
    }], { session });
    await refreshArticle(articleId, session);
  });
  logEvent('article_created', { articleId, idNumber: user.idNumber });
  return (await getArticles({ articleId, user, management: true }))[0];
}
async function saveDraft(articleId, user, input) {
  const fields = await draftFields(input);
  await transaction(async session => {
    await ownedArticle(articleId, user, session);
    const update = await latest(articleId, session);
    checkRevision(update, input);
    // Reporter edits their own draft/returned version; an editor can edit any version that isn't published yet.
    // Saving never changes the status: a returned version stays returned until it is sent for approval again,
    // and a pending one stays pending (moving it back would undo the submit-for-review step).
    const reporterEdit = user.role === 'reporter' && ['draft', 'returned'].includes(update.status);
    const editorEdit = user.role === 'editor' && ['draft', 'pending', 'returned'].includes(update.status);
    if (!reporterEdit && !editorEdit) throw httpError(409, 'יש לפתוח טיוטה חדשה כדי לערוך גרסה שפורסמה.');
    await Update.updateOne({ _id: update._id }, {
      $set: { ...fields,
        updatedAt: new Date(Math.max(Date.now(), new Date(update.updatedAt).getTime() + 1)).toISOString() }
    }, { session });
    await refreshArticle(articleId, session);
  });
  return (await getArticles({ articleId, user, management: true }))[0];
}
async function deleteArticle(articleId, user) {
  if (user?.role !== 'editor') throw httpError(403, 'רק עורך יכול למחוק כתבה.');
  await transaction(async session => {
    const article = await Article.findOne({ articleId }, null, { session }).lean();
    if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
    await Update.deleteMany({ articleId }, { session });
    await Comment.deleteMany({ articleId }, { session });
    await View.deleteMany({ articleId }, { session });
    await removeArticleHours(articleId, session);
    await Article.deleteOne({ articleId }, { session });
  });
  logEvent('article_deleted', { articleId, idNumber: user.idNumber });
}
// A reporter's new version starts as a draft they send for approval. An editor's starts as pending, which the
// editor may edit and then publish or return, so no status change outside the allowed ones is needed.
async function startRevision(articleId, user, input) {
  requireStaff(user);
  await transaction(async session => {
    const article = await ownedArticle(articleId, user, session);
    const update = await latest(articleId, session);
    checkRevision(update, input);
    if (update.status !== 'published') throw httpError(409, 'כבר קיימת גרסה לעריכה.');
    await Update.create([{
      // The unique _id prevents two simultaneous requests creating the same version.
      _id: articleId + ':v' + (update.version + 1),
      updateId: 'upd_' + randomUUID(), articleId, version: update.version + 1,
      title: update.title ?? article.title, categoryId: update.categoryId ?? article.categoryId,
      mainImage: update.mainImage ?? article.mainImage ?? '', summary: update.summary || '',
      content: update.content || '', status: user.role === 'editor' ? 'pending' : 'draft', editorNote: '',
      updatedAt: new Date().toISOString(), publishedAt: null
    }], { session });
    await refreshArticle(articleId, session);
  });
  return (await getArticles({ articleId, user, management: true }))[0];
}
async function changeStatus(articleId, user, input) {
  const status = input.status;
  const editorNote = text(input.editorNote || '', 2000, 'הערת עורך');
  await transaction(async session => {
    await ownedArticle(articleId, user, session);
    const update = await latest(articleId, session);
    checkRevision(update, input);
    const submit = user.role === 'reporter' && ['draft', 'returned'].includes(update.status) && status === 'pending';
    const review = user.role === 'editor' && update.status === 'pending' && ['published', 'returned'].includes(status);
    if (!submit && !review) throw httpError(403, 'אין הרשאה לשינוי הסטטוס הזה.');
    const article = await ownedArticle(articleId, user, session);
    if (['pending', 'published'].includes(status)) {
      if (!(update.title ?? article.title)?.trim() || !update.summary?.trim() || !update.content?.trim()) {
        throw httpError(400, 'יש למלא כותרת, תקציר ותוכן לפני שליחה לאישור.');
      }
      if (!(await getCategories()).some(category => String(category.id) === String(update.categoryId ?? article.categoryId))) {
        throw httpError(400, 'קטגוריית הכתבה אינה קיימת.');
      }
    }
    if (status === 'returned' && !editorNote) throw httpError(400, 'נדרשת הערה להחזרה לתיקונים.');
    const now = new Date().toISOString();
    await Update.updateOne({ _id: update._id }, {
      $set: { status, editorNote: status === 'returned' ? editorNote : '', updatedAt: now,
        publishedAt: status === 'published' ? now : null }
    }, { session });
    await refreshArticle(articleId, session);
  });
  logEvent('article_status_changed', { articleId, status, idNumber: user.idNumber, role: user.role });
  return (await getArticles({ articleId, user, management: true }))[0];
}
module.exports = { createDraft, saveDraft, startRevision, changeStatus, deleteArticle, draftFields, checkRevision };
