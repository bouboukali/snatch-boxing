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

// GET profile
router.get('/profile', requireBoxer, (req, res) => {
  const profile = db.prepare('SELECT * FROM boxer_profiles WHERE user_id = ?').get(req.user.id);
  res.json(profile || {});
});

// PUT update profile
router.put('/profile', requireBoxer, (req, res) => {
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
    phone, date_of_birth, now, req.user.id);

  res.json({ success: true });
});

// GET documents
router.get('/documents', requireBoxer, (req, res) => {
  const profile = db.prepare('SELECT id FROM boxer_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.json([]);
  const docs = db.prepare('SELECT * FROM documents WHERE boxer_id = ? ORDER BY uploaded_at DESC').all(profile.id);
  res.json(docs);
});

// POST upload document
router.post('/documents', requireBoxer, upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
  const profile = db.prepare('SELECT id FROM boxer_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

  const result = db.prepare(
    'INSERT INTO documents (boxer_id, filename, original_name, document_type) VALUES (?, ?, ?, ?)'
  ).run(profile.id, req.file.filename, req.file.originalname, req.body.document_type || 'Autre');

  res.status(201).json({ id: result.lastInsertRowid, original_name: req.file.originalname });
});

// DELETE document
router.delete('/documents/:id', requireBoxer, (req, res) => {
  const profile = db.prepare('SELECT id FROM boxer_profiles WHERE user_id = ?').get(req.user.id);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND boxer_id = ?').get(req.params.id, profile.id);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });

  const filePath = path.join(__dirname, '..', '..', 'uploads', String(req.user.id), doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET payments for boxer
router.get('/payments', requireBoxer, (req, res) => {
  const profile = db.prepare('SELECT id FROM boxer_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.json([]);
  const payments = db.prepare('SELECT * FROM payments WHERE boxer_id = ? ORDER BY year DESC, month DESC').all(profile.id);
  res.json(payments);
});

module.exports = router;
