const request = require('supertest');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret';

const mockDb = { query: jest.fn() };
jest.mock('../backend/db', () => mockDb);
jest.mock('../backend/mailer', () => ({ sendInvitation: jest.fn(), sendEmailConfirmation: jest.fn().mockResolvedValue(true) }));
jest.mock('../backend/email', () => ({ sendPaymentReminder: jest.fn(), sendEventInvitation: jest.fn() }));

let app;
beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  app = require('../backend/app');
});

afterEach(() => mockDb.query.mockReset());

function makeToken(payload) {
  return jwt.sign(payload, SECRET);
}

function boxer(id = 1) {
  return { Authorization: `Bearer ${makeToken({ id, email: 'ali@boxing.fr', role: 'boxer' })}` };
}

function coach() {
  return { Authorization: `Bearer ${makeToken({ id: 10, email: 'coach@boxing.fr', role: 'coach' })}` };
}

// ===== GET /api/boxer/profile =====
describe('GET /api/boxer/profile', () => {
  test('200 retourne le profil du boxeur', async () => {
    mockDb.query.mockResolvedValueOnce([{ user_id: 1, first_name: 'Ali', last_name: 'Mohammed' }]);
    const res = await request(app).get('/api/boxer/profile').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body.first_name).toBe('Ali');
  });

  test('200 retourne {} si pas de profil', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/boxer/profile').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  test('401 sans token', async () => {
    const res = await request(app).get('/api/boxer/profile');
    expect(res.status).toBe(401);
  });

  test('403 si appelé avec token coach', async () => {
    const res = await request(app).get('/api/boxer/profile').set(coach());
    expect(res.status).toBe(403);
  });
});

// ===== PUT /api/boxer/profile =====
describe('PUT /api/boxer/profile', () => {
  test('200 met à jour le profil', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app)
      .put('/api/boxer/profile')
      .set(boxer())
      .send({ first_name: 'Ali', last_name: 'Mohammed', wins: 5, losses: 1, draws: 0, weight: 69 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('403 si coach tente de modifier', async () => {
    const res = await request(app).put('/api/boxer/profile').set(coach()).send({});
    expect(res.status).toBe(403);
  });
});

// ===== GET /api/boxer/documents =====
describe('GET /api/boxer/documents', () => {
  test('200 retourne les documents', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ id: 5 }])  // profil
      .mockResolvedValueOnce([{ id: 1, original_name: 'licence.pdf' }]);
    const res = await request(app).get('/api/boxer/documents').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('200 retourne [] si pas de profil', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/boxer/documents').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ===== POST /api/boxer/request-email-change =====
describe('POST /api/boxer/request-email-change', () => {
  test('200 envoie un email de confirmation', async () => {
    const { sendEmailConfirmation } = require('../backend/mailer');
    mockDb.query
      .mockResolvedValueOnce([])                          // pas de conflit email
      .mockResolvedValueOnce([])                          // UPDATE pending_email
      .mockResolvedValueOnce([{ first_name: 'Ali' }]);    // SELECT prénom

    const res = await request(app)
      .post('/api/boxer/request-email-change')
      .set(boxer())
      .send({ new_email: 'nouveau@boxing.fr' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('nouveau@boxing.fr');
  });

  test('400 si new_email manquant', async () => {
    const res = await request(app)
      .post('/api/boxer/request-email-change')
      .set(boxer())
      .send({});
    expect(res.status).toBe(400);
  });

  test('400 si email invalide', async () => {
    const res = await request(app)
      .post('/api/boxer/request-email-change')
      .set(boxer())
      .send({ new_email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  test('409 si email déjà utilisé par un autre compte', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 99 }]); // conflit

    const res = await request(app)
      .post('/api/boxer/request-email-change')
      .set(boxer())
      .send({ new_email: 'pris@boxing.fr' });
    expect(res.status).toBe(409);
  });

  test('401 sans token', async () => {
    const res = await request(app)
      .post('/api/boxer/request-email-change')
      .send({ new_email: 'test@boxing.fr' });
    expect(res.status).toBe(401);
  });

  test('403 si coach tente d\'utiliser l\'endpoint', async () => {
    const res = await request(app)
      .post('/api/boxer/request-email-change')
      .set(coach())
      .send({ new_email: 'test@boxing.fr' });
    expect(res.status).toBe(403);
  });
});

// ===== GET /api/boxer/payments =====
describe('GET /api/boxer/payments', () => {
  test('200 retourne les paiements', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ id: 5 }])
      .mockResolvedValueOnce([
        { id: 1, month: 1, year: 2025, paid: 1 },
        { id: 2, month: 2, year: 2025, paid: 0 },
      ]);
    const res = await request(app).get('/api/boxer/payments').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('200 retourne [] si pas de profil', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/boxer/payments').set(boxer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
