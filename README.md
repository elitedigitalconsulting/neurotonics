# Neurotonics — E-Commerce Store

A modern e-commerce store for **Neurotonics Brain Boost 1000**, a natural cognitive supplement. Built with the latest web technologies for performance, SEO, and developer experience.

## Tech Stack

- **Next.js 16** (App Router) — SSR/SSG, SEO-optimized
- **React 19** — Latest component-driven UI
- **TypeScript 5** — Type safety throughout
- **Tailwind CSS 4** — Utility-first styling
- **Stripe** — Payment processing (cards, Apple Pay, Google Pay)
- **Zod 4** — Runtime API validation

## Features

- 🧠 **Product page** for Brain Boost 1000 ($79.90 AUD)
- 🧪 **Interactive quiz** to recommend the right solution
- 🚚 **Delivery fee calculator** based on Australian postcodes
- 💳 **Stripe Checkout** with Apple Pay & Google Pay
- 🛒 **Shopping cart** with localStorage persistence
- 📱 **Fully responsive** design for all devices
- 🔍 **SEO optimized** with metadata, Open Graph, and JSON-LD structured data
- ✏️ **CMS (Content Management System)** — edit content without coding

## Content Management System (CMS)

All site content is stored in JSON files under `src/content/`. You can edit text, images, and data by modifying these files — **no coding required**.

### Editable Content Files

| File | What it controls |
|------|-----------------|
| `src/content/site.json` | Brand name, tagline, navigation, hero section, features, benefits, testimonials, footer |
| `src/content/product.json` | Product name, price, description, images, badges, ingredients, FAQ |
| `src/content/quiz.json` | Quiz questions, options, and result recommendations |
| `src/content/shipping.json` | Shipping zones, fees, postcodes, and delivery estimates |

### How to Update Content

1. Open the relevant JSON file in `src/content/`
2. Edit the text, images, or data as needed
3. Save the file
4. Rebuild or redeploy the site

**Example — Change the product price:**
```json
// src/content/product.json
{
  "price": 89.90,  // Change this value
  ...
}
```

**Example — Add a new testimonial:**
```json
// src/content/site.json → testimonials array
{
  "name": "New Customer",
  "location": "Perth, WA",
  "rating": 5,
  "text": "Your review text here..."
}
```

**Example — Update images:**
Replace image files in `public/images/` and update the paths in the JSON files.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Environment Variables

Copy the example env file and add your Stripe keys:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here
STRIPE_SECRET_KEY=sk_live_your_key_here
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── calculate-shipping/  # Shipping fee API
│   │   └── create-payment-intent/  # Stripe payment API
│   ├── cart/           # Shopping cart page
│   ├── checkout/       # Stripe checkout page
│   ├── product/        # Product detail page
│   ├── quiz/           # Recommendation quiz
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Homepage
├── components/
│   ├── Header.tsx      # Site header/navigation
│   └── Footer.tsx      # Site footer
├── content/            # CMS content files (edit these!)
│   ├── site.json
│   ├── product.json
│   ├── quiz.json
│   └── shipping.json
└── lib/
    ├── cart.tsx         # Cart state management
    ├── shipping.ts     # Shipping calculation logic
    └── stripe.ts       # Stripe client setup
```

## Payment Integration

Stripe is configured with `automatic_payment_methods` enabled, which supports:
- Credit/Debit cards
- Apple Pay
- Google Pay
- And other local payment methods

To enable Apple Pay and Google Pay:
1. Set up your Stripe account at [stripe.com](https://stripe.com)
2. Register your domain in the Stripe Dashboard → Settings → Payment Methods
3. Add your live API keys to `.env.local`

## Deployment

Optimized for deployment on [Vercel](https://vercel.com):

```bash
npm run build
```

Add your environment variables in the Vercel dashboard.

## License

Apache License 2.0
