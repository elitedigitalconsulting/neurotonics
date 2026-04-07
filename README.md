# Neurotonics — E-Commerce Store

A modern e-commerce store for **Neurotonics Brain Boost 1000**, a natural cognitive supplement. Built with the latest web technologies for performance, SEO, and developer experience.

## Tech Stack

- **Next.js 16** (App Router, static export) — SEO-optimized GitHub Pages deployment
- **React 19** — Latest component-driven UI
- **TypeScript 5** — Type safety throughout
- **Tailwind CSS 4** — Utility-first styling
- **Stripe Checkout** — Hosted payment page (cards, Apple Pay, Google Pay)
- **Node.js + Express** — Standalone checkout backend
- **Zod 4** — Runtime API validation

## Features

- 🧠 **Product page** for Brain Boost 1000 ($79.90 AUD)
- 🧪 **Interactive quiz** to recommend the right solution
- 🚚 **Delivery fee calculator** based on Australian postcodes
- 💳 **Stripe Checkout** — Hosted payment page with Apple Pay & Google Pay
- 🛒 **Shopping cart** with localStorage persistence
- 📱 **Fully responsive** design for all devices
- 🔍 **SEO optimized** with metadata, Open Graph, and JSON-LD structured data
- ✏️ **CMS (Content Management System)** — edit content without coding

## Architecture

```
GitHub Pages (static)          Express Server (any host)
┌─────────────────────┐        ┌──────────────────────────┐
│  Next.js frontend   │  POST  │  /create-checkout-session│
│  (static export)    │ ─────► │  Creates Stripe session  │
│                     │        │  Returns { url }         │
│  cart + checkout UI │        └──────────────────────────┘
└─────────────────────┘                  │
          │                              │ session.url
          │◄─────────────────────────────┘
          │ redirect to stripe.com
          ▼
  ┌──────────────┐
  │ Stripe       │  ← Apple Pay, Google Pay, Card
  │ Checkout     │    fully hosted & PCI compliant
  └──────────────┘
          │
          │ success_url / cancel_url redirect
          ▼
  GitHub Pages success/cancel page
```

## Content Management System (CMS)

All site content is stored in JSON files under `src/content/`. You can edit text, images, and data by modifying these files — **no coding required**.

### Editable Content Files

| File | What it controls |
|------|-----------------|
| `src/content/site.json` | Brand name, tagline, navigation, hero section, features, benefits, testimonials, footer |
| `src/content/product.json` | Product name, price, description, images, badges, ingredients, FAQ |
| `src/content/quiz.json` | Quiz questions, options, and result recommendations |
| `src/content/shipping.json` | Shipping zones, fees, postcodes, and delivery estimates |

---

## Quick Start (local development)

You need **two terminal windows** — one for the frontend and one for the backend.

### Prerequisites
- Node.js 18+
- npm 9+
- A [Stripe account](https://dashboard.stripe.com)

### 1 — Frontend (Next.js)

```bash
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

`.env.local` is created automatically from `.env.example` during install. Update it:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 2 — Backend (Express checkout server)

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
CLIENT_ORIGINS=http://localhost:3000
PORT=4000
```

Then start the server:

```bash
npm run dev   # uses node --watch for auto-restart
```

### 3 — Test the checkout

1. Add Brain Boost 1000 to your cart
2. Proceed to checkout
3. Click **Pay** — you'll be redirected to Stripe's hosted checkout page
4. Use Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC)
5. On success you'll be redirected back to the confirmation page

---

## Production Deployment

### Frontend — GitHub Pages

The frontend is a static Next.js export deployed via GitHub Actions (`.github/workflows/deploy.yml`). Push to `main` to trigger a deploy.

Before deploying, set the GitHub Actions secret / environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your deployed backend URL, e.g. `https://your-server.onrender.com` |

Update `NEXT_PUBLIC_API_URL` in your GitHub repository → **Settings → Secrets and variables → Actions**.

### Backend — Express server

You can host the Express server on any Node.js platform. Below are two popular free options.

#### Option A — Render.com (recommended)

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo and set **Root Directory** to `server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in the Render dashboard:
   - `STRIPE_SECRET_KEY` = `sk_live_...`
   - `CLIENT_ORIGINS` = `https://elitedigitalconsulting.github.io`
   - `PORT` = `4000` (Render overrides this automatically)

#### Option B — Railway.app

1. New project → **Deploy from GitHub repo**
2. Select your repo, set **Root Directory** to `server`
3. Add the same environment variables as above

#### Option C — Any VPS / cloud (EC2, DO, etc.)

```bash
cd server
npm install --production
# Set env vars then:
node index.js
```

Use a process manager like PM2 for production:

```bash
npm install -g pm2
pm2 start index.js --name neurotonics-server
pm2 save
```

---

## Stripe Configuration

### Test vs Live keys

| Environment | Key prefix | Where to get |
|-------------|------------|-------------|
| Test | `sk_test_` / `pk_test_` | Stripe Dashboard → Developers → API keys |
| Live | `sk_live_` / `pk_live_` | Stripe Dashboard → Developers → API keys |

Use test keys for development/staging. Only use live keys in production.

### Apple Pay

**No domain verification is required** when using Stripe Checkout (the hosted page).
The payment page is served from `stripe.com`, which is already Apple-verified.

Apple Pay appears automatically when:
- The customer is on Safari (macOS or iOS)
- They have a card saved in Apple Wallet / iCloud Keychain

If you ever switch to Stripe.js embedded elements on your own domain, you will need to:
1. Go to Stripe Dashboard → Settings → Payment methods → Apple Pay
2. Register your domain (e.g. `elitedigitalconsulting.github.io`)
3. Download the domain association file and serve it at  
   `/.well-known/apple-developer-merchantid-domain-association`

### Google Pay

Google Pay appears automatically when:
- The customer is on Chrome (desktop or Android)
- They have a card saved in Google Pay / Chrome

No extra configuration is needed — Stripe handles everything.

### Enabling additional payment methods

In the [Stripe Dashboard → Settings → Payment methods](https://dashboard.stripe.com/settings/payment_methods), you can enable:
- **Afterpay / Clearpay** — buy now, pay later
- **Klarna** — buy now, pay later
- **BECS Direct Debit** — Australian bank transfers
- **Stripe Link** — one-click checkout for returning customers

Once enabled in the dashboard they will appear automatically in the Stripe Checkout page.

---

## Project Structure

```
├── server/                   # Standalone Express checkout backend
│   ├── index.js              # /create-checkout-session endpoint
│   ├── package.json
│   └── .env.example
│
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── calculate-shipping/  # Shipping fee API (local dev only)
    │   │   └── create-payment-intent/  # Legacy payment intent route
    │   ├── cart/             # Shopping cart page
    │   ├── checkout/         # Checkout + success + cancel pages
    │   ├── product/          # Product detail page
    │   ├── quiz/             # Recommendation quiz
    │   ├── globals.css       # Global styles
    │   ├── layout.tsx        # Root layout
    │   └── page.tsx          # Homepage
    ├── components/
    │   ├── Header.tsx        # Site header/navigation (cart badge)
    │   └── Footer.tsx        # Site footer
    ├── content/              # CMS content files (edit these!)
    │   ├── site.json
    │   ├── product.json
    │   ├── quiz.json
    │   └── shipping.json
    └── lib/
        ├── cart.tsx          # Cart state management (localStorage)
        ├── shipping.ts       # Shipping calculation logic (client-side)
        └── stripe.ts         # Stripe client setup
```

## Add to Cart — How it works

The cart is implemented as a React context (`src/lib/cart.tsx`) backed by `localStorage`:

- **Adding items** — `ProductClient.tsx` calls `addItem()` which updates the module-level store and persists to `localStorage`
- **Cart badge** — `Header.tsx` reads `totalItems` from the cart context; updates in real time
- **Cart page** — `/cart` shows all items with quantity selectors and a remove button
- **Persistence** — cart survives page refreshes and navigation (stored under `neurotonics-cart` key)

## Payment Flow

1. User adds item → cart page → clicks **Proceed to Checkout**
2. Checkout page loads the order summary (shipping calculated client-side from postcode)
3. User clicks **Pay $XX AUD** → frontend POSTs cart to `NEXT_PUBLIC_API_URL/create-checkout-session`
4. Server creates a Stripe Checkout Session and returns `{ url }`
5. Browser is redirected to `url` (hosted on stripe.com)
6. Payment is completed on Stripe's PCI-compliant page
7. On success: Stripe redirects to `/checkout?success=true` → cart is cleared
8. On cancel: Stripe redirects to `/checkout?canceled=true` → user can retry

## License

Apache License 2.0
