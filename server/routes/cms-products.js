'use strict';

/**
 * server/routes/cms-products.js
 *
 * Product management — reads/writes src/content/product.json.
 * Supports the current single-object format as well as a future
 * array format (wraps single objects automatically).
 *
 * GET  /cms/products         — list all products
 * GET  /cms/products/:slug   — get one product
 * POST /cms/products         — create product
 * PUT  /cms/products/:slug   — replace product
 * DELETE /cms/products/:slug — remove product
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../auth');
const { stmts } = require('../db');
const { triggerRebuild } = require('../github');

const router = express.Router();

const PRODUCT_FILE = path.resolve(__dirname, '../../src/content/product.json');

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
function readProducts() {
  const raw = fs.readFileSync(PRODUCT_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  // Support single-object or array format
  return Array.isArray(parsed) ? parsed : [parsed];
}

function writeProducts(products) {
  // Keep single-object format if only one product (backward compat)
  const out = products.length === 1 ? products[0] : products;
  fs.writeFileSync(PRODUCT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
}

function saveSnapshot(userId) {
  try {
    const raw = fs.readFileSync(PRODUCT_FILE, 'utf8');
    stmts.saveSnapshot.run('product.json', raw, userId);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// GET /cms/products
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (_req, res) => {
  try {
    const products = readProducts();
    return res.json({ products });
  } catch (err) {
    console.error('[cms-products] Read error:', err.message);
    return res.status(500).json({ error: 'Failed to read products.' });
  }
});

// ---------------------------------------------------------------------------
// GET /cms/products/:slug
// ---------------------------------------------------------------------------
router.get('/:slug', requireAuth, (req, res) => {
  try {
    const products = readProducts();
    const product = products.find((p) => p.slug === req.params.slug);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    return res.json({ product });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read products.' });
  }
});

// ---------------------------------------------------------------------------
// POST /cms/products  (admin only)
// ---------------------------------------------------------------------------
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }
  if (!data.name || typeof data.name !== 'string') {
    return res.status(400).json({ error: '`name` is required.' });
  }

  try {
    const products = readProducts();
    const slug = data.slug || slugify(data.name);

    if (products.some((p) => p.slug === slug)) {
      return res.status(409).json({ error: `Product with slug "${slug}" already exists.` });
    }

    const newProduct = {
      name:             data.name,
      slug,
      price:            typeof data.price === 'number' ? data.price : 0,
      currency:         data.currency || 'AUD',
      shortDescription: data.shortDescription || '',
      longDescription:  data.longDescription  || '',
      images:           Array.isArray(data.images) ? data.images : [],
      badges:           Array.isArray(data.badges) ? data.badges : [],
      servingSize:      data.servingSize || '',
      capsuleCount:     data.capsuleCount || 0,
      supply:           data.supply || '',
      ingredients:      Array.isArray(data.ingredients) ? data.ingredients : [],
      stockPercent:     typeof data.stockPercent === 'number' ? data.stockPercent : 100,
      unitsLeft:        typeof data.unitsLeft === 'number' ? data.unitsLeft : 0,
      inStock:          data.inStock !== false,
      faq:              Array.isArray(data.faq) ? data.faq : [],
    };

    saveSnapshot(req.user.sub);
    products.push(newProduct);
    writeProducts(products);

    triggerRebuild({ file: 'product.json', action: 'create', slug }).catch(console.error);

    return res.status(201).json({ product: newProduct });
  } catch (err) {
    console.error('[cms-products] Create error:', err.message);
    return res.status(500).json({ error: 'Failed to create product.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /cms/products/:slug
// ---------------------------------------------------------------------------
router.put('/:slug', requireAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  try {
    const products = readProducts();
    const idx = products.findIndex((p) => p.slug === req.params.slug);
    if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

    // Merge — only update provided keys
    const updated = { ...products[idx], ...data, slug: req.params.slug };
    saveSnapshot(req.user.sub);
    products[idx] = updated;
    writeProducts(products);

    triggerRebuild({ file: 'product.json', action: 'update', slug: req.params.slug }).catch(console.error);

    return res.json({ product: updated });
  } catch (err) {
    console.error('[cms-products] Update error:', err.message);
    return res.status(500).json({ error: 'Failed to update product.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /cms/products/:slug  (admin only)
// ---------------------------------------------------------------------------
router.delete('/:slug', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const products = readProducts();
    const filtered = products.filter((p) => p.slug !== req.params.slug);
    if (filtered.length === products.length) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    saveSnapshot(req.user.sub);
    writeProducts(filtered);

    triggerRebuild({ file: 'product.json', action: 'delete', slug: req.params.slug }).catch(console.error);

    return res.json({ success: true });
  } catch (err) {
    console.error('[cms-products] Delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

module.exports = router;
