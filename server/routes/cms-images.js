'use strict';

/**
 * server/routes/cms-images.js
 *
 * Image upload and management for the CMS media library.
 *
 * POST   /cms/images/upload     — upload + optimise image (multer + sharp)
 * GET    /cms/images            — list uploaded images
 * DELETE /cms/images/:filename  — delete image
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { requireAuth } = require('../auth');

const router = express.Router();

// Images are served from the server's own public/images directory.
// The frontend Next.js site has its own public/images which is deployed via
// GitHub Pages; uploads here are served by the Express server directly.
const UPLOAD_DIR = path.resolve(__dirname, '../public/images');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Allowed MIME types and extensions
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

// Multer: store to memory first so sharp can process before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only image files are allowed.'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error('Invalid file extension.'));
    }
    cb(null, true);
  },
});

// Sanitise filename: strip path components, allow only safe characters
function sanitiseFilename(name) {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

// Ensure no path traversal when resolving filenames
function resolveUploadPath(filename) {
  const safe = sanitiseFilename(filename);
  const resolved = path.resolve(UPLOAD_DIR, safe);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    throw new Error('Path traversal detected.');
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// POST /cms/images/upload
// ---------------------------------------------------------------------------
router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided.' });

  try {
    const ext  = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const base = sanitiseFilename(path.basename(req.file.originalname, ext));
    const ts   = Date.now();
    const outName = `${base}-${ts}.webp`;
    const outPath = path.join(UPLOAD_DIR, outName);

    // Re-encode to webp with max 1600px width for efficiency
    await sharp(req.file.buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outPath);

    const url = `/images/${outName}`;
    return res.status(201).json({ filename: outName, url });
  } catch (err) {
    console.error('[cms-images] Upload error:', err.message);
    return res.status(500).json({ error: 'Failed to process image.' });
  }
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Image upload failed.' });
});

// ---------------------------------------------------------------------------
// GET /cms/images
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (_req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ALLOWED_EXT.has(ext);
      })
      .map((f) => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, f));
        return { filename: f, url: `/images/${f}`, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    return res.json({ images: files });
  } catch (err) {
    console.error('[cms-images] List error:', err.message);
    return res.status(500).json({ error: 'Failed to list images.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /cms/images/:filename
// ---------------------------------------------------------------------------
router.delete('/:filename', requireAuth, (req, res) => {
  try {
    const filePath = resolveUploadPath(req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });

    // Double-check extension
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return res.status(400).json({ error: 'Not an image file.' });

    fs.unlinkSync(filePath);
    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'Path traversal detected.') {
      return res.status(400).json({ error: 'Invalid filename.' });
    }
    console.error('[cms-images] Delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete image.' });
  }
});

module.exports = router;
