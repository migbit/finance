import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/alimentacao-planner.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  applyDailyPlanDate,
  adjustMealToCalories,
  calculateDailyPlan,
  getLocalDateKey,
  getMaximumSnackCalories,
  rebalanceMealCalories,
  recommendMainMeals
} = module;

const breakfast = { id: 'breakfast', calories: 534, protein: 34.7, carbs: 68.1, fat: 10.7, fiber: 13.7 };
const lunch = { id: 'lunch', name: 'Almoço', calories: 650, protein: 43, carbs: 56, fat: 25.3, fiber: 16.4 };
const dinner = { id: 'dinner', name: 'Jantar', calories: 620, protein: 50, carbs: 71, fat: 10.4, fiber: 13.1 };

test('gera uma chave de data local estável', () => {
  assert.equal(getLocalDateKey(new Date(2026, 7, 21, 23, 59, 59)), '2026-08-21');
});

test('uma nova data limpa apenas escolhas e lanches', () => {
  const profile = {
    planDate: '2026-08-20',
    selectedBreakfastId: 'breakfast',
    selectedLunchId: 'lunch',
    selectedDinnerId: 'dinner',
    snacks: [{ calories: 104 }],
    manualCalories: 2400,
    favoriteFoods: 'Mantém-se'
  };
  const result = applyDailyPlanDate(profile, '2026-08-21');
  assert.equal(result.didReset, true);
  assert.equal(result.profile.planDate, '2026-08-21');
  assert.equal(result.profile.selectedBreakfastId, '');
  assert.equal(result.profile.breakfastSkipped, false);
  assert.equal(result.profile.selectedLunchId, '');
  assert.equal(result.profile.lunchExternal, false);
  assert.equal(result.profile.selectedDinnerId, '');
  assert.deepEqual(result.profile.snacks, []);
  assert.deepEqual(result.profile.mealCalories, { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 });
  assert.equal(result.profile.manualCalories, 2400);
  assert.equal(result.profile.favoriteFoods, 'Mantém-se');
});

test('a mesma data conserva o plano já escolhido', () => {
  const profile = {
    planDate: '2026-08-21',
    selectedBreakfastId: 'breakfast',
    snacks: [{ calories: 104 }]
  };
  const result = applyDailyPlanDate(profile, '2026-08-21');
  assert.equal(result.didReset, false);
  assert.equal(result.profile, profile);
});

test('ajusta uma receita a uma meta calórica mantendo proporções explícitas', () => {
  assert.deepEqual(adjustMealToCalories(lunch, 840), {
    id: 'lunch',
    name: 'Almoço',
    baseCalories: 650,
    calories: 840,
    protein: 55.6,
    carbs: 72.4,
    fat: 32.7,
    fiber: 21.2,
    servingFactor: 1.29,
    adjustmentLabel: '',
    adjustmentUnit: '',
    baseQuantity: null,
    adjustedQuantity: null,
    isPracticalPortion: true
  });
});

test('numa receita curada ajusta o componente energético sem aumentar toda a proteína', () => {
  const meal = {
    ...lunch,
    calorieAdjustment: {
      label: 'arroz integral pronto',
      baseQuantity: 125,
      unit: 'g',
      calories: 210,
      protein: 4.5,
      carbs: 37.5,
      fat: 2.5,
      fiber: 4.8
    }
  };
  assert.deepEqual(adjustMealToCalories(meal, 840), {
    id: 'lunch',
    name: 'Almoço',
    baseCalories: 650,
    calories: 840,
    protein: 47.1,
    carbs: 89.9,
    fat: 27.6,
    fiber: 20.7,
    servingFactor: 1.29,
    adjustmentLabel: 'arroz integral pronto',
    adjustmentUnit: 'g',
    baseQuantity: 125,
    adjustedQuantity: 238.1,
    isPracticalPortion: true
  });
});

test('redistribui a diferença do pequeno-almoço por todas as metas restantes', () => {
  const plan = calculateDailyPlan({ targetCalories: 2400, breakfast, lunch, dinner });
  assert.equal(plan.lunchCalories, 871);
  assert.equal(plan.dinnerCalories, 746);
  assert.equal(plan.reservedSnackCalories, 249);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.closesCalorieTarget, true);
});

test('um lanche introduzido reajusta almoço e jantar e conserva o total diário', () => {
  const snack = { calories: 350, protein: 20, carbs: 35, fat: 8, fiber: 4 };
  const plan = calculateDailyPlan({ targetCalories: 2400, breakfast, lunch, dinner, snacks: [snack] });
  assert.equal(plan.lunchCalories, 816);
  assert.equal(plan.dinnerCalories, 700);
  assert.equal(plan.reservedSnackCalories, 0);
  assert.equal(plan.plannedCalories, 2400);
});

test('permite escolher o jantar primeiro e reserva as refeições em falta', () => {
  const plan = calculateDailyPlan({
    targetCalories: 2400,
    breakfastTarget: 600,
    lunchTarget: 840,
    dinner,
    dinnerTarget: 720
  });
  assert.equal(plan.confirmedCalories, 720);
  assert.equal(plan.reservedBreakfastCalories, 600);
  assert.equal(plan.reservedLunchCalories, 840);
  assert.equal(plan.reservedSnackCalories, 240);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.allMealsResolved, false);
  assert.equal(plan.closesCalorieTarget, false);
});

test('sem pequeno-almoço redistribui o dia pelas metas indicadas', () => {
  const plan = calculateDailyPlan({
    targetCalories: 2400,
    breakfastSkipped: true,
    breakfastTarget: 0,
    lunch,
    lunchTarget: 960,
    dinner,
    dinnerTarget: 960
  });
  assert.equal(plan.plannedBreakfastCalories, 0);
  assert.equal(plan.lunchCalories, 960);
  assert.equal(plan.dinnerCalories, 960);
  assert.equal(plan.reservedSnackCalories, 480);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.allMealsResolved, true);
});

test('as kcal reais de um almoço recalculam a refeição seguinte sem inventar macros', () => {
  const plan = calculateDailyPlan({
    targetCalories: 2400,
    breakfast,
    lunch,
    dinner,
    mealCalories: { lunch: 900 }
  });
  assert.equal(plan.lunchResolved, true);
  assert.equal(plan.adjustedLunch.calories, 900);
  assert.equal(plan.adjustedLunch.protein, null);
  assert.ok(plan.partialNutrients.includes('protein'));
  assert.equal(plan.dinnerCalories, 725);
  assert.equal(plan.reservedSnackCalories, 241);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.closesCalorieTarget, true);
});

test('dois lanches predefinidos reajustam o jantar sem ultrapassar a meta', () => {
  const shake = { calories: 104, protein: 23, carbs: 1.5, fat: 0.7, fiber: 0 };
  const skyr = { calories: 317, protein: 23.8, carbs: 52.6, fat: 2, fiber: 5.6 };
  const plan = calculateDailyPlan({
    targetCalories: 2400,
    breakfast,
    lunch,
    dinner,
    snacks: [shake, skyr]
  });
  assert.equal(plan.snackTotals.calories, 421);
  assert.equal(plan.lunchCalories, 778);
  assert.equal(plan.dinnerCalories, 667);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.closesCalorieTarget, true);
});

test('uma nova meta diária recalcula proporcionalmente todas as refeições', () => {
  assert.deepEqual(rebalanceMealCalories(1800, {
    breakfast: 330,
    lunch: 400,
    dinner: 410,
    snacks: 510
  }), {
    breakfast: 360,
    lunch: 436,
    dinner: 447,
    snacks: 557
  });
});

test('limita lanches para preservar um jantar mínimo', () => {
  assert.equal(getMaximumSnackCalories({
    targetCalories: 2400,
    breakfastCalories: 534,
    lunchCalories: 840,
    minimumDinnerCalories: 400
  }), 626);
});

test('recomenda sem repetir o almoço já escolhido', () => {
  const meals = [lunch, dinner, { ...dinner, id: 'other', rank: 2 }];
  const ranked = recommendMainMeals(meals, {
    calorieTarget: 720,
    consumedNutrition: breakfast,
    excludedIds: ['lunch']
  });
  assert.equal(ranked.length, 2);
  assert.ok(ranked.every(item => item.meal.id !== 'lunch'));
});

test('não cria porções inválidas quando as kcal registadas já excedem a meta', () => {
  assert.deepEqual(recommendMainMeals([lunch, dinner], { calorieTarget: 0 }), []);
  const plan = calculateDailyPlan({
    targetCalories: 800,
    lunch,
    dinner,
    mealCalories: { breakfast: 1000 }
  });
  assert.equal(plan.lunchCalories, 0);
  assert.equal(plan.dinnerCalories, 0);
  assert.equal(plan.closesCalorieTarget, false);
});

test('uma refeição consumida mantém porção e macros após lanches, nova meta e edição da receita', () => {
  const first = calculateDailyPlan({ targetCalories: 2400, breakfast, lunch, dinner, practicalPortions: true });
  const consumedMeals = { lunch: JSON.parse(JSON.stringify(first.adjustedLunch)) };
  const next = calculateDailyPlan({ targetCalories: 2100, breakfast, lunch: { ...lunch, calories: 999 }, dinner,
    snacks: [{ calories: 350, protein: 20, carbs: 30, fat: 8, fiber: 4 }], consumedMeals, practicalPortions: true });
  assert.deepEqual(next.adjustedLunch, first.adjustedLunch);
  assert.equal(next.lunchCalories, first.adjustedLunch.calories);
  assert.equal(next.consumedCalories, first.adjustedLunch.calories);
  assert.deepEqual(applyDailyPlanDate({ planDate: '2026-10-11', consumedMeals }, '2026-10-12').profile.consumedMeals, {});
});

test('porções práticas arredondam e limitam o ingrediente sem inventar calorias', () => {
  const meal = { ...lunch, calorieAdjustment: {
    label: 'arroz', unit: 'g', baseQuantity: 125, calories: 210, protein: 4.5, carbs: 37.5, fat: 2.5, fiber: 4.8,
    minQuantity: 75, maxQuantity: 250, step: 25
  } };
  const large = adjustMealToCalories(meal, 1400, { practicalPortions: true });
  assert.equal(large.adjustedQuantity, 250);
  assert.equal(large.calories, 860);
  assert.equal(large.protein, 47.5);
  assert.equal(large.calorieGap, 540);
  const small = adjustMealToCalories(meal, 100, { practicalPortions: true });
  assert.equal(small.adjustedQuantity, 75);
  assert.equal(small.calories, 566);
  assert.equal(small.calorieGap, -466);
  const normal = adjustMealToCalories(meal, 740, { practicalPortions: true });
  assert.equal(normal.adjustedQuantity, 175);
  assert.equal(normal.calories, 734);
});

test('uma porção fixa conserva macros em falta e o plano identifica os totais parciais', () => {
  const plan = calculateDailyPlan({ targetCalories: 2400, lunch: { ...lunch, protein: null }, practicalPortions: true });
  assert.equal(plan.adjustedLunch.protein, null);
  assert.deepEqual(plan.partialNutrients, ['protein']);
  assert.equal(plan.adjustedLunch.calories, lunch.calories);
});

test('refeições consumidas continuam contabilizadas mesmo quando ultrapassam uma nova meta', () => {
  const consumedMeals = { breakfast, lunch, dinner };
  const plan = calculateDailyPlan({ targetCalories: 800, consumedMeals, practicalPortions: true });
  assert.equal(plan.confirmedCalories, breakfast.calories + lunch.calories + dinner.calories);
  assert.ok(plan.caloriesRemaining < 0);
  assert.equal(plan.closesCalorieTarget, false);
  assert.deepEqual(plan.adjustedLunch, lunch);
});
