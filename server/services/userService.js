const bcrypt = require('bcrypt');
const { randomUUID } = require('node:crypto');
const { User } = require('../models');
const { text, httpError } = require('./schemaService');

// Existing User_type map (see DATABASE_MAPPING.md): reporter -> 1, editor -> 2.
const roleToUserType = { reporter: 1, editor: 2 };
function roleFromType(userType) {
  return String(userType) === '1' ? 'reporter' : String(userType) === '2' ? 'editor' : null;
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function presentUser(user) {
  return { idNumber: user.idNumber, username: user.username, fullName: user.fullName || user.username, role: roleFromType(user.userType) };
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) {
    throw httpError(400, 'הסיסמה חייבת להכיל לפחות 6 תווים.');
  }
}

async function listUsers(search = '') {
  const query = search.trim()
    ? { $or: [{ username: { $regex: escapeRegex(search.trim()), $options: 'i' } }, { fullName: { $regex: escapeRegex(search.trim()), $options: 'i' } }] }
    : {};
  const rows = await User.find(query, { passwordHash: 0 }).sort({ username: 1 }).lean();
  return rows.map(presentUser).filter(user => user.role);
}

async function createUser({ username, fullName, password, role }) {
  username = text(username, 100, 'שם משתמש', true);
  fullName = text(fullName, 100, 'שם מלא', true);
  if (!['reporter', 'editor'].includes(role)) throw httpError(400, 'יש לבחור תפקיד.');
  validatePassword(password);
  if (await User.exists({ username })) throw httpError(409, 'שם המשתמש כבר קיים.');
  const idNumber = 'usr_' + randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const userType = roleToUserType[role];
  await User.create({ idNumber, username, fullName, userType, passwordHash });
  return presentUser({ idNumber, username, fullName, userType });
}

async function updateUser(idNumber, { username, fullName, role, password }) {
  const user = await User.findOne({ idNumber }).lean();
  if (!user) throw httpError(404, 'המשתמש לא נמצא.');
  const set = {};
  
  if (username !== undefined) {
    username = text(username, 100, 'שם משתמש', true);
    if (await User.exists({ username, idNumber: { $ne: idNumber } })) 
    {
      throw httpError(409, 'שם המשתמש כבר קיים.');
    }
    set.username = username;
  }
  
  if (fullName !== undefined) set.fullName = text(fullName, 100, 'שם מלא', true);
  if (role !== undefined) {
    if (!['reporter', 'editor'].includes(role)) throw httpError(400, 'יש לבחור תפקיד.');
    set.userType = roleToUserType[role];
  }
  if (password) {
    validatePassword(password);
    set.passwordHash = await bcrypt.hash(password, 10);
  }
  if (Object.keys(set).length) await User.updateOne({ idNumber }, { $set: set });
  return presentUser(await User.findOne({ idNumber }).lean());
}

async function deleteUser(idNumber, currentUser) {
  if (idNumber === currentUser.idNumber) throw httpError(400, 'לא ניתן למחוק את המשתמש המחובר.');
  const result = await User.deleteOne({ idNumber });
  if (!result.deletedCount) throw httpError(404, 'המשתמש לא נמצא.');
}

// Used by login and by the middleware that loads the signed-in user on every API request.
function findUserById(idNumber) { return User.findOne({ idNumber }).lean(); }
function findUserByUsername(username) { return User.findOne({ username }).lean(); }

module.exports = { listUsers, createUser, updateUser, deleteUser, findUserById, findUserByUsername };
