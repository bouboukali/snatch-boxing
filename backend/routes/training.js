const express = require('express');
const db = require('../db');
const { requireCoach, requireAuth } = require('../middleware/auth');

const router = express.Router();

function sheetWithDetails(sheetId) {
  const sheet = db.prepare('SELECT * FROM training_sheets WHERE id = ?').get(sheetId);
  if (!sheet) return null;
  const exercises = db.prepare('SELECT * FROM training_exercises WHERE sheet_id = ? ORDER BY order_idx ASC').all(sheetId);
  const assignments = db.prepare(`
    SELECT u.id, u.email, bp.first_name, bp.last_name
    FROM training_assignments ta
    JOIN users u ON u.id = ta.boxer_id
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    WHERE ta.sheet_id = ?
  `).all(sheetId);
  return { ...sheet, exercises, assignments };
}

// GET /api/training — list all sheets (coach)
router.get('/coach', requireCoach, (req, res) => {
  const sheets = db.prepare(`
    SELECT ts.*,
      COUNT(DISTINCT te.id) as exercise_count,
      COUNT(DISTINCT ta.boxer_id) as assigned_count
    FROM training_sheets ts
    LEFT JOIN training_exercises te ON te.sheet_id = ts.id
    LEFT JOIN training_assignments ta ON ta.sheet_id = ts.id
    GROUP BY ts.id
    ORDER BY ts.created_at DESC
  `).all();
  res.json(sheets);
});

// GET /api/training/boxer — boxer sees their sheets
router.get('/boxer', requireAuth, (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès refusé' });
  const sheets = db.prepare(`
    SELECT DISTINCT ts.*,
      COUNT(te.id) as exercise_count
    FROM training_sheets ts
    LEFT JOIN training_exercises te ON te.sheet_id = ts.id
    LEFT JOIN training_assignments ta ON ta.sheet_id = ts.id AND ta.boxer_id = ?
    WHERE ts.is_public = 1 OR ta.boxer_id = ?
    GROUP BY ts.id
    ORDER BY ts.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(sheets);
});

// GET /api/training/:id
router.get('/:id', requireAuth, (req, res) => {
  const sheet = sheetWithDetails(req.params.id);
  if (!sheet) return res.status(404).json({ error: 'Fiche introuvable' });
  if (req.user.role === 'boxer') {
    const access = sheet.is_public || db.prepare('SELECT id FROM training_assignments WHERE sheet_id = ? AND boxer_id = ?').get(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'Accès refusé' });
  }
  res.json(sheet);
});

// POST /api/training — create sheet with optional exercises + assignments
router.post('/', requireCoach, (req, res) => {
  const { title, type, description, notes, is_public, boxer_ids, exercises } = req.body;
  if (!title) return res.status(400).json({ error: 'Titre requis' });

  const result = db.prepare(
    'INSERT INTO training_sheets (title, type, description, notes, is_public) VALUES (?, ?, ?, ?, ?)'
  ).run(title, type || 'muscu', description || null, notes || null, is_public ? 1 : 0);
  const sheetId = result.lastInsertRowid;

  // Add exercises
  if (exercises && exercises.length) {
    const insertEx = db.prepare('INSERT INTO training_exercises (sheet_id, order_idx, name, sets, reps, duration, rest, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    exercises.forEach((ex, i) => {
      if (ex.name) insertEx.run(sheetId, i + 1, ex.name, ex.sets || null, ex.reps || null, ex.duration || null, ex.rest || null, ex.notes || null);
    });
  }

  // Assign boxers if private
  if (!is_public && boxer_ids && boxer_ids.length) {
    const insertAss = db.prepare('INSERT OR IGNORE INTO training_assignments (sheet_id, boxer_id) VALUES (?, ?)');
    boxer_ids.forEach(bid => insertAss.run(sheetId, bid));
  }

  res.status(201).json(sheetWithDetails(sheetId));
});

// PUT /api/training/:id
router.put('/:id', requireCoach, (req, res) => {
  const { title, type, description, notes, is_public, boxer_ids } = req.body;
  if (!db.prepare('SELECT id FROM training_sheets WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Fiche introuvable' });

  db.prepare('UPDATE training_sheets SET title=?, type=?, description=?, notes=?, is_public=? WHERE id=?')
    .run(title, type, description || null, notes || null, is_public ? 1 : 0, req.params.id);

  // Update assignments
  db.prepare('DELETE FROM training_assignments WHERE sheet_id = ?').run(req.params.id);
  if (!is_public && boxer_ids && boxer_ids.length) {
    const insertAss = db.prepare('INSERT OR IGNORE INTO training_assignments (sheet_id, boxer_id) VALUES (?, ?)');
    boxer_ids.forEach(bid => insertAss.run(req.params.id, bid));
  }

  res.json({ success: true });
});

// DELETE /api/training/:id
router.delete('/:id', requireCoach, (req, res) => {
  if (!db.prepare('SELECT id FROM training_sheets WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Fiche introuvable' });
  db.prepare('DELETE FROM training_sheets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/training/:id/exercises
router.post('/:id/exercises', requireCoach, (req, res) => {
  if (!db.prepare('SELECT id FROM training_sheets WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Fiche introuvable' });
  const { name, sets, reps, duration, rest, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const maxOrder = db.prepare('SELECT MAX(order_idx) as m FROM training_exercises WHERE sheet_id = ?').get(req.params.id).m || 0;
  const result = db.prepare('INSERT INTO training_exercises (sheet_id, order_idx, name, sets, reps, duration, rest, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, maxOrder + 1, name, sets || null, reps || null, duration || null, rest || null, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM training_exercises WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/training/:id/exercises/:exId
router.put('/:id/exercises/:exId', requireCoach, (req, res) => {
  const { name, sets, reps, duration, rest, notes } = req.body;
  db.prepare('UPDATE training_exercises SET name=?, sets=?, reps=?, duration=?, rest=?, notes=? WHERE id=? AND sheet_id=?')
    .run(name, sets || null, reps || null, duration || null, rest || null, notes || null, req.params.exId, req.params.id);
  res.json({ success: true });
});

// DELETE /api/training/:id/exercises/:exId
router.delete('/:id/exercises/:exId', requireCoach, (req, res) => {
  db.prepare('DELETE FROM training_exercises WHERE id = ? AND sheet_id = ?').run(req.params.exId, req.params.id);
  res.json({ success: true });
});

// POST /api/training/:id/performance — boxer logs a session
router.post('/:id/performance', requireAuth, (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Réservé aux boxeurs' });
  const { session_date, exercises } = req.body;
  if (!session_date) return res.status(400).json({ error: 'Date de séance requise' });

  const sheet = db.prepare('SELECT id FROM training_sheets WHERE id = ?').get(req.params.id);
  if (!sheet) return res.status(404).json({ error: 'Fiche introuvable' });

  // Delete existing entries for this boxer/sheet/date then re-insert
  db.prepare('DELETE FROM training_performances WHERE sheet_id = ? AND boxer_id = ? AND session_date = ?')
    .run(req.params.id, req.user.id, session_date);

  const insert = db.prepare('INSERT INTO training_performances (sheet_id, boxer_id, session_date, exercise_id, achieved, notes) VALUES (?, ?, ?, ?, ?, ?)');
  if (exercises && exercises.length) {
    exercises.forEach(e => {
      insert.run(req.params.id, req.user.id, session_date, e.exercise_id || null, e.achieved || null, e.notes || null);
    });
  } else {
    insert.run(req.params.id, req.user.id, session_date, null, null, req.body.notes || null);
  }

  res.status(201).json({ success: true });
});

// GET /api/training/:id/performance
router.get('/:id/performance', requireAuth, (req, res) => {
  if (req.user.role === 'boxer') {
    const rows = db.prepare(`
      SELECT tp.*, te.name as exercise_name
      FROM training_performances tp
      LEFT JOIN training_exercises te ON te.id = tp.exercise_id
      WHERE tp.sheet_id = ? AND tp.boxer_id = ?
      ORDER BY tp.session_date DESC, tp.id ASC
    `).all(req.params.id, req.user.id);
    res.json(rows);
  } else if (req.user.role === 'coach') {
    const rows = db.prepare(`
      SELECT tp.*, te.name as exercise_name, u.email, bp.first_name, bp.last_name
      FROM training_performances tp
      LEFT JOIN training_exercises te ON te.id = tp.exercise_id
      LEFT JOIN users u ON u.id = tp.boxer_id
      LEFT JOIN boxer_profiles bp ON bp.user_id = tp.boxer_id
      WHERE tp.sheet_id = ?
      ORDER BY tp.session_date DESC, tp.boxer_id, tp.id ASC
    `).all(req.params.id);
    res.json(rows);
  } else {
    res.status(403).json({ error: 'Accès refusé' });
  }
});

module.exports = router;
