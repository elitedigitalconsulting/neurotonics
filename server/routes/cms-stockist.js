'use strict';

/**
 * server/routes/cms-stockist.js
 *
 * Stockist application management for the CMS dashboard.
 *
 * GET    /cms/stockist-applications              — paginated list (filters: status, search)
 * GET    /cms/stockist-applications/export.csv   — CSV download of all applications
 * GET    /cms/stockist-applications/:id          — single application
 * PATCH  /cms/stockist-applications/:id          — update status and/or notes
 */

const express = require('express');
const { requireAuth } = require('../auth');
const { db, stmts } = require('../db');
const { writeBackup } = require('../backup');

const router = express.Router();

const VALID_STATUSES = new Set(['new', 'reviewing', 'approved', 'rejected']);

// ---------------------------------------------------------------------------
// GET /cms/stockist-applications
// Query params: page, limit, status, search
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const search = req.query.search;

  try {
    let applications, total;

    if (search) {
      const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
      applications = db.prepare(`
        SELECT * FROM stockist_applications
        WHERE full_name LIKE ? ESCAPE '\\'
           OR business_name LIKE ? ESCAPE '\\'
           OR email LIKE ? ESCAPE '\\'
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(like, like, like, limit, offset);
      total = db.prepare(`
        SELECT COUNT(*) as count FROM stockist_applications
        WHERE full_name LIKE ? ESCAPE '\\'
           OR business_name LIKE ? ESCAPE '\\'
           OR email LIKE ? ESCAPE '\\'
      `).get(like, like, like).count;
    } else if (status && VALID_STATUSES.has(status)) {
      applications = stmts.listStockistApplicationsByStatus.all(status, limit, offset);
      total        = stmts.countStockistApplicationsByStatus.get(status).count;
    } else {
      applications = stmts.listStockistApplications.all(limit, offset);
      total        = stmts.countStockistApplications.get().count;
    }

    console.log(
      `[cms-stockist] LIST page=${page} limit=${limit} status=${status || 'all'} ` +
      `search=${search || 'none'} → ${applications.length}/${total} records returned`
    );

    return res.json({
      applications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[cms-stockist] List error:', err.message, err.stack);
    return res.status(500).json({ error: 'Failed to fetch applications.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/stockist-applications/export.csv
// ---------------------------------------------------------------------------
router.get('/export.csv', requireAuth, (req, res) => {
  try {
    const rows = stmts.getAllStockistApplications.all();
    console.log(`[cms-stockist] CSV export: ${rows.length} records`);

    const headers = [
      'ID', 'Date', 'Full Name', 'Business Name', 'ABN', 'Email', 'Phone',
      'Business Address', 'Industry', 'Business Website', 'Message', 'Status', 'Notes',
    ];

    function csvCell(value) {
      const str = value == null ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.id,
          r.created_at,
          r.full_name,
          r.business_name,
          r.abn,
          r.email,
          r.phone,
          r.business_address,
          r.industry,
          r.business_website,
          r.message,
          r.status,
          r.notes,
        ].map(csvCell).join(',')
      ),
    ];

    const filename = `stockist-applications-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + lines.join('\r\n'));
  } catch (err) {
    console.error('[cms-stockist] CSV export error:', err.message, err.stack);
    return res.status(500).json({ error: 'Failed to export applications.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/stockist-applications/:id
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid application ID.' });

  const application = stmts.getStockistApplicationById.get(id);
  if (!application) {
    console.warn(`[cms-stockist] GET #${id} — not found`);
    return res.status(404).json({ error: 'Application not found.' });
  }

  return res.json({ application });
});

// ---------------------------------------------------------------------------
// PATCH /cms/stockist-applications/:id  — update status and/or notes
// ---------------------------------------------------------------------------
router.patch('/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid application ID.' });

  const application = stmts.getStockistApplicationById.get(id);
  if (!application) {
    console.warn(`[cms-stockist] PATCH #${id} — not found`);
    return res.status(404).json({ error: 'Application not found.' });
  }

  const status = req.body.status !== undefined ? req.body.status : application.status;
  const notes  = req.body.notes  !== undefined ? String(req.body.notes).slice(0, 2000) : application.notes;

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${[...VALID_STATUSES].join(', ')}.`,
    });
  }

  stmts.updateStockistApplication.run(status, notes, id);
  const updated = stmts.getStockistApplicationById.get(id);

  console.log(
    `[cms-stockist] PATCH #${id} (${application.business_name}) ` +
    `status: ${application.status} → ${updated.status} | ` +
    `notes updated: ${notes !== application.notes}`
  );

  // Write a backup after every status or notes change so in-progress
  // review work is preserved across restarts.
  setImmediate(() => writeBackup());

  return res.json({ application: updated });
});

module.exports = router;
