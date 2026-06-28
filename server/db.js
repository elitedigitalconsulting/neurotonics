'use strict';

/**
 * server/db.js
 *
 * SQLite database layer using better-sqlite3 (synchronous, fast).
 *
 * Exports both:
 *   - Legacy sync API (db, stmts, getSetting, etc.) for backward compatibility
 *   - Async wrapper API (run, get, all, getSetting, setSetting) for new routes
 *
 * Persistence options (in priority order):
 *   1. /data directory if it exists (Render persistent disk — set up in dashboard)
 *   2. DB_PATH env var (custom path)
 *   3. Local server/data/neurotonics.db (ephemeral on Render free tier)
 *
 * For free persistent storage without a disk, the backup.js module uses
 * GitHub to restore user/settings data across redeploys.
 */

const path     = require('path');
const fs       = require('fs');
const Database = require('better-sqlite3');

// Use /data (Render persistent disk) if mounted, otherwise local data dir
const DISK = '/data';
const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : fs.existsSync(DISK)
    ? DISK
    : path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'neurotonics.db');
console.log(`[db] Using database: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'editor' CHECK(role IN ('admin','editor')),
    name          TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number      TEXT,
    stripe_session_id TEXT    UNIQUE,
    customer_name     TEXT    NOT NULL DEFAULT '',
    customer_email    TEXT    NOT NULL DEFAULT '',
    customer_phone    TEXT    NOT NULL DEFAULT '',
    shipping_address  TEXT    NOT NULL DEFAULT '{}',
    items             TEXT    NOT NULL DEFAULT '[]',
    shipping          TEXT    NOT NULL DEFAULT '{}',
    subtotal          REAL    NOT NULL DEFAULT 0,
    total             REAL    NOT NULL DEFAULT 0,
    status            TEXT    NOT NULL DEFAULT 'pending',
    payment_status    TEXT    NOT NULL DEFAULT 'pending',
    notification_email TEXT   NOT NULL DEFAULT '',
    notes             TEXT    NOT NULL DEFAULT '',
    admin_notes       TEXT    NOT NULL DEFAULT '',
    tracking_number   TEXT    NOT NULL DEFAULT '',
    carrier           TEXT    NOT NULL DEFAULT '',
    fulfillment_date  TEXT,
    fulfillment_notes TEXT    NOT NULL DEFAULT '',
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
  CREATE TABLE IF NOT EXISTS stockist_applications (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name        TEXT    NOT NULL DEFAULT '',
    business_name    TEXT    NOT NULL DEFAULT '',
    abn              TEXT    NOT NULL DEFAULT '',
    email            TEXT    NOT NULL DEFAULT '',
    phone            TEXT    NOT NULL DEFAULT '',
    business_address TEXT    NOT NULL DEFAULT '',
    industry         TEXT    NOT NULL DEFAULT '',
    business_website TEXT    NOT NULL DEFAULT '',
    message          TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','approved','rejected')),
    notes            TEXT    NOT NULL DEFAULT '',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Safe column migrations for existing tables
const existingCols = db.prepare('PRAGMA table_info(orders)').all().map(r => r.name);
const addCol = (col, def) => { if (!existingCols.includes(col)) db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${def}`); };
addCol('order_number',       'TEXT');
addCol('payment_status',     "TEXT NOT NULL DEFAULT 'pending'");
addCol('admin_notes',        "TEXT NOT NULL DEFAULT ''");
addCol('tracking_number',    "TEXT NOT NULL DEFAULT ''");
addCol('carrier',            "TEXT NOT NULL DEFAULT ''");
addCol('fulfillment_date',   'TEXT');
addCol('fulfillment_notes',  "TEXT NOT NULL DEFAULT ''");
addCol('email_sent',         "INTEGER NOT NULL DEFAULT 0");
addCol('admin_alert_sent',   "INTEGER NOT NULL DEFAULT 0");
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number) WHERE order_number IS NOT NULL`);

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------
const DEFAULT_ORDER_TEMPLATE = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:#1a2e4a;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Order Confirmed 🎉</h1>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:14px;">{{orderNumber}}</p>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 8px 8px;">
    <p>Hi {{customerName}},</p>
    <p>Thank you for your order! We're preparing it now and will send you tracking information once it ships.</p>
    <h2 style="font-size:16px;margin-bottom:8px;">Order Summary</h2>
    {{itemsTable}}
    <p><strong>Shipping:</strong> {{shippingLabel}} — {{shippingFee}}</p>
    <p style="font-size:18px;font-weight:bold;margin-top:12px;">Total: {{total}}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#718096;">
      Questions? Email us at <a href="mailto:support@neurotonics.com.au" style="color:#1a2e4a;">support@neurotonics.com.au</a><br>
      Neurotonics — Always read the label and follow the directions for use.
    </p>
  </div>
</div>`.trim();

const DEFAULT_ADMIN_ALERT_TEMPLATE = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <h2 style="color:#1a2e4a;">New Order — {{orderNumber}}</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;width:160px;">Order</td><td style="padding:6px 12px;">{{orderNumber}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Customer</td><td style="padding:6px 12px;">{{customerName}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Email</td><td style="padding:6px 12px;">{{customerEmail}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Phone</td><td style="padding:6px 12px;">{{customerPhone}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Address</td><td style="padding:6px 12px;">{{shippingAddress}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Items</td><td style="padding:6px 12px;">{{itemsList}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Total</td><td style="padding:6px 12px;">{{total}}</td></tr>
    <tr><td style="padding:6px 12px;background:#f5f7fa;font-weight:bold;">Stripe ID</td><td style="padding:6px 12px;">{{stripeSessionId}}</td></tr>
  </table>
</div>`.trim();

const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
const seedSettings = db.transaction((pairs) => { for (const [k, v] of pairs) insertSetting.run(k, v); });
seedSettings(Object.entries({
  notification_email:          'orders@neurotonics.com.au',
  admin_notification_email:    'admin@elitedigitalconsulting.com.au',
  buy_globally_enabled:        'true',
  promo_banner_visible:        'true',
  promo_banner_text:           'Free shipping on orders over $99 | ARTG Listed | Made in Australia',
  order_confirmation_template: DEFAULT_ORDER_TEMPLATE,
  admin_alert_template:        DEFAULT_ADMIN_ALERT_TEMPLATE,
  order_number_sequence:       '1000',
}));

// ---------------------------------------------------------------------------
// Legacy prepared statements (for backward compatibility with backup.js etc.)
// ---------------------------------------------------------------------------
const stmts = {
  getSetting:     db.prepare('SELECT value FROM settings WHERE key = ?'),
  getAllSettings: db.prepare('SELECT key, value FROM settings'),
  setSetting:     db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById:    db.prepare('SELECT id, email, role, name, created_at FROM users WHERE id = ?'),
  listUsers:      db.prepare('SELECT id, email, role, name, created_at FROM users ORDER BY created_at DESC'),
  createUser:     db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)'),
  updateUser:     db.prepare("UPDATE users SET email = ?, role = ?, name = ?, updated_at = datetime('now') WHERE id = ?"),
  updateUserPassword: db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"),
  deleteUser:     db.prepare('DELETE FROM users WHERE id = ?'),
  createOrder: db.prepare(`INSERT INTO orders (order_number, stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, shipping, subtotal, total, status, payment_status, notification_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  getOrderById:   db.prepare('SELECT * FROM orders WHERE id = ?'),
  getOrderByStripeId: db.prepare('SELECT * FROM orders WHERE stripe_session_id = ?'),
  getOrderByNumber:   db.prepare('SELECT * FROM orders WHERE order_number = ?'),
  updateOrderStatus: db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"),
  fulfillOrder:   db.prepare("UPDATE orders SET status='fulfilled', tracking_number=?, carrier=?, fulfillment_notes=?, fulfillment_date=datetime('now'), updated_at=datetime('now') WHERE id=?"),
  updateOrderNotes: db.prepare("UPDATE orders SET notes=?, admin_notes=?, updated_at=datetime('now') WHERE id=?"),
  listOrders:     db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  countOrders:    db.prepare('SELECT COUNT(*) as count FROM orders'),
  listOrdersByStatus: db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  countOrdersByStatus: db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = ?'),
  createStockistApplication: db.prepare(`INSERT INTO stockist_applications (full_name, business_name, abn, email, phone, business_address, industry, business_website, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  getStockistApplicationById: db.prepare('SELECT * FROM stockist_applications WHERE id = ?'),
  listStockistApplications: db.prepare('SELECT * FROM stockist_applications ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  countStockistApplications: db.prepare('SELECT COUNT(*) as count FROM stockist_applications'),
  listStockistApplicationsByStatus: db.prepare('SELECT * FROM stockist_applications WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  countStockistApplicationsByStatus: db.prepare('SELECT COUNT(*) as count FROM stockist_applications WHERE status = ?'),
  updateStockistApplication: db.prepare("UPDATE stockist_applications SET status=?, notes=?, updated_at=datetime('now') WHERE id=?"),
  getAllStockistApplications: db.prepare('SELECT * FROM stockist_applications ORDER BY created_at DESC'),
  saveSnapshot: db.prepare('INSERT INTO content_snapshots (filename, content, updated_by) VALUES (?, ?, ?)'),
  getSnapshots: db.prepare('SELECT id, filename, updated_by, updated_at FROM content_snapshots WHERE filename = ? ORDER BY updated_at DESC LIMIT 10'),
  createResetToken: db.prepare('INSERT OR REPLACE INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'),
  getResetToken: db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?'),
  deleteResetToken: db.prepare('DELETE FROM password_reset_tokens WHERE token = ?'),
  deleteResetTokensByUser: db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?'),
};

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------
function getSetting(key) { const r = stmts.getSetting.get(key); return r ? r.value : null; }
function getAllSettings() { return Object.fromEntries(stmts.getAllSettings.all().map(r => [r.key, r.value])); }
function setSetting(key, value) { stmts.setSetting.run(key, String(value)); }

// ---------------------------------------------------------------------------
// Async-compatible wrappers for new route files.
// These wrap synchronous better-sqlite3 in resolved Promises so route
// handlers can use `await` without needing to change the storage engine.
// ---------------------------------------------------------------------------
function run(sql, args = []) {
  return Promise.resolve(db.prepare(sql).run(...args));
}
function getRow(sql, args = []) {
  return Promise.resolve(db.prepare(sql).get(...args) ?? null);
}
function allRows(sql, args = []) {
  return Promise.resolve(db.prepare(sql).all(...args));
}
async function ready() { return true; }

// ---------------------------------------------------------------------------
// Debug helper
// ---------------------------------------------------------------------------
function logTableCounts() {
  try {
    const tables = ['users', 'orders', 'settings', 'stockist_applications'];
    const counts = tables.map(t => `${t}:${db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n}`).join(', ');
    console.log(`[db] Table counts — ${counts}`);
  } catch (err) {
    console.error('[db] logTableCounts error:', err.message);
  }
}

module.exports = {
  // Core database instance (used by backup.js, index.js, and legacy code)
  db,
  stmts,
  logTableCounts,
  ready,

  // Sync helpers (work with both sync and async callers via `await`)
  getSetting,
  getAllSettings,
  setSetting,

  // Async-friendly wrappers for new route files (run, get, all)
  run,
  get: getRow,
  all: allRows,
};
