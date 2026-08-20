import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/alimentacao-core.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  allocateMealCalories,
  buildNutritionPriorities,
  calculateEnergyPlan,
  calculateRestingEnergy,
  getProfileCompletion
} = module;

const completeProfile = {
  calculationMode: 'estimate',
  age: 35,
  sexAtBirth: 'male',
  heightCm: 178,
  weightKg: 75,
  activityLevel: 'moderate',
  goal: 'maintain',
  mealPattern: '3+1',
  breakfastAppetite: 'medium'
};

test('calcula energia de repouso com a equação de Mifflin–St Jeor', () => {
  assert.equal(calculateRestingEnergy(completeProfile), 1693);
  assert.equal(calculateRestingEnergy({ ...completeProfile, sexAtBirth: 'female' }), 1527);
  assert.equal(calculateRestingEnergy({ ...completeProfile, age: '' }), null);
});

test('produz um alvo estimado e intervalo explícito', () => {
  const plan = calculateEnergyPlan(completeProfile);
  assert.equal(plan.method, 'mifflin-st-jeor');
  assert.equal(plan.resting, 1693);
  assert.equal(plan.maintenance, 2620);
  assert.equal(plan.target, 2620);
  assert.equal(plan.rangeLow, 2360);
  assert.equal(plan.rangeHigh, 2880);
  assert.equal(plan.needsCalibration, true);
});

test('respeita um alvo manual sem o transformar numa estimativa', () => {
  const plan = calculateEnergyPlan({ calculationMode: 'manual', manualCalories: 2346 });
  assert.deepEqual(plan, {
    method: 'manual',
    resting: null,
    maintenance: null,
    target: 2350,
    rangeLow: 2350,
    rangeHigh: 2350,
    needsCalibration: false
  });
});

test('a distribuição das refeições conserva o total diário', () => {
  for (const mealPattern of ['3', '3+1', '3+2']) {
    for (const appetite of ['low', 'medium', 'high']) {
      const allocation = allocateMealCalories(2500, mealPattern, appetite);
      const total = allocation.breakfast + allocation.lunch + allocation.dinner
        + allocation.snacks.reduce((sum, value) => sum + value, 0);
      assert.equal(total, 2500);
    }
  }
});

test('o perfil só fica completo com os campos essenciais do modo escolhido', () => {
  assert.equal(getProfileCompletion(completeProfile).complete, true);
  assert.equal(getProfileCompletion({ ...completeProfile, heightCm: '' }).complete, false);
  assert.equal(getProfileCompletion({ ...completeProfile, age: 8 }).complete, false);
  assert.equal(getProfileCompletion({
    calculationMode: 'manual',
    manualCalories: 2200,
    goal: 'maintain',
    mealPattern: '3',
    breakfastAppetite: 'low'
  }).complete, true);
});

test('assinala suplementos sem os tratar como cobertura nutricional confirmada', () => {
  const priorities = buildNutritionPriorities({ supplements: ['b12'] });
  assert.equal(priorities.find(item => item.key === 'b12').noted, true);
  assert.equal(priorities.find(item => item.key === 'iron').noted, false);
});
