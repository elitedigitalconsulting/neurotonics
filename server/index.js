/**
 * Neurotonics — Checkout Backend
 *
 * Express server that creates Stripe Checkout sessions for the
 * Neurotonics static frontend (GitHub Pages).
 *
 * Stripe Checkout automatically displays Apple Pay on Safari/iOS and
 * Google Pay on Chrome/Android — no extra configuration required.
 *
 * Setup:
 *   1. cp .env.example .env
 *   2. Add your STRIPE_SECRET_KEY to .env
 *   3. Set CLIENT_ORIGINS to your frontend URL(s)
 *   4. npm install && npm start
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

// ---------------------------------------------------------------------------
// Initialise Stripe (fails fast if the secret key is missing)
// ---------------------------------------------------------------------------
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('ERROR: STRIPE_SECRET_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-03-31.basil',
});

// ---------------------------------------------------------------------------
// Allowed CORS origins
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a single cart item received from the frontend.
 * Returns true only if the item is well-formed and safe to pass to Stripe.
 */
function isValidCartItem(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.name === 'string' &&
    item.name.length > 0 &&
    item.name.length <= 200 &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    item.price < 100000 && // sanity cap: $100,000 AUD per item
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 99
  );
}

/**
 * Sanitise a product image URL: only allow absolute HTTPS URLs.
 * Returns undefined if the URL is not safe (Stripe will just show no image).
 */
function sanitiseImageUrl(url) {
  if (typeof url !== 'string') return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sanitise a success/cancel URL coming from the frontend.
 * Only accept URLs whose origin exactly matches one of the allowed client origins.
 * This prevents open-redirect attacks.
 */
function sanitiseRedirectUrl(url) {
  if (typeof url !== 'string') return undefined;
  try {
    const parsed = new URL(url);
    // Only allow HTTPS (or HTTP on localhost for local development)
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !isLocalhost) return undefined;
    // Origin must exactly match one of the configured allowed origins
    if (allowedOrigins.includes(parsed.origin)) return parsed.toString();
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// POST /create-checkout-session
// ---------------------------------------------------------------------------
app.post('/create-checkout-session', async (req, res) => {
  const { items, shipping, successUrl, cancelUrl } = req.body;

  // --- Validate cart items ---
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty or invalid.' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Cart exceeds maximum item count.' });
  }
  for (const item of items) {
    if (!isValidCartItem(item)) {
      return res.status(400).json({ error: 'One or more cart items are invalid.' });
    }
  }

  // --- Validate redirect URLs ---
  const safeSuccessUrl = sanitiseRedirectUrl(successUrl);
  const safeCancelUrl = sanitiseRedirectUrl(cancelUrl);
  if (!safeSuccessUrl || !safeCancelUrl) {
    return res.status(400).json({ error: 'Invalid success or cancel URL.' });
  }

  // --- Build Stripe line items ---
  const lineItems = items.map((item) => ({
    price_data: {
      currency: 'aud',
      product_data: {
        name: item.name,
        // Only pass images that are valid HTTPS URLs (Stripe requirement)
        ...(sanitiseImageUrl(item.image) && {
          images: [sanitiseImageUrl(item.image)],
        }),
      },
      // Stripe requires amounts in the smallest currency unit (cents)
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));

  // Add shipping as a separate line item when provided
  if (
    shipping &&
    typeof shipping.fee === 'number' &&
    Number.isFinite(shipping.fee) &&
    shipping.fee > 0
  ) {
    const zoneName =
      typeof shipping.zone === 'string' && shipping.zone.length <= 100
        ? shipping.zone
        : 'Standard';

    lineItems.push({
      price_data: {
        currency: 'aud',
        product_data: {
          name: `Delivery — ${zoneName}`,
        },
        unit_amount: Math.round(shipping.fee * 100),
      },
      quantity: 1,
    });
  }

  // --- Create Stripe Checkout session ---
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: safeSuccessUrl,
      cancel_url: safeCancelUrl,
      // Stripe Checkout automatically surfaces Apple Pay on Safari/iOS and
      // Google Pay on Chrome/Android.  'automatic_payment_methods' is the
      // recommended way to enable all eligible payment methods.
      payment_method_types: undefined, // let Stripe decide via dashboard settings
      // Collect customer email for order confirmation
      customer_creation: 'always',
      // Pass metadata for reference in the Stripe dashboard
      metadata: {
        items: JSON.stringify(items.map((i) => `${i.name} x${i.quantity}`)),
        shippingZone: shipping?.zone || 'none',
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation failed:', err);
    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '4000', 10);
app.listen(PORT, () => {
  console.log(`Neurotonics checkout server listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
