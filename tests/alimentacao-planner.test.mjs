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

test('reserva lanche e fecha exatamente as 2400 kcal com as três refeições', () => {
  const plan = calculateDailyPlan({ targetCalories: 2400, breakfast, lunch, dinner });
  assert.equal(plan.lunchCalories, 840);
  assert.equal(plan.dinnerCalories, 720);
  assert.equal(plan.reservedSnackCalories, 306);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.closesCalorieTarget, true);
});

test('um lanche introduzido reajusta o jantar e conserva o total diário', () => {
  const snack = { calories: 350, protein: 20, carbs: 35, fat: 8, fiber: 4 };
  const plan = calculateDailyPlan({ targetCalories: 2400, breakfast, lunch, dinner, snacks: [snack] });
  assert.equal(plan.dinnerCalories, 676);
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

test('um almoço fora reserva calorias sem inventar os seus macros', () => {
  const plan = calculateDailyPlan({
    targetCalories: 2400,
    breakfastSkipped: true,
    breakfastTarget: 0,
    lunchExternal: true,
    lunchTarget: 960,
    dinner,
    dinnerTarget: 960
  });
  assert.equal(plan.lunchResolved, true);
  assert.equal(plan.reservedLunchCalories, 960);
  assert.equal(plan.selectedNutrition.calories, 960);
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
  assert.equal(plan.dinnerCalories, 605);
  assert.equal(plan.plannedCalories, 2400);
  assert.equal(plan.closesCalorieTarget, true);
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
