/**
 * Neurotonics — Backend Server
 *
 * Express server that handles:
 *   - Stripe Checkout sessions for the Neurotonics static frontend (GitHub Pages)
 *   - Stockist application form submissions (sends email via SMTP)
 *   - CMS REST API (/cms/*) for the admin dashboard
 *   - Admin SPA served at /admin
 *
 * Stripe Checkout automatically displays Apple Pay on Safari/iOS and
 * Google Pay on Chrome/Android — no extra configuration required.
 *
 * Setup:
 *   1. cp .env.example .env
 *   2. Add your STRIPE_SECRET_KEY to .env
 *   3. Add your SMTP email credentials to .env (EMAIL_HOST, EMAIL_USER, EMAIL_PASS)
 *   4. Set CLIENT_ORIGINS to your frontend URL(s)
 *   5. Set CMS_JWT_SECRET and CMS_JWT_REFRESH_SECRET
 *   6. npm install && npm start
 */

'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Bootstrap first admin user (from env) if no users exist yet
// ---------------------------------------------------------------------------
const { db: _db, stmts: _stmts } = require('./db');
const { hashPassword } = require('./auth');
(async () => {
  const userCount = _db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const email    = process.env.ADMIN_INITIAL_EMAIL    || 'admin@neurotonics.com.au';
    const password = process.env.ADMIN_INITIAL_PASSWORD || 'changeme123';
    const hash = await hashPassword(password);
    _stmts.createUser.run(email, hash, 'admin', 'Administrator');
    console.log(`[bootstrap] Initial admin created: ${email}`);
  }
})().catch(console.error);

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

// Also allow the server's own origin so that the admin UI (served from the
// same host) can make API calls without a CORS error.  Render automatically
// sets RENDER_EXTERNAL_URL; SERVER_URL can be used as a fallback.
const selfOrigin = (process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || '').replace(/\/$/, '');
if (selfOrigin && !allowedOrigins.includes(selfOrigin)) {
  allowedOrigins.push(selfOrigin);
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// Cookie parser must come before routes that use cookies (e.g. auth refresh)
app.use(cookieParser());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Stripe webhook route MUST come before express.json() because it needs
// the raw request body for signature verification.
// ---------------------------------------------------------------------------
const stripeWebhookRouter = require('./routes/stripe-webhook');
app.use('/stripe/webhook', stripeWebhookRouter);

app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// CMS Routes (authentication required)
// ---------------------------------------------------------------------------
const { cmsRateLimiter } = require('./middleware');
const { router: authRouter } = require('./auth');
const cmsContentRouter   = require('./routes/cms-content');
const cmsProductsRouter  = require('./routes/cms-products');
const cmsOrdersRouter    = require('./routes/cms-orders');
const cmsSettingsRouter  = require('./routes/cms-settings');
const cmsUsersRouter     = require('./routes/cms-users');
const cmsImagesRouter    = require('./routes/cms-images');

// Apply general rate limit to all CMS API routes
app.use('/cms', cmsRateLimiter);

app.use('/cms/auth',     authRouter);
app.use('/cms/content',  cmsContentRouter);
app.use('/cms/products', cmsProductsRouter);
app.use('/cms/orders',   cmsOrdersRouter);
app.use('/cms/settings', cmsSettingsRouter);
app.use('/cms/users',    cmsUsersRouter);
app.use('/cms/images',   cmsImagesRouter);

// ---------------------------------------------------------------------------
// Serve uploaded images statically
// ---------------------------------------------------------------------------
const IMAGES_DIR = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
app.use('/images', express.static(IMAGES_DIR));

// ---------------------------------------------------------------------------
// Serve the Admin SPA at /admin
// ---------------------------------------------------------------------------
const ADMIN_DIST = path.join(__dirname, 'public', 'admin');
if (fs.existsSync(ADMIN_DIST)) {
  app.use('/admin', cmsRateLimiter, express.static(ADMIN_DIST));
  // Client-side routing fallback
  app.get('/admin/*path', cmsRateLimiter, (_req, res) => {
    res.sendFile(path.join(ADMIN_DIST, 'index.html'));
  });
}

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
/**
 * Sanitise a customer email address.
 * Returns the trimmed email if it looks valid, otherwise undefined.
 */
function sanitiseEmail(email) {
  if (typeof email !== 'string') return undefined;
  const trimmed = email.trim().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

/**
 * Sanitise a plain text string for metadata (strip control chars, truncate).
 */
function sanitiseText(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// POST /create-checkout-session
// ---------------------------------------------------------------------------
app.post('/create-checkout-session', async (req, res) => {
  const { items, shipping, customerEmail, customerPhone, shippingAddress, successUrl, cancelUrl } = req.body;

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
    const shippingLabel =
      typeof shipping.name === 'string' && shipping.name.length <= 100
        ? shipping.name
        : typeof shipping.zone === 'string' && shipping.zone.length <= 100
          ? shipping.zone
          : 'Standard';

    const estimatedDays =
      typeof shipping.estimatedDays === 'string' && shipping.estimatedDays.length <= 200
        ? shipping.estimatedDays
        : '';

    lineItems.push({
      price_data: {
        currency: 'aud',
        product_data: {
          name: `Delivery — ${shippingLabel}`,
          ...(estimatedDays && { description: estimatedDays }),
        },
        unit_amount: Math.round(shipping.fee * 100),
      },
      quantity: 1,
    });
  }

  // --- Sanitise customer details ---
  const safeEmail = sanitiseEmail(customerEmail);
  const safePhone = sanitiseText(customerPhone, 30);

  // Build address metadata (fields already validated client-side)
  const addrMeta = shippingAddress && typeof shippingAddress === 'object'
    ? {
        addrName: sanitiseText(shippingAddress.fullName, 100),
        addrLine1: sanitiseText(shippingAddress.address1, 200),
        addrLine2: sanitiseText(shippingAddress.address2, 200),
        addrCity: sanitiseText(shippingAddress.city, 100),
        addrState: sanitiseText(shippingAddress.state, 100),
        addrPostcode: sanitiseText(shippingAddress.postcode, 20),
        addrCountry: sanitiseText(shippingAddress.country, 10),
      }
    : {};

  // --- Create Stripe Checkout session ---
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: safeSuccessUrl,
      cancel_url: safeCancelUrl,
      // Pre-fill customer email so they don't have to retype it on Stripe's page
      ...(safeEmail && { customer_email: safeEmail }),
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
        shippingOption: shipping?.name || 'none',
        ...(safePhone && { customerPhone: safePhone }),
        ...addrMeta,
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation failed:', err);
    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /create-payment-intent
// ---------------------------------------------------------------------------
/**
 * Creates a Stripe PaymentIntent and returns its client_secret to the frontend.
 * The frontend uses Stripe Elements (PaymentElement / PaymentRequestButtonElement)
 * to confirm the payment inline — enabling card, Apple Pay, and Google Pay
 * without leaving the checkout page.
 */
app.post('/create-payment-intent', async (req, res) => {
  const { amount, shipping, customerEmail, shippingAddress } = req.body;

  // --- Validate amount ---
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 100000
  ) {
    return res.status(400).json({ error: 'Invalid order amount.' });
  }

  // --- Sanitise optional metadata ---
  const safeEmail = sanitiseEmail(customerEmail);
  const safeMeta = {};

  if (shipping && typeof shipping === 'object') {
    if (typeof shipping.zone === 'string') {
      safeMeta.shippingZone = sanitiseText(shipping.zone, 100);
    }
    if (typeof shipping.name === 'string') {
      safeMeta.shippingOption = sanitiseText(shipping.name, 100);
    }
    if (typeof shipping.fee === 'number' && Number.isFinite(shipping.fee)) {
      safeMeta.shippingFee = String(Math.round(shipping.fee * 100));
    }
  }

  if (shippingAddress && typeof shippingAddress === 'object') {
    if (typeof shippingAddress.fullName === 'string') {
      safeMeta.addrName = sanitiseText(shippingAddress.fullName, 100);
    }
    if (typeof shippingAddress.city === 'string') {
      safeMeta.addrCity = sanitiseText(shippingAddress.city, 100);
    }
    if (typeof shippingAddress.state === 'string') {
      safeMeta.addrState = sanitiseText(shippingAddress.state, 50);
    }
    if (typeof shippingAddress.country === 'string') {
      safeMeta.addrCountry = sanitiseText(shippingAddress.country, 10);
    }
  }

  // --- Create PaymentIntent ---
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      // Stripe amounts are in the smallest currency unit (cents for AUD)
      amount: Math.round(amount * 100),
      currency: 'aud',
      // Let Stripe automatically surface eligible payment methods
      // (cards, Apple Pay, Google Pay, etc.) based on dashboard config
      automatic_payment_methods: { enabled: true },
      ...(safeEmail && { receipt_email: safeEmail }),
      metadata: safeMeta,
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('PaymentIntent creation failed:', err);
    return res
      .status(500)
      .json({ error: 'Failed to create payment. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Email transporter (nodemailer)
// ---------------------------------------------------------------------------
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

const STOCKIST_TO_EMAIL = process.env.STOCKIST_EMAIL || 'admin@elitedigitalconsulting.com.au';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@neurotonics.com.au';

// ---------------------------------------------------------------------------
// POST /stockist-application
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent injection in the email body.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitise a plain-text string: strip control characters, trim, and cap length.
 */
function sanitiseText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

/**
 * Validate an Australian Business Number (ABN).
 * An ABN is exactly 11 digits (spaces allowed for readability).
 */
function isValidAbn(abn) {
  const digits = abn.replace(/\s/g, '');
  return /^\d{11}$/.test(digits);
}

app.post('/stockist-application', async (req, res) => {
  const {
    fullName,
    businessName,
    abn,
    email,
    phone,
    businessAddress,
    industry,
    businessWebsite,
    message,
  } = req.body || {};

  // --- Required field presence check ---
  const missing = [];
  if (!fullName)        missing.push('fullName');
  if (!businessName)    missing.push('businessName');
  if (!abn)             missing.push('abn');
  if (!email)           missing.push('email');
  if (!phone)           missing.push('phone');
  if (!businessAddress) missing.push('businessAddress');

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}.` });
  }

  // --- Sanitise ---
  const safe = {
    fullName:        sanitiseText(fullName,        120),
    businessName:    sanitiseText(businessName,    200),
    abn:             sanitiseText(abn,              20),
    email:           sanitiseText(email,            254),
    phone:           sanitiseText(phone,             30),
    businessAddress: sanitiseText(businessAddress,  300),
    industry:        sanitiseText(industry || '',   100),
    businessWebsite: sanitiseText(businessWebsite || '', 300),
    message:         sanitiseText(message || '',    1000),
  };

  // --- Type / format validation ---
  if (!safe.fullName || !safe.businessName || !safe.abn || !safe.email || !safe.phone || !safe.businessAddress) {
    return res.status(400).json({ error: 'One or more required fields are empty or too long.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe.email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (!isValidAbn(safe.abn)) {
    return res.status(400).json({ error: 'ABN must be exactly 11 digits.' });
  }

  // --- Send email ---
  const formattedAbn = safe.abn.replace(/\s/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');

  // Escape all user-supplied values before embedding in HTML
  const h = {
    fullName:        escapeHtml(safe.fullName),
    businessName:    escapeHtml(safe.businessName),
    abn:             escapeHtml(formattedAbn),
    email:           escapeHtml(safe.email),
    phone:           escapeHtml(safe.phone),
    businessAddress: escapeHtml(safe.businessAddress),
    industry:        escapeHtml(safe.industry),
    businessWebsite: escapeHtml(safe.businessWebsite),
    message:         escapeHtml(safe.message).replace(/\n/g, '<br>'),
  };

  const htmlBody = `
    <h2 style="color:#1a2e4a;font-family:sans-serif;">New Stockist Application</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:560px;">
      <tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;width:160px;">Full Name</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${h.fullName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Business Name</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${h.businessName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">ABN</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${h.abn}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><a href="mailto:${h.email}">${h.email}</a></td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${h.phone}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Business Address</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${h.businessAddress}</td></tr>
      ${safe.industry ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Industry</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${h.industry}</td></tr>` : ''}
      ${safe.businessWebsite ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Website</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><a href="${h.businessWebsite}">${h.businessWebsite}</a></td></tr>` : ''}
      ${safe.message ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f5f7fa;">Message</td><td style="padding:8px 12px;">${h.message}</td></tr>` : ''}
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#718096;margin-top:24px;">Submitted via the Neurotonics website stockist application form.</p>
  `.trim();

  const textBody = [
    'New Stockist Application',
    '',
    `Full Name:        ${safe.fullName}`,
    `Business Name:    ${safe.businessName}`,
    `ABN:              ${formattedAbn}`,
    `Email:            ${safe.email}`,
    `Phone:            ${safe.phone}`,
    `Business Address: ${safe.businessAddress}`,
    safe.industry        ? `Industry:         ${safe.industry}`        : '',
    safe.businessWebsite ? `Website:          ${safe.businessWebsite}` : '',
    safe.message         ? `\nMessage:\n${safe.message}`               : '',
  ].filter((line) => line !== '').join('\n');

  try {
    await emailTransporter.sendMail({
      from: `"Neurotonics Website" <${EMAIL_FROM}>`,
      to: STOCKIST_TO_EMAIL,
      replyTo: safe.email,
      subject: `Stockist Application — ${safe.businessName}`,
      text: textBody,
      html: htmlBody,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Stockist application email failed:', err);
    return res.status(500).json({ error: 'Failed to send application. Please try again later.' });
  }
});


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
