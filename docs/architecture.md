# Architecture

## Runtime shape

```text
Customer browser
  -> GitHub Pages static Next export at /neurotonics
  -> Express server via NEXT_PUBLIC_API_URL for checkout/CMS-backed actions
  -> Stripe hosted checkout
  -> Stripe webhook back to Express
  -> SQLite orders/settings/users/stockist applications

Admin browser
  -> Express /admin built Vite SPA
  -> Express /cms/* API
  -> SQLite + src/content JSON + GitHub rebuild dispatch
```

## Storefront

- `next.config.ts` sets `output: "export"`, `basePath: "/neurotonics"`, and
  unoptimized images for GitHub Pages.
- `src/app/layout.tsx` wraps pages in `CartProvider`.
- Public routes include home, product, quiz, cart, checkout, privacy, and
  shipping/returns pages.
- JSON content in `src/content/*.json` is imported at build time.
- Cart state is in `src/lib/cart.tsx` and persists to `localStorage` key
  `neurotonics-cart`.
- Checkout and selected shipping state persist through `src/lib/checkoutState.ts`
  and `src/lib/shippingState.ts`.

## Checkout data flow

1. Product page adds Brain Boost 1000 to the client cart.
2. Cart/checkout calculate shipping with `src/lib/shipping.ts` and
   `src/content/shipping.json`.
3. Checkout posts cart, shipping, customer data, and redirect URLs to
   `POST {NEXT_PUBLIC_API_URL}/create-checkout-session`.
4. Express validates items and redirect origins, creates a Stripe Checkout
   Session, and returns `session.url`.
5. Browser redirects to Stripe.
6. Stripe redirects back to checkout success/cancel URL.
7. Stripe webhook `/stripe/webhook` creates the order and sends emails.

There are also legacy/alternate PaymentIntent handlers in the root Next API
route and Express server; current primary checkout uses Stripe Checkout.

## CMS/admin flow

- Admin SPA source: `server/admin-ui/src/`.
- Built admin assets: `server/public/admin/` (generated, ignore for context).
- API client calls `/cms/*` with bearer access token.
- Auth routes live in `server/auth.js`; protected routers use `requireAuth`.
- Admin-only routes use `requireRole("admin")`.
- CMS content/product writes update `src/content/*.json`, commit through
  `server/github.js`, and dispatch `.github/workflows/cms-rebuild.yml`.

## Deployment

- GitHub Pages: `.github/workflows/deploy.yml` builds root app to `out/`.
- CMS rebuilds: `.github/workflows/cms-rebuild.yml` runs after CMS content
  dispatch events.
- Render CMS server: `render.yaml` uses `rootDir: server`, `node index.js`,
  `/health`, and intentionally has `autoDeploy: false`.

## Files to avoid unless relevant

- `node_modules/`, `.next/`, `out/`, `dist/`, `build/`, `coverage/`
- `server/public/admin/` generated build output
- `server/data/`, SQLite files, backups, uploads
