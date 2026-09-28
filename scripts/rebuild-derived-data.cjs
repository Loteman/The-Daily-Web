require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
const mongoose = require('mongoose');

// Creates any missing index and rebuilds what the site stores next to the source collections: each article's
// published and current versions and view count (Articles) and the hourly view totals (Statistics). The site does
// this by itself at start when they are out of step; run it after changing Articles, Updates or Views directly in
// the database while the site is running.
async function main() {
  await require('../server/config/db')({ prepare: false });
  const indexFailures = await require('../server/models').createIndexes();
  const rebuilt = await require('../server/services/derivedDataService').rebuildDerivedData();
  console.log(JSON.stringify({ database: mongoose.connection.db.databaseName, ...rebuilt, indexFailures: indexFailures.length }));
}
main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
