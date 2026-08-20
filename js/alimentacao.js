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
  buildNutritionPriorities,
  calculateEnergyPlan,
  getProfileCompletion
} from './alimentacao-core.js';
import {
  DEFAULT_BREAKFASTS,
  MIGUEL_PROFILE_DEFAULTS,
  getBreakfastProteinTarget,
  mergeBreakfastCatalog
} from './alimentacao-recipes.js';

const PROFILE_STORAGE_KEY = `alimentacao-profile-v${PROFILE_VERSION}`;
const RECIPES_STORAGE_KEY = `alimentacao-recipes-v${PROFILE_VERSION}`;
const NUMBER_FIELDS = new Set([
  'age',
  'heightCm',
  'weightKg',
  'strengthSessions',
  'dailySteps',
  'manualCalories'
]);
const ARRAY_FIELDS = ['allergies', 'supplements', 'equipment'];

const goalLabels = {
  lose_gentle: 'Perder gordura lentamente',
  lose: 'Perder gordura',
  maintain: 'Manter',
  gain: 'Ganhar massa gradualmente'
};

const mealLabels = {
  '3': '3 refeições',
  '3+1': '3 refeições + 1 lanche',
  '3+2': '3 refeições + 2 lanches'
};

const recipeMealLabels = {
  breakfast: 'Pequeno-almoço',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche'
};

const storedProfile = loadStored(PROFILE_STORAGE_KEY, {});
const state = {
  currentStep: 1,
  profile: { ...MIGUEL_PROFILE_DEFAULTS, ...storedProfile },
  recipes: mergeBreakfastCatalog(loadStored(RECIPES_STORAGE_KEY, [])),
  user: null,
  saveTimer: null,
  hasLoadedRemote: false
};

const elements = {
  form: document.getElementById('food-profile-form'),
  formSteps: Array.from(document.querySelectorAll('[data-form-step]')),
  stepButtons: Array.from(document.querySelectorAll('[data-step-button]')),
  progressBar: document.getElementById('food-progress-bar'),
  prevStep: document.getElementById('food-prev-step'),
  nextStep: document.getElementById('food-next-step'),
  saveProfile: document.getElementById('food-save-profile'),
  stepLabel: document.getElementById('food-step-label'),
  formError: document.getElementById('food-form-error'),
  estimateFields: document.getElementById('food-estimate-fields'),
  manualField: document.getElementById('food-manual-field'),
  profileState: document.getElementById('food-profile-state'),
  profileStateTitle: document.getElementById('food-profile-state-title'),
  saveState: document.getElementById('food-save-state'),
  completionRing: document.getElementById('food-completion-ring'),
  completionValue: document.getElementById('food-completion-value'),
  completionText: document.getElementById('food-completion-text'),
  summaryGoal: document.getElementById('food-summary-goal'),
  summaryMeals: document.getElementById('food-summary-meals'),
  energyEmpty: document.getElementById('food-energy-empty'),
  energyResult: document.getElementById('food-energy-result'),
  energyTarget: document.getElementById('food-energy-target'),
  energyRange: document.getElementById('food-energy-range'),
  breakfastTarget: document.getElementById('food-breakfast-target'),
  lunchTarget: document.getElementById('food-lunch-target'),
  dinnerTarget: document.getElementById('food-dinner-target'),
  snacksTarget: document.getElementById('food-snacks-target'),
  energyNote: document.getElementById('food-energy-note'),
  nutrientList: document.getElementById('food-nutrient-list'),
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
  clearBreakfast: document.getElementById('food-clear-breakfast')
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

function getCheckedValues(name) {
  return Array.from(elements.form.querySelectorAll(`[name="${name}"]:checked`)).map(input => input.value);
}

function readProfileForm() {
  const formData = new FormData(elements.form);
  const profile = {
    version: PROFILE_VERSION,
    diet: 'lacto_ovo_vegetarian',
    selectedBreakfastId: state.profile.selectedBreakfastId || '',
    updatedAt: new Date().toISOString()
  };

  for (const [key, rawValue] of formData.entries()) {
    if (ARRAY_FIELDS.includes(key)) continue;
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (NUMBER_FIELDS.has(key)) {
      profile[key] = value === '' ? '' : Number(value);
    } else {
      profile[key] = value;
    }
  }

  ARRAY_FIELDS.forEach(name => {
    profile[name] = getCheckedValues(name);
  });

  return profile;
}

function fillProfileForm(profile) {
  Array.from(elements.form.elements).forEach(control => {
    if (!control.name || control.type === 'submit' || control.type === 'button') return;
    if (control.type === 'radio') {
      control.checked = control.value === profile[control.name];
      return;
    }
    if (control.type === 'checkbox') {
      control.checked = Array.isArray(profile[control.name]) && profile[control.name].includes(control.value);
      return;
    }
    control.value = profile[control.name] ?? '';
  });

  const hasMode = elements.form.querySelector('[name="calculationMode"]:checked');
  if (!hasMode) {
    const defaultMode = elements.form.querySelector('[name="calculationMode"][value="estimate"]');
    if (defaultMode) defaultMode.checked = true;
  }
}

function persistLocal() {
  writeStored(PROFILE_STORAGE_KEY, state.profile);
  writeStored(RECIPES_STORAGE_KEY, state.recipes);
  elements.saveState.textContent = state.user
    ? 'Alterações locais por sincronizar'
    : 'Rascunho guardado neste dispositivo';
}

function scheduleDraftSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    persistLocal();
    if (state.user) syncToCloud({ quiet: true });
  }, 900);
}

async function syncToCloud({ quiet = false } = {}) {
  if (!state.user) {
    elements.saveState.textContent = 'Guardado neste dispositivo · inicia sessão para sincronizar';
    return false;
  }

  try {
    await setDoc(doc(db, 'alimentacao_perfis', state.user.uid), {
      version: PROFILE_VERSION,
      profile: state.profile,
      recipes: state.recipes,
      updatedAt: serverTimestamp()
    }, { merge: true });
    elements.saveState.textContent = 'Guardado e sincronizado';
    if (!quiet) showToast('Perfil de alimentação guardado.', 'success');
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar alimentação:', error);
    elements.saveState.textContent = 'Guardado neste dispositivo · sincronização pendente';
    if (!quiet) showToast('Ficou guardado neste dispositivo, mas não foi possível sincronizar.', 'warning');
    return false;
  }
}

async function loadRemoteProfile(user) {
  try {
    const snapshot = await getDoc(doc(db, 'alimentacao_perfis', user.uid));
    if (!snapshot.exists()) {
      state.hasLoadedRemote = true;
      if (Object.keys(state.profile).length || state.recipes.length) await syncToCloud({ quiet: true });
      return;
    }

    const remote = snapshot.data();
    const remoteProfile = remote.profile || {};
    const localTime = Date.parse(state.profile.updatedAt || '') || 0;
    const remoteTime = remote.updatedAt?.toMillis?.() || Date.parse(remoteProfile.updatedAt || '') || 0;

    if (remoteTime >= localTime || !Object.keys(state.profile).length) {
      state.profile = { ...MIGUEL_PROFILE_DEFAULTS, ...remoteProfile };
      state.recipes = mergeBreakfastCatalog(remote.recipes);
      fillProfileForm(state.profile);
      persistLocal();
      renderAll();
    } else {
      await syncToCloud({ quiet: true });
    }

    state.hasLoadedRemote = true;
    elements.saveState.textContent = 'Guardado e sincronizado';
  } catch (error) {
    console.error('Erro ao carregar o perfil de alimentação:', error);
    elements.saveState.textContent = 'A usar o rascunho deste dispositivo';
  }
}

function showStep(step) {
  state.currentStep = Math.max(1, Math.min(3, Number(step) || 1));
  elements.formSteps.forEach(section => {
    section.hidden = Number(section.dataset.formStep) !== state.currentStep;
  });
  elements.stepButtons.forEach(button => {
    const buttonStep = Number(button.dataset.stepButton);
    if (buttonStep === state.currentStep) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.dataset.complete = String(buttonStep < state.currentStep);
  });
  elements.progressBar.style.width = `${(state.currentStep / 3) * 100}%`;
  elements.prevStep.hidden = state.currentStep === 1;
  elements.nextStep.hidden = state.currentStep === 3;
  elements.saveProfile.hidden = state.currentStep !== 3;
  elements.stepLabel.textContent = `Etapa ${state.currentStep} de 3`;
  clearFormError();
}

function currentMode() {
  return elements.form.querySelector('[name="calculationMode"]:checked')?.value || 'estimate';
}

function updateCalculationMode() {
  const mode = currentMode();
  elements.estimateFields.hidden = mode === 'manual';
  elements.manualField.hidden = mode !== 'manual';
}

function markInvalid(control, invalid) {
  if (!control) return;
  if (invalid) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');
}

function validNumber(name, min, max) {
  const control = elements.form.elements[name];
  const number = Number(control?.value);
  const valid = control?.value !== '' && Number.isFinite(number) && number >= min && number <= max;
  markInvalid(control, !valid);
  return valid;
}

function validSelection(name, allowed = null) {
  const control = elements.form.elements[name];
  const valid = Boolean(control?.value) && (!allowed || allowed.includes(control.value));
  markInvalid(control, !valid);
  return valid;
}

function validateStepOne() {
  const checks = [];
  if (currentMode() === 'manual') {
    checks.push(validNumber('manualCalories', 800, 7000));
  } else {
    checks.push(validNumber('age', 18, 100));
    checks.push(validSelection('sexAtBirth', ['male', 'female']));
    checks.push(validNumber('heightCm', 120, 230));
    checks.push(validNumber('weightKg', 35, 300));
    checks.push(validSelection('activityLevel'));
  }
  checks.push(validSelection('goal'));
  return checks.every(Boolean);
}

function validateStepThree() {
  return [
    validSelection('mealPattern'),
    validSelection('breakfastAppetite')
  ].every(Boolean);
}

function firstInvalidControl() {
  return elements.form.querySelector('[aria-invalid="true"]');
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.hidden = false;
}

function clearFormError() {
  elements.formError.hidden = true;
  elements.formError.textContent = '';
}

function formatCalories(value) {
  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value))} kcal`;
}

function renderEnergyPlan() {
  const energy = calculateEnergyPlan(state.profile);
  if (!energy) {
    elements.energyEmpty.hidden = false;
    elements.energyResult.hidden = true;
    return;
  }

  const allocation = allocateMealCalories(
    energy.target,
    state.profile.mealPattern || '3+1',
    state.profile.breakfastAppetite || 'medium'
  );
  elements.energyEmpty.hidden = true;
  elements.energyResult.hidden = false;
  elements.energyTarget.textContent = formatCalories(energy.target);
  elements.energyRange.textContent = energy.method === 'manual'
    ? 'alvo introduzido manualmente'
    : `intervalo inicial ${formatCalories(energy.rangeLow)}–${formatCalories(energy.rangeHigh)}`;
  elements.breakfastTarget.textContent = formatCalories(allocation.breakfast);
  elements.lunchTarget.textContent = formatCalories(allocation.lunch);
  elements.dinnerTarget.textContent = formatCalories(allocation.dinner);
  elements.snacksTarget.textContent = allocation.snacks.length
    ? allocation.snacks.map(formatCalories).join(' + ')
    : '—';

  if (energy.method === 'manual') {
    elements.energyNote.textContent = 'Este valor não foi calculado pela aplicação. A distribuição pelas refeições é provisória e será ajustada pelas receitas escolhidas.';
  } else {
    const ageCaution = Number(state.profile.age) > 78
      ? ' A idade está fora da amostra original da equação, aumentando a incerteza.'
      : '';
    elements.energyNote.textContent = `Estimativa por Mifflin–St Jeor: repouso ${formatCalories(energy.resting)}, manutenção aproximada ${formatCalories(energy.maintenance)} e ajuste conservador ao objetivo.${ageCaution} Validar pela tendência real, não por um único peso.`;
  }
}

function renderProfileSummary() {
  const completion = getProfileCompletion(state.profile);
  elements.completionRing.style.setProperty('--completion', `${completion.percentage}%`);
  elements.completionValue.textContent = `${completion.percentage}%`;
  elements.summaryGoal.textContent = goalLabels[state.profile.goal] || 'Por indicar';
  elements.summaryMeals.textContent = mealLabels[state.profile.mealPattern] || 'Por indicar';

  if (completion.complete) {
    elements.completionText.textContent = 'A base necessária para estimar energia está completa. As restantes respostas afinam as receitas.';
    elements.profileState.dataset.state = 'complete';
    elements.profileStateTitle.textContent = 'Base essencial completa';
  } else {
    const missingCount = completion.totalCount - completion.completedCount;
    elements.completionText.textContent = `Faltam ${missingCount} ${missingCount === 1 ? 'resposta essencial' : 'respostas essenciais'} para definir o ponto de partida.`;
    elements.profileState.dataset.state = 'draft';
    elements.profileStateTitle.textContent = 'Perfil por completar';
  }
}

function renderNutrientPriorities() {
  const priorities = buildNutritionPriorities(state.profile);
  elements.nutrientList.replaceChildren();
  priorities.forEach((priority, index) => {
    const item = document.createElement('li');
    const marker = document.createElement('span');
    marker.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = priority.label;
    const reason = document.createElement('small');
    reason.textContent = priority.noted
      ? `${priority.reason} Suplemento assinalado no perfil; dose e adequação não são presumidas.`
      : priority.reason;
    copy.append(title, reason);
    item.append(marker, copy);
    elements.nutrientList.appendChild(item);
  });
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

function renderRecipeTargets() {
  const { energy, allocation } = getCurrentEnergyContext();
  const protein = getBreakfastProteinTarget(state.profile.weightKg);
  elements.recipesDailyTarget.textContent = energy ? formatCalories(energy.target) : 'Por calcular';
  elements.recipesBreakfastTarget.textContent = allocation ? `≈ ${formatCalories(allocation.breakfast)}` : 'Por calcular';
  elements.recipesProteinTarget.textContent = protein
    ? `≈ ${protein.dailyLow}–${protein.dailyHigh} g`
    : 'Por calcular';
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
  const meal = document.createElement('span');
  meal.className = 'food-recipe-number';
  meal.textContent = recipe.source === 'curated'
    ? String(index + 1).padStart(2, '0')
    : recipeMealLabels[recipe.meal] || 'Receita';
  const quality = document.createElement('span');
  quality.className = `food-quality food-quality--${recipe.quality || 'manual'}`;
  quality.textContent = recipe.qualityLabel || 'Não verificada';
  topline.append(meal, quality);

  const title = document.createElement('h3');
  title.textContent = recipe.name;
  const summary = document.createElement('p');
  summary.className = 'food-recipe-summary';
  summary.textContent = recipe.description || recipe.notes || 'Receita pessoal ainda sem descrição.';

  const macros = document.createElement('div');
  macros.className = 'food-recipe-macro-grid';
  appendMacro(macros, 'Energia', Number.isFinite(recipe.calories) ? formatCalories(recipe.calories) : '—');
  appendMacro(macros, 'Proteína', Number.isFinite(recipe.protein) ? `${recipe.protein} g` : '—');
  appendMacro(macros, 'Hidratos', Number.isFinite(recipe.carbs) ? `${recipe.carbs} g` : '—');
  appendMacro(macros, 'Fibra', Number.isFinite(recipe.fiber) ? `${recipe.fiber} g` : '—');

  const { allocation } = getCurrentEnergyContext();
  const targetNote = document.createElement('p');
  targetNote.className = 'food-recipe-target-note';
  if (allocation && Number.isFinite(recipe.calories)) {
    const difference = Math.round(recipe.calories - allocation.breakfast);
    targetNote.dataset.state = Math.abs(difference) <= 40 ? 'ok' : 'adjust';
    targetNote.textContent = Math.abs(difference) <= 40
      ? `Dentro do alvo de ${formatCalories(allocation.breakfast)} (diferença ${difference >= 0 ? '+' : ''}${difference} kcal).`
      : `${Math.abs(difference)} kcal ${difference > 0 ? 'acima' : 'abaixo'} do alvo atual; ajustar a porção depois de confirmar os rótulos.`;
  } else {
    targetNote.textContent = 'Completa energia e porções para comparar com o alvo.';
  }

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
    const cautionTitle = document.createElement('strong');
    cautionTitle.textContent = 'A confirmar';
    const cautions = document.createElement('ul');
    recipe.cautions.forEach(line => {
      const item = document.createElement('li');
      item.textContent = line;
      cautions.appendChild(item);
    });
    details.append(cautionTitle, cautions);
  }

  const highlights = document.createElement('div');
  highlights.className = 'food-recipe-highlights';
  (recipe.highlights || []).forEach(value => {
    const chip = document.createElement('span');
    chip.textContent = value;
    highlights.appendChild(chip);
  });

  if (recipe.evidenceNote) {
    const evidence = document.createElement('p');
    evidence.className = 'food-recipe-evidence';
    evidence.textContent = recipe.evidenceNote;
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

function renderBreakfastSelection() {
  const selected = state.recipes.find(recipe => recipe.id === state.profile.selectedBreakfastId);
  if (!selected) {
    elements.breakfastSelection.hidden = true;
    const sequence = Array.from(document.querySelectorAll('.food-sequence article'));
    sequence.forEach(item => item.removeAttribute('data-sequence'));
    if (sequence[0]) sequence[0].dataset.sequence = 'active';
    return;
  }

  const { energy } = getCurrentEnergyContext();
  elements.breakfastSelection.hidden = false;
  elements.selectedBreakfastName.textContent = selected.name;
  elements.selectedBreakfastBalance.textContent = energy && Number.isFinite(selected.calories)
    ? `${formatCalories(selected.calories)} escolhidas · restam aproximadamente ${formatCalories(Math.max(0, energy.target - selected.calories))} para almoço, jantar e lanche.`
    : 'A escolha fica guardada; completa os valores para calcular o restante dia.';

  const sequence = Array.from(document.querySelectorAll('.food-sequence article'));
  sequence.forEach(item => item.removeAttribute('data-sequence'));
  if (sequence[0]) sequence[0].dataset.sequence = 'complete';
  if (sequence[1]) sequence[1].dataset.sequence = 'active';
}

function renderAll() {
  updateCalculationMode();
  renderProfileSummary();
  renderEnergyPlan();
  renderNutrientPriorities();
  renderRecipeTargets();
  renderRecipes();
  renderBreakfastSelection();
}

function handleProfileDraft() {
  state.profile = readProfileForm();
  renderAll();
  scheduleDraftSave();
}

function handleExclusiveCheckbox(event) {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  const fieldset = checkbox.closest('[data-exclusive-group]');
  if (!fieldset || !checkbox.checked) return;

  const exclusive = checkbox.hasAttribute('data-exclusive');
  fieldset.querySelectorAll('input[type="checkbox"]').forEach(other => {
    if (other === checkbox) return;
    if (exclusive || other.hasAttribute('data-exclusive')) other.checked = false;
  });
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
  const existing = state.recipes.find(item => item.id === existingId);
  const recipe = {
    id: existingId || (crypto.randomUUID?.() || `recipe-${Date.now()}`),
    name: String(data.get('recipeName') || '').trim(),
    meal: String(data.get('recipeMeal') || 'breakfast'),
    ingredients: String(data.get('recipeIngredients') || '').trim(),
    calories: optionalNumber(data.get('recipeCalories')),
    protein: optionalNumber(data.get('recipeProtein')),
    carbs: existing?.source === 'curated' ? null : existing?.carbs ?? null,
    fat: existing?.source === 'curated' ? null : existing?.fat ?? null,
    fiber: optionalNumber(data.get('recipeFiber')),
    notes: String(data.get('recipeNotes') || '').trim(),
    description: String(data.get('recipeNotes') || '').trim() || 'Receita personalizada; composição a rever.',
    quality: 'pending',
    qualityLabel: 'Composição a rever',
    highlights: [],
    instructions: [],
    source: 'manual',
    updatedAt: new Date().toISOString()
  };

  const index = state.recipes.findIndex(item => item.id === recipe.id);
  if (index >= 0) state.recipes[index] = recipe;
  else state.recipes.push(recipe);

  persistLocal();
  renderRecipes();
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
    persistLocal();
    renderRecipes();
    await syncToCloud({ quiet: true });
    showToast('Receita apagada.', 'info');
  });
}

function bindEvents() {
  elements.stepButtons.forEach(button => {
    button.addEventListener('click', () => showStep(button.dataset.stepButton));
  });

  elements.prevStep.addEventListener('click', () => showStep(state.currentStep - 1));
  elements.nextStep.addEventListener('click', () => {
    if (state.currentStep === 1 && !validateStepOne()) {
      showFormError('Preenche os campos obrigatórios desta etapa para calcular uma estimativa segura.');
      firstInvalidControl()?.focus();
      return;
    }
    showStep(state.currentStep + 1);
  });

  elements.form.addEventListener('change', event => {
    handleExclusiveCheckbox(event);
    if (event.target.name === 'sexAtBirth' && event.target.value === 'manual') {
      elements.form.querySelector('[name="calculationMode"][value="manual"]').checked = true;
    }
    handleProfileDraft();
  });
  elements.form.addEventListener('input', handleProfileDraft);

  elements.form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStepOne()) {
      showStep(1);
      validateStepOne();
      showFormError('Ainda faltam respostas essenciais na etapa “Necessidades”.');
      firstInvalidControl()?.focus();
      return;
    }
    if (!validateStepThree()) {
      showStep(3);
      validateStepThree();
      showFormError('Indica a estrutura diária e a fome ao pequeno-almoço.');
      firstInvalidControl()?.focus();
      return;
    }

    state.profile = readProfileForm();
    persistLocal();
    renderAll();
    await syncToCloud();
    document.getElementById('food-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.addRecipe.addEventListener('click', () => openRecipeDialog());
  elements.recipeForm.addEventListener('submit', saveRecipe);
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  elements.recipeGrid.addEventListener('click', event => {
    const chooseButton = event.target.closest('[data-choose-recipe]');
    if (chooseButton) {
      state.profile.selectedBreakfastId = chooseButton.dataset.chooseRecipe;
      state.profile.updatedAt = new Date().toISOString();
      persistLocal();
      renderAll();
      syncToCloud({ quiet: true });
      document.getElementById('food-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

fillProfileForm(state.profile);
bindEvents();
showStep(1);
renderAll();

onAuthStateChanged(getAuth(), user => {
  state.user = user;
  if (user) {
    elements.saveState.textContent = 'A sincronizar…';
    loadRemoteProfile(user);
  } else {
    state.hasLoadedRemote = false;
    elements.saveState.textContent = 'Rascunho guardado neste dispositivo';
  }
});
