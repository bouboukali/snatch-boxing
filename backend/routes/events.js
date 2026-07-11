const express = require('express');
const db = require('../db');
const { requireCoach, requireAuth } = require('../middleware/auth');
const { sendEventInvitation } = require('../email');

const router = express.Router();

router.get('/coach', requireCoach, async (req, res) => {
  const events = await db.query(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_invitations ei WHERE ei.event_id = e.id) as invite_count
    FROM events e
    ORDER BY e.start_date ASC
  `);

  const eventsWithInvitees = await Promise.all(events.map(async ev => {
    const invitees = await db.query(`
      SELECT u.id, u.email, bp.first_name, bp.last_name, ei.rsvp_status
      FROM event_invitations ei
      JOIN users u ON u.id = ei.boxer_id
      LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
      WHERE ei.event_id = $1
    `, [ev.id]);

    const rsvp_counts = {
      accepted: invitees.filter(i => i.rsvp_status === 'accepted').length,
      declined: invitees.filter(i => i.rsvp_status === 'declined').length,
      pending:  invitees.filter(i => !i.rsvp_status || i.rsvp_status === 'pending').length,
    };

    return { ...ev, invitees, rsvp_counts };
  }));

  res.json(eventsWithInvitees);
});

router.post('/coach', requireCoach, async (req, res) => {
  const { title, type, description, location, country, start_date, end_date, start_time, end_time, is_private, invite_all, boxer_ids } = req.body;

  if (!title || !start_date || !end_date) return res.status(400).json({ error: 'Titre et dates requis' });

  const [event] = await db.query(`
    INSERT INTO events (title, type, description, location, country, start_date, end_date, start_time, end_time, is_private, invite_all)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [title, type || 'boxe', description, location, country, start_date, end_date, start_time, end_time, is_private ? 1 : 0, invite_all ? 1 : 0]);

  let boxersToInvite = [];
  if (invite_all) {
    boxersToInvite = await db.query("SELECT id, email FROM users WHERE role = 'boxer'");
  } else if (boxer_ids && boxer_ids.length > 0) {
    const placeholders = boxer_ids.map((_, i) => `$${i + 1}`).join(',');
    boxersToInvite = await db.query(`SELECT id, email FROM users WHERE id IN (${placeholders}) AND role = 'boxer'`, boxer_ids);
  }

  for (const boxer of boxersToInvite) {
    await db.query(
      'INSERT INTO event_invitations (event_id, boxer_id, notified_at, rsvp_status) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, boxer_id) DO NOTHING',
      [event.id, boxer.id, new Date().toISOString(), 'pending']
    );
    sendEventInvitation(boxer.email, event).catch(err => console.error('Email error:', err));
  }

  res.status(201).json({ ...event, invitees: boxersToInvite, rsvp_counts: { accepted: 0, declined: 0, pending: boxersToInvite.length } });
});

router.put('/coach/:id', requireCoach, async (req, res) => {
  const [ev] = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });

  const { title, type, description, location, country, start_date, end_date, start_time, end_time, is_private, invite_all, boxer_ids } = req.body;

  await db.query(`
    UPDATE events SET title=$1, type=$2, description=$3, location=$4, country=$5,
      start_date=$6, end_date=$7, start_time=$8, end_time=$9, is_private=$10, invite_all=$11
    WHERE id=$12
  `, [title, type, description, location, country, start_date, end_date, start_time, end_time, is_private ? 1 : 0, invite_all ? 1 : 0, req.params.id]);

  const [updated] = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);

  if (invite_all) {
    const all = await db.query("SELECT id, email FROM users WHERE role = 'boxer'");
    for (const boxer of all) {
      const [already] = await db.query('SELECT id FROM event_invitations WHERE event_id=$1 AND boxer_id=$2', [req.params.id, boxer.id]);
      if (!already) {
        await db.query('INSERT INTO event_invitations (event_id, boxer_id, notified_at, rsvp_status) VALUES ($1, $2, $3, $4)', [req.params.id, boxer.id, new Date().toISOString(), 'pending']);
        sendEventInvitation(boxer.email, updated).catch(() => {});
      }
    }
  } else if (boxer_ids !== undefined) {
    await db.query('DELETE FROM event_invitations WHERE event_id = $1', [req.params.id]);
    if (boxer_ids && boxer_ids.length > 0) {
      const placeholders = boxer_ids.map((_, i) => `$${i + 1}`).join(',');
      const targets = await db.query(`SELECT id, email FROM users WHERE id IN (${placeholders}) AND role='boxer'`, boxer_ids);
      for (const boxer of targets) {
        await db.query(
          'INSERT INTO event_invitations (event_id, boxer_id, notified_at, rsvp_status) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, boxer_id) DO NOTHING',
          [req.params.id, boxer.id, new Date().toISOString(), 'pending']
        );
      }
    }
  }

  res.json({ success: true });
});

router.delete('/coach/:id', requireCoach, async (req, res) => {
  const [ev] = await db.query('SELECT id FROM events WHERE id = $1', [req.params.id]);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
  await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.get('/boxer', requireAuth, async (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès refusé' });

  const events = await db.query(`
    SELECT DISTINCT e.*,
      COALESCE(ei.rsvp_status, 'pending') as rsvp_status
    FROM events e
    LEFT JOIN event_invitations ei ON ei.event_id = e.id AND ei.boxer_id = $1
    WHERE e.is_private = 0
       OR e.invite_all = 1
       OR ei.boxer_id = $2
    ORDER BY e.start_date ASC
  `, [req.user.id, req.user.id]);

  res.json(events);
});

router.put('/boxer/:id/rsvp', requireAuth, async (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès refusé' });

  const { status } = req.body;
  if (!['accepted', 'declined', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const [ev] = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });

  const hasAccess = !ev.is_private || ev.invite_all;
  const [invitation] = await db.query('SELECT id FROM event_invitations WHERE event_id = $1 AND boxer_id = $2', [req.params.id, req.user.id]);
  if (!hasAccess && !invitation) return res.status(403).json({ error: 'Accès refusé' });

  await db.query(`
    INSERT INTO event_invitations (event_id, boxer_id, rsvp_status, notified_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (event_id, boxer_id) DO UPDATE SET rsvp_status = EXCLUDED.rsvp_status
  `, [req.params.id, req.user.id, status, new Date().toISOString()]);

  res.json({ success: true });
});

router.get('/:id', requireAuth, async (req, res) => {
  const [ev] = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });

  if (req.user.role === 'boxer') {
    const hasAccess = !ev.is_private || ev.invite_all;
    const [invitation] = await db.query('SELECT id FROM event_invitations WHERE event_id = $1 AND boxer_id = $2', [req.params.id, req.user.id]);
    if (!hasAccess && !invitation) return res.status(403).json({ error: 'Accès refusé' });
  }

  const allBoxers = await db.query(`
    SELECT u.id, u.email, bp.first_name, bp.last_name,
      COALESCE(ei.rsvp_status, 'pending') as rsvp_status,
      ei.id as invitation_id
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    LEFT JOIN event_invitations ei ON ei.event_id = $1 AND ei.boxer_id = u.id
    WHERE u.role = 'boxer'
    ORDER BY bp.last_name ASC
  `, [req.params.id]);

  const invitees = ev.invite_all ? allBoxers : allBoxers.filter(b => b.invitation_id !== null);

  const rsvp_counts = {
    accepted: invitees.filter(i => i.rsvp_status === 'accepted').length,
    declined: invitees.filter(i => i.rsvp_status === 'declined').length,
    pending:  invitees.filter(i => i.rsvp_status === 'pending').length,
  };

  res.json({ ...ev, invitees, rsvp_counts });
});

module.exports = router;
