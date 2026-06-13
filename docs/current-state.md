# Current state

## Implemented

- Static Next.js storefront for Neurotonics.
- Product, quiz, cart, checkout, shipping/returns, and privacy pages.
- Cart persistence in browser `localStorage`.
- Shipping rules for AU postcode zones, free shipping threshold, express, and
  international delivery.
- Stripe Checkout endpoint in Express at `/create-checkout-session`.
- Alternate PaymentIntent handlers in both Next API and Express.
- Stripe webhook order creation in `server/routes/stripe-webhook.js`.
- Express CMS API under `/cms/*`.
- CMS auth with JWT access token, refresh cookie, password reset, bcrypt.
- SQLite schema for users, orders, settings, snapshots, password reset tokens,
  and stockist applications.
- Vite admin dashboard for dashboard, orders, stockist apps, products, content,
  media, settings/backups/templates, and users.
- GitHub Pages deploy workflow and CMS content rebuild workflow.
- Render blueprint for the CMS server.
- Jest tests for cart, checkout, shipping, payment-intent API, and effects.

## Missing or not fully proven from code

- No Prisma schema; database docs must follow `server/db.js`.
- No end-to-end/browser test runner is configured in package scripts.
- No checked-in migration system beyond startup SQL and additive column checks.
- Root Next PaymentIntent route trusts a client-supplied amount more than the
  Express PaymentIntent route; prefer Express for production payment totals.
- Webhook stock reduction edits `src/content/product.json` on the server
  filesystem; it does not clearly publish that inventory change back to the
  static GitHub Pages build.
- Production persistence depends on Render `/data` or `DB_PATH`; otherwise safe
  CMS backup/restore mitigates only selected tables.

## Validation commands

```bash
npm test
npm run lint
npm run build
```

```bash
cd server
npm run build:admin
npm start
```

## High-risk files

- Payments: `server/index.js`, `server/routes/stripe-webhook.js`,
  `src/app/checkout/CheckoutClient.tsx`
- Cart/shipping: `src/lib/cart.tsx`, `src/lib/shipping.ts`,
  `src/content/shipping.json`
- Database/auth: `server/db.js`, `server/auth.js`
- CMS content publishing: `server/routes/cms-content.js`,
  `server/routes/cms-products.js`, `server/github.js`
