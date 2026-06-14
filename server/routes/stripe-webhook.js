'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const Stripe  = require('stripe');
const db = require('../db');
const { sendOrderConfirmation, sendAdminOrderAlert } = require('../email');

const router = express.Router();

let _stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

async function nextOrderNumber() {
  const current = parseInt((await db.getSetting('order_number_sequence')) || '1000', 10);
  const next = current + 1;
  await db.setSetting('order_number_sequence', String(next));
  return `ORD-${next}`;
}

function normaliseItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map(item => {
    if (typeof item === 'string') {
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
    console.log(`[inventory] Reduced by ${totalQty} — ${newUnits} units left`);
  } catch (err) {
    console.error('[inventory] Stock update failed:', err.message);
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

  console.log(`[webhook] Received ${event.type} (${event.id || 'no-id'})`);
  res.json({ received: true });
  handleEvent(event).catch(err => console.error('[webhook] Event error:', err));
});

async function handleEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': await handleCheckoutCompleted(event.data.object); break;
    case 'checkout.session.async_payment_succeeded': await handleCheckoutCompleted(event.data.object); break;
    case 'payment_intent.succeeded':   await handlePaymentSucceeded(event.data.object);  break;
    case 'payment_intent.payment_failed': await handlePaymentFailed(event.data.object);  break;
    default: break;
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed — PRIMARY path
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(session) {
  const stripeId = session.id;
  const existing = await db.get('SELECT id FROM orders WHERE stripe_session_id = ?', [stripeId]);
  if (existing) { console.log(`[webhook] Duplicate ${stripeId} — skipping`); return; }
  if (session.payment_status && session.payment_status !== 'paid') {
    console.log(`[webhook] Payment not confirmed for ${stripeId} (${session.payment_status}) — skipping email`);
    return;
  }
  console.log(`[webhook] Payment confirmed for checkout session ${stripeId}`);

  const meta = session.metadata || {};

  let items = [];
  try { items = normaliseItems(JSON.parse(meta.itemsJson || meta.items || '[]')); } catch { /* ignore */ }

  if (items.length === 0 || items.every(item => !item.price)) {
    try {
      const lineItems = await getStripe().checkout.sessions.listLineItems(stripeId, { limit: 50 });
      items = lineItems.data
        .filter(li => !(li.description || '').startsWith('Delivery'))
        .map(li => ({ name: li.description || 'Brain Boost 1000', quantity: li.quantity, price: (li.amount_total || 0) / 100 / (li.quantity || 1) }));
    } catch { /* ignore */ }
  }

  const shippingAddress = {
    fullName: meta.addrName     || session.customer_details?.name || '',
    address1: meta.addrLine1    || session.customer_details?.address?.line1 || '',
    address2: meta.addrLine2    || session.customer_details?.address?.line2 || '',
    city:     meta.addrCity     || session.customer_details?.address?.city || '',
    state:    meta.addrState    || session.customer_details?.address?.state || '',
    postcode: meta.addrPostcode || session.customer_details?.address?.postal_code || '',
    country:  meta.addrCountry  || session.customer_details?.address?.country || '',
  };

  const shippingFee   = meta.shippingFee ? parseInt(meta.shippingFee, 10) / 100 : 0;
  const shipping      = { zone: meta.shippingZone || '', name: meta.shippingOption || '', fee: shippingFee };
  const total         = session.amount_total / 100;
  const subtotal      = meta.subtotal ? parseInt(meta.subtotal, 10) / 100 : total - shippingFee;
  const customerEmail = session.customer_email || session.customer_details?.email || meta.customerEmail || '';
  const customerName  = session.customer_details?.name || meta.addrName || '';
  const customerPhone = meta.customerPhone || session.customer_details?.phone || '';
  const notifEmail    = (await db.getSetting('notification_email')) || '';
  const orderNumber   = await nextOrderNumber();

  const result = await db.run(
    `INSERT INTO orders (order_number, stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, shipping, subtotal, total, status, payment_status, notification_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderNumber, stripeId, customerName, customerEmail, customerPhone, JSON.stringify(shippingAddress), JSON.stringify(items), JSON.stringify(shipping), subtotal, total, 'processing', 'paid', notifEmail]
  );

  const order = await db.get('SELECT * FROM orders WHERE id = ?', [Number(result.lastInsertRowid)]);
  console.log(`[webhook] Order ${orderNumber} created — ${customerEmail} — $${total} AUD`);

  reduceInventory(items);
  console.log(`[webhook] Email triggered for order ${orderNumber}`);
  sendOrderConfirmation(order).catch(err => console.error('[webhook] Confirmation email:', err.message));
  sendAdminOrderAlert(order).catch(err => console.error('[webhook] Admin alert:', err.message));
}

// ---------------------------------------------------------------------------
// payment_intent.succeeded
// ---------------------------------------------------------------------------
async function handlePaymentSucceeded(paymentIntent) {
  console.log(`[webhook] Payment confirmed for payment intent ${paymentIntent.id}`);
  const checkoutSessions = await getStripe().checkout.sessions.list({ payment_intent: paymentIntent.id, limit: 1 });
  const checkoutSession = checkoutSessions.data[0];
  if (checkoutSession) {
    await handleCheckoutCompleted(checkoutSession);
    return;
  }

  const stripeId = paymentIntent.id;
  const existing = await db.get('SELECT id FROM orders WHERE stripe_session_id = ?', [stripeId]);
  if (existing) { console.log(`[webhook] Duplicate PI ${stripeId} — skipping`); return; }

  const meta = paymentIntent.metadata || {};
  let items = [];
  try { items = normaliseItems(JSON.parse(meta.itemsJson || '[]')); } catch { /* ignore */ }

  const shippingAddress = {
    fullName: meta.addrName || '', address1: meta.addrLine1 || '', address2: meta.addrLine2 || '',
    city: meta.addrCity || '', state: meta.addrState || '', postcode: meta.addrPostcode || '', country: meta.addrCountry || '',
  };
  const shippingFee = meta.shippingFee ? parseInt(meta.shippingFee, 10) / 100 : 0;
  const shipping    = { zone: meta.shippingZone || '', name: meta.shippingOption || '', fee: shippingFee };
  const total       = paymentIntent.amount / 100;
  const subtotal    = meta.subtotal ? parseInt(meta.subtotal, 10) / 100 : total;
  const notifEmail  = (await db.getSetting('notification_email')) || '';
  const orderNumber = await nextOrderNumber();

  const result = await db.run(
    `INSERT INTO orders (order_number, stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, shipping, subtotal, total, status, payment_status, notification_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderNumber, stripeId, meta.addrName || '', paymentIntent.receipt_email || '', meta.customerPhone || '', JSON.stringify(shippingAddress), JSON.stringify(items), JSON.stringify(shipping), subtotal, total, 'processing', 'paid', notifEmail]
  );

  const order = await db.get('SELECT * FROM orders WHERE id = ?', [Number(result.lastInsertRowid)]);
  console.log(`[webhook] Order ${orderNumber} created — $${total} AUD`);
  reduceInventory(items);
  console.log(`[webhook] Email triggered for order ${orderNumber}`);
  sendOrderConfirmation(order).catch(err => console.error('[webhook] Confirmation email:', err.message));
  sendAdminOrderAlert(order).catch(err => console.error('[webhook] Admin alert:', err.message));
}

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------
async function handlePaymentFailed(paymentIntent) {
  const stripeId = paymentIntent.id;
  const existing = await db.get('SELECT id FROM orders WHERE stripe_session_id = ?', [stripeId]);
  if (existing) return;

  const orderNumber = await nextOrderNumber();
  const result = await db.run(
    `INSERT INTO orders (order_number, stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, shipping, subtotal, total, status, payment_status, notification_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderNumber, stripeId, '', paymentIntent.receipt_email || '', '', '{}', '[]', '{}', 0, 0, 'failed', 'failed', '']
  );
  console.log(`[webhook] Failed payment recorded — ${paymentIntent.receipt_email}`);
}

module.exports = router;
