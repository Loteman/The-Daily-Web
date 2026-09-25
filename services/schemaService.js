const mongoose = require('mongoose');

function database() { return mongoose.connection.db; }
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function text(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw httpError(400, label + ' אינו תקין');
  }
  return value.trim();
}
async function getCategories(db = database()) {
  const rows = await db.collection('Categories').find({}).toArray();
  return rows.flatMap(row => row.categoryId !== undefined
    ? [{ id: row.categoryId, name: row.name || row.categoryName || '' }]
    : Object.entries(row).filter(([key, value]) => key !== '_id' && ['number', 'string'].includes(typeof value))
      .map(([name, id]) => ({ id, name })));
}
async function roleFor(user, db = database()) {
  const rows = await db.collection('User_type').find({}).toArray();
  for (const row of rows) {
    for (const role of ['reporter', 'editor']) {
      if (row[role] !== undefined && String(row[role]) === String(user.userType)) return role;
    }
  }
  return null;
}
module.exports = { database, httpError, text, getCategories, roleFor };
