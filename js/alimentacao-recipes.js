function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function totalNutrition(components) {
  return components.reduce((total, component) => ({
    calories: total.calories + component.calories,
    protein: total.protein + component.protein,
    carbs: total.carbs + component.carbs,
    fat: total.fat + component.fat,
    fiber: total.fiber + component.fiber
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

function buildRecipe(recipe) {
  const totals = totalNutrition(recipe.components);
  return Object.freeze({
    ...recipe,
    ingredients: recipe.components.map(component => component.label).join('\n'),
    calories: Math.round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    fiber: round(totals.fiber),
    source: 'curated',
    meal: 'breakfast'
  });
}

export const MIGUEL_PROFILE_DEFAULTS = Object.freeze({
  version: 1,
  diet: 'lacto_ovo_vegetarian',
  calculationMode: 'manual',
  manualCalories: 2400,
  age: 41,
  sexAtBirth: 'male',
  heightCm: 177,
  weightKg: 74.5,
  activityLevel: 'high',
  strengthSessions: 3,
  dailySteps: 12000,
  goal: 'lose_gentle',
  goalContext: 'Perder 2–3 kg preservando ou aumentando massa muscular. Inclui 1 sessão longa semanal de bicicleta ou trekking.',
  mealPattern: '3+1',
  breakfastAppetite: 'medium',
  breakfastTaste: 'both',
  prepTime: '20',
  trainingTiming: 'within_2h',
  repeatTolerance: 'daily',
  batchPrep: 'both',
  allergies: ['none'],
  supplements: ['omega3', 'b12', 'creatine'],
  equipment: ['stove', 'microwave', 'oven', 'airfryer', 'blender', 'toaster'],
  healthNotes: 'Sem alergias, intolerâncias ou limitações indicadas.',
  favoriteFoods: 'Aceita skyr/quark, aveia, tofu, leguminosas, chia/linhaça, frutos secos, bebida de soja e cereais integrais.',
  dislikedFoods: 'Queijos de sabor forte, pepino e beterraba.',
  breadDetails: 'Sugestão-base: Pema integral de centeio (200 kcal, 5 g proteína e 11 g fibra/100 g) ou equivalente com farinha integral como primeiro ingrediente.',
  wheyDetails: 'ESN Designer Whey Apple Strudel: 115 kcal e 23,4 g proteína/30 g. Consumo habitual referido: 2 × 30 g/dia.',
  almondDrinkDetails: 'Substituir preferencialmente por bebida de soja sem açúcar fortificada; confirmar sempre o rótulo.',
  fruitDetails: 'Fruta sazonal, sobretudo pera, maçã, melancia, melão, laranja e nectarina.',
  fortifiedDrink: 'calcium_b12_d',
  updatedAt: '2026-08-20T00:00:00.000Z'
});

export const DEFAULT_BREAKFASTS = Object.freeze([
  buildRecipe({
    id: 'breakfast-eggs-rye',
    name: 'Ovos, centeio e batido melhorado',
    shortName: 'O habitual, melhorado',
    description: 'Mantém a rotina conhecida, mas troca a bebida de amêndoa por soja fortificada e acrescenta linhaça para melhorar cálcio, fibra e gorduras insaturadas.',
    quality: 'high',
    qualityLabel: 'Qualidade alta',
    rank: 3,
    prepTime: '10 min',
    batchFriendly: false,
    components: [
      { label: '2 ovos', calories: 144, protein: 12.6, carbs: 0.8, fat: 9.6, fiber: 0 },
      { label: '100 ml de claras', calories: 46, protein: 10.5, carbs: 0.7, fat: 0.2, fiber: 0 },
      { label: '65 g de pão integral de centeio Pema ou equivalente', calories: 130, protein: 3.3, carbs: 23.4, fat: 0.8, fiber: 7.2 },
      { label: '20 g de ESN Designer Whey Apple Strudel', calories: 77, protein: 15.6, carbs: 1.2, fat: 1, fiber: 0 },
      { label: '200 ml de bebida de soja sem açúcar fortificada', calories: 66, protein: 6.6, carbs: 0, fat: 3.6, fiber: 1.2 },
      { label: '150 g de fruta sazonal', calories: 80, protein: 0.6, carbs: 19, fat: 0.2, fiber: 3 },
      { label: '10 g de linhaça moída', calories: 53, protein: 1.8, carbs: 0.3, fat: 4.2, fiber: 2.7 }
    ],
    instructions: [
      'Preparar os ovos e as claras sem manteiga; usar frigideira antiaderente.',
      'Tostar o pão. Misturar a whey na bebida de soja e juntar a linhaça moída.',
      'Escolher uma peça/porção de fruta próxima de 150 g.'
    ],
    highlights: ['Proteína elevada', '≈13 g de fibra', 'Cálcio/B12/D se a soja for fortificada', 'Ómega-3 ALA'],
    cautions: ['A fruta e marcas podem alterar o total em cerca de 30–60 kcal.', 'É a opção com maior concentração de proteína; contar a restante whey do dia.'],
    evidenceNote: 'Whey ESN, bebida Alpro e pão Pema calculados pelos respetivos rótulos; restantes valores são estimativas alimentares médias.'
  }),
  buildRecipe({
    id: 'breakfast-overnight-oats',
    name: 'Overnight oats de skyr, chia e fruta',
    shortName: 'Aveia preparada de véspera',
    description: 'A opção mais prática para preparar antecipadamente, com proteína sem whey, muita fibra, cálcio e uma boa combinação de gorduras insaturadas.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 1,
    prepTime: '5 min + repouso',
    batchFriendly: true,
    components: [
      { label: '50 g de flocos de aveia integrais', calories: 190, protein: 6.5, carbs: 30.5, fat: 3.5, fiber: 5 },
      { label: '200 g de skyr natural sem açúcar', calories: 126, protein: 22, carbs: 8, fat: 0.4, fiber: 0 },
      { label: '200 ml de bebida de soja sem açúcar fortificada', calories: 66, protein: 6.6, carbs: 0, fat: 3.6, fiber: 1.2 },
      { label: '15 g de sementes de chia', calories: 73, protein: 2.5, carbs: 1.2, fat: 4.7, fiber: 5.2 },
      { label: '150 g de fruta sazonal', calories: 80, protein: 0.6, carbs: 19, fat: 0.2, fiber: 3 },
      { label: '10 g de nozes', calories: 65, protein: 1.5, carbs: 0.7, fat: 6.5, fiber: 0.7 }
    ],
    instructions: [
      'Misturar aveia, skyr, bebida de soja e chia num frasco.',
      'Deixar no frigorífico durante a noite.',
      'Juntar a fruta e as nozes ao servir. Para uma textura menos espessa, acrescentar água.'
    ],
    highlights: ['≈40 g de proteína', '≈15 g de fibra', 'Cálcio elevado', 'Sem whey', 'Preparação antecipada'],
    cautions: ['Confirmar o rótulo do skyr; as marcas variam.', 'Usar chia inteira ou moída e beber líquidos normalmente ao longo do dia.'],
    evidenceNote: 'Bebida de soja calculada pelo rótulo Alpro; skyr, aveia, chia, nozes e fruta usam valores médios e devem ser afinados pela marca.'
  }),
  buildRecipe({
    id: 'breakfast-tofu-scramble',
    name: 'Tofu mexido, ovo, centeio e laranja',
    shortName: 'Opção salgada vegetal',
    description: 'A opção com maior variedade de alimentos: combina soja e ovo, muitos hortícolas, pão integral e vitamina C para acompanhar o ferro vegetal.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 2,
    prepTime: '15 min',
    batchFriendly: true,
    components: [
      { label: '150 g de tofu natural firme', calories: 180, protein: 18, carbs: 3, fat: 11, fiber: 1.5 },
      { label: '1 ovo', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 },
      { label: '80 g de pão integral de centeio Pema ou equivalente', calories: 160, protein: 4, carbs: 28.8, fat: 1, fiber: 8.8 },
      { label: '200 g de espinafres, tomate e cogumelos', calories: 60, protein: 4, carbs: 8, fat: 1, fiber: 4 },
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: '1 laranja média (≈160 g)', calories: 75, protein: 1.3, carbs: 17.5, fat: 0.2, fiber: 3.4 }
    ],
    instructions: [
      'Esmagar o tofu. Saltear cogumelos e tomate no azeite e juntar o tofu, os espinafres e o ovo.',
      'Temperar com pimenta, alho, paprika ou curcuma; evitar exagerar no sal.',
      'Servir com o pão torrado e comer a laranja na mesma refeição.'
    ],
    highlights: ['≈34 g de proteína', '≈18 g de fibra', 'Ferro vegetal + vitamina C', 'Muitos hortícolas', 'Sem whey'],
    cautions: ['O valor do tofu varia bastante entre marcas; confirmar o rótulo antes de fechar o cálculo.', 'Pode preparar a mistura de tofu e legumes de véspera e aquecer de manhã.'],
    evidenceNote: 'Pão calculado pelo rótulo Pema; tofu e hortícolas usam valores médios conservadores.'
  })
]);

export function mergeBreakfastCatalog(storedRecipes = []) {
  const stored = Array.isArray(storedRecipes) ? storedRecipes : [];
  const byId = new Map(stored.map(recipe => [recipe.id, recipe]));
  const defaults = DEFAULT_BREAKFASTS.map(recipe => byId.get(recipe.id) || recipe);
  const custom = stored.filter(recipe => !DEFAULT_BREAKFASTS.some(item => item.id === recipe.id));
  return [...defaults, ...custom];
}

export function getBreakfastProteinTarget(weightKg) {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return {
    dailyLow: Math.round(weight * 1.6),
    dailyHigh: Math.round(weight * 2),
    perMealLow: Math.round(weight * 0.3),
    perMealHigh: Math.round(weight * 0.45)
  };
}
