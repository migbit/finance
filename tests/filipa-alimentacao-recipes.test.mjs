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
  mergeFilipaRecipeCatalog,
  resolveFilipaRecipeVariant
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
      { calories: 337, protein: 29.6, carbs: 34.3, fat: 9, fiber: 5.6 },
      { calories: 331, protein: 30.5, carbs: 43.5, fat: 4.7, fiber: 5.9 },
      { calories: 348, protein: 32.1, carbs: 25.3, fat: 13.8, fiber: 2.1 },
      { calories: 329, protein: 25.4, carbs: 38, fat: 9.4, fiber: 6.4 }
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
      { calories: 466, protein: 45.6, carbs: 41.8, fat: 11.4, fiber: 5.8 },
      { calories: 420, protein: 28, carbs: 39, fat: 16, fiber: 8.9 },
      { calories: 449, protein: 35.3, carbs: 38.8, fat: 17, fiber: 10.8 }
    ]
  );
});

test('a mozzarella fresca tem equivalência calórica e altera os macros das duas receitas', () => {
  const crepioca = FILIPA_BREAKFASTS.find(recipe => recipe.id === 'filipa-breakfast-vegetarian-crepioca');
  const gratin = FILIPA_MAIN_MEALS.find(recipe => recipe.id === 'filipa-main-turkey-pasta-gratin');
  const freshCrepioca = resolveFilipaRecipeVariant(crepioca, 'fresh-mozzarella');
  const freshGratin = resolveFilipaRecipeVariant(gratin, 'fresh-mozzarella');

  assert.match(freshCrepioca.ingredients, /≈53 g de mozzarella fresca/);
  assert.doesNotMatch(freshCrepioca.ingredients, /40 g de mozzarella ralada/);
  assert.deepEqual(
    (({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber }))(freshCrepioca),
    { calories: 348, protein: 33.3, carbs: 24.4, fat: 13.7, fiber: 2.1 }
  );

  assert.match(freshGratin.ingredients, /≈40 g de mozzarella fresca/);
  assert.doesNotMatch(freshGratin.ingredients, /30 g de mozzarella ralada/);
  assert.deepEqual(
    (({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber }))(freshGratin),
    { calories: 466, protein: 46.5, carbs: 41.1, fat: 11.4, fiber: 5.8 }
  );
  assert.equal(resolveFilipaRecipeVariant(crepioca, 'unknown'), crepioca);
});

test('existem quatro lanches e três ceias aprovadas', () => {
  assert.equal(FILIPA_SNACKS.length, 4);
  assert.equal(FILIPA_BEDTIMES.length, 3);
  assert.deepEqual(
    FILIPA_SNACKS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 207, protein: 11.1, carbs: 28.4, fat: 5.6, fiber: 3.5 },
      { calories: 218, protein: 24.8, carbs: 26.2, fat: 1.9, fiber: 4.6 },
      { calories: 212, protein: 22.5, carbs: 23.8, fat: 3.5, fiber: 5 },
      { calories: 221, protein: 16.3, carbs: 34.6, fat: 2.9, fiber: 5.8 }
    ]
  );
  assert.deepEqual(
    FILIPA_BEDTIMES.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 142, protein: 16.9, carbs: 14.2, fat: 1.7, fiber: 5.2 },
      { calories: 137, protein: 16.9, carbs: 17.6, fat: 0.2, fiber: 2.3 },
      { calories: 127, protein: 8, carbs: 19.3, fat: 2.8, fiber: 2.9 }
    ]
  );
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
