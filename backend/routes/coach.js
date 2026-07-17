const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireCoach } = require('../middleware/auth');

const router = express.Router();

router.post('/boxers', requireCoach, async (req, res) => {
  const { email, password, first_name, last_name, phone, date_of_birth, license_number, physical_address, wins, losses, draws, weight, weight_category } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Mot de passe requis (min 6 caractères)' });

  const [existing] = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const [newUser] = await db.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'boxer') RETURNING id",
    [email.toLowerCase().trim(), hash]
  );

  await db.query(`
    INSERT INTO boxer_profiles (user_id, first_name, last_name, phone, date_of_birth, license_number, physical_address, wins, losses, draws, weight, weight_category)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [newUser.id, first_name || null, last_name || null, phone || null, date_of_birth || null,
      license_number || null, physical_address || null,
      wins || 0, losses || 0, draws || 0, weight || null, weight_category || null]);

  res.status(201).json({ id: newUser.id, email: email.toLowerCase().trim() });
});

router.get('/boxers', requireCoach, async (req, res) => {
  const boxers = await db.query(`
    SELECT u.id as user_id, u.email, u.created_at,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.license_number,
      bp.wins, bp.losses, bp.draws, bp.weight, bp.weight_category,
      bp.phone, bp.date_of_birth, bp.updated_at
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    WHERE u.role = 'boxer'
    ORDER BY bp.last_name, bp.first_name
  `);
  res.json(boxers);
});

router.get('/boxers/:userId', requireCoach, async (req, res) => {
  const [boxer] = await db.query(`
    SELECT u.id as user_id, u.email, u.created_at,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.physical_address,
      bp.license_number, bp.wins, bp.losses, bp.draws, bp.weight, bp.weight_category,
      bp.phone, bp.date_of_birth, bp.updated_at
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    WHERE u.id = $1 AND u.role = 'boxer'
  `, [req.params.userId]);

  if (!boxer) return res.status(404).json({ error: 'Boxeur introuvable' });

  const documents = boxer.profile_id
    ? await db.query('SELECT id, original_name, document_type, uploaded_at FROM documents WHERE boxer_id = $1 ORDER BY uploaded_at DESC', [boxer.profile_id])
    : [];

  const payments = boxer.profile_id
    ? await db.query('SELECT * FROM payments WHERE boxer_id = $1 ORDER BY year DESC, month DESC', [boxer.profile_id])
    : [];

  res.json({ ...boxer, documents, payments });
});

router.get('/payments/month', requireCoach, async (req, res) => {
  const now = new Date();
  const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

  const boxers = await db.query(`
    SELECT u.id as user_id, u.email,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.license_number,
      p.paid, p.paid_at, p.amount
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    LEFT JOIN payments p ON p.boxer_id = bp.id AND p.month = $1 AND p.year = $2
    WHERE u.role = 'boxer'
    ORDER BY bp.last_name, bp.first_name
  `, [month, year]);

  res.json({ month, year, boxers });
});

router.put('/payments/:profileId/:month/:year', requireCoach, async (req, res) => {
  const { profileId, month, year } = req.params;
  const { paid, amount } = req.body;

  const [existing] = await db.query('SELECT id FROM payments WHERE boxer_id = $1 AND month = $2 AND year = $3', [profileId, month, year]);

  if (existing) {
    await db.query('UPDATE payments SET paid = $1, paid_at = $2, amount = $3 WHERE id = $4', [
      paid ? 1 : 0,
      paid ? new Date().toISOString() : null,
      amount || 0,
      existing.id
    ]);
  } else {
    await db.query('INSERT INTO payments (boxer_id, month, year, paid, paid_at, amount) VALUES ($1, $2, $3, $4, $5, $6)', [
      profileId, month, year,
      paid ? 1 : 0,
      paid ? new Date().toISOString() : null,
      amount || 0
    ]);
  }

  res.json({ success: true });
});

router.put('/boxers/:userId', requireCoach, async (req, res) => {
  const [user] = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [req.params.userId, 'boxer']);
  if (!user) return res.status(404).json({ error: 'Boxeur introuvable' });

  const { first_name, last_name, physical_address, license_number, wins, losses, draws, weight, weight_category, phone, date_of_birth } = req.body;
  const now = new Date().toISOString();

  await db.query(`
    UPDATE boxer_profiles SET
      first_name = $1, last_name = $2, physical_address = $3, license_number = $4,
      wins = $5, losses = $6, draws = $7, weight = $8, weight_category = $9,
      phone = $10, date_of_birth = $11, updated_at = $12
    WHERE user_id = $13
  `, [first_name, last_name, physical_address, license_number,
      wins || 0, losses || 0, draws || 0, weight, weight_category,
      phone, date_of_birth, now, req.params.userId]);

  res.json({ success: true });
});

router.post('/payments/notify', requireCoach, async (req, res) => {
  const { boxer_ids, month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'Mois et année requis' });

  const { sendPaymentReminder } = require('../email');

  let targets;
  if (boxer_ids && boxer_ids.length) {
    const placeholders = boxer_ids.map((_, i) => `$${i + 1}`).join(',');
    targets = await db.query(`
      SELECT u.email, bp.first_name FROM users u
      LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
      WHERE u.id IN (${placeholders})
    `, boxer_ids);
  } else {
    targets = await db.query(`
      SELECT u.email, bp.first_name
      FROM users u
      LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
      LEFT JOIN payments p ON p.boxer_id = bp.id AND p.month = $1 AND p.year = $2
      WHERE u.role = 'boxer' AND (p.paid IS NULL OR p.paid = 0)
    `, [month, year]);
  }

  let sent = 0;
  for (const t of targets) {
    try {
      await sendPaymentReminder(t.email, { first_name: t.first_name, month: parseInt(month), year: parseInt(year) });
      sent++;
    } catch(e) {
      console.error('Email error:', e.message);
    }
  }

  res.json({ sent, total: targets.length });
});

router.delete('/boxers/:userId', requireCoach, async (req, res) => {
  const [user] = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [req.params.userId, 'boxer']);
  if (!user) return res.status(404).json({ error: 'Boxeur introuvable' });
  await db.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
  res.json({ success: true });
});

module.exports = router;
