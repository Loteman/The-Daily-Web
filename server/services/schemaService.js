const mongoose = require('mongoose');
const { Category, UserType } = require('../models');

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function text(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw httpError(400, label + ' אינו תקין');
  }
  return value.trim();
}
// Runs work(session) in a MongoDB transaction (retried on transient conflicts). Needs a replica set.
async function transaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session)); }
  finally { await session.endSession(); }
}


let categoriesCache = { db: null, at: 0, data: null };
async function getCategories() {
  const db = mongoose.connection.db;
  if (categoriesCache.db === db && Date.now() - categoriesCache.at < 30000) return categoriesCache.data;
  
  const rows = await Category.find({}).lean();
  
  const data = rows.flatMap(row => {
    if (row.categoryId !== undefined) {
      return [{ 
        id: row.categoryId, 
        name: row.name || row.categoryName || '', 
        className: row.className || '' 
      }];
    }
    
    return Object.entries(row)
      .filter(([key]) => key !== '_id' && key !== '__v')
      .map(([name, value]) => {
        if (value && typeof value === 'object') {
          return {
            name: name,
            id: value.id,
            className: value.className || ''
          };
        }
        return {
          name: name,
          id: value,
          className: ''
        };
      });
  });

  categoriesCache = { db, at: Date.now(), data };
  return data;
}

let userTypeCache = { db: null, at: 0, data: null };
async function getUserTypeRows() {
  // Same reasoning as getCategories above: this mapping is effectively static app config, so every
  // authenticated request (this runs inside loadUser, on every single /api/* call) shouldn't pay a
  // separate database round-trip for it.
  const db = mongoose.connection.db;
  if (userTypeCache.db === db && Date.now() - userTypeCache.at < 30000) return userTypeCache.data;
  const rows = await UserType.find({}).lean();
  userTypeCache = { db, at: Date.now(), data: rows };
  return rows;
}
async function roleFor(user) {
  const rows = await getUserTypeRows();
  for (const row of rows) {
    for (const role of ['reporter', 'editor']) {
      if (row[role] !== undefined && String(row[role]) === String(user.userType)) return role;
    }
  }
  return null;
}
module.exports = { httpError, text, transaction, getCategories, roleFor };
