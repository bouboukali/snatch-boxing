const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'boxing-secret-2024';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });

  const [admin] = await db.query('SELECT * FROM admin_credentials WHERE email = $1', [email.toLowerCase().trim()]);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: 'admin', email: admin.email });
});

router.get('/users', requireAdmin, async (req, res) => {
  const users = await db.query(`
    SELECT u.id, u.email, u.role, u.created_at,
      bp.first_name, bp.last_name
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    ORDER BY u.role DESC, bp.last_name ASC
  `);
  res.json(users);
});

router.post('/impersonate/:userId', requireAdmin, async (req, res) => {
  const [user] = await db.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: user.role, email: user.email });
});

module.exports = router;
