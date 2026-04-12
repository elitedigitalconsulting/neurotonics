'use strict';

/**
 * server/db.js
 *
 * Initialises the SQLite database used by the Neurotonics CMS.
 * Tables: users, orders, content_snapshots, settings
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'neurotonics.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema migrations
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'editor' CHECK(role IN ('admin','editor')),
    name         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id TEXT    UNIQUE,
    customer_name     TEXT    NOT NULL DEFAULT '',
    customer_email    TEXT    NOT NULL DEFAULT '',
    customer_phone    TEXT    NOT NULL DEFAULT '',
    shipping_address  TEXT    NOT NULL DEFAULT '{}',
    items             TEXT    NOT NULL DEFAULT '[]',
    shipping          TEXT    NOT NULL DEFAULT '{}',
    subtotal          REAL    NOT NULL DEFAULT 0,
    total             REAL    NOT NULL DEFAULT 0,
    status            TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','processing','fulfilled','refunded','failed')),
    notification_email TEXT   NOT NULL DEFAULT '',
    notes             TEXT    NOT NULL DEFAULT '',
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_snapshots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------------------------------------------------------------------------
// Default settings (only inserted if not already present)
// ---------------------------------------------------------------------------
const DEFAULT_ORDER_TEMPLATE = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Order Confirmed 🎉</h1>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi {{customerName}},</p>
    <p>Thank you for your order! We're getting it ready for you.</p>
    <h2 style="font-size:16px;margin-bottom:8px;">Order Summary</h2>
    {{itemsTable}}
    <p><strong>Shipping:</strong> {{shippingLabel}} — {{shippingFee}}</p>
    <p><strong>Total: {{total}}</strong></p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">
      Neurotonics · support@neurotonics.com.au · 1300 NEURO<br>
      Always read the label and follow the directions for use.
    </p>
  </div>
</div>
`.trim();

const DEFAULT_ADMIN_ALERT_TEMPLATE = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <h2 style="color:#1a2e4a;">New Order Received</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;width:160px;">Customer</td><td style="padding:6px 12px;">{{customerName}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Email</td><td style="padding:6px 12px;">{{customerEmail}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Phone</td><td style="padding:6px 12px;">{{customerPhone}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Address</td><td style="padding:6px 12px;">{{shippingAddress}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Items</td><td style="padding:6px 12px;">{{itemsList}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Total</td><td style="padding:6px 12px;">{{total}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Stripe ID</td><td style="padding:6px 12px;">{{stripeSessionId}}</td></tr>
  </table>
</div>
`.trim();

const DEFAULT_SETTINGS = {
  notification_email:           'orders@neurotonics.com.au',
  admin_notification_email:     'admin@elitedigitalconsulting.com.au',
  buy_globally_enabled:         'true',
  promo_banner_visible:         'true',
  promo_banner_text:            'Free shipping on orders over $99 | ARTG Listed | Made in Australia',
  order_confirmation_template:  DEFAULT_ORDER_TEMPLATE,
  admin_alert_template:         DEFAULT_ADMIN_ALERT_TEMPLATE,
};

const insertSetting = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
);
const insertMany = db.transaction((pairs) => {
  for (const [k, v] of pairs) insertSetting.run(k, v);
});
insertMany(Object.entries(DEFAULT_SETTINGS));

// ---------------------------------------------------------------------------
// Prepared statement helpers
// ---------------------------------------------------------------------------
const stmts = {
  // settings
  getSetting:     db.prepare('SELECT value FROM settings WHERE key = ?'),
  getAllSettings: db.prepare('SELECT key, value FROM settings'),
  setSetting:     db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ),

  // users
  getUserByEmail:  db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById:     db.prepare('SELECT id, email, role, name, created_at FROM users WHERE id = ?'),
  listUsers:       db.prepare('SELECT id, email, role, name, created_at FROM users ORDER BY created_at DESC'),
  createUser:      db.prepare(
    `INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)`
  ),
  updateUser:      db.prepare(
    `UPDATE users SET email = ?, role = ?, name = ?, updated_at = datetime('now') WHERE id = ?`
  ),
  updateUserPassword: db.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ),
  deleteUser:      db.prepare('DELETE FROM users WHERE id = ?'),

  // orders
  createOrder: db.prepare(`
    INSERT INTO orders
      (stripe_session_id, customer_name, customer_email, customer_phone,
       shipping_address, items, shipping, subtotal, total, notification_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getOrderById:          db.prepare('SELECT * FROM orders WHERE id = ?'),
  getOrderByStripeId:    db.prepare('SELECT * FROM orders WHERE stripe_session_id = ?'),
  updateOrderStatus:     db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ),
  listOrders: db.prepare(`
    SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  countOrders: db.prepare('SELECT COUNT(*) as count FROM orders'),
  listOrdersByStatus: db.prepare(`
    SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  countOrdersByStatus: db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = ?'),

  // content snapshots
  saveSnapshot: db.prepare(`
    INSERT INTO content_snapshots (filename, content, updated_by)
    VALUES (?, ?, ?)
  `),
  getSnapshots: db.prepare(`
    SELECT id, filename, updated_by, updated_at FROM content_snapshots
    WHERE filename = ? ORDER BY updated_at DESC LIMIT 10
  `),

  // password reset tokens
  createResetToken: db.prepare(
    `INSERT OR REPLACE INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
  ),
  getResetToken: db.prepare(
    `SELECT * FROM password_reset_tokens WHERE token = ?`
  ),
  deleteResetToken: db.prepare(
    `DELETE FROM password_reset_tokens WHERE token = ?`
  ),
  deleteResetTokensByUser: db.prepare(
    `DELETE FROM password_reset_tokens WHERE user_id = ?`
  ),
};

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------
function getSetting(key) {
  const row = stmts.getSetting.get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = stmts.getAllSettings.all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function setSetting(key, value) {
  stmts.setSetting.run(key, String(value));
}

module.exports = { db, stmts, getSetting, getAllSettings, setSetting };
