const { database, roleFor, httpError } = require('../services/schemaService');

async function loadUser(req, res, next) {
  try {
    req.user = null;
    if (req.session.userId) {
      const user = await database().collection('Users').findOne({ idNumber: req.session.userId });
      if (user) {
        const role = await roleFor(user);
        if (role) req.user = { idNumber: user.idNumber, username: user.username, fullName: user.fullName || user.username, role };
      }
    }
    next();
  } catch (error) { next(error); }
}
function requireAuth(req, res, next) {
  if (!req.user) return next(httpError(401, 'יש להתחבר כדי להמשיך.'));
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return next(httpError(401, 'יש להתחבר כדי להמשיך.'));
    if (req.user.role !== role) return next(httpError(403, 'אין לך הרשאה לפעולה זו.'));
    next();
  };
}
function publicUser(user) {
  return user ? { username: user.username, fullName: user.fullName, role: user.role } : null;
}
module.exports = { loadUser, requireAuth, requireRole, publicUser };
