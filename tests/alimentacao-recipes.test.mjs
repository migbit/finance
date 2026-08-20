import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/alimentacao-recipes.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { DEFAULT_BREAKFASTS, getBreakfastProteinTarget, mergeBreakfastCatalog } = module;

test('existem exatamente três pequenos-almoços completos e repetíveis', () => {
  assert.equal(DEFAULT_BREAKFASTS.length, 3);
  assert.equal(new Set(DEFAULT_BREAKFASTS.map(recipe => recipe.id)).size, 3);
  DEFAULT_BREAKFASTS.forEach(recipe => {
    assert.ok(recipe.calories >= 560 && recipe.calories <= 630, `${recipe.id}: calorias fora do intervalo`);
    assert.ok(recipe.protein >= 30, `${recipe.id}: proteína insuficiente`);
    assert.ok(recipe.fiber >= 10, `${recipe.id}: fibra insuficiente`);
    assert.ok(recipe.instructions.length >= 3);
    assert.ok(recipe.highlights.length >= 4);
  });
});

test('as receitas melhor classificadas não dependem de whey', () => {
  const topRecipes = DEFAULT_BREAKFASTS.filter(recipe => recipe.quality === 'very_high');
  assert.equal(topRecipes.length, 2);
  topRecipes.forEach(recipe => assert.doesNotMatch(recipe.ingredients.toLowerCase(), /whey/));
});

test('as alterações pessoais substituem a receita base sem perder as outras', () => {
  const override = { ...DEFAULT_BREAKFASTS[0], name: 'Versão pessoal' };
  const merged = mergeBreakfastCatalog([override, { id: 'custom', name: 'Extra' }]);
  assert.equal(merged.length, 4);
  assert.equal(merged[0].name, 'Versão pessoal');
  assert.equal(merged.at(-1).id, 'custom');
});

test('calcula o intervalo prático de proteína a partir do peso', () => {
  assert.deepEqual(getBreakfastProteinTarget(74.5), {
    dailyLow: 119,
    dailyHigh: 149,
    perMealLow: 22,
    perMealHigh: 34
  });
});
