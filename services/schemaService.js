const mongoose = require('mongoose');

function database() { return mongoose.connection.db; }
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function text(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw httpError(400, label + ' אינו תקין');
  }
  return value.trim();
}
let categoriesCache = { db: null, at: 0, data: null };
async function getCategories(db = database()) {
  // Categories rarely change; skip the round-trip to Atlas on every article request.
  if (categoriesCache.db === db && Date.now() - categoriesCache.at < 30000) return categoriesCache.data;
  const rows = await db.collection('Categories').find({}).toArray();
  const data = rows.flatMap(row => row.categoryId !== undefined
    ? [{ id: row.categoryId, name: row.name || row.categoryName || '' }]
    : Object.entries(row).filter(([key, value]) => key !== '_id' && ['number', 'string'].includes(typeof value))
      .map(([name, id]) => ({ id, name })));
  categoriesCache = { db, at: Date.now(), data };
  return data;
}
let userTypeCache = { db: null, at: 0, data: null };
async function getUserTypeRows(db) {
  // Same reasoning as getCategories above: this mapping is effectively static app config, so every
  // authenticated request (this runs inside loadUser, on every single /api/* call) shouldn't pay a
  // separate database round-trip for it.
  if (userTypeCache.db === db && Date.now() - userTypeCache.at < 30000) return userTypeCache.data;
  const rows = await db.collection('User_type').find({}).toArray();
  userTypeCache = { db, at: Date.now(), data: rows };
  return rows;
}
async function roleFor(user, db = database()) {
  const rows = await getUserTypeRows(db);
  for (const row of rows) {
    for (const role of ['reporter', 'editor']) {
      if (row[role] !== undefined && String(row[role]) === String(user.userType)) return role;
    }
  }
  return null;
}
module.exports = { database, httpError, text, getCategories, roleFor };
