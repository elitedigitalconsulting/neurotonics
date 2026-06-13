'use strict';

const express = require('express');
const { requireAuth, requireRole } = require('../auth');
const db = require('../db');
const { sendFulfillmentEmail, sendOrderStatusEmail } = require('../email');

const router = express.Router();
const VALID_STATUSES = new Set(['pending', 'processing', 'fulfilled', 'refunded', 'failed', 'cancelled']);

// ---------------------------------------------------------------------------
// GET /cms/orders
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const search = req.query.search;

  try {
    let orders, total;
    if (search) {
      const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
      orders = await db.all(`SELECT * FROM orders WHERE customer_name LIKE ? ESCAPE '\\' OR customer_email LIKE ? ESCAPE '\\' OR order_number LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ? OFFSET ?`, [like, like, like, limit, offset]);
      const r = await db.get(`SELECT COUNT(*) as count FROM orders WHERE customer_name LIKE ? ESCAPE '\\' OR customer_email LIKE ? ESCAPE '\\' OR order_number LIKE ? ESCAPE '\\'`, [like, like, like]);
      total = Number(r.count);
    } else if (status && VALID_STATUSES.has(status)) {
      orders = await db.all('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [status, limit, offset]);
      const r = await db.get('SELECT COUNT(*) as count FROM orders WHERE status = ?', [status]);
      total = Number(r.count);
    } else {
      orders = await db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
      const r = await db.get('SELECT COUNT(*) as count FROM orders');
      total = Number(r.count);
    }
    return res.json({ orders: orders.map(parseOrder), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[cms-orders] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/orders/stats
// ---------------------------------------------------------------------------
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const byStatus = await db.all("SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders GROUP BY status");
    const today    = await db.get("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE date(created_at) = date('now') AND payment_status = 'paid'");
    const week     = await db.get("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE created_at >= datetime('now', '-7 days') AND payment_status = 'paid'");
    const month    = await db.get("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE created_at >= datetime('now', '-30 days') AND payment_status = 'paid'");
    const allTime  = await db.get("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE payment_status = 'paid'");
    return res.json({ byStatus, today, week, month, allTime });
  } catch (err) {
    console.error('[cms-orders] Stats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch order stats.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/orders/:id
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  const order = await findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  return res.json({ order: parseOrder(order) });
});

// ---------------------------------------------------------------------------
// PATCH /cms/orders/:id/status
// ---------------------------------------------------------------------------
router.patch('/:id/status', requireAuth, async (req, res) => {
  const order = await findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const { status } = req.body;
  if (!status || !VALID_STATUSES.has(status)) return res.status(400).json({ error: `Status must be one of: ${[...VALID_STATUSES].join(', ')}.` });

  await db.run("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, order.id]);
  const updated = await db.get('SELECT * FROM orders WHERE id = ?', [order.id]);

  if (['cancelled', 'refunded'].includes(status) && updated.customer_email) {
    sendOrderStatusEmail(updated, status).catch(err => console.error('[cms-orders] Status email:', err.message));
  }

  return res.json({ order: parseOrder(updated) });
});

// ---------------------------------------------------------------------------
// POST /cms/orders/:id/fulfill
// ---------------------------------------------------------------------------
router.post('/:id/fulfill', requireAuth, async (req, res) => {
  const order = await findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'fulfilled') return res.status(400).json({ error: 'Order is already fulfilled.' });

  const { tracking_number = '', carrier = '', fulfillment_notes = '', notify_customer = true } = req.body;

  await db.run(`UPDATE orders SET status = 'fulfilled', tracking_number = ?, carrier = ?, fulfillment_notes = ?, fulfillment_date = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [String(tracking_number).slice(0, 200), String(carrier).slice(0, 100), String(fulfillment_notes).slice(0, 1000), order.id]);

  const updated = await db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
  if (notify_customer && updated.customer_email) {
    sendFulfillmentEmail(updated).catch(err => console.error('[cms-orders] Fulfillment email:', err.message));
  }
  return res.json({ order: parseOrder(updated) });
});

// ---------------------------------------------------------------------------
// PATCH /cms/orders/:id/notes
// ---------------------------------------------------------------------------
router.patch('/:id/notes', requireAuth, async (req, res) => {
  const order = await findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const notes       = String(req.body.notes       ?? order.notes       ?? '').slice(0, 2000);
  const admin_notes = String(req.body.admin_notes ?? order.admin_notes ?? '').slice(0, 2000);

  await db.run("UPDATE orders SET notes = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?", [notes, admin_notes, order.id]);
  return res.json({ order: parseOrder(await db.get('SELECT * FROM orders WHERE id = ?', [order.id])) });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function findOrder(idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.get('SELECT * FROM orders WHERE id = ?', [id]);
}

function parseOrder(order) {
  if (!order) return null;
  return {
    ...order,
    id: Number(order.id),
    shipping_address: tryParse(order.shipping_address, {}),
    items:            tryParse(order.items, []),
    shipping:         tryParse(order.shipping, {}),
  };
}

function tryParse(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }

module.exports = router;
