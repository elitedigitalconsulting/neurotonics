# Architecture

## System overview

Neurotonics is split into three deployable/runtime surfaces:

1. A statically exported Next.js storefront under `src/`, deployed to GitHub
   Pages.
2. A Node/Express CMS and commerce server under `server/`, deployed as a Render
   web service.
3. A Vite React admin dashboard under `server/admin-ui/`, built into
   `server/public/admin/` and served by the Express server at `/admin`.

```text
Customer browser
  |
  | static pages/assets
  v
GitHub Pages: Next.js export at /neurotonics
  |
  | fetch NEXT_PUBLIC_API_URL
  v
Render: Express CMS/checkout server
  |
  | Stripe API + webhook
  v
Stripe

Admin browser
  |
  | /admin + /cms/*
  v
Render: Express server + built Vite admin SPA
  |
  | SQLite, files, GitHub API, email provider
  v
CMS data and publishing integrations
```

## Storefront architecture

The storefront uses the Next.js App Router and static export:

- `next.config.ts` sets `output: "export"`.
- `basePath` and `NEXT_PUBLIC_BASE_PATH` are both `/neurotonics`.
- `images.unoptimized` is enabled for static hosting.
- `src/app/layout.tsx` defines global metadata, imports global CSS, and wraps
  the app in `CartProvider`.
- Public pages live in `src/app/*/page.tsx`.
- Interactive page bodies live in client components such as
  `CartClient.tsx`, `CheckoutClient.tsx`, `ProductClient.tsx`,
  `QuizClient.tsx`, and `ShippingReturnsClient.tsx`.

Important storefront data flow:

- JSON content is imported from `src/content/*.json` at build time.
- Cart state is kept in a module-level external store in `src/lib/cart.tsx` and
  persisted to `localStorage` under `neurotonics-cart`.
- Checkout form state is persisted through `src/lib/checkoutState.ts`.
- Selected shipping state is persisted through `src/lib/shippingState.ts`.
- `src/lib/basePath.ts` helps asset paths work correctly under the GitHub Pages
  base path.

Because the storefront is statically exported, production user actions that need
server-side behavior call the Express server through `NEXT_PUBLIC_API_URL`.

## Checkout and payments

The primary checkout flow is Stripe Checkout through the Express server:

1. Customer adds items to the cart.
2. Checkout form validates contact, address, and selected delivery option in
   `src/app/checkout/CheckoutClient.tsx`.
3. Browser posts cart, shipping, customer details, and safe redirect URLs to
   `POST {NEXT_PUBLIC_API_URL}/create-checkout-session`.
4. `server/index.js` validates cart item shape, validates redirect URL origins,
   sanitizes metadata, builds Stripe line items, and creates a Checkout Session.
5. Browser redirects to the returned Stripe-hosted session URL.
6. Stripe redirects back to `/success?success=true&session_id=...` or
   `/checkout?canceled=true`.
7. The `/success` page reuses `CheckoutClient` to show a confirmation snapshot
   from local cart, checkout, and shipping state, then clears those
   `localStorage` values. If server email is not configured, optional Web3Forms
   purchase notification logic can run.
8. Stripe sends `checkout.session.completed` to `/stripe/webhook`; the webhook
   creates an order row, reduces stock in `src/content/product.json`, and sends
   order/admin emails.

There is also a legacy or alternate PaymentIntent path:

- Next route: `src/app/api/create-payment-intent/route.ts`
- Express route: `POST /create-payment-intent`
- Webhook support: `payment_intent.succeeded` and `payment_intent.payment_failed`

The Express PaymentIntent route has stronger server-side catalog validation than
the Next route and computes totals from the authorized product catalog.

## Shipping architecture

Shipping data is stored in `src/content/shipping.json`.

`src/lib/shipping.ts` provides:

- `calculateShipping(postcode)`: finds the most specific Australian postcode
  zone.
- `getShippingOptions(postcode, country, subtotal)`: returns free, standard,
  express, or international options.
- `getDefaultShippingOption(...)`: returns the recommended option.

Rules currently implemented:

- Australian orders under the free-shipping threshold receive standard and
  express options.
- Australian orders at or above the threshold receive free shipping plus paid
  alternatives.
- International orders receive a flat international standard option.
- Unknown Australian postcodes fall back to the default shipping fee and
  estimated delivery time.

## CMS server architecture

`server/index.js` creates the Express application and wires major subsystems:

- Environment loading with `dotenv`.
- SQLite initialization and first-admin bootstrap.
- GitHub/local backup restore on startup.
- Stripe SDK initialization if `STRIPE_SECRET_KEY` is present.
- CORS based on `CLIENT_ORIGINS` plus the server's own Render URL.
- Cookie parsing.
- Stripe webhook route before JSON parsing.
- JSON body parsing after the webhook route.
- CMS API routers under `/cms/*`.
- Static images under `/images`.
- Built admin SPA under `/admin`.
- Public commerce endpoints such as `/create-checkout-session`,
  `/create-payment-intent`, `/stockist-application`, `/health`,
  `/stripe-config`, `/stripe-health`, and `/email-status`.

Authentication is handled in `server/auth.js`:

- Passwords are hashed with bcrypt.
- Access tokens are JWT bearer tokens.
- Refresh tokens are JWTs stored in an HTTP-only cookie scoped to `/cms/auth`.
- Admin-only routes use `requireRole("admin")`.
- Password reset tokens are stored in SQLite.

Rate limiting:

- General CMS routes use `cmsRateLimiter` from `server/middleware.js`.
- Login, registration, and password reset routes have tighter route-specific
  limiters.

## CMS API modules

CMS routes live in `server/routes/`:

- `cms-content.js`: reads/writes site content JSON.
- `cms-products.js`: manages product JSON and triggers content rebuilds.
- `cms-orders.js`: lists, filters, updates, fulfills, and annotates orders.
- `cms-settings.js`: edits settings and email templates; can send test email.
- `cms-users.js`: admin-only user management.
- `cms-images.js`: image upload/list/delete.
- `cms-stockist.js`: stockist application review and CSV export.
- `cms-backup.js`: backup status, download, restore, and GitHub backup actions.
- `stripe-webhook.js`: Stripe event processing and order creation.

Most CMS writes either update SQLite, write content JSON, trigger a backup, or
commit content changes back to GitHub.

## Order and notification lifecycle

The success redirect is customer-facing only; order persistence is webhook-led:

1. `POST /create-checkout-session` creates the Stripe Checkout Session with
   sanitized customer/address metadata, allowed redirect URLs, and dynamic
   payment methods managed by Stripe Dashboard settings.
2. `/stripe/webhook` verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET`
   in production before processing events.
3. `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   use the Checkout Session id as the idempotency key in `orders.stripe_session_id`.
4. The webhook reconstructs items from metadata or Stripe line items, captures
   Stripe shipping/customer details, assigns the next `ORD-...` order number,
   inserts a paid `processing` order, and reduces product inventory.
5. `server/email.js` sends the customer order confirmation and admin alert via
   Resend when `RESEND_API_KEY` is set, otherwise SMTP when `EMAIL_USER` and
   `EMAIL_PASS` are set.

The alternate PaymentIntent path is retained for compatibility. Its webhook
handlers create orders for standalone `payment_intent.succeeded` events and
failed records for `payment_intent.payment_failed`, but the storefront checkout
button uses hosted Checkout Sessions.

## Admin dashboard architecture

The admin UI is a Vite React app in `server/admin-ui/`.

Key pieces:

- `src/App.tsx`: route definitions and protected layout.
- `src/AuthContext.tsx`: login state and token refresh.
- `src/api.ts`: fetch wrapper with bearer token injection.
- `src/components/Sidebar.tsx`: dashboard navigation.
- `src/pages/*`: dashboard, orders, stockist applications, products, content,
  media, settings, users, login, account creation, and password reset pages.

In production, the built files are served from `server/public/admin/`. The
Express server provides an `/admin/*` fallback to `index.html` for client-side
routing.

## Content publishing architecture

CMS-editable content lives in:

- `src/content/site.json`
- `src/content/product.json`
- `src/content/quiz.json`
- `src/content/shipping.json`

For product/content writes, server route modules use GitHub helpers in
`server/github.js` to:

1. Commit the updated JSON file to the main repository.
2. Trigger a `repository_dispatch` event of type `cms-content-update`.
3. Run `.github/workflows/cms-rebuild.yml`.
4. Rebuild and redeploy the static GitHub Pages site.

The main deploy workflow `.github/workflows/deploy.yml` also deploys the
storefront on pushes to `main` and can trigger a Render deploy hook when
`server/` files change.

## Deployment architecture

### GitHub Pages

- Source: root Next app.
- Build command: `npm run build`.
- Output: `out/`.
- Workflow: `.github/workflows/deploy.yml`.
- Base path: `/neurotonics`.

### Render CMS server

- Source: `server/`.
- Blueprint: `render.yaml`.
- Build command:
  `npm install && npm rebuild better-sqlite3 && (npm run build:admin || echo "...")`
- Start command: `node index.js`.
- Health check: `/health`.
- `autoDeploy: false` is intentional to avoid redeploying on CMS content saves.

## Security boundaries

- Stripe secret keys stay on the server.
- Stripe webhook signature verification requires raw request bodies.
- Checkout redirects are accepted only when their origin is in `CLIENT_ORIGINS`.
- The `/success` page is not an order authority; webhook delivery is required
  for CMS orders, stock reduction, and transactional email.
- CMS access requires JWT bearer auth; admin-only routes check role.
- Refresh tokens are HTTP-only cookies.
- CMS route traffic is rate-limited.
- Backups intentionally exclude orders, content snapshots, and reset tokens.
- Uploaded images should go through the CMS image route rather than arbitrary
  static file writes.
