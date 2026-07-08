const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'boxing-secret-2024';

// Seed default admin if not exists
const adminExists = db.prepare('SELECT id FROM admin_credentials LIMIT 1').get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_credentials (email, password) VALUES (?, ?)').run('admin@snatch.fr', hash);
  console.log('Compte admin créé : admin@snatch.fr / admin123');
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });

  const admin = db.prepare('SELECT * FROM admin_credentials WHERE email = ?').get(email.toLowerCase().trim());
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: 'admin', email: admin.email });
});

// GET /api/admin/users — list all users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.role, u.created_at,
      bp.first_name, bp.last_name
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    ORDER BY u.role DESC, bp.last_name ASC
  `).all();
  res.json(users);
});

// POST /api/admin/impersonate/:userId — get a token for any user
router.post('/impersonate/:userId', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: user.role, email: user.email });
});

module.exports = router;
