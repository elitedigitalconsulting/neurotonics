'use strict';

/**
 * server/routes/cms-settings.js
 *
 * Global CMS settings management.
 *
 * GET  /cms/settings        — get all settings (filtered to non-template keys)
 * PATCH /cms/settings       — update one or more settings
 */

const express = require('express');
const { requireAuth, requireRole } = require('../auth');
const { getAllSettings, setSetting } = require('../db');

const router = express.Router();

// Keys that should not be exposed via the GET endpoint (template HTML is large)
const HIDDEN_KEYS = new Set(['order_confirmation_template', 'admin_alert_template']);

// Keys that only admins may change
const ADMIN_ONLY_KEYS = new Set([
  'order_confirmation_template',
  'admin_alert_template',
]);

// ---------------------------------------------------------------------------
// GET /cms/settings
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (_req, res) => {
  const all = getAllSettings();
  const filtered = Object.fromEntries(
    Object.entries(all).filter(([k]) => !HIDDEN_KEYS.has(k))
  );
  return res.json({ settings: filtered });
});

// ---------------------------------------------------------------------------
// GET /cms/settings/templates  (admin only)
// ---------------------------------------------------------------------------
router.get('/templates', requireAuth, requireRole('admin'), (_req, res) => {
  const all = getAllSettings();
  return res.json({
    order_confirmation_template: all.order_confirmation_template || '',
    admin_alert_template:        all.admin_alert_template        || '',
  });
});

// ---------------------------------------------------------------------------
// PATCH /cms/settings
// Body: { key: value, ... }
// ---------------------------------------------------------------------------
router.patch('/', requireAuth, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ error: 'Body must be a JSON object of key-value pairs.' });
  }

  // Check admin-only keys
  const adminOnlyAttempts = Object.keys(updates).filter((k) => ADMIN_ONLY_KEYS.has(k));
  if (adminOnlyAttempts.length > 0 && req.user.role !== 'admin') {
    return res.status(403).json({
      error: `Only admins may update: ${adminOnlyAttempts.join(', ')}.`,
    });
  }

  for (const [key, value] of Object.entries(updates)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    setSetting(key, String(value));
  }

  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /cms/settings/test-email  (admin only)
// ---------------------------------------------------------------------------
const nodemailer = require('nodemailer');

router.post('/test-email', requireAuth, requireRole('admin'), async (req, res) => {
  const { to } = req.body;
  // Basic email validation: must contain exactly one @ with non-empty local and domain parts
  const trimmed = typeof to === 'string' ? to.trim() : '';
  const atIndex = trimmed.indexOf('@');
  const isValidEmail =
    atIndex > 0 &&
    atIndex === trimmed.lastIndexOf('@') &&
    atIndex < trimmed.length - 1;
  if (!isValidEmail) {
    return res.status(400).json({ error: 'Valid `to` email address required.' });
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER || '', pass: process.env.EMAIL_PASS || '' },
  });

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@neurotonics.com.au',
      to:      trimmed,
      subject: 'Neurotonics CMS — Email Test',
      text:    'If you received this, your email configuration is working correctly.',
    });
    return res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Email send failed: ${msg}` });
  }
});

module.exports = router;
