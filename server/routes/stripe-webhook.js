'use strict';

/**
 * server/routes/stripe-webhook.js
 *
 * Handles Stripe webhook events for order lifecycle:
 *   - checkout.session.completed    → create order (processing) + send emails
 *   - payment_intent.succeeded      → create order (processing) + send emails
 *   - payment_intent.payment_failed → create failed order record
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const Stripe  = require('stripe');
const { db, stmts, getSetting, setSetting } = require('../db');
const { sendOrderConfirmation, sendAdminOrderAlert } = require('../email');

const router = express.Router();

let _stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

// ---------------------------------------------------------------------------
// Generate sequential human-readable order number (ORD-1001, ORD-1002, …)
// ---------------------------------------------------------------------------
function nextOrderNumber() {
  const current = parseInt(getSetting('order_number_sequence') || '1000', 10);
  const next = current + 1;
  setSetting('order_number_sequence', String(next));
  return `ORD-${next}`;
}

// ---------------------------------------------------------------------------
// Normalise items to [{name, quantity, price}] regardless of source format
// ---------------------------------------------------------------------------
function normaliseItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item) => {
    if (typeof item === 'string') {
      // Legacy format: "Brain Boost 1000 x2"
      const m = item.match(/^(.+?)\s+x(\d+)$/i);
      return { name: m ? m[1].trim() : item, quantity: m ? parseInt(m[2], 10) : 1, price: 0 };
    }
    if (typeof item === 'object' && item !== null) {
      return {
        name:     String(item.name || item.label || ''),
        quantity: parseInt(item.qty || item.quantity || 1, 10),
        price:    parseFloat(item.priceCents ? item.priceCents / 100 : item.price || 0),
      };
    }
    return { name: String(item), quantity: 1, price: 0 };
  }).filter(i => i.name);
}

// ---------------------------------------------------------------------------
// Reduce product inventory after successful payment
// ---------------------------------------------------------------------------
function reduceInventory(items) {
  try {
    const productPath = path.resolve(__dirname, '../../src/content/product.json');
    if (!fs.existsSync(productPath)) return;
    const product = JSON.parse(fs.readFileSync(productPath, 'utf8'));
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    const newUnits = Math.max(0, (product.unitsLeft || 0) - totalQty);
    product.unitsLeft = newUnits;
    product.stockPercent = Math.max(0, Math.min(100, Math.round((newUnits / 100) * 100)));
    if (newUnits === 0) product.inStock = false;
    fs.writeFileSync(productPath, JSON.stringify(product, null, 2));
    console.log(`[inventory] Reduced stock by ${totalQty} — now ${newUnits} units`);
  } catch (err) {
    console.error('[inventory] Failed to reduce stock:', err.message);
  }
}

// ---------------------------------------------------------------------------
// POST /stripe/webhook
// ---------------------------------------------------------------------------
router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] STRIPE_WEBHOOK_SECRET not set — rejecting.');
      return res.status(500).json({ error: 'Webhook secret not configured.' });
    }
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature check (dev only).');
  }

  let event;
  try {
    if (secret) {
      event = getStripe().webhooks.constructEvent(req.body, sig, secret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  res.json({ received: true });
  handleEvent(event).catch((err) => console.error('[webhook] Event error:', err));
});

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
async function handleEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed  ←  PRIMARY path for Stripe Checkout redirect
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(session) {
  const stripeId = session.id;

  if (stmts.getOrderByStripeId.get(stripeId)) {
    console.log(`[webhook] Duplicate session ${stripeId} — skipping.`);
    return;
  }

  const meta = session.metadata || {};

  // Build structured items from metadata
  let items = [];
  try { items = normaliseItems(JSON.parse(meta.items || meta.itemsJson || '[]')); } catch { /* ignore */ }

  // If no items in metadata, retrieve line items from Stripe
  if (items.length === 0) {
    try {
      const lineItems = await getStripe().checkout.sessions.listLineItems(stripeId, { limit: 50 });
      items = lineItems.data
        .filter(li => !li.description?.startsWith('Delivery'))
        .map(li => ({
          name:     li.description || 'Brain Boost 1000',
          quantity: li.quantity,
          price:    li.amount_total / 100 / li.quantity,
        }));
    } catch { /* ignore */ }
  }

  const shippingAddress = {
    fullName: meta.addrName    || session.customer_details?.name || '',
    address1: meta.addrLine1   || session.customer_details?.address?.line1 || '',
    address2: meta.addrLine2   || session.customer_details?.address?.line2 || '',
    city:     meta.addrCity    || session.customer_details?.address?.city || '',
    state:    meta.addrState   || session.customer_details?.address?.state || '',
    postcode: meta.addrPostcode|| session.customer_details?.address?.postal_code || '',
    country:  meta.addrCountry || session.customer_details?.address?.country || '',
  };

  const shipping = {
    zone: meta.shippingZone   || '',
    name: meta.shippingOption || '',
    fee:  meta.shippingFee    ? parseInt(meta.shippingFee, 10) / 100 : 0,
  };

  const total        = session.amount_total / 100;
  const subtotal     = meta.subtotal ? parseInt(meta.subtotal, 10) / 100 : total - (shipping.fee || 0);
  const customerEmail = session.customer_email || session.customer_details?.email || '';
  const customerName  = session.customer_details?.name || meta.addrName || '';
  const customerPhone = meta.customerPhone || session.customer_details?.phone || '';
  const notifEmail    = getSetting('notification_email') || '';
  const orderNumber   = nextOrderNumber();

  const result = stmts.createOrder.run(
    orderNumber,
    stripeId,
    customerName,
    customerEmail,
    customerPhone,
    JSON.stringify(shippingAddress),
    JSON.stringify(items),
    JSON.stringify(shipping),
    subtotal,
    total,
    'processing',
    'paid',
    notifEmail
  );

  const order = stmts.getOrderById.get(result.lastInsertRowid);
  console.log(`[webhook] Order ${orderNumber} (#${order.id}) created — ${customerEmail} — $${total} AUD`);

  reduceInventory(items);

  try { await sendOrderConfirmation(order); }
  catch (err) { console.error('[webhook] Confirmation email failed:', err.message); }

  try { await sendAdminOrderAlert(order); }
  catch (err) { console.error('[webhook] Admin alert failed:', err.message); }
}

// ---------------------------------------------------------------------------
// payment_intent.succeeded  ←  used if PaymentIntent flow is ever re-enabled
// ---------------------------------------------------------------------------
async function handlePaymentSucceeded(paymentIntent) {
  const stripeId = paymentIntent.id;
  if (stmts.getOrderByStripeId.get(stripeId)) {
    console.log(`[webhook] Duplicate PaymentIntent ${stripeId} — skipping.`);
    return;
  }

  const meta = paymentIntent.metadata || {};

  let items = [];
  try { items = normaliseItems(JSON.parse(meta.itemsJson || '[]')); } catch { /* ignore */ }

  const shippingAddress = {
    fullName: meta.addrName || '', address1: meta.addrLine1 || '',
    address2: meta.addrLine2 || '', city: meta.addrCity || '',
    state: meta.addrState || '', postcode: meta.addrPostcode || '',
    country: meta.addrCountry || '',
  };

  const shipping = {
    zone: meta.shippingZone || '', name: meta.shippingOption || '',
    fee: meta.shippingFee ? parseInt(meta.shippingFee, 10) / 100 : 0,
  };

  const total        = paymentIntent.amount / 100;
  const subtotal     = meta.subtotal ? parseInt(meta.subtotal, 10) / 100 : total;
  const customerEmail = paymentIntent.receipt_email || '';
  const customerName  = meta.addrName || '';
  const notifEmail    = getSetting('notification_email') || '';
  const orderNumber   = nextOrderNumber();

  const result = stmts.createOrder.run(
    orderNumber, stripeId, customerName, customerEmail,
    meta.customerPhone || '',
    JSON.stringify(shippingAddress),
    JSON.stringify(items),
    JSON.stringify(shipping),
    subtotal, total, 'processing', 'paid', notifEmail
  );

  const order = stmts.getOrderById.get(result.lastInsertRowid);
  console.log(`[webhook] Order ${orderNumber} created — $${total} AUD`);

  reduceInventory(items);

  try { await sendOrderConfirmation(order); } catch (err) { console.error('[webhook] Confirmation email:', err.message); }
  try { await sendAdminOrderAlert(order); } catch (err) { console.error('[webhook] Admin alert:', err.message); }
}

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------
async function handlePaymentFailed(paymentIntent) {
  const stripeId = paymentIntent.id;
  if (stmts.getOrderByStripeId.get(stripeId)) return;

  const meta = paymentIntent.metadata || {};
  const orderNumber = nextOrderNumber();

  stmts.createOrder.run(
    orderNumber, stripeId,
    meta.addrName || '', paymentIntent.receipt_email || '',
    meta.customerPhone || '', '{}', '[]', '{}',
    0, 0, 'failed', 'failed', ''
  );

  const created = stmts.getOrderByStripeId.get(stripeId);
  if (created) {
    db.prepare("UPDATE orders SET status = 'failed', payment_status = 'failed', updated_at = datetime('now') WHERE id = ?").run(created.id);
  }
  console.log(`[webhook] Failed payment recorded — ${paymentIntent.receipt_email}`);
}

module.exports = router;
