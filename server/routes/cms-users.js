'use strict';

const express = require('express');
const { requireAuth, requireRole, hashPassword } = require('../auth');
const db = require('../db');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', async (_req, res) => {
  const users = await db.all('SELECT id, email, role, name, created_at FROM users ORDER BY created_at DESC');
  return res.json({ users: users.map(u => ({ ...u, id: Number(u.id) })) });
});

router.post('/', async (req, res) => {
  const { email, password, role, name } = req.body || {};
  if (!email || typeof email !== 'string')                    return res.status(400).json({ error: 'Valid email is required.' });
  if (!password || typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (role && !['admin', 'editor'].includes(role))            return res.status(400).json({ error: 'Role must be "admin" or "editor".' });

  const normalEmail = email.trim().toLowerCase();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [normalEmail]);
  if (existing) return res.status(409).json({ error: 'A user with that email already exists.' });

  try {
    const hash   = await hashPassword(password);
    const result = await db.run('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)', [normalEmail, hash, role || 'editor', name || '']);
    const user   = await db.get('SELECT id, email, role, name, created_at FROM users WHERE id = ?', [Number(result.lastInsertRowid)]);
    return res.status(201).json({ user: { ...user, id: Number(user.id) } });
  } catch (err) {
    console.error('[cms-users] Create error:', err.message);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const { email, role, name } = req.body || {};
  const newEmail = email ? email.trim().toLowerCase() : existing.email;
  const newRole  = role  || existing.role;
  const newName  = name  !== undefined ? name : existing.name;

  if (!['admin', 'editor'].includes(newRole)) return res.status(400).json({ error: 'Role must be "admin" or "editor".' });

  await db.run("UPDATE users SET email = ?, role = ?, name = ?, updated_at = datetime('now') WHERE id = ?", [newEmail, newRole, newName, id]);
  const updated = await db.get('SELECT id, email, role, name, created_at FROM users WHERE id = ?', [id]);
  return res.json({ user: { ...updated, id: Number(updated.id) } });
});

router.patch('/:id/password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const { password } = req.body || {};
  if (!password || typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  const existing = await db.get('SELECT id FROM users WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const hash = await hashPassword(password);
  await db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, id]);
  return res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });
  if (id === req.user.sub) return res.status(400).json({ error: 'You cannot delete your own account.' });

  const existing = await db.get('SELECT id FROM users WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  await db.run('DELETE FROM users WHERE id = ?', [id]);
  return res.json({ success: true });
});

module.exports = router;
