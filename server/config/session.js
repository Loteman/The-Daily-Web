const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');
const { randomBytes } = require('node:crypto');

module.exports = function createSession(store) {
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production');
  }
  return session({
    name: 'daily.sid',
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: store || MongoStore.create({
      client: mongoose.connection.getClient(),
      dbName: mongoose.connection.db.databaseName,
      collectionName: 'Sessions',
      // Session expiry is checked on reads; avoid automatic schema/index changes.
      autoRemove: 'disabled'
    }),
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 }
  });
};
