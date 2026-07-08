const express = require('express');
const db = require('../db');
const { requireCoach } = require('../middleware/auth');

const router = express.Router();

// GET all boxers with profiles
router.get('/boxers', requireCoach, (req, res) => {
  const boxers = db.prepare(`
    SELECT u.id as user_id, u.email, u.created_at,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.license_number,
      bp.wins, bp.losses, bp.draws, bp.weight, bp.weight_category,
      bp.phone, bp.date_of_birth, bp.updated_at
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    WHERE u.role = 'boxer'
    ORDER BY bp.last_name, bp.first_name
  `).all();

  res.json(boxers);
});

// GET one boxer detail
router.get('/boxers/:userId', requireCoach, (req, res) => {
  const boxer = db.prepare(`
    SELECT u.id as user_id, u.email, u.created_at,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.physical_address,
      bp.license_number, bp.wins, bp.losses, bp.draws, bp.weight, bp.weight_category,
      bp.phone, bp.date_of_birth, bp.updated_at
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    WHERE u.id = ? AND u.role = 'boxer'
  `).get(req.params.userId);

  if (!boxer) return res.status(404).json({ error: 'Boxeur introuvable' });

  const documents = boxer.profile_id
    ? db.prepare('SELECT id, original_name, document_type, uploaded_at FROM documents WHERE boxer_id = ? ORDER BY uploaded_at DESC').all(boxer.profile_id)
    : [];

  const payments = boxer.profile_id
    ? db.prepare('SELECT * FROM payments WHERE boxer_id = ? ORDER BY year DESC, month DESC').all(boxer.profile_id)
    : [];

  res.json({ ...boxer, documents, payments });
});

// GET payments summary for current month
router.get('/payments/month', requireCoach, (req, res) => {
  const now = new Date();
  const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

  const boxers = db.prepare(`
    SELECT u.id as user_id, u.email,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.license_number,
      p.paid, p.paid_at, p.amount
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    LEFT JOIN payments p ON p.boxer_id = bp.id AND p.month = ? AND p.year = ?
    WHERE u.role = 'boxer'
    ORDER BY bp.last_name, bp.first_name
  `).all(month, year);

  res.json({ month, year, boxers });
});

// PUT toggle payment status
router.put('/payments/:profileId/:month/:year', requireCoach, (req, res) => {
  const { profileId, month, year } = req.params;
  const { paid, amount } = req.body;

  const existing = db.prepare('SELECT id FROM payments WHERE boxer_id = ? AND month = ? AND year = ?').get(profileId, month, year);

  if (existing) {
    db.prepare('UPDATE payments SET paid = ?, paid_at = ?, amount = ? WHERE id = ?').run(
      paid ? 1 : 0,
      paid ? new Date().toISOString() : null,
      amount || 0,
      existing.id
    );
  } else {
    db.prepare('INSERT INTO payments (boxer_id, month, year, paid, paid_at, amount) VALUES (?, ?, ?, ?, ?, ?)').run(
      profileId, month, year,
      paid ? 1 : 0,
      paid ? new Date().toISOString() : null,
      amount || 0
    );
  }

  res.json({ success: true });
});

// PUT update boxer profile (by coach)
router.put('/boxers/:userId', requireCoach, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(req.params.userId, 'boxer');
  if (!user) return res.status(404).json({ error: 'Boxeur introuvable' });

  const { first_name, last_name, physical_address, license_number, wins, losses, draws, weight, weight_category, phone, date_of_birth } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE boxer_profiles SET
      first_name = ?, last_name = ?, physical_address = ?, license_number = ?,
      wins = ?, losses = ?, draws = ?, weight = ?, weight_category = ?,
      phone = ?, date_of_birth = ?, updated_at = ?
    WHERE user_id = ?
  `).run(first_name, last_name, physical_address, license_number,
    wins || 0, losses || 0, draws || 0, weight, weight_category,
    phone, date_of_birth, now, req.params.userId);

  res.json({ success: true });
});

// POST /api/coach/payments/notify — send reminder to unpaid boxers
router.post('/payments/notify', requireCoach, async (req, res) => {
  const { boxer_ids, month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'Mois et année requis' });

  const { sendPaymentReminder } = require('../email');

  let targets;
  if (boxer_ids && boxer_ids.length) {
    targets = boxer_ids.map(uid => db.prepare(`
      SELECT u.email, bp.first_name FROM users u
      LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
      WHERE u.id = ?
    `).get(uid)).filter(Boolean);
  } else {
    // All unpaid boxers for this month/year
    targets = db.prepare(`
      SELECT u.email, bp.first_name
      FROM users u
      LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
      LEFT JOIN payments p ON p.boxer_id = bp.id AND p.month = ? AND p.year = ?
      WHERE u.role = 'boxer' AND (p.paid IS NULL OR p.paid = 0)
    `).all(month, year);
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

// DELETE boxer
router.delete('/boxers/:userId', requireCoach, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(req.params.userId, 'boxer');
  if (!user) return res.status(404).json({ error: 'Boxeur introuvable' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

module.exports = router;
