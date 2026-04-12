'use strict';

/**
 * server/routes/cms-orders.js
 *
 * Order management for the CMS dashboard.
 *
 * GET  /cms/orders              — paginated list (filters: status, search)
 * GET  /cms/orders/:id          — single order
 * PATCH /cms/orders/:id/status  — update order status
 */

const express = require('express');
const { requireAuth } = require('../auth');
const { db, stmts } = require('../db');

const router = express.Router();

const VALID_STATUSES = new Set(['pending', 'processing', 'fulfilled', 'refunded', 'failed']);

// ---------------------------------------------------------------------------
// GET /cms/orders
// Query params: page, limit, status, search
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
      // Full-text search by customer name or email
      // Escape %, _, and \ for SQLite LIKE operator
      const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
      orders = db.prepare(`
        SELECT * FROM orders
        WHERE customer_name LIKE ? ESCAPE '\\' OR customer_email LIKE ? ESCAPE '\\'
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(like, like, limit, offset);
      total = db.prepare(`
        SELECT COUNT(*) as count FROM orders
        WHERE customer_name LIKE ? ESCAPE '\\' OR customer_email LIKE ? ESCAPE '\\'
      `).get(like, like).count;
    } else if (status && VALID_STATUSES.has(status)) {
      orders = stmts.listOrdersByStatus.all(status, limit, offset);
      total  = stmts.countOrdersByStatus.get(status).count;
    } else {
      orders = stmts.listOrders.all(limit, offset);
      total  = stmts.countOrders.get().count;
    }

    // Parse JSON columns for the response
    const parsed = orders.map(parseOrder);

    return res.json({
      orders: parsed,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[cms-orders] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/orders/stats  — summary counts for dashboard
// ---------------------------------------------------------------------------
router.get('/stats', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT status, COUNT(*) as count, SUM(total) as revenue
      FROM orders GROUP BY status
    `).all();

    const today = db.prepare(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM orders WHERE date(created_at) = date('now')
    `).get();

    const week = db.prepare(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM orders WHERE created_at >= datetime('now', '-7 days')
    `).get();

    const month = db.prepare(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM orders WHERE created_at >= datetime('now', '-30 days')
    `).get();

    return res.json({ byStatus: rows, today, week, month });
  } catch (err) {
    console.error('[cms-orders] Stats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch order stats.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/orders/:id
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid order ID.' });

  const order = stmts.getOrderById.get(id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  return res.json({ order: parseOrder(order) });
});

// ---------------------------------------------------------------------------
// PATCH /cms/orders/:id/status
// ---------------------------------------------------------------------------
router.patch('/:id/status', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid order ID.' });

  const { status } = req.body;
  if (!status || !VALID_STATUSES.has(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${[...VALID_STATUSES].join(', ')}.`,
    });
  }

  const order = stmts.getOrderById.get(id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  stmts.updateOrderStatus.run(status, id);
  const updated = stmts.getOrderById.get(id);
  return res.json({ order: parseOrder(updated) });
});

// ---------------------------------------------------------------------------
// Helper: parse JSON columns
// ---------------------------------------------------------------------------
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
