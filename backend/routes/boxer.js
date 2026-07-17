const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireBoxer } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', String(req.user.id));
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

router.get('/profile', requireBoxer, async (req, res) => {
  const [profile] = await db.query('SELECT * FROM boxer_profiles WHERE user_id = $1', [req.user.id]);
  res.json(profile || {});
});

router.put('/profile', requireBoxer, async (req, res) => {
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
      phone, date_of_birth, gender || null, competition_category || null, now, req.user.id]);

  res.json({ success: true });
});

router.get('/documents', requireBoxer, async (req, res) => {
  const [profile] = await db.query('SELECT id FROM boxer_profiles WHERE user_id = $1', [req.user.id]);
  if (!profile) return res.json([]);
  const docs = await db.query('SELECT * FROM documents WHERE boxer_id = $1 ORDER BY uploaded_at DESC', [profile.id]);
  res.json(docs);
});

router.post('/documents', requireBoxer, upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
  const [profile] = await db.query('SELECT id FROM boxer_profiles WHERE user_id = $1', [req.user.id]);
  if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

  const [doc] = await db.query(
    'INSERT INTO documents (boxer_id, filename, original_name, document_type) VALUES ($1, $2, $3, $4) RETURNING id',
    [profile.id, req.file.filename, req.file.originalname, req.body.document_type || 'Autre']
  );

  res.status(201).json({ id: doc.id, original_name: req.file.originalname });
});

router.delete('/documents/:id', requireBoxer, async (req, res) => {
  const [profile] = await db.query('SELECT id FROM boxer_profiles WHERE user_id = $1', [req.user.id]);
  const [doc] = await db.query('SELECT * FROM documents WHERE id = $1 AND boxer_id = $2', [req.params.id, profile.id]);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });

  const filePath = path.join(__dirname, '..', '..', 'uploads', String(req.user.id), doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.get('/payments', requireBoxer, async (req, res) => {
  const [profile] = await db.query('SELECT id FROM boxer_profiles WHERE user_id = $1', [req.user.id]);
  if (!profile) return res.json([]);
  const payments = await db.query('SELECT * FROM payments WHERE boxer_id = $1 ORDER BY year DESC, month DESC', [profile.id]);
  res.json(payments);
});

module.exports = router;
