const NUTRITION_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getLocalDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function applyDailyPlanDate(profile = {}, dateKey = getLocalDateKey()) {
  const currentDateKey = String(dateKey || '');
  if (!currentDateKey || profile.planDate === currentDateKey) {
    return { profile, didReset: false };
  }
  return {
    profile: {
      ...profile,
      planDate: currentDateKey,
      selectedBreakfastId: '',
      selectedBreakfastVariantId: 'base',
      breakfastSkipped: false,
      selectedLunchId: '',
      lunchExternal: false,
      selectedDinnerId: '',
      snacks: [],
      consumedMeals: {},
      mealCalories: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 }
    },
    didReset: true
  };
}

export function sumNutrition(items = []) {
  return items.reduce((total, item) => {
    NUTRITION_FIELDS.forEach(field => {
      total[field] += finite(item?.[field]);
    });
    return total;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

// Miguel records explicit portions. Missing meals never reserve energy or resize others.
export function calculateRecordedPlan({ breakfast = null, lunch = null, dinner = null,
  snacks = [], mealCalories = {}, consumedMeals = {} } = {}) {
  const consumed = normalizeConsumedMeals(consumedMeals);
  const manualItem = (stage, name) => finite(mealCalories[stage]) > 0
    ? { name, calories: Math.round(finite(mealCalories[stage])), protein: null, carbs: null, fat: null, fiber: null }
    : null;
  const meals = {
    breakfast: consumed.breakfast || manualItem('breakfast', 'Pequeno-almoço registado') || breakfast,
    lunch: consumed.lunch || manualItem('lunch', 'Almoço registado') || lunch,
    dinner: consumed.dinner || manualItem('dinner', 'Jantar registado') || dinner
  };
  const manualSnacks = manualItem('snacks', 'Lanches registados');
  const recordedSnacks = manualSnacks ? [manualSnacks] : snacks;
  const items = [...Object.values(meals), ...recordedSnacks].filter(Boolean);
  return {
    meals,
    selectedNutrition: sumNutrition(items),
    partialNutrients: NUTRITION_FIELDS.slice(1).filter(field => items.some(item => !Number.isFinite(item[field]))),
    snackTotals: sumNutrition(recordedSnacks)
  };
}

export function rebalanceMealCalories(totalCalories, baseTargets = {}, fixedCalories = {}) {
  const target = Math.max(0, Math.round(finite(totalCalories)));
  const keys = Object.keys(baseTargets);
  const baseTotal = keys.reduce((sum, key) => sum + Math.max(0, finite(baseTargets[key])), 0);
  const scaledBase = Object.fromEntries(keys.map(key => [
    key,
    baseTotal > 0 ? (Math.max(0, finite(baseTargets[key])) / baseTotal) * target : 0
  ]));
  const fixedKeys = new Set(keys.filter(key => Object.prototype.hasOwnProperty.call(fixedCalories, key)));
  const fixedTotal = keys.reduce((sum, key) => (
    fixedKeys.has(key) ? sum + Math.max(0, Math.round(finite(fixedCalories[key]))) : sum
  ), 0);
  const flexibleKeys = keys.filter(key => !fixedKeys.has(key));
  const flexibleBaseTotal = flexibleKeys.reduce((sum, key) => sum + scaledBase[key], 0);
  let remaining = Math.max(0, target - fixedTotal);
  const result = {};

  keys.forEach(key => {
    if (fixedKeys.has(key)) result[key] = Math.max(0, Math.round(finite(fixedCalories[key])));
  });
  flexibleKeys.forEach((key, index) => {
    const isLast = index === flexibleKeys.length - 1;
    const value = isLast
      ? remaining
      : Math.round(flexibleBaseTotal > 0 ? (scaledBase[key] / flexibleBaseTotal) * Math.max(0, target - fixedTotal) : 0);
    result[key] = Math.max(0, value);
    remaining = Math.max(0, remaining - result[key]);
  });
  return result;
}

// Opt-in keeps the shared Filipa planner's existing portion behaviour intact.
export function adjustMealToCalories(meal, calorieTarget, { practicalPortions = false } = {}) {
  if (!meal || !(finite(meal.calories) > 0) || !(finite(calorieTarget) > 0)) return null;
  if (practicalPortions) return practicalMealPortion(meal, calorieTarget);
  const calories = Math.round(finite(calorieTarget));
  const factor = calories / finite(meal.calories);
  const adjustment = meal.calorieAdjustment;
  const hasAdjustment = (
    adjustment
    && finite(adjustment.baseQuantity) > 0
    && finite(adjustment.calories) > 0
  );
  const adjustmentRatio = hasAdjustment
    ? (calories - finite(meal.calories)) / finite(adjustment.calories)
    : 0;
  const adjustedQuantity = hasAdjustment
    ? finite(adjustment.baseQuantity) * (1 + adjustmentRatio)
    : null;
  const canUseAdjustment = hasAdjustment && adjustedQuantity >= 0;
  const nutrientValue = field => canUseAdjustment
    ? finite(meal[field]) + (finite(adjustment[field]) * adjustmentRatio)
    : finite(meal[field]) * factor;
  const adjustmentIsPractical = !hasAdjustment || (
    canUseAdjustment
    && adjustedQuantity >= finite(adjustment.baseQuantity) * 0.4
    && adjustedQuantity <= finite(adjustment.baseQuantity) * 2.5
  );
  return {
    id: meal.id,
    name: meal.name,
    baseCalories: meal.calories,
    calories,
    protein: round(nutrientValue('protein')),
    carbs: round(nutrientValue('carbs')),
    fat: round(nutrientValue('fat')),
    fiber: round(nutrientValue('fiber')),
    servingFactor: round(factor, 2),
    adjustmentLabel: canUseAdjustment ? adjustment.label : '',
    adjustmentUnit: canUseAdjustment ? adjustment.unit : '',
    baseQuantity: canUseAdjustment ? round(adjustment.baseQuantity) : null,
    adjustedQuantity: canUseAdjustment ? round(adjustedQuantity) : null,
    isPracticalPortion: factor >= 0.65 && factor <= 1.5 && adjustmentIsPractical
  };
}

function practicalMealPortion(meal, calorieTarget) {
  const adjustment = meal.calorieAdjustment;
  const adjustable = adjustment?.baseQuantity > 0 && adjustment?.calories > 0;
  const baseQuantity = adjustable ? Number(adjustment.baseQuantity) : null;
  const step = Math.max(1, finite(adjustment?.step) || 5);
  const desired = adjustable
    ? baseQuantity * (1 + (calorieTarget - meal.calories) / adjustment.calories)
    : null;
  const quantity = adjustable ? Math.max(
    finite(adjustment.minQuantity) || baseQuantity * 0.75,
    Math.min(finite(adjustment.maxQuantity) || baseQuantity * 1.5, Math.round(desired / step) * step)
  ) : null;
  const ratio = adjustable ? quantity / baseQuantity - 1 : 0;
  const calories = Math.round(meal.calories + (adjustable ? adjustment.calories * ratio : 0));
  const nutrition = Object.fromEntries(NUTRITION_FIELDS.slice(1).map(field => [field,
    meal[field] == null ? null : round(Math.max(0, finite(meal[field]) + finite(adjustment?.[field]) * ratio))
  ]));
  return {
    id: meal.id, name: meal.name, baseCalories: meal.calories, calories, ...nutrition,
    servingFactor: round(calories / meal.calories, 2),
    adjustmentLabel: adjustable ? adjustment.label : '',
    adjustmentUnit: adjustable ? adjustment.unit : '',
    baseQuantity, adjustedQuantity: quantity,
    isPracticalPortion: true,
    targetCalories: Math.round(calorieTarget),
    calorieGap: Math.round(calorieTarget - calories)
  };
}

export function normalizeConsumedMeals(value = {}) {
  return Object.fromEntries(['breakfast', 'lunch', 'dinner'].flatMap(key => {
    const meal = value?.[key];
    if (!meal || !Number.isFinite(Number(meal.calories)) || Number(meal.calories) <= 0) return [];
    return [[key, {
      ...meal,
      name: String(meal.name || 'Refeição consumida'),
      ...Object.fromEntries(NUTRITION_FIELDS.map(field => [field,
        meal[field] == null || !Number.isFinite(Number(meal[field])) ? null : Math.max(0, Number(meal[field]))
      ]))
    }]];
  }));
}

export function calculateDailyPlan({
  targetCalories,
  breakfast = null,
  breakfastTarget = 600,
  breakfastSkipped = false,
  lunch = null,
  lunchExternal = false,
  dinner = null,
  snacks = [],
  mealCalories = {},
  consumedMeals = {},
  practicalPortions = false,
  lunchTarget = 840,
  dinnerTarget = 720
} = {}) {
  const target = Math.max(0, Math.round(finite(targetCalories)));
  const snackTotals = sumNutrition(snacks);
  const hasEnteredSnacks = Array.isArray(snacks) && snacks.length > 0;
  const manual = Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snacks'].map(key => [
    key,
    Math.max(0, Math.round(finite(mealCalories?.[key])))
  ]));
  const baseBreakfast = Math.max(0, Math.round(finite(breakfastTarget)));
  const baseLunch = Math.max(0, Math.round(finite(lunchTarget)));
  const baseDinner = Math.max(0, Math.round(finite(dinnerTarget)));
  const baseSnacks = Math.max(0, target - baseBreakfast - baseLunch - baseDinner);
  const fixed = {};
  const consumed = normalizeConsumedMeals(consumedMeals);
  if (manual.breakfast > 0) fixed.breakfast = manual.breakfast;
  else if (breakfast) fixed.breakfast = Math.round(finite(breakfast.calories));
  else if (breakfastSkipped) fixed.breakfast = 0;
  if (manual.lunch > 0) fixed.lunch = manual.lunch;
  if (manual.dinner > 0) fixed.dinner = manual.dinner;
  if (manual.snacks > 0) fixed.snacks = manual.snacks;
  else if (hasEnteredSnacks) fixed.snacks = Math.round(snackTotals.calories);
  Object.entries(consumed).forEach(([key, meal]) => { fixed[key] = Math.round(meal.calories); });

  const targets = rebalanceMealCalories(target, {
    breakfast: baseBreakfast,
    lunch: baseLunch,
    dinner: baseDinner,
    snacks: baseSnacks
  }, fixed);
  const plannedBreakfastCalories = targets.breakfast;
  const plannedLunchCalories = targets.lunch;
  const plannedDinnerCalories = targets.dinner;
  const snackBudget = targets.snacks;
  const manualItem = (name, calories) => ({ name, calories, protein: null, carbs: null, fat: null, fiber: null });
  const resolvedBreakfast = consumed.breakfast || (manual.breakfast > 0
    ? manualItem('Pequeno-almoço registado', manual.breakfast)
    : (breakfastSkipped ? null : breakfast));
  const adjustedLunch = consumed.lunch || (manual.lunch > 0
    ? manualItem('Almoço registado', manual.lunch)
    : adjustMealToCalories(lunch, plannedLunchCalories, { practicalPortions }));
  const adjustedDinner = consumed.dinner || (manual.dinner > 0
    ? manualItem('Jantar registado', manual.dinner)
    : adjustMealToCalories(dinner, plannedDinnerCalories, { practicalPortions }));
  const resolvedSnacks = manual.snacks > 0
    ? [manualItem('Lanches registados', manual.snacks)]
    : snacks;
  const selectedItems = [
    resolvedBreakfast,
    adjustedLunch,
    adjustedDinner,
    ...resolvedSnacks
  ].filter(Boolean);
  const selectedNutrition = sumNutrition(selectedItems);
  const partialNutrients = NUTRITION_FIELDS.slice(1).filter(field => selectedItems.some(item => item[field] == null));
  const allMealsSelected = Boolean(resolvedBreakfast && adjustedLunch && adjustedDinner);
  const breakfastResolved = Boolean(resolvedBreakfast || breakfastSkipped);
  const lunchResolved = Boolean(adjustedLunch || lunchExternal);
  const dinnerResolved = Boolean(adjustedDinner);
  const snacksResolved = Boolean(manual.snacks > 0 || hasEnteredSnacks);
  const allMealsResolved = Boolean(breakfastResolved && lunchResolved && dinnerResolved);
  const reservedBreakfastCalories = !breakfastResolved ? plannedBreakfastCalories : 0;
  const reservedLunchCalories = !lunchResolved ? plannedLunchCalories : 0;
  const reservedDinnerCalories = !dinnerResolved ? plannedDinnerCalories : 0;
  const reservedSnackCalories = !snacksResolved ? snackBudget : 0;
  const reservedMealCalories = (
    reservedBreakfastCalories
    + reservedLunchCalories
    + reservedDinnerCalories
  );
  const plannedCalories = Math.round(
    selectedNutrition.calories + reservedMealCalories + reservedSnackCalories
  );

  return {
    targetCalories: target,
    plannedBreakfastCalories,
    lunchCalories: plannedLunchCalories,
    dinnerCalories: plannedDinnerCalories,
    snackBudget: Math.round(snackBudget),
    snackTotals,
    adjustedLunch,
    adjustedDinner,
    selectedNutrition,
    resolvedBreakfast,
    partialNutrients,
    consumedCalories: Math.round(sumNutrition(Object.values(consumed)).calories),
    reservedBreakfastCalories: Math.round(reservedBreakfastCalories),
    reservedLunchCalories: Math.round(reservedLunchCalories),
    reservedDinnerCalories: Math.round(reservedDinnerCalories),
    reservedMealCalories: Math.round(reservedMealCalories),
    reservedSnackCalories: Math.round(reservedSnackCalories),
    confirmedCalories: Math.round(selectedNutrition.calories),
    plannedCalories,
    caloriesRemaining: target - Math.round(selectedNutrition.calories),
    allMealsSelected,
    allMealsResolved,
    breakfastResolved,
    lunchResolved,
    dinnerResolved,
    snacksResolved,
    closesCalorieTarget: allMealsResolved && plannedCalories === target
  };
}

export function getMaximumSnackCalories({
  targetCalories,
  breakfastCalories,
  lunchCalories = 840,
  minimumDinnerCalories = 400
} = {}) {
  return Math.max(
    0,
    Math.round(
      finite(targetCalories)
      - finite(breakfastCalories)
      - finite(lunchCalories)
      - finite(minimumDinnerCalories)
    )
  );
}

function recommendationReason(meal, context, adjusted) {
  if (meal.pairsAfter?.includes(context.breakfastId)) {
    return 'Combina especialmente bem com o pequeno-almoço escolhido.';
  }
  if (finite(context.consumedNutrition?.fiber) < 10 && adjusted.fiber >= 15) {
    return 'Reforça a fibra que ainda falta no dia.';
  }
  if (adjusted.protein >= 48) {
    return 'Ajuda a distribuir uma dose elevada de proteína.';
  }
  if (adjusted.fiber >= 18) {
    return 'Acrescenta leguminosas e muita fibra ao dia.';
  }
  return 'Oferece um equilíbrio sólido de proteína, hidratos e vegetais.';
}

export function recommendMainMeals(meals = [], {
  calorieTarget,
  consumedNutrition = {},
  breakfastId = '',
  excludedIds = [],
  mealSlotsRemaining = 1,
  dailyProteinTarget = 135,
  dailyFiberTarget = 30,
  practicalPortions = false
} = {}) {
  const excluded = new Set(excludedIds);
  const slots = Math.max(1, Math.round(finite(mealSlotsRemaining)));
  const desiredProtein = Math.max(30, (dailyProteinTarget - finite(consumedNutrition.protein)) / slots);
  const desiredFiber = Math.max(7, (dailyFiberTarget - finite(consumedNutrition.fiber)) / slots);

  return meals
    .filter(meal => !excluded.has(meal.id))
    .map(meal => {
      const adjusted = adjustMealToCalories(meal, calorieTarget, { practicalPortions });
      if (!adjusted) return null;
      const pairingBonus = meal.pairsAfter?.includes(breakfastId) ? 8 : 0;
      const lowFiberBonus = finite(consumedNutrition.fiber) < 8 && adjusted.fiber >= 18 ? 4 : 0;
      const score = (
        Math.abs(adjusted.protein - desiredProtein) / 5
        + Math.abs(adjusted.fiber - desiredFiber) / 3
        + Math.abs(adjusted.servingFactor - 1) * 2
        - pairingBonus
        - lowFiberBonus
      );
      return {
        meal,
        adjusted,
        score: round(score, 3),
        reason: recommendationReason(meal, { consumedNutrition, breakfastId }, adjusted)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.meal.rank - b.meal.rank);
}
