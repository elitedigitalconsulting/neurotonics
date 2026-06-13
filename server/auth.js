'use strict';

const crypto  = require('crypto');
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { sendPasswordResetEmail } = require('./email');

const router = express.Router();

const ACCESS_SECRET  = process.env.CMS_JWT_SECRET         || 'change-me-access-secret';
const REFRESH_SECRET = process.env.CMS_JWT_REFRESH_SECRET || 'change-me-refresh-secret';
const ACCESS_TTL     = '1h';
const REFRESH_TTL    = '7d';
const BCRYPT_ROUNDS  = 12;
const COOKIE_NAME    = 'cms_refresh';

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
function signAccess(payload)  { return jwt.sign(payload, ACCESS_SECRET,  { expiresIn: ACCESS_TTL  }); }
function signRefresh(payload) { return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL }); }
function verifyAccess(token)  { return jwt.verify(token, ACCESS_SECRET); }
function verifyRefresh(token) { return jwt.verify(token, REFRESH_SECRET); }

// ---------------------------------------------------------------------------
// Password utilities
// ---------------------------------------------------------------------------
async function hashPassword(plain)      { return bcrypt.hash(plain, BCRYPT_ROUNDS); }
async function checkPassword(plain, h)  { return bcrypt.compare(plain, h); }

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = verifyAccess(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user)              return res.status(401).json({ error: 'Authentication required.' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Insufficient permissions.' });
    next();
  };
}

// ---------------------------------------------------------------------------
// POST /cms/auth/login
// ---------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user) {
    await bcrypt.compare(password, '$2a$12$invalidhashpadding000000000000000000000000000000000000000');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await checkPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

  const payload     = { sub: Number(user.id), email: user.email, role: user.role, name: user.name };
  const accessToken  = signAccess(payload);
  const refreshToken = signRefresh({ sub: Number(user.id) });

  res.cookie(COOKIE_NAME, refreshToken, {
    httpOnly: true, sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, path: '/cms/auth',
  });

  return res.json({ accessToken, user: { id: Number(user.id), email: user.email, role: user.role, name: user.name } });
});

// ---------------------------------------------------------------------------
// POST /cms/auth/refresh
// ---------------------------------------------------------------------------
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No refresh token.' });
  try {
    const payload = verifyRefresh(token);
    const user = await db.get('SELECT id, email, role, name FROM users WHERE id = ?', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    return res.json({ accessToken: signAccess({ sub: Number(user.id), email: user.email, role: user.role, name: user.name }) });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

// ---------------------------------------------------------------------------
// POST /cms/auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/cms/auth' });
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /cms/auth/me
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT id, email, role, name, created_at FROM users WHERE id = ?', [req.user.sub]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: { ...user, id: Number(user.id) } });
});

// ---------------------------------------------------------------------------
// POST /cms/auth/register
// ---------------------------------------------------------------------------
router.post('/register', registerLimiter, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (typeof email !== 'string' || !email.trim())       return res.status(400).json({ error: 'Valid email is required.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const normalEmail = email.trim().toLowerCase();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [normalEmail]);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  try {
    const hash   = await hashPassword(password);
    const result = await db.run('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)', [normalEmail, hash, 'editor', (name || '').trim()]);
    const id     = Number(result.lastInsertRowid);
    const user   = await db.get('SELECT id, email, role, name FROM users WHERE id = ?', [id]);

    const payload     = { sub: id, email: user.email, role: user.role, name: user.name };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh({ sub: id });

    res.cookie(COOKIE_NAME, refreshToken, {
      httpOnly: true, sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, path: '/cms/auth',
    });

    return res.status(201).json({ accessToken, user: { id, email: user.email, role: user.role, name: user.name } });
  } catch (err) {
    console.error('[auth] Register error:', err.message);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

// ---------------------------------------------------------------------------
// POST /cms/auth/forgot-password
// ---------------------------------------------------------------------------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'Email is required.' });

  const normalised = email.trim().toLowerCase();
  const user = await db.get('SELECT * FROM users WHERE email = ?', [normalised]);

  if (user) {
    await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [Number(user.id)]);
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run('INSERT OR REPLACE INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [token, Number(user.id), expiresAt]);

    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    try { await sendPasswordResetEmail(user, token, baseUrl); } catch (err) { console.error('Password reset email failed:', err); }
  }

  return res.json({ message: 'If that email exists in our system, a reset link has been sent.' });
});

// ---------------------------------------------------------------------------
// POST /cms/auth/reset-password
// ---------------------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !token.trim())         return res.status(400).json({ error: 'Reset token is required.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const row = await db.get('SELECT * FROM password_reset_tokens WHERE token = ?', [token.trim()]);
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset token.' });

  if (new Date(row.expires_at) < new Date()) {
    await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token.trim()]);
    return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
  }

  const user = await db.get('SELECT id FROM users WHERE id = ?', [row.user_id]);
  if (!user) {
    await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token.trim()]);
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }

  const hash = await hashPassword(password);
  await db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, row.user_id]);
  await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [row.user_id]);

  return res.json({ message: 'Password updated successfully. You can now log in.' });
});

module.exports = { router, requireAuth, requireRole, loginLimiter, hashPassword, checkPassword };
