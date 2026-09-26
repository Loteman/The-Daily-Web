# The-Daily-Web - introduction
Project for Web Application Development


# The Daily Web

News publishing and management system — final project for Web Application Development.

## 1. Installation and running instructions

Install Node.js and run `npm install`. Set `MONGO_URI` to your MongoDB connection string and `SESSION_SECRET` to a long random secret in the ignored `.env.local`. This file takes precedence over the existing `.env`. Optionally set `PORT` (default `3000`) and `MONGO_DB_NAME` (default `main_DB`).

Run `npm start` and open `http://localhost:3000/public/html/articleFeed.html` (use your configured port). Serve the website through this Node server so the browser can reach `/api/articles`.

The feed and article page read `Articles` joined with the highest numbered `Updates` version whose status is `published`. Newer drafts are excluded; articles without a published update are hidden. Category labels, reporter names, and view counts come from `Categories`, `Users`, and `Views`. The database connection does not create collections or indexes.

Run `npm test` for complete workflow checks on a temporary local MongoDB replica set. The first run may download a MongoDB test binary. Run `npm run test:integration` for read-only checks against the configured database.

See [DATABASE_MAPPING.md](DATABASE_MAPPING.md) for exact collection/field mappings, new draft fields, session storage, and existing data issues. Login uses the credentials stored in MongoDB; the old local demo accounts are no longer used.

## 2. Project structure (main folders and files)

`server.js` connects to MongoDB and starts `app.js`. `routes/` exposes the JSON API, `services/` performs database queries and publishing transactions, and `middlewares/auth.js` checks database-backed sessions and roles. Browser pages live in `articlesFeed/`, `article/`, `articlesManagement/`, and `login/`; their repositories in `data/` call the API. The older EJS folders are scaffolding and are not mounted.

## 3. Main functionality and implemented features

The feed and article pages display the latest published versions. Reporters create and autosave drafts, submit them for review, and start new versions of published articles. Editors publish or return submissions with notes. Permissions, validation, and stale-write checks run on the server. Comments, visits, user read history, categories, and dashboard analytics use MongoDB. Guest comments are limited to three per minute per IP. Login uses bcrypt and MongoDB-backed sessions; logout invalidates the session. The weather widget continues using its external weather service.
