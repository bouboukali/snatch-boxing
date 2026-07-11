const express = require('express');
const db = require('../db');
const { requireCoach, requireAuth } = require('../middleware/auth');

const router = express.Router();

async function sheetWithDetails(sheetId) {
  const [sheet] = await db.query('SELECT * FROM training_sheets WHERE id = $1', [sheetId]);
  if (!sheet) return null;
  const exercises = await db.query('SELECT * FROM training_exercises WHERE sheet_id = $1 ORDER BY order_idx ASC', [sheetId]);
  const assignments = await db.query(`
    SELECT u.id, u.email, bp.first_name, bp.last_name
    FROM training_assignments ta
    JOIN users u ON u.id = ta.boxer_id
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    WHERE ta.sheet_id = $1
  `, [sheetId]);
  return { ...sheet, exercises, assignments };
}

router.get('/coach', requireCoach, async (req, res) => {
  const sheets = await db.query(`
    SELECT ts.*,
      COUNT(DISTINCT te.id) as exercise_count,
      COUNT(DISTINCT ta.boxer_id) as assigned_count
    FROM training_sheets ts
    LEFT JOIN training_exercises te ON te.sheet_id = ts.id
    LEFT JOIN training_assignments ta ON ta.sheet_id = ts.id
    GROUP BY ts.id
    ORDER BY ts.created_at DESC
  `);
  res.json(sheets);
});

router.get('/boxer', requireAuth, async (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès refusé' });
  const sheets = await db.query(`
    SELECT DISTINCT ts.*,
      COUNT(te.id) as exercise_count
    FROM training_sheets ts
    LEFT JOIN training_exercises te ON te.sheet_id = ts.id
    LEFT JOIN training_assignments ta ON ta.sheet_id = ts.id AND ta.boxer_id = $1
    WHERE ts.is_public = 1 OR ta.boxer_id IS NOT NULL
    GROUP BY ts.id
    ORDER BY ts.created_at DESC
  `, [req.user.id]);
  res.json(sheets);
});

router.get('/:id', requireAuth, async (req, res) => {
  const sheet = await sheetWithDetails(req.params.id);
  if (!sheet) return res.status(404).json({ error: 'Fiche introuvable' });
  if (req.user.role === 'boxer') {
    const [access] = await db.query('SELECT id FROM training_assignments WHERE sheet_id = $1 AND boxer_id = $2', [req.params.id, req.user.id]);
    if (!sheet.is_public && !access) return res.status(403).json({ error: 'Accès refusé' });
  }
  res.json(sheet);
});

router.post('/', requireCoach, async (req, res) => {
  const { title, type, description, notes, is_public, boxer_ids, exercises } = req.body;
  if (!title) return res.status(400).json({ error: 'Titre requis' });

  const [sheet] = await db.query(
    'INSERT INTO training_sheets (title, type, description, notes, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [title, type || 'muscu', description || null, notes || null, is_public ? 1 : 0]
  );
  const sheetId = sheet.id;

  if (exercises && exercises.length) {
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      if (ex.name) {
        await db.query(
          'INSERT INTO training_exercises (sheet_id, order_idx, name, sets, reps, duration, rest, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [sheetId, i + 1, ex.name, ex.sets || null, ex.reps || null, ex.duration || null, ex.rest || null, ex.notes || null]
        );
      }
    }
  }

  if (!is_public && boxer_ids && boxer_ids.length) {
    for (const bid of boxer_ids) {
      await db.query('INSERT INTO training_assignments (sheet_id, boxer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sheetId, bid]);
    }
  }

  res.status(201).json(await sheetWithDetails(sheetId));
});

router.put('/:id', requireCoach, async (req, res) => {
  const { title, type, description, notes, is_public, boxer_ids } = req.body;
  const [exists] = await db.query('SELECT id FROM training_sheets WHERE id = $1', [req.params.id]);
  if (!exists) return res.status(404).json({ error: 'Fiche introuvable' });

  await db.query('UPDATE training_sheets SET title=$1, type=$2, description=$3, notes=$4, is_public=$5 WHERE id=$6',
    [title, type, description || null, notes || null, is_public ? 1 : 0, req.params.id]);

  await db.query('DELETE FROM training_assignments WHERE sheet_id = $1', [req.params.id]);
  if (!is_public && boxer_ids && boxer_ids.length) {
    for (const bid of boxer_ids) {
      await db.query('INSERT INTO training_assignments (sheet_id, boxer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, bid]);
    }
  }

  res.json({ success: true });
});

router.delete('/:id', requireCoach, async (req, res) => {
  const [exists] = await db.query('SELECT id FROM training_sheets WHERE id = $1', [req.params.id]);
  if (!exists) return res.status(404).json({ error: 'Fiche introuvable' });
  await db.query('DELETE FROM training_sheets WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.post('/:id/exercises', requireCoach, async (req, res) => {
  const [exists] = await db.query('SELECT id FROM training_sheets WHERE id = $1', [req.params.id]);
  if (!exists) return res.status(404).json({ error: 'Fiche introuvable' });
  const { name, sets, reps, duration, rest, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  const [maxRow] = await db.query('SELECT MAX(order_idx) as m FROM training_exercises WHERE sheet_id = $1', [req.params.id]);
  const maxOrder = maxRow.m || 0;

  const [ex] = await db.query(
    'INSERT INTO training_exercises (sheet_id, order_idx, name, sets, reps, duration, rest, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [req.params.id, maxOrder + 1, name, sets || null, reps || null, duration || null, rest || null, notes || null]
  );
  res.status(201).json(ex);
});

router.put('/:id/exercises/:exId', requireCoach, async (req, res) => {
  const { name, sets, reps, duration, rest, notes } = req.body;
  await db.query('UPDATE training_exercises SET name=$1, sets=$2, reps=$3, duration=$4, rest=$5, notes=$6 WHERE id=$7 AND sheet_id=$8',
    [name, sets || null, reps || null, duration || null, rest || null, notes || null, req.params.exId, req.params.id]);
  res.json({ success: true });
});

router.delete('/:id/exercises/:exId', requireCoach, async (req, res) => {
  await db.query('DELETE FROM training_exercises WHERE id = $1 AND sheet_id = $2', [req.params.exId, req.params.id]);
  res.json({ success: true });
});

router.post('/:id/performance', requireAuth, async (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Réservé aux boxeurs' });
  const { session_date, exercises } = req.body;
  if (!session_date) return res.status(400).json({ error: 'Date de séance requise' });

  const [sheet] = await db.query('SELECT id FROM training_sheets WHERE id = $1', [req.params.id]);
  if (!sheet) return res.status(404).json({ error: 'Fiche introuvable' });

  await db.query('DELETE FROM training_performances WHERE sheet_id = $1 AND boxer_id = $2 AND session_date = $3',
    [req.params.id, req.user.id, session_date]);

  if (exercises && exercises.length) {
    for (const e of exercises) {
      await db.query(
        'INSERT INTO training_performances (sheet_id, boxer_id, session_date, exercise_id, achieved, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.params.id, req.user.id, session_date, e.exercise_id || null, e.achieved || null, e.notes || null]
      );
    }
  } else {
    await db.query(
      'INSERT INTO training_performances (sheet_id, boxer_id, session_date, exercise_id, achieved, notes) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.params.id, req.user.id, session_date, null, null, req.body.notes || null]
    );
  }

  res.status(201).json({ success: true });
});

router.get('/:id/performance', requireAuth, async (req, res) => {
  if (req.user.role === 'boxer') {
    const rows = await db.query(`
      SELECT tp.*, te.name as exercise_name
      FROM training_performances tp
      LEFT JOIN training_exercises te ON te.id = tp.exercise_id
      WHERE tp.sheet_id = $1 AND tp.boxer_id = $2
      ORDER BY tp.session_date DESC, tp.id ASC
    `, [req.params.id, req.user.id]);
    res.json(rows);
  } else if (req.user.role === 'coach') {
    const rows = await db.query(`
      SELECT tp.*, te.name as exercise_name, u.email, bp.first_name, bp.last_name
      FROM training_performances tp
      LEFT JOIN training_exercises te ON te.id = tp.exercise_id
      LEFT JOIN users u ON u.id = tp.boxer_id
      LEFT JOIN boxer_profiles bp ON bp.user_id = tp.boxer_id
      WHERE tp.sheet_id = $1
      ORDER BY tp.session_date DESC, tp.boxer_id, tp.id ASC
    `, [req.params.id]);
    res.json(rows);
  } else {
    res.status(403).json({ error: 'Accès refusé' });
  }
});

module.exports = router;
