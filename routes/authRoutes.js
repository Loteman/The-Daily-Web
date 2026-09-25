const router = require('express').Router();
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const { database, roleFor, text, httpError } = require('../services/schemaService');
const { publicUser } = require('../middlewares/auth');
const { logEvent } = require('../utils/logger');

router.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));
router.post('/login', rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'יותר מדי ניסיונות התחברות. נסו שוב בעוד דקה.' } }), async (req, res, next) => {
  try {
    const username = text(req.body.username, 100, 'שם המשתמש', true);
    if (typeof req.body.password !== 'string' || !req.body.password || Buffer.byteLength(req.body.password) > 72) {
      throw httpError(400, 'הסיסמה אינה תקינה.');
    }
    const user = await database().collection('Users').findOne({ username });
    const validHash = user && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.passwordHash);
    if (!validHash || !await bcrypt.compare(req.body.password, user.passwordHash)) {
      logEvent('login_failed', { username });
      throw httpError(401, 'שם המשתמש או הסיסמה שגויים.');
    }
    const role = await roleFor(user);
    if (!role) throw httpError(403, 'סוג המשתמש אינו מוגדר במסד הנתונים.');
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.idNumber;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    logEvent('login_success', { username, role, idNumber: user.idNumber });
    res.json({ success: true, user: publicUser({ ...user, role }) });
  } catch (error) { next(error); }
});
router.post('/logout', (req, res, next) => {
  const idNumber = req.session.userId;
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('daily.sid', { path: '/' });
    if (idNumber) logEvent('logout', { idNumber });
    res.json({ success: true });
  });
});
module.exports = router;
