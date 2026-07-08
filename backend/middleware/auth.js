const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'boxing-secret-2024';

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

function requireCoach(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'coach') return res.status(403).json({ error: 'Accès réservé au coach' });
    next();
  });
}

function requireBoxer(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'boxer') return res.status(403).json({ error: 'Accès réservé aux boxeurs' });
    next();
  });
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    if (req.admin.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l\'admin' });
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

module.exports = { requireAuth, requireCoach, requireBoxer, requireAdmin };
