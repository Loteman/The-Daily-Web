const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { database, getCategories, text, httpError } = require('./schemaService');
const { getArticles } = require('./articleService');

function requireReporter(user) {
  if (user?.role !== 'reporter') throw httpError(403, 'רק כתב יכול לערוך כתבות.');
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
async function transaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session)); }
  finally { await session.endSession(); }
}
async function latest(articleId, session) {
  return database().collection('Updates').findOne({ articleId }, { session, sort: { version: -1, updatedAt: -1, _id: -1 } });
}
async function ownedArticle(articleId, user, session) {
  const article = await database().collection('Articles').findOne({ articleId }, { session });
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
    await database().collection('Articles').insertOne({
      articleId, title: fields.title, reporterIdNumber: user.idNumber,
      categoryId: fields.categoryId, mainImage: fields.mainImage, createdAt: now
    }, { session });
    await database().collection('Updates').insertOne({
      updateId: 'upd_' + randomUUID(), articleId, version: 1, ...fields,
      status: 'draft', editorNote: '', updatedAt: now, publishedAt: null
    }, { session });
  });
  return (await getArticles({ articleId, user, management: true }))[0];
}
async function saveDraft(articleId, user, input) {
  const fields = await draftFields(input);
  await transaction(async session => {
    await ownedArticle(articleId, user, session);
    const update = await latest(articleId, session);
    checkRevision(update, input);
    // Reporter edits their own draft/returned version; editor may tweak content while a version is pending
    // review, without kicking it back to draft (that would undo the submit-for-review step).
    const reporterEdit = user.role === 'reporter' && ['draft', 'returned'].includes(update.status);
    const editorEdit = user.role === 'editor' && update.status === 'pending';
    if (!reporterEdit && !editorEdit) throw httpError(409, 'יש לפתוח טיוטה חדשה כדי לערוך גרסה שפורסמה.');
    await database().collection('Updates').updateOne({ _id: update._id }, {
      $set: { ...fields, ...(reporterEdit ? { status: 'draft' } : {}),
        updatedAt: new Date(Math.max(Date.now(), new Date(update.updatedAt).getTime() + 1)).toISOString() }
    }, { session });
  });
  return (await getArticles({ articleId, user, management: true }))[0];
}
async function deleteArticle(articleId, user) {
  if (user?.role !== 'editor') throw httpError(403, 'רק עורך יכול למחוק כתבה.');
  await transaction(async session => {
    const article = await database().collection('Articles').findOne({ articleId }, { session });
    if (!article) throw httpError(404, 'הכתבה לא נמצאה.');
    await database().collection('Updates').deleteMany({ articleId }, { session });
    await database().collection('Commnents').deleteMany({ articleId }, { session });
    await database().collection('Views').deleteMany({ articleId }, { session });
    await database().collection('Articles').deleteOne({ articleId }, { session });
  });
}
async function startRevision(articleId, user, input) {
  requireReporter(user);
  await transaction(async session => {
    const article = await ownedArticle(articleId, user, session);
    const update = await latest(articleId, session);
    checkRevision(update, input);
    if (update.status !== 'published') throw httpError(409, 'כבר קיימת גרסה לעריכה.');
    await database().collection('Updates').insertOne({
      // The unique _id prevents two simultaneous requests creating the same version.
      _id: articleId + ':v' + (update.version + 1),
      updateId: 'upd_' + randomUUID(), articleId, version: update.version + 1,
      title: update.title ?? article.title, categoryId: update.categoryId ?? article.categoryId,
      mainImage: update.mainImage ?? article.mainImage ?? '', summary: update.summary || '',
      content: update.content || '', status: 'draft', editorNote: '',
      updatedAt: new Date().toISOString(), publishedAt: null
    }, { session });
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
    await database().collection('Updates').updateOne({ _id: update._id }, {
      $set: { status, editorNote: status === 'returned' ? editorNote : '', updatedAt: now,
        publishedAt: status === 'published' ? now : null }
    }, { session });
  });
  return (await getArticles({ articleId, user, management: true }))[0];
}
module.exports = { createDraft, saveDraft, startRevision, changeStatus, deleteArticle, draftFields, checkRevision };
