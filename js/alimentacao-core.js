export const PROFILE_VERSION = 1;

export const ACTIVITY_FACTORS = Object.freeze({
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9
});

export const GOAL_FACTORS = Object.freeze({
  lose_gentle: 0.9,
  lose: 0.85,
  maintain: 1,
  gain: 1.05
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundTo(value, step = 10) {
  return Math.round(value / step) * step;
}

export function calculateRestingEnergy(profile = {}) {
  const weightKg = finiteNumber(profile.weightKg);
  const heightCm = finiteNumber(profile.heightCm);
  const age = finiteNumber(profile.age);
  const sex = profile.sexAtBirth;

  if (!(weightKg >= 35 && weightKg <= 300)) return null;
  if (!(heightCm >= 120 && heightCm <= 230)) return null;
  if (!(age >= 18 && age <= 100)) return null;
  if (!['female', 'male'].includes(sex)) return null;

  const sexConstant = sex === 'male' ? 5 : -161;
  return roundTo((10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant, 1);
}

export function calculateEnergyPlan(profile = {}) {
  const manualTarget = finiteNumber(profile.manualCalories);
  if (profile.calculationMode === 'manual') {
    if (!(manualTarget >= 800 && manualTarget <= 7000)) return null;
    const target = roundTo(manualTarget);
    return {
      method: 'manual',
      resting: null,
      maintenance: null,
      target,
      rangeLow: target,
      rangeHigh: target,
      needsCalibration: false
    };
  }

  const resting = calculateRestingEnergy(profile);
  const activityFactor = ACTIVITY_FACTORS[profile.activityLevel];
  const goalFactor = GOAL_FACTORS[profile.goal];
  if (!resting || !activityFactor || !goalFactor) return null;

  const maintenance = roundTo(resting * activityFactor);
  const target = roundTo(maintenance * goalFactor);

  return {
    method: 'mifflin-st-jeor',
    resting,
    maintenance,
    target,
    rangeLow: roundTo(target * 0.9),
    rangeHigh: roundTo(target * 1.1),
    needsCalibration: true
  };
}

export function allocateMealCalories(totalCalories, mealPattern = '3+1', breakfastAppetite = 'medium') {
  const total = finiteNumber(totalCalories);
  if (!(total > 0)) return null;

  const breakfastShares = { low: 0.2, medium: 0.25, high: 0.3 };
  const breakfastShare = breakfastShares[breakfastAppetite] || breakfastShares.medium;
  const patterns = {
    '3': { lunch: 0.4, snacks: [] },
    '3+1': { lunch: 0.35, snacks: [0.1] },
    '3+2': { lunch: 0.33, snacks: [0.075, 0.075] }
  };
  const pattern = patterns[mealPattern] || patterns['3+1'];

  const breakfast = roundTo(total * breakfastShare);
  const lunch = roundTo(total * pattern.lunch);
  const snacks = pattern.snacks.map(share => roundTo(total * share));
  const dinner = roundTo(total - breakfast - lunch - snacks.reduce((sum, value) => sum + value, 0));

  return { breakfast, lunch, dinner, snacks };
}

export function getProfileCompletion(profile = {}) {
  const required = profile.calculationMode === 'manual'
    ? ['manualCalories', 'goal', 'mealPattern', 'breakfastAppetite']
    : ['age', 'sexAtBirth', 'heightCm', 'weightKg', 'activityLevel', 'goal', 'mealPattern', 'breakfastAppetite'];

  const validators = {
    manualCalories: value => finiteNumber(value) >= 800 && finiteNumber(value) <= 7000,
    age: value => finiteNumber(value) >= 18 && finiteNumber(value) <= 100,
    sexAtBirth: value => ['female', 'male'].includes(value),
    heightCm: value => finiteNumber(value) >= 120 && finiteNumber(value) <= 230,
    weightKg: value => finiteNumber(value) >= 35 && finiteNumber(value) <= 300,
    activityLevel: value => Boolean(ACTIVITY_FACTORS[value]),
    goal: value => Boolean(GOAL_FACTORS[value]),
    mealPattern: value => ['3', '3+1', '3+2'].includes(value),
    breakfastAppetite: value => ['low', 'medium', 'high'].includes(value)
  };

  const complete = required.filter(key => {
    const value = profile[key];
    if (value === undefined || value === null || String(value).trim() === '') return false;
    return validators[key] ? validators[key](value) : true;
  });

  return {
    complete: complete.length === required.length,
    completedCount: complete.length,
    totalCount: required.length,
    percentage: Math.round((complete.length / required.length) * 100),
    missing: required.filter(key => !complete.includes(key))
  };
}

export function buildNutritionPriorities(profile = {}) {
  const priorities = [
    { key: 'protein', label: 'Proteína', reason: 'Distribuir pelas refeições e ajustar ao peso, objetivo e treino.' },
    { key: 'fiber', label: 'Fibra', reason: 'Combinar cereais integrais, fruta, hortícolas, leguminosas, frutos secos e sementes.' },
    { key: 'iron', label: 'Ferro + vitamina C', reason: 'A vitamina C na mesma refeição ajuda a aproveitar o ferro de origem vegetal.' },
    { key: 'b12', label: 'Vitamina B12', reason: 'Confirmar frequência de ovos, lacticínios, alimentos fortificados e suplementação.' },
    { key: 'calcium', label: 'Cálcio', reason: 'Contabilizar lacticínios e bebidas vegetais fortificadas.' },
    { key: 'omega3', label: 'Ómega-3', reason: 'Incluir sementes de linhaça/chia, nozes ou outra fonte adequada.' },
    { key: 'iodine', label: 'Iodo', reason: 'Confirmar sal iodado, alimentos fortificados ou orientação profissional.' },
    { key: 'vitaminD', label: 'Vitamina D', reason: 'Não presumir suficiência apenas através das receitas.' }
  ];

  const supplements = Array.isArray(profile.supplements) ? profile.supplements : [];
  return priorities.map(item => ({
    ...item,
    noted: supplements.includes(item.key)
  }));
}
