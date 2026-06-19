# Current state

## Summary

The repository currently implements a complete Neurotonics storefront plus a
separate CMS/commerce server. The public site is designed for static deployment
to GitHub Pages, while the CMS server is designed for Render. The codebase also
contains automated tests for the highest-risk storefront logic.

## Implemented storefront features

- Static Next.js storefront with App Router pages.
- SEO metadata, Open Graph data, Twitter card data, robots settings, canonical
  URL, and JSON-LD on the homepage.
- Product page for Brain Boost 1000.
- Homepage with hero, trust/product sections, quiz CTA, and stockist CTA.
- Cart with add, remove, quantity update, subtotal, and `localStorage`
  persistence.
- Cart shipping calculator with Australian postcode handling and international
  options.
- Checkout form with contact/address validation, delivery options, free
  shipping threshold, persisted form state, and order summary.
- Stripe Checkout session creation through the Express server.
- Success handling through `/success?success=true&session_id=...`; cancellation
  handling through `/checkout?canceled=true`.
- Optional Web3Forms fallback notification logic after success redirects.
- Static pages for quiz, product, cart, checkout, shipping/returns, and privacy
  policy.

## Implemented backend features

- Express server in `server/index.js`.
- CORS allow-list based on `CLIENT_ORIGINS`.
- Stripe Checkout Session endpoint at `/create-checkout-session`.
- PaymentIntent endpoint at `/create-payment-intent`.
- Stripe webhook route at `/stripe/webhook`.
- Order creation from Stripe Checkout and PaymentIntent webhook events.
- Manual Stripe session sync for admins at `/cms/orders/sync-stripe`.
- Stockist application endpoint at `/stockist-application`.
- Health and diagnostics endpoints:
  - `/health`
  - `/stripe-config`
  - `/stripe-health`
  - `/email-status`
- CMS API under `/cms/*`.
- Static serving for uploaded images at `/images`.
- Static serving for admin SPA at `/admin`.

## Implemented CMS/admin features

The Vite admin UI includes pages for:

- Dashboard and recent order stats.
- Orders list/detail, status updates, notes, and fulfillment.
- Stockist application list/detail, status updates, notes, CSV export, and
  backup status hints.
- Product management backed by `src/content/product.json`.
- Site content editing backed by `src/content/site.json`.
- Media library backed by `/cms/images`.
- Settings, backup/restore, and email templates.
- Admin-only user management.
- Login, logout, refresh, registration, forgot password, and reset password.

## Implemented database and backup features

- SQLite schema is created on server startup.
- Existing order tables are migrated with safe additive column checks.
- Initial admin is bootstrapped when no users exist.
- Safe CMS data backups include users, settings, and stockist applications.
- Backups are written locally and optionally to a private GitHub data repo.
- Startup restore attempts GitHub backup first and local backup second.
- Orders are intentionally excluded from backups because they contain PII.

## Deployment state

### GitHub Pages

`.github/workflows/deploy.yml`:

- Runs on pushes to `main` and manual dispatch.
- Uses Node 20.
- Installs root dependencies with `npm ci`.
- Builds the static Next export with build-time public env vars.
- Uploads `out/` to GitHub Pages.
- Adds `out/.nojekyll`.
- Can trigger Render redeploy when files under `server/` changed and
  `RENDER_DEPLOY_HOOK_URL` is set.

### CMS content rebuild

`.github/workflows/cms-rebuild.yml`:

- Runs on `repository_dispatch` with type `cms-content-update` and manual
  dispatch.
- Rebuilds and redeploys the static site from committed content JSON changes.

### Render

`render.yaml`:

- Defines web service `neurotonics-cms`.
- Uses `rootDir: server`.
- Uses Node 20.
- Rebuilds `better-sqlite3`.
- Attempts to build the admin UI.
- Starts with `node index.js`.
- Health check path is `/health`.
- Keeps `autoDeploy: false` intentionally.

## Tests present

Automated tests live under `src/__tests__/`:

- `cart.test.ts`
- `shipping.test.ts`
- `checkout.test.ts`
- `api-create-payment-intent.test.ts`
- `scroll-3d-effect.test.ts`

Root test command:

```bash
npm test
```

The Jest config collects coverage from `src/lib/**/*.{ts,tsx}` and
`src/app/api/**/*.ts`.

## Known caveats and watch areas

- The repository rule says to read `node_modules/next/dist/docs/` before editing
  Next.js code. In a fresh checkout, dependencies may not be installed yet, so
  `node_modules/` may be absent until `npm ci` is run.
- Hosted Stripe Checkout is the primary customer payment flow. Legacy or
  alternate PaymentIntent routes remain in the codebase, but the current
  checkout client posts to the Express `/create-checkout-session` endpoint.
- The root Next API route at `src/app/api/create-payment-intent/route.ts`
  creates PaymentIntents from a client-supplied amount after Zod validation. The
  Express `/create-payment-intent` route has stronger catalog-based amount
  validation and is safer for production server-side totals.
- `server/routes/stripe-webhook.js` reduces stock by editing
  `src/content/product.json` on the server filesystem. In production this
  affects the server copy and may need a content commit/rebuild path if stock
  should be reflected on the static storefront.
- `server/public/admin/assets/*` are built artifacts. Source changes should be
  made in `server/admin-ui/src/` and rebuilt.
- Render free-tier storage can be ephemeral across redeploys. Use `/data` or
  `DB_PATH` for persistent SQLite storage if production data must survive
  redeploys without relying on safe backups.
- The server defaults JWT secrets to development placeholders if env vars are
  missing. Production must provide strong `CMS_JWT_SECRET` and
  `CMS_JWT_REFRESH_SECRET`.
- Real Stripe, email, GitHub PAT, and API keys must be configured outside the
  repository. Example files contain placeholders only.

## Fresh-checkout validation

Recommended validation sequence:

```bash
npm ci
npm test
npm run lint
npm run build
```

For backend/admin validation:

```bash
cd server
npm ci
npm run build:admin
npm start
```

Then check:

- `GET http://localhost:4000/health`
- `GET http://localhost:4000/admin`
- `GET http://localhost:4000/email-status`
- Stripe test checkout with test keys and a webhook configured.

## Current content snapshot

Important editable content files:

- `src/content/site.json`: brand, homepage, navigation, footer, stockist copy.
- `src/content/product.json`: Brain Boost 1000 product data, price, images,
  badges, ingredients, FAQ, stock fields.
- `src/content/quiz.json`: quiz questions and recommendations.
- `src/content/shipping.json`: free-shipping threshold, express and
  international rates, postcode zones, default shipping fallback.

Current product stock fields in `src/content/product.json`:

- `stockPercent`: `70`
- `unitsLeft`: `47`
