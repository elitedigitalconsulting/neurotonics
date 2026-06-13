# Project context

Neurotonics is an ecommerce site for Brain Boost 1000, a cognitive supplement.
The public storefront is a statically exported Next.js app. A separate Express
server handles checkout, CMS APIs, orders, email, images, backups, and the admin
dashboard.

## Product

- Main product: Brain Boost 1000
- Source of truth: `src/content/product.json`
- Current price: `79.90 AUD`
- Shipping config: `src/content/shipping.json`

## Main areas

- `src/app/`: Next.js App Router pages and route handlers.
- `src/components/`: storefront UI components.
- `src/lib/`: cart, checkout persistence, shipping, Stripe/base-path helpers.
- `src/content/`: CMS-editable JSON content imported at build time.
- `src/__tests__/`: Jest tests for cart, checkout, shipping, API, effects.
- `server/`: Express CMS/checkout server.
- `server/routes/`: CMS routers and Stripe webhook.
- `server/admin-ui/`: Vite React admin source.
- `server/public/admin/`: generated admin build output.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4.
- Stripe Checkout/PaymentIntent integrations.
- Express 4, Node 20, CommonJS.
- SQLite via `better-sqlite3`; no Prisma.
- CMS auth uses JWT access tokens, refresh cookie, bcrypt password hashes.
- Admin UI uses Vite, React Router, TanStack Query, React Hook Form.

## Common commands

```bash
npm run dev
npm run build
npm run lint
npm test
```

```bash
cd server
npm run dev
npm start
npm run build:admin
```

## Environment

Root `.env.example` covers public storefront values such as
`NEXT_PUBLIC_API_URL`, Stripe publishable key, Web3Forms, and Google Places.

`server/.env.example` covers Stripe secret/webhook keys, CMS JWT secrets,
admin bootstrap credentials, CORS origins, email provider settings, GitHub PAT,
and optional SQLite paths.

Never commit real secrets.
