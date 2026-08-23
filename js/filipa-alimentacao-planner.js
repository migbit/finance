import { adjustMealToCalories, rebalanceMealCalories, sumNutrition } from './alimentacao-planner.js';

export const FILIPA_MEAL_TARGETS = Object.freeze({
  breakfast: 330,
  lunch: 400,
  snack: 220,
  dinner: 410,
  bedtime: 140,
  extras: 150
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function applyFilipaDailyPlanDate(profile = {}, dateKey = '') {
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
      selectedSnackId: '',
      selectedBedtimeId: '',
      extras: [],
      mealCalories: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 }
    },
    didReset: true
  };
}

export function calculateFilipaDailyPlan({
  targetCalories = 1650,
  targets = FILIPA_MEAL_TARGETS,
  breakfast = null,
  breakfastSkipped = false,
  lunch = null,
  lunchExternal = false,
  dinner = null,
  snack = null,
  bedtime = null,
  extras = [],
  mealCalories = {}
} = {}) {
  const target = Math.max(0, Math.round(finite(targetCalories)));
  const extraTotals = sumNutrition(extras);
  const scaledBase = rebalanceMealCalories(target, targets);
  const manual = Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snacks'].map(key => [
    key,
    Math.max(0, Math.round(finite(mealCalories?.[key])))
  ]));
  const fixed = {
    extras: Math.max(scaledBase.extras, Math.round(extraTotals.calories))
  };
  if (manual.breakfast > 0) fixed.breakfast = manual.breakfast;
  else if (breakfast) fixed.breakfast = Math.round(finite(breakfast.calories));
  else if (breakfastSkipped) fixed.breakfast = 0;
  if (manual.lunch > 0) fixed.lunch = manual.lunch;
  if (manual.dinner > 0) fixed.dinner = manual.dinner;
  if (manual.snacks > 0) {
    fixed.snack = manual.snacks;
    fixed.bedtime = 0;
    fixed.extras = 0;
  } else {
    if (snack) fixed.snack = Math.round(finite(snack.calories));
    if (bedtime) fixed.bedtime = Math.round(finite(bedtime.calories));
  }
  const allocation = rebalanceMealCalories(target, targets, fixed);
  const breakfastCalories = allocation.breakfast;
  const lunchCalories = allocation.lunch;
  const snackCalories = allocation.snack;
  const dinnerCalories = allocation.dinner;
  const bedtimeCalories = allocation.bedtime;
  const extraBudget = scaledBase.extras;

  const manualItem = (name, calories) => ({ name, calories, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const resolvedBreakfast = manual.breakfast > 0
    ? manualItem('Pequeno-almoço registado', manual.breakfast)
    : (breakfastSkipped ? null : breakfast);
  const adjustedLunch = manual.lunch > 0
    ? manualItem('Almoço registado', manual.lunch)
    : adjustMealToCalories(lunch, lunchCalories);
  const adjustedDinner = manual.dinner > 0
    ? manualItem('Jantar registado', manual.dinner)
    : adjustMealToCalories(dinner, dinnerCalories);
  const resolvedSnack = manual.snacks > 0
    ? manualItem('Lanches registados', manual.snacks)
    : snack;
  const selectedNutrition = sumNutrition([
    resolvedBreakfast,
    adjustedLunch,
    adjustedDinner,
    resolvedSnack,
    manual.snacks > 0 ? null : bedtime,
    ...(manual.snacks > 0 ? [] : extras)
  ]);

  const reserves = {
    breakfast: !resolvedBreakfast && !breakfastSkipped ? breakfastCalories : 0,
    lunch: !adjustedLunch && !lunchExternal ? lunchCalories : 0,
    dinner: !adjustedDinner ? dinnerCalories : 0,
    snack: !resolvedSnack ? snackCalories : 0,
    bedtime: manual.snacks <= 0 && !bedtime ? bedtimeCalories : 0,
    extras: manual.snacks > 0 ? 0 : Math.max(0, extraBudget - Math.round(extraTotals.calories))
  };
  const reservedCalories = Object.values(reserves).reduce((sum, value) => sum + value, 0);
  const confirmedCalories = Math.round(selectedNutrition.calories);
  const plannedCalories = confirmedCalories + reservedCalories;
  const allMealsResolved = Boolean(
    (resolvedBreakfast || breakfastSkipped)
    && (adjustedLunch || lunchExternal)
    && adjustedDinner
    && (manual.snacks > 0 || (snack && bedtime))
  );

  return {
    targetCalories: target,
    breakfastCalories,
    lunchCalories,
    snackCalories,
    dinnerCalories,
    bedtimeCalories,
    extraBudget,
    extraTotals,
    extrasRemaining: manual.snacks > 0 ? 0 : extraBudget - Math.round(extraTotals.calories),
    adjustedLunch,
    adjustedDinner,
    selectedNutrition,
    reserves,
    reservedCalories,
    confirmedCalories,
    plannedCalories,
    caloriesRemaining: target - confirmedCalories,
    allMealsResolved,
    closesCalorieTarget: plannedCalories === target,
    hasExtraOverflow: manual.snacks <= 0 && extraTotals.calories > extraBudget
  };
}
