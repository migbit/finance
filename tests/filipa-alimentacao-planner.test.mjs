import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const baseSource = await readFile(new URL('../js/alimentacao-planner.js', import.meta.url), 'utf8');
const baseUrl = `data:text/javascript;base64,${Buffer.from(baseSource).toString('base64')}`;
const filipaSource = (await readFile(new URL('../js/filipa-alimentacao-planner.js', import.meta.url), 'utf8'))
  .replace("'./alimentacao-planner.js'", `'${baseUrl}'`);
const module = await import(`data:text/javascript;base64,${Buffer.from(filipaSource).toString('base64')}`);
const { FILIPA_MEAL_TARGETS, applyFilipaDailyPlanDate, calculateFilipaDailyPlan } = module;

const recipe = (id, calories, protein = 20) => ({
  id, name: id, calories, protein, carbs: 20, fat: 8, fiber: 4
});

test('a distribuição base reserva 150 kcal para extras', () => {
  assert.deepEqual(FILIPA_MEAL_TARGETS, {
    breakfast: 330,
    lunch: 400,
    snack: 220,
    dinner: 410,
    bedtime: 140,
    extras: 150
  });
  const plan = calculateFilipaDailyPlan();
  assert.equal(plan.plannedCalories, 1650);
  assert.equal(plan.reservedCalories, 1650);
  assert.equal(plan.dinnerCalories, 410);
  assert.equal(plan.extrasRemaining, 150);
});

test('as escolhas reais ajustam almoço e jantar mantendo o total e a margem', () => {
  const plan = calculateFilipaDailyPlan({
    breakfast: recipe('breakfast', 340, 28),
    lunch: recipe('lunch', 423, 41),
    dinner: recipe('dinner', 420, 28),
    snack: recipe('snack', 216, 17),
    bedtime: recipe('bedtime', 142, 17),
    extras: [recipe('chocolate', 100, 1)]
  });
  assert.equal(plan.lunchCalories, 396);
  assert.equal(plan.dinnerCalories, 406);
  assert.equal(plan.extrasRemaining, 50);
  assert.equal(plan.plannedCalories, 1650);
  assert.equal(plan.closesCalorieTarget, true);
  assert.equal(plan.allMealsResolved, true);
});

test('extras acima da margem ficam registados e reduzem o jantar', () => {
  const plan = calculateFilipaDailyPlan({
    breakfast: recipe('breakfast', 340),
    lunch: recipe('lunch', 423),
    dinner: recipe('dinner', 420),
    snack: recipe('snack', 216),
    bedtime: recipe('bedtime', 142),
    extras: [recipe('extra', 200)]
  });
  assert.equal(plan.hasExtraOverflow, true);
  assert.equal(plan.extrasRemaining, -50);
  assert.equal(plan.lunchCalories, 371);
  assert.equal(plan.dinnerCalories, 381);
  assert.equal(plan.plannedCalories, 1650);
});

test('o início de um novo dia limpa todas as escolhas da Filipa', () => {
  const result = applyFilipaDailyPlanDate({
    planDate: '2026-08-21',
    selectedBreakfastId: 'a',
    selectedLunchId: 'b',
    selectedDinnerId: 'c',
    selectedSnackId: 'd',
    selectedBedtimeId: 'e',
    extras: [{ calories: 50 }]
  }, '2026-08-22');
  assert.equal(result.didReset, true);
  assert.equal(result.profile.selectedBreakfastId, '');
  assert.equal(result.profile.selectedSnackId, '');
  assert.equal(result.profile.selectedBedtimeId, '');
  assert.deepEqual(result.profile.extras, []);
  assert.deepEqual(result.profile.mealCalories, { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 });
});

test('alterar a meta diária recalcula todas as reservas proporcionalmente', () => {
  const plan = calculateFilipaDailyPlan({ targetCalories: 1800 });
  assert.equal(plan.breakfastCalories, 360);
  assert.equal(plan.lunchCalories, 436);
  assert.equal(plan.snackCalories, 240);
  assert.equal(plan.dinnerCalories, 447);
  assert.equal(plan.bedtimeCalories, 153);
  assert.equal(plan.extraBudget, 164);
  assert.equal(plan.plannedCalories, 1800);
});

test('um total real dos lanches substitui lanche, ceia e extras e recalcula o resto', () => {
  const plan = calculateFilipaDailyPlan({ mealCalories: { snacks: 400 } });
  assert.equal(plan.snackCalories, 400);
  assert.equal(plan.bedtimeCalories, 0);
  assert.equal(plan.extraBudget, 150);
  assert.equal(plan.selectedNutrition.calories, 400);
  assert.equal(plan.plannedCalories, 1650);
});
