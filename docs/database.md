# Database

## Storage engine

The CMS server uses SQLite through `better-sqlite3` in `server/db.js`.

Important runtime settings:

- `journal_mode = WAL`
- `foreign_keys = ON`
- Synchronous database API with async-compatible wrapper functions for route
  handlers.

The exported API includes:

- `db`: the raw `better-sqlite3` database instance.
- `stmts`: legacy prepared statements used throughout older server code.
- `getSetting`, `getAllSettings`, `setSetting`: settings helpers.
- `run`, `get`, `all`: Promise-returning wrappers around synchronous queries.
- `ready`: compatibility helper.
- `logTableCounts`: startup/debug helper.

## Database file location

`server/db.js` resolves the SQLite path in this order:

1. `DB_PATH` environment variable, if set.
2. `/data/neurotonics.db`, if the `/data` directory exists.
3. `server/data/neurotonics.db` for local development and Render free-tier
   fallback.

This means a Render persistent disk mounted at `/data` is used automatically.
Without a persistent disk, the database file can be ephemeral across redeploys.

## Schema

The schema is created at server startup with `CREATE TABLE IF NOT EXISTS`.

### `users`

CMS admin/editor accounts.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key, autoincrement |
| `email` | TEXT | Required, unique |
| `password_hash` | TEXT | Required bcrypt hash |
| `role` | TEXT | Required, default `editor`, constrained to `admin` or `editor` |
| `name` | TEXT | Required, default empty string |
| `created_at` | TEXT | Defaults to `datetime('now')` |
| `updated_at` | TEXT | Defaults to `datetime('now')` |

On startup, `server/index.js` creates an initial admin if the table is empty.
`FORCE_ADMIN_RESET=true` can update the primary admin from the configured
`ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD`.

### `orders`

Commerce orders created from Stripe webhooks or manual Stripe sync.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key, autoincrement |
| `order_number` | TEXT | Unique when present |
| `stripe_session_id` | TEXT | Unique Stripe Checkout Session or PaymentIntent id |
| `customer_name` | TEXT | Required, default empty string |
| `customer_email` | TEXT | Required, default empty string |
| `customer_phone` | TEXT | Required, default empty string |
| `shipping_address` | TEXT | JSON string, default `{}` |
| `items` | TEXT | JSON string, default `[]` |
| `shipping` | TEXT | JSON string, default `{}` |
| `subtotal` | REAL | Default `0` |
| `total` | REAL | Default `0` |
| `status` | TEXT | Default `pending`; webhook uses values like `processing` and `failed` |
| `payment_status` | TEXT | Default `pending`; webhook uses `paid` or `failed` |
| `notification_email` | TEXT | Email destination captured at order time |
| `notes` | TEXT | Customer/public notes |
| `admin_notes` | TEXT | Internal CMS notes |
| `tracking_number` | TEXT | Fulfillment tracking |
| `carrier` | TEXT | Fulfillment carrier |
| `fulfillment_date` | TEXT | Set when fulfilled |
| `fulfillment_notes` | TEXT | Internal/customer fulfillment notes |
| `created_at` | TEXT | Defaults to `datetime('now')` |
| `updated_at` | TEXT | Defaults to `datetime('now')` |

Startup migrations add newer order columns if an older database exists:

- `order_number`
- `payment_status`
- `admin_notes`
- `tracking_number`
- `carrier`
- `fulfillment_date`
- `fulfillment_notes`

A partial unique index enforces unique non-null `order_number` values.

### `content_snapshots`

Snapshots of content files before CMS writes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key, autoincrement |
| `filename` | TEXT | Required |
| `content` | TEXT | Required file content |
| `updated_by` | INTEGER | Nullable foreign key to `users(id)` |
| `updated_at` | TEXT | Defaults to `datetime('now')` |

Snapshots are used for content history and are intentionally excluded from safe
backup payloads.

### `settings`

CMS and operational key/value settings.

| Column | Type | Notes |
| --- | --- | --- |
| `key` | TEXT | Primary key |
| `value` | TEXT | Required, default empty string |
| `updated_at` | TEXT | Defaults to `datetime('now')` |

Default seeded settings include:

- `notification_email`
- `admin_notification_email`
- `buy_globally_enabled`
- `promo_banner_visible`
- `promo_banner_text`
- `order_confirmation_template`
- `admin_alert_template`
- `order_number_sequence`

`INSERT OR IGNORE` preserves existing values during startup.

### `password_reset_tokens`

Short-lived password reset tokens.

| Column | Type | Notes |
| --- | --- | --- |
| `token` | TEXT | Primary key |
| `user_id` | INTEGER | Required foreign key to `users(id)`, cascades on delete |
| `expires_at` | TEXT | Required |
| `created_at` | TEXT | Defaults to `datetime('now')` |

Tokens are not backed up.

### `stockist_applications`

B2B stockist application records.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key, autoincrement |
| `full_name` | TEXT | Required, default empty string |
| `business_name` | TEXT | Required, default empty string |
| `abn` | TEXT | Required, default empty string |
| `email` | TEXT | Required, default empty string |
| `phone` | TEXT | Required, default empty string |
| `business_address` | TEXT | Required, default empty string |
| `industry` | TEXT | Required, default empty string |
| `business_website` | TEXT | Required, default empty string |
| `message` | TEXT | Required, default empty string |
| `status` | TEXT | Required, default `new`, constrained to `new`, `reviewing`, `approved`, or `rejected` |
| `notes` | TEXT | Required, default empty string |
| `created_at` | TEXT | Defaults to `datetime('now')` |
| `updated_at` | TEXT | Defaults to `datetime('now')` |

## Order creation sources

Orders can be created by:

- `checkout.session.completed` in `server/routes/stripe-webhook.js`.
- `payment_intent.succeeded` in `server/routes/stripe-webhook.js`.
- Admin-only manual sync through `POST /cms/orders/sync-stripe`.
- Failed PaymentIntent webhook events create failed order records with limited
  data.

Order numbers are generated from the `order_number_sequence` setting and use the
format `ORD-<number>`.

## Backup and restore

Backup logic lives in `server/backup.js`.

Safe backup payloads include:

- `stockist_applications`
- `users`
- `settings`

Safe backup payloads intentionally exclude:

- `orders`, because they contain customer PII and Stripe remains the payment
  record of truth.
- `content_snapshots`, because they can become large and are not critical.
- `password_reset_tokens`, because they are short-lived credentials.

Local backup path:

1. `DB_BACKUP_DIR/backup-latest.json`, if `DB_BACKUP_DIR` is set.
2. `server/data/backup-latest.json` otherwise.

Backup lifecycle:

1. Startup attempts to restore from GitHub backup first, then local backup if
   the database appears empty.
2. A periodic backup is scheduled every five minutes by `server/index.js`.
3. Every tenth periodic cycle also attempts a GitHub backup.
4. Stockist application creation and status/notes updates trigger immediate
   backup work.
5. Admins can download and restore backups through `/cms/backup/*`.

Restore behavior merges records using `INSERT OR IGNORE`; existing rows are not
overwritten.

## GitHub data repository backup

`server/github.js` can create and use a private GitHub data repository for CMS
backup storage when `GITHUB_PAT` is configured.

Default data repo:

```text
{GITHUB_OWNER}/{GITHUB_REPO}-cms-data
```

Override:

```text
GITHUB_DATA_REPO=owner/repo
```

The data repo stores backup content such as `backup/latest.json`. If GitHub
backup is unavailable, the server continues with local file-based backups.

## Development notes

- Do not commit `server/data/`, SQLite files, WAL files, or backup JSON.
- Prefer the existing `db.run`, `db.get`, and `db.all` wrappers in new async
  route code.
- Use prepared statements and bound parameters for all user-supplied values.
- If adding tables or columns, preserve startup compatibility with existing
  SQLite files.
- If adding backup coverage, consider whether the table contains PII or
  short-lived credentials before including it.
