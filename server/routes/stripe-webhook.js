'use strict';

/**
 * server/routes/stripe-webhook.js
 *
 * Handles Stripe webhook events:
 *   - payment_intent.succeeded      → create order record + send emails
 *   - payment_intent.payment_failed → create failed order record
 *   - checkout.session.completed    → create order (legacy redirect flow)
 *
 * STRIPE_WEBHOOK_SECRET must be set in production.  Requests without a valid
 * signature are rejected with 400.
 */

const express = require('express');
const Stripe = require('stripe');
const { stmts, getSetting } = require('../db');
const { sendOrderConfirmation, sendAdminOrderAlert } = require('../email');

const router = express.Router();

let stripe;
function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  return stripe;
}

// ---------------------------------------------------------------------------
// POST /stripe/webhook
// ---------------------------------------------------------------------------
router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Reject unsigned requests in production — no bypass allowed.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] STRIPE_WEBHOOK_SECRET not set — rejecting request.');
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

  // Acknowledge immediately; process asynchronously.
  res.json({ received: true });

  handleEvent(event).catch((err) => {
    console.error('[webhook] Event handling error:', err);
  });
});

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------
async function handleEvent(event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// payment_intent.succeeded — primary order creation path
// ---------------------------------------------------------------------------
async function handlePaymentSucceeded(paymentIntent) {
  const stripeId = paymentIntent.id;

  if (stmts.getOrderByStripeId.get(stripeId)) {
    console.log(`[webhook] Duplicate PaymentIntent ${stripeId} — skipping.`);
    return;
  }

  const meta = paymentIntent.metadata || {};

  // Reconstruct items from metadata into display strings for the CMS
  let itemsDisplay = '[]';
  try {
    const parsed = JSON.parse(meta.itemsJson || '[]');
    const displayArr = parsed.map((i) => `${i.name} x${i.qty}`);
    itemsDisplay = JSON.stringify(displayArr);
  } catch {
    itemsDisplay = '[]';
  }

  const shippingAddress = {
    fullName: meta.addrName     || '',
    address1: meta.addrLine1    || '',
    address2: meta.addrLine2    || '',
    city:     meta.addrCity     || '',
    state:    meta.addrState    || '',
    postcode: meta.addrPostcode || '',
    country:  meta.addrCountry  || '',
  };

  const shipping = {
    zone: meta.shippingZone   || '',
    name: meta.shippingOption || '',
    fee:  meta.shippingFee    ? parseInt(meta.shippingFee, 10) / 100 : 0,
  };

  const total     = paymentIntent.amount / 100;
  const subtotal  = meta.subtotal ? parseInt(meta.subtotal, 10) / 100 : 0;
  const customerEmail = paymentIntent.receipt_email || '';
  const customerName  = meta.addrName || '';
  const customerPhone = meta.customerPhone || '';
  const notifEmail    = getSetting('notification_email') || '';

  const result = stmts.createOrder.run(
    stripeId,
    customerName,
    customerEmail,
    customerPhone,
    JSON.stringify(shippingAddress),
    itemsDisplay,
    JSON.stringify(shipping),
    subtotal,
    total,
    notifEmail
  );

  const order = stmts.getOrderById.get(result.lastInsertRowid);
  console.log(`[webhook] Order #${order.id} created for ${customerEmail} — $${total} AUD`);

  try { await sendOrderConfirmation(order); }
  catch (err) { console.error('[webhook] Customer confirmation email failed:', err.message); }

  try { await sendAdminOrderAlert(order); }
  catch (err) { console.error('[webhook] Admin alert email failed:', err.message); }
}

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------
async function handlePaymentFailed(paymentIntent) {
  const stripeId = paymentIntent.id;
  if (stmts.getOrderByStripeId.get(stripeId)) return;

  const meta = paymentIntent.metadata || {};
  const customerEmail = paymentIntent.receipt_email || '';

  stmts.createOrder.run(
    stripeId,
    meta.addrName || '',
    customerEmail,
    meta.customerPhone || '',
    '{}',
    '[]',
    JSON.stringify({ zone: meta.shippingZone || '', name: meta.shippingOption || '' }),
    0,
    0,
    ''
  );

  const created = stmts.getOrderByStripeId.get(stripeId);
  if (created) stmts.updateOrderStatus.run('failed', created.id);

  console.log(`[webhook] Failed payment recorded for ${customerEmail}`);
}

// ---------------------------------------------------------------------------
// checkout.session.completed (legacy redirect flow — kept for compatibility)
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(session) {
  if (stmts.getOrderByStripeId.get(session.id)) {
    console.log(`[webhook] Duplicate session ${session.id} — skipping.`);
    return;
  }

  const meta = session.metadata || {};

  const shippingAddress = {
    fullName: meta.addrName     || '',
    address1: meta.addrLine1    || '',
    address2: meta.addrLine2    || '',
    city:     meta.addrCity     || '',
    state:    meta.addrState    || '',
    postcode: meta.addrPostcode || '',
    country:  meta.addrCountry  || '',
  };

  const shipping = {
    zone: meta.shippingZone   || '',
    name: meta.shippingOption || '',
  };

  const total         = typeof session.amount_total === 'number' ? session.amount_total / 100 : 0;
  const customerEmail = session.customer_email || session.customer_details?.email || '';
  const customerName  = session.customer_details?.name || meta.addrName || '';
  const customerPhone = meta.customerPhone || session.customer_details?.phone || '';
  const notifEmail    = getSetting('notification_email') || '';

  const result = stmts.createOrder.run(
    session.id,
    customerName,
    customerEmail,
    customerPhone,
    JSON.stringify(shippingAddress),
    meta.items || '[]',
    JSON.stringify(shipping),
    0,
    total,
    notifEmail
  );

  const order = stmts.getOrderById.get(result.lastInsertRowid);
  console.log(`[webhook] Order #${order.id} created for ${customerEmail} — $${total} AUD`);

  try { await sendOrderConfirmation(order); }
  catch (err) { console.error('[webhook] Customer confirmation email failed:', err.message); }

  try { await sendAdminOrderAlert(order); }
  catch (err) { console.error('[webhook] Admin alert email failed:', err.message); }
}

module.exports = router;
