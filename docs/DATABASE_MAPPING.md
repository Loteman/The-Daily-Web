# Website and MongoDB mapping

The application uses `main_DB` by default. Existing collection names and documents are preserved. The old local article arrays, hard-coded login users, and local draft storage are no longer used.

## Existing names mapped by the code

| Website concept | MongoDB source | Adaptation |
| --- | --- | --- |
| Article ID | `Articles.articleId` | Exposed as `id` to the existing UI. |
| Article author | `Articles.reporterIdNumber → Users.idNumber` | Displays `Users.fullName`, falling back to `username`. Identity numbers and password hashes are not returned publicly. |
| Login | `Users.username`, `Users.passwordHash` | Passwords are verified with bcrypt on the server. |
| Role | `Users.userType → User_type` | Existing map is `reporter: "1", editor: "2"`. Numeric and string values are matched. Old browser role `creator` is now `reporter`. |
| Article category | `Articles.categoryId → Categories` | Reads the existing single-document map: `Food: 1, Politics: 2, Travel: 3`. Form options come from this collection. `scripts/seed.js --apply` reuses a category that exists under its Hebrew or English name and adds the ones its articles need that are missing. |
| Content and summary | `Updates.content`, `Updates.summary` | Content becomes the UI paragraph list. Older records without summary use a content excerpt. |
| Public article | `Updates.status = "published"` | The greatest numeric published `version` of each article, stored as `Articles.published` (see below). Newer drafts/pending/returned versions never replace the public version. Articles with no published version stay hidden. The feed is ordered by publication date (`publishedAt`). |
| Management article | Latest `Updates.version` | Shows the latest version regardless of status, stored as `Articles.current`. Reporters see their own articles; editors see all. |
| Comments | `Commnents` | The existing spelling is intentional in the code. `commentId → id`, `fullName → name`, `content → text`, `createdAt → date`. No collection rename is needed. |
| Views and popularity | `Views` | Stores `viewId, articleId, idNumber, viewedAt`. Guests have `idNumber: null`. Every visit is recorded and counted, including repeat visits; the count is stored as `Articles.viewCount`. |
| Read status | `Views.idNumber` for signed-in users | Guests use the current server session's article IDs; all guest rows with null identity are not treated as one reader. |
| Statistics | `Statistics`, `Updates` | `Statistics` holds hourly view totals: `articleId`, `hour` (`YYYY-MM-DDTHH:00`, Israel time) and `views`, one document per article and hour, plus one per hour with `articleId: null` for the whole site. Each visit adds 1 to both, and the charts read these totals; an editor's chart of all articles reads only the site's documents. Editors can correct a view's time (`PATCH /api/statistics/views/:viewId`), which moves it to its new hour. Status totals and publication history come from `Updates`. |

## Additional fields used for future writes

No existing article or update was migrated or rewritten.

| Collection | Additional field | Reason |
| --- | --- | --- |
| `Updates` | `title` | Keeps a draft title separate from the published title. |
| `Updates` | `categoryId` | Keeps draft category changes from affecting the feed. |
| `Updates` | `mainImage` | Keeps draft image changes from affecting the public article. |
| `Updates` | `editorNote` | Stores the editor's reason for returning a version for corrections. |

These fields are written when a draft is created/saved. Existing versions without them continue using the base `Articles` fields. Future edits do not overwrite the published version or base article metadata.

`Updates.summary` is already present in the current database; it is not a new required addition. Status values used by the existing UI are `draft`, `pending`, `published`, and `returned`.

New articles and related records receive UUID-based string IDs. The first version of an article gets an ObjectId `_id`, like the existing documents. New revision documents use a deterministic string `_id` to prevent duplicate versions during concurrent requests; existing ObjectId values are unchanged. Timestamps written by this application remain ISO strings, matching the existing documents.

## Stored listing data and indexes

So that a listing is one indexed query however many articles exist, each `Articles` document also stores:

| Field | Content |
| --- | --- |
| `published` | The article's newest published version: `versionId` (its `Updates._id`), `updateId`, `version`, `status`, `title`, `summary`, `categoryId`, `mainImage`, `editorNote`, `updatedAt`, `publishedAt`, `date` (the date the site shows) and `sortDate` (the same date as a Date, for sorting). `null` when nothing is published. Missing version fields fall back to the article's own fields, as before. |
| `current` | The same fields for the latest version of any status, used by the management screen. |
| `viewCount` | The number of `Views` documents for the article. |

`Updates` and `Views` remain the source. Every version the site saves updates these fields in the same transaction, and every view adds 1 to `viewCount` and to its hour in `Statistics`. At start the server compares them with `Updates` and `Views` and rebuilds them, with `Statistics`, when they are missing or out of step, for example after data was added by an older script. `npm run db:rebuild` does the same on demand. Article content is still read from `Updates`.

At start the server also creates the indexes the models in `server/models/` declare, if they are missing. It never changes or drops an existing index; a failure is logged and the site still starts.

| Collection | Indexes |
| --- | --- |
| `Articles` | `articleId` (unique); `published.sortDate`; `viewCount`; `current.sortDate`; `reporterIdNumber` with `current.sortDate` |
| `Updates` | `articleId` with `version`; `articleId` with `status` and `version` |
| `Views` | `articleId` with `viewedAt`; `idNumber` with `articleId`; `viewId` |
| `Statistics` | `articleId` with `hour` (unique) |
| `Commnents` | `articleId` with `createdAt`; `commentId` |
| `Users` | `idNumber` (unique); `username` (unique) |

## New session collection

`Sessions` is created by the MongoDB session store on the first successful login or tracked guest visit. It contains `_id`, serialized `session`, and `expires`. The session holds the authenticated user ID and guest read history. Passwords are never stored in sessions.

Sessions expire after 24 hours. Expiration is enforced on reads; the session store's automatic TTL index is disabled, so expired session documents may be cleaned up separately.

`SESSION_SECRET` is an environment setting, not a database field; `.env.example` lists every setting. The server loads `.env.local` before `.env`; neither belongs in git. Keep the secret stable across restarts; production requires it explicitly.

## Data issues found on September 20, 2026

- `User1.passwordHash` has a valid bcrypt format. This confirms the format, not that a particular password is known or correct.
- `User2_admin.passwordHash` initially had an invalid bcrypt format. On September 23, 2026, both `User1` and `User2_admin` had their passwords reset at the owner's request; the new bcrypt hashes were verified successfully.
- Both existing `Articles.mainImage` URLs point to `example.com`. Replace them with real accessible image URLs to display actual images. The UI falls back to a placeholder on image errors.
- `Categories` currently defines Food, Politics, and Travel. Existing article category IDs resolve to those values even if the article topic suggests a different category.
- `Statistics` had no documents and no field schema. It now holds the hourly view totals described above.

## Verification

- `npm test`: local temporary MongoDB replica set; verifies authentication, sessions, ownership, drafts, review, publication, concurrency, comments, limits, read status, statistics, the stored listing data and indexes, and the weather route. It never connects to the configured remote database.
- `npm run test:integration`: read-only checks against the configured database.
- `npm run audit:schema`: prints collection field names and bcrypt-format validity without printing password hashes.
