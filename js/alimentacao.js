import { db } from './script.js';
import { showConfirm, showToast } from './toast.js';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  PROFILE_VERSION,
  allocateMealCalories,
  calculateEnergyPlan
} from './alimentacao-core.js';
import {
  DEFAULT_BREAKFASTS,
  DEFAULT_MAIN_MEALS,
  DEFAULT_SNACKS,
  MIGUEL_PROFILE_DEFAULTS,
  getBreakfastProteinTarget,
  mergeRecipeCatalog
} from './alimentacao-recipes.js';
import {
  calculateDailyPlan,
  getMaximumSnackCalories,
  recommendMainMeals,
  sumNutrition
} from './alimentacao-planner.js';

const PROFILE_STORAGE_KEY = `alimentacao-profile-v${PROFILE_VERSION}`;
const RECIPES_STORAGE_KEY = `alimentacao-recipes-v${PROFILE_VERSION}`;
const DEFAULT_RECIPE_IDS = new Set([
  ...DEFAULT_BREAKFASTS.map(recipe => recipe.id),
  ...DEFAULT_MAIN_MEALS.map(recipe => recipe.id),
  ...DEFAULT_SNACKS.map(recipe => recipe.id)
]);

const recipeMealLabels = {
  breakfast: 'Pequeno-almoço',
  main: 'Almoço ou jantar',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche'
};

function loadStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (error) {
    console.warn(`Não foi possível ler ${key}.`, error);
    return fallback;
  }
}

function normalizeProfile(profile = {}) {
  const merged = { ...MIGUEL_PROFILE_DEFAULTS, ...profile };
  merged.selectedBreakfastId = String(merged.selectedBreakfastId || '');
  merged.selectedLunchId = String(merged.selectedLunchId || '');
  merged.selectedDinnerId = String(merged.selectedDinnerId || '');
  merged.snacks = Array.isArray(merged.snacks)
    ? merged.snacks.filter(snack => snack && Number(snack.calories) > 0).map(snack => ({
      id: String(snack.id || `snack-${Date.now()}`),
      name: String(snack.name || 'Lanche'),
      calories: Number(snack.calories) || 0,
      protein: Number(snack.protein) || 0,
      carbs: Number(snack.carbs) || 0,
      fat: Number(snack.fat) || 0,
      fiber: Number(snack.fiber) || 0,
      presetId: String(snack.presetId || ''),
      variantId: String(snack.variantId || 'base')
    }))
    : [];
  return merged;
}

const storedProfile = loadStored(PROFILE_STORAGE_KEY, {});
const state = {
  profile: normalizeProfile(storedProfile),
  recipes: mergeRecipeCatalog(loadStored(RECIPES_STORAGE_KEY, [])),
  user: null
};

const elements = {
  saveState: document.getElementById('food-save-state'),
  energyResult: document.getElementById('food-energy-result'),
  energyTarget: document.getElementById('food-energy-target'),
  energyRange: document.getElementById('food-energy-range'),
  breakfastTarget: document.getElementById('food-breakfast-target'),
  lunchTarget: document.getElementById('food-lunch-target'),
  dinnerTarget: document.getElementById('food-dinner-target'),
  snacksTarget: document.getElementById('food-snacks-target'),
  energyNote: document.getElementById('food-energy-note'),
  recipeGrid: document.getElementById('food-recipe-grid'),
  recipesDailyTarget: document.getElementById('food-recipes-daily-target'),
  recipesBreakfastTarget: document.getElementById('food-recipes-breakfast-target'),
  recipesProteinTarget: document.getElementById('food-recipes-protein-target'),
  addRecipe: document.getElementById('food-add-recipe'),
  recipeDialog: document.getElementById('food-recipe-dialog'),
  recipeForm: document.getElementById('food-recipe-form'),
  recipeDialogTitle: document.getElementById('food-recipe-dialog-title'),
  breakfastSelection: document.getElementById('food-breakfast-selection'),
  selectedBreakfastName: document.getElementById('food-selected-breakfast-name'),
  selectedBreakfastBalance: document.getElementById('food-selected-breakfast-balance'),
  clearBreakfast: document.getElementById('food-clear-breakfast'),
  lunchStage: document.getElementById('food-lunch-stage'),
  lunchContext: document.getElementById('food-lunch-context'),
  lunchCalorieTarget: document.getElementById('food-lunch-calorie-target'),
  lunchGrid: document.getElementById('food-lunch-grid'),
  dinnerStage: document.getElementById('food-dinner-stage'),
  dinnerContext: document.getElementById('food-dinner-context'),
  dinnerCalorieTarget: document.getElementById('food-dinner-calorie-target'),
  dinnerGrid: document.getElementById('food-dinner-grid'),
  snacksStage: document.getElementById('food-snacks-stage'),
  snackBudget: document.getElementById('food-snack-budget'),
  snackPresetGrid: document.getElementById('food-snack-preset-grid'),
  snackForm: document.getElementById('food-snack-form'),
  snackLimit: document.getElementById('food-snack-limit'),
  snackList: document.getElementById('food-snack-list'),
  dayBalance: document.getElementById('food-day-balance'),
  dayBalanceValue: document.getElementById('food-day-balance-value'),
  dayProgress: document.querySelector('.food-day-progress'),
  dayProgressBar: document.getElementById('food-day-progress-bar'),
  dayConfirmed: document.getElementById('food-day-confirmed'),
  dayReserved: document.getElementById('food-day-reserved'),
  dayTarget: document.getElementById('food-day-target'),
  dayBalanceNote: document.getElementById('food-day-balance-note'),
  summaryTitle: document.getElementById('food-macro-summary-title'),
  summaryCalories: document.getElementById('food-summary-calories'),
  summaryProtein: document.getElementById('food-summary-protein'),
  summaryCarbs: document.getElementById('food-summary-carbs'),
  summaryFat: document.getElementById('food-summary-fat')
};

function recipeSupportsStage(recipe, stage) {
  if (!recipe) return false;
  return recipe.meal === 'main' || recipe.meal === stage;
}

function validateSelections() {
  const breakfast = state.recipes.find(recipe => recipe.id === state.profile.selectedBreakfastId);
  if (!breakfast || breakfast.meal !== 'breakfast') {
    state.profile.selectedBreakfastId = '';
    state.profile.selectedLunchId = '';
    state.profile.selectedDinnerId = '';
    return;
  }

  const lunch = state.recipes.find(recipe => recipe.id === state.profile.selectedLunchId);
  if (!recipeSupportsStage(lunch, 'lunch')) {
    state.profile.selectedLunchId = '';
    state.profile.selectedDinnerId = '';
  }

  const dinner = state.recipes.find(recipe => recipe.id === state.profile.selectedDinnerId);
  if (!recipeSupportsStage(dinner, 'dinner') || dinner?.id === state.profile.selectedLunchId) {
    state.profile.selectedDinnerId = '';
  }
}

validateSelections();

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Não foi possível guardar ${key}.`, error);
  }
}

function persistLocal() {
  writeStored(PROFILE_STORAGE_KEY, state.profile);
  writeStored(RECIPES_STORAGE_KEY, state.recipes);
  elements.saveState.textContent = state.user
    ? 'Alterações locais por sincronizar'
    : 'Guardado neste dispositivo';
}

async function syncToCloud({ quiet = false } = {}) {
  if (!state.user) return false;
  try {
    await setDoc(doc(db, 'alimentacao_perfis', state.user.uid), {
      version: PROFILE_VERSION,
      profile: state.profile,
      recipes: state.recipes,
      updatedAt: serverTimestamp()
    }, { merge: true });
    elements.saveState.textContent = 'Guardado e sincronizado';
    if (!quiet) showToast('Alimentação guardada.', 'success');
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar alimentação:', error);
    elements.saveState.textContent = 'Guardado neste dispositivo';
    if (!quiet) showToast('Guardado neste dispositivo; sincronização pendente.', 'warning');
    return false;
  }
}

async function loadRemoteProfile(user) {
  try {
    const snapshot = await getDoc(doc(db, 'alimentacao_perfis', user.uid));
    if (!snapshot.exists()) {
      await syncToCloud({ quiet: true });
      return;
    }

    const remote = snapshot.data();
    const remoteProfile = remote.profile || {};
    const localTime = Date.parse(state.profile.updatedAt || '') || 0;
    const remoteTime = remote.updatedAt?.toMillis?.() || Date.parse(remoteProfile.updatedAt || '') || 0;
    if (remoteTime >= localTime) {
      state.profile = normalizeProfile(remoteProfile);
      state.recipes = mergeRecipeCatalog(remote.recipes);
      validateSelections();
      persistLocal();
      renderAll();
    } else {
      await syncToCloud({ quiet: true });
    }
    elements.saveState.textContent = 'Guardado e sincronizado';
  } catch (error) {
    console.error('Erro ao carregar alimentação:', error);
    elements.saveState.textContent = 'A usar dados deste dispositivo';
  }
}

function formatCalories(value) {
  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value))} kcal`;
}

function formatGrams(value) {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)} g`;
}

function getCurrentEnergyContext() {
  const energy = calculateEnergyPlan(state.profile);
  if (!energy) return { energy: null, allocation: null };
  return {
    energy,
    allocation: allocateMealCalories(
      energy.target,
      state.profile.mealPattern || '3+1',
      state.profile.breakfastAppetite || 'medium'
    )
  };
}

function getSelectedRecipe(field) {
  return state.recipes.find(recipe => recipe.id === state.profile[field]) || null;
}

function getSelectedBreakfast() {
  return getSelectedRecipe('selectedBreakfastId');
}

function getSelectedLunch() {
  return getSelectedRecipe('selectedLunchId');
}

function getSelectedDinner() {
  return getSelectedRecipe('selectedDinnerId');
}

function getDailyPlan() {
  const { energy, allocation } = getCurrentEnergyContext();
  if (!energy || !allocation) return null;
  return calculateDailyPlan({
    targetCalories: energy.target,
    breakfast: getSelectedBreakfast(),
    lunch: getSelectedLunch(),
    dinner: getSelectedDinner(),
    snacks: state.profile.snacks,
    lunchTarget: allocation.lunch,
    dinnerTarget: allocation.dinner
  });
}

function getMainRecipes(stage) {
  return state.recipes.filter(recipe => (
    recipeSupportsStage(recipe, stage)
    && Number.isFinite(Number(recipe.calories))
    && Number(recipe.calories) > 0
  ));
}

function getSnackRecipes() {
  return state.recipes.filter(recipe => (
    recipe.meal === 'snack'
    && Number.isFinite(Number(recipe.calories))
    && Number(recipe.calories) > 0
  ));
}

function renderEnergyPlan() {
  const { energy, allocation } = getCurrentEnergyContext();
  if (!energy || !allocation) {
    elements.energyResult.hidden = true;
    return;
  }

  const breakfast = getSelectedBreakfast();
  const plan = breakfast ? getDailyPlan() : null;
  elements.energyResult.hidden = false;
  elements.energyTarget.textContent = formatCalories(energy.target);
  elements.energyRange.textContent = 'base diária atual';
  elements.breakfastTarget.textContent = formatCalories(breakfast?.calories || allocation.breakfast);
  elements.lunchTarget.textContent = formatCalories(plan?.lunchCalories || allocation.lunch);
  elements.dinnerTarget.textContent = formatCalories(plan?.dinnerCalories || allocation.dinner);
  elements.snacksTarget.textContent = formatCalories(plan?.snackBudget ?? (allocation.snacks[0] || 0));

  if (!breakfast) {
    elements.energyNote.textContent = 'Escolhe o pequeno-almoço para ordenar os almoços e calcular o restante dia.';
  } else if (plan?.allMealsSelected && state.profile.snacks.length) {
    elements.energyNote.textContent = 'O jantar foi ajustado aos lanches registados para fechar a meta diária.';
  } else if (plan?.allMealsSelected) {
    elements.energyNote.textContent = `O plano fecha a meta com ${formatCalories(plan.reservedSnackCalories)} reservadas para lanche.`;
  } else {
    elements.energyNote.textContent = 'Almoço, jantar e lanche serão recalculados à medida que fizeres escolhas.';
  }
}

function renderRecipeTargets() {
  const { energy, allocation } = getCurrentEnergyContext();
  const protein = getBreakfastProteinTarget(state.profile.weightKg);
  elements.recipesDailyTarget.textContent = energy ? formatCalories(energy.target) : '—';
  elements.recipesBreakfastTarget.textContent = allocation ? `≈ ${formatCalories(allocation.breakfast)}` : '—';
  elements.recipesProteinTarget.textContent = protein
    ? `≈ ${protein.dailyLow}–${protein.dailyHigh} g`
    : '—';
}

function appendMacro(container, label, value) {
  const item = document.createElement('div');
  const small = document.createElement('small');
  small.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value;
  item.append(small, strong);
  container.appendChild(item);
}

function createRecipeDetails(recipe) {
  const details = document.createElement('details');
  details.className = 'food-recipe-details';
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'Ver ingredientes e preparação';
  const ingredientTitle = document.createElement('strong');
  ingredientTitle.textContent = 'Ingredientes da porção base';
  const ingredients = document.createElement('ul');
  String(recipe.ingredients || '').split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    const item = document.createElement('li');
    item.textContent = line;
    ingredients.appendChild(item);
  });
  details.append(detailsSummary, ingredientTitle, ingredients);

  if (Array.isArray(recipe.instructions) && recipe.instructions.length) {
    const instructionTitle = document.createElement('strong');
    instructionTitle.textContent = 'Preparação';
    const instructions = document.createElement('ol');
    recipe.instructions.forEach(line => {
      const item = document.createElement('li');
      item.textContent = line;
      instructions.appendChild(item);
    });
    details.append(instructionTitle, instructions);
  }

  if (Array.isArray(recipe.cautions) && recipe.cautions.length) {
    const notesTitle = document.createElement('strong');
    notesTitle.textContent = 'Notas';
    const notes = document.createElement('ul');
    recipe.cautions.forEach(line => {
      const item = document.createElement('li');
      item.textContent = line;
      notes.appendChild(item);
    });
    details.append(notesTitle, notes);
  }

  if (recipe.evidenceNote) {
    const evidence = document.createElement('p');
    evidence.className = 'food-recipe-evidence';
    evidence.textContent = `Base do cálculo: ${recipe.evidenceNote}`;
    details.appendChild(evidence);
  }
  return details;
}

function appendRecipeDelete(actions, recipe) {
  if (DEFAULT_RECIPE_IDS.has(recipe.id)) return;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'food-recipe-delete';
  remove.dataset.deleteRecipe = recipe.id;
  remove.setAttribute('aria-label', `Apagar ${recipe.name}`);
  remove.textContent = '×';
  actions.appendChild(remove);
}

function createBreakfastCard(recipe, index) {
  const article = document.createElement('article');
  article.className = 'food-recipe-card food-recipe-card--custom';
  article.dataset.recipeId = recipe.id;
  if (state.profile.selectedBreakfastId === recipe.id) article.dataset.selected = 'true';

  const topline = document.createElement('div');
  topline.className = 'food-recipe-topline';
  const number = document.createElement('span');
  number.className = 'food-recipe-number';
  number.textContent = recipe.source === 'curated'
    ? String(index + 1).padStart(2, '0')
    : recipeMealLabels[recipe.meal] || 'Receita';
  const quality = document.createElement('span');
  quality.className = `food-quality food-quality--${recipe.quality || 'manual'}`;
  quality.textContent = recipe.qualityLabel || 'Não verificada';
  topline.append(number, quality);

  const title = document.createElement('h3');
  title.textContent = recipe.name;
  const summary = document.createElement('p');
  summary.className = 'food-recipe-summary';
  summary.textContent = recipe.description || recipe.notes || 'Receita pessoal.';

  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia', Number.isFinite(recipe.calories) ? formatCalories(recipe.calories) : '—');
  appendMacro(macros, 'Proteína', formatGrams(recipe.protein));
  appendMacro(macros, 'Hidratos', formatGrams(recipe.carbs));
  appendMacro(macros, 'Gordura', formatGrams(recipe.fat));

  const { allocation } = getCurrentEnergyContext();
  const targetNote = document.createElement('p');
  targetNote.className = 'food-recipe-target-note';
  if (allocation && Number.isFinite(recipe.calories)) {
    const difference = Math.round(recipe.calories - allocation.breakfast);
    targetNote.dataset.state = Math.abs(difference) <= 40 ? 'ok' : 'adjust';
    targetNote.textContent = Math.abs(difference) <= 40
      ? `Dentro do alvo de ${formatCalories(allocation.breakfast)} (${difference >= 0 ? '+' : ''}${difference} kcal).`
      : `${Math.abs(difference)} kcal ${difference > 0 ? 'acima' : 'abaixo'} do alvo atual.`;
  }

  const highlights = document.createElement('div');
  highlights.className = 'food-recipe-highlights';
  (recipe.highlights || []).forEach(value => {
    const chip = document.createElement('span');
    chip.textContent = value;
    highlights.appendChild(chip);
  });

  const actions = document.createElement('div');
  actions.className = 'food-recipe-actions';
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = state.profile.selectedBreakfastId === recipe.id ? '' : 'primary';
  choose.dataset.chooseRecipe = recipe.id;
  choose.textContent = state.profile.selectedBreakfastId === recipe.id ? 'Escolhido ✓' : 'Escolher';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = recipe.id;
  edit.textContent = 'Editar';
  actions.append(choose, edit);
  appendRecipeDelete(actions, recipe);

  article.append(topline, title, summary, macros, targetNote);
  if (highlights.childElementCount) article.appendChild(highlights);
  article.append(createRecipeDetails(recipe), actions);
  return article;
}

function createMainMealCard(recommendation, stage, index) {
  const { meal, adjusted, reason } = recommendation;
  const selectedId = stage === 'lunch' ? state.profile.selectedLunchId : state.profile.selectedDinnerId;
  const selected = selectedId === meal.id;
  const article = document.createElement('article');
  article.className = 'food-recipe-card food-main-meal-card';
  article.dataset.recipeId = meal.id;
  if (selected) article.dataset.selected = 'true';

  const topline = document.createElement('div');
  topline.className = 'food-recipe-topline';
  const rank = document.createElement('span');
  rank.className = 'food-recommendation-rank';
  rank.textContent = index === 0 ? 'Recomendado' : `${index + 1}.ª opção`;
  const quality = document.createElement('span');
  quality.className = `food-quality food-quality--${meal.quality || 'manual'}`;
  quality.textContent = meal.qualityLabel || 'Não verificada';
  topline.append(rank, quality);

  const title = document.createElement('h4');
  title.textContent = meal.name;
  const summary = document.createElement('p');
  summary.className = 'food-recipe-summary';
  summary.textContent = meal.description || meal.notes || 'Receita pessoal.';
  const reasonText = document.createElement('p');
  reasonText.className = 'food-main-meal-reason';
  reasonText.textContent = reason;

  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia ajustada', formatCalories(adjusted.calories));
  appendMacro(macros, 'Proteína aprox.', formatGrams(adjusted.protein));
  appendMacro(macros, 'Hidratos aprox.', formatGrams(adjusted.carbs));
  appendMacro(macros, 'Fibra aprox.', formatGrams(adjusted.fiber));

  const portion = document.createElement('p');
  portion.className = 'food-main-meal-portion';
  if (adjusted.adjustmentLabel && adjusted.adjustedQuantity >= 0) {
    portion.textContent = Math.abs(adjusted.adjustedQuantity - adjusted.baseQuantity) < 1
      ? `${formatCalories(meal.calories)} na receita · manter ${formatGrams(adjusted.baseQuantity)} de ${adjusted.adjustmentLabel}.`
      : `${formatCalories(meal.calories)} na receita · para esta meta, usar ≈ ${formatGrams(adjusted.adjustedQuantity)} de ${adjusted.adjustmentLabel} em vez de ${formatGrams(adjusted.baseQuantity)}. Manter os restantes ingredientes na dose base.`;
  } else {
    const factorText = Math.abs(adjusted.servingFactor - 1) <= 0.05
      ? 'porção base'
      : `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(adjusted.servingFactor)}× a porção base`;
    portion.textContent = `${formatCalories(meal.calories)} na receita · usar ${factorText}.`;
  }
  if (meal.scaleHint) portion.textContent += ` ${meal.scaleHint}`;
  if (!adjusted.isPracticalPortion) portion.dataset.state = 'warning';

  const actions = document.createElement('div');
  actions.className = 'food-recipe-actions';
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = selected ? '' : 'primary';
  choose.dataset[stage === 'lunch' ? 'chooseLunch' : 'chooseDinner'] = meal.id;
  choose.textContent = selected ? `Escolhido para ${stage === 'lunch' ? 'almoço' : 'jantar'} ✓` : 'Escolher';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = meal.id;
  edit.textContent = 'Editar';
  actions.append(choose, edit);
  appendRecipeDelete(actions, meal);

  article.append(topline, title, summary, reasonText, macros, portion, createRecipeDetails(meal), actions);
  return article;
}

function renderBreakfastRecipes() {
  elements.recipeGrid.replaceChildren();
  state.recipes
    .filter(recipe => recipe.meal === 'breakfast')
    .forEach((recipe, index) => elements.recipeGrid.appendChild(createBreakfastCard(recipe, index)));
}

function renderRecommendationGrid(stage, calorieTarget, consumedNutrition, excludedIds = []) {
  const grid = stage === 'lunch' ? elements.lunchGrid : elements.dinnerGrid;
  const recommendations = recommendMainMeals(getMainRecipes(stage), {
    calorieTarget,
    consumedNutrition,
    breakfastId: state.profile.selectedBreakfastId,
    excludedIds,
    mealSlotsRemaining: stage === 'lunch' ? 2 : 1
  });
  grid.replaceChildren();
  recommendations.forEach((recommendation, index) => {
    grid.appendChild(createMainMealCard(recommendation, stage, index));
  });
  if (!recommendations.length) {
    const empty = document.createElement('p');
    empty.className = 'food-stage-empty';
    empty.textContent = 'Ainda não existem receitas completas para esta refeição.';
    grid.appendChild(empty);
  }
  return recommendations;
}

function renderBreakfastSelection() {
  const selected = getSelectedBreakfast();
  if (!selected) {
    elements.breakfastSelection.hidden = true;
    return;
  }
  const { energy } = getCurrentEnergyContext();
  elements.breakfastSelection.hidden = false;
  elements.selectedBreakfastName.textContent = selected.name;
  elements.selectedBreakfastBalance.textContent = energy
    ? `${formatCalories(selected.calories)} escolhidas · restam ${formatCalories(Math.max(0, energy.target - selected.calories))} para almoço, jantar e lanches.`
    : 'Escolha guardada.';
}

function renderMealStages() {
  const breakfast = getSelectedBreakfast();
  const lunch = getSelectedLunch();
  const dinner = getSelectedDinner();
  const sequence = Array.from(document.querySelectorAll('.food-sequence article'));
  sequence.forEach(item => item.removeAttribute('data-sequence'));

  if (!breakfast) {
    elements.lunchStage.hidden = true;
    elements.dinnerStage.hidden = true;
    elements.snacksStage.hidden = true;
    elements.dayBalance.hidden = true;
    if (sequence[0]) sequence[0].dataset.sequence = 'active';
    return;
  }

  const plan = getDailyPlan();
  const snackTotals = sumNutrition(state.profile.snacks);
  elements.lunchStage.hidden = false;
  elements.snacksStage.hidden = false;
  elements.dayBalance.hidden = false;
  elements.lunchCalorieTarget.textContent = `Meta · ${formatCalories(plan.lunchCalories)}`;
  const lunchRecommendations = renderRecommendationGrid(
    'lunch',
    plan.lunchCalories,
    sumNutrition([breakfast, snackTotals])
  );
  elements.lunchContext.textContent = lunchRecommendations[0]
    ? `${lunchRecommendations[0].meal.name}: ${lunchRecommendations[0].reason}`
    : 'Cria uma receita de almoço ou jantar para continuar.';

  if (sequence[0]) sequence[0].dataset.sequence = 'complete';
  if (!lunch) {
    elements.dinnerStage.hidden = true;
    if (sequence[1]) sequence[1].dataset.sequence = 'active';
    renderSnacks(plan);
    renderDayBalance(plan);
    return;
  }

  elements.dinnerStage.hidden = false;
  elements.dinnerCalorieTarget.textContent = `Meta · ${formatCalories(plan.dinnerCalories)}`;
  const consumedBeforeDinner = sumNutrition([breakfast, plan.adjustedLunch, snackTotals]);
  const dinnerRecommendations = renderRecommendationGrid(
    'dinner',
    plan.dinnerCalories,
    consumedBeforeDinner,
    [lunch.id]
  );
  elements.dinnerContext.textContent = dinnerRecommendations[0]
    ? `${dinnerRecommendations[0].meal.name}: ${dinnerRecommendations[0].reason}`
    : 'Cria outra receita principal para não repetir o almoço.';
  if (sequence[1]) sequence[1].dataset.sequence = 'complete';
  if (sequence[2]) sequence[2].dataset.sequence = dinner ? 'complete' : 'active';
  renderSnacks(plan);
  renderDayBalance(plan);
}

function createSnackPresetCard(recipe, index, hasPostWorkoutShake) {
  const article = document.createElement('article');
  article.className = 'food-snack-preset-card';
  const addedCount = state.profile.snacks.filter(snack => snack.presetId === recipe.id).length;
  if (addedCount) article.dataset.selected = 'true';

  const topline = document.createElement('div');
  topline.className = 'food-recipe-topline';
  const number = document.createElement('span');
  number.className = 'food-recipe-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const quality = document.createElement('span');
  quality.className = `food-quality food-quality--${recipe.quality || 'manual'}`;
  quality.textContent = recipe.qualityLabel || 'Receita pessoal';
  topline.append(number, quality);

  const title = document.createElement('h4');
  title.textContent = recipe.name;
  const summary = document.createElement('p');
  summary.className = 'food-recipe-summary';
  summary.textContent = recipe.description || recipe.notes || 'Lanche pessoal.';

  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia base', formatCalories(recipe.calories));
  appendMacro(macros, 'Proteína', formatGrams(recipe.protein));
  appendMacro(macros, 'Hidratos', formatGrams(recipe.carbs));
  appendMacro(macros, 'Fibra', formatGrams(recipe.fiber));

  const recommendation = document.createElement('p');
  recommendation.className = 'food-snack-preset-reason';
  if (recipe.id === 'snack-greek-yogurt-fruit-cereal' && hasPostWorkoutShake) {
    recommendation.textContent = 'Já tens um shake pós-treino: a variante sem whey fica recomendada.';
  } else if (addedCount) {
    recommendation.textContent = `${addedCount} ${addedCount === 1 ? 'dose adicionada' : 'doses adicionadas'} ao dia.`;
  } else {
    recommendation.textContent = 'Escolhe a dose-base ou uma variante; cada botão tem o seu próprio total.';
  }

  const actions = document.createElement('div');
  actions.className = 'food-snack-preset-actions';
  const choices = [
    {
      id: 'base',
      label: recipe.addLabel || 'Adicionar',
      calories: recipe.calories
    },
    ...(Array.isArray(recipe.variants) ? recipe.variants : [])
  ];
  const recommendedChoiceId = (
    recipe.id === 'snack-greek-yogurt-fruit-cereal' && hasPostWorkoutShake
  ) ? 'without-whey' : 'base';
  choices.forEach(choice => {
    const button = document.createElement('button');
    button.type = 'button';
    if (choice.id === recommendedChoiceId) button.className = 'primary';
    button.dataset.addSnackRecipe = recipe.id;
    button.dataset.snackVariant = choice.id;
    button.textContent = `${choice.label} · ${formatCalories(choice.calories)}`;
    actions.appendChild(button);
  });
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = recipe.id;
  edit.textContent = 'Editar';
  actions.appendChild(edit);

  article.append(topline, title, summary, macros, recommendation, createRecipeDetails(recipe), actions);
  return article;
}

function renderSnackPresets() {
  const hasPostWorkoutShake = state.profile.snacks.some(snack => (
    snack.presetId === 'snack-post-workout-shake'
  ));
  elements.snackPresetGrid.replaceChildren();
  getSnackRecipes().forEach((recipe, index) => {
    elements.snackPresetGrid.appendChild(createSnackPresetCard(recipe, index, hasPostWorkoutShake));
  });
}

function renderSnacks(plan) {
  const breakfast = getSelectedBreakfast();
  const { energy, allocation } = getCurrentEnergyContext();
  if (!breakfast || !energy || !allocation) return;

  const snackTotals = sumNutrition(state.profile.snacks);
  const maximum = getMaximumSnackCalories({
    targetCalories: energy.target,
    breakfastCalories: breakfast.calories,
    lunchCalories: allocation.lunch,
    minimumDinnerCalories: 400
  });
  elements.snackBudget.textContent = state.profile.snacks.length
    ? `${formatCalories(snackTotals.calories)} registadas`
    : `Reserva sugerida · ${formatCalories(plan.snackBudget)}`;
  elements.snackLimit.textContent = `Máximo prático neste plano: ${formatCalories(maximum)} em lanches, preservando pelo menos 400 kcal para jantar.`;
  renderSnackPresets();
  elements.snackList.replaceChildren();

  if (!state.profile.snacks.length) {
    const empty = document.createElement('p');
    empty.className = 'food-snack-empty';
    empty.textContent = 'Ainda não adicionaste lanches. A reserva sugerida mantém o plano diário nas 2 400 kcal.';
    elements.snackList.appendChild(empty);
    return;
  }

  state.profile.snacks.forEach(snack => {
    const item = document.createElement('article');
    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = snack.name;
    const macros = document.createElement('small');
    macros.textContent = `${formatCalories(snack.calories)} · P ${formatGrams(snack.protein)} · HC ${formatGrams(snack.carbs)} · G ${formatGrams(snack.fat)}`;
    text.append(name, macros);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.removeSnack = snack.id;
    remove.setAttribute('aria-label', `Remover ${snack.name}`);
    remove.textContent = 'Remover';
    item.append(text, remove);
    elements.snackList.appendChild(item);
  });
}

function renderDayBalance(plan) {
  const { energy } = getCurrentEnergyContext();
  if (!plan || !energy) return;
  const progress = Math.min(100, (plan.confirmedCalories / energy.target) * 100);
  elements.dayProgressBar.style.width = `${progress}%`;
  elements.dayProgress.setAttribute('aria-valuemax', String(energy.target));
  elements.dayProgress.setAttribute('aria-valuenow', String(plan.confirmedCalories));
  elements.dayConfirmed.textContent = formatCalories(plan.confirmedCalories);
  elements.dayReserved.textContent = state.profile.snacks.length
    ? 'Substituída pelos lanches'
    : formatCalories(plan.snackBudget);
  elements.dayTarget.textContent = formatCalories(energy.target);
  elements.dayBalanceValue.textContent = plan.closesCalorieTarget
    ? `${formatCalories(plan.plannedCalories)} planeadas`
    : `${formatCalories(plan.confirmedCalories)} selecionadas`;

  if (!getSelectedLunch()) {
    elements.dayBalanceNote.textContent = `Escolhe o almoço. O programa propõe ${formatCalories(plan.lunchCalories)} e mantém ${formatCalories(plan.snackBudget)} para lanches.`;
  } else if (!getSelectedDinner()) {
    elements.dayBalanceNote.textContent = `Escolhe o jantar. O alvo atual é ${formatCalories(plan.dinnerCalories)} e será recalculado se adicionares lanches.`;
  } else if (!state.profile.snacks.length) {
    elements.dayBalanceNote.textContent = `As três refeições estão ajustadas e ficam reservadas ${formatCalories(plan.reservedSnackCalories)} para adicionares um ou mais lanches.`;
  } else {
    elements.dayBalanceNote.textContent = `Plano fechado em ${formatCalories(plan.plannedCalories)}. O jantar foi ajustado para ${formatCalories(plan.dinnerCalories)} depois de contar os lanches.`;
  }

  const impractical = [plan.adjustedLunch, plan.adjustedDinner]
    .filter(Boolean)
    .some(meal => !meal.isPracticalPortion);
  elements.dayBalance.dataset.state = impractical ? 'review' : 'ok';
  if (impractical) {
    elements.dayBalanceNote.textContent += ' Uma das porções fica fora do intervalo prático; revê os lanches ou escolhe outra receita.';
  }
}

function renderMacroSummary() {
  const breakfast = getSelectedBreakfast();
  if (!breakfast) {
    elements.summaryTitle.textContent = 'Totais selecionados';
    elements.summaryCalories.textContent = '—';
    elements.summaryProtein.textContent = '—';
    elements.summaryCarbs.textContent = '—';
    elements.summaryFat.textContent = '—';
    return;
  }
  const plan = getDailyPlan();
  const totals = plan.selectedNutrition;
  elements.summaryTitle.textContent = plan.allMealsSelected
    ? (state.profile.snacks.length ? 'Totais do dia selecionado' : 'Totais confirmados, sem lanche')
    : 'Totais selecionados';
  elements.summaryCalories.textContent = formatCalories(totals.calories);
  elements.summaryProtein.textContent = formatGrams(totals.protein);
  elements.summaryCarbs.textContent = formatGrams(totals.carbs);
  elements.summaryFat.textContent = formatGrams(totals.fat);
}

function renderAll() {
  validateSelections();
  renderRecipeTargets();
  renderBreakfastRecipes();
  renderBreakfastSelection();
  renderMealStages();
  renderEnergyPlan();
  renderMacroSummary();
}

function openRecipeDialog(recipe = null) {
  elements.recipeForm.reset();
  elements.recipeDialogTitle.textContent = recipe ? 'Editar receita' : 'Criar receita';
  if (recipe) {
    elements.recipeForm.elements.recipeId.value = recipe.id;
    elements.recipeForm.elements.recipeName.value = recipe.name;
    elements.recipeForm.elements.recipeMeal.value = recipe.meal;
    elements.recipeForm.elements.recipeIngredients.value = recipe.ingredients;
    elements.recipeForm.elements.recipeCalories.value = recipe.calories ?? '';
    elements.recipeForm.elements.recipeProtein.value = recipe.protein ?? '';
    elements.recipeForm.elements.recipeCarbs.value = recipe.carbs ?? '';
    elements.recipeForm.elements.recipeFat.value = recipe.fat ?? '';
    elements.recipeForm.elements.recipeFiber.value = recipe.fiber ?? '';
    elements.recipeForm.elements.recipeNotes.value = recipe.notes
      || (Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : '');
  }
  elements.recipeDialog.showModal();
  requestAnimationFrame(() => elements.recipeForm.elements.recipeName.focus());
}

function optionalNumber(value) {
  if (String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function saveRecipe(event) {
  event.preventDefault();
  if (!elements.recipeForm.reportValidity()) return;
  const data = new FormData(elements.recipeForm);
  const existingId = String(data.get('recipeId') || '');
  const existingRecipe = state.recipes.find(item => item.id === existingId);
  const recipe = {
    id: existingId || (crypto.randomUUID?.() || `recipe-${Date.now()}`),
    name: String(data.get('recipeName') || '').trim(),
    meal: String(data.get('recipeMeal') || 'breakfast'),
    ingredients: String(data.get('recipeIngredients') || '').trim(),
    calories: optionalNumber(data.get('recipeCalories')),
    protein: optionalNumber(data.get('recipeProtein')),
    carbs: optionalNumber(data.get('recipeCarbs')),
    fat: optionalNumber(data.get('recipeFat')),
    fiber: optionalNumber(data.get('recipeFiber')),
    notes: String(data.get('recipeNotes') || '').trim(),
    description: String(data.get('recipeNotes') || '').trim() || 'Receita personalizada.',
    quality: 'pending',
    qualityLabel: 'Composição a rever',
    highlights: [],
    instructions: [],
    source: 'manual',
    catalogVersion: existingRecipe?.catalogVersion,
    updatedAt: new Date().toISOString()
  };

  const index = state.recipes.findIndex(item => item.id === recipe.id);
  if (index >= 0) state.recipes[index] = recipe;
  else state.recipes.push(recipe);
  validateSelections();
  persistLocal();
  renderAll();
  elements.recipeDialog.close();
  await syncToCloud({ quiet: true });
  showToast(index >= 0 ? 'Receita atualizada.' : 'Receita criada.', 'success');
}

function deleteRecipe(id) {
  const recipe = state.recipes.find(item => item.id === id);
  if (!recipe) return;
  showConfirm(`Apagar a receita “${recipe.name}”?`, async () => {
    state.recipes = state.recipes.filter(item => item.id !== id);
    if (state.profile.selectedBreakfastId === id) state.profile.selectedBreakfastId = '';
    if (state.profile.selectedLunchId === id) state.profile.selectedLunchId = '';
    if (state.profile.selectedDinnerId === id) state.profile.selectedDinnerId = '';
    validateSelections();
    state.profile.updatedAt = new Date().toISOString();
    persistLocal();
    renderAll();
    await syncToCloud({ quiet: true });
    showToast('Receita apagada.', 'info');
  });
}

function chooseBreakfast(id) {
  state.profile.selectedBreakfastId = id;
  state.profile.selectedLunchId = '';
  state.profile.selectedDinnerId = '';
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  document.getElementById('food-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function chooseMainMeal(stage, id) {
  if (stage === 'lunch') {
    state.profile.selectedLunchId = id;
    state.profile.selectedDinnerId = '';
  } else {
    state.profile.selectedDinnerId = id;
  }
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  const target = stage === 'lunch' ? elements.dinnerStage : elements.dayBalance;
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function storeSnack(snack, successMessage = 'Lanche acrescentado e jantar recalculado.') {
  const breakfast = getSelectedBreakfast();
  const { energy, allocation } = getCurrentEnergyContext();
  if (!breakfast || !energy || !allocation) return false;
  const maximum = getMaximumSnackCalories({
    targetCalories: energy.target,
    breakfastCalories: breakfast.calories,
    lunchCalories: allocation.lunch,
    minimumDinnerCalories: 400
  });
  const currentCalories = sumNutrition(state.profile.snacks).calories;
  if (currentCalories + snack.calories > maximum) {
    showToast(`Este lanche deixaria menos de 400 kcal para jantar. Máximo disponível: ${formatCalories(Math.max(0, maximum - currentCalories))}.`, 'warning');
    return false;
  }
  state.profile.snacks.push(snack);
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  showToast(successMessage, 'success');
  return true;
}

function addPresetSnack(recipeId, variantId = 'base') {
  const recipe = state.recipes.find(item => item.id === recipeId && item.meal === 'snack');
  if (!recipe) return;
  const variant = variantId === 'base'
    ? null
    : recipe.variants?.find(item => item.id === variantId);
  if (variantId !== 'base' && !variant) return;
  const nutrition = variant || recipe;
  storeSnack({
    id: crypto.randomUUID?.() || `snack-${Date.now()}`,
    presetId: recipe.id,
    variantId,
    name: variant?.name || recipe.shortName || recipe.name,
    calories: Number(nutrition.calories) || 0,
    protein: Number(nutrition.protein) || 0,
    carbs: Number(nutrition.carbs) || 0,
    fat: Number(nutrition.fat) || 0,
    fiber: Number(nutrition.fiber) || 0
  }, `${variant?.name || recipe.shortName || recipe.name} acrescentado e jantar recalculado.`);
}

function addSnack(event) {
  event.preventDefault();
  if (!elements.snackForm.reportValidity()) return;
  const data = new FormData(elements.snackForm);
  const snack = {
    id: crypto.randomUUID?.() || `snack-${Date.now()}`,
    presetId: '',
    variantId: 'manual',
    name: String(data.get('snackName') || '').trim(),
    calories: optionalNumber(data.get('snackCalories')) || 0,
    protein: optionalNumber(data.get('snackProtein')) || 0,
    carbs: optionalNumber(data.get('snackCarbs')) || 0,
    fat: optionalNumber(data.get('snackFat')) || 0,
    fiber: optionalNumber(data.get('snackFiber')) || 0
  };
  if (storeSnack(snack)) {
    elements.snackForm.reset();
  }
}

function removeSnack(id) {
  state.profile.snacks = state.profile.snacks.filter(snack => snack.id !== id);
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
}

function handleRecipeAction(event) {
  const editButton = event.target.closest('[data-edit-recipe]');
  if (editButton) {
    openRecipeDialog(state.recipes.find(recipe => recipe.id === editButton.dataset.editRecipe));
    return true;
  }
  const deleteButton = event.target.closest('[data-delete-recipe]');
  if (deleteButton) {
    deleteRecipe(deleteButton.dataset.deleteRecipe);
    return true;
  }
  return false;
}

function bindEvents() {
  elements.addRecipe.addEventListener('click', () => openRecipeDialog());
  elements.recipeForm.addEventListener('submit', saveRecipe);
  elements.snackForm.addEventListener('submit', addSnack);
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  elements.recipeGrid.addEventListener('click', event => {
    const chooseButton = event.target.closest('[data-choose-recipe]');
    if (chooseButton) {
      chooseBreakfast(chooseButton.dataset.chooseRecipe);
      return;
    }
    handleRecipeAction(event);
  });

  elements.lunchGrid.addEventListener('click', event => {
    const chooseButton = event.target.closest('[data-choose-lunch]');
    if (chooseButton) {
      chooseMainMeal('lunch', chooseButton.dataset.chooseLunch);
      return;
    }
    handleRecipeAction(event);
  });

  elements.dinnerGrid.addEventListener('click', event => {
    const chooseButton = event.target.closest('[data-choose-dinner]');
    if (chooseButton) {
      chooseMainMeal('dinner', chooseButton.dataset.chooseDinner);
      return;
    }
    handleRecipeAction(event);
  });

  elements.snackPresetGrid.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add-snack-recipe]');
    if (addButton) {
      addPresetSnack(addButton.dataset.addSnackRecipe, addButton.dataset.snackVariant);
      return;
    }
    handleRecipeAction(event);
  });

  elements.snackList.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove-snack]');
    if (removeButton) removeSnack(removeButton.dataset.removeSnack);
  });

  elements.clearBreakfast.addEventListener('click', () => {
    state.profile.selectedBreakfastId = '';
    state.profile.selectedLunchId = '';
    state.profile.selectedDinnerId = '';
    state.profile.updatedAt = new Date().toISOString();
    persistLocal();
    renderAll();
    syncToCloud({ quiet: true });
    document.getElementById('food-recipes-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

bindEvents();
renderAll();

onAuthStateChanged(getAuth(), user => {
  state.user = user;
  if (user) {
    elements.saveState.textContent = 'A sincronizar…';
    loadRemoteProfile(user);
  } else {
    elements.saveState.textContent = 'Guardado neste dispositivo';
  }
});
