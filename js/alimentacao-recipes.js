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
    catalogVersion: 4,
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
  wheyDetails: 'ESN Designer Whey Apple Strudel: 115 kcal e 23,4 g proteína/30 g. Consumo habitual referido: 2 × 30 g/dia.',
  almondDrinkDetails: 'Substituir preferencialmente por bebida de soja sem açúcar fortificada; confirmar sempre o rótulo.',
  fruitDetails: 'Fruta sazonal, sobretudo pera, maçã, melancia, melão, laranja e nectarina.',
  fortifiedDrink: 'calcium_b12_d',
  selectedBreakfastId: '',
  selectedLunchId: '',
  selectedDinnerId: '',
  snacks: [],
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
    highlights: ['≈36 g de proteína', '≈14 g de fibra', 'Cálcio elevado', 'Sem whey', 'Melhor opção base'],
    cautions: ['Confirmar o rótulo do skyr; as marcas variam.', 'Usar chia inteira ou moída e beber líquidos normalmente ao longo do dia.'],
    evidenceNote: 'Bebida de soja calculada pelo rótulo Alpro; skyr, aveia, chia, nozes e fruta usam valores médios e devem ser afinados pela marca.'
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
      { label: '50 g de creme ou farinha de arroz', calories: 180, protein: 3.5, carbs: 40, fat: 0.5, fiber: 0.5 },
      { label: '250 ml de bebida de soja sem açúcar fortificada', calories: 82.5, protein: 8.3, carbs: 0, fat: 4.5, fiber: 1.5 },
      { label: '150 g de skyr natural', calories: 88.5, protein: 15, carbs: 5.4, fat: 0.3, fiber: 0 },
      { label: '10 g de whey, baunilha ou outro sabor que combine', calories: 38.3, protein: 7.8, carbs: 0.6, fat: 0.5, fiber: 0 },
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
    highlights: ['≈35 g de proteína', 'Digestão relativamente fácil', 'Cereal diferente da aveia', 'Doce e quente', 'Boa para dias de treino'],
    cautions: ['O total apresentado não inclui os frutos secos opcionais.', 'Adicionar 5 g acrescenta cerca de 30 kcal; 10 g acrescenta aproximadamente 55–60 kcal.', 'Deixar arrefecer ligeiramente antes de juntar a whey ajuda a misturá-la sem formar grumos.'],
    evidenceNote: 'Bebida de soja e whey calculadas pelos rótulos já registados; creme de arroz, skyr e fruta usam valores médios. Afinar quando estiverem definidas as marcas.'
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
      { label: '150 g de claras', calories: 69, protein: 15.8, carbs: 1.1, fat: 0.3, fiber: 0 },
      { label: '300 g de batata', calories: 257, protein: 6, carbs: 57, fat: 0.3, fiber: 6.6 },
      { label: '250 g de espinafres, cogumelos, cebola, tomate ou pimento', calories: 65, protein: 4, carbs: 10, fat: 0.8, fiber: 5 },
      { label: '30 g de queijo suave, por exemplo mozzarella ou flamengo (feta apenas se gostares)', calories: 80, protein: 4.6, carbs: 1.2, fat: 6.4, fiber: 0 },
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Pimenta, paprika, alho e ervas a gosto', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Cortar a batata em cubos e cozinhar na air fryer.',
      'Saltear ligeiramente os legumes ou usar diretamente os que libertem pouca água.',
      'Misturar os ovos, as claras, os legumes e o feta.',
      'Cozinhar como frittata numa frigideira, no forno ou na air fryer e servir com a batata.'
    ],
    highlights: ['≈43 g de proteína', '≈12 g de fibra', 'Aproveita os ovos', 'Cálcio do feta', 'Excelente de véspera'],
    cautions: ['Preparar completamente na véspera e aquecer durante poucos minutos.', 'Como não aprecias queijo de sabor forte, usar preferencialmente mozzarella, flamengo suave ou queijo fresco firme; confirmar o rótulo escolhido.'],
    evidenceNote: 'Ovos, claras, batata e hortícolas usam valores médios; confirmar o rótulo das claras e do queijo escolhidos.',
    calorieAdjustment: {
      label: 'batata',
      baseQuantity: 300,
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
      { label: '150 g de skyr natural', calories: 88.5, protein: 15, carbs: 5.4, fat: 0.3, fiber: 0 },
      { label: '10 g de parmesão', calories: 42, protein: 3.7, carbs: 0.3, fat: 2.8, fiber: 0 },
      { label: '5 g de azeite virgem extra', calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },
      { label: 'Alho, manjericão, orégãos e pimenta', calories: 5.8, protein: 0.4, carbs: 1.2, fat: 0, fiber: 0.3 }
    ],
    instructions: [
      'Cozer a massa ligeiramente al dente.',
      'Saltear os legumes no azeite e adicionar o tomate.',
      'Guardar a massa e o molho preparados no frigorífico, se necessário.',
      'Aquecer a massa com o molho e misturar o skyr apenas no final, fora do lume ou com lume muito baixo.',
      'Finalizar com o parmesão.'
    ],
    highlights: ['≈50 g de proteína', '≈13 g de fibra', 'Pouca gordura', 'Inclui leguminosas', 'Boa pós-força'],
    cautions: ['Não ferver o skyr para evitar separar o creme.', 'A massa Dalla Costa é pesada em seco; 90 g cozinhados terão um peso bastante superior.'],
    evidenceNote: 'Massa Dalla Costa calculada pelo rótulo de 343 kcal e 26,5 g de proteína/100 g; restantes ingredientes usam valores médios.',
    calorieAdjustment: {
      label: 'massa de lentilhas seca',
      baseQuantity: 90,
      unit: 'g',
      calories: 308.7,
      protein: 23.9,
      carbs: 47.1,
      fat: 1.3,
      fiber: 5.8
    },
    scaleHint: 'Ajustar a massa seca em pequenas quantidades; para aumentos maiores, combinar com pão integral ou fruta.'
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
      { label: '100 g de skyr natural', calories: 59, protein: 10, carbs: 3.6, fat: 0.2, fiber: 0 },
      { label: '50 g de abacate', calories: 80, protein: 1, carbs: 4.3, fat: 7.4, fiber: 3.4 },
      { label: 'Sumo de lima ou limão, cominhos, paprika, alho, coentros e sal iodado moderado', calories: 7.2, protein: 0.1, carbs: 1.7, fat: 0, fiber: 0.1 }
    ],
    instructions: [
      'Misturar o skyr com lima, alho e pimenta para preparar o molho.',
      'Preparar a quinoa, o feijão e os legumes e guardar a base num recipiente.',
      'Guardar o molho de skyr separadamente.',
      'Aquecer a base, se desejado, e juntar o abacate e o molho apenas no final.'
    ],
    highlights: ['≈34 g de proteína', '≈24 g de fibra', 'Quinoa + feijão', 'Ótima após pequeno-almoço leve', 'Preparável de véspera'],
    cautions: ['Escorrer e passar o feijão por água para reduzir o sal.', 'Medir o milho, porque uma quantidade livre altera facilmente os hidratos e as calorias.', 'Confirmar o rótulo concreto da quinoa Sabroz.'],
    evidenceNote: 'Quinoa Sabroz calculada a 147 kcal e 4,7 g de proteína/100 g; feijão, hortícolas, skyr e abacate usam valores médios.',
    calorieAdjustment: {
      label: 'quinoa pronta',
      baseQuantity: 125,
      unit: 'g',
      calories: 183.8,
      protein: 5.9,
      carbs: 30,
      fat: 3.9,
      fiber: 3.8
    },
    scaleHint: 'Ajustar sobretudo quinoa e feijão; manter o abacate e o molho próximos da dose base.'
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
      { label: '30 g de Evowhey', calories: 104, protein: 23, carbs: 1.5, fat: 0.7, fiber: 0 },
      { label: '300 a 400 ml de água', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Colocar a Evowhey e a água num shaker.', 'Agitar e beber.'],
    highlights: ['23 g de proteína', 'Muito rápido', 'Baixa gordura', 'Pós-treino'],
    cautions: ['Se fores almoçar dentro de cerca de 60 minutos, usar apenas whey e água.', 'Se faltarem 1h30–2h para a refeição ou o treino tiver sido exigente, escolher a variante com banana.', 'Não precisa de leite, aveia ou manteiga de amendoim para cumprir o objetivo deste lanche.'],
    evidenceNote: 'A dose-base usa os valores fornecidos para a tua Evowhey: 104 kcal e 23 g de proteína/30 g. Confirmar quando mudares de sabor ou embalagem.',
    addLabel: 'Só whey',
    variants: [
      {
        id: 'with-banana',
        label: 'Com banana',
        name: 'Shake pós-treino com banana',
        description: 'Para quando a refeição seguinte demora mais ou a sessão foi exigente.',
        calories: 211,
        protein: 24.3,
        carbs: 28.9,
        fat: 1.1,
        fiber: 3.1
      }
    ]
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
      { label: '200 g de iogurte grego magro natural', calories: 116, protein: 11.6, carbs: 8.4, fat: 4, fiber: 0 },
      { label: '12,5 g de Evowhey', calories: 43.3, protein: 9.6, carbs: 0.6, fat: 0.3, fiber: 0 },
      { label: '30 g de cereais integrais sem açúcar adicionado', calories: 111, protein: 3, carbs: 21.5, fat: 1.5, fiber: 3 },
      { label: '150 g de fruta sazonal', calories: 64, protein: 0.6, carbs: 15.6, fat: 0.2, fiber: 3.5 },
      { label: 'Canela (opcional)', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Misturar o iogurte com a whey.', 'Guardar no frigorífico e cortar a fruta na véspera, se for conveniente.', 'Juntar os cereais apenas no momento de comer para continuarem crocantes.'],
    highlights: ['≈25 g de proteína', 'Fruta + cereal integral', 'Preparável de véspera', 'Whey moderada'],
    cautions: ['Preferir cereais integrais simples e sem açúcar adicionado na maioria dos dias.', 'Se já tiveres bebido o shake pós-treino, o programa destaca a variante com 250 g de skyr e sem whey.', 'Os valores do iogurte variam bastante entre marcas; confirmar o rótulo.'],
    evidenceNote: 'Dose-base calculada com 12,5 g de Evowhey e iogurte grego light de referência; cereais e fruta usam valores médios.',
    addLabel: 'Com 12,5 g whey',
    variants: [
      {
        id: 'without-whey',
        label: 'Sem whey',
        name: 'Taça de skyr, fruta e cereais sem whey',
        description: 'Usa 250 g de skyr, sendo especialmente útil quando o shake já foi consumido.',
        calories: 323,
        protein: 28.6,
        carbs: 46.1,
        fat: 2.2,
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
      { label: '200 g de skyr natural', calories: 118, protein: 20, carbs: 7.2, fat: 0.4, fiber: 0 },
      { label: '1 banana média (≈120 g)', calories: 107, protein: 1.3, carbs: 27.4, fat: 0.4, fiber: 3.1 },
      { label: '25 g de cereais integrais sem açúcar adicionado', calories: 92, protein: 2.5, carbs: 18, fat: 1.2, fiber: 2.5 },
      { label: 'Canela', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: ['Colocar o skyr e a banana num recipiente na véspera ou de manhã.', 'Levar os cereais separadamente e juntar apenas na hora.'],
    highlights: ['≈24 g de proteína', 'Sem whey', '≈53 g de hidratos', 'Preparável de véspera'],
    cautions: ['O total base usa 200 g de skyr e 25 g de cereais.', 'A variante com chocolate usa 5 g de chocolate preto; 10 g acrescentariam aproximadamente mais 30 kcal.'],
    evidenceNote: 'Skyr, banana, cereais integrais e chocolate usam valores médios; confirmar as marcas compradas.',
    addLabel: 'Adicionar',
    variants: [
      {
        id: 'with-dark-chocolate',
        label: 'Com chocolate',
        name: 'Skyr, banana, cereais e chocolate preto',
        description: 'Inclui 5 g de chocolate preto partido em pedaços.',
        calories: 347,
        protein: 24.2,
        carbs: 54.9,
        fat: 4.3,
        fiber: 6.2
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
    return saved?.source === 'manual' && saved.catalogVersion === recipe.catalogVersion
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
    return saved?.source === 'manual' && saved.catalogVersion === recipe.catalogVersion
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
