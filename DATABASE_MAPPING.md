# Website and MongoDB mapping

The application uses `main_DB` by default. Existing collection names and documents are preserved. The old local article arrays, hard-coded login users, and local draft storage are no longer used.

## Existing names mapped by the code

| Website concept | MongoDB source | Adaptation |
| --- | --- | --- |
| Article ID | `Articles.articleId` | Exposed as `id` to the existing UI. |
| Article author | `Articles.reporterIdNumber → Users.idNumber` | Displays `Users.fullName`, falling back to `username`. Identity numbers and password hashes are not returned publicly. |
| Login | `Users.username`, `Users.passwordHash` | Passwords are verified with bcrypt on the server. |
| Role | `Users.userType → User_type` | Existing map is `reporter: "1", editor: "2"`. Numeric and string values are matched. Old browser role `creator` is now `reporter`. |
| Article category | `Articles.categoryId → Categories` | Reads the existing single-document map: `Food: 1, Politics: 2, Travel: 3`. Form options come from this collection. |
| Content and summary | `Updates.content`, `Updates.summary` | Content becomes the UI paragraph list. Older records without summary use a content excerpt. |
| Public article | `Updates.status = "published"` | Selects the greatest numeric `version` for each article. Newer drafts/pending/returned versions never replace the public version. Articles with no published version stay hidden. |
| Management article | Latest `Updates.version` | Shows the latest version regardless of status. Reporters see their own articles; editors see all. |
| Comments | `Commnents` | The existing spelling is intentional in the code. `commentId → id`, `fullName → name`, `content → text`, `createdAt → date`. No collection rename is needed. |
| Views and popularity | `Views` | Stores `viewId, articleId, idNumber, viewedAt`. Guests have `idNumber: null`. One visit per article per session is counted. |
| Read status | `Views.idNumber` for signed-in users | Guests use the current server session's article IDs; all guest rows with null identity are not treated as one reader. |
| Statistics | Aggregated `Updates` and `Views` | Status totals, daily view counts, and publication history. `Statistics` was empty and has no defined fields, so no schema is invented for it. |

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

New articles and related records receive UUID-based string IDs. New revision documents use a deterministic string `_id` to prevent duplicate versions during concurrent requests; existing ObjectId values are unchanged. Timestamps written by this application remain ISO strings, matching the existing documents.

## New session collection

`Sessions` is created by the MongoDB session store on the first successful login or tracked guest visit. It contains `_id`, serialized `session`, and `expires`. The session holds the authenticated user ID and guest read history. Passwords are never stored in sessions.

Sessions expire after 24 hours. Expiration is enforced on reads; automatic TTL-index creation is disabled to avoid silently changing the database's indexes. Expired session documents may be cleaned up separately.

`SESSION_SECRET` is a new environment setting, not a database field. A random secret was generated in the ignored `.env.local` because this repository currently tracks `.env`. The server loads `.env.local` before `.env`. Keep the secret stable across restarts; production requires it explicitly.

## Data issues found on September 20, 2026

- `User1.passwordHash` has a valid bcrypt format. This confirms the format, not that a particular password is known or correct.
- `User2_admin.passwordHash` initially had an invalid bcrypt format. On September 23, 2026, both `User1` and `User2_admin` had their passwords reset at the owner's request; the new bcrypt hashes were verified successfully.
- Both existing `Articles.mainImage` URLs point to `example.com`. Replace them with real accessible image URLs to display actual images. The UI falls back to a placeholder on image errors.
- `Categories` currently defines Food, Politics, and Travel. Existing article category IDs resolve to those values even if the article topic suggests a different category.
- `Statistics` has no documents, so there is no existing field schema to map.

## Verification

- `npm test`: local temporary MongoDB replica set; verifies authentication, sessions, ownership, drafts, review, publication, concurrency, comments, limits, read status, and statistics. It never connects to the configured remote database.
- `npm run test:integration`: read-only checks against the configured database.
- `npm run audit:schema`: prints collection field names and bcrypt-format validity without printing password hashes.
