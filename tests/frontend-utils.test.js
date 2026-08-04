// Tests unitaires des fonctions utilitaires frontend
// Les fonctions sont répliquées ici car elles tournent dans le navigateur (pas de module.exports)

// ===== fullName =====
function fullName(b) {
  if (b.first_name && b.last_name) return b.first_name + ' ' + b.last_name;
  if (b.first_name) return b.first_name;
  if (b.last_name) return b.last_name;
  return b.email ? b.email.split('@')[0] : 'Boxeur';
}

// ===== fmtDateShort / fmtDateFull =====
function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDateFull(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ===== getEvType / getEvColor =====
const EV_TYPES = {
  boxe:      { label: 'Boxe',      css: 'ev-boxe'      },
  condition: { label: 'Condition', css: 'ev-condition'  },
  muscu:     { label: 'Muscu',     css: 'ev-muscu'      },
  sparring:  { label: 'Sparring',  css: 'ev-sparring'   },
  cardio:    { label: 'Cardio',    css: 'ev-cardio'     },
  combat:    { label: 'Combat',    css: 'ev-combat'     },
  recreant:  { label: 'Récréant',  css: 'ev-recreant'   },
};
const EV_COLORS = {
  boxe: '#e74c3c', condition: '#2ecc71', muscu: '#e67e22',
  sparring: '#9b59b6', cardio: '#3498db', combat: '#c0392b', recreant: '#C9A020',
};
function getEvType(type) {
  return EV_TYPES[type] || { label: type || 'Autre', css: 'ev-recreant' };
}
function getEvColor(type) {
  return EV_COLORS[type] || '#888888';
}

// ===== TESTS =====

describe('fullName', () => {
  test('prénom + nom', () => expect(fullName({ first_name: 'Soulimane', last_name: 'Marso' })).toBe('Soulimane Marso'));
  test('prénom seul', () => expect(fullName({ first_name: 'Yaro' })).toBe('Yaro'));
  test('nom seul',   () => expect(fullName({ last_name: 'Bello' })).toBe('Bello'));
  test('fallback email', () => expect(fullName({ email: 'yaro@snatch.fr' })).toBe('yaro'));
  test('fallback Boxeur si rien', () => expect(fullName({})).toBe('Boxeur'));
  test('prénom + nom prioritaires sur email', () => {
    expect(fullName({ first_name: 'Jean', last_name: 'Dupont', email: 'j@d.fr' })).toBe('Jean Dupont');
  });
});

describe('fmtDateShort', () => {
  test('retourne une chaîne non vide pour une date valide', () => {
    expect(fmtDateShort('2025-08-15')).toBeTruthy();
  });
  test('retourne chaîne vide pour null', () => expect(fmtDateShort(null)).toBe(''));
  test('retourne chaîne vide pour undefined', () => expect(fmtDateShort(undefined)).toBe(''));
  test('contient le jour du mois', () => expect(fmtDateShort('2025-08-15')).toContain('15'));
});

describe('fmtDateFull', () => {
  test('retourne une chaîne non vide pour une date valide', () => {
    expect(fmtDateFull('2025-08-15')).toBeTruthy();
  });
  test('retourne chaîne vide pour null', () => expect(fmtDateFull(null)).toBe(''));
  test('contient "août" pour le mois 8', () => {
    expect(fmtDateFull('2025-08-15').toLowerCase()).toContain('août');
  });
  test('contient le jour du mois', () => expect(fmtDateFull('2025-08-15')).toContain('15'));
});

describe('getEvType', () => {
  test('retourne le bon label pour boxe', () => expect(getEvType('boxe').label).toBe('Boxe'));
  test('retourne le bon label pour sparring', () => expect(getEvType('sparring').label).toBe('Sparring'));
  test('fallback label pour type inconnu', () => expect(getEvType('inconnu').label).toBe('inconnu'));
  test('fallback "Autre" si type vide', () => expect(getEvType('').label).toBe('Autre'));
  test('fallback si type undefined', () => expect(getEvType(undefined).label).toBe('Autre'));
  test('tous les types connus ont un label', () => {
    Object.keys(EV_TYPES).forEach(t => expect(getEvType(t).label).toBeTruthy());
  });
});

describe('getEvColor', () => {
  test('retourne une couleur hex pour boxe', () => expect(getEvColor('boxe')).toMatch(/^#/));
  test('retourne gris #888888 pour type inconnu', () => expect(getEvColor('inconnu')).toBe('#888888'));
  test('tous les types connus ont une couleur', () => {
    Object.keys(EV_COLORS).forEach(t => expect(getEvColor(t)).toMatch(/^#/));
  });
});
