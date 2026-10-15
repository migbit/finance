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
import { PROFILE_VERSION } from './alimentacao-core.js';
import {
  DEFAULT_BREAKFASTS,
  DEFAULT_MAIN_MEALS,
  DEFAULT_SNACKS,
  MIGUEL_PROFILE_DEFAULTS,
  getBreakfastProteinTarget,
  updateRecipeDetails,
  mergeRecipeCatalog,
  resolveRecipeVariant
} from './alimentacao-recipes.js';
import {
  applyDailyPlanDate,
  calculateRecordedPlan,
  getLocalDateKey,
  normalizeConsumedMeals,
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
  let merged = { ...MIGUEL_PROFILE_DEFAULTS, ...profile };
  const dailyPlan = applyDailyPlanDate(merged, getLocalDateKey());
  merged = dailyPlan.profile;
  if (dailyPlan.didReset) merged.updatedAt = new Date().toISOString();
  merged.selectedBreakfastId = String(merged.selectedBreakfastId || '');
  merged.selectedBreakfastVariantId = String(merged.selectedBreakfastVariantId || 'base');
  merged.breakfastSkipped = false;
  merged.selectedLunchId = String(merged.selectedLunchId || '');
  merged.lunchExternal = false;
  merged.selectedDinnerId = String(merged.selectedDinnerId || '');
  merged.consumedMeals = normalizeConsumedMeals(merged.consumedMeals);
  merged.mealCalories = Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snacks'].map(key => [
    key,
    Math.max(0, Math.round(Number(merged.mealCalories?.[key]) || 0))
  ]));
  merged.snacks = Array.isArray(merged.snacks)
    ? merged.snacks.filter(snack => snack && Number(snack.calories) > 0).map(snack => ({
      id: String(snack.id || `snack-${Date.now()}`),
      name: String(snack.name || 'Lanche'),
      calories: Number(snack.calories) || 0,
      protein: snack.protein == null ? null : Number(snack.protein) || 0,
      carbs: snack.carbs == null ? null : Number(snack.carbs) || 0,
      fat: snack.fat == null ? null : Number(snack.fat) || 0,
      fiber: snack.fiber == null ? null : Number(snack.fiber) || 0,
      presetId: String(snack.presetId || ''),
      variantId: String(snack.variantId || 'base')
    }))
    : [];
  return merged;
}

const storedProfile = loadStored(PROFILE_STORAGE_KEY, {});
const initialDailyResetNeeded = String(storedProfile.planDate || '') !== getLocalDateKey();
const state = {
  profile: normalizeProfile(storedProfile),
  recipes: mergeRecipeCatalog(loadStored(RECIPES_STORAGE_KEY, [])),
  user: null,
  activeMeal: 'breakfast',
  variantPreviews: {}
};

const elements = {
  saveState: document.getElementById('food-save-state'),
  recipeGrid: document.getElementById('food-recipe-grid'),
  profileTarget: document.getElementById('food-profile-target'),
  plan: document.getElementById('food-plan'),
  breakfastStage: document.getElementById('food-breakfast-stage'),
  addRecipe: document.getElementById('food-add-recipe'),
  recipeDialog: document.getElementById('food-recipe-dialog'),
  recipeForm: document.getElementById('food-recipe-form'),
  recipeDialogTitle: document.getElementById('food-recipe-dialog-title'),
  breakfastJumpState: document.getElementById('food-breakfast-jump-state'),
  lunchJumpState: document.getElementById('food-lunch-jump-state'),
  dinnerJumpState: document.getElementById('food-dinner-jump-state'),
  snacksJumpState: document.getElementById('food-snacks-jump-state'),
  lunchStage: document.getElementById('food-lunch-stage'),
  lunchGrid: document.getElementById('food-lunch-grid'),
  dinnerStage: document.getElementById('food-dinner-stage'),
  dinnerGrid: document.getElementById('food-dinner-grid'),
  snacksStage: document.getElementById('food-snacks-stage'),
  snackBudget: document.getElementById('food-snack-budget'),
  snackPresetGrid: document.getElementById('food-snack-preset-grid'),
  snackForm: document.getElementById('food-snack-form'),
  snackLimit: document.getElementById('food-snack-limit'),
  snackList: document.getElementById('food-snack-list'),
  summaryTitle: document.getElementById('food-macro-summary-title'),
  summaryCalories: document.getElementById('food-summary-calories'),
  summaryProtein: document.getElementById('food-summary-protein'),
  summaryCarbs: document.getElementById('food-summary-carbs'),
  summaryFat: document.getElementById('food-summary-fat'),
};

function recipeSupportsStage(recipe, stage) {
  if (!recipe) return false;
  return recipe.meal === 'main' || recipe.meal === stage;
}

function validateSelections() {
  const breakfast = state.recipes.find(recipe => recipe.id === state.profile.selectedBreakfastId);
  if (!breakfast || breakfast.meal !== 'breakfast') {
    state.profile.selectedBreakfastId = '';
  } else {
    state.profile.breakfastSkipped = false;
  }

  const lunch = state.recipes.find(recipe => recipe.id === state.profile.selectedLunchId);
  if (!recipeSupportsStage(lunch, 'lunch')) {
    state.profile.selectedLunchId = '';
  } else {
    state.profile.lunchExternal = false;
  }

  const dinner = state.recipes.find(recipe => recipe.id === state.profile.selectedDinnerId);
  if (!recipeSupportsStage(dinner, 'dinner')) {
    state.profile.selectedDinnerId = '';
  }

  if (!breakfast?.variants?.some(variant => variant.id === state.profile.selectedBreakfastVariantId)) {
    state.profile.selectedBreakfastVariantId = 'base';
  }
  if (state.profile.mealCalories.breakfast > 0) state.profile.selectedBreakfastId = '';
  if (state.profile.mealCalories.lunch > 0) state.profile.selectedLunchId = '';
  if (state.profile.mealCalories.dinner > 0) state.profile.selectedDinnerId = '';
  if (state.profile.mealCalories.snacks > 0) state.profile.snacks = [];
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
    const remoteNeedsDailyReset = String(remoteProfile.planDate || '') !== getLocalDateKey();
    const localTime = Date.parse(state.profile.updatedAt || '') || 0;
    const remoteTime = remote.updatedAt?.toMillis?.() || Date.parse(remoteProfile.updatedAt || '') || 0;
    if (remoteTime >= localTime) {
      state.profile = normalizeProfile(remoteProfile);
      state.recipes = mergeRecipeCatalog(remote.recipes);
      validateSelections();
      persistLocal();
      renderAll();
      if (remoteNeedsDailyReset) await syncToCloud({ quiet: true });
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



function getSelectedRecipe(field) {
  return state.recipes.find(recipe => recipe.id === state.profile[field]) || null;
}

function getSelectedBreakfast() {
  return resolveRecipeVariant(getSelectedRecipe('selectedBreakfastId'), state.profile.selectedBreakfastVariantId);
}

function getSelectedLunch() {
  return getSelectedRecipe('selectedLunchId');
}

function getSelectedDinner() {
  return getSelectedRecipe('selectedDinnerId');
}

function getDailyPlan() {
  return calculateRecordedPlan({
    breakfast: getSelectedBreakfast(), lunch: getSelectedLunch(), dinner: getSelectedDinner(),
    snacks: state.profile.snacks, mealCalories: state.profile.mealCalories,
    consumedMeals: state.profile.consumedMeals
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
  ingredientTitle.textContent = 'Ingredientes desta porção';
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

function createBreakfastCard(baseRecipe, index) {
  const selectedVariant = state.profile.selectedBreakfastId === baseRecipe.id ? state.profile.selectedBreakfastVariantId : 'base';
  const variantId = state.variantPreviews[baseRecipe.id] || selectedVariant;
  const recipe = resolveRecipeVariant(baseRecipe, variantId);
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
  if (baseRecipe.variants?.length) {
    const label = document.createElement('label');
    label.className = 'food-portion-choice';
    label.textContent = 'Porção';
    const select = document.createElement('select');
    select.dataset.breakfastVariant = recipe.id;
    select.disabled = Boolean(state.profile.consumedMeals.breakfast);
    const choices = [{ id: 'base', label: baseRecipe.baseLabel || 'Base', calories: baseRecipe.calories }, ...baseRecipe.variants];
    for (const choice of choices) {
      const option = document.createElement('option');
      option.value = choice.id;
      option.textContent = `${choice.label} · ${formatCalories(choice.calories)}`;
      select.appendChild(option);
    }
    select.value = recipe.variantId;
    label.appendChild(select);
    actions.appendChild(label);
  }
  const isChosen = state.profile.selectedBreakfastId === recipe.id && state.profile.selectedBreakfastVariantId === recipe.variantId;
  choose.textContent = isChosen ? 'Escolhido ✓' : 'Escolher';
  choose.dataset.recipeVariant = recipe.variantId;
  actions.append(choose, edit);
  appendRecipeDelete(actions, recipe);

  article.append(topline, title, summary, macros);
  if (highlights.childElementCount) article.appendChild(highlights);
  article.append(createRecipeDetails(recipe), actions);
  return article;
}

function createMainMealCard(meal, stage, index) {
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
  rank.textContent = `${index + 1}.ª opção`;
  const quality = document.createElement('span');
  quality.className = `food-quality food-quality--${meal.quality || 'manual'}`;
  quality.textContent = meal.qualityLabel || 'Não verificada';
  topline.append(rank, quality);

  const title = document.createElement('h4');
  title.textContent = meal.name;
  const summary = document.createElement('p');
  summary.className = 'food-recipe-summary';
  summary.textContent = meal.description || meal.notes || 'Receita pessoal.';

  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia da porção', formatCalories(meal.calories));
  appendMacro(macros, 'Proteína aprox.', formatGrams(meal.protein));
  appendMacro(macros, 'Hidratos aprox.', formatGrams(meal.carbs));
  appendMacro(macros, 'Fibra aprox.', formatGrams(meal.fiber));

  const portion = document.createElement('p');
  portion.className = 'food-main-meal-portion';
  portion.textContent = 'Uma porção: usar as quantidades indicadas abaixo.';
  if (state.profile.consumedMeals[stage]?.id === meal.id) {
    portion.textContent += ' O resumo conserva os valores guardados quando marcaste “Já comi”, mesmo que a receita tenha sido editada entretanto.';
  }

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

  const details = createRecipeDetails(meal);
  details.insertBefore(portion, details.children[1]);
  article.append(topline, title, summary, macros, details, actions);
  return article;
}

function renderBreakfastRecipes() {
  elements.recipeGrid.replaceChildren();
  state.recipes
    .filter(recipe => recipe.meal === 'breakfast')
    .forEach((recipe, index) => elements.recipeGrid.appendChild(createBreakfastCard(recipe, index)));
}

function renderMainMealGrid(stage) {
  const grid = stage === 'lunch' ? elements.lunchGrid : elements.dinnerGrid;
  const recipes = getMainRecipes(stage);
  grid.replaceChildren();
  recipes.forEach((recipe, index) => grid.appendChild(createMainMealCard(recipe, stage, index)));
  if (!recipes.length) {
    const empty = document.createElement('p');
    empty.className = 'food-stage-empty';
    empty.textContent = 'Ainda não existem receitas completas para esta refeição.';
    grid.appendChild(empty);
  }
}

function renderMealJumpStates() {
  const breakfast = getSelectedBreakfast();
  const lunch = getSelectedLunch();
  const dinner = getSelectedDinner();
  const manual = state.profile.mealCalories;
  const snackTotals = sumNutrition(state.profile.snacks).calories;
  const states = [
    {
      element: elements.breakfastJumpState,
      status: manual.breakfast ? formatCalories(manual.breakfast) : (breakfast ? (breakfast.shortName || breakfast.name) : 'Por escolher'),
      value: (manual.breakfast || breakfast) ? 'selected' : 'pending'
    },
    {
      element: elements.lunchJumpState,
      status: manual.lunch ? formatCalories(manual.lunch) : (lunch ? (lunch.shortName || lunch.name) : 'Por escolher'),
      value: (manual.lunch || lunch) ? 'selected' : 'pending'
    },
    {
      element: elements.dinnerJumpState,
      status: manual.dinner ? formatCalories(manual.dinner) : (dinner ? (dinner.shortName || dinner.name) : 'Por escolher'),
      value: (manual.dinner || dinner) ? 'selected' : 'pending'
    },
    {
      element: elements.snacksJumpState,
      status: manual.snacks ? formatCalories(manual.snacks) : (snackTotals ? formatCalories(snackTotals) : 'Por escolher'),
      value: (manual.snacks || snackTotals) ? 'selected' : 'pending'
    }
  ];
  const buttons = Array.from(document.querySelectorAll('[data-food-meal-jump]'));
  states.forEach((item, index) => {
    item.element.textContent = item.status;
    buttons[index]?.setAttribute('data-state', item.value);
  });
}

function renderMealStages() {
  renderMainMealGrid('lunch');
  renderMainMealGrid('dinner');
  renderSnacks();
}

function createSnackPresetCard(recipe, index) {
  const article = document.createElement('article');
  article.className = 'food-snack-preset-card';
  article.dataset.recipeId = recipe.id;
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
  if (addedCount) {
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
      calories: recipe.calories, protein: recipe.protein
    },
    ...(Array.isArray(recipe.variants) ? recipe.variants : [])
  ];
  const recommendedChoiceId = 'base';
  choices.forEach(choice => {
    const button = document.createElement('button');
    button.type = 'button';
    if (choice.id === recommendedChoiceId) button.className = 'primary';
    button.dataset.addSnackRecipe = recipe.id;
    button.dataset.snackVariant = choice.id;
    button.textContent = `${choice.label} · ${formatCalories(choice.calories)} · P ${formatGrams(choice.protein)}`;
    actions.appendChild(button);
  });
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.dataset.editRecipe = recipe.id;
  edit.textContent = 'Editar';
  actions.appendChild(edit);

  const details = createRecipeDetails(recipe);
  (recipe.variants || []).forEach(variant => {
    const note = document.createElement('p');
    note.textContent = `${variant.label}: ${variant.description}${variant.ingredients ? ` Ingredientes: ${variant.ingredients.split('\n').join('; ')}.` : ''}`;
    details.appendChild(note);
  });
  article.append(topline, title, summary, macros, recommendation, details, actions);
  return article;
}

function renderSnackPresets() {
  elements.snackPresetGrid.replaceChildren();
  getSnackRecipes().forEach((recipe, index) => {
    elements.snackPresetGrid.appendChild(createSnackPresetCard(recipe, index));
  });
}

function renderSnacks() {
  const snackTotals = sumNutrition(state.profile.snacks);
  const enteredCalories = state.profile.mealCalories.snacks;
  elements.snackBudget.textContent = enteredCalories
    ? `${formatCalories(enteredCalories)} registadas`
    : state.profile.snacks.length
    ? `${formatCalories(snackTotals.calories)} registadas`
    : 'Opcionais';
  elements.snackLimit.textContent = 'Adiciona o que fores comer, incluindo extras. Cada escolha soma apenas a sua porção.';
  renderSnackPresets();
  elements.snackList.replaceChildren();

  if (enteredCalories) {
    const item = document.createElement('p');
    item.className = 'food-snack-empty';
    item.textContent = `${formatCalories(enteredCalories)} registadas como total dos lanches.`;
    elements.snackList.appendChild(item);
    return;
  }

  if (!state.profile.snacks.length) {
    const empty = document.createElement('p');
    empty.className = 'food-snack-empty';
    empty.textContent = 'Ainda não adicionaste lanches ou extras.';
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



function renderMacroSummary() {
  const plan = getDailyPlan();
  if (!plan) return;
  const totals = plan.selectedNutrition;
  elements.summaryTitle.textContent = 'Total das refeições registadas';
  elements.summaryCalories.textContent = formatCalories(totals.calories);
  const nutrient = field => `${formatGrams(totals[field])}${plan.partialNutrients.includes(field) ? ' · parcial' : ''}`;
  elements.summaryProtein.textContent = nutrient('protein');
  elements.summaryCarbs.textContent = nutrient('carbs');
  elements.summaryFat.textContent = nutrient('fat');
  const proteinTarget = getBreakfastProteinTarget(state.profile.weightKg);
  document.getElementById('food-summary-note').textContent =
    'Inclui refeições planeadas e consumidas. O que comeres fora destes registos não está contado.'
    + (plan.partialNutrients.length ? ' Macros parciais: há valores em falta.' : ' Valores aproximados.')
    + (proteinTarget ? ` Referência de proteína: cerca de ${Math.round(proteinTarget.dailyLow / 10) * 10}–${Math.round(proteinTarget.dailyHigh / 10) * 10} g/dia, contando tudo o que comes.` : '');
  renderConsumedMeals(plan);
}

function renderConsumedMeals(plan) {
  const list = document.getElementById('food-consumed-meals');
  list.replaceChildren();
  const meals = plan.meals;
  for (const [stage, meal] of Object.entries(meals)) {
    if (!meal) continue;
    const fixed = state.profile.consumedMeals[stage];
    const row = document.createElement('div');
    row.className = 'food-consumed-row';
    const label = document.createElement('span');
    label.textContent = `${recipeMealLabels[stage]} · ${fixed ? 'Consumido' : 'Planeado'} · ${formatCalories(meal.calories)}`;
    const name = document.createElement('small');
    name.textContent = meal.name;
    label.appendChild(name);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.foodConsumed = stage;
    button.textContent = fixed ? 'Corrigir' : 'Já comi';
    button.setAttribute('aria-label', `${button.textContent}: ${recipeMealLabels[stage]}`);
    row.append(label, button);
    list.appendChild(row);
  }
}

function toggleConsumedMeal(stage) {
  if (!['breakfast', 'lunch', 'dinner'].includes(stage)) return;
  if (state.profile.consumedMeals[stage]) {
    delete state.profile.consumedMeals[stage];
  } else {
    const plan = getDailyPlan();
    const meal = plan.meals[stage];
    if (!meal) return;
    // Snapshot survives catalogue edits and explicit portion changes.
    state.profile.consumedMeals[stage] = JSON.parse(JSON.stringify(meal));
  }
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  showToast(state.profile.consumedMeals[stage] ? 'Refeição consumida: porção e nutrientes fixados.' : 'Refeição desbloqueada para corrigir.', 'success');
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
    const consumed = Boolean(state.profile.consumedMeals[meal]);
    Array.from(form.elements).forEach(control => { control.disabled = consumed; });
    if (consumed) status.textContent = 'Refeição consumida. Usa “Corrigir” no resumo para a alterar.';
  });
}

function enhanceRecipeCards() {
  document.querySelectorAll('.food-recipe-card, .food-main-meal-card, .food-snack-preset-card').forEach(card => {
    const title = Array.from(card.children).find(child => child.matches('h3, h4'));
    if (!title) return;
    const recipe = state.recipes.find(item => item.id === card.dataset.recipeId);
    const details = card.querySelector('.food-recipe-details');
    const macros = card.querySelector('.food-recipe-macro-grid');
    const actions = card.querySelector('.food-recipe-actions, .food-snack-preset-actions');
    const time = document.createElement('p');
    time.className = 'food-recipe-time';
    time.textContent = `${recipe?.prepTime || 'Tempo não indicado'}${recipe?.batchFriendly ? ' · Preparável de véspera' : ''}`;
    Array.from(card.children).forEach(child => {
      if (![title, details, macros, actions].includes(child)) details.appendChild(child);
    });
    // Keep the two comparison values visible; secondary macros belong with details.
    Array.from(macros.children).slice(2).forEach(child => details.appendChild(child));
    actions.querySelectorAll('[data-edit-recipe], [data-delete-recipe]').forEach(button => details.appendChild(button));
    const choose = actions.querySelector('[data-choose-recipe], [data-choose-lunch], [data-choose-dinner]');
    if (choose) {
      const stage = choose.hasAttribute('data-choose-recipe') ? 'breakfast' : choose.hasAttribute('data-choose-lunch') ? 'lunch' : 'dinner';
      choose.disabled = Boolean(state.profile.consumedMeals[stage]);
      if (choose.disabled && card.dataset.selected === 'true') choose.textContent = 'Consumido ✓';
    }
    card.replaceChildren(title, time, macros, actions, details);
    card.classList.add('food-recipe-card--compact');
  });
}

function applyActiveMealView() {
  const active = state.activeMeal;
  elements.plan.classList.add('food-plan--focused');
  elements.breakfastStage.hidden = active !== 'breakfast';
  elements.plan.hidden = active === 'breakfast';
  elements.lunchStage.hidden = active !== 'lunch';
  elements.dinnerStage.hidden = active !== 'dinner';
  elements.snacksStage.hidden = active !== 'snacks';
  elements.plan.querySelector(':scope > .food-section-heading')?.setAttribute('hidden', '');
}

function renderAll() {
  validateSelections();
  renderBreakfastRecipes();
  renderMealJumpStates();
  renderMealStages();
  renderMacroSummary();
  elements.profileTarget.textContent = 'Porções de referência';
  renderMealCalorieForms();
  enhanceRecipeCards();
  applyActiveMealView();
}

let dailyResetTimeoutId;

function scheduleDailyReset() {
  clearTimeout(dailyResetTimeoutId);
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  dailyResetTimeoutId = setTimeout(() => resetDailyPlanIfNeeded({ notify: true }), nextDay - now);
}

function resetDailyPlanIfNeeded({ notify = false } = {}) {
  const dateKey = getLocalDateKey();
  const dailyPlan = applyDailyPlanDate(state.profile, dateKey);
  if (!dailyPlan.didReset) {
    scheduleDailyReset();
    return false;
  }
  state.profile = normalizeProfile({
    ...dailyPlan.profile,
    updatedAt: new Date().toISOString()
  });
  state.variantPreviews = {};
  validateSelections();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  scheduleDailyReset();
  if (notify) showToast('Novo dia: refeições escolhidas e lanches foram limpos.', 'info');
  return true;
}

function openRecipeDialog(recipe = null) {
  elements.recipeForm.reset();
  elements.recipeForm.elements.recipeMeal.value = ['lunch', 'dinner'].includes(state.activeMeal) ? 'main' : state.activeMeal === 'snacks' ? 'snack' : 'breakfast';
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
    elements.recipeForm.elements.recipeNotes.value = recipe.notes || '';
    elements.recipeForm.elements.recipeInstructions.value = (recipe.instructions || []).join('\n');
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
  const recipe = updateRecipeDetails(existingRecipe, {
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
    description: existingRecipe?.description || 'Receita personalizada.',
    instructions: String(data.get('recipeInstructions') || '').split('\n').map(line => line.trim()).filter(Boolean),
    source: 'manual',
    catalogVersion: existingRecipe?.catalogVersion || 7,
    updatedAt: new Date().toISOString()
  });

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

function chooseBreakfast(id, variantId = 'base') {
  if (state.profile.consumedMeals.breakfast) return;
  state.profile.selectedBreakfastId = id;
  state.profile.selectedBreakfastVariantId = variantId;
  state.profile.mealCalories.breakfast = 0;
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  jumpToMeal('lunch');
}

function chooseMainMeal(stage, id) {
  if (state.profile.consumedMeals[stage]) return;
  if (stage === 'lunch') {
    state.profile.selectedLunchId = id;
    state.profile.mealCalories.lunch = 0;
  } else {
    state.profile.selectedDinnerId = id;
    state.profile.mealCalories.dinner = 0;
  }
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  jumpToMeal(stage === 'lunch' ? 'dinner' : 'snacks');
}

function storeSnack(snack, successMessage = 'Lanche acrescentado.') {
  state.profile.mealCalories.snacks = 0;
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
    protein: nutrition.protein == null ? null : Number(nutrition.protein) || 0,
    carbs: nutrition.carbs == null ? null : Number(nutrition.carbs) || 0,
    fat: nutrition.fat == null ? null : Number(nutrition.fat) || 0,
    fiber: nutrition.fiber == null ? null : Number(nutrition.fiber) || 0
  }, `${variant?.name || recipe.shortName || recipe.name} acrescentado.`);
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
    protein: optionalNumber(data.get('snackProtein')),
    carbs: optionalNumber(data.get('snackCarbs')),
    fat: optionalNumber(data.get('snackFat')),
    fiber: optionalNumber(data.get('snackFiber'))
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

function saveMealCalories(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const meal = form.dataset.mealCalorieForm;
  if (state.profile.consumedMeals[meal]) return;
  const calories = Math.max(0, Math.round(Number(new FormData(form).get('mealCalories')) || 0));
  if (!meal || !calories) return;
  state.profile.mealCalories[meal] = calories;
  if (meal === 'breakfast') state.profile.selectedBreakfastId = '';
  if (meal === 'lunch') state.profile.selectedLunchId = '';
  if (meal === 'dinner') state.profile.selectedDinnerId = '';
  if (meal === 'snacks') state.profile.snacks = [];
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  showToast(`${formatCalories(calories)} registadas.`, 'success');
  const next = { breakfast: 'lunch', lunch: 'dinner', dinner: 'snacks', snacks: 'snacks' }[meal];
  if (next) jumpToMeal(next);
}

function clearMealCalories(meal) {
  if (state.profile.consumedMeals[meal]) return;
  if (!Object.prototype.hasOwnProperty.call(state.profile.mealCalories, meal)) return;
  state.profile.mealCalories[meal] = 0;
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
}



function bindEvents() {
  elements.addRecipe.addEventListener('click', () => openRecipeDialog());
  elements.recipeForm.addEventListener('submit', saveRecipe);
  elements.snackForm.addEventListener('submit', addSnack);
  document.querySelectorAll('[data-meal-calorie-form]').forEach(form => form.addEventListener('submit', saveMealCalories));
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  elements.recipeGrid.addEventListener('change', event => {
    const select = event.target.closest('[data-breakfast-variant]');
    if (!select || state.profile.consumedMeals.breakfast) return;
    state.variantPreviews[select.dataset.breakfastVariant] = select.value;
    renderAll();
    elements.recipeGrid.querySelector(`[data-breakfast-variant="${select.dataset.breakfastVariant}"]`)?.focus();
  });

  elements.recipeGrid.addEventListener('click', event => {
    const chooseButton = event.target.closest('[data-choose-recipe]');
    if (chooseButton) {
      chooseBreakfast(chooseButton.dataset.chooseRecipe, chooseButton.dataset.recipeVariant);
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

  document.querySelector('.food-meal-switcher')?.addEventListener('click', event => {
    const button = event.target.closest('[data-food-meal-jump]');
    if (button) jumpToMeal(button.dataset.foodMealJump);
  });

  document.addEventListener('click', event => {
    const consumed = event.target.closest('[data-food-consumed]');
    if (consumed) { toggleConsumedMeal(consumed.dataset.foodConsumed); return; }
    const add = event.target.closest('[data-food-add-recipe]');
    if (add) { openRecipeDialog(); return; }
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
    if (clear) clearMealCalories(clear.dataset.clearMealCalories);
  });


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
