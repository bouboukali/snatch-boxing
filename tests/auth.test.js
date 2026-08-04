const request = require('supertest');

// Mock DB avant de charger l'app
// Les hashes sont inlinés directement (jest.mock factory ne peut pas accéder au scope extérieur)
// hash de 'password123' et 'temppass' générés avec bcrypt.hashSync(..., 10)
jest.mock('../backend/db', () => {
  const users = [
    {
      id: 1,
      email: 'coach@boxing.fr',
      password: '$2b$10$eOQNpaQBusmru1z4waQMC.heLHOTJLaqqV.7Gd.egX7AxiRon5N66',
      role: 'boxer',
      must_change_password: 0,
    },
    {
      id: 2,
      email: 'firstlogin@boxing.fr',
      password: '$2b$10$Iemi/Ahinr3HWHSEzo8ZrO0akVyVDE6F.xdEWxhUr9TPKKZStrTIa',
      role: 'boxer',
      must_change_password: 1,
    },
  ];

  return {
    query: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT * FROM users WHERE email')) {
        return users.filter(u => u.email === params[0]);
      }
      if (sql.includes('SELECT * FROM boxer_profiles')) return [];
      if (sql.includes('UPDATE users SET password')) return [];
      return [];
    }),
  };
});

let app;
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = require('../backend/app');
});

describe('POST /api/auth/login', () => {
  test('200 avec token pour identifiants valides', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'coach@boxing.fr', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('boxer');
  });

  test('must_change_password false pour compte normal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'coach@boxing.fr', password: 'password123' });
    expect(res.body.must_change_password).toBe(false);
  });

  test('must_change_password true pour première connexion', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'firstlogin@boxing.fr', password: 'temppass' });
    expect(res.status).toBe(200);
    expect(res.body.must_change_password).toBe(true);
  });

  test('401 avec mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'coach@boxing.fr', password: 'mauvais' });
    expect(res.status).toBe(401);
  });

  test('401 avec email inconnu', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@boxing.fr', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('400 si champs manquants', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'coach@boxing.fr' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/change-password', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'firstlogin@boxing.fr', password: 'temppass' });
    token = res.body.token;
  });

  test('200 avec token valide et nouveau mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: 'nouveaumdp123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('400 si mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: '123' });
    expect(res.status).toBe(400);
  });

  test('401 sans token', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ new_password: 'nouveaumdp123' });
    expect(res.status).toBe(401);
  });
});
