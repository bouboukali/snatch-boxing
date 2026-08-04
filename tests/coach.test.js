const request = require('supertest');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret';

// ——— Mock DB ———
const mockDb = {
  query: jest.fn(),
};
jest.mock('../backend/db', () => mockDb);

// ——— Mock mailer (évite l'envoi réel d'emails) ———
jest.mock('../backend/mailer', () => ({
  sendInvitation: jest.fn().mockResolvedValue(true),
}));

// ——— Mock email.js (pour notify) ———
jest.mock('../backend/email', () => ({
  sendPaymentReminder: jest.fn().mockResolvedValue(true),
}));

let app;
beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  app = require('../backend/app');
});

afterEach(() => {
  mockDb.query.mockReset();
});

// Token coach valide
function coachToken() {
  return jwt.sign({ id: 10, email: 'coach@boxing.fr', role: 'coach' }, SECRET);
}

function authHeader() {
  return { Authorization: `Bearer ${coachToken()}` };
}

// ===== GET /api/coach/boxers =====
describe('GET /api/coach/boxers', () => {
  test('200 retourne la liste des boxeurs', async () => {
    mockDb.query.mockResolvedValueOnce([
      { user_id: 1, email: 'ali@boxing.fr', first_name: 'Ali', last_name: 'Mohammed' },
      { user_id: 2, email: 'tyson@boxing.fr', first_name: 'Mike', last_name: 'Tyson' },
    ]);

    const res = await request(app).get('/api/coach/boxers').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].email).toBe('ali@boxing.fr');
  });

  test('401 sans token', async () => {
    const res = await request(app).get('/api/coach/boxers');
    expect(res.status).toBe(401);
  });
});

// ===== GET /api/coach/boxers/:userId =====
describe('GET /api/coach/boxers/:userId', () => {
  test('200 retourne le boxeur avec documents et paiements', async () => {
    const boxer = { user_id: 1, email: 'ali@boxing.fr', profile_id: 5, first_name: 'Ali' };
    mockDb.query
      .mockResolvedValueOnce([boxer])        // SELECT boxer
      .mockResolvedValueOnce([{ id: 1, original_name: 'licence.pdf' }])  // documents
      .mockResolvedValueOnce([{ id: 1, paid: 1, month: 1, year: 2025 }]); // payments

    const res = await request(app).get('/api/coach/boxers/1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('ali@boxing.fr');
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.payments).toHaveLength(1);
  });

  test('404 si boxeur inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/coach/boxers/999').set(authHeader());
    expect(res.status).toBe(404);
  });

  test('200 boxeur sans profil → documents et payments vides', async () => {
    const boxer = { user_id: 2, email: 'noob@boxing.fr', profile_id: null };
    mockDb.query.mockResolvedValueOnce([boxer]);

    const res = await request(app).get('/api/coach/boxers/2').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
    expect(res.body.payments).toEqual([]);
  });
});

// ===== POST /api/coach/boxers =====
describe('POST /api/coach/boxers', () => {
  test('201 crée un boxeur et retourne id + email', async () => {
    mockDb.query
      .mockResolvedValueOnce([])                        // SELECT existing → vide
      .mockResolvedValueOnce([{ id: 42 }])             // INSERT user RETURNING id
      .mockResolvedValueOnce([]);                       // INSERT boxer_profiles

    const res = await request(app)
      .post('/api/coach/boxers')
      .set(authHeader())
      .send({ email: 'nouveau@boxing.fr', first_name: 'Nouveau', last_name: 'Boxeur', gender: 'Homme' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
    expect(res.body.email).toBe('nouveau@boxing.fr');
  });

  test('400 si email manquant', async () => {
    const res = await request(app)
      .post('/api/coach/boxers')
      .set(authHeader())
      .send({ first_name: 'Sans', last_name: 'Email' });

    expect(res.status).toBe(400);
  });

  test('409 si email déjà utilisé', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // email déjà existant

    const res = await request(app)
      .post('/api/coach/boxers')
      .set(authHeader())
      .send({ email: 'existant@boxing.fr' });

    expect(res.status).toBe(409);
  });

  test('401 sans token', async () => {
    const res = await request(app)
      .post('/api/coach/boxers')
      .send({ email: 'test@boxing.fr' });
    expect(res.status).toBe(401);
  });
});

// ===== PUT /api/coach/boxers/:userId =====
describe('PUT /api/coach/boxers/:userId', () => {
  test('200 met à jour le profil', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ id: 1 }])  // SELECT user
      .mockResolvedValueOnce([]);           // INSERT ... ON CONFLICT DO UPDATE

    const res = await request(app)
      .put('/api/coach/boxers/1')
      .set(authHeader())
      .send({ first_name: 'Ali', last_name: 'Updated', wins: 10, losses: 2, draws: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('404 si boxeur inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/coach/boxers/999')
      .set(authHeader())
      .send({ first_name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ===== DELETE /api/coach/boxers/:userId =====
describe('DELETE /api/coach/boxers/:userId', () => {
  test('200 supprime le boxeur', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ id: 1 }])  // SELECT user
      .mockResolvedValueOnce([]);           // DELETE

    const res = await request(app)
      .delete('/api/coach/boxers/1')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('404 si boxeur inexistant', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/api/coach/boxers/999')
      .set(authHeader());

    expect(res.status).toBe(404);
  });
});

// ===== GET /api/coach/payments/month =====
describe('GET /api/coach/payments/month', () => {
  test('200 retourne les paiements du mois courant', async () => {
    mockDb.query.mockResolvedValueOnce([
      { user_id: 1, first_name: 'Ali', paid: 1, month: 1, year: 2025 },
      { user_id: 2, first_name: 'Mike', paid: 0, month: 1, year: 2025 },
    ]);

    const res = await request(app)
      .get('/api/coach/payments/month')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.boxers).toHaveLength(2);
    expect(res.body.month).toBeDefined();
    expect(res.body.year).toBeDefined();
  });

  test('200 accepte month et year en query params', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/coach/payments/month?month=3&year=2025')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.month).toBe(3);
    expect(res.body.year).toBe(2025);
  });
});

// ===== PUT /api/coach/payments/:profileId/:month/:year =====
describe('PUT /api/coach/payments/:profileId/:month/:year', () => {
  test('200 met à jour un paiement existant', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ id: 7 }])  // SELECT existing
      .mockResolvedValueOnce([]);           // UPDATE

    const res = await request(app)
      .put('/api/coach/payments/5/1/2025')
      .set(authHeader())
      .send({ paid: true, amount: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('200 crée un paiement s\'il n\'existe pas', async () => {
    mockDb.query
      .mockResolvedValueOnce([])   // SELECT → vide
      .mockResolvedValueOnce([]);  // INSERT

    const res = await request(app)
      .put('/api/coach/payments/5/2/2025')
      .set(authHeader())
      .send({ paid: false, amount: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ===== POST /api/coach/payments/notify =====
describe('POST /api/coach/payments/notify', () => {
  test('400 si month ou year manquant', async () => {
    const res = await request(app)
      .post('/api/coach/payments/notify')
      .set(authHeader())
      .send({ boxer_ids: [1, 2] });

    expect(res.status).toBe(400);
  });

  test('200 envoie les rappels à tous les impayés', async () => {
    const { sendPaymentReminder } = require('../backend/email');
    mockDb.query.mockResolvedValueOnce([
      { email: 'ali@boxing.fr', first_name: 'Ali' },
      { email: 'mike@boxing.fr', first_name: 'Mike' },
    ]);

    const res = await request(app)
      .post('/api/coach/payments/notify')
      .set(authHeader())
      .send({ month: 1, year: 2025 });

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(2);
    expect(res.body.total).toBe(2);
    expect(sendPaymentReminder).toHaveBeenCalledTimes(2);
  });

  test('200 envoie aux boxer_ids spécifiés', async () => {
    const { sendPaymentReminder } = require('../backend/email');
    sendPaymentReminder.mockClear();
    mockDb.query.mockResolvedValueOnce([
      { email: 'ali@boxing.fr', first_name: 'Ali' },
    ]);

    const res = await request(app)
      .post('/api/coach/payments/notify')
      .set(authHeader())
      .send({ boxer_ids: [1], month: 1, year: 2025 });

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
  });
});
