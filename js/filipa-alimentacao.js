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
  getLocalDateKey,
  recommendMainMeals
} from './alimentacao-planner.js';
import {
  FILIPA_BEDTIMES,
  FILIPA_BREAKFASTS,
  FILIPA_MAIN_MEALS,
  FILIPA_PROFILE_DEFAULTS,
  FILIPA_SNACKS,
  mergeFilipaRecipeCatalog,
  resolveFilipaRecipeVariant
} from './filipa-alimentacao-recipes.js';
import {
  FILIPA_MEAL_TARGETS,
  applyFilipaDailyPlanDate,
  calculateFilipaDailyPlan
} from './filipa-alimentacao-planner.js';

const PROFILE_VERSION = 1;
const PROFILE_STORAGE_KEY = `filipa-alimentacao-profile-v${PROFILE_VERSION}`;
const RECIPES_STORAGE_KEY = `filipa-alimentacao-recipes-v${PROFILE_VERSION}`;
const DEFAULT_RECIPE_IDS = new Set([
  ...FILIPA_BREAKFASTS,
  ...FILIPA_MAIN_MEALS,
  ...FILIPA_SNACKS,
  ...FILIPA_BEDTIMES
].map(recipe => recipe.id));

const mealLabels = {
  breakfast: 'Pequeno-almoço',
  main: 'Almoço ou jantar',
  snack: 'Lanche',
  bedtime: 'Ceia'
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

function normalizeNutritionItem(item = {}, fallbackName = 'Extra') {
  return {
    id: String(item.id || (crypto.randomUUID?.() || `item-${Date.now()}`)),
    name: String(item.name || fallbackName),
    calories: Math.max(0, Number(item.calories) || 0),
    protein: Math.max(0, Number(item.protein) || 0),
    carbs: Math.max(0, Number(item.carbs) || 0),
    fat: Math.max(0, Number(item.fat) || 0),
    fiber: Math.max(0, Number(item.fiber) || 0)
  };
}

function normalizeProfile(profile = {}) {
  let merged = { ...FILIPA_PROFILE_DEFAULTS, ...profile };
  const daily = applyFilipaDailyPlanDate(merged, getLocalDateKey());
  merged = daily.profile;
  if (daily.didReset) merged.updatedAt = new Date().toISOString();
  merged.selectedBreakfastId = String(merged.selectedBreakfastId || '');
  merged.breakfastSkipped = false;
  merged.selectedLunchId = String(merged.selectedLunchId || '');
  merged.lunchExternal = false;
  merged.selectedDinnerId = String(merged.selectedDinnerId || '');
  merged.selectedSnackId = String(merged.selectedSnackId || '');
  merged.selectedBedtimeId = String(merged.selectedBedtimeId || '');
  merged.recipeVariants = Object.fromEntries(
    Object.entries(merged.recipeVariants || {})
      .filter(([recipeId, variantId]) => recipeId && variantId)
      .map(([recipeId, variantId]) => [String(recipeId), String(variantId)])
  );
  merged.mealCalories = Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snacks'].map(key => [
    key,
    Math.max(0, Math.round(Number(merged.mealCalories?.[key]) || 0))
  ]));
  merged.extras = Array.isArray(merged.extras)
    ? merged.extras.filter(item => Number(item?.calories) > 0).map(item => normalizeNutritionItem(item))
    : [];
  return merged;
}

const storedProfile = loadStored(PROFILE_STORAGE_KEY, {});
const initialDailyResetNeeded = String(storedProfile.planDate || '') !== getLocalDateKey();
const state = {
  profile: normalizeProfile(storedProfile),
  recipes: mergeFilipaRecipeCatalog(loadStored(RECIPES_STORAGE_KEY, [])),
  user: null,
  activeMeal: 'breakfast'
};

const elements = {
  saveState: document.getElementById('food-save-state'),
  recipeGrid: document.getElementById('food-recipe-grid'),
  addRecipe: document.getElementById('food-add-recipe'),
  recipeDialog: document.getElementById('food-recipe-dialog'),
  recipeForm: document.getElementById('food-recipe-form'),
  recipeDialogTitle: document.getElementById('food-recipe-dialog-title'),
  profileTarget: document.getElementById('food-profile-target'),
  plan: document.getElementById('food-plan'),
  breakfastStage: document.getElementById('food-breakfast-stage'),
  breakfastSelection: document.getElementById('food-breakfast-selection'),
  selectedBreakfastLabel: document.getElementById('food-selected-breakfast-label'),
  selectedBreakfastName: document.getElementById('food-selected-breakfast-name'),
  selectedBreakfastBalance: document.getElementById('food-selected-breakfast-balance'),
  clearBreakfast: document.getElementById('food-clear-breakfast'),
  breakfastJumpState: document.getElementById('food-breakfast-jump-state'),
  lunchJumpState: document.getElementById('food-lunch-jump-state'),
  dinnerJumpState: document.getElementById('food-dinner-jump-state'),
  snacksJumpState: document.getElementById('food-snacks-jump-state'),
  lunchStage: document.getElementById('food-lunch-stage'),
  lunchContext: document.getElementById('food-lunch-context'),
  lunchGrid: document.getElementById('food-lunch-grid'),
  lunchCalorieTarget: document.getElementById('food-lunch-calorie-target'),
  snackStage: document.getElementById('food-snack-stage'),
  snackGrid: document.getElementById('food-snack-grid'),
  snackCalorieTarget: document.getElementById('food-snack-calorie-target'),
  dinnerStage: document.getElementById('food-dinner-stage'),
  dinnerContext: document.getElementById('food-dinner-context'),
  dinnerGrid: document.getElementById('food-dinner-grid'),
  dinnerCalorieTarget: document.getElementById('food-dinner-calorie-target'),
  bedtimeStage: document.getElementById('food-bedtime-stage'),
  bedtimeGrid: document.getElementById('food-bedtime-grid'),
  bedtimeCalorieTarget: document.getElementById('food-bedtime-calorie-target'),
  extrasStage: document.getElementById('food-extras-stage'),
  extraBudget: document.getElementById('food-extra-budget'),
  extraForm: document.getElementById('food-extra-form'),
  extraLimit: document.getElementById('food-extra-limit'),
  extraList: document.getElementById('food-extra-list'),
  energyTarget: document.getElementById('food-energy-target'),
  breakfastTarget: document.getElementById('food-breakfast-target'),
  lunchTarget: document.getElementById('food-lunch-target'),
  snackTarget: document.getElementById('food-snack-target'),
  dinnerTarget: document.getElementById('food-dinner-target'),
  bedtimeTarget: document.getElementById('food-bedtime-target'),
  extrasTarget: document.getElementById('food-extras-target'),
  energyNote: document.getElementById('food-energy-note'),
  dayBalance: document.getElementById('food-day-balance'),
  dayBalanceTitle: document.getElementById('food-day-balance-title'),
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
  summaryFat: document.getElementById('food-summary-fat'),
  settingsDialog: document.getElementById('food-settings-dialog'),
  settingsForm: document.getElementById('food-settings-form'),
  settingsCalories: document.getElementById('food-settings-calories')
};

function getRecipe(id, meal = '') {
  const recipe = state.recipes.find(item => (
    item.id === id && (!meal || item.meal === meal || (meal === 'main' && item.meal === 'main'))
  )) || null;
  return recipe
    ? resolveFilipaRecipeVariant(recipe, state.profile.recipeVariants[recipe.id] || 'base')
    : null;
}

function resolveRecipeForProfile(recipe) {
  return resolveFilipaRecipeVariant(recipe, state.profile.recipeVariants[recipe.id] || 'base');
}

function validateSelections() {
  if (!getRecipe(state.profile.selectedBreakfastId, 'breakfast')) state.profile.selectedBreakfastId = '';
  else state.profile.breakfastSkipped = false;
  if (!getRecipe(state.profile.selectedLunchId, 'main')) state.profile.selectedLunchId = '';
  else state.profile.lunchExternal = false;
  if (!getRecipe(state.profile.selectedDinnerId, 'main')) state.profile.selectedDinnerId = '';
  if (!getRecipe(state.profile.selectedSnackId, 'snack')) state.profile.selectedSnackId = '';
  if (!getRecipe(state.profile.selectedBedtimeId, 'bedtime')) state.profile.selectedBedtimeId = '';
  if (state.profile.mealCalories.breakfast > 0) state.profile.selectedBreakfastId = '';
  if (state.profile.mealCalories.lunch > 0) state.profile.selectedLunchId = '';
  if (state.profile.mealCalories.dinner > 0) state.profile.selectedDinnerId = '';
  if (state.profile.mealCalories.snacks > 0) {
    state.profile.selectedSnackId = '';
    state.profile.selectedBedtimeId = '';
    state.profile.extras = [];
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

if (initialDailyResetNeeded) persistLocal();

function remoteProfileRef(user) {
  return doc(db, 'users', user.uid, 'filipa_alimentacao', 'profile');
}

async function syncToCloud({ quiet = false } = {}) {
  if (!state.user) return false;
  try {
    await setDoc(remoteProfileRef(state.user), {
      version: PROFILE_VERSION,
      profile: state.profile,
      recipes: state.recipes,
      updatedAt: serverTimestamp()
    }, { merge: true });
    elements.saveState.textContent = 'Guardado e sincronizado';
    if (!quiet) showToast('Plano da Filipa guardado.', 'success');
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar alimentação da Filipa:', error);
    elements.saveState.textContent = 'Guardado neste dispositivo';
    if (!quiet) showToast('Guardado neste dispositivo; sincronização pendente.', 'warning');
    return false;
  }
}

async function loadRemoteProfile(user) {
  try {
    const snapshot = await getDoc(remoteProfileRef(user));
    if (!snapshot.exists()) {
      await syncToCloud({ quiet: true });
      return;
    }
    const remote = snapshot.data();
    const remoteProfile = remote.profile || {};
    const remoteNeedsReset = String(remoteProfile.planDate || '') !== getLocalDateKey();
    const localTime = Date.parse(state.profile.updatedAt || '') || 0;
    const remoteTime = remote.updatedAt?.toMillis?.() || Date.parse(remoteProfile.updatedAt || '') || 0;
    if (remoteTime >= localTime) {
      state.profile = normalizeProfile(remoteProfile);
      state.recipes = mergeFilipaRecipeCatalog(remote.recipes);
      validateSelections();
      persistLocal();
      renderAll();
      if (remoteNeedsReset) await syncToCloud({ quiet: true });
    } else {
      await syncToCloud({ quiet: true });
    }
    elements.saveState.textContent = 'Guardado e sincronizado';
  } catch (error) {
    console.error('Erro ao carregar alimentação da Filipa:', error);
    elements.saveState.textContent = 'A usar dados deste dispositivo';
  }
}

function formatCalories(value) {
  return `${new Intl.NumberFormat('pt-PT').format(Math.round(Number(value) || 0))} kcal`;
}

function formatGrams(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(number)} g`;
}

function getDailyPlan() {
  return calculateFilipaDailyPlan({
    targetCalories: state.profile.manualCalories,
    targets: FILIPA_MEAL_TARGETS,
    breakfast: getRecipe(state.profile.selectedBreakfastId, 'breakfast'),
    breakfastSkipped: state.profile.breakfastSkipped,
    lunch: getRecipe(state.profile.selectedLunchId, 'main'),
    lunchExternal: state.profile.lunchExternal,
    dinner: getRecipe(state.profile.selectedDinnerId, 'main'),
    snack: getRecipe(state.profile.selectedSnackId, 'snack'),
    bedtime: getRecipe(state.profile.selectedBedtimeId, 'bedtime'),
    extras: state.profile.extras,
    mealCalories: state.profile.mealCalories
  });
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
  const summary = document.createElement('summary');
  summary.textContent = 'Ver ingredientes e preparação';
  const meta = document.createElement('p');
  meta.className = 'food-recipe-evidence';
  meta.textContent = `${recipe.servings || 1} dose · ${recipe.prepTime || 'tempo não indicado'}${recipe.batchFriendly ? ' · adequado para preparação antecipada' : ''}`;
  const ingredientTitle = document.createElement('strong');
  ingredientTitle.textContent = 'Ingredientes da dose';
  const ingredients = document.createElement('ul');
  String(recipe.ingredients || '').split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    const item = document.createElement('li');
    item.textContent = line;
    ingredients.appendChild(item);
  });
  details.append(summary, meta, ingredientTitle, ingredients);
  if (Array.isArray(recipe.instructions) && recipe.instructions.length) {
    const title = document.createElement('strong');
    title.textContent = 'Preparação';
    const instructions = document.createElement('ol');
    recipe.instructions.forEach(line => {
      const item = document.createElement('li');
      item.textContent = line;
      instructions.appendChild(item);
    });
    details.append(title, instructions);
  }
  if (Array.isArray(recipe.cautions) && recipe.cautions.length) {
    const title = document.createElement('strong');
    title.textContent = 'Alternativas e notas';
    const notes = document.createElement('ul');
    recipe.cautions.forEach(line => {
      const item = document.createElement('li');
      item.textContent = line;
      notes.appendChild(item);
    });
    details.append(title, notes);
  }
  if (recipe.evidenceNote) {
    const evidence = document.createElement('p');
    evidence.className = 'food-recipe-evidence';
    evidence.textContent = `Base do cálculo: ${recipe.evidenceNote}`;
    details.appendChild(evidence);
  }
  return details;
}

function createRecipeVariantControl(recipe) {
  const variant = recipe.variants?.[0];
  if (!variant) return null;
  const control = document.createElement('label');
  control.className = 'food-recipe-variant';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = recipe.activeVariantId === variant.id;
  checkbox.dataset.recipeVariant = recipe.id;
  checkbox.dataset.variantId = variant.id;
  const copy = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = variant.checkboxLabel || variant.label;
  const detail = document.createElement('small');
  detail.textContent = `${variant.description} ${formatCalories(variant.calories)} · P ${formatGrams(variant.protein)} · HC ${formatGrams(variant.carbs)} · G ${formatGrams(variant.fat)}.`;
  copy.append(title, detail);
  control.append(checkbox, copy);
  return control;
}

function appendDeleteButton(actions, recipe) {
  if (DEFAULT_RECIPE_IDS.has(recipe.id)) return;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'food-recipe-delete';
  remove.dataset.deleteRecipe = recipe.id;
  remove.setAttribute('aria-label', `Apagar ${recipe.name}`);
  remove.textContent = '×';
  actions.appendChild(remove);
}

function createCardTopline(recipe, label) {
  const topline = document.createElement('div');
  topline.className = 'food-recipe-topline';
  const number = document.createElement('span');
  number.className = 'food-recipe-number';
  number.textContent = label;
  const quality = document.createElement('span');
  quality.className = `food-quality food-quality--${recipe.quality || 'manual'}`;
  quality.textContent = recipe.qualityLabel || 'Composição a rever';
  topline.append(number, quality);
  return topline;
}

function createBreakfastCard(recipe, index) {
  const selected = state.profile.selectedBreakfastId === recipe.id;
  const article = document.createElement('article');
  article.className = 'food-recipe-card food-recipe-card--custom';
  if (selected) article.dataset.selected = 'true';
  const title = document.createElement('h3');
  title.textContent = recipe.name;
  const description = document.createElement('p');
  description.className = 'food-recipe-summary';
  description.textContent = recipe.description || 'Receita pessoal.';
  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia', formatCalories(recipe.calories));
  appendMacro(macros, 'Proteína', formatGrams(recipe.protein));
  appendMacro(macros, 'Hidratos', formatGrams(recipe.carbs));
  appendMacro(macros, 'Gordura', formatGrams(recipe.fat));
  const breakfastTarget = getDailyPlan().breakfastCalories;
  const difference = Math.round(recipe.calories - breakfastTarget);
  const targetNote = document.createElement('p');
  targetNote.className = 'food-recipe-target-note';
  targetNote.dataset.state = Math.abs(difference) <= 35 ? 'ok' : 'adjust';
  targetNote.textContent = `${difference >= 0 ? '+' : ''}${difference} kcal face ao alvo aproximado de ${formatCalories(breakfastTarget)}.`;
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
  choose.className = selected ? '' : 'primary';
  choose.dataset.chooseBreakfast = recipe.id;
  choose.textContent = selected ? 'Escolhido ✓' : 'Escolher';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = recipe.id;
  edit.textContent = 'Editar';
  actions.append(choose, edit);
  appendDeleteButton(actions, recipe);
  article.append(createCardTopline(recipe, String(index + 1).padStart(2, '0')), title, description, macros, targetNote);
  if (highlights.childElementCount) article.appendChild(highlights);
  const variantControl = createRecipeVariantControl(recipe);
  if (variantControl) article.appendChild(variantControl);
  article.append(createRecipeDetails(recipe), actions);
  return article;
}

function createMainCard(recommendation, stage, index) {
  const { meal, adjusted, reason } = recommendation;
  const selectedId = stage === 'lunch' ? state.profile.selectedLunchId : state.profile.selectedDinnerId;
  const selected = selectedId === meal.id;
  const article = document.createElement('article');
  article.className = 'food-recipe-card food-main-meal-card';
  if (selected) article.dataset.selected = 'true';
  const title = document.createElement('h4');
  title.textContent = meal.name;
  const description = document.createElement('p');
  description.className = 'food-recipe-summary';
  description.textContent = meal.description || 'Receita pessoal.';
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
    portion.textContent = `${formatCalories(meal.calories)} na dose base · usar ≈${formatGrams(adjusted.adjustedQuantity)} de ${adjusted.adjustmentLabel}, mantendo os restantes ingredientes.`;
  } else {
    portion.textContent = `${formatCalories(meal.calories)} na dose base · usar ${adjusted.servingFactor}× a receita.`;
  }
  if (meal.scaleHint) portion.textContent += ` ${meal.scaleHint}`;
  if (!adjusted.isPracticalPortion) portion.dataset.state = 'warning';
  const actions = document.createElement('div');
  actions.className = 'food-recipe-actions';
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = selected ? '' : 'primary';
  choose.dataset.chooseMain = meal.id;
  choose.dataset.mainStage = stage;
  choose.textContent = selected ? 'Escolhido ✓' : 'Escolher';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = meal.id;
  edit.textContent = 'Editar';
  actions.append(choose, edit);
  appendDeleteButton(actions, meal);
  article.append(
    createCardTopline(meal, index === 0 ? 'Recomendado' : `${index + 1}.ª opção`),
    title,
    description,
    reasonText,
    macros,
    portion
  );
  const variantControl = createRecipeVariantControl(meal);
  if (variantControl) article.appendChild(variantControl);
  article.append(createRecipeDetails(meal), actions);
  return article;
}

function createSlotCard(recipe, slot, index) {
  const field = slot === 'snack' ? 'selectedSnackId' : 'selectedBedtimeId';
  const selected = state.profile[field] === recipe.id;
  const plan = getDailyPlan();
  const target = slot === 'snack' ? plan.snackCalories : plan.bedtimeCalories;
  const article = document.createElement('article');
  article.className = 'food-snack-preset-card';
  if (selected) article.dataset.selected = 'true';
  const title = document.createElement('h4');
  title.textContent = recipe.name;
  const description = document.createElement('p');
  description.className = 'food-recipe-summary';
  description.textContent = recipe.description || 'Receita pessoal.';
  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia', formatCalories(recipe.calories));
  appendMacro(macros, 'Proteína', formatGrams(recipe.protein));
  appendMacro(macros, 'Hidratos', formatGrams(recipe.carbs));
  appendMacro(macros, 'Fibra', formatGrams(recipe.fiber));
  const difference = Math.round(recipe.calories - target);
  const note = document.createElement('p');
  note.className = 'food-snack-preset-reason';
  note.textContent = `${difference >= 0 ? '+' : ''}${difference} kcal face ao alvo de ${formatCalories(target)}.`;
  const actions = document.createElement('div');
  actions.className = 'food-snack-preset-actions';
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = selected ? '' : 'primary';
  choose.dataset.chooseSlot = recipe.id;
  choose.dataset.slot = slot;
  choose.textContent = selected ? 'Escolhido ✓' : 'Escolher';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = recipe.id;
  edit.textContent = 'Editar';
  actions.append(choose, edit);
  appendDeleteButton(actions, recipe);
  article.append(
    createCardTopline(recipe, String(index + 1).padStart(2, '0')),
    title,
    description,
    macros,
    note
  );
  const variantControl = createRecipeVariantControl(recipe);
  if (variantControl) article.appendChild(variantControl);
  article.append(createRecipeDetails(recipe), actions);
  return article;
}

function renderBreakfasts() {
  elements.recipeGrid.replaceChildren();
  state.recipes.filter(recipe => recipe.meal === 'breakfast' && Number(recipe.calories) > 0)
    .map(resolveRecipeForProfile)
    .forEach((recipe, index) => elements.recipeGrid.appendChild(createBreakfastCard(recipe, index)));
}

function getMainRecommendations(stage, target) {
  return recommendMainMeals(
    state.recipes
      .filter(recipe => recipe.meal === 'main' && Number(recipe.calories) > 0)
      .map(resolveRecipeForProfile),
    {
      calorieTarget: target,
      consumedNutrition: getDailyPlan().selectedNutrition,
      breakfastId: state.profile.selectedBreakfastId,
      excludedIds: [],
      mealSlotsRemaining: stage === 'lunch' ? 2 : 1,
      dailyProteinTarget: 108,
      dailyFiberTarget: 25
    }
  );
}

function renderMainGrid(stage, target) {
  const grid = stage === 'lunch' ? elements.lunchGrid : elements.dinnerGrid;
  grid.replaceChildren();
  getMainRecommendations(stage, target).forEach((recommendation, index) => {
    grid.appendChild(createMainCard(recommendation, stage, index));
  });
}

function renderSlotGrid(slot) {
  const grid = slot === 'snack' ? elements.snackGrid : elements.bedtimeGrid;
  grid.replaceChildren();
  state.recipes.filter(recipe => recipe.meal === slot && Number(recipe.calories) > 0)
    .map(resolveRecipeForProfile)
    .forEach((recipe, index) => grid.appendChild(createSlotCard(recipe, slot, index)));
}

function renderBreakfastSelection(plan) {
  const selected = getRecipe(state.profile.selectedBreakfastId, 'breakfast');
  const enteredCalories = state.profile.mealCalories.breakfast;
  if (!selected && !enteredCalories) {
    elements.breakfastSelection.hidden = true;
    return;
  }
  elements.breakfastSelection.hidden = false;
  elements.breakfastSelection.dataset.state = 'selected';
  elements.selectedBreakfastLabel.textContent = enteredCalories ? 'Total registado' : 'Pequeno-almoço escolhido';
  elements.selectedBreakfastName.textContent = enteredCalories ? formatCalories(enteredCalories) : selected.name;
  elements.selectedBreakfastBalance.textContent = enteredCalories
    ? 'Valor real registado · as próximas refeições foram recalculadas.'
    : `${formatCalories(selected.calories)} confirmadas · o restante plano foi recalculado.`;
  elements.clearBreakfast.textContent = enteredCalories ? 'Escolher receita' : 'Alterar escolha';
}

function renderMealJumpStates() {
  const manual = state.profile.mealCalories;
  const snack = getRecipe(state.profile.selectedSnackId, 'snack');
  const bedtime = getRecipe(state.profile.selectedBedtimeId, 'bedtime');
  const snackCalories = manual.snacks || (
    Number(snack?.calories || 0)
    + Number(bedtime?.calories || 0)
    + state.profile.extras.reduce((sum, item) => sum + Number(item.calories || 0), 0)
  );
  const states = [
    [elements.breakfastJumpState, getRecipe(state.profile.selectedBreakfastId, 'breakfast'), manual.breakfast ? formatCalories(manual.breakfast) : 'Por escolher', manual.breakfast ? 'selected' : 'pending'],
    [elements.lunchJumpState, getRecipe(state.profile.selectedLunchId, 'main'), manual.lunch ? formatCalories(manual.lunch) : 'Por escolher', manual.lunch ? 'selected' : 'pending'],
    [elements.dinnerJumpState, getRecipe(state.profile.selectedDinnerId, 'main'), manual.dinner ? formatCalories(manual.dinner) : 'Por escolher', manual.dinner ? 'selected' : 'pending'],
    [elements.snacksJumpState, null, snackCalories ? formatCalories(snackCalories) : 'Por escolher', snackCalories ? 'selected' : 'pending']
  ];
  const buttons = Array.from(document.querySelectorAll('[data-food-meal-jump]'));
  states.forEach(([element, recipe, fallback, fallbackState], index) => {
    element.textContent = recipe ? (recipe.shortName || recipe.name) : fallback;
    buttons[index]?.setAttribute('data-state', recipe ? 'selected' : fallbackState);
  });
}

function renderEnergyPlan(plan) {
  elements.energyTarget.textContent = formatCalories(plan.targetCalories);
  elements.breakfastTarget.textContent = formatCalories(plan.breakfastCalories);
  elements.lunchTarget.textContent = formatCalories(plan.lunchCalories);
  elements.snackTarget.textContent = formatCalories(plan.snackCalories);
  elements.dinnerTarget.textContent = formatCalories(plan.dinnerCalories);
  elements.bedtimeTarget.textContent = formatCalories(plan.bedtimeCalories);
  elements.extrasTarget.textContent = formatCalories(plan.extraBudget);
  elements.lunchCalorieTarget.textContent = `Meta · ${formatCalories(plan.lunchCalories)}`;
  elements.snackCalorieTarget.textContent = `Meta · ${formatCalories(plan.snackCalories)}`;
  elements.dinnerCalorieTarget.textContent = `Meta · ${formatCalories(plan.dinnerCalories)}`;
  elements.bedtimeCalorieTarget.textContent = `Meta · ${formatCalories(plan.bedtimeCalories)}`;
  if (plan.hasExtraOverflow) {
    elements.energyNote.textContent = `Os extras ultrapassam a margem em ${formatCalories(Math.abs(plan.extrasRemaining))}; o jantar foi reduzido para compensar.`;
  } else if (Object.values(state.profile.mealCalories).some(value => value > 0)) {
    elements.energyNote.textContent = 'As kcal registadas são tratadas como valores reais; as restantes metas foram recalculadas.';
  } else {
    elements.energyNote.textContent = 'A margem de extras já faz parte da meta diária. As porções do almoço e jantar usam pesos cozinhados.';
  }
}

function renderExtras(plan) {
  if (state.profile.mealCalories.snacks > 0) {
    elements.extraBudget.textContent = 'Incluídos no total';
    elements.extraLimit.textContent = `${formatCalories(state.profile.mealCalories.snacks)} registadas para todos os lanches, ceia e extras.`;
    elements.extraList.replaceChildren();
    const summary = document.createElement('p');
    summary.className = 'food-snack-empty';
    summary.textContent = 'Limpa o total dos lanches se quiseres voltar a escolher opções individuais.';
    elements.extraList.appendChild(summary);
    return;
  }
  elements.extraBudget.textContent = plan.extrasRemaining >= 0
    ? `${formatCalories(plan.extrasRemaining)} disponíveis`
    : `${formatCalories(Math.abs(plan.extrasRemaining))} acima da margem`;
  elements.extraBudget.dataset.state = plan.extrasRemaining < 0 ? 'warning' : 'ok';
  elements.extraLimit.textContent = plan.extrasRemaining >= 0
    ? `Usadas ${formatCalories(plan.extraTotals.calories)} das ${formatCalories(plan.extraBudget)} aprovadas.`
    : `A margem foi ultrapassada; o jantar é recalculado, mas o total real continua registado.`;
  elements.extraList.replaceChildren();
  if (!state.profile.extras.length) {
    const empty = document.createElement('p');
    empty.className = 'food-snack-empty';
    empty.textContent = `Ainda não adicionaste extras. Mantemos ${formatCalories(plan.extraBudget)} reservadas.`;
    elements.extraList.appendChild(empty);
    return;
  }
  state.profile.extras.forEach(extra => {
    const item = document.createElement('article');
    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = extra.name;
    const macros = document.createElement('small');
    macros.textContent = `${formatCalories(extra.calories)} · P ${formatGrams(extra.protein)} · HC ${formatGrams(extra.carbs)} · G ${formatGrams(extra.fat)}`;
    text.append(name, macros);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.removeExtra = extra.id;
    remove.textContent = 'Remover';
    item.append(text, remove);
    elements.extraList.appendChild(item);
  });
}

function renderDayBalance(plan) {
  const progress = Math.min(100, (plan.confirmedCalories / plan.targetCalories) * 100);
  elements.dayProgressBar.style.width = `${progress}%`;
  elements.dayProgress.setAttribute('aria-valuemax', String(plan.targetCalories));
  elements.dayProgress.setAttribute('aria-valuenow', String(plan.confirmedCalories));
  elements.dayConfirmed.textContent = formatCalories(plan.confirmedCalories);
  elements.dayReserved.textContent = formatCalories(plan.reservedCalories);
  elements.dayTarget.textContent = formatCalories(plan.targetCalories);
  elements.dayBalanceTitle.textContent = `Fechar as ${formatCalories(plan.targetCalories)}`;
  elements.dayBalanceValue.textContent = `${formatCalories(plan.plannedCalories)} planeadas`;
  const missing = [];
  if (!getRecipe(state.profile.selectedBreakfastId, 'breakfast') && !state.profile.mealCalories.breakfast) missing.push('pequeno-almoço');
  if (!getRecipe(state.profile.selectedLunchId, 'main') && !state.profile.mealCalories.lunch) missing.push('almoço');
  if (!state.profile.mealCalories.snacks && !getRecipe(state.profile.selectedSnackId, 'snack')) missing.push('lanche');
  if (!getRecipe(state.profile.selectedDinnerId, 'main') && !state.profile.mealCalories.dinner) missing.push('jantar');
  if (!state.profile.mealCalories.snacks && !getRecipe(state.profile.selectedBedtimeId, 'bedtime')) missing.push('ceia');
  if (plan.hasExtraOverflow) {
    elements.dayBalanceNote.textContent = `A margem de extras foi ultrapassada em ${formatCalories(Math.abs(plan.extrasRemaining))}. O jantar foi ajustado; revê o plano se a porção ficar demasiado pequena.`;
  } else if (missing.length) {
    elements.dayBalanceNote.textContent = `Por escolher: ${missing.join(', ')}. As calorias correspondentes e a margem de extras continuam reservadas.`;
  } else {
    elements.dayBalanceNote.textContent = `Plano completo, com ${formatCalories(plan.extrasRemaining)} ainda disponíveis na margem de extras.`;
  }
  const impractical = [plan.adjustedLunch, plan.adjustedDinner].filter(Boolean).some(meal => !meal.isPracticalPortion);
  elements.dayBalance.dataset.state = (plan.hasExtraOverflow || impractical)
    ? 'review'
    : (plan.allMealsResolved ? 'ok' : 'pending');
}

function renderMacroSummary(plan) {
  const totals = plan.selectedNutrition;
  if (!totals.calories) {
    elements.summaryTitle.textContent = 'Totais selecionados';
    elements.summaryCalories.textContent = '—';
    elements.summaryProtein.textContent = '—';
    elements.summaryCarbs.textContent = '—';
    elements.summaryFat.textContent = '—';
    return;
  }
  elements.summaryTitle.textContent = plan.allMealsResolved ? 'Totais conhecidos do dia' : 'Totais já selecionados';
  elements.summaryCalories.textContent = formatCalories(totals.calories);
  elements.summaryProtein.textContent = formatGrams(totals.protein);
  elements.summaryCarbs.textContent = formatGrams(totals.carbs);
  elements.summaryFat.textContent = formatGrams(totals.fat);
}

function renderMealCalorieForms() {
  document.querySelectorAll('[data-meal-calorie-form]').forEach(form => {
    const meal = form.dataset.mealCalorieForm;
    const calories = state.profile.mealCalories[meal] || 0;
    const input = form.elements.mealCalories;
    const clear = form.querySelector('[data-clear-meal-calories]');
    const status = form.querySelector('[data-meal-calorie-status]');
    input.value = calories || '';
    clear.hidden = !calories;
    status.textContent = calories ? `${formatCalories(calories)} registadas` : '';
  });
}

function enhanceRecipeCards() {
  document.querySelectorAll('.food-recipe-card, .food-main-meal-card, .food-snack-preset-card').forEach((card, index) => {
    if (card.dataset.foodCollapsible === 'true') return;
    const title = Array.from(card.children).find(child => child.matches('h3, h4'));
    if (!title) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'food-card-toggle';
    toggle.dataset.foodCardToggle = '';
    toggle.setAttribute('aria-expanded', 'false');
    const bodyId = `filipa-food-card-body-${index}`;
    toggle.setAttribute('aria-controls', bodyId);
    const label = document.createElement('span');
    label.textContent = title.textContent;
    const icon = document.createElement('span');
    icon.className = 'food-card-toggle-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '+';
    toggle.append(label, icon);
    const body = document.createElement('div');
    body.className = 'food-card-body';
    body.id = bodyId;
    body.hidden = true;
    Array.from(card.children).forEach(child => {
      if (child !== title) body.appendChild(child);
    });
    title.remove();
    card.replaceChildren(toggle, body);
    card.dataset.foodCollapsible = 'true';
  });
}

function applyActiveMealView() {
  const active = state.activeMeal;
  elements.plan.classList.add('food-plan--focused');
  elements.breakfastStage.hidden = active !== 'breakfast';
  elements.plan.hidden = active === 'breakfast';
  elements.lunchStage.hidden = active !== 'lunch';
  elements.dinnerStage.hidden = active !== 'dinner';
  const snacksActive = active === 'snacks';
  [elements.snackStage, elements.bedtimeStage, elements.extrasStage].forEach(stage => {
    stage.hidden = !snacksActive;
    if (snacksActive && !stage.dataset.foodSubstageTouched) stage.dataset.collapsed = 'true';
    stage.querySelector(':scope > .food-meal-stage-heading')
      ?.setAttribute('aria-expanded', String(stage.dataset.collapsed !== 'true'));
  });
  document.getElementById('food-energy-result').hidden = true;
  elements.breakfastSelection.hidden = true;
  elements.dayBalance.hidden = true;
  elements.plan.querySelector(':scope > .food-section-heading')?.setAttribute('hidden', '');
}

function renderAll() {
  validateSelections();
  const plan = getDailyPlan();
  renderBreakfasts();
  renderBreakfastSelection(plan);
  renderMealJumpStates();
  renderEnergyPlan(plan);
  renderMainGrid('lunch', plan.lunchCalories);
  renderSlotGrid('snack');
  renderMainGrid('dinner', plan.dinnerCalories);
  renderSlotGrid('bedtime');
  renderExtras(plan);
  renderDayBalance(plan);
  renderMacroSummary(plan);
  elements.lunchContext.textContent = state.profile.mealCalories.lunch
    ? `${formatCalories(state.profile.mealCalories.lunch)} registadas; a recomendação seguinte já usa este valor.`
    : 'As quatro receitas são adequadas para meal prep e usam pesos cozinhados.';
  elements.dinnerContext.textContent = `Podes repetir o almoço. A dose do jantar está ajustada para ${formatCalories(plan.dinnerCalories)}.`;
  elements.profileTarget.textContent = `Base diária · ${formatCalories(plan.targetCalories)}`;
  renderMealCalorieForms();
  enhanceRecipeCards();
  applyActiveMealView();
}

function touchAndRender() {
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
}

function setActiveMealJump(stage) {
  document.querySelectorAll('[data-food-meal-jump]').forEach(button => {
    if (button.dataset.foodMealJump === stage) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

function jumpToMeal(stage) {
  const targets = {
    breakfast: elements.breakfastStage,
    lunch: elements.plan,
    dinner: elements.plan,
    snacks: elements.plan
  };
  state.activeMeal = stage;
  setActiveMealJump(stage);
  applyActiveMealView();
  targets[stage]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function chooseBreakfast(id) {
  state.profile.selectedBreakfastId = id;
  state.profile.mealCalories.breakfast = 0;
  touchAndRender();
  jumpToMeal('lunch');
}

function chooseMain(stage, id) {
  if (stage === 'lunch') {
    state.profile.selectedLunchId = id;
    state.profile.mealCalories.lunch = 0;
    touchAndRender();
    jumpToMeal('dinner');
  } else {
    state.profile.selectedDinnerId = id;
    state.profile.mealCalories.dinner = 0;
    touchAndRender();
    jumpToMeal('snacks');
  }
}

function chooseSlot(slot, id) {
  state.profile.mealCalories.snacks = 0;
  const field = slot === 'snack' ? 'selectedSnackId' : 'selectedBedtimeId';
  state.profile[field] = state.profile[field] === id ? '' : id;
  touchAndRender();
  if (state.profile[field]) jumpToMeal('snacks');
}

function setRecipeVariant(recipeId, variantId, enabled) {
  const selections = { ...state.profile.recipeVariants };
  if (enabled) selections[recipeId] = variantId;
  else delete selections[recipeId];
  state.profile.recipeVariants = selections;
  const recipe = state.recipes.find(item => item.id === recipeId);
  const variant = recipe?.variants?.find(item => item.id === variantId);
  touchAndRender();
  showToast(
    enabled
      ? `${variant?.label || 'Alternativa'} selecionada; ingredientes e macros atualizados.`
      : 'Mozzarella ralada reposta; ingredientes e macros atualizados.',
    'success'
  );
}

function optionalNumber(value) {
  if (String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addExtra(event) {
  event.preventDefault();
  if (!elements.extraForm.reportValidity()) return;
  const data = new FormData(elements.extraForm);
  const extra = normalizeNutritionItem({
    name: String(data.get('extraName') || '').trim(),
    calories: optionalNumber(data.get('extraCalories')) || 0,
    protein: optionalNumber(data.get('extraProtein')) || 0,
    carbs: optionalNumber(data.get('extraCarbs')) || 0,
    fat: optionalNumber(data.get('extraFat')) || 0,
    fiber: optionalNumber(data.get('extraFiber')) || 0
  });
  state.profile.mealCalories.snacks = 0;
  state.profile.extras.push(extra);
  elements.extraForm.reset();
  touchAndRender();
  const plan = getDailyPlan();
  showToast(
    plan.hasExtraOverflow
      ? 'Extra registado. A margem foi ultrapassada e o jantar foi recalculado.'
      : 'Extra registado dentro da margem diária.',
    plan.hasExtraOverflow ? 'warning' : 'success'
  );
}

function removeExtra(id) {
  state.profile.extras = state.profile.extras.filter(extra => extra.id !== id);
  touchAndRender();
}

function saveMealCalories(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const meal = form.dataset.mealCalorieForm;
  const calories = Math.max(0, Math.round(Number(new FormData(form).get('mealCalories')) || 0));
  if (!meal || !calories) return;
  state.profile.mealCalories[meal] = calories;
  if (meal === 'breakfast') state.profile.selectedBreakfastId = '';
  if (meal === 'lunch') state.profile.selectedLunchId = '';
  if (meal === 'dinner') state.profile.selectedDinnerId = '';
  if (meal === 'snacks') {
    state.profile.selectedSnackId = '';
    state.profile.selectedBedtimeId = '';
    state.profile.extras = [];
  }
  touchAndRender();
  showToast(`${formatCalories(calories)} registadas. As próximas metas foram recalculadas.`, 'success');
  const next = { breakfast: 'lunch', lunch: 'dinner', dinner: 'snacks', snacks: 'snacks' }[meal];
  if (next) jumpToMeal(next);
}

function clearMealCalories(meal) {
  if (!Object.prototype.hasOwnProperty.call(state.profile.mealCalories, meal)) return;
  state.profile.mealCalories[meal] = 0;
  touchAndRender();
}

function openSettings() {
  elements.settingsCalories.value = state.profile.manualCalories;
  elements.settingsDialog.showModal();
  requestAnimationFrame(() => elements.settingsCalories.focus());
}

function saveSettings(event) {
  event.preventDefault();
  if (!elements.settingsForm.reportValidity()) return;
  state.profile.manualCalories = Math.round(Number(elements.settingsCalories.value));
  state.profile.calculationMode = 'manual';
  elements.settingsDialog.close();
  touchAndRender();
  showToast(`Meta diária atualizada para ${formatCalories(state.profile.manualCalories)}.`, 'success');
}

function openRecipeDialog(recipe = null) {
  elements.recipeForm.reset();
  elements.recipeDialogTitle.textContent = recipe ? 'Editar receita' : 'Criar receita';
  if (recipe) {
    const form = elements.recipeForm.elements;
    form.recipeId.value = recipe.id;
    form.recipeName.value = recipe.name;
    form.recipeMeal.value = recipe.meal;
    form.recipeIngredients.value = recipe.ingredients;
    form.recipeCalories.value = recipe.calories ?? '';
    form.recipeProtein.value = recipe.protein ?? '';
    form.recipeCarbs.value = recipe.carbs ?? '';
    form.recipeFat.value = recipe.fat ?? '';
    form.recipeFiber.value = recipe.fiber ?? '';
    form.recipeNotes.value = recipe.notes || (recipe.instructions || []).join('\n');
  }
  elements.recipeDialog.showModal();
  requestAnimationFrame(() => elements.recipeForm.elements.recipeName.focus());
}

async function saveRecipe(event) {
  event.preventDefault();
  if (!elements.recipeForm.reportValidity()) return;
  const data = new FormData(elements.recipeForm);
  const existingId = String(data.get('recipeId') || '');
  const existing = state.recipes.find(recipe => recipe.id === existingId);
  const notes = String(data.get('recipeNotes') || '').trim();
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
    description: notes || 'Receita personalizada.',
    notes,
    instructions: notes ? notes.split('\n').filter(Boolean) : [],
    cautions: [],
    highlights: [],
    prepTime: existing?.prepTime || 'Não indicado',
    servings: 1,
    quality: 'pending',
    qualityLabel: 'Composição a rever',
    source: 'manual',
    catalogVersion: existing?.catalogVersion,
    updatedAt: new Date().toISOString()
  };
  const index = state.recipes.findIndex(item => item.id === recipe.id);
  if (index >= 0) state.recipes[index] = recipe;
  else state.recipes.push(recipe);
  validateSelections();
  elements.recipeDialog.close();
  touchAndRender();
  showToast(index >= 0 ? 'Receita atualizada.' : 'Receita criada.', 'success');
}

function deleteRecipe(id) {
  const recipe = state.recipes.find(item => item.id === id);
  if (!recipe || DEFAULT_RECIPE_IDS.has(id)) return;
  showConfirm(`Apagar a receita “${recipe.name}”?`, () => {
    state.recipes = state.recipes.filter(item => item.id !== id);
    validateSelections();
    touchAndRender();
    showToast('Receita apagada.', 'info');
  });
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
  elements.settingsForm.addEventListener('submit', saveSettings);
  elements.extraForm.addEventListener('submit', addExtra);
  document.querySelectorAll('[data-meal-calorie-form]').forEach(form => form.addEventListener('submit', saveMealCalories));
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  document.querySelectorAll('[data-food-snack-substage] > .food-meal-stage-heading').forEach(heading => {
    heading.setAttribute('role', 'button');
    heading.setAttribute('tabindex', '0');
    heading.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      heading.click();
    });
  });
  elements.recipeGrid.addEventListener('click', event => {
    const choose = event.target.closest('[data-choose-breakfast]');
    if (choose) chooseBreakfast(choose.dataset.chooseBreakfast);
    else handleRecipeAction(event);
  });
  [elements.lunchGrid, elements.dinnerGrid].forEach(grid => {
    grid.addEventListener('click', event => {
      const choose = event.target.closest('[data-choose-main]');
      if (choose) chooseMain(choose.dataset.mainStage, choose.dataset.chooseMain);
      else handleRecipeAction(event);
    });
  });
  [elements.snackGrid, elements.bedtimeGrid].forEach(grid => {
    grid.addEventListener('click', event => {
      const choose = event.target.closest('[data-choose-slot]');
      if (choose) chooseSlot(choose.dataset.slot, choose.dataset.chooseSlot);
      else handleRecipeAction(event);
    });
  });
  elements.extraList.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-extra]');
    if (remove) removeExtra(remove.dataset.removeExtra);
  });
  document.querySelector('.food-meal-switcher')?.addEventListener('click', event => {
    const button = event.target.closest('[data-food-meal-jump]');
    if (button) jumpToMeal(button.dataset.foodMealJump);
  });
  document.querySelector('[data-food-settings-open]')?.addEventListener('click', openSettings);
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-food-card-toggle]');
    if (toggle) {
      const body = document.getElementById(toggle.getAttribute('aria-controls'));
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.querySelector('.food-card-toggle-icon').textContent = expanded ? '+' : '−';
      if (body) body.hidden = expanded;
      return;
    }
    const clear = event.target.closest('[data-clear-meal-calories]');
    if (clear) {
      clearMealCalories(clear.dataset.clearMealCalories);
      return;
    }
    const heading = event.target.closest('[data-food-snack-substage] > .food-meal-stage-heading');
    if (heading) {
      const stage = heading.parentElement;
      stage.dataset.foodSubstageTouched = 'true';
      stage.dataset.collapsed = stage.dataset.collapsed === 'true' ? 'false' : 'true';
      heading.setAttribute('aria-expanded', String(stage.dataset.collapsed !== 'true'));
    }
  });
  document.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-recipe-variant]');
    if (!checkbox) return;
    setRecipeVariant(checkbox.dataset.recipeVariant, checkbox.dataset.variantId, checkbox.checked);
  });
  elements.clearBreakfast.addEventListener('click', () => {
    state.profile.selectedBreakfastId = '';
    state.profile.mealCalories.breakfast = 0;
    touchAndRender();
    jumpToMeal('breakfast');
  });
}

let dailyResetTimeoutId;

function scheduleDailyReset() {
  clearTimeout(dailyResetTimeoutId);
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  dailyResetTimeoutId = setTimeout(() => resetDailyPlanIfNeeded({ notify: true }), nextDay - now);
}

function resetDailyPlanIfNeeded({ notify = false } = {}) {
  const daily = applyFilipaDailyPlanDate(state.profile, getLocalDateKey());
  if (!daily.didReset) {
    scheduleDailyReset();
    return false;
  }
  state.profile = normalizeProfile({ ...daily.profile, updatedAt: new Date().toISOString() });
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  scheduleDailyReset();
  if (notify) showToast('Novo dia: escolhas e extras foram limpos.', 'info');
  return true;
}

bindEvents();
renderAll();
scheduleDailyReset();

window.addEventListener('focus', () => resetDailyPlanIfNeeded({ notify: true }));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resetDailyPlanIfNeeded({ notify: true });
});

onAuthStateChanged(getAuth(), user => {
  state.user = user;
  if (user) {
    elements.saveState.textContent = 'A sincronizar…';
    loadRemoteProfile(user);
  } else {
    elements.saveState.textContent = 'Guardado neste dispositivo';
  }
});
