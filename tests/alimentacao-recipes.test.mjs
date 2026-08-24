import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/alimentacao-recipes.js', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {
  DEFAULT_BREAKFASTS,
  DEFAULT_MAIN_MEALS,
  DEFAULT_SNACKS,
  getBreakfastProteinTarget,
  mergeBreakfastCatalog,
  mergeRecipeCatalog
} = module;

test('existem exatamente quatro pequenos-almoços completos e repetíveis', () => {
  assert.equal(DEFAULT_BREAKFASTS.length, 4);
  assert.equal(new Set(DEFAULT_BREAKFASTS.map(recipe => recipe.id)).size, 4);
  DEFAULT_BREAKFASTS.forEach(recipe => {
    assert.ok(recipe.calories >= 440 && recipe.calories <= 650, `${recipe.id}: calorias fora do intervalo`);
    assert.ok(recipe.protein >= 25, `${recipe.id}: proteína insuficiente`);
    assert.ok(recipe.fiber >= 3, `${recipe.id}: fibra insuficiente`);
    assert.ok(recipe.instructions.length >= 3);
    assert.ok(recipe.highlights.length >= 4);
    assert.doesNotMatch(recipe.ingredients, /\bovos?\b/i, `${recipe.id}: ainda contém ovos`);
  });

  DEFAULT_BREAKFASTS.slice(0, 3).forEach(recipe => {
    assert.ok(recipe.protein >= 30, `${recipe.id}: proteína insuficiente para uma opção base`);
  });

  DEFAULT_BREAKFASTS.slice(0, 2).forEach(recipe => {
    assert.ok(recipe.fiber >= 10, `${recipe.id}: fibra insuficiente para uma opção base`);
  });
});

test('as receitas melhor classificadas não dependem de whey', () => {
  const topRecipes = DEFAULT_BREAKFASTS.filter(recipe => recipe.quality === 'very_high');
  assert.equal(topRecipes.length, 1);
  topRecipes.forEach(recipe => assert.doesNotMatch(recipe.ingredients.toLowerCase(), /whey/));
});

test('calcula os totais acordados das quatro receitas', () => {
  assert.deepEqual(
    DEFAULT_BREAKFASTS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 530, protein: 36.2, carbs: 68.8, fat: 10.1, fiber: 13.1 },
      { calories: 541, protein: 38.1, carbs: 56, fat: 16.2, fiber: 12.7 },
      { calories: 449, protein: 36.9, carbs: 64.5, fat: 4.9, fiber: 3.5 },
      { calories: 511, protein: 26.5, carbs: 83.9, fat: 6.7, fiber: 5.6 }
    ]
  );
});

test('inclui as quatro refeições principais com os totais definidos', () => {
  assert.equal(DEFAULT_MAIN_MEALS.length, 4);
  assert.ok(DEFAULT_MAIN_MEALS.every(recipe => recipe.meal === 'main'));
  assert.deepEqual(
    DEFAULT_MAIN_MEALS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 650, protein: 43, carbs: 56, fat: 25.3, fiber: 16.4 },
      { calories: 653, protein: 46.9, carbs: 69.7, fat: 20, fiber: 11.6 },
      { calories: 619, protein: 52.5, carbs: 71.4, fat: 9.7, fiber: 13.1 },
      { calories: 609, protein: 35, carbs: 84.7, fat: 13.3, fiber: 23.8 }
    ]
  );
});

test('inclui cinco lanches com doses-base e variantes calculáveis', () => {
  assert.equal(DEFAULT_SNACKS.length, 5);
  assert.ok(DEFAULT_SNACKS.every(recipe => recipe.meal === 'snack'));
  assert.deepEqual(
    DEFAULT_SNACKS.map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 104, protein: 23, carbs: 1.5, fat: 0.7, fiber: 0 },
      { calories: 328, protein: 23.8, carbs: 45.5, fat: 6, fiber: 6.5 },
      { calories: 310, protein: 31, carbs: 37.6, fat: 4.2, fiber: 4.5 },
      { calories: 315, protein: 25.8, carbs: 52.8, fat: 1.6, fiber: 5.6 },
      { calories: 277, protein: 29.9, carbs: 31.1, fat: 4, fiber: 5.5 }
    ]
  );
  assert.deepEqual(
    DEFAULT_SNACKS.map(recipe => recipe.variants.map(variant => variant.calories)),
    [[], [320], [374], [345], [307]]
  );
  assert.doesNotMatch(DEFAULT_SNACKS[0].ingredients, /banana/i);
  assert.equal(DEFAULT_SNACKS[0].variants.length, 0);
  assert.match(DEFAULT_SNACKS[4].name, /Bolo de caneca proteico/i);
  assert.deepEqual(
    DEFAULT_SNACKS[4].variants[0],
    {
      id: 'with-dark-chocolate',
      label: 'Com chocolate ✓',
      name: 'Bolo de caneca proteico com chocolate preto',
      description: 'Acrescenta 5 g de chocolate preto picado por cima.',
      calories: 307,
      protein: 29.9,
      carbs: 34.9,
      fat: 6.3,
      fiber: 5.5
    }
  );
});

test('a massa de lentilhas usa mozzarella suave e identifica claramente o peso seco ajustável', () => {
  const recipe = DEFAULT_MAIN_MEALS.find(item => item.id === 'main-red-lentil-pasta');
  assert.match(recipe.ingredients, /18 g de mozzarella ralada/i);
  assert.doesNotMatch(recipe.ingredients, /parmesão/i);
  assert.equal(recipe.calorieAdjustment.baseQuantity, 90);
  assert.match(recipe.calorieAdjustment.label, /massa de lentilhas vermelhas \(peso em seco\)/i);
});

test('a migração acrescenta refeições principais e lanches sem perder receitas pessoais', () => {
  const custom = { id: 'custom-main', meal: 'main', name: 'Receita pessoal', source: 'manual' };
  const merged = mergeRecipeCatalog([...DEFAULT_BREAKFASTS, custom]);
  assert.equal(merged.length, 14);
  assert.ok(DEFAULT_MAIN_MEALS.every(recipe => merged.some(item => item.id === recipe.id)));
  assert.ok(DEFAULT_SNACKS.every(recipe => merged.some(item => item.id === recipe.id)));
  assert.equal(merged.at(-1).id, custom.id);
});

test('as alterações pessoais substituem a receita base sem perder as outras', () => {
  const override = { ...DEFAULT_BREAKFASTS[0], name: 'Versão pessoal', source: 'manual' };
  const merged = mergeBreakfastCatalog([override, { id: 'custom', name: 'Extra' }]);
  assert.equal(merged.length, 5);
  assert.equal(merged[0].name, 'Versão pessoal');
  assert.equal(merged.at(-1).id, 'custom');
});

test('atualiza receitas de catálogo antigas e remove as opções substituídas', () => {
  const staleCatalogRecipe = { ...DEFAULT_BREAKFASTS[1], name: 'Versão antiga', source: 'curated' };
  const staleManualRecipe = { ...DEFAULT_BREAKFASTS[2], name: 'Edição manual antiga', source: 'manual', catalogVersion: 1 };
  const retiredEggRecipe = { id: 'breakfast-eggs-rye', name: 'Ovos antigos', source: 'curated' };
  const retiredTofuRecipe = { id: 'breakfast-tofu-scramble', name: 'Tofu antigo', source: 'curated' };
  const merged = mergeBreakfastCatalog([staleCatalogRecipe, staleManualRecipe, retiredEggRecipe, retiredTofuRecipe]);
  assert.equal(merged.length, 4);
  assert.equal(merged[1].name, DEFAULT_BREAKFASTS[1].name);
  assert.equal(merged[2].name, DEFAULT_BREAKFASTS[2].name);
  assert.ok(merged.every(recipe => recipe.id !== retiredEggRecipe.id));
  assert.ok(merged.every(recipe => recipe.id !== retiredTofuRecipe.id));
});

test('calcula o intervalo prático de proteína a partir do peso', () => {
  assert.deepEqual(getBreakfastProteinTarget(74.5), {
    dailyLow: 119,
    dailyHigh: 149,
    perMealLow: 22,
    perMealHigh: 34
  });
});
