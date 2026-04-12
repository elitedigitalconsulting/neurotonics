'use strict';

/**
 * server/routes/cms-content.js
 *
 * Manages the content JSON files in src/content/:
 *   GET  /cms/content/:file        — read current file
 *   PUT  /cms/content/:file        — write + snapshot + trigger rebuild
 *   GET  /cms/content/:file/history — last 10 snapshots for the file
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../auth');
const { stmts } = require('../db');
const { triggerRebuild } = require('../github');

const router = express.Router();

// Allowed content files (whitelist to prevent path traversal)
const ALLOWED_FILES = new Set(['site.json', 'product.json', 'quiz.json', 'shipping.json']);

// Resolve the content directory relative to the repo root
// server/ is one level below the repo root
const CONTENT_DIR = path.resolve(__dirname, '../../src/content');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resolveFile(filename) {
  if (!ALLOWED_FILES.has(filename)) return null;
  return path.join(CONTENT_DIR, filename);
}

// ---------------------------------------------------------------------------
// GET /cms/content/:file
// ---------------------------------------------------------------------------
router.get('/:file', requireAuth, (req, res) => {
  const filePath = resolveFile(req.params.file);
  if (!filePath) return res.status(404).json({ error: 'File not found or not allowed.' });

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return res.json({ filename: req.params.file, content: parsed });
  } catch (err) {
    console.error('[cms-content] Read error:', err.message);
    return res.status(500).json({ error: 'Failed to read content file.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /cms/content/:file
// ---------------------------------------------------------------------------
router.put('/:file', requireAuth, (req, res) => {
  const filePath = resolveFile(req.params.file);
  if (!filePath) return res.status(404).json({ error: 'File not found or not allowed.' });

  const { content } = req.body;
  if (content === undefined || content === null) {
    return res.status(400).json({ error: 'Request body must include a `content` field.' });
  }
  if (typeof content !== 'object') {
    return res.status(400).json({ error: '`content` must be a JSON object.' });
  }

  try {
    const serialised = JSON.stringify(content, null, 2);

    // Save snapshot before overwriting
    stmts.saveSnapshot.run(req.params.file, serialised, req.user.sub);

    // Write the file
    fs.writeFileSync(filePath, serialised + '\n', 'utf8');

    // Trigger async rebuild (non-blocking — don't fail the response if it errors)
    triggerRebuild({ file: req.params.file, updatedBy: req.user.email }).catch((err) => {
      console.error('[cms-content] Rebuild trigger failed:', err.message);
    });

    return res.json({ success: true, filename: req.params.file });
  } catch (err) {
    console.error('[cms-content] Write error:', err.message);
    return res.status(500).json({ error: 'Failed to write content file.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/content/:file/history
// ---------------------------------------------------------------------------
router.get('/:file/history', requireAuth, (req, res) => {
  if (!ALLOWED_FILES.has(req.params.file)) {
    return res.status(404).json({ error: 'File not found or not allowed.' });
  }
  const rows = stmts.getSnapshots.all(req.params.file);
  return res.json({ filename: req.params.file, snapshots: rows });
});

module.exports = router;
