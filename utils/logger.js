const fs = require('node:fs');
const path = require('node:path');

const logDir = path.join(__dirname, '..', 'logs');
try { fs.mkdirSync(logDir, { recursive: true }); } catch { /* best effort */ }

function append(file, entry) {
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFile(path.join(logDir, file), line, () => {});
}

// Server errors (5xx): written to logs/errors.log in addition to the console.
function logError(error, context = {}) {
  append('errors.log', { level: 'error', name: error.name, message: error.message, code: error.code, ...context });
}

// Significant operational events (auth, article lifecycle): logs/events.log.
function logEvent(event, context = {}) {
  append('events.log', { level: 'info', event, ...context });
}

module.exports = { logError, logEvent };
