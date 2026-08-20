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
    catalogVersion: 3,
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
  goalContext: 'Perder 2–3 kg preservando ou aumentando massa muscular.',
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
    id: 'breakfast-oat-banana-pancakes',
    name: 'Panquecas de aveia, banana e skyr',
    shortName: 'Panquecas de aveia e skyr',
    description: 'Uma opção confortável para dias de ginásio ou manhãs mais ativas, com proteína, hidratos, fibra, cálcio e ómega-3 ALA.',
    quality: 'high',
    qualityLabel: 'Qualidade alta',
    rank: 2,
    prepTime: '15 min',
    batchFriendly: true,
    components: [
      { label: '50 g de flocos de aveia integrais', calories: 187, protein: 5.3, carbs: 30.5, fat: 3.4, fiber: 5 },
      { label: '150 g de skyr natural sem açúcar', calories: 88.5, protein: 15, carbs: 5.4, fat: 0.3, fiber: 0 },
      { label: '100 ml de bebida de soja sem açúcar fortificada', calories: 33, protein: 3.3, carbs: 0, fat: 1.8, fiber: 0.6 },
      { label: '10 g de whey', calories: 38.3, protein: 7.8, carbs: 0.6, fat: 0.5, fiber: 0 },
      { label: '10 g de linhaça moída', calories: 53, protein: 1.8, carbs: 0.3, fat: 4.2, fiber: 2.7 },
      { label: '80 a 100 g de banana madura', calories: 80, protein: 1, carbs: 20.5, fat: 0.3, fiber: 2.3 },
      { label: '1 c. de chá de fermento', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { label: 'Canela a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { label: '100 a 150 g de fruta fresca para acompanhar', calories: 54.2, protein: 0.5, carbs: 10.8, fat: 0.2, fiber: 3.1 }
    ],
    instructions: [
      'Triturar a aveia até obter uma farinha.',
      'Juntar o skyr, a bebida de soja, a whey, a linhaça, a banana, o fermento e a canela.',
      'Triturar ou misturar bem até obter uma massa homogénea.',
      'Fazer pequenas panquecas numa frigideira antiaderente, sem necessidade de óleo.',
      'Servir com a fruta fresca.'
    ],
    highlights: ['≈37 g de proteína', '≈13 g de fibra', 'Cálcio/B12/D se a soja for fortificada', 'Ómega-3 ALA', 'Boa para dias ativos'],
    cautions: ['Pode preparar 3 a 4 doses, conservar cerca de 3 dias no frigorífico ou congelar as panquecas separadas.', 'Aquecer na torradeira, air fryer ou micro-ondas.'],
    evidenceNote: 'O total apresentado usa 90 g de banana e 125 g de fruta sazonal. Whey ESN e bebida Alpro calculadas pelos rótulos; skyr, aveia, linhaça e fruta usam valores médios.'
  }),
  buildRecipe({
    id: 'breakfast-overnight-oats',
    name: 'Overnight oats com skyr, chia e nozes',
    shortName: 'Aveia preparada de véspera',
    description: 'O melhor pequeno-almoço base: completo, muito simples, saciante e com proteína, fibra, beta-glucanos, ómega-3 ALA, fruta e cálcio.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 1,
    prepTime: '5 min + repouso',
    batchFriendly: true,
    components: [
      { label: '50 g de flocos de aveia integrais', calories: 187, protein: 5.7, carbs: 30.5, fat: 3.4, fiber: 5 },
      { label: '200 g de skyr natural sem açúcar', calories: 118, protein: 20, carbs: 7.2, fat: 0.4, fiber: 0 },
      { label: '200 ml de bebida de soja sem açúcar fortificada', calories: 66, protein: 6.6, carbs: 0, fat: 3.6, fiber: 1.2 },
      { label: '15 g de sementes de chia', calories: 73, protein: 2.5, carbs: 1.2, fat: 4.7, fiber: 5.2 },
      { label: '150 g de fruta sazonal', calories: 64, protein: 0.6, carbs: 15.6, fat: 0.2, fiber: 3.5 },
      { label: '10 g de nozes', calories: 65, protein: 1.5, carbs: 0.7, fat: 6.5, fiber: 0.7 },
      { label: 'Canela a gosto (opcional)', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Misturar a aveia, o skyr, a bebida de soja e a chia num frasco ou recipiente.',
      'Deixar no frigorífico durante a noite.',
      'De manhã, juntar a fruta e as nozes.',
      'Se estiver demasiado espesso, adicionar um pouco de água ou bebida de soja.'
    ],
    highlights: ['≈40 g de proteína', '≈15 g de fibra', 'Cálcio elevado', 'Sem whey', 'Melhor opção base'],
    cautions: ['Confirmar o rótulo do skyr; as marcas variam.', 'Usar chia inteira ou moída e beber líquidos normalmente ao longo do dia.'],
    evidenceNote: 'Bebida de soja calculada pelo rótulo Alpro; skyr, aveia, chia, nozes e fruta usam valores médios e devem ser afinados pela marca.'
  }),
  buildRecipe({
    id: 'breakfast-tofu-scramble',
    name: 'Tofu mexido com pão integral e legumes',
    shortName: 'Tofu mexido e centeio',
    description: 'A opção salgada de máxima saciedade, com muita soja e vegetais; a vitamina C da laranja acompanha o ferro dos alimentos vegetais.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 3,
    prepTime: '15 min',
    batchFriendly: true,
    components: [
      { label: '200 g de tofu natural firme, idealmente coagulado com cálcio', calories: 286, protein: 32, carbs: 0, fat: 17, fiber: 3.4 },
      { label: '80 g de pão integral de centeio Pema ou equivalente', calories: 160, protein: 4, carbs: 28.8, fat: 1, fiber: 8.8 },
      { label: '200 g de espinafres, tomate e cogumelos', calories: 52, protein: 4, carbs: 5, fat: 0.6, fiber: 4.9 },
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: '1 laranja média (≈160 g)', calories: 67, protein: 1.4, carbs: 15, fat: 0.2, fiber: 3.4 },
      { label: 'Alho, pimenta, paprika, curcuma ou outras especiarias a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { label: 'Sal moderado', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Esmagar grosseiramente o tofu com um garfo.',
      'Aquecer o azeite e saltear primeiro os cogumelos e o tomate.',
      'Juntar o tofu e temperar.',
      'Adicionar os espinafres no final e cozinhar apenas até perderem volume.',
      'Servir com o pão integral torrado.',
      'Comer a laranja como sobremesa.'
    ],
    highlights: ['≈41 g de proteína', '≈21 g de fibra', 'Ferro vegetal + vitamina C', 'Muitos hortícolas', 'Sem whey'],
    cautions: ['O valor do tofu varia bastante entre marcas; confirmar o rótulo antes de fechar o cálculo.', 'Pode preparar a mistura de tofu e legumes de véspera e aquecer de manhã.'],
    evidenceNote: 'Pão calculado pelo rótulo Pema e tofu pelo rótulo Joya Natural; confirmar no tofu escolhido se o coagulante contém cálcio. Hortícolas e laranja usam valores médios.'
  }),
  buildRecipe({
    id: 'breakfast-quick-pre-workout',
    name: 'Pré-exercício rápido, 30–60 min antes',
    shortName: 'Pré-exercício rápido',
    description: 'Para manhãs em que começas bicicleta, trekking, RPM ou outro exercício 30–60 minutos depois de comer, privilegiando hidratos fáceis de utilizar.',
    quality: 'purpose',
    qualityLabel: 'Pré-exercício',
    rank: 4,
    prepTime: '5 min',
    batchFriendly: false,
    components: [
      { label: '80 g de pão branco ou de mistura', calories: 225, protein: 6.8, carbs: 39.5, fat: 2.6, fiber: 2.4 },
      { label: '25 a 30 g de compota ou mel', calories: 61.6, protein: 0.1, carbs: 15.1, fat: 0, fiber: 0.1 },
      { label: '1 banana média (≈120 g)', calories: 107, protein: 1.3, carbs: 27.4, fat: 0.4, fiber: 3.1 },
      { label: '200 ml de bebida de soja sem açúcar fortificada', calories: 66, protein: 6.6, carbs: 0, fat: 3.6, fiber: 1.2 },
      { label: '10 a 15 g de whey', calories: 57.5, protein: 11.7, carbs: 0.9, fat: 0.7, fiber: 0 },
      { label: 'Café, se fizer parte da rotina', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { label: '300 a 500 ml de água', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Tostar ligeiramente o pão.',
      'Barrar com a compota ou o mel.',
      'Comer a banana à parte.',
      'Misturar a whey na bebida de soja.',
      'Acompanhar com água e o café habitual, se aplicável.'
    ],
    highlights: ['≈83 g de hidratos', '≈27 g de proteína', 'Menos gordura e fibra', 'Preparação em 5 min', 'Uso pré-exercício'],
    cautions: ['O total apresentado usa 27,5 g de compota e 15 g de whey.', 'Com mel, acrescentar aproximadamente 22 kcal e 7–8 g de hidratos.', 'É uma opção específica para treinar pouco depois; não substitui o pequeno-almoço base nos restantes dias.'],
    evidenceNote: 'Bebida de soja e whey calculadas pelos rótulos já registados; pão branco/mistura, compota e banana usam valores médios. Confirmar o pão e a compota comprados.'
  })
]);

const RETIRED_BREAKFAST_IDS = new Set(['breakfast-eggs-rye']);

export function mergeBreakfastCatalog(storedRecipes = []) {
  const stored = Array.isArray(storedRecipes)
    ? storedRecipes.filter(recipe => !RETIRED_BREAKFAST_IDS.has(recipe?.id))
    : [];
  const byId = new Map(stored.map(recipe => [recipe.id, recipe]));
  const defaults = DEFAULT_BREAKFASTS.map(recipe => {
    const saved = byId.get(recipe.id);
    return saved?.source === 'manual' && saved.catalogVersion === recipe.catalogVersion
      ? saved
      : recipe;
  });
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
