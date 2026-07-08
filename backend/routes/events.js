const express = require('express');
const db = require('../db');
const { requireCoach, requireAuth } = require('../middleware/auth');
const { sendEventInvitation } = require('../email');

const router = express.Router();

// ===== COACH: list all events =====
router.get('/coach', requireCoach, (req, res) => {
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_invitations ei WHERE ei.event_id = e.id) as invite_count
    FROM events e
    ORDER BY e.start_date ASC
  `).all();

  const eventsWithInvitees = events.map(ev => {
    const invitees = db.prepare(`
      SELECT u.id, u.email, bp.first_name, bp.last_name, ei.rsvp_status
      FROM event_invitations ei
      JOIN users u ON u.id = ei.boxer_id
      LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
      WHERE ei.event_id = ?
    `).all(ev.id);

    const rsvp_counts = {
      accepted: invitees.filter(i => i.rsvp_status === 'accepted').length,
      declined: invitees.filter(i => i.rsvp_status === 'declined').length,
      pending:  invitees.filter(i => !i.rsvp_status || i.rsvp_status === 'pending').length,
    };

    return { ...ev, invitees, rsvp_counts };
  });

  res.json(eventsWithInvitees);
});

// ===== COACH: create event =====
router.post('/coach', requireCoach, async (req, res) => {
  const { title, type, description, location, country, start_date, end_date, start_time, end_time, is_private, invite_all, boxer_ids } = req.body;

  if (!title || !start_date || !end_date) return res.status(400).json({ error: 'Titre et dates requis' });

  const result = db.prepare(`
    INSERT INTO events (title, type, description, location, country, start_date, end_date, start_time, end_time, is_private, invite_all)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, type || 'boxe', description, location, country, start_date, end_date, start_time, end_time, is_private ? 1 : 0, invite_all ? 1 : 0);

  const eventId = result.lastInsertRowid;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

  let boxersToInvite = [];
  if (invite_all) {
    boxersToInvite = db.prepare("SELECT id, email FROM users WHERE role = 'boxer'").all();
  } else if (boxer_ids && boxer_ids.length > 0) {
    boxersToInvite = db.prepare(`SELECT id, email FROM users WHERE id IN (${boxer_ids.map(() => '?').join(',')}) AND role = 'boxer'`).all(...boxer_ids);
  }

  for (const boxer of boxersToInvite) {
    db.prepare('INSERT OR IGNORE INTO event_invitations (event_id, boxer_id, notified_at, rsvp_status) VALUES (?, ?, ?, ?)').run(eventId, boxer.id, new Date().toISOString(), 'pending');
    sendEventInvitation(boxer.email, event).catch(err => console.error('Email error:', err));
  }

  res.status(201).json({ ...event, invitees: boxersToInvite, rsvp_counts: { accepted: 0, declined: 0, pending: boxersToInvite.length } });
});

// ===== COACH: update event =====
router.put('/coach/:id', requireCoach, async (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });

  const { title, type, description, location, country, start_date, end_date, start_time, end_time, is_private, invite_all, boxer_ids } = req.body;

  db.prepare(`
    UPDATE events SET title=?, type=?, description=?, location=?, country=?, start_date=?, end_date=?, start_time=?, end_time=?, is_private=?, invite_all=?
    WHERE id=?
  `).run(title, type, description, location, country, start_date, end_date, start_time, end_time, is_private ? 1 : 0, invite_all ? 1 : 0, req.params.id);

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (invite_all) {
    const all = db.prepare("SELECT id, email FROM users WHERE role = 'boxer'").all();
    for (const boxer of all) {
      const already = db.prepare('SELECT id FROM event_invitations WHERE event_id=? AND boxer_id=?').get(req.params.id, boxer.id);
      if (!already) {
        db.prepare('INSERT INTO event_invitations (event_id, boxer_id, notified_at, rsvp_status) VALUES (?, ?, ?, ?)').run(req.params.id, boxer.id, new Date().toISOString(), 'pending');
        sendEventInvitation(boxer.email, updated).catch(() => {});
      }
    }
  } else if (boxer_ids !== undefined) {
    db.prepare('DELETE FROM event_invitations WHERE event_id = ?').run(req.params.id);
    if (boxer_ids && boxer_ids.length > 0) {
      const targets = db.prepare(`SELECT id, email FROM users WHERE id IN (${boxer_ids.map(() => '?').join(',')}) AND role='boxer'`).all(...boxer_ids);
      for (const boxer of targets) {
        db.prepare('INSERT OR IGNORE INTO event_invitations (event_id, boxer_id, notified_at, rsvp_status) VALUES (?, ?, ?, ?)').run(req.params.id, boxer.id, new Date().toISOString(), 'pending');
      }
    }
  }

  res.json({ success: true });
});

// ===== COACH: delete event =====
router.delete('/coach/:id', requireCoach, (req, res) => {
  const ev = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== BOXER: get my events ===== (must be before /:id)
router.get('/boxer', requireAuth, (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès refusé' });

  const events = db.prepare(`
    SELECT DISTINCT e.*,
      COALESCE(ei.rsvp_status, 'pending') as rsvp_status
    FROM events e
    LEFT JOIN event_invitations ei ON ei.event_id = e.id AND ei.boxer_id = ?
    WHERE e.is_private = 0
       OR e.invite_all = 1
       OR ei.boxer_id = ?
    ORDER BY e.start_date ASC
  `).all(req.user.id, req.user.id);

  res.json(events);
});

// ===== BOXER: RSVP to event ===== (must be before /:id)
router.put('/boxer/:id/rsvp', requireAuth, (req, res) => {
  if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès refusé' });

  const { status } = req.body;
  if (!['accepted', 'declined', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });

  const hasAccess = !ev.is_private || ev.invite_all;
  const invitation = db.prepare('SELECT id FROM event_invitations WHERE event_id = ? AND boxer_id = ?').get(req.params.id, req.user.id);
  if (!hasAccess && !invitation) return res.status(403).json({ error: 'Accès refusé' });

  db.prepare(`
    INSERT INTO event_invitations (event_id, boxer_id, rsvp_status, notified_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(event_id, boxer_id) DO UPDATE SET rsvp_status = excluded.rsvp_status
  `).run(req.params.id, req.user.id, status, new Date().toISOString());

  res.json({ success: true });
});

// ===== GET event detail (coach or boxer) =====
router.get('/:id', requireAuth, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Événement introuvable' });

  // Check boxer access
  if (req.user.role === 'boxer') {
    const hasAccess = !ev.is_private || ev.invite_all;
    const invitation = db.prepare('SELECT id FROM event_invitations WHERE event_id = ? AND boxer_id = ?').get(req.params.id, req.user.id);
    if (!hasAccess && !invitation) return res.status(403).json({ error: 'Accès refusé' });
  }

  const allBoxers = db.prepare(`
    SELECT u.id, u.email, bp.first_name, bp.last_name,
      COALESCE(ei.rsvp_status, 'pending') as rsvp_status,
      ei.id as invitation_id
    FROM users u
    LEFT JOIN boxer_profiles bp ON bp.user_id = u.id
    LEFT JOIN event_invitations ei ON ei.event_id = ? AND ei.boxer_id = u.id
    WHERE u.role = 'boxer'
    ORDER BY bp.last_name ASC
  `).all(req.params.id);

  const invitees = ev.invite_all ? allBoxers : allBoxers.filter(b => b.invitation_id !== null);

  const rsvp_counts = {
    accepted: invitees.filter(i => i.rsvp_status === 'accepted').length,
    declined: invitees.filter(i => i.rsvp_status === 'declined').length,
    pending:  invitees.filter(i => i.rsvp_status === 'pending').length,
  };

  res.json({ ...ev, invitees, rsvp_counts });
});

module.exports = router;
