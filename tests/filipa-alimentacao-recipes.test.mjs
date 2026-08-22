import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/filipa-alimentacao-recipes.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  FILIPA_BEDTIMES,
  FILIPA_BREAKFASTS,
  FILIPA_MAIN_MEALS,
  FILIPA_PROFILE_DEFAULTS,
  FILIPA_SNACKS,
  mergeFilipaRecipeCatalog
} = module;

test('o perfil aprovado usa 1 650 kcal e a meta proteica da Filipa', () => {
  assert.equal(FILIPA_PROFILE_DEFAULTS.manualCalories, 1650);
  assert.equal(FILIPA_PROFILE_DEFAULTS.weightKg, 54);
  assert.equal(FILIPA_PROFILE_DEFAULTS.proteinTargetLow, 100);
  assert.equal(FILIPA_PROFILE_DEFAULTS.proteinTargetHigh, 115);
});

test('existem quatro pequenos-almoços com as alterações aprovadas', () => {
  assert.equal(FILIPA_BREAKFASTS.length, 4);
  assert.match(FILIPA_BREAKFASTS[1].name, /Papas de aveia com claras/i);
  assert.doesNotMatch(FILIPA_BREAKFASTS[1].ingredients, /whey/i);
  assert.match(FILIPA_BREAKFASTS[2].name, /Crepioca/i);
  assert.doesNotMatch(FILIPA_BREAKFASTS[2].ingredients, /peru|frango|peixe|atum/i);
  assert.deepEqual(
    FILIPA_BREAKFASTS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 340, protein: 28.3, carbs: 35, fat: 9.4, fiber: 5.6 },
      { calories: 329, protein: 29.8, carbs: 43.5, fat: 4.7, fiber: 5.9 },
      { calories: 348, protein: 30.4, carbs: 25.4, fat: 14.4, fiber: 2.1 },
      { calories: 328, protein: 25, carbs: 38, fat: 9.4, fiber: 6.4 }
    ]
  );
});

test('existem quatro refeições principais com pesos cozinhados', () => {
  assert.equal(FILIPA_MAIN_MEALS.length, 4);
  assert.ok(FILIPA_MAIN_MEALS.every(recipe => recipe.meal === 'main'));
  assert.ok(FILIPA_MAIN_MEALS.every(recipe => /cozinhad/i.test(recipe.ingredients)));
  assert.deepEqual(
    FILIPA_MAIN_MEALS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 423, protein: 40.7, carbs: 41.2, fat: 9.1, fiber: 5.4 },
      { calories: 467, protein: 44.8, carbs: 41.9, fat: 11.9, fiber: 5.8 },
      { calories: 420, protein: 28, carbs: 39, fat: 16, fiber: 8.9 },
      { calories: 449, protein: 35.3, carbs: 38.8, fat: 17, fiber: 10.8 }
    ]
  );
});

test('existem quatro lanches e três ceias aprovadas', () => {
  assert.equal(FILIPA_SNACKS.length, 4);
  assert.equal(FILIPA_BEDTIMES.length, 3);
  assert.deepEqual(FILIPA_SNACKS.map(recipe => recipe.calories), [216, 218, 214, 226]);
  assert.deepEqual(FILIPA_BEDTIMES.map(recipe => recipe.calories), [142, 139, 137]);
  assert.match(FILIPA_BEDTIMES[0].name, /Fluff de frutos vermelhos na Bimby/i);
  assert.match(FILIPA_BEDTIMES[1].name, /Skyr portátil/i);
});

test('a migração conserva receitas pessoais sem duplicar o catálogo', () => {
  const custom = { id: 'filipa-custom', meal: 'snack', name: 'Receita pessoal', source: 'manual' };
  const merged = mergeFilipaRecipeCatalog([...FILIPA_BREAKFASTS, custom]);
  assert.equal(merged.length, 16);
  assert.equal(new Set(merged.map(recipe => recipe.id)).size, 16);
  assert.equal(merged.at(-1).id, custom.id);
});
