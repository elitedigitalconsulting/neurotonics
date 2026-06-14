# System context

This file is the single source of truth for Cursor agents working on
Neurotonics. Read it before inspecting the codebase. Do not re-infer stack or
architecture unless this file is clearly stale.

## Stack from codebase

- Storefront: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- Deployment: static export to GitHub Pages with `basePath: "/neurotonics"`.
- Ecommerce: Stripe Checkout is the primary flow; PaymentIntent routes also
  exist.
- Server: Node 20, Express 4, CommonJS, Stripe SDK, email, CMS REST API.
- Database: SQLite via `better-sqlite3` in `server/db.js`; no Prisma schema.
- Auth: custom CMS JWT access tokens, refresh cookie, bcrypt passwords in
  `server/auth.js`; no NextAuth found.
- Admin UI: Vite React app in `server/admin-ui/`, built to
  `server/public/admin/`.

## Architecture and data flow

Current production flow is UI -> Express server -> Stripe/SQLite, not Server
Actions -> DB.

```text
Next static UI (src/app, src/components)
  -> browser state (src/lib/cart.tsx, checkout/shipping localStorage)
  -> NEXT_PUBLIC_API_URL
  -> Express routes in server/index.js and server/routes/*
  -> Stripe Checkout / webhook
  -> SQLite tables created in server/db.js
  -> CMS admin UI served from /admin
```

Content flow:

```text
CMS admin UI
  -> /cms/* Express API
  -> src/content/*.json writes
  -> GitHub commit + repository_dispatch
  -> GitHub Pages rebuild
```

## Important folders

- `src/app/`: App Router pages and a small set of route handlers.
- `src/components/`: storefront UI.
- `src/lib/`: cart, shipping, checkout persistence, Stripe/base-path helpers.
- `src/content/`: build-time JSON content edited by CMS.
- `server/`: Express checkout/CMS server and SQLite database layer.
- `server/routes/`: CMS modules and Stripe webhook.
- `server/admin-ui/src/`: admin dashboard source.
- `server/public/admin/`: generated admin build output; avoid editing directly.

## Core principles

- Respect Next static export constraints. Do not introduce server-only Next
  features unless deployment changes with it.
- Prefer Server Actions only if applicable to a future non-static Next flow.
  Today, reuse existing Express endpoints for mutations.
- Keep payment authority server-side. Validate products, totals, redirects, and
  webhook signatures.
- Reuse existing CMS auth middleware and DB helpers.
- Keep edits minimal and task-focused.
- Do not scan dependency/generated/runtime folders for context.

## Commands

Root:
```bash
npm run dev
npm run build
npm run lint
npm test
```

Server:
```bash
cd server
npm run dev
npm start
npm run build:admin
```
