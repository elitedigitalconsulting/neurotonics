'use strict';

/**
 * server/routes/cms-users.js
 *
 * User management — admin only.
 *
 * GET    /cms/users        — list all users
 * POST   /cms/users        — create user
 * PATCH  /cms/users/:id    — update name/email/role
 * DELETE /cms/users/:id    — delete user
 * PATCH  /cms/users/:id/password — change password
 */

const express = require('express');
const { requireAuth, requireRole, hashPassword } = require('../auth');
const { stmts } = require('../db');

const router = express.Router();

// All user management requires admin role
router.use(requireAuth, requireRole('admin'));

// ---------------------------------------------------------------------------
// GET /cms/users
// ---------------------------------------------------------------------------
router.get('/', (_req, res) => {
  const users = stmts.listUsers.all();
  return res.json({ users });
});

// ---------------------------------------------------------------------------
// POST /cms/users
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { email, password, role, name } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (role && !['admin', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "editor".' });
  }

  const normalEmail = email.trim().toLowerCase();
  const existing = stmts.getUserByEmail.get(normalEmail);
  if (existing) return res.status(409).json({ error: 'A user with that email already exists.' });

  try {
    const hash = await hashPassword(password);
    const result = stmts.createUser.run(normalEmail, hash, role || 'editor', name || '');
    const user = stmts.getUserById.get(result.lastInsertRowid);
    return res.status(201).json({ user });
  } catch (err) {
    console.error('[cms-users] Create error:', err.message);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /cms/users/:id
// ---------------------------------------------------------------------------
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const existing = stmts.getUserById.get(id);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const { email, role, name } = req.body || {};
  const newEmail = email ? email.trim().toLowerCase() : existing.email;
  const newRole  = role  || existing.role;
  const newName  = name  !== undefined ? name : existing.name;

  if (newRole && !['admin', 'editor'].includes(newRole)) {
    return res.status(400).json({ error: 'Role must be "admin" or "editor".' });
  }

  stmts.updateUser.run(newEmail, newRole, newName, id);
  const updated = stmts.getUserById.get(id);
  return res.json({ user: updated });
});

// ---------------------------------------------------------------------------
// PATCH /cms/users/:id/password
// ---------------------------------------------------------------------------
router.patch('/:id/password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const { password } = req.body || {};
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const existing = stmts.getUserById.get(id);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const hash = await hashPassword(password);
  stmts.updateUserPassword.run(hash, id);
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// DELETE /cms/users/:id
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  // Prevent self-deletion
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  const existing = stmts.getUserById.get(id);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  stmts.deleteUser.run(id);
  return res.json({ success: true });
});

module.exports = router;
