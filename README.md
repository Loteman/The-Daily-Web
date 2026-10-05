# The-Daily-Web - introduction
Project for Web Application Development


# The Daily Web

News publishing and management system — final project for Web Application Development.
Readers browse and comment on published articles, reporters write and submit articles, and editors review, publish and track them.


## 1. Installation and running instructions

1. Install Node.js and run `npm install`.
2. Create `.env.local` from `.env.example` and fill in `MONGO_URI` (your MongoDB connection string), `SESSION_SECRET` (a long random secret), `OPENWEATHER_API_KEY` (the weather widget's key) and `SEED_PASSWORD` (the password the demo accounts get). `PORT` (default `3000`) and `MONGO_DB_NAME` (default `main_DB`) are optional. The server reads `.env.local` before `.env`; keep both out of git. MongoDB must be a replica set because publishing uses transactions: MongoDB Atlas already is one, and a local server has to run with `--replSet`.

3. Run `npm start` and open `http://localhost:3000/articlesFeed/index.html` (use your configured port). Serve the website through this Node server so the browser can reach `/api`.

The demo accounts all use the `123456` password: `User1` is reporter and `User2_admin` is the editor, which can also manage and add more users. Login checks the accounts stored in MongoDB, so existing accounts keep working.

At start the server creates any index the models declare that is missing (it never changes or drops one). It also rebuilds the listing data it stores when that is missing or out of step: each article's published version, latest version and view count in `Articles`, and the hourly view totals in `Statistics`. After changing `Articles`, `Updates` or `Views` directly in the database while the site is running, run `npm run db:rebuild`.

Run `npm test` for complete workflow checks on a temporary local MongoDB replica set. The first run may download a MongoDB test binary. Run `npm run test:integration` for read-only checks against the configured database.

See [DATABASE_MAPPING.md](docs/DATABASE_MAPPING.md) for exact collection/field mappings, the stored listing data, session storage, and existing data issues.

## 2. Project structure (main folders and files)

The server is organized as MVC. `server/server.js` connects to MongoDB through `server/config/db.js` and starts `server/app.js`. `server/models/` holds the Mongoose schema and model of each collection, with its indexes. `server/services/` holds the logic that uses the models: listings, publishing transactions, comments, statistics and the weather. `server/routes/` are the controllers: they read the request, call a service and answer with JSON or a page, and `server/middlewares/auth.js` checks database-backed sessions and roles. Browser pages live in `client/articlesFeed/`, `client/article/`, `client/articlesManagement/`, `client/users/`, `client/statistics/` and `client/login/`; their repositories in `client/data/` call the API. `scripts/` holds the demo data seed and maintenance scripts.

## 3. Main functionality and implemented features

The feed and article pages display the latest published versions, newest publication first. Reporters create and autosave drafts, submit them for review, and start new versions of published articles. Editors publish or return submissions with notes; they can also edit drafts and returned versions and start a new version of any published article. Editors can also manage users and see the articles statistics. Reporters can see the statistics too, but only on their articles. Permissions, validation, and stale-write checks run on the server. Comments, visits, user read history, categories, and dashboard analytics use MongoDB; every visit to an article counts as a view. Guest comments are limited to three per minute per IP. Login uses bcrypt and MongoDB-backed sessions; logout invalidates the session. The weather widget asks this server, which calls OpenWeatherMap with the key from `OPENWEATHER_API_KEY` and keeps each area's answer for 10 minutes.
