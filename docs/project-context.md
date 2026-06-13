# Project context

## What this project is

Neurotonics is an ecommerce site for the Brain Boost 1000 cognitive supplement.
The public storefront is a statically exported Next.js application deployed to
GitHub Pages. A separate Express server handles Stripe payments, CMS APIs,
stockist applications, order storage, email notifications, image uploads, and
the admin dashboard.

The product currently sold by the storefront is:

- Name: Brain Boost 1000
- Slug: `brain-boost-1000`
- Price: `79.90 AUD`
- Supply: 60 capsules / 30-day supply
- Content source: `src/content/product.json`

## Primary audiences and workflows

### Customers

- Browse marketing content on the homepage.
- Read the product detail page.
- Add Brain Boost 1000 to a cart stored in browser `localStorage`.
- Calculate shipping based on country and Australian postcode.
- Complete checkout through Stripe Checkout.
- Return to `/checkout?success=true` after payment, where cart and checkout
  state are cleared.

### Stockist applicants

- Submit a stockist application through the public stockist form.
- Applications are stored in SQLite through the Express server and can be
  reviewed in the CMS.
- The server attempts to send an email notification after saving the
  application.

### CMS admins and editors

- Log into `/admin` on the CMS server.
- Manage orders, stockist applications, product data, site content, media,
  general settings, email templates, backups, and users.
- Content edits update JSON files under `src/content/`, commit those changes
  through the GitHub API, and trigger a GitHub Pages rebuild.

## Repository map

```text
.
+-- src/
|   +-- app/                 Next.js App Router pages and API route handlers
|   +-- components/          Storefront UI components
|   +-- content/             JSON content edited by the CMS and imported by UI
|   +-- lib/                 Cart, checkout, shipping, Stripe, base-path helpers
|   +-- __tests__/           Jest tests for cart, checkout, shipping, API logic
+-- server/
|   +-- index.js             Express server entry point
|   +-- db.js                SQLite schema, migrations, prepared statements
|   +-- auth.js              CMS JWT auth, refresh cookie, password reset routes
|   +-- backup.js            Safe CMS backup/restore logic
|   +-- github.js            GitHub content commits, dispatches, backup repo API
|   +-- email.js             Order/admin/password email helpers
|   +-- routes/              CMS and Stripe webhook route modules
|   +-- admin-ui/            Vite React source for CMS admin dashboard
|   +-- public/admin/        Built admin dashboard assets served by Express
+-- public/                  Static storefront assets
+-- .github/workflows/       GitHub Pages and CMS rebuild workflows
+-- render.yaml              Render blueprint for the CMS server
+-- next.config.ts           Static export/basePath/image config
+-- jest.config.js           Root Jest config
```

## Technology stack

### Storefront

- Next.js `16.2.2`
- React `19.2.4`
- TypeScript 5
- Tailwind CSS 4
- Stripe browser packages
- Zod 4
- Jest with `ts-jest` and `jest-environment-jsdom`

### Backend

- Node.js 20
- Express 4
- CommonJS modules
- Stripe SDK
- `better-sqlite3` with WAL mode
- JWT auth with refresh cookie
- `bcryptjs` password hashing
- `express-rate-limit`
- Nodemailer and Resend support for email
- Sharp and Multer for media uploads

### Admin UI

- Vite 8
- React 19
- TypeScript 6
- React Router 7
- TanStack Query 5
- React Hook Form
- Tailwind CSS 4

## Important commands

From repository root:

```bash
npm ci
npm run dev
npm run build
npm run lint
npm test
npm run test:coverage
```

From `server/`:

```bash
npm ci
npm run dev
npm start
npm run build:admin
```

From `server/admin-ui/`:

```bash
npm ci
npm run dev
npm run build
npm run lint
```

## Environment variables

Root/frontend examples are in `.env.example`:

- `NEXT_PUBLIC_API_URL`: public URL for the Express server.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key for browser use.
- `NEXT_PUBLIC_WEB3FORMS_KEY`: optional Web3Forms key for fallback purchase or
  stockist notifications.
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`: optional address autocomplete key.

Server examples are in `server/.env.example`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `CLIENT_ORIGINS`
- `CMS_JWT_SECRET`
- `CMS_JWT_REFRESH_SECRET`
- `ADMIN_INITIAL_EMAIL`
- `ADMIN_INITIAL_PASSWORD`
- Email provider settings (`RESEND_*` or SMTP variables)
- `GITHUB_PAT`, `GITHUB_OWNER`, `GITHUB_REPO`
- Optional `DB_PATH` and `DB_BACKUP_DIR`

Never commit real secrets.

## Testing and validation

Automated test coverage currently focuses on:

- Cart state, persistence, totals, and edge cases.
- Shipping zone selection and option calculation.
- Checkout form validation and total calculation.
- Next API payment intent route behavior with mocked Stripe.
- Scroll/3D effect behavior.

The manual validation guide in `TESTING.md` documents ecommerce flows, payment
test cards, wallet-payment checks, and browser-console cart tests.

## Operational assumptions

- The storefront is deployed with `basePath: "/neurotonics"` and `output:
  "export"`; static-export constraints apply to public pages.
- The CMS server is the authoritative runtime integration point for checkout,
  orders, stockist applications, CMS data, backups, and emails.
- Render `autoDeploy` is intentionally disabled. Server deploys are triggered
  manually or by the workflow when `server/` files change.
- Content edits made through the CMS commit JSON changes back to GitHub and
  trigger a Pages rebuild.
- SQLite data is local to the CMS server unless `DB_PATH` points at persistent
  storage. Safe CMS data is also backed up locally and optionally to a private
  GitHub data repository.

