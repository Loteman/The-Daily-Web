const express = require('express');
const path = require('node:path');
const createSession = require('./config/session');
const { loadUser } = require('./middlewares/auth');
const { getCategories, httpError } = require('./services/schemaService');

function createApp({ sessionStore } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '150kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Only same-origin browser requests may change state.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== req.protocol + '://' + req.get('host'))) {
        return next(httpError(403, 'הבקשה נחסמה.'));
      }
      if (!req.is('application/json')) return next(httpError(415, 'נדרשת בקשת JSON.'));
    }
    next();
  }, createSession(sessionStore), loadUser);
  
  app.use('/api/auth', require('./routes/authRoutes'));
  app.get('/api/categories', async (req, res) => res.json(await getCategories()));
  app.use('/api/articles', require('./routes/api/articlesApi'));
  app.use('/api/management/articles', require('./routes/reporterRoutes'));
  app.use('/api/statistics', require('./routes/api/statsApi'));
  app.get('/', (req, res) => res.redirect('./html/articlesFeed/index.html'));
  for (const directory of ['./html/articlesFeed', './html/article', './html/header', './html/login', './html/articlesManagement', './data', './public']) {
    app.use('/' + directory, express.static(path.join(__dirname, directory)));
  }
  app.use('/api', (req, res) => res.status(404).json({ error: 'הנתיב לא נמצא.' }));
  app.use((error, req, res, next) => {
    const status = error.code === 11000 ? 409 : error.status || 500;
    if (status >= 500) console.error('Request failed:', error.name, error.code || '');
    res.status(status).json({
      error: error.code === 11000 ? 'הגרסה כבר השתנתה. יש לרענן.' :
        status < 500 ? error.message : 'לא ניתן להשלים את הפעולה. נסו שוב.'
    });
  });
  // במקום הלולאה שמוסיפה ./public עם הנתיב המלא:
app.use(express.static(path.join(__dirname, 'public')));
  return app;
}
module.exports = createApp;
