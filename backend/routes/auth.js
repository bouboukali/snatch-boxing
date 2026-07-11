const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'boxing-secret-2024';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });

  const [user] = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

  let profile = null;
  if (user.role === 'boxer') {
    [profile] = await db.query('SELECT * FROM boxer_profiles WHERE user_id = $1', [user.id]);
  }

  res.json({ token, role: user.role, email: user.email, profile });
});

router.post('/register-boxer', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });

  const [existing] = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const [newUser] = await db.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'boxer') RETURNING id",
    [email.toLowerCase().trim(), hash]
  );
  await db.query('INSERT INTO boxer_profiles (user_id) VALUES ($1)', [newUser.id]);

  const token = jwt.sign({ id: newUser.id, email, role: 'boxer' }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ token, role: 'boxer', email });
});

module.exports = router;
