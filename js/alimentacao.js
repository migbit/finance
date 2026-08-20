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
  MIGUEL_PROFILE_DEFAULTS,
  getBreakfastProteinTarget,
  mergeBreakfastCatalog
} from './alimentacao-recipes.js';

const PROFILE_STORAGE_KEY = `alimentacao-profile-v${PROFILE_VERSION}`;
const RECIPES_STORAGE_KEY = `alimentacao-recipes-v${PROFILE_VERSION}`;

const recipeMealLabels = {
  breakfast: 'Pequeno-almoço',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche'
};

const storedProfile = loadStored(PROFILE_STORAGE_KEY, {});
const state = {
  profile: { ...MIGUEL_PROFILE_DEFAULTS, ...storedProfile },
  recipes: mergeBreakfastCatalog(loadStored(RECIPES_STORAGE_KEY, [])),
  user: null
};
if (!state.recipes.some(recipe => recipe.id === state.profile.selectedBreakfastId)) {
  state.profile.selectedBreakfastId = '';
}

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
  summaryCalories: document.getElementById('food-summary-calories'),
  summaryProtein: document.getElementById('food-summary-protein'),
  summaryCarbs: document.getElementById('food-summary-carbs'),
  summaryFat: document.getElementById('food-summary-fat')
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
      state.profile = { ...MIGUEL_PROFILE_DEFAULTS, ...remoteProfile };
      state.recipes = mergeBreakfastCatalog(remote.recipes);
      if (!state.recipes.some(recipe => recipe.id === state.profile.selectedBreakfastId)) {
        state.profile.selectedBreakfastId = '';
      }
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

function renderEnergyPlan() {
  const { energy, allocation } = getCurrentEnergyContext();
  if (!energy || !allocation) {
    elements.energyResult.hidden = true;
    return;
  }

  elements.energyResult.hidden = false;
  elements.energyTarget.textContent = formatCalories(energy.target);
  elements.energyRange.textContent = 'base diária atual';
  elements.breakfastTarget.textContent = formatCalories(allocation.breakfast);
  elements.lunchTarget.textContent = formatCalories(allocation.lunch);
  elements.dinnerTarget.textContent = formatCalories(allocation.dinner);
  elements.snacksTarget.textContent = allocation.snacks.length
    ? allocation.snacks.map(formatCalories).join(' + ')
    : '—';
  elements.energyNote.textContent = 'Distribuição provisória; almoço e jantar serão ajustados à receita escolhida.';
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

function createRecipeCard(recipe, index) {
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
  } else {
    targetNote.textContent = 'Sem energia suficiente para comparar com o alvo.';
  }

  const highlights = document.createElement('div');
  highlights.className = 'food-recipe-highlights';
  (recipe.highlights || []).forEach(value => {
    const chip = document.createElement('span');
    chip.textContent = value;
    highlights.appendChild(chip);
  });

  const details = document.createElement('details');
  details.className = 'food-recipe-details';
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'Ver ingredientes e preparação';
  const ingredientTitle = document.createElement('strong');
  ingredientTitle.textContent = 'Ingredientes';
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

  if (!DEFAULT_BREAKFASTS.some(item => item.id === recipe.id)) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'food-recipe-delete';
    remove.dataset.deleteRecipe = recipe.id;
    remove.setAttribute('aria-label', `Apagar ${recipe.name}`);
    remove.textContent = '×';
    actions.appendChild(remove);
  }

  article.append(topline, title, summary, macros, targetNote);
  if (highlights.childElementCount) article.appendChild(highlights);
  article.append(details, actions);
  return article;
}

function renderRecipes() {
  elements.recipeGrid.replaceChildren();
  state.recipes
    .filter(recipe => recipe.meal === 'breakfast')
    .forEach((recipe, index) => elements.recipeGrid.appendChild(createRecipeCard(recipe, index)));
}

function renderMacroSummary() {
  const selected = state.recipes.find(recipe => recipe.id === state.profile.selectedBreakfastId);
  elements.summaryCalories.textContent = selected && Number.isFinite(selected.calories)
    ? formatCalories(selected.calories)
    : '—';
  elements.summaryProtein.textContent = selected ? formatGrams(selected.protein) : '—';
  elements.summaryCarbs.textContent = selected ? formatGrams(selected.carbs) : '—';
  elements.summaryFat.textContent = selected ? formatGrams(selected.fat) : '—';
}

function renderBreakfastSelection() {
  const selected = state.recipes.find(recipe => recipe.id === state.profile.selectedBreakfastId);
  const sequence = Array.from(document.querySelectorAll('.food-sequence article'));
  sequence.forEach(item => item.removeAttribute('data-sequence'));

  if (!selected) {
    elements.breakfastSelection.hidden = true;
    if (sequence[0]) sequence[0].dataset.sequence = 'active';
    renderMacroSummary();
    return;
  }

  const { energy } = getCurrentEnergyContext();
  elements.breakfastSelection.hidden = false;
  elements.selectedBreakfastName.textContent = selected.name;
  elements.selectedBreakfastBalance.textContent = energy && Number.isFinite(selected.calories)
    ? `${formatCalories(selected.calories)} escolhidas · restam cerca de ${formatCalories(Math.max(0, energy.target - selected.calories))} para as restantes refeições.`
    : 'Escolha guardada.';
  if (sequence[0]) sequence[0].dataset.sequence = 'complete';
  if (sequence[1]) sequence[1].dataset.sequence = 'active';
  renderMacroSummary();
}

function renderAll() {
  renderEnergyPlan();
  renderRecipeTargets();
  renderRecipes();
  renderBreakfastSelection();
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
    state.profile.updatedAt = new Date().toISOString();
    persistLocal();
    renderAll();
    await syncToCloud({ quiet: true });
    showToast('Receita apagada.', 'info');
  });
}

function chooseBreakfast(id) {
  state.profile.selectedBreakfastId = id;
  state.profile.updatedAt = new Date().toISOString();
  persistLocal();
  renderAll();
  syncToCloud({ quiet: true });
  document.getElementById('food-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindEvents() {
  elements.addRecipe.addEventListener('click', () => openRecipeDialog());
  elements.recipeForm.addEventListener('submit', saveRecipe);
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  elements.recipeGrid.addEventListener('click', event => {
    const chooseButton = event.target.closest('[data-choose-recipe]');
    if (chooseButton) {
      chooseBreakfast(chooseButton.dataset.chooseRecipe);
      return;
    }
    const editButton = event.target.closest('[data-edit-recipe]');
    if (editButton) {
      openRecipeDialog(state.recipes.find(recipe => recipe.id === editButton.dataset.editRecipe));
      return;
    }
    const deleteButton = event.target.closest('[data-delete-recipe]');
    if (deleteButton) deleteRecipe(deleteButton.dataset.deleteRecipe);
  });

  elements.clearBreakfast.addEventListener('click', () => {
    state.profile.selectedBreakfastId = '';
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
