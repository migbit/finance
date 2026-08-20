import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/alimentacao-recipes.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { DEFAULT_BREAKFASTS, getBreakfastProteinTarget, mergeBreakfastCatalog } = module;

test('existem exatamente quatro pequenos-almoços completos e repetíveis', () => {
  assert.equal(DEFAULT_BREAKFASTS.length, 4);
  assert.equal(new Set(DEFAULT_BREAKFASTS.map(recipe => recipe.id)).size, 4);
  DEFAULT_BREAKFASTS.forEach(recipe => {
    assert.ok(recipe.calories >= 500 && recipe.calories <= 650, `${recipe.id}: calorias fora do intervalo`);
    assert.ok(recipe.protein >= 25, `${recipe.id}: proteína insuficiente`);
    assert.ok(recipe.fiber >= 6, `${recipe.id}: fibra insuficiente`);
    assert.ok(recipe.instructions.length >= 3);
    assert.ok(recipe.highlights.length >= 4);
    assert.doesNotMatch(recipe.ingredients, /\bovos?\b/i, `${recipe.id}: ainda contém ovos`);
  });

  DEFAULT_BREAKFASTS.slice(0, 3).forEach(recipe => {
    assert.ok(recipe.protein >= 30, `${recipe.id}: proteína insuficiente para uma opção base`);
    assert.ok(recipe.fiber >= 10, `${recipe.id}: fibra insuficiente para uma opção base`);
  });
});

test('as receitas melhor classificadas não dependem de whey', () => {
  const topRecipes = DEFAULT_BREAKFASTS.filter(recipe => recipe.quality === 'very_high');
  assert.equal(topRecipes.length, 2);
  topRecipes.forEach(recipe => assert.doesNotMatch(recipe.ingredients.toLowerCase(), /whey/));
});

test('calcula os totais acordados das quatro receitas', () => {
  assert.deepEqual(
    DEFAULT_BREAKFASTS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 534, protein: 34.7, carbs: 68.1, fat: 10.7, fiber: 13.7 },
      { calories: 573, protein: 36.9, carbs: 55.2, fat: 18.8, fiber: 15.6 },
      { calories: 610, protein: 41.4, carbs: 48.8, fat: 23.8, fiber: 20.5 },
      { calories: 517, protein: 26.5, carbs: 82.9, fat: 7.3, fiber: 6.8 }
    ]
  );
});

test('as alterações pessoais substituem a receita base sem perder as outras', () => {
  const override = { ...DEFAULT_BREAKFASTS[0], name: 'Versão pessoal', source: 'manual' };
  const merged = mergeBreakfastCatalog([override, { id: 'custom', name: 'Extra' }]);
  assert.equal(merged.length, 5);
  assert.equal(merged[0].name, 'Versão pessoal');
  assert.equal(merged.at(-1).id, 'custom');
});

test('atualiza receitas de catálogo antigas e remove a antiga opção com ovos', () => {
  const staleCatalogRecipe = { ...DEFAULT_BREAKFASTS[1], name: 'Versão antiga', source: 'curated' };
  const staleManualRecipe = { ...DEFAULT_BREAKFASTS[2], name: 'Edição manual antiga', source: 'manual', catalogVersion: 1 };
  const retiredEggRecipe = { id: 'breakfast-eggs-rye', name: 'Ovos antigos', source: 'curated' };
  const merged = mergeBreakfastCatalog([staleCatalogRecipe, staleManualRecipe, retiredEggRecipe]);
  assert.equal(merged.length, 4);
  assert.equal(merged[1].name, DEFAULT_BREAKFASTS[1].name);
  assert.equal(merged[2].name, DEFAULT_BREAKFASTS[2].name);
  assert.ok(merged.every(recipe => recipe.id !== retiredEggRecipe.id));
});

test('calcula o intervalo prático de proteína a partir do peso', () => {
  assert.deepEqual(getBreakfastProteinTarget(74.5), {
    dailyLow: 119,
    dailyHigh: 149,
    perMealLow: 22,
    perMealHigh: 34
  });
});
