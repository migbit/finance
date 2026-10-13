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

// Valores por 100 g (ou 100 ml) dos rótulos dos produtos habitualmente usados.
const PRODUCT_NUTRITION = Object.freeze({
  skyr: Object.freeze({ calories: 58, protein: 11, carbs: 3.7, fat: 0, fiber: 0 }),
  greekYogurt: Object.freeze({ calories: 55, protein: 5.3, carbs: 3.9, fat: 2, fiber: 0 }),
  eggWhites: Object.freeze({ calories: 47, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0 }),
  riceCream: Object.freeze({ calories: 369, protein: 7.5, carbs: 83, fat: 0.8, fiber: 0 }),
  soyDrink: Object.freeze({ calories: 30, protein: 3.3, carbs: 0.5, fat: 1.5, fiber: 0 }),
  gratedMozzarella: Object.freeze({ calories: 237, protein: 26, carbs: 2.9, fat: 13.3, fiber: 0 })
});

function productPortion(label, quantity, nutrition) {
  const factor = quantity / 100;
  return {
    label,
    calories: nutrition.calories * factor,
    protein: nutrition.protein * factor,
    carbs: nutrition.carbs * factor,
    fat: nutrition.fat * factor,
    fiber: nutrition.fiber * factor
  };
}

// One reference for powdered whey throughout Miguel's catalogue (per 30 g).
function wheyPortion(label, grams) {
  return productPortion(label, grams, { calories: 104 / 0.3, protein: 23 / 0.3, carbs: 5, fat: 0.7 / 0.3, fiber: 0 });
}

function buildRecipe(recipe) {
  const totals = totalNutrition(recipe.components);
  return Object.freeze({
    ...recipe,
    catalogVersion: 7,
    ingredients: recipe.components.map(component => component.label).join('\n'),
    calories: Math.round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    fiber: round(totals.fiber),
    source: 'curated',
    meal: recipe.meal || 'breakfast'
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
  wheyDetails: 'Referência: Evowhey, 104 kcal e 23 g proteína/30 g. Contabilizar apenas as doses escolhidas; confirmar o rótulo ao mudar de produto.',
  almondDrinkDetails: 'Substituir preferencialmente por bebida de soja sem açúcar fortificada; confirmar sempre o rótulo.',
  fruitDetails: 'Fruta sazonal, sobretudo pera, maçã, melancia, melão, laranja e nectarina.',
  fortifiedDrink: 'calcium_b12_d',
  selectedBreakfastId: '',
  breakfastSkipped: false,
  selectedLunchId: '',
  lunchExternal: false,
  selectedDinnerId: '',
  snacks: [],
  consumedMeals: {},
  mealCalories: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 },
  planDate: '',
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
      productPortion('150 g de skyr natural sem açúcar', 150, PRODUCT_NUTRITION.skyr),
      productPortion('100 ml de bebida de soja sem açúcar fortificada', 100, PRODUCT_NUTRITION.soyDrink),
      wheyPortion('10 g de Evowhey', 10),
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
    highlights: ['≈36 g de proteína', '≈13 g de fibra', 'Cálcio/B12/D se a soja for fortificada', 'Ómega-3 ALA', 'Boa para dias ativos'],
    cautions: ['Pode preparar 3 a 4 doses, conservar cerca de 3 dias no frigorífico ou congelar as panquecas separadas.', 'Aquecer na torradeira, air fryer ou micro-ondas.'],
    evidenceNote: 'O total apresentado usa 90 g de banana e 125 g de fruta sazonal. Skyr, bebida de soja e whey usam os rótulos registados; aveia, linhaça e fruta usam valores médios.'
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
      productPortion('200 g de skyr natural sem açúcar', 200, PRODUCT_NUTRITION.skyr),
      productPortion('200 ml de bebida de soja sem açúcar fortificada', 200, PRODUCT_NUTRITION.soyDrink),
      { label: '10 g de sementes de chia', calories: 49, protein: 1.7, carbs: 0.8, fat: 3.1, fiber: 3.5 },
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
    highlights: ['≈38 g de proteína', '≈13 g de fibra', 'Cálcio elevado', 'Sem whey', 'Melhor opção base'],
    cautions: ['Usar chia inteira ou moída e beber líquidos normalmente ao longo do dia.'],
    evidenceNote: 'Skyr e bebida de soja usam os rótulos registados; aveia, chia, nozes e fruta usam valores médios.'
  }),
  buildRecipe({
    id: 'breakfast-protein-rice-cream',
    name: 'Creme de arroz proteico com skyr e fruta',
    shortName: 'Creme de arroz proteico',
    description: 'Uma refeição doce e quente para dias de treino, com digestão relativamente fácil e arroz para variar as fontes de cereais.',
    quality: 'high',
    qualityLabel: 'Qualidade alta',
    rank: 3,
    prepTime: '10 min',
    batchFriendly: false,
    components: [
      productPortion('50 g de Rice Cream sem sabor', 50, PRODUCT_NUTRITION.riceCream),
      productPortion('250 ml de bebida de soja sem açúcar fortificada', 250, PRODUCT_NUTRITION.soyDrink),
      productPortion('150 g de skyr natural', 150, PRODUCT_NUTRITION.skyr),
      wheyPortion('10 g de Evowhey, num sabor que combine', 10),
      { label: '150 g de fruta, por exemplo banana, frutos vermelhos, maçã ou pêssego', calories: 64, protein: 0.6, carbs: 15.6, fat: 0.2, fiber: 3.5 },
      { label: 'Canela a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { label: '5 a 10 g de amêndoas ou nozes picadas (opcional)', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Aquecer a bebida de soja.',
      'Juntar gradualmente o creme de arroz, mexendo até engrossar.',
      'Retirar do lume e deixar arrefecer ligeiramente.',
      'Misturar a whey.',
      'Servir com o skyr, a fruta e a canela.',
      'Para mais textura e saciedade, juntar 5 a 10 g de frutos secos.'
    ],
    highlights: ['≈37 g de proteína', 'Digestão relativamente fácil', 'Cereal diferente da aveia', 'Doce e quente', 'Boa para dias de treino'],
    cautions: ['O total apresentado não inclui os frutos secos opcionais.', 'Adicionar 5 g acrescenta cerca de 30 kcal; 10 g acrescenta aproximadamente 55–60 kcal.', 'Deixar arrefecer ligeiramente antes de juntar a whey ajuda a misturá-la sem formar grumos.'],
    evidenceNote: 'Rice Cream, bebida de soja, skyr e whey usam os rótulos registados; a fruta usa valores médios.'
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
      productPortion('200 ml de bebida de soja sem açúcar fortificada', 200, PRODUCT_NUTRITION.soyDrink),
      wheyPortion('15 g de Evowhey', 15),
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
    highlights: ['≈84 g de hidratos', '≈26 g de proteína', 'Menos gordura e fibra', 'Preparação em 5 min', 'Uso pré-exercício'],
    cautions: ['O total apresentado usa 27,5 g de compota e 15 g de whey.', 'Com mel, acrescentar aproximadamente 22 kcal e 7–8 g de hidratos.', 'É uma opção específica para treinar pouco depois; não substitui o pequeno-almoço base nos restantes dias.'],
    evidenceNote: 'Bebida de soja e whey usam os rótulos registados; pão branco/mistura, compota e banana usam valores médios. Confirmar o pão e a compota comprados.'
  })
]);

export const DEFAULT_MAIN_MEALS = Object.freeze([
  buildRecipe({
    id: 'main-tofu-rice-edamame',
    meal: 'main',
    name: 'Tofu crocante, arroz integral e edamame',
    shortName: 'Tofu, arroz e edamame',
    description: 'Uma refeição muito completa e rica em proteína, especialmente adequada depois de treino, RPM ou atividade outdoor.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 1,
    pairsAfter: ['breakfast-quick-pre-workout'],
    prepTime: '25 min',
    batchFriendly: true,
    components: [
      { label: '150 g de tofu firme', calories: 214.5, protein: 24, carbs: 0, fat: 12.8, fiber: 2.6 },
      { label: '125 g de arroz Cigala Integral pronto a comer', calories: 210, protein: 4.5, carbs: 37.5, fat: 2.5, fiber: 4.8 },
      { label: '80 g de edamame descascado', calories: 98, protein: 9.5, carbs: 5.6, fat: 4.2, fiber: 4 },
      { label: '250 g de brócolos, pimento, courgette, cenoura e cogumelos', calories: 65, protein: 4, carbs: 10, fat: 0.8, fiber: 5 },
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Molho de soja com teor reduzido de sal, alho, paprika, gengibre e pimenta', calories: 17.5, protein: 1, carbs: 2.9, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Cortar e temperar o tofu e cozinhar na air fryer até ficar crocante.',
      'Assar os legumes ou salteá-los numa frigideira.',
      'Cozer ou aquecer o edamame e aquecer o arroz durante cerca de um minuto.',
      'Juntar tudo e finalizar com o molho de soja moderadamente.'
    ],
    highlights: ['≈43 g de proteína', '≈16 g de fibra', 'Soja em duas formas', 'Bom pós-treino', 'Preparável de véspera'],
    cautions: ['Preferir tofu coagulado com cálcio e confirmar o respetivo rótulo.', 'Preparar tofu, legumes e edamame de véspera; manter o arroz fechado e aquecer apenas ao servir.', 'Os 250 g completos de arroz acrescentam cerca de 210 kcal e 37,5 g de hidratos.'],
    evidenceNote: 'O arroz pronto usa os valores indicados para a embalagem Cigala; tofu, edamame e legumes usam valores médios que devem ser afinados pelos rótulos.',
    calorieAdjustment: {
      label: 'arroz integral pronto',
      baseQuantity: 125,
      minQuantity: 75, maxQuantity: 250, step: 25,
      unit: 'g',
      calories: 210,
      protein: 4.5,
      carbs: 37.5,
      fat: 2.5,
      fiber: 4.8
    },
    scaleHint: 'Ajustar sobretudo a quantidade de arroz; manter tofu e edamame próximos da dose base.'
  }),
  buildRecipe({
    id: 'main-egg-potato-frittata',
    meal: 'main',
    name: 'Frittata de ovos, batata e legumes',
    shortName: 'Frittata com batata',
    description: 'Uma opção prática para almoço ou jantar que recupera os ovos, combina bastante proteína com batata e é excelente para preparar de véspera.',
    quality: 'high',
    qualityLabel: 'Qualidade alta',
    rank: 2,
    prepTime: '30 min',
    batchFriendly: true,
    components: [
      { label: '2 ovos', calories: 144, protein: 12.6, carbs: 0.8, fat: 9.6, fiber: 0 },
      productPortion('150 g de claras', 150, PRODUCT_NUTRITION.eggWhites),
      { label: '300 g de batata', calories: 257, protein: 6, carbs: 57, fat: 0.3, fiber: 6.6 },
      { label: '250 g de espinafres, cogumelos, cebola, tomate ou pimento', calories: 65, protein: 4, carbs: 10, fat: 0.8, fiber: 5 },
      productPortion('30 g de mozzarella ralada', 30, PRODUCT_NUTRITION.gratedMozzarella),
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Pimenta, paprika, alho e ervas a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Cortar a batata em cubos e cozinhar na air fryer.',
      'Saltear ligeiramente os legumes ou usar diretamente os que libertem pouca água.',
      'Misturar os ovos, as claras, os legumes e a mozzarella ralada.',
      'Cozinhar como frittata numa frigideira, no forno ou na air fryer e servir com a batata.'
    ],
    highlights: ['≈47 g de proteína', '≈12 g de fibra', 'Aproveita os ovos', 'Mozzarella ralada', 'Excelente de véspera'],
    cautions: ['Preparar completamente na véspera e aquecer durante poucos minutos.'],
    evidenceNote: 'Claras e mozzarella ralada usam os rótulos registados; ovos, batata e hortícolas usam valores médios.',
    calorieAdjustment: {
      label: 'batata',
      baseQuantity: 300,
      minQuantity: 200, maxQuantity: 400, step: 25,
      unit: 'g',
      calories: 257,
      protein: 6,
      carbs: 57,
      fat: 0.3,
      fiber: 6.6
    },
    scaleHint: 'Manter os ovos e as claras; ajustar sobretudo batata e legumes para aproximar a meta calórica.'
  }),
  buildRecipe({
    id: 'main-red-lentil-pasta',
    meal: 'main',
    name: 'Massa de lentilhas com tomate, cogumelos e creme de skyr',
    shortName: 'Massa de lentilhas e skyr',
    description: 'Uma opção muito rica em proteína e relativamente baixa em gordura, especialmente interessante depois de treino de força.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 3,
    pairsAfter: ['breakfast-quick-pre-workout', 'breakfast-oat-banana-pancakes'],
    prepTime: '25 min',
    batchFriendly: true,
    components: [
      { label: '90 g de massa de lentilhas vermelhas, peso em seco', calories: 308.7, protein: 23.9, carbs: 47.1, fat: 1.3, fiber: 5.8 },
      { label: '200 g de passata ou polpa de tomate sem açúcar adicionado', calories: 70, protein: 3, carbs: 11, fat: 0.4, fiber: 3 },
      { label: '200 g de cogumelos com espinafres ou courgette', calories: 60, protein: 4, carbs: 6, fat: 0.6, fiber: 4 },
      productPortion('150 g de skyr natural', 150, PRODUCT_NUTRITION.skyr),
      productPortion('18 g de mozzarella ralada', 18, PRODUCT_NUTRITION.gratedMozzarella),
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Alho, manjericão, orégãos e pimenta', calories: 5.8, protein: 0.4, carbs: 1.2, fat: 0, fiber: 0.3 }
    ],
    instructions: [
      'Cozer a massa ligeiramente al dente.',
      'Saltear os legumes no azeite e adicionar o tomate.',
      'Guardar a massa e o molho preparados no frigorífico, se necessário.',
      'Aquecer a massa com o molho e misturar o skyr apenas no final, fora do lume ou com lume muito baixo.',
      'Finalizar com a mozzarella ralada e deixar derreter.'
    ],
    highlights: ['≈52 g de proteína', '≈13 g de fibra', 'Pouca gordura', 'Inclui leguminosas', 'Boa pós-força'],
    cautions: ['Não ferver o skyr para evitar separar o creme.', 'A massa Dalla Costa é pesada em seco; 90 g cozinhados terão um peso bastante superior.'],
    evidenceNote: 'Massa Dalla Costa, skyr e mozzarella ralada usam os rótulos registados; restantes ingredientes usam valores médios.',
    calorieAdjustment: {
      label: 'massa de lentilhas vermelhas (peso em seco)',
      baseQuantity: 90,
      minQuantity: 60, maxQuantity: 120, step: 5,
      unit: 'g',
      calories: 308.7,
      protein: 23.9,
      carbs: 47.1,
      fat: 1.3,
      fiber: 5.8
    },
    scaleHint: 'Se o aumento face aos 90 g for grande, não precisas de o concentrar todo na massa: podes completar com pão integral ou fruta.'
  }),
  buildRecipe({
    id: 'main-mexican-quinoa-beans',
    meal: 'main',
    name: 'Bowl mexicano de quinoa, feijão e molho de skyr',
    shortName: 'Bowl de quinoa e feijão',
    description: 'A opção mais rica em fibra e mais diferente da rotação, particularmente útil depois de um pequeno-almoço com pouca fibra.',
    quality: 'very_high',
    qualityLabel: 'Qualidade muito alta',
    rank: 4,
    pairsAfter: ['breakfast-protein-rice-cream'],
    prepTime: '20 min',
    batchFriendly: true,
    components: [
      { label: '125 g de quinoa Sabroz Real pronta', calories: 183.8, protein: 5.9, carbs: 30, fat: 3.9, fiber: 3.8 },
      { label: '150 g de feijão-preto ou vermelho cozido e escorrido', calories: 180, protein: 12.8, carbs: 27, fat: 1, fiber: 10.5 },
      { label: '250 g de pimento, tomate, cebola e/ou folhas verdes, incluindo no máximo 30 g de milho', calories: 100, protein: 4.2, carbs: 18, fat: 1, fiber: 6 },
      productPortion('100 g de skyr natural', 100, PRODUCT_NUTRITION.skyr),
      { label: '50 g de abacate', calories: 80, protein: 1, carbs: 4.3, fat: 7.4, fiber: 3.4 },
      { label: 'Sumo de lima ou limão, cominhos, paprika, alho, coentros e sal iodado moderado', calories: 7.2, protein: 0.1, carbs: 1.7, fat: 0, fiber: 0.1 }
    ],
    instructions: [
      'Misturar o skyr com lima, alho e pimenta para preparar o molho.',
      'Preparar a quinoa, o feijão e os legumes e guardar a base num recipiente.',
      'Guardar o molho de skyr separadamente.',
      'Aquecer a base, se desejado, e juntar o abacate e o molho apenas no final.'
    ],
    highlights: ['≈35 g de proteína', '≈24 g de fibra', 'Quinoa + feijão', 'Ótima após pequeno-almoço leve', 'Preparável de véspera'],
    cautions: ['Escorrer e passar o feijão por água para reduzir o sal.', 'Medir o milho, porque uma quantidade livre altera facilmente os hidratos e as calorias.', 'Confirmar o rótulo concreto da quinoa Sabroz.'],
    evidenceNote: 'Quinoa Sabroz e skyr usam os rótulos registados; feijão, hortícolas e abacate usam valores médios.',
    calorieAdjustment: {
      label: 'quinoa pronta',
      baseQuantity: 125,
      minQuantity: 75, maxQuantity: 250, step: 25,
      unit: 'g',
      calories: 183.8,
      protein: 5.9,
      carbs: 30,
      fat: 3.9,
      fiber: 3.8
    },
    scaleHint: 'Ajustar apenas a quinoa; manter o feijão, o abacate e o molho na dose base.'
  }),
  buildRecipe({
    id: 'main-soy-bolognese', meal: 'main',
    name: 'Bolonhesa de soja com massa integral', shortName: 'Bolonhesa de soja',
    description: 'Molho de tomate e soja texturizada para preparar várias doses e servir com massa integral.',
    quality: 'high', qualityLabel: 'Para várias doses', rank: 5, prepTime: '25 min', batchFriendly: true,
    components: [
      { label: '85 g de massa integral, peso em seco', calories: 294.95, protein: 11.05, carbs: 54.4, fat: 2.125, fiber: 6.8 },
      { label: '50 g de soja texturizada fina, peso em seco', calories: 160, protein: 25.5, carbs: 9, fat: 0.5, fiber: 8 },
      { label: '200 g de passata de tomate', calories: 70, protein: 3, carbs: 11, fat: 0.4, fiber: 3 },
      { label: '200 g de cogumelos, cenoura e cebola', calories: 60, protein: 4, carbs: 6, fat: 0.6, fiber: 4 },
      { label: '10 g de azeite', calories: 90, protein: 0, carbs: 0, fat: 10, fiber: 0 },
      { label: 'Alho, orégãos, pimenta e água a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Hidratar a soja conforme a embalagem e escorrer bem.', 'Saltear os legumes no azeite, juntar a soja e o tomate e deixar apurar.', 'Cozer a massa e servir com o molho. Para várias doses, multiplicar todos os ingredientes pelo número de porções.'],
    highlights: ['Sem lacticínios', 'Congelar o molho', 'Massa integral'],
    cautions: ['Pesar massa e soja antes de hidratar ou cozer.'],
    evidenceNote: 'Estimativa por dose. Massa: rótulo Barilla Integral (347 kcal/100 g); soja e legumes: valores médios, a confirmar na embalagem utilizada.',
    calorieAdjustment: { label: 'massa integral (peso em seco)', baseQuantity: 85, unit: 'g', calories: 294.95, protein: 11.05, carbs: 54.4, fat: 2.125, fiber: 6.8, minQuantity: 60, maxQuantity: 120, step: 5 },
    scaleHint: 'Manter o molho na dose base.'
  }),
  buildRecipe({
    id: 'main-chickpea-tofu-curry', meal: 'main',
    name: 'Caril de grão, tofu e espinafres com arroz', shortName: 'Caril de grão e tofu',
    description: 'Uma refeição de tacho com tomate e especiarias, sem depender de molhos de iogurte.',
    quality: 'high', qualityLabel: 'Refeição de tacho', rank: 6, prepTime: '25 min', batchFriendly: true,
    components: [
      { label: '100 g de tofu firme', calories: 143, protein: 16, carbs: 0, fat: 8.5, fiber: 1.7 },
      { label: '120 g de grão cozido e escorrido', calories: 144, protein: 8, carbs: 19, fat: 2.5, fiber: 6 },
      { label: '125 g de arroz integral pronto a comer', calories: 210, protein: 4.5, carbs: 37.5, fat: 2.5, fiber: 4.8 },
      { label: '200 g de passata de tomate', calories: 70, protein: 3, carbs: 11, fat: 0.4, fiber: 3 },
      { label: '200 g de espinafres, cebola e pimento', calories: 60, protein: 4, carbs: 6, fat: 0.6, fiber: 4 },
      { label: '5 g de azeite', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Caril em pó, cominhos, alho, gengibre e água a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Saltear a cebola e o pimento no azeite com as especiarias.', 'Juntar tomate, tofu em cubos, grão e um pouco de água. Deixar apurar e acrescentar os espinafres.', 'Aquecer o arroz e servir. Dividir o caril em doses se preparares várias refeições.'],
    highlights: ['Sem lacticínios', 'Para várias doses', 'Grão + tofu'],
    cautions: ['O total não inclui leite de coco. Escorrer e passar o grão por água.'],
    evidenceNote: 'Arroz: referência Cigala já registada no catálogo; tofu, grão e hortícolas: valores médios. Confirmar os rótulos.',
    calorieAdjustment: { label: 'arroz integral pronto', baseQuantity: 125, unit: 'g', calories: 210, protein: 4.5, carbs: 37.5, fat: 2.5, fiber: 4.8, minQuantity: 75, maxQuantity: 250, step: 25 },
    scaleHint: 'Manter o caril na dose base.'
  }),
  buildRecipe({
    id: 'main-black-eyed-bean-salad', meal: 'main',
    name: 'Salada de feijão-frade, ovo e pão integral', shortName: 'Feijão-frade e ovo',
    description: 'Uma refeição fria para levar, com legumes crocantes e tempero de limão.',
    quality: 'high', qualityLabel: 'Para levar', rank: 7, prepTime: '15 min', batchFriendly: true,
    components: [
      { label: '200 g de feijão-frade cozido e escorrido', calories: 220, protein: 15, carbs: 32, fat: 1, fiber: 12 },
      { label: '2 ovos', calories: 144, protein: 12.6, carbs: 0.8, fat: 9.6, fiber: 0 },
      { label: '60 g de pão integral', calories: 158, protein: 5, carbs: 30, fat: 2.2, fiber: 4.5 },
      { label: '250 g de tomate, pimento, cenoura e folhas verdes', calories: 65, protein: 4, carbs: 10, fat: 0.8, fiber: 5 },
      { label: '5 g de azeite', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Limão, salsa e pimenta a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Cozer os ovos, arrefecer e cortar.', 'Passar o feijão por água e misturar com os legumes e os ovos.', 'Temperar com azeite, limão e salsa. Levar o pão à parte.'],
    highlights: ['Refeição fria', 'Sem whey', 'Para levar'],
    cautions: ['Manter a salada refrigerada até consumir, incluindo durante o transporte.'],
    evidenceNote: 'Estimativa com valores médios; confirmar pão e feijão na embalagem. O feijão é pesado depois de escorrido.',
    calorieAdjustment: { label: 'pão integral', baseQuantity: 60, unit: 'g', calories: 158, protein: 5, carbs: 30, fat: 2.2, fiber: 4.5, minQuantity: 40, maxQuantity: 100, step: 10 },
    scaleHint: 'Manter o feijão, os ovos e os legumes na dose base.'
  }),
  buildRecipe({
    id: 'main-tofu-hummus-wrap', meal: 'main',
    name: 'Wraps de húmus, tofu e legumes', shortName: 'Wraps de húmus e tofu',
    description: 'Dois wraps pequenos para variar o formato e aproveitar tofu já preparado.',
    quality: 'high', qualityLabel: 'Rápido', rank: 8, prepTime: '15 min', batchFriendly: false,
    components: [
      { label: '2 tortilhas integrais pequenas (80 g no total)', calories: 240, protein: 7.2, carbs: 40, fat: 5.6, fiber: 4.8 },
      { label: '150 g de tofu firme', calories: 214.5, protein: 24, carbs: 0, fat: 12.8, fiber: 2.6 },
      { label: '50 g de húmus', calories: 120, protein: 3.5, carbs: 7, fat: 8, fiber: 3 },
      { label: '200 g de alface, tomate, cenoura e pimento', calories: 52, protein: 3.2, carbs: 8, fat: 0.6, fiber: 4 },
      { label: 'Limão, paprika e pimenta a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Temperar o tofu e dourar numa frigideira antiaderente ou air fryer, sem acrescentar óleo.', 'Aquecer as tortilhas e barrar com o húmus.', 'Distribuir tofu e legumes, enrolar e servir. Se levares para fora, manter refrigerado.'],
    highlights: ['Sem lacticínios', 'Aproveita tofu preparado', 'Porção fixa'],
    cautions: ['Pesar as tortilhas: o tamanho varia muito entre marcas. O total não inclui óleo adicional.'],
    evidenceNote: 'Estimativa com valores médios de tortilha integral, húmus, tofu e hortícolas. Ajustar aos rótulos dos produtos utilizados.',
    scaleHint: 'Manter os dois wraps pequenos; se necessário, escolher um complemento à parte.'
  })
]);

export const DEFAULT_SNACKS = Object.freeze([
  buildRecipe({
    id: 'snack-post-workout-shake',
    meal: 'snack',
    name: 'Shake pós-treino',
    shortName: 'Shake pós-treino',
    description: 'Recuperação rápida e prática: só Evowhey e água quando a refeição seguinte está próxima.',
    quality: 'purpose',
    qualityLabel: 'Pós-treino',
    rank: 1,
    prepTime: '1 min',
    batchFriendly: false,
    components: [
      wheyPortion('30 g de Evowhey', 30),
      { label: '300 a 400 ml de água', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Colocar a Evowhey e a água num shaker.', 'Agitar e beber.'],
    highlights: ['23 g de proteína', 'Muito rápido', 'Baixa gordura', 'Pós-treino'],
    cautions: ['Preparar o pó no shaker e juntar a água no final do treino.', 'Não precisa de leite, banana, aveia ou manteiga de amendoim para cumprir o objetivo deste lanche.'],
    evidenceNote: 'A dose-base usa os valores fornecidos para a tua Evowhey: 104 kcal e 23 g de proteína/30 g. Confirmar quando mudares de sabor ou embalagem.',
    addLabel: 'Só whey',
    variants: []
  }),
  buildRecipe({
    id: 'snack-greek-yogurt-fruit-cereal',
    meal: 'snack',
    name: 'Taça de iogurte grego, fruta e cereais',
    shortName: 'Taça de iogurte e cereais',
    description: 'Uma versão equilibrada do lanche habitual, com cereais simples e uma dose moderada de whey.',
    quality: 'high',
    qualityLabel: 'Qualidade alta',
    rank: 2,
    prepTime: '5 min',
    batchFriendly: true,
    components: [
      productPortion('200 g de iogurte grego natural', 200, PRODUCT_NUTRITION.greekYogurt),
      wheyPortion('12,5 g de Evowhey', 12.5),
      { label: '30 g de cereais integrais sem açúcar adicionado', calories: 111, protein: 3, carbs: 21.5, fat: 1.5, fiber: 3 },
      { label: '150 g de fruta sazonal', calories: 64, protein: 0.6, carbs: 15.6, fat: 0.2, fiber: 3.5 },
      { label: 'Canela (opcional)', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Misturar o iogurte com a whey.', 'Guardar no frigorífico e cortar a fruta na véspera, se for conveniente.', 'Juntar os cereais apenas no momento de comer para continuarem crocantes.'],
    highlights: ['≈24 g de proteína', 'Fruta + cereal integral', 'Preparável de véspera', 'Whey moderada'],
    cautions: ['Preferir cereais integrais simples e sem açúcar adicionado na maioria dos dias.', 'Se já tiveres bebido o shake pós-treino, o programa destaca a variante com 250 g de skyr e sem whey.'],
    evidenceNote: 'Iogurte grego e Evowhey usam os rótulos registados; cereais e fruta usam valores médios.',
    addLabel: 'Com 12,5 g whey',
    variants: [
      {
        id: 'without-whey',
        label: 'Sem whey',
        name: 'Taça de skyr, fruta e cereais sem whey',
        description: 'Usa 250 g de skyr, sendo especialmente útil quando o shake já foi consumido.',
        calories: 320,
        protein: 31.1,
        carbs: 46.4,
        fat: 1.7,
        fiber: 6.5
      }
    ]
  }),
  buildRecipe({
    id: 'snack-bread-hacendado-whey',
    meal: 'snack',
    name: 'Pão integral e +Proteínas Whey Hacendado',
    shortName: 'Pão e batido Hacendado',
    description: 'Uma opção de escritório muito prática, saciante e com a porção já controlada.',
    quality: 'high',
    qualityLabel: 'Muito prático',
    rank: 3,
    prepTime: '1 min',
    batchFriendly: false,
    components: [
      { label: '1 pão integral (≈60 g)', calories: 158, protein: 5, carbs: 30, fat: 2.2, fiber: 4.5 },
      { label: '1 +Proteínas Whey Hacendado (330 ml)', calories: 152, protein: 26, carbs: 7.6, fat: 2, fiber: 0 },
      { label: 'Café ou água', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Levar ou comprar o pão e o batido.', 'Consumir com café ou água, conforme preferires.'],
    highlights: ['31 g de proteína', '≈38 g de hidratos', 'Mercadona', 'Sem preparação'],
    cautions: ['Acrescentar fruta apenas se houver fome ou um dia particularmente ativo.', 'Confirmar a embalagem: existem referências online com composições diferentes para batidos Hacendado semelhantes.'],
    evidenceNote: 'O batido usa os valores que forneceste: 152 kcal e 26 g de proteína; o pão integral de 60 g usa valores médios.',
    addLabel: 'Adicionar',
    variants: [
      {
        id: 'savory-hummus', label: 'Pão, húmus e tomate',
        name: 'Pão integral com húmus e tomate',
        description: '60 g de pão integral, 40 g de húmus e 100 g de tomate. Sem batido. Valores médios; confirmar o húmus no rótulo.',
        calories: 272, protein: 8.7, carbs: 38.3, fat: 8.8, fiber: 8.1
      },
      {
        id: 'with-fruit',
        label: 'Com fruta',
        name: 'Pão e batido Hacendado com fruta',
        description: 'Acrescenta 150 g de fruta sazonal para dias com mais fome ou atividade.',
        calories: 374,
        protein: 31.6,
        carbs: 53.2,
        fat: 4.4,
        fiber: 8
      }
    ]
  }),
  buildRecipe({
    id: 'snack-skyr-banana-cereal',
    meal: 'snack',
    name: 'Skyr, banana e cereais crocantes',
    shortName: 'Skyr, banana e cereais',
    description: 'Um lanche proteico sem whey em pó nem bebida proteica, adequado para casa ou escritório.',
    quality: 'very_high',
    qualityLabel: 'Sem suplemento',
    rank: 4,
    prepTime: '5 min',
    batchFriendly: true,
    components: [
      productPortion('200 g de skyr natural', 200, PRODUCT_NUTRITION.skyr),
      { label: '1 banana média (≈120 g)', calories: 107, protein: 1.3, carbs: 27.4, fat: 0.4, fiber: 3.1 },
      { label: '25 g de cereais integrais sem açúcar adicionado', calories: 92, protein: 2.5, carbs: 18, fat: 1.2, fiber: 2.5 },
      { label: 'Canela', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Colocar o skyr e a banana num recipiente na véspera ou de manhã.', 'Levar os cereais separadamente e juntar apenas na hora.'],
    highlights: ['≈26 g de proteína', 'Sem whey', '≈53 g de hidratos', 'Preparável de véspera'],
    cautions: ['O total base usa 200 g de skyr e 25 g de cereais.', 'A variante com chocolate usa 5 g de chocolate preto; 10 g acrescentariam aproximadamente mais 30 kcal.'],
    evidenceNote: 'Skyr usa o rótulo registado; banana, cereais integrais e chocolate usam valores médios.',
    addLabel: 'Adicionar',
    variants: [
      {
        id: 'with-dark-chocolate',
        label: 'Com chocolate',
        name: 'Skyr, banana, cereais e chocolate preto',
        description: 'Inclui 5 g de chocolate preto partido em pedaços.',
        calories: 345,
        protein: 26.2,
        carbs: 55.1,
        fat: 3.9,
        fiber: 6.2
      }
    ]
  }),
  buildRecipe({
    id: 'snack-chocolate-banana-protein-mug-cake',
    meal: 'snack',
    name: 'Bolo de caneca proteico de chocolate e banana',
    shortName: 'Bolo de caneca proteico',
    description: 'Bolo húmido de chocolate e banana, pronto no micro-ondas em poucos minutos.',
    quality: 'high',
    qualityLabel: 'Proteico',
    rank: 5,
    prepTime: '4 min',
    batchFriendly: false,
    components: [
      wheyPortion('20 g de Evowhey', 20),
      { label: '25 g de farinha de aveia ou flocos de aveia triturados', calories: 88, protein: 3, carbs: 14.5, fat: 1.7, fiber: 2.5 },
      productPortion('80 g de skyr natural', 80, PRODUCT_NUTRITION.skyr),
      { label: '50 g de banana madura esmagada', calories: 43, protein: 0.5, carbs: 11, fat: 0.1, fiber: 1.3 },
      { label: '5 g de cacau puro em pó', calories: 12, protein: 0.8, carbs: 1.5, fat: 0.7, fiber: 1.7 },
      productPortion('35 ml de bebida de soja sem açúcar (ajustar entre 30–40 ml)', 35, PRODUCT_NUTRITION.soyDrink),
      { label: '2 g de fermento em pó (cerca de ½ colher de chá)', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { label: 'Canela ou umas gotas de aroma de baunilha (opcional)', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Esmagar bem a banana numa caneca grande ou taça pequena.',
      'Juntar o skyr e a bebida de soja e misturar.',
      'Acrescentar a aveia, a whey, o cacau e o fermento.',
      'Misturar apenas até ficar homogéneo; a massa deve ficar espessa, mas ainda cremosa.',
      'Se escolheres a variante, colocar os 5 g de chocolate por cima.',
      'Levar ao micro-ondas cerca de 60 segundos a 800 W.',
      'Verificar o centro e, se ainda estiver demasiado líquido, acrescentar 10 segundos de cada vez.',
      'Deixar repousar 1 minuto antes de comer.'
    ],
    highlights: ['≈30 g de proteína', 'Micro-ondas', 'Pronto em 4 min'],
    cautions: ['Não cozinhar demasiado: 10–15 segundos podem fazer a diferença entre um bolo húmido e uma textura seca.'],
    evidenceNote: 'Skyr e bebida de soja usam os rótulos registados; a bebida é calculada com uma porção de referência de 35 ml.',
    addLabel: 'Sem chocolate',
    variants: [
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
    ]
  })
]);

const RETIRED_BREAKFAST_IDS = new Set(['breakfast-eggs-rye', 'breakfast-tofu-scramble']);

export function mergeBreakfastCatalog(storedRecipes = []) {
  const stored = Array.isArray(storedRecipes)
    ? storedRecipes.filter(recipe => !RETIRED_BREAKFAST_IDS.has(recipe?.id))
    : [];
  const byId = new Map(stored.map(recipe => [recipe.id, recipe]));
  const defaults = DEFAULT_BREAKFASTS.map(recipe => {
    const saved = byId.get(recipe.id);
    return saved?.source === 'manual'
      ? saved
      : recipe;
  });
  const custom = stored.filter(recipe => !DEFAULT_BREAKFASTS.some(item => item.id === recipe.id));
  return [...defaults, ...custom];
}

export function mergeRecipeCatalog(storedRecipes = []) {
  const stored = Array.isArray(storedRecipes)
    ? storedRecipes.filter(recipe => !RETIRED_BREAKFAST_IDS.has(recipe?.id))
    : [];
  const defaults = [...DEFAULT_BREAKFASTS, ...DEFAULT_MAIN_MEALS, ...DEFAULT_SNACKS];
  const defaultIds = new Set(defaults.map(recipe => recipe.id));
  const byId = new Map(stored.map(recipe => [recipe.id, recipe]));
  const mergedDefaults = defaults.map(recipe => {
    const saved = byId.get(recipe.id);
    return saved?.source === 'manual'
      ? saved
      : recipe;
  });
  const custom = stored.filter(recipe => !defaultIds.has(recipe.id));
  return [...mergedDefaults, ...custom];
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

export function updateRecipeDetails(existing = {}, changes = {}) {
  const compositionChanged = ['ingredients', 'calories', 'protein', 'carbs', 'fat', 'fiber']
    .some(key => Object.hasOwn(changes, key) && changes[key] !== existing[key]);
  const recipe = { ...existing, ...changes, source: 'manual' };
  if (changes.name && changes.name !== existing.name) recipe.shortName = changes.name;
  if (compositionChanged) {
    // Old component/variant calculations are no longer reliable after a composition edit.
    delete recipe.calorieAdjustment;
    delete recipe.components;
    recipe.variants = [];
    recipe.highlights = [];
    recipe.scaleHint = 'Usar a porção introduzida; rever os valores ao alterar ingredientes.';
    recipe.quality = 'pending';
    recipe.qualityLabel = 'Composição a rever';
    recipe.evidenceNote = 'Valores introduzidos manualmente; confirmar nos rótulos.';
  }
  return recipe;
}
