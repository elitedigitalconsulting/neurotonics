'use strict';

/**
 * server/auth.js
 *
 * JWT + bcrypt authentication for the Neurotonics CMS.
 *
 * Exports:
 *   router        — Express router with /cms/auth/* routes
 *   requireAuth   — middleware: validates Bearer JWT access token
 *   requireRole   — middleware factory: requireRole('admin')
 *   loginLimiter  — rate-limit middleware for the login endpoint
 */

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { stmts, getSetting } = require('./db');
const { sendPasswordResetEmail } = require('./email');

const router = express.Router();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ACCESS_SECRET  = process.env.CMS_JWT_SECRET         || 'change-me-access-secret';
const REFRESH_SECRET = process.env.CMS_JWT_REFRESH_SECRET || 'change-me-refresh-secret';
const ACCESS_TTL     = '1h';
const REFRESH_TTL    = '7d';
const BCRYPT_ROUNDS  = 12;

const COOKIE_NAME = 'cms_refresh';

// ---------------------------------------------------------------------------
// Rate limiter — 5 failed attempts per 15 minutes per IP
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
  skipSuccessfulRequests: true,
});

// Rate limiter for forgot-password — 3 requests per 15 minutes per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// ---------------------------------------------------------------------------
// Password utilities (exported so bootstrap can hash initial admin password)
// ---------------------------------------------------------------------------
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// Middleware: requireAuth
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccess(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ---------------------------------------------------------------------------
// Middleware: requireRole
// ---------------------------------------------------------------------------
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
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

  const user = stmts.getUserByEmail.get(email.trim().toLowerCase());
  if (!user) {
    // Prevent timing attacks — still run bcrypt even on unknown email
    await bcrypt.compare(password, '$2a$12$invalidhashpadding000000000000000000000000000000000000000');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await checkPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken  = signAccess(payload);
  const refreshToken = signRefresh({ sub: user.id });

  // Set refresh token as httpOnly, SameSite=Strict cookie
  res.cookie(COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/cms/auth',
  });

  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
  });
});

// ---------------------------------------------------------------------------
// POST /cms/auth/refresh
// ---------------------------------------------------------------------------
router.post('/refresh', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No refresh token.' });

  try {
    const payload = verifyRefresh(token);
    const user = stmts.getUserById.get(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const newAccess = signAccess({ sub: user.id, email: user.email, role: user.role, name: user.name });
    return res.json({ accessToken: newAccess });
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
// GET /cms/auth/me  (requires valid access token)
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  const user = stmts.getUserById.get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user });
});

// ---------------------------------------------------------------------------
// POST /cms/auth/forgot-password
// Always returns 200 to avoid leaking whether the email exists.
// ---------------------------------------------------------------------------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalised = email.trim().toLowerCase();
  const user = stmts.getUserByEmail.get(normalised);

  if (user) {
    // Delete any existing tokens for this user then create a new one
    stmts.deleteResetTokensByUser.run(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    stmts.createResetToken.run(token, user.id, expiresAt);

    // Determine the base URL for the reset link
    const baseUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.SERVER_URL ||
      `${req.protocol}://${req.get('host')}`;

    try {
      await sendPasswordResetEmail(user, token, baseUrl);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      // Don't expose the error to the client
    }
  }

  // Always respond with success to prevent email enumeration
  return res.json({ message: 'If that email exists in our system, a reset link has been sent.' });
});

// ---------------------------------------------------------------------------
// POST /cms/auth/reset-password
// ---------------------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};

  if (typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'Reset token is required.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const row = stmts.getResetToken.get(token.trim());
  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }

  if (new Date(row.expires_at) < new Date()) {
    stmts.deleteResetToken.run(token.trim());
    return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
  }

  const user = stmts.getUserById.get(row.user_id);
  if (!user) {
    stmts.deleteResetToken.run(token.trim());
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }

  const hash = await hashPassword(password);
  stmts.updateUserPassword.run(hash, row.user_id);
  stmts.deleteResetTokensByUser.run(row.user_id);

  return res.json({ message: 'Password updated successfully. You can now log in.' });
});

module.exports = { router, requireAuth, requireRole, loginLimiter, hashPassword, checkPassword };
