const jwt = require('jsonwebtoken');
const { requireAuth, requireCoach, requireBoxer, requireAdmin } = require('../backend/middleware/auth');

// Le middleware lit JWT_SECRET au moment du require — on utilise le fallback par défaut
const SECRET = process.env.JWT_SECRET || 'boxing-secret-2024';

function makeToken(payload) {
  return jwt.sign(payload, SECRET);
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

// ===== requireAuth =====
describe('requireAuth', () => {
  test('appelle next() avec token valide', () => {
    const token = makeToken({ id: 1, role: 'boxer' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('boxer');
  });

  test('401 sans token', () => {
    const req = { headers: {} };
    const res = mockRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 avec token invalide', () => {
    const req = { headers: { authorization: 'Bearer token.faux.invalide' } };
    const res = mockRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ===== requireCoach =====
describe('requireCoach', () => {
  test('appelle next() pour un coach', () => {
    const token = makeToken({ id: 1, role: 'coach' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    requireCoach(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('403 pour un boxer', () => {
    const token = makeToken({ id: 2, role: 'boxer' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    requireCoach(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 pour un admin', () => {
    const token = makeToken({ id: 3, role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    requireCoach(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('401 sans token', () => {
    const req = { headers: {} };
    const res = mockRes();
    requireCoach(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ===== requireBoxer =====
describe('requireBoxer', () => {
  test('appelle next() pour un boxer', () => {
    const token = makeToken({ id: 2, role: 'boxer' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    requireBoxer(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('403 pour un coach', () => {
    const token = makeToken({ id: 1, role: 'coach' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    requireBoxer(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ===== requireAdmin =====
describe('requireAdmin', () => {
  test('appelle next() pour un admin', () => {
    const token = makeToken({ id: 99, role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    requireAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('403 pour un coach', () => {
    const token = makeToken({ id: 1, role: 'coach' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    requireAdmin(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('401 sans token', () => {
    const req = { headers: {} };
    const res = mockRes();
    requireAdmin(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 avec token invalide', () => {
    const req = { headers: { authorization: 'Bearer token.faux' } };
    const res = mockRes();
    requireAdmin(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
