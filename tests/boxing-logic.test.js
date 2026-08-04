const {
  calcCompCat,
  getWeightCats,
  WEIGHT_CATS_ELITE_H,
  WEIGHT_CATS_ELITE_F,
  WEIGHT_CATS_U17_H,
  WEIGHT_CATS_U17_F,
  COMPETITION_CATS,
} = require('../backend/utils/boxing');

// Helper : génère une date de naissance pour un âge donné aujourd'hui
function dobForAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().split('T')[0];
}

// ===== calcCompCat =====
describe('calcCompCat', () => {
  test('null si pas de DDN', () => expect(calcCompCat(null)).toBeNull());
  test('null si moins de 13 ans', () => expect(calcCompCat(dobForAge(12))).toBeNull());
  test('U15 pour 13 ans',  () => expect(calcCompCat(dobForAge(13))).toBe('U15'));
  test('U15 pour 14 ans',  () => expect(calcCompCat(dobForAge(14))).toBe('U15'));
  test('U17 pour 15 ans',  () => expect(calcCompCat(dobForAge(15))).toBe('U17'));
  test('U17 pour 16 ans',  () => expect(calcCompCat(dobForAge(16))).toBe('U17'));
  test('U19 pour 17 ans',  () => expect(calcCompCat(dobForAge(17))).toBe('U19'));
  test('U19 pour 18 ans',  () => expect(calcCompCat(dobForAge(18))).toBe('U19'));
  test('Elite pour 19 ans', () => expect(calcCompCat(dobForAge(19))).toBe('Elite'));
  test('Elite pour 40 ans', () => expect(calcCompCat(dobForAge(40))).toBe('Elite'));
  test('Masters pour 41 ans', () => expect(calcCompCat(dobForAge(41))).toBe('Masters'));
  test('Masters pour 60 ans', () => expect(calcCompCat(dobForAge(60))).toBe('Masters'));
});

// ===== getWeightCats =====
describe('getWeightCats', () => {
  test('Homme Elite → WEIGHT_CATS_ELITE_H', () => {
    expect(getWeightCats('Homme', 'Elite')).toBe(WEIGHT_CATS_ELITE_H);
  });
  test('Homme U19 → WEIGHT_CATS_ELITE_H (U19 = adulte)', () => {
    expect(getWeightCats('Homme', 'U19')).toBe(WEIGHT_CATS_ELITE_H);
  });
  test('Homme Masters → WEIGHT_CATS_ELITE_H', () => {
    expect(getWeightCats('Homme', 'Masters')).toBe(WEIGHT_CATS_ELITE_H);
  });
  test('Femme Elite → WEIGHT_CATS_ELITE_F', () => {
    expect(getWeightCats('Femme', 'Elite')).toBe(WEIGHT_CATS_ELITE_F);
  });
  test('Homme U17 → WEIGHT_CATS_U17_H', () => {
    expect(getWeightCats('Homme', 'U17')).toBe(WEIGHT_CATS_U17_H);
  });
  test('Homme U15 → WEIGHT_CATS_U17_H (même grille que U17)', () => {
    expect(getWeightCats('Homme', 'U15')).toBe(WEIGHT_CATS_U17_H);
  });
  test('Femme U17 → WEIGHT_CATS_U17_F', () => {
    expect(getWeightCats('Femme', 'U17')).toBe(WEIGHT_CATS_U17_F);
  });

  test('les catégories ELITE_H contiennent du Heavyweight', () => {
    expect(WEIGHT_CATS_ELITE_H.some(c => c.includes('Heavyweight'))).toBe(true);
  });
  test('les catégories ELITE_F ne dépassent pas 80 kg', () => {
    expect(WEIGHT_CATS_ELITE_F[WEIGHT_CATS_ELITE_F.length - 1]).toMatch(/80/);
  });
  test('toutes les catégories ont un nom entre parenthèses', () => {
    const all = [...WEIGHT_CATS_ELITE_H, ...WEIGHT_CATS_ELITE_F, ...WEIGHT_CATS_U17_H, ...WEIGHT_CATS_U17_F];
    all.forEach(c => expect(c).toMatch(/\(.+\)/));
  });
});

// ===== COMPETITION_CATS =====
describe('COMPETITION_CATS', () => {
  test('contient les 6 catégories attendues', () => {
    expect(COMPETITION_CATS).toEqual(['U15', 'U17', 'U19', 'Elite', 'Masters', 'Récréant']);
  });
});
