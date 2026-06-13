'use strict';

/**
 * server/routes/cms-orders.js
 *
 * Shopify-style order management for the CMS.
 *
 * GET    /cms/orders                 — paginated list (filters: status, search)
 * GET    /cms/orders/stats           — summary counts
 * GET    /cms/orders/:id             — single order
 * PATCH  /cms/orders/:id/status      — update status (+ email on cancelled/refunded)
 * POST   /cms/orders/:id/fulfill     — mark fulfilled with tracking info
 * PATCH  /cms/orders/:id/notes       — update customer notes and admin notes
 */

const express = require('express');
const { requireAuth, requireRole } = require('../auth');
const { db, stmts } = require('../db');
const { sendFulfillmentEmail, sendOrderStatusEmail } = require('../email');

const router = express.Router();

const VALID_STATUSES = new Set(['pending', 'processing', 'fulfilled', 'refunded', 'failed', 'cancelled']);

// ---------------------------------------------------------------------------
// GET /cms/orders
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const search = req.query.search;

  try {
    let orders, total;

    if (search) {
      const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
      orders = db.prepare(`
        SELECT * FROM orders
        WHERE customer_name LIKE ? ESCAPE '\\'
           OR customer_email LIKE ? ESCAPE '\\'
           OR order_number LIKE ? ESCAPE '\\'
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(like, like, like, limit, offset);
      total = db.prepare(`
        SELECT COUNT(*) as count FROM orders
        WHERE customer_name LIKE ? ESCAPE '\\'
           OR customer_email LIKE ? ESCAPE '\\'
           OR order_number LIKE ? ESCAPE '\\'
      `).get(like, like, like).count;
    } else if (status && VALID_STATUSES.has(status)) {
      orders = stmts.listOrdersByStatus.all(status, limit, offset);
      total  = stmts.countOrdersByStatus.get(status).count;
    } else {
      orders = stmts.listOrders.all(limit, offset);
      total  = stmts.countOrders.get().count;
    }

    return res.json({
      orders: orders.map(parseOrder),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[cms-orders] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/orders/stats
// ---------------------------------------------------------------------------
router.get('/stats', requireAuth, (req, res) => {
  try {
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
      FROM orders GROUP BY status
    `).all();

    const today = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
      FROM orders WHERE date(created_at) = date('now') AND payment_status = 'paid'
    `).get();

    const week = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
      FROM orders WHERE created_at >= datetime('now', '-7 days') AND payment_status = 'paid'
    `).get();

    const month = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
      FROM orders WHERE created_at >= datetime('now', '-30 days') AND payment_status = 'paid'
    `).get();

    const allTime = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
      FROM orders WHERE payment_status = 'paid'
    `).get();

    return res.json({ byStatus, today, week, month, allTime });
  } catch (err) {
    console.error('[cms-orders] Stats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch order stats.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/orders/:id
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  return res.json({ order: parseOrder(order) });
});

// ---------------------------------------------------------------------------
// PATCH /cms/orders/:id/status
// ---------------------------------------------------------------------------
router.patch('/:id/status', requireAuth, async (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const { status } = req.body;
  if (!status || !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: `Status must be one of: ${[...VALID_STATUSES].join(', ')}.` });
  }

  stmts.updateOrderStatus.run(status, order.id);
  const updated = stmts.getOrderById.get(order.id);

  // Send customer notification for certain status transitions
  if (['cancelled', 'refunded'].includes(status) && updated.customer_email) {
    sendOrderStatusEmail(updated, status).catch(err =>
      console.error('[cms-orders] Status email error:', err.message)
    );
  }

  return res.json({ order: parseOrder(updated) });
});

// ---------------------------------------------------------------------------
// POST /cms/orders/:id/fulfill
// Mark an order as fulfilled and send shipping notification to customer
// ---------------------------------------------------------------------------
router.post('/:id/fulfill', requireAuth, async (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (order.status === 'fulfilled') {
    return res.status(400).json({ error: 'Order is already fulfilled.' });
  }

  const { tracking_number = '', carrier = '', fulfillment_notes = '', notify_customer = true } = req.body;

  stmts.fulfillOrder.run(
    String(tracking_number).slice(0, 200),
    String(carrier).slice(0, 100),
    String(fulfillment_notes).slice(0, 1000),
    order.id
  );

  const updated = stmts.getOrderById.get(order.id);

  if (notify_customer && updated.customer_email) {
    sendFulfillmentEmail(updated).catch(err =>
      console.error('[cms-orders] Fulfillment email error:', err.message)
    );
  }

  return res.json({ order: parseOrder(updated) });
});

// ---------------------------------------------------------------------------
// PATCH /cms/orders/:id/notes
// ---------------------------------------------------------------------------
router.patch('/:id/notes', requireAuth, (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const notes       = String(req.body.notes       ?? order.notes       ?? '').slice(0, 2000);
  const admin_notes = String(req.body.admin_notes ?? order.admin_notes ?? '').slice(0, 2000);

  stmts.updateOrderNotes.run(notes, admin_notes, order.id);
  return res.json({ order: parseOrder(stmts.getOrderById.get(order.id)) });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findOrder(idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return stmts.getOrderById.get(id) || null;
}

function parseOrder(order) {
  return {
    ...order,
    shipping_address: tryParse(order.shipping_address, {}),
    items:            tryParse(order.items, []),
    shipping:         tryParse(order.shipping, {}),
  };
}

function tryParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = router;
