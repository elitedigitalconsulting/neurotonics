'use strict';

/**
 * server/routes/cms-backup.js
 *
 * Backup and restore endpoints for the CMS admin.
 *
 * GET  /cms/backup/status   — current backup file info (admin only)
 * GET  /cms/backup/download — download a full JSON backup (admin only)
 * POST /cms/backup/restore  — restore from a JSON backup payload (admin only)
 */

const express = require('express');
const fs      = require('fs');
const { requireAuth, requireRole } = require('../auth');
const { buildBackupPayload, restoreFromPayload, writeBackup, backupToGitHub, getBackupPath } = require('../backup');
const { isDataRepoReady, getDataRepoCoords } = require('../github');

const router = express.Router();

// All backup endpoints require admin role
router.use(requireAuth, requireRole('admin'));

// ---------------------------------------------------------------------------
// GET /cms/backup/status
// ---------------------------------------------------------------------------
router.get('/status', (_req, res) => {
  const backupPath     = getBackupPath();
  const dataRepoReady  = isDataRepoReady();
  const dataRepoCoords = getDataRepoCoords();

  const base = {
    githubDataRepo: {
      enabled:  !!(process.env.GITHUB_PAT),
      ready:    dataRepoReady,
      repo:     dataRepoCoords.full,
      repoUrl:  `https://github.com/${dataRepoCoords.full}`,
    },
  };

  if (!fs.existsSync(backupPath)) {
    return res.json({ ...base, exists: false, backupPath });
  }

  try {
    const stat = fs.statSync(backupPath);
    const raw  = fs.readFileSync(backupPath, 'utf8');
    const data = JSON.parse(raw);
    return res.json({
      ...base,
      exists:    true,
      backupPath,
      createdAt: data.created_at,
      fileSizeBytes: stat.size,
      counts: {
        stockist_applications: data.stockist_applications?.length ?? 0,
        users:                 data.users?.length                 ?? 0,
        settings:              data.settings?.length              ?? 0,
      },
    });
  } catch (err) {
    console.error('[cms-backup] status error:', err.message);
    return res.status(500).json({ error: 'Failed to read backup status.' });
  }
});

// ---------------------------------------------------------------------------
// POST /cms/backup/push-to-github
// Manually trigger an immediate GitHub backup (admin only).
// ---------------------------------------------------------------------------
router.post('/push-to-github', async (_req, res) => {
  try {
    await backupToGitHub();
    return res.json({ success: true });
  } catch (err) {
    console.error('[cms-backup] manual GitHub push error:', err.message);
    return res.status(500).json({ error: 'GitHub backup failed: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/backup/download
// Returns a downloadable JSON backup of all safe CMS data.
// Also refreshes the on-disk backup file at the same time.
// ---------------------------------------------------------------------------
router.get('/download', (_req, res) => {
  try {
    const payload  = buildBackupPayload();
    const filename = `neurotonics-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    // Persist to disk as well
    writeBackup();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('[cms-backup] download error:', err.message);
    return res.status(500).json({ error: 'Failed to generate backup.' });
  }
});

// ---------------------------------------------------------------------------
// POST /cms/backup/restore
// Body: the JSON payload from a previous download (or a compatible object).
// Merges records using INSERT OR IGNORE — existing rows are never overwritten.
// ---------------------------------------------------------------------------
router.post('/restore', express.json({ limit: '10mb' }), (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON backup object.' });
  }
  if (payload.version !== 1) {
    return res.status(400).json({ error: 'Unsupported backup version.' });
  }

  try {
    const result = restoreFromPayload(payload);
    console.log(
      `[cms-backup] Manual restore by ${req.user?.email}: ` +
      `${result.restored} restored, ${result.skipped} skipped`
    );

    // Refresh the on-disk backup to reflect the newly merged data
    writeBackup();

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[cms-backup] restore error:', err.message);
    return res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

module.exports = router;
