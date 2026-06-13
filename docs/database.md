# Database

No Prisma schema is present in this repository. The actual schema is created in
`server/db.js` with `better-sqlite3`.

## Engine and location

- Engine: SQLite through `better-sqlite3`.
- WAL mode and foreign keys are enabled.
- DB path priority:
  1. `DB_PATH`
  2. `/data/neurotonics.db` when `/data` exists
  3. `server/data/neurotonics.db`

Do not commit database files, WAL files, `server/data/`, or backups.

## Tables

- `users`: CMS accounts with unique email, bcrypt `password_hash`, `role`
  (`admin` or `editor`), name, timestamps.
- `orders`: Stripe order records with `order_number`, unique
  `stripe_session_id`, customer details, JSON strings for address/items/shipping,
  subtotal/total, status/payment status, notes, tracking and fulfillment fields.
- `content_snapshots`: previous JSON content snapshots with optional
  `updated_by` user reference.
- `settings`: key/value CMS settings, including notification emails, promo
  banner, email templates, and `order_number_sequence`.
- `password_reset_tokens`: reset token, user id, expiry, timestamp.
- `stockist_applications`: B2B applications with contact/business fields,
  status (`new`, `reviewing`, `approved`, `rejected`), notes, timestamps.

`server/db.js` also performs additive order-column migrations for older DBs.

## Access patterns

- New route code can use async-compatible wrappers: `db.run`, `db.get`,
  `db.all`.
- Existing code also uses prepared statements exported as `stmts`.
- Use bound parameters for user input.
- Initial admin is bootstrapped in `server/index.js` when no users exist.

## Backups

Backup logic lives in `server/backup.js`.

Backed up:
- users
- settings
- stockist applications

Not backed up:
- orders, because they contain PII and Stripe is the payment record source
- content snapshots
- password reset tokens

Backups write locally and can also sync to a private GitHub data repo through
`server/github.js` when `GITHUB_PAT` is configured.
