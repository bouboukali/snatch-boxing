const COMPETITION_CATS = ['U15', 'U17', 'U19', 'Elite', 'Masters', 'Récréant'];

const WEIGHT_CATS_ELITE_H = [
  '46 – 50 kg (Light Flyweight)',
  '51 – 54 kg (Flyweight)',
  '55 – 57 kg (Bantamweight)',
  '58 – 60 kg (Featherweight)',
  '61 – 64 kg (Lightweight)',
  '65 – 69 kg (Light Welterweight)',
  '70 – 75 kg (Welterweight)',
  '76 – 80 kg (Light Middleweight)',
  '81 – 86 kg (Middleweight)',
  '87 – 92 kg (Light Heavyweight)',
  '+92 kg (Heavyweight)',
];

const WEIGHT_CATS_ELITE_F = [
  '45 – 48 kg (Light Flyweight)',
  '49 – 51 kg (Flyweight)',
  '52 – 54 kg (Bantamweight)',
  '55 – 57 kg (Featherweight)',
  '58 – 60 kg (Lightweight)',
  '61 – 64 kg (Light Welterweight)',
  '65 – 69 kg (Welterweight)',
  '70 – 75 kg (Light Middleweight)',
  '76 – 80 kg (Middleweight)',
  '+80 kg (Light Heavyweight)',
];

const WEIGHT_CATS_U17_H = [
  '46 – 48 kg (Light Flyweight)',
  '49 – 52 kg (Flyweight)',
  '53 – 54 kg (Bantamweight)',
  '55 – 57 kg (Featherweight)',
  '58 – 60 kg (Lightweight)',
  '61 – 63 kg (Light Welterweight)',
  '64 – 66 kg (Welterweight)',
  '67 – 70 kg (Light Middleweight)',
  '71 – 75 kg (Middleweight)',
  '76 – 80 kg (Light Heavyweight)',
  '+80 kg (Heavyweight)',
];

const WEIGHT_CATS_U17_F = [
  '44 – 46 kg (Light Flyweight)',
  '47 – 48 kg (Flyweight)',
  '49 – 52 kg (Bantamweight)',
  '53 – 54 kg (Featherweight)',
  '55 – 57 kg (Lightweight)',
  '58 – 60 kg (Light Welterweight)',
  '61 – 63 kg (Welterweight)',
  '64 – 66 kg (Light Middleweight)',
  '67 – 70 kg (Middleweight)',
  '+70 kg (Light Heavyweight)',
];

function getWeightCats(gender, compCat) {
  const isU17 = compCat === 'U15' || compCat === 'U17';
  if (isU17) return gender === 'Femme' ? WEIGHT_CATS_U17_F : WEIGHT_CATS_U17_H;
  return gender === 'Femme' ? WEIGHT_CATS_ELITE_F : WEIGHT_CATS_ELITE_H;
}

function calcCompCat(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age < 13)  return null;
  if (age < 15)  return 'U15';
  if (age < 17)  return 'U17';
  if (age < 19)  return 'U19';
  if (age <= 40) return 'Elite';
  return 'Masters';
}

module.exports = {
  COMPETITION_CATS,
  WEIGHT_CATS_ELITE_H,
  WEIGHT_CATS_ELITE_F,
  WEIGHT_CATS_U17_H,
  WEIGHT_CATS_U17_F,
  getWeightCats,
  calcCompCat,
};
