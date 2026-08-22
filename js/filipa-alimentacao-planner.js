import { adjustMealToCalories, sumNutrition } from './alimentacao-planner.js';

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

function selectedCalories(item, fallback) {
  return item && finite(item.calories) > 0
    ? Math.round(finite(item.calories))
    : Math.max(0, Math.round(finite(fallback)));
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
      extras: []
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
  extras = []
} = {}) {
  const target = Math.max(0, Math.round(finite(targetCalories)));
  const breakfastCalories = breakfastSkipped
    ? 0
    : selectedCalories(breakfast, targets.breakfast);
  const lunchCalories = Math.max(0, Math.round(finite(targets.lunch)));
  const snackCalories = selectedCalories(snack, targets.snack);
  const bedtimeCalories = selectedCalories(bedtime, targets.bedtime);
  const extraTotals = sumNutrition(extras);
  const extraBudget = Math.max(0, Math.round(finite(targets.extras)));
  const plannedExtrasCalories = Math.max(extraBudget, Math.round(extraTotals.calories));
  const dinnerCalories = Math.max(
    0,
    target
      - breakfastCalories
      - lunchCalories
      - snackCalories
      - bedtimeCalories
      - plannedExtrasCalories
  );

  const adjustedLunch = adjustMealToCalories(lunch, lunchCalories);
  const adjustedDinner = adjustMealToCalories(dinner, dinnerCalories);
  const selectedNutrition = sumNutrition([
    breakfastSkipped ? null : breakfast,
    adjustedLunch,
    adjustedDinner,
    snack,
    bedtime,
    ...extras
  ]);

  const reserves = {
    breakfast: !breakfast && !breakfastSkipped ? breakfastCalories : 0,
    lunch: !lunch ? lunchCalories : 0,
    dinner: !dinner ? dinnerCalories : 0,
    snack: !snack ? snackCalories : 0,
    bedtime: !bedtime ? bedtimeCalories : 0,
    extras: Math.max(0, extraBudget - Math.round(extraTotals.calories))
  };
  const reservedCalories = Object.values(reserves).reduce((sum, value) => sum + value, 0);
  const confirmedCalories = Math.round(selectedNutrition.calories);
  const plannedCalories = confirmedCalories + reservedCalories;
  const allMealsResolved = Boolean(
    (breakfast || breakfastSkipped)
    && (lunch || lunchExternal)
    && dinner
    && snack
    && bedtime
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
    extrasRemaining: extraBudget - Math.round(extraTotals.calories),
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
    hasExtraOverflow: extraTotals.calories > extraBudget
  };
}
