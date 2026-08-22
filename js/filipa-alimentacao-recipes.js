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
    servings: 1,
    catalogVersion: 1,
    source: 'curated',
    ...recipe,
    ingredients: recipe.components.map(component => component.label).join('\n'),
    calories: Math.round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    fiber: round(totals.fiber)
  });
}

export const FILIPA_PROFILE_DEFAULTS = Object.freeze({
  version: 1,
  calculationMode: 'manual',
  manualCalories: 1650,
  age: 41,
  sexAtBirth: 'female',
  heightCm: 163,
  weightKg: 54,
  goal: 'lose_gentle',
  activityLevel: 'moderate',
  strengthSessions: 4,
  cardioSessions: 2,
  dailyStepsLow: 6000,
  dailyStepsHigh: 10000,
  proteinTargetLow: 100,
  proteinTargetHigh: 115,
  selectedBreakfastId: '',
  breakfastSkipped: false,
  selectedLunchId: '',
  lunchExternal: false,
  selectedDinnerId: '',
  selectedSnackId: '',
  selectedBedtimeId: '',
  extras: [],
  planDate: '',
  updatedAt: '2026-08-22T00:00:00.000Z'
});

export const FILIPA_BREAKFASTS = Object.freeze([
  buildRecipe({
    id: 'filipa-breakfast-cottage-pancakes',
    meal: 'breakfast',
    name: 'Panquecas de aveia, cottage e mirtilos',
    shortName: 'Panquecas de cottage',
    description: 'Panquecas macias e saciantes, preparadas em menos de dez minutos e fáceis de levar.',
    quality: 'very_high',
    qualityLabel: 'Opção base',
    rank: 1,
    prepTime: '10 min',
    batchFriendly: true,
    components: [
      { label: '30 g de flocos de aveia', calories: 113, protein: 4, carbs: 18.3, fat: 2, fiber: 3 },
      { label: '70 g de queijo cottage ligeiro', calories: 57, protein: 8.7, carbs: 2.1, fat: 1.5, fiber: 0 },
      { label: '1 ovo', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 },
      { label: '50 g de claras', calories: 23, protein: 5.3, carbs: 0.4, fat: 0.1, fiber: 0 },
      { label: '80 g de mirtilos', calories: 46, protein: 0.6, carbs: 11.6, fat: 0.2, fiber: 1.9 },
      { label: '7 g de amendoim em pó e canela', calories: 29, protein: 3.4, carbs: 2.2, fat: 0.8, fiber: 0.7 }
    ],
    instructions: [
      'Triturar a aveia, o cottage, o ovo, as claras e a canela até obter uma massa homogénea.',
      'Cozinhar pequenas panquecas numa frigideira antiaderente, virando quando surgirem bolhas.',
      'Servir com os mirtilos e o amendoim em pó.'
    ],
    highlights: ['1 dose', '≈28 g proteína', 'Pronta em 10 min', 'Boa para levar'],
    cautions: ['Para preparar várias doses, multiplicar todos os ingredientes e conservar até 3 dias no frigorífico.', 'Alternativas: trocar mirtilos por maçã, pera ou nectarina e cottage por skyr espesso.', 'Confirmar o rótulo do cottage e do amendoim em pó.'],
    evidenceNote: 'Valores médios para aveia, ovo, claras, cottage, mirtilos e amendoim em pó; afinar com os rótulos usados.'
  }),
  buildRecipe({
    id: 'filipa-breakfast-oats-egg-whites',
    meal: 'breakfast',
    name: 'Papas de aveia com claras, maçã e canela',
    shortName: 'Papas com claras',
    description: 'Papas cremosas sem whey, com claras totalmente cozinhadas e o sabor de maçã e canela.',
    quality: 'very_high',
    qualityLabel: 'Sem whey',
    rank: 2,
    prepTime: '10 min',
    batchFriendly: false,
    components: [
      { label: '35 g de flocos de aveia', calories: 133, protein: 4.7, carbs: 21.4, fat: 2.4, fiber: 3.5 },
      { label: '150 ml de leite proteico Mimosa', calories: 75, protein: 9, carbs: 7.2, fat: 1.8, fiber: 0 },
      { label: '150 g de claras', calories: 69, protein: 15.8, carbs: 1.1, fat: 0.3, fiber: 0 },
      { label: '100 g de maçã e canela a gosto', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4 }
    ],
    instructions: [
      'Aquecer a aveia, o leite e a maçã cortada, mexendo até começar a engrossar.',
      'Baixar o lume e juntar as claras gradualmente, mexendo sempre para ficarem cremosas.',
      'Cozinhar até as claras estarem completamente firmes e as papas homogéneas; finalizar com canela.'
    ],
    highlights: ['1 dose', '≈30 g proteína', 'Sem whey', 'Maçã e canela'],
    cautions: ['As claras devem ficar completamente cozinhadas.', 'Alternativas: usar pera ou nectarina em vez de maçã.', 'O cálculo do leite proteico é provisório; confirmar o rótulo da embalagem Mimosa utilizada.'],
    evidenceNote: 'Aveia, claras e maçã usam valores médios; o leite proteico deve ser afinado pelo rótulo.'
  }),
  buildRecipe({
    id: 'filipa-breakfast-vegetarian-crepioca',
    meal: 'breakfast',
    name: 'Crepioca de ovo, mozzarella e espinafres',
    shortName: 'Crepioca vegetariana',
    description: 'Crepioca salgada sem carne nem peixe, recheada com queijo derretido e legumes.',
    quality: 'high',
    qualityLabel: 'Salgada',
    rank: 3,
    prepTime: '10 min',
    batchFriendly: false,
    components: [
      { label: '30 g de tapioca hidratada', calories: 72, protein: 0, carbs: 18, fat: 0, fiber: 0 },
      { label: '1 ovo', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 },
      { label: '120 g de claras', calories: 55, protein: 12.6, carbs: 0.8, fat: 0.2, fiber: 0 },
      { label: '40 g de mozzarella ligeira', calories: 96, protein: 9.3, carbs: 1.3, fat: 6, fiber: 0 },
      { label: '80 g de tomate', calories: 14, protein: 0.7, carbs: 3.1, fat: 0.2, fiber: 1 },
      { label: '50 g de espinafres', calories: 12, protein: 1.5, carbs: 1.8, fat: 0.2, fiber: 1.1 },
      { label: '3 g de azeite, pimenta e orégãos', calories: 27, protein: 0, carbs: 0, fat: 3, fiber: 0 }
    ],
    instructions: [
      'Misturar a tapioca, o ovo e as claras e temperar.',
      'Cozinhar numa frigideira antiaderente com o azeite até a base ficar firme.',
      'Juntar o tomate, os espinafres e a mozzarella, dobrar e cozinhar até o queijo derreter.'
    ],
    highlights: ['1 dose', '≈30 g proteína', 'Sem carne ou peixe', 'Queijo derretido'],
    cautions: ['Alternativas: trocar mozzarella por queijo flamengo ligeiro ou cottage.', 'Para levar, deixar arrefecer antes de fechar o recipiente e reaquecer completamente.'],
    evidenceNote: 'Valores médios; a tapioca hidratada e a mozzarella variam entre marcas.'
  }),
  buildRecipe({
    id: 'filipa-breakfast-egg-toast',
    meal: 'breakfast',
    name: 'Pão com ovo, claras, queijo e fruta',
    shortName: 'Pão com ovo',
    description: 'Pequeno-almoço salgado e simples, acompanhado por fruta fresca.',
    quality: 'high',
    qualityLabel: 'Muito prático',
    rank: 4,
    prepTime: '10 min',
    batchFriendly: false,
    components: [
      { label: '50 g de pão integral ou de mistura', calories: 125, protein: 5, carbs: 22.5, fat: 1.7, fiber: 3.3 },
      { label: '1 ovo', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 },
      { label: '80 g de claras', calories: 37, protein: 8.4, carbs: 0.6, fat: 0.2, fiber: 0 },
      { label: '15 g de queijo flamengo ligeiro', calories: 39, protein: 4.5, carbs: 0.5, fat: 2.5, fiber: 0 },
      { label: '80 g de pera, maçã ou nectarina', calories: 46, protein: 0.3, carbs: 12, fat: 0.1, fiber: 2.5 },
      { label: '50 g de tomate', calories: 9, protein: 0.5, carbs: 2, fat: 0.1, fiber: 0.6 }
    ],
    instructions: [
      'Tostar o pão e cozinhar o ovo com as claras numa frigideira antiaderente.',
      'Juntar o queijo no fim para derreter e servir sobre o pão com tomate.',
      'Levar ou comer a fruta à parte.'
    ],
    highlights: ['1 dose', '≈25 g proteína', 'Salgado', 'Fruta incluída'],
    cautions: ['Alternativas: usar cottage ou um triângulo Vaca que Ri em vez de queijo flamengo.', 'Confirmar o peso e o rótulo do pão escolhido.'],
    evidenceNote: 'Valores médios para pão, ovo, claras, queijo, tomate e fruta.'
  })
]);

export const FILIPA_MAIN_MEALS = Object.freeze([
  buildRecipe({
    id: 'filipa-main-mediterranean-chicken',
    meal: 'main',
    name: 'Frango mediterrânico com arroz e legumes assados',
    shortName: 'Frango mediterrânico',
    description: 'Frango com arroz e uma porção generosa de curgete, cogumelos, cenoura e tomate.',
    quality: 'very_high',
    qualityLabel: 'Meal prep',
    rank: 1,
    prepTime: '30 min',
    batchFriendly: true,
    components: [
      { label: '110 g de peito de frango cozinhado', calories: 182, protein: 34, carbs: 0, fat: 4, fiber: 0 },
      { label: '100 g de arroz cozinhado', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 },
      { label: '250 g de curgete, cogumelos, cenoura e tomate assados', calories: 75, protein: 4, carbs: 13, fat: 0.8, fiber: 5 },
      { label: '4 g de azeite, alho, paprika e ervas', calories: 36, protein: 0, carbs: 0, fat: 4, fiber: 0 }
    ],
    instructions: [
      'Temperar o frango e os legumes e cozinhar no forno ou na air fryer.',
      'Cozer o arroz e pesar a quantidade já cozinhada.',
      'Dividir em doses individuais e guardar no frigorífico; aquecer completamente antes de comer.'
    ],
    highlights: ['1 dose', '≈41 g proteína', 'Pesos cozinhados', 'Boa para marmita'],
    cautions: ['Alternativas: trocar o frango por peru ou carne de vaca magra cozinhada, ajustando pelo rótulo/tabela.', 'Pode ser preparado para 2 a 3 dias multiplicando todos os ingredientes.'],
    evidenceNote: 'Valores médios para alimentos cozinhados; o azeite deve ser pesado.',
    calorieAdjustment: { label: 'arroz cozinhado', baseQuantity: 100, unit: 'g', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 },
    scaleHint: 'Ajustar sobretudo o arroz; manter o frango e os legumes na dose base.'
  }),
  buildRecipe({
    id: 'filipa-main-turkey-pasta-gratin',
    meal: 'main',
    name: 'Massa gratinada de peru, espinafres e mozzarella',
    shortName: 'Massa gratinada de peru',
    description: 'Massa com molho de tomate, peru, espinafres e uma camada de mozzarella derretida.',
    quality: 'high',
    qualityLabel: 'Gratinado',
    rank: 2,
    prepTime: '30 min',
    batchFriendly: true,
    components: [
      { label: '100 g de peito de peru cozinhado', calories: 150, protein: 29, carbs: 0, fat: 3, fiber: 0 },
      { label: '100 g de massa cozinhada', calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8 },
      { label: '200 g de tomate, cebola e espinafres cozinhados', calories: 60, protein: 3, carbs: 10, fat: 0.5, fiber: 4 },
      { label: '30 g de mozzarella ligeira', calories: 72, protein: 7, carbs: 1, fat: 4.5, fiber: 0 },
      { label: '3 g de azeite, alho e orégãos', calories: 27, protein: 0, carbs: 0, fat: 3, fiber: 0 }
    ],
    instructions: [
      'Misturar a massa e o peru já cozinhados com os legumes e o molho de tomate.',
      'Colocar numa travessa individual, cobrir com mozzarella e gratinar.',
      'Para marmita, guardar depois de arrefecer e reaquecer até ficar bem quente.'
    ],
    highlights: ['1 dose', '≈45 g proteína', 'Pesos cozinhados', 'Queijo gratinado'],
    cautions: ['Alternativas: usar frango ou carne de vaca magra em vez de peru.', 'Pode ser montada em várias doses e gratinada no próprio dia.'],
    evidenceNote: 'Valores médios para alimentos cozinhados; confirmar a mozzarella e o molho de tomate.',
    calorieAdjustment: { label: 'massa cozinhada', baseQuantity: 100, unit: 'g', calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8 },
    scaleHint: 'Ajustar sobretudo a massa; manter o peru, os legumes e a mozzarella.'
  }),
  buildRecipe({
    id: 'filipa-main-salmon-sweet-potato',
    meal: 'main',
    name: 'Salmão com batata-doce e legumes na air fryer',
    shortName: 'Salmão e batata-doce',
    description: 'Salmão com batata-doce, abóbora, curgete e cebola assadas.',
    quality: 'very_high',
    qualityLabel: 'Ómega-3',
    rank: 3,
    prepTime: '30 min',
    batchFriendly: true,
    components: [
      { label: '100 g de salmão cozinhado', calories: 206, protein: 22, carbs: 0, fat: 12, fiber: 0 },
      { label: '130 g de batata-doce cozinhada', calories: 112, protein: 2, carbs: 26, fat: 0.2, fiber: 3.9 },
      { label: '250 g de abóbora, curgete e cebola assadas', calories: 75, protein: 4, carbs: 13, fat: 0.8, fiber: 5 },
      { label: '3 g de azeite, limão e ervas', calories: 27, protein: 0, carbs: 0, fat: 3, fiber: 0 }
    ],
    instructions: [
      'Cozinhar a batata-doce e os legumes na air fryer até dourarem.',
      'Juntar o salmão temperado com limão e ervas e cozinhar sem o secar.',
      'Pesar salmão e batata-doce depois de cozinhados e montar a dose.'
    ],
    highlights: ['1 dose', '≈28 g proteína', 'Pesos cozinhados', 'Air fryer'],
    cautions: ['Alternativa de peixe branco: usar pescada, robalo ou dourada e aumentar a batata ou o azeite conforme o cálculo da página.', 'Para marmita, manter refrigerado e reaquecer apenas uma vez.'],
    evidenceNote: 'Valores médios de salmão, batata-doce e legumes cozinhados.',
    calorieAdjustment: { label: 'batata-doce cozinhada', baseQuantity: 130, unit: 'g', calories: 112, protein: 2, carbs: 26, fat: 0.2, fiber: 3.9 },
    scaleHint: 'Ajustar sobretudo a batata-doce; manter o salmão e os legumes.'
  }),
  buildRecipe({
    id: 'filipa-main-asian-tofu-quinoa',
    meal: 'main',
    name: 'Wok asiático de tofu, quinoa e legumes',
    shortName: 'Wok de tofu e quinoa',
    description: 'Tofu, quinoa, edamame, cogumelos, curgete, cenoura e espinafres num molho leve.',
    quality: 'very_high',
    qualityLabel: 'Vegetariana',
    rank: 4,
    prepTime: '25 min',
    batchFriendly: true,
    components: [
      { label: '150 g de tofu firme cozinhado', calories: 180, protein: 21, carbs: 3, fat: 10, fiber: 1.5 },
      { label: '100 g de quinoa cozinhada', calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8 },
      { label: '200 g de cogumelos, curgete, cenoura e espinafres cozinhados', calories: 60, protein: 3, carbs: 10, fat: 0.5, fiber: 4 },
      { label: '50 g de edamame cozinhado', calories: 61, protein: 5.9, carbs: 3.5, fat: 2.6, fiber: 2.5 },
      { label: '1 c. de sopa de molho de soja com pouco sal', calories: 10, protein: 1, carbs: 1, fat: 0, fiber: 0 },
      { label: '2 g de óleo de sésamo, alho e gengibre', calories: 18, protein: 0, carbs: 0, fat: 2, fiber: 0 }
    ],
    instructions: [
      'Dourar o tofu numa frigideira ou air fryer.',
      'Saltear os legumes e o edamame com alho e gengibre.',
      'Juntar a quinoa e o tofu, finalizar com o molho de soja e o óleo de sésamo.'
    ],
    highlights: ['1 dose', '≈35 g proteína', 'Vegetariana', 'Pesos cozinhados'],
    cautions: ['Alternativa: trocar tofu por frango ou carne de vaca magra já cozinhada.', 'Preparar para 2 a 3 dias e guardar refrigerado em doses individuais.'],
    evidenceNote: 'Valores médios para tofu, quinoa, edamame e legumes cozinhados.',
    calorieAdjustment: { label: 'quinoa cozinhada', baseQuantity: 100, unit: 'g', calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8 },
    scaleHint: 'Ajustar sobretudo a quinoa; manter tofu, edamame e legumes.'
  })
]);

export const FILIPA_SNACKS = Object.freeze([
  buildRecipe({
    id: 'filipa-snack-greek-yogurt-fruit-cereal',
    meal: 'snack',
    name: 'Iogurte grego com fruta e cereais',
    shortName: 'Iogurte, fruta e cereais',
    description: 'O lanche habitual numa porção fácil de transportar, com os cereais separados.',
    quality: 'very_high', qualityLabel: 'Muito prático', rank: 1, prepTime: '5 min', batchFriendly: true,
    components: [
      { label: '170 g de iogurte grego ligeiro', calories: 110, protein: 15, carbs: 7, fat: 2.5, fiber: 0 },
      { label: '100 g de mirtilos, nectarina, maçã ou pera', calories: 50, protein: 0.4, carbs: 12, fat: 0.2, fiber: 2.3 },
      { label: '15 g de cereais ou granola simples', calories: 56, protein: 1.5, carbs: 10.8, fat: 0.8, fiber: 1.5 }
    ],
    instructions: ['Colocar o iogurte e a fruta num recipiente refrigerado.', 'Levar os cereais separados e juntar apenas no momento de comer.'],
    highlights: ['1 dose', '≈17 g proteína', '5 min', 'Marmita'],
    cautions: ['Alternativas: usar skyr ou variar a fruta.', 'Confirmar os rótulos do iogurte e dos cereais.'],
    evidenceNote: 'Valores médios; iogurtes e granolas variam bastante entre marcas.'
  }),
  buildRecipe({
    id: 'filipa-snack-carrot-cake',
    meal: 'snack',
    name: 'Bolinho proteico de cenoura e canela',
    shortName: 'Bolinho de cenoura',
    description: 'Bolinho individual de micro-ondas com cenoura, canela e fruta.',
    quality: 'high', qualityLabel: 'Sabor a bolo', rank: 2, prepTime: '8 min', batchFriendly: false,
    components: [
      { label: '15 g de farinha de aveia', calories: 57, protein: 2, carbs: 9.2, fat: 1, fiber: 1.5 },
      { label: '80 g de claras', calories: 37, protein: 8.4, carbs: 0.6, fat: 0.2, fiber: 0 },
      { label: '10 g de whey de baunilha', calories: 38, protein: 7.8, carbs: 0.6, fat: 0.5, fiber: 0 },
      { label: '50 g de cenoura ralada, canela e fermento', calories: 20, protein: 0.5, carbs: 4.5, fat: 0.1, fiber: 1.4 },
      { label: '50 g de skyr para cobertura', calories: 30, protein: 5, carbs: 1.8, fat: 0.1, fiber: 0 },
      { label: '70 g de maçã, pera ou nectarina', calories: 36, protein: 0.2, carbs: 9.5, fat: 0.1, fiber: 1.7 }
    ],
    instructions: ['Misturar aveia, claras, whey, cenoura, canela e fermento numa taça.', 'Cozinhar no micro-ondas em intervalos curtos até o centro ficar cozinhado.', 'Deixar arrefecer ligeiramente, cobrir com skyr e acompanhar com fruta.'],
    highlights: ['1 dose', '≈24 g proteína', 'Micro-ondas', 'Cenoura e canela'],
    cautions: ['Alternativa sem whey: usar mais 50 g de claras e 30 g adicionais de skyr, confirmando a textura.', 'O tempo depende da potência do micro-ondas.'],
    evidenceNote: 'Valores médios; confirmar whey e skyr.'
  }),
  buildRecipe({
    id: 'filipa-snack-chocolate-cake',
    meal: 'snack',
    name: 'Bolinho proteico de chocolate com fruta',
    shortName: 'Bolinho de chocolate',
    description: 'Uma opção individual de chocolate, servida com pera ou maçã.',
    quality: 'high', qualityLabel: 'Chocolate', rank: 3, prepTime: '8 min', batchFriendly: false,
    components: [
      { label: '15 g de farinha de aveia', calories: 57, protein: 2, carbs: 9.2, fat: 1, fiber: 1.5 },
      { label: '80 g de claras', calories: 37, protein: 8.4, carbs: 0.6, fat: 0.2, fiber: 0 },
      { label: '10 g de whey de chocolate ou baunilha', calories: 38, protein: 7.8, carbs: 0.6, fat: 0.5, fiber: 0 },
      { label: '5 g de cacau magro e fermento', calories: 12, protein: 1, carbs: 1, fat: 0.7, fiber: 1.7 },
      { label: '50 g de iogurte grego ligeiro', calories: 30, protein: 4.4, carbs: 2.1, fat: 0.7, fiber: 0 },
      { label: '70 g de pera ou maçã', calories: 40, protein: 0.2, carbs: 10.5, fat: 0.1, fiber: 1.8 }
    ],
    instructions: ['Misturar a aveia, as claras, a whey, o cacau e o fermento.', 'Cozinhar no micro-ondas em intervalos curtos até ficar firme.', 'Servir com o iogurte e a fruta.'],
    highlights: ['1 dose', '≈24 g proteína', 'Chocolate', 'Micro-ondas'],
    cautions: ['Pode trocar a whey por mais claras e skyr, ajustando a textura.', 'Não cozinhar demasiado para não ficar seco.'],
    evidenceNote: 'Valores médios; confirmar whey, cacau e iogurte.'
  }),
  buildRecipe({
    id: 'filipa-snack-cottage-toast',
    meal: 'snack',
    name: 'Tosta com cottage, tomate e fruta',
    shortName: 'Tosta com cottage',
    description: 'Alternativa salgada, fresca e simples de levar para o trabalho.',
    quality: 'high', qualityLabel: 'Salgada', rank: 4, prepTime: '5 min', batchFriendly: true,
    components: [
      { label: '40 g de pão integral', calories: 100, protein: 4, carbs: 18, fat: 1.4, fiber: 2.6 },
      { label: '80 g de queijo cottage ligeiro', calories: 66, protein: 9.9, carbs: 2.4, fat: 1.8, fiber: 0 },
      { label: '100 g de tomate, orégãos e pimenta', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
      { label: '80 g de maçã, pera ou nectarina', calories: 42, protein: 0.2, carbs: 11, fat: 0.1, fiber: 2 }
    ],
    instructions: ['Levar o pão separado para não amolecer.', 'Barrar com cottage e juntar o tomate no momento de comer.', 'Acompanhar com a fruta.'],
    highlights: ['1 dose', '≈15 g proteína', 'Salgada', '5 min'],
    cautions: ['Alternativas: usar mozzarella, queijo flamengo ligeiro ou Vaca que Ri, recalculando pelo rótulo.'],
    evidenceNote: 'Valores médios; confirmar pão e cottage.'
  })
]);

export const FILIPA_BEDTIMES = Object.freeze([
  buildRecipe({
    id: 'filipa-bedtime-berry-fluff',
    meal: 'bedtime',
    name: 'Fluff de frutos vermelhos na Bimby',
    shortName: 'Fluff de frutos vermelhos',
    description: 'Ceia volumosa e fresca com frutos congelados, gelo e whey.',
    quality: 'very_high', qualityLabel: 'Bimby', rank: 1, prepTime: '8 min', batchFriendly: false,
    components: [
      { label: '130 g de frutos vermelhos congelados', calories: 65, protein: 1.3, carbs: 13, fat: 0.7, fiber: 5.2 },
      { label: '20 g de whey', calories: 77, protein: 15.6, carbs: 1.2, fat: 1, fiber: 0 },
      { label: '80 a 120 g de gelo e 30 a 60 ml de água', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    ],
    instructions: [
      'Colocar os frutos congelados, a whey e o gelo no copo e triturar 20 segundos, aumentando progressivamente até à velocidade 8.',
      'Baixar o preparado das paredes, juntar apenas a água necessária e triturar mais 20 segundos.',
      'Colocar a borboleta e bater 2 a 3 minutos na velocidade 3,5; consumir de imediato.'
    ],
    highlights: ['1 dose', '≈17 g proteína', 'Fruta congelada', 'Muito volume'],
    cautions: ['A textura depende da fruta, da whey e da quantidade de água; começar com pouco líquido.', 'Não guardar depois de batido, porque perde volume e textura.'],
    evidenceNote: 'Frutos vermelhos usam valores médios; confirmar o rótulo da whey.'
  }),
  buildRecipe({
    id: 'filipa-bedtime-skyr-fruit',
    meal: 'bedtime',
    name: 'Skyr portátil com fruta e canela',
    shortName: 'Skyr com fruta',
    description: 'Ceia sem preparação, pensada para quando não estiveres em casa.',
    quality: 'very_high', qualityLabel: 'Fora de casa', rank: 2, prepTime: '2 min', batchFriendly: true,
    components: [
      { label: '150 g de skyr natural', calories: 89, protein: 15, carbs: 5.4, fat: 0.3, fiber: 0 },
      { label: '100 g de mirtilos, maçã, pera ou nectarina e canela', calories: 50, protein: 0.4, carbs: 12, fat: 0.2, fiber: 2.3 }
    ],
    instructions: ['Colocar o skyr e a fruta num recipiente refrigerado.', 'Juntar canela e consumir frio.'],
    highlights: ['1 dose', '≈15 g proteína', '2 min', 'Fora de casa'],
    cautions: ['Alternativa: usar iogurte grego ligeiro e confirmar o rótulo.', 'Transportar refrigerado.'],
    evidenceNote: 'Valores médios; confirmar o skyr e a fruta escolhida.'
  }),
  buildRecipe({
    id: 'filipa-bedtime-warm-apple-yogurt',
    meal: 'bedtime',
    name: 'Maçã quente com canela e iogurte grego',
    shortName: 'Maçã e iogurte',
    description: 'Opção doce baseada em fruta, com canela e um pouco de amendoim em pó.',
    quality: 'high', qualityLabel: 'Fruta quente', rank: 3, prepTime: '5 min', batchFriendly: false,
    components: [
      { label: '100 g de maçã', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4 },
      { label: '100 g de iogurte grego ligeiro', calories: 65, protein: 8.8, carbs: 4.2, fat: 1.5, fiber: 0 },
      { label: '5 g de amendoim em pó e canela', calories: 20, protein: 2.4, carbs: 1.6, fat: 0.6, fiber: 0.5 }
    ],
    instructions: ['Cortar a maçã e cozinhar no micro-ondas com canela até amolecer.', 'Deixar arrefecer ligeiramente e servir com o iogurte e o amendoim em pó.'],
    highlights: ['1 dose', '≈12 g proteína', 'Fruta', '5 min'],
    cautions: ['Alternativas: trocar maçã por pera ou usar skyr em vez de iogurte grego.'],
    evidenceNote: 'Valores médios; confirmar iogurte e amendoim em pó.'
  })
]);

const DEFAULTS = Object.freeze([
  ...FILIPA_BREAKFASTS,
  ...FILIPA_MAIN_MEALS,
  ...FILIPA_SNACKS,
  ...FILIPA_BEDTIMES
]);

export function mergeFilipaRecipeCatalog(storedRecipes = []) {
  const stored = Array.isArray(storedRecipes) ? storedRecipes.filter(Boolean) : [];
  const byId = new Map(stored.map(recipe => [recipe.id, recipe]));
  const defaultIds = new Set(DEFAULTS.map(recipe => recipe.id));
  const mergedDefaults = DEFAULTS.map(recipe => {
    const saved = byId.get(recipe.id);
    return saved?.source === 'manual' && saved.catalogVersion === recipe.catalogVersion
      ? saved
      : recipe;
  });
  return [...mergedDefaults, ...stored.filter(recipe => !defaultIds.has(recipe.id))];
}
