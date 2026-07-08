const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'boxing-secret-2024';

// Seed default coach if not exists
const coachExists = db.prepare("SELECT id FROM users WHERE role='coach' LIMIT 1").get();
if (!coachExists) {
  const hash = bcrypt.hashSync('coach123', 10);
  const result = db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, 'coach')").run('coach@boxing.fr', hash);
  console.log('Compte coach créé : coach@boxing.fr / coach123');
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

  let profile = null;
  if (user.role === 'boxer') {
    profile = db.prepare('SELECT * FROM boxer_profiles WHERE user_id = ?').get(user.id);
  }

  res.json({ token, role: user.role, email: user.email, profile });
});

router.post('/register-boxer', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, 'boxer')").run(email.toLowerCase().trim(), hash);
  db.prepare('INSERT INTO boxer_profiles (user_id) VALUES (?)').run(result.lastInsertRowid);

  const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'boxer' }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ token, role: 'boxer', email });
});

module.exports = router;
