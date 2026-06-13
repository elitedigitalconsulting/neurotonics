'use strict';

/**
 * server/backup.js
 *
 * File-based backup and restore for CMS data that must survive server
 * restarts and (when a persistent disk is mounted) full redeploys.
 *
 * What is backed up:
 *   - stockist_applications  — B2B applicant records
 *   - users                  — CMS admin/editor accounts
 *   - settings               — SMTP, banner, buy-toggle configuration
 *
 * What is intentionally excluded:
 *   - orders                 — contain customer PII (names, emails, addresses)
 *                              and are already recorded by Stripe; excluded to
 *                              keep backups safe for storage on disk.
 *   - content_snapshots      — large and re-creatable; not critical.
 *   - password_reset_tokens  — short-lived, no value in a backup.
 *
 * Backup lifecycle:
 *   1. On startup, if the DB tables are empty and a backup file exists,
 *      the server restores automatically (see restoreIfEmpty()).
 *   2. After every stockist application submission or status update,
 *      a fresh backup is written (see writeBackup()).
 *   3. Admins can download a full backup JSON and restore it via the
 *      /cms/backup/* API endpoints.
 *
 * Storage path:
 *   - Defaults to <server_dir>/data/backup-latest.json
 *   - If DB_BACKUP_DIR env var is set (e.g. to a Render persistent disk
 *     mount path like /data), backups survive full redeploys.
 */

const fs   = require('fs');
const path = require('path');

const { db } = require('./db');

const BACKUP_VERSION = 1;

// Resolve backup file path.
// DB_BACKUP_DIR takes priority; falls back to the server's own data/ dir.
function getBackupPath() {
  const dir = process.env.DB_BACKUP_DIR
    ? path.resolve(process.env.DB_BACKUP_DIR)
    : path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  }
  return path.join(dir, 'backup-latest.json');
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportStockistApplications() {
  try {
    return db.prepare('SELECT * FROM stockist_applications ORDER BY id ASC').all();
  } catch (err) {
    console.error('[backup] Failed to export stockist_applications:', err.message);
    return [];
  }
}

function exportUsers() {
  try {
    return db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  } catch (err) {
    console.error('[backup] Failed to export users:', err.message);
    return [];
  }
}

function exportSettings() {
  try {
    return db.prepare('SELECT * FROM settings').all();
  } catch (err) {
    console.error('[backup] Failed to export settings:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// writeBackup()
// Serialise current safe DB tables to the backup file.  Fire-and-forget —
// call this without awaiting; errors are logged but never propagated.
// ---------------------------------------------------------------------------
function writeBackup() {
  try {
    const backupPath = getBackupPath();

    const payload = {
      version:                BACKUP_VERSION,
      created_at:             new Date().toISOString(),
      stockist_applications:  exportStockistApplications(),
      users:                  exportUsers(),
      settings:               exportSettings(),
    };

    const json = JSON.stringify(payload, null, 2);
    fs.writeFileSync(backupPath, json, 'utf8');

    console.log(
      `[backup] Written to ${backupPath} ` +
      `(${payload.stockist_applications.length} applications, ` +
      `${payload.users.length} users, ` +
      `${payload.settings.length} settings)`
    );
  } catch (err) {
    console.error('[backup] writeBackup failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// buildBackupPayload()
// Returns the current backup as a plain JS object (used by the download API).
// ---------------------------------------------------------------------------
function buildBackupPayload() {
  return {
    version:               BACKUP_VERSION,
    created_at:            new Date().toISOString(),
    stockist_applications: exportStockistApplications(),
    users:                 exportUsers(),
    settings:              exportSettings(),
  };
}

// ---------------------------------------------------------------------------
// restoreFromPayload(payload)
// Merges records from a backup payload into the live DB.
// Uses INSERT OR IGNORE so existing records are never overwritten.
// ---------------------------------------------------------------------------
function restoreFromPayload(payload) {
  if (!payload || payload.version !== BACKUP_VERSION) {
    console.warn('[backup] restoreFromPayload: incompatible backup version or null payload.');
    return { restored: 0, skipped: 0 };
  }

  let restored = 0;
  let skipped  = 0;

  const restoreMany = db.transaction((rows, tableName, insertStmt) => {
    for (const row of rows) {
      try {
        insertStmt.run(row);
        restored++;
      } catch (err) {
        // UNIQUE constraint → row already exists; that's fine
        if (err.message && err.message.includes('UNIQUE')) {
          skipped++;
        } else {
          console.error(`[backup] restoreFromPayload (${tableName}) row error:`, err.message);
          skipped++;
        }
      }
    }
  });

  // Restore stockist_applications
  if (Array.isArray(payload.stockist_applications)) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO stockist_applications
        (id, full_name, business_name, abn, email, phone, business_address,
         industry, business_website, message, status, notes, created_at, updated_at)
      VALUES
        (@id, @full_name, @business_name, @abn, @email, @phone, @business_address,
         @industry, @business_website, @message, @status, @notes, @created_at, @updated_at)
    `);
    restoreMany(payload.stockist_applications, 'stockist_applications', stmt);
  }

  // Restore users
  if (Array.isArray(payload.users)) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users
        (id, email, password_hash, role, name, created_at, updated_at)
      VALUES
        (@id, @email, @password_hash, @role, @name, @created_at, @updated_at)
    `);
    restoreMany(payload.users, 'users', stmt);
  }

  // Restore settings
  if (Array.isArray(payload.settings)) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
    `);
    restoreMany(payload.settings, 'settings', stmt);
  }

  console.log(`[backup] Restore complete — ${restored} records restored, ${skipped} skipped (already existed).`);
  return { restored, skipped };
}

// ---------------------------------------------------------------------------
// restoreIfEmpty()
// Called at startup: if the DB looks brand-new (no stockist_applications
// and no non-admin users), attempt to restore from the backup file.
// This makes the server self-healing after a redeploy on Render free tier.
// ---------------------------------------------------------------------------
function restoreIfEmpty() {
  const backupPath = getBackupPath();

  if (!fs.existsSync(backupPath)) {
    console.log('[backup] No backup file found — starting with empty data (expected for first run).');
    return;
  }

  // Check if DB has any stockist applications or more than 1 user
  // (the bootstrap admin is always created first, so 1 user is normal for a fresh DB)
  const appCount  = db.prepare('SELECT COUNT(*) as count FROM stockist_applications').get().count;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  if (appCount > 0 || userCount > 1) {
    console.log(`[backup] DB already has data (${appCount} applications, ${userCount} users) — skipping restore.`);
    return;
  }

  console.log('[backup] DB appears empty — attempting restore from', backupPath);

  try {
    const raw     = fs.readFileSync(backupPath, 'utf8');
    const payload = JSON.parse(raw);
    const result  = restoreFromPayload(payload);
    console.log(`[backup] Startup restore: ${result.restored} records restored from ${backupPath}`);
  } catch (err) {
    console.error('[backup] Startup restore failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// schedulePeriodicBackup(intervalMs)
// Writes a backup every <intervalMs> milliseconds (default: every 5 minutes).
// Call this after startup restore so the initial state is captured.
// ---------------------------------------------------------------------------
function schedulePeriodicBackup(intervalMs = 5 * 60 * 1000) {
  // Write an immediate backup so a fresh DB state is captured right away.
  writeBackup();

  setInterval(() => {
    writeBackup();
  }, intervalMs);

  console.log(`[backup] Periodic backup scheduled every ${Math.round(intervalMs / 1000)}s → ${getBackupPath()}`);
}

module.exports = {
  writeBackup,
  buildBackupPayload,
  restoreFromPayload,
  restoreIfEmpty,
  schedulePeriodicBackup,
  getBackupPath,
};
