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
      breakfastSkipped: false,
      selectedLunchId: '',
      lunchExternal: false,
      selectedDinnerId: '',
      snacks: [],
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

export function adjustMealToCalories(meal, calorieTarget) {
  if (!meal || !(finite(meal.calories) > 0) || !(finite(calorieTarget) > 0)) return null;
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
  if (manual.breakfast > 0) fixed.breakfast = manual.breakfast;
  else if (breakfast) fixed.breakfast = Math.round(finite(breakfast.calories));
  else if (breakfastSkipped) fixed.breakfast = 0;
  if (manual.lunch > 0) fixed.lunch = manual.lunch;
  if (manual.dinner > 0) fixed.dinner = manual.dinner;
  if (manual.snacks > 0) fixed.snacks = manual.snacks;
  else if (hasEnteredSnacks) fixed.snacks = Math.round(snackTotals.calories);

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
  const manualItem = (name, calories) => ({ name, calories, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const resolvedBreakfast = manual.breakfast > 0
    ? manualItem('Pequeno-almoço registado', manual.breakfast)
    : (breakfastSkipped ? null : breakfast);
  const adjustedLunch = manual.lunch > 0
    ? manualItem('Almoço registado', manual.lunch)
    : adjustMealToCalories(lunch, plannedLunchCalories);
  const adjustedDinner = manual.dinner > 0
    ? manualItem('Jantar registado', manual.dinner)
    : adjustMealToCalories(dinner, plannedDinnerCalories);
  const resolvedSnacks = manual.snacks > 0
    ? [manualItem('Lanches registados', manual.snacks)]
    : snacks;
  const selectedNutrition = sumNutrition([
    resolvedBreakfast,
    adjustedLunch,
    adjustedDinner,
    ...resolvedSnacks
  ]);
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
  dailyFiberTarget = 30
} = {}) {
  const excluded = new Set(excludedIds);
  const slots = Math.max(1, Math.round(finite(mealSlotsRemaining)));
  const desiredProtein = Math.max(30, (dailyProteinTarget - finite(consumedNutrition.protein)) / slots);
  const desiredFiber = Math.max(7, (dailyFiberTarget - finite(consumedNutrition.fiber)) / slots);

  return meals
    .filter(meal => !excluded.has(meal.id))
    .map(meal => {
      const adjusted = adjustMealToCalories(meal, calorieTarget);
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
