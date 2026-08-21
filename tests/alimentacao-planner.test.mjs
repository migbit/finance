import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/alimentacao-planner.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  adjustMealToCalories,
  calculateDailyPlan,
  getMaximumSnackCalories,
  recommendMainMeals
} = module;

const breakfast = { id: 'breakfast', calories: 534, protein: 34.7, carbs: 68.1, fat: 10.7, fiber: 13.7 };
const lunch = { id: 'lunch', name: 'Almoço', calories: 650, protein: 43, carbs: 56, fat: 25.3, fiber: 16.4 };
const dinner = { id: 'dinner', name: 'Jantar', calories: 620, protein: 50, carbs: 71, fat: 10.4, fiber: 13.1 };

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
