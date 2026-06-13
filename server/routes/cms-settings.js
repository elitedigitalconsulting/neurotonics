'use strict';

const express = require('express');
const { requireAuth, requireRole } = require('../auth');
const db = require('../db');

const router = express.Router();

const HIDDEN_KEYS     = new Set(['order_confirmation_template', 'admin_alert_template']);
const ADMIN_ONLY_KEYS = new Set(['order_confirmation_template', 'admin_alert_template']);

router.get('/', requireAuth, async (_req, res) => {
  const all      = await db.getAllSettings();
  const filtered = Object.fromEntries(Object.entries(all).filter(([k]) => !HIDDEN_KEYS.has(k)));
  return res.json({ settings: filtered });
});

router.get('/templates', requireAuth, requireRole('admin'), async (_req, res) => {
  const all = await db.getAllSettings();
  return res.json({
    order_confirmation_template: all.order_confirmation_template || '',
    admin_alert_template:        all.admin_alert_template        || '',
  });
});

router.patch('/', requireAuth, async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ error: 'Body must be a JSON object.' });
  }

  const adminOnlyAttempts = Object.keys(updates).filter(k => ADMIN_ONLY_KEYS.has(k));
  if (adminOnlyAttempts.length > 0 && req.user.role !== 'admin') {
    return res.status(403).json({ error: `Only admins may update: ${adminOnlyAttempts.join(', ')}.` });
  }

  for (const [key, value] of Object.entries(updates)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    await db.setSetting(key, String(value));
  }

  return res.json({ success: true });
});

router.post('/test-email', requireAuth, requireRole('admin'), async (req, res) => {
  const { to } = req.body;
  const trimmed  = typeof to === 'string' ? to.trim() : '';
  const atIndex  = trimmed.indexOf('@');
  const isValid  = atIndex > 0 && atIndex === trimmed.lastIndexOf('@') && atIndex < trimmed.length - 1;
  if (!isValid) return res.status(400).json({ error: 'Valid `to` email address required.' });

  const { sendEmail, emailStatus } = require('../email');
  const status = emailStatus();
  if (!status.configured) {
    return res.status(503).json({
      error: status.message,
      fix: 'Set RESEND_API_KEY (recommended) or EMAIL_USER + EMAIL_PASS in Render environment variables.',
    });
  }

  try {
    await sendEmail({
      to: trimmed,
      subject: 'Neurotonics CMS — Email Test',
      html: '<p>If you received this, your email configuration is working correctly.</p>',
      text: 'If you received this, your email configuration is working correctly.',
    });
    return res.json({ success: true, provider: status.provider });
  } catch (err) {
    return res.status(500).json({ error: `Email send failed: ${err.message}` });
  }
});

module.exports = router;
