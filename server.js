require('dotenv').config({ path: ['.env.local', '.env'] });
const createApp = require('./app');
const connectDB = require('./config/db');

async function start() {
  await connectDB();
  const app = createApp();
  const port = process.env.PORT || 3000;
  return app.listen(port, () => console.log(`Website running at http://localhost:${port}/articlesFeed/index.html`));
}

if (require.main === module) {
  start().catch(error => {
    console.error('Server startup failed:', error.name, error.code || '');
    process.exitCode = 1;
  });
}

module.exports = start;
