const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireCoach } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', String(req.params.userId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'));
  }
});

const router = express.Router();

router.post('/boxers', requireCoach, async (req, res) => {
  const { email, password, first_name, last_name, phone, date_of_birth, license_number, physical_address, wins, losses, draws, weight, weight_category, gender, competition_category } = req.body;
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
    INSERT INTO boxer_profiles (user_id, first_name, last_name, phone, date_of_birth, license_number, physical_address, wins, losses, draws, weight, weight_category, gender, competition_category)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `, [newUser.id, first_name || null, last_name || null, phone || null, date_of_birth || null,
      license_number || null, physical_address || null,
      wins || 0, losses || 0, draws || 0, weight || null, weight_category || null,
      gender || null, competition_category || null]);

  res.status(201).json({ id: newUser.id, email: email.toLowerCase().trim() });
});

router.get('/boxers', requireCoach, async (req, res) => {
  const boxers = await db.query(`
    SELECT u.id as user_id, u.email, u.created_at,
      bp.id as profile_id, bp.first_name, bp.last_name, bp.license_number,
      bp.wins, bp.losses, bp.draws, bp.weight, bp.weight_category,
      bp.phone, bp.date_of_birth, bp.gender, bp.competition_category, bp.updated_at
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
      bp.phone, bp.date_of_birth, bp.gender, bp.competition_category, bp.updated_at
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

  const { first_name, last_name, physical_address, license_number, wins, losses, draws, weight, weight_category, phone, date_of_birth, gender, competition_category } = req.body;
  const now = new Date().toISOString();

  await db.query(`
    UPDATE boxer_profiles SET
      first_name = $1, last_name = $2, physical_address = $3, license_number = $4,
      wins = $5, losses = $6, draws = $7, weight = $8, weight_category = $9,
      phone = $10, date_of_birth = $11, gender = $12, competition_category = $13, updated_at = $14
    WHERE user_id = $15
  `, [first_name, last_name, physical_address, license_number,
      wins || 0, losses || 0, draws || 0, weight, weight_category,
      phone, date_of_birth, gender || null, competition_category || null, now, req.params.userId]);

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

router.post('/boxers/:userId/documents', requireCoach, upload.single('document'), async (req, res) => {
  const [profile] = await db.query('SELECT id FROM boxer_profiles WHERE user_id = $1', [req.params.userId]);
  if (!profile) return res.status(404).json({ error: 'Boxeur introuvable' });
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });

  const [doc] = await db.query(
    'INSERT INTO documents (boxer_id, filename, original_name, document_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [profile.id, req.file.filename, req.file.originalname, req.body.document_type || 'Autre']
  );
  res.status(201).json(doc);
});

router.delete('/documents/:docId', requireCoach, async (req, res) => {
  const [doc] = await db.query('SELECT d.*, bp.user_id FROM documents d JOIN boxer_profiles bp ON bp.id = d.boxer_id WHERE d.id = $1', [req.params.docId]);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });

  const filePath = path.join(__dirname, '..', '..', 'uploads', String(doc.user_id), doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await db.query('DELETE FROM documents WHERE id = $1', [req.params.docId]);
  res.json({ success: true });
});

router.delete('/boxers/:userId', requireCoach, async (req, res) => {
  const [user] = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [req.params.userId, 'boxer']);
  if (!user) return res.status(404).json({ error: 'Boxeur introuvable' });
  await db.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
  res.json({ success: true });
});

module.exports = router;
