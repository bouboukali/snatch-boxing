const request = require('supertest');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret';

const mockDb = { query: jest.fn() };
jest.mock('../backend/db', () => mockDb);
jest.mock('../backend/mailer', () => ({ sendInvitation: jest.fn() }));
jest.mock('../backend/email', () => ({
  sendPaymentReminder: jest.fn(),
  sendEventInvitation: jest.fn().mockResolvedValue(true),
}));

let app;
beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  app = require('../backend/app');
});

afterEach(() => mockDb.query.mockReset());

function makeToken(payload) {
  return jwt.sign(payload, SECRET);
}
function coach() {
  return { Authorization: `Bearer ${makeToken({ id: 10, role: 'coach' })}` };
}
function boxer(id = 1) {
  return { Authorization: `Bearer ${makeToken({ id, role: 'boxer' })}` };
}

const fakeEvent = { id: 1, title: 'Gala', type: 'boxe', start_date: '2025-06-01', end_date: '2025-06-01', is_private: 0, invite_all: 0 };

// ===== GET /api/events/coach =====
describe('GET /api/events/coach', () => {
  test('200 retourne les événements avec invitees et rsvp_counts', async () => {
    mockDb.query
      .mockResolvedValueOnce([fakeEvent])  // SELECT events
      .mockResolvedValueOnce([            // invitees pour event 1
        { id: 1, email: 'ali@boxing.fr', first_name: 'Ali', rsvp_status: 'accepted' },
        { id: 2, email: 'mike@boxing.fr', first_name: 'Mike', rsvp_status: 'declined' },
      ]);

    const res = await request(app).get('/api/events/coach').set(coach());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rsvp_counts).toEqual({ accepted: 1, declined: 1, pending: 0 });
  });

  test('401 sans token', async () => {
    const res = await request(app).get('/api/events/coach');
    expect(res.status).toBe(401);
  });

  test('403 si boxer tente d\'accéder', async () => {
    const res = await request(app).get('/api/events/coach').set(boxer());
    expect(res.status).toBe(403);
  });
});

// ===== POST /api/events/coach =====
describe('POST /api/events/coach', () => {
  test('201 crée un événement sans invitations', async () => {
    mockDb.query.mockResolvedValueOnce([{ ...fakeEvent }]);

    const res = await request(app)
      .post('/api/events/coach')
      .set(coach())
      .send({ title: 'Gala', start_date: '2025-06-01', end_date: '2025-06-01' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Gala');
    expect(res.body.invitees).toEqual([]);
  });

  test('201 avec invite_all → invite tous les boxeurs', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, id: 2, invite_all: 1 }])  // INSERT event
      .mockResolvedValueOnce([                                           // SELECT boxeurs
        { id: 1, email: 'ali@boxing.fr' },
        { id: 2, email: 'mike@boxing.fr' },
      ])
      .mockResolvedValueOnce([])  // INSERT invitation boxer 1
      .mockResolvedValueOnce([]); // INSERT invitation boxer 2

    const res = await request(app)
      .post('/api/events/coach')
      .set(coach())
      .send({ title: 'Gala', start_date: '2025-06-01', end_date: '2025-06-01', invite_all: true });

    expect(res.status).toBe(201);
    expect(res.body.rsvp_counts.pending).toBe(2);
  });

  test('201 avec boxer_ids spécifiques', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, id: 3 }])
      .mockResolvedValueOnce([{ id: 1, email: 'ali@boxing.fr' }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/events/coach')
      .set(coach())
      .send({ title: 'Gala', start_date: '2025-06-01', end_date: '2025-06-01', boxer_ids: [1] });

    expect(res.status).toBe(201);
    expect(res.body.invitees).toHaveLength(1);
  });

  test('400 si titre manquant', async () => {
    const res = await request(app)
      .post('/api/events/coach')
      .set(coach())
      .send({ start_date: '2025-06-01', end_date: '2025-06-01' });
    expect(res.status).toBe(400);
  });

  test('400 si dates manquantes', async () => {
    const res = await request(app)
      .post('/api/events/coach')
      .set(coach())
      .send({ title: 'Gala' });
    expect(res.status).toBe(400);
  });
});

// ===== PUT /api/events/coach/:id =====
describe('PUT /api/events/coach/:id', () => {
  test('200 met à jour l\'événement', async () => {
    mockDb.query
      .mockResolvedValueOnce([fakeEvent])           // SELECT event
      .mockResolvedValueOnce([])                    // UPDATE
      .mockResolvedValueOnce([{ ...fakeEvent, title: 'Gala Modifié' }]); // SELECT updated

    const res = await request(app)
      .put('/api/events/coach/1')
      .set(coach())
      .send({ title: 'Gala Modifié', start_date: '2025-06-01', end_date: '2025-06-01', is_private: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('404 si événement inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app)
      .put('/api/events/coach/999')
      .set(coach())
      .send({ title: 'X', start_date: '2025-06-01', end_date: '2025-06-01' });
    expect(res.status).toBe(404);
  });

  test('200 mise à jour avec boxer_ids réinitialise les invitations', async () => {
    mockDb.query
      .mockResolvedValueOnce([fakeEvent])  // SELECT event
      .mockResolvedValueOnce([])           // UPDATE event
      .mockResolvedValueOnce([fakeEvent])  // SELECT updated
      .mockResolvedValueOnce([])           // DELETE invitations
      .mockResolvedValueOnce([{ id: 1, email: 'ali@boxing.fr' }])  // SELECT boxers
      .mockResolvedValueOnce([]);          // INSERT invitation

    const res = await request(app)
      .put('/api/events/coach/1')
      .set(coach())
      .send({ title: 'Gala', start_date: '2025-06-01', end_date: '2025-06-01', boxer_ids: [1] });

    expect(res.status).toBe(200);
  });
});

// ===== DELETE /api/events/coach/:id =====
describe('DELETE /api/events/coach/:id', () => {
  test('200 supprime l\'événement', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/events/coach/1').set(coach());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('404 si événement inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/events/coach/999').set(coach());
    expect(res.status).toBe(404);
  });
});

// ===== GET /api/events/boxer =====
describe('GET /api/events/boxer', () => {
  test('200 retourne les événements accessibles au boxeur', async () => {
    mockDb.query.mockResolvedValueOnce([
      { id: 1, title: 'Gala Public', is_private: 0, rsvp_status: 'pending' },
    ]);
    const res = await request(app).get('/api/events/boxer').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('403 si coach tente d\'accéder', async () => {
    const res = await request(app).get('/api/events/boxer').set(coach());
    expect(res.status).toBe(403);
  });
});

// ===== PUT /api/events/boxer/:id/rsvp =====
describe('PUT /api/events/boxer/:id/rsvp', () => {
  test('200 boxer accepte un événement public', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, is_private: 0 }])  // SELECT event
      .mockResolvedValueOnce([{ id: 5 }])                        // SELECT invitation
      .mockResolvedValueOnce([]);                                 // UPSERT rsvp

    const res = await request(app)
      .put('/api/events/boxer/1/rsvp')
      .set(boxer())
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('200 boxer décline', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, is_private: 0 }])
      .mockResolvedValueOnce([{ id: 5 }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/events/boxer/1/rsvp')
      .set(boxer())
      .send({ status: 'declined' });

    expect(res.status).toBe(200);
  });

  test('400 si statut invalide', async () => {
    const res = await request(app)
      .put('/api/events/boxer/1/rsvp')
      .set(boxer())
      .send({ status: 'maybe' });
    expect(res.status).toBe(400);
  });

  test('404 si événement inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app)
      .put('/api/events/boxer/999/rsvp')
      .set(boxer())
      .send({ status: 'accepted' });
    expect(res.status).toBe(404);
  });

  test('403 si boxer non invité à un événement privé', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, is_private: 1, invite_all: 0 }])  // événement privé
      .mockResolvedValueOnce([]);  // pas d'invitation

    const res = await request(app)
      .put('/api/events/boxer/1/rsvp')
      .set(boxer())
      .send({ status: 'accepted' });

    expect(res.status).toBe(403);
  });

  test('403 si coach tente de répondre', async () => {
    const res = await request(app)
      .put('/api/events/boxer/1/rsvp')
      .set(coach())
      .send({ status: 'accepted' });
    expect(res.status).toBe(403);
  });
});

// ===== GET /api/events/:id =====
describe('GET /api/events/:id', () => {
  test('200 coach voit les détails avec rsvp_counts', async () => {
    mockDb.query
      .mockResolvedValueOnce([fakeEvent])
      .mockResolvedValueOnce([
        { id: 1, first_name: 'Ali', rsvp_status: 'accepted', invitation_id: 5 },
        { id: 2, first_name: 'Mike', rsvp_status: 'pending', invitation_id: 6 },
      ]);

    const res = await request(app).get('/api/events/1').set(coach());
    expect(res.status).toBe(200);
    expect(res.body.rsvp_counts.accepted).toBe(1);
    expect(res.body.rsvp_counts.pending).toBe(1);
  });

  test('200 boxer voit un événement public', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, is_private: 0 }])  // SELECT event
      .mockResolvedValueOnce([])                                   // SELECT invitation (toujours appelé)
      .mockResolvedValueOnce([{ id: 1, invitation_id: null, rsvp_status: 'pending' }]); // allBoxers

    const res = await request(app).get('/api/events/1').set(boxer());
    expect(res.status).toBe(200);
  });

  test('403 boxer non invité à un événement privé', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ ...fakeEvent, is_private: 1, invite_all: 0 }])
      .mockResolvedValueOnce([]);  // pas d'invitation

    const res = await request(app).get('/api/events/1').set(boxer());
    expect(res.status).toBe(403);
  });

  test('404 si événement inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/events/999').set(coach());
    expect(res.status).toBe(404);
  });
});
