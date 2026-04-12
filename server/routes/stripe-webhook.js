'use strict';

/**
 * server/routes/stripe-webhook.js
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed  → create order record + send emails
 *   - payment_intent.payment_failed → create failed order record
 */

const express = require('express');
const Stripe = require('stripe');
const { stmts, getSetting } = require('../db');
const { sendOrderConfirmation, sendAdminOrderAlert } = require('../email');

const router = express.Router();

// Stripe instance (lazy — loaded when first request arrives)
let stripe;
function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' });
  return stripe;
}

// ---------------------------------------------------------------------------
// POST /stripe/webhook
// raw body required — do NOT use express.json() before this route
// ---------------------------------------------------------------------------
router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature check.');
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

  // Respond immediately to Stripe; process async
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
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    default:
      // Ignore other event types
      break;
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(session) {
  // Prevent duplicate processing
  if (stmts.getOrderByStripeId.get(session.id)) {
    console.log(`[webhook] Duplicate session ${session.id} — skipping.`);
    return;
  }

  const meta = session.metadata || {};

  // Parse items from metadata (stored as JSON array of strings like "Product x2")
  const itemsRaw = meta.items || '[]';

  // Parse shipping address from metadata
  const shippingAddress = {
    fullName: meta.addrName  || '',
    address1: meta.addrLine1 || '',
    address2: meta.addrLine2 || '',
    city:     meta.addrCity  || '',
    state:    meta.addrState || '',
    postcode: meta.addrPostcode || '',
    country:  meta.addrCountry || '',
  };

  const shipping = {
    zone: meta.shippingZone   || '',
    name: meta.shippingOption || '',
  };

  // Compute total in AUD from Stripe amount_total (cents)
  const total = typeof session.amount_total === 'number' ? session.amount_total / 100 : 0;

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
    itemsRaw,
    JSON.stringify(shipping),
    0,       // subtotal (not separately tracked in Stripe session)
    total,
    notifEmail
  );

  const order = stmts.getOrderById.get(result.lastInsertRowid);
  console.log(`[webhook] Order #${order.id} created for ${customerEmail} — ${total} AUD`);

  // Send emails (non-blocking — errors logged but not re-thrown)
  try {
    await sendOrderConfirmation(order);
  } catch (err) {
    console.error('[webhook] Customer confirmation email failed:', err.message);
  }
  try {
    await sendAdminOrderAlert(order);
  } catch (err) {
    console.error('[webhook] Admin alert email failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------
async function handlePaymentFailed(paymentIntent) {
  const meta = paymentIntent.metadata || {};
  const customerEmail = paymentIntent.receipt_email || meta.customerEmail || '';

  // Only record if we don't already have an order for this
  const stripeId = paymentIntent.id;
  if (stmts.getOrderByStripeId.get(stripeId)) return;

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

  // Immediately mark as failed
  const created = stmts.getOrderByStripeId.get(stripeId);
  if (created) stmts.updateOrderStatus.run('failed', created.id);

  console.log(`[webhook] Failed payment recorded for ${customerEmail}`);
}

module.exports = router;
