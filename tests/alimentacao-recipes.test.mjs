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
  mergeRecipeCatalog,
  updateRecipeDetails,
  resolveRecipeVariant
} = module;

test('existem exatamente quatro pequenos-almoços completos e repetíveis', () => {
  assert.equal(DEFAULT_BREAKFASTS.length, 4);
  assert.equal(new Set(DEFAULT_BREAKFASTS.map(recipe => recipe.id)).size, 4);
  DEFAULT_BREAKFASTS.forEach(recipe => {
    assert.ok(recipe.calories >= 400 && recipe.calories <= 650, `${recipe.id}: calorias fora do intervalo`);
    assert.ok(recipe.protein >= 25, `${recipe.id}: proteína insuficiente`);
    assert.ok(recipe.fiber >= 3, `${recipe.id}: fibra insuficiente`);
    assert.ok(recipe.instructions.length >= 3);
    assert.ok(recipe.highlights.length >= 4);
    assert.doesNotMatch(recipe.ingredients, /\bovos?\b/i, `${recipe.id}: ainda contém ovos`);
  });

  DEFAULT_BREAKFASTS.slice(0, 3).forEach(recipe => {
    assert.ok(recipe.protein >= 29, `${recipe.id}: proteína insuficiente para uma opção base`);
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
      { calories: 526, protein: 36.1, carbs: 68.6, fat: 9.8, fiber: 13.1 },
      { calories: 541, protein: 38.1, carbs: 56, fat: 16.2, fiber: 12.7 },
      { calories: 411, protein: 29.1, carbs: 63.9, fat: 4.4, fiber: 3.5 },
      { calories: 506, protein: 26.3, carbs: 83.8, fat: 6.4, fiber: 5.6 }
    ]
  );
});

test('inclui oito refeições principais e revê as porções da frittata e massa de lentilhas', () => {
  assert.equal(DEFAULT_MAIN_MEALS.length, 8);
  assert.ok(DEFAULT_MAIN_MEALS.every(recipe => recipe.meal === 'main'));
  assert.deepEqual(
    DEFAULT_MAIN_MEALS.slice(0, 4).map(({ calories, protein, carbs, fat, fiber }) => ({ calories, protein, carbs, fat, fiber })),
    [
      { calories: 650, protein: 43, carbs: 56, fat: 25.3, fiber: 16.4 },
      { calories: 629, protein: 41.4, carbs: 69.4, fat: 19.9, fiber: 11.6 },
      { calories: 561, protein: 44.8, carbs: 64.3, fat: 9.8, fiber: 12.5 },
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
      { calories: 269, protein: 29.6, carbs: 31.1, fat: 3.5, fiber: 5.5 }
    ]
  );
  assert.deepEqual(
    DEFAULT_SNACKS.map(recipe => recipe.variants.map(variant => variant.calories)),
    [[], [255, 320], [272, 374], [268, 345], [299]]
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
      calories: 299,
      protein: 29.6,
      carbs: 34.9,
      fat: 5.8,
      fiber: 5.5
    }
  );
});

test('a massa de lentilhas usa mozzarella suave e identifica claramente o peso seco ajustável', () => {
  const recipe = DEFAULT_MAIN_MEALS.find(item => item.id === 'main-red-lentil-pasta');
  assert.match(recipe.ingredients, /20 g de mozzarella ralada/i);
  assert.doesNotMatch(recipe.ingredients, /parmesão/i);
  assert.equal(recipe.calorieAdjustment.baseQuantity, 80);
  assert.match(recipe.calorieAdjustment.label, /massa de lentilhas vermelhas \(peso em seco\)/i);
});

test('a migração acrescenta refeições principais e lanches sem perder receitas pessoais', () => {
  const custom = { id: 'custom-main', meal: 'main', name: 'Receita pessoal', source: 'manual' };
  const merged = mergeRecipeCatalog([...DEFAULT_BREAKFASTS, custom]);
  assert.equal(merged.length, 18);
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
  assert.equal(merged[2].name, staleManualRecipe.name);
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

test('as novas refeições têm ingredientes, preparação, proveniência e totais coerentes', () => {
  for (const recipe of DEFAULT_MAIN_MEALS.slice(4)) {
    assert.ok(recipe.instructions.length >= 3);
    assert.ok(recipe.evidenceNote.length > 30);
    assert.ok(recipe.calories >= 500 && recipe.calories <= 800);
    assert.ok(recipe.protein >= 25 && recipe.protein <= 55);
    const energy = recipe.components.reduce((sum, item) => sum + item.calories, 0);
    assert.equal(recipe.calories, Math.round(energy));
    assert.doesNotMatch(recipe.ingredients, /whey|skyr|pepino|beterraba/i);
  }
});

test('renomear ou editar preparação conserva cálculos e metadados', () => {
  const base = DEFAULT_MAIN_MEALS[0];
  const edited = updateRecipeDetails(base, { name: 'Tofu pessoal', instructions: ['Preparar na air fryer.'] });
  assert.deepEqual(edited.calorieAdjustment, base.calorieAdjustment);
  assert.deepEqual(edited.components, base.components);
  assert.deepEqual(edited.instructions, ['Preparar na air fryer.']);
  assert.equal(mergeRecipeCatalog([edited]).find(item => item.id === base.id).name, 'Tofu pessoal');
});

test('alterar composição conserva preparação e invalida cálculos antigos', () => {
  const base = DEFAULT_MAIN_MEALS[0];
  const edited = updateRecipeDetails(base, { calories: 700 });
  assert.deepEqual(edited.instructions, base.instructions);
  assert.equal(edited.calorieAdjustment, undefined);
  assert.equal(edited.components, undefined);
  assert.deepEqual(edited.variants, []);
  assert.equal(edited.calories, 700);
});


test('variantes explícitas de pequeno-almoço atualizam ingredientes, preparação e nutrientes', () => {
  const rice = DEFAULT_BREAKFASTS.find(r => r.id === 'breakfast-protein-rice-cream');
  assert.doesNotMatch(rice.ingredients, /whey/i);
  assert.doesNotMatch(rice.instructions.join(' '), /whey/i);
  const whey = resolveRecipeVariant(rice, 'with-whey');
  assert.equal(whey.id, rice.id);
  assert.equal(whey.variantId, 'with-whey');
  assert.equal(whey.calories, 445);
  assert.equal(whey.protein, 36.8);
  assert.match(whey.ingredients, /10 g de Evowhey/);
  assert.match(whey.instructions.join(' '), /10 g de whey/);
  const pre = resolveRecipeVariant(DEFAULT_BREAKFASTS.find(r => r.id === 'breakfast-quick-pre-workout'), 'small');
  assert.equal(pre.calories, 352);
  assert.equal(pre.protein, 12.8);
  assert.match(pre.ingredients, /60 g de pão/);
  assert.doesNotMatch(pre.ingredients, /whey/i);
  assert.equal(resolveRecipeVariant(rice, 'deleted').variantId, 'base');
});

test('porções menores de lanche são calculadas a partir das quantidades apresentadas', () => {
  const skyr = resolveRecipeVariant(DEFAULT_SNACKS.find(r => r.id === 'snack-skyr-banana-cereal'), 'small');
  assert.equal(skyr.calories, 268);
  assert.equal(skyr.protein, 19.8);
  assert.match(skyr.ingredients, /150 g de skyr/);
  assert.match(skyr.ingredients, /20 g de cereais/);
  const bowl = resolveRecipeVariant(DEFAULT_SNACKS.find(r => r.id === 'snack-greek-yogurt-fruit-cereal'), 'small-without-whey');
  assert.equal(bowl.calories, 255);
  assert.equal(bowl.protein, 21.8);
  assert.doesNotMatch(bowl.ingredients, /whey/i);
  assert.doesNotMatch(bowl.instructions.join(' '), /whey/i);
  for (const recipe of [...DEFAULT_BREAKFASTS, ...DEFAULT_MAIN_MEALS, ...DEFAULT_SNACKS]) {
    for (const portion of [recipe, ...recipe.variants.filter(v => v.components)]) {
      for (const field of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
        const sum = portion.components.reduce((total, c) => total + c[field], 0);
        const expected = field === 'calories' ? Math.round(sum) : Math.round(sum * 10) / 10;
        assert.equal(portion[field], expected, recipe.id + ': ' + field);
      }
    }
  }
});
