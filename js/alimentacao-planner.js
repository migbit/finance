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
      selectedLunchId: '',
      selectedDinnerId: '',
      snacks: []
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
  lunch = null,
  dinner = null,
  snacks = [],
  lunchTarget = 840,
  dinnerTarget = 720
} = {}) {
  const target = Math.max(0, Math.round(finite(targetCalories)));
  const breakfastCalories = finite(breakfast?.calories);
  const snackTotals = sumNutrition(snacks);
  const defaultSnackReserve = Math.max(
    0,
    target - breakfastCalories - finite(lunchTarget) - finite(dinnerTarget)
  );
  const hasEnteredSnacks = Array.isArray(snacks) && snacks.length > 0;
  const snackBudget = hasEnteredSnacks ? snackTotals.calories : defaultSnackReserve;
  const plannedLunchCalories = Math.max(0, Math.round(finite(lunchTarget)));
  const plannedDinnerCalories = Math.max(
    0,
    target - breakfastCalories - plannedLunchCalories - Math.round(snackBudget)
  );
  const adjustedLunch = adjustMealToCalories(lunch, plannedLunchCalories);
  const adjustedDinner = adjustMealToCalories(dinner, plannedDinnerCalories);
  const selectedNutrition = sumNutrition([
    breakfast,
    adjustedLunch,
    adjustedDinner,
    ...snacks
  ]);
  const allMealsSelected = Boolean(breakfast && lunch && dinner);
  const reservedSnackCalories = allMealsSelected && !hasEnteredSnacks ? defaultSnackReserve : 0;
  const plannedCalories = Math.round(selectedNutrition.calories + reservedSnackCalories);

  return {
    targetCalories: target,
    lunchCalories: plannedLunchCalories,
    dinnerCalories: plannedDinnerCalories,
    snackBudget: Math.round(snackBudget),
    snackTotals,
    adjustedLunch,
    adjustedDinner,
    selectedNutrition,
    reservedSnackCalories: Math.round(reservedSnackCalories),
    confirmedCalories: Math.round(selectedNutrition.calories),
    plannedCalories,
    caloriesRemaining: target - Math.round(selectedNutrition.calories),
    allMealsSelected,
    closesCalorieTarget: allMealsSelected && plannedCalories === target
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
    .sort((a, b) => a.score - b.score || a.meal.rank - b.meal.rank);
}
