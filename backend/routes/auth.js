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

  res.json({ token, role: user.role, email: user.email, profile, must_change_password: !!user.must_change_password });
});

router.post('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Non autorisé' });
  const token = authHeader.split(' ')[1];
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token invalide' }); }

  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });

  const hash = bcrypt.hashSync(new_password, 10);
  await db.query('UPDATE users SET password = $1, must_change_password = 0 WHERE id = $2', [hash, decoded.id]);
  res.json({ success: true });
});

router.get('/confirm-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token manquant');

  const [user] = await db.query(
    'SELECT id, pending_email, email_token_expires FROM users WHERE email_token = $1',
    [token]
  );

  if (!user) return res.status(400).send('Lien invalide ou déjà utilisé');
  if (new Date(user.email_token_expires) < new Date()) {
    return res.status(400).send('Lien expiré. Faites une nouvelle demande depuis l\'application.');
  }

  await db.query(
    'UPDATE users SET email = $1, pending_email = NULL, email_token = NULL, email_token_expires = NULL WHERE id = $2',
    [user.pending_email, user.id]
  );

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8"><title>Email confirmé</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:Arial,sans-serif;background:#080808;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .box{text-align:center;padding:40px;background:#141414;border-radius:12px;max-width:420px;border:1px solid #222}
      h2{color:#C9A020;margin-bottom:8px}
      p{color:#aaa;margin:12px 0}
      a{display:inline-block;margin-top:20px;padding:12px 28px;background:#C9A020;color:#000;font-weight:700;border-radius:8px;text-decoration:none}
    </style>
    </head>
    <body>
      <div class="box">
        <h2>Email confirmé ✓</h2>
        <p>Votre adresse email a bien été mise à jour.</p>
        <p>Reconnectez-vous avec votre nouvelle adresse.</p>
        <a href="/">Retour à l'application</a>
      </div>
    </body>
    </html>
  `);
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
