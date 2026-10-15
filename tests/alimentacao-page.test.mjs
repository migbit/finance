import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../modules/alimentacao.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../js/alimentacao.js', import.meta.url), 'utf8');

test('a página abre diretamente nas receitas sem o questionário antigo', () => {
  assert.doesNotMatch(html, /Antes das receitas|Completa a etapa [“"]Necessidades[”"]|food-profile-form/);
  assert.match(html, /id="food-recipe-grid"/);
});

test('o resumo contém apenas os totais nutricionais das refeições escolhidas', () => {
  assert.match(html, /id="food-summary-calories"/);
  assert.match(html, /id="food-summary-protein"/);
  assert.match(html, /id="food-summary-carbs"/);
  assert.match(html, /id="food-summary-fat"/);
  assert.doesNotMatch(html, /Qualidade nutricional|Método e limites|food-completion-ring|food-nutrient-list/);
});

test('o plano disponibiliza quatro áreas independentes sem meta calórica', () => {
  assert.match(html, /data-food-meal-jump="breakfast"/);
  assert.match(html, /data-food-meal-jump="lunch"/);
  assert.match(html, /data-food-meal-jump="dinner"/);
  assert.match(html, /data-food-meal-jump="snacks"/);
  assert.doesNotMatch(html, /data-food-settings-open/);
  assert.doesNotMatch(html, /id="food-settings-calories"/);
  assert.doesNotMatch(html, /id="food-skip-breakfast"|id="food-external-lunch"/);
  assert.match(html, /id="food-lunch-stage"/);
  assert.match(html, /id="food-dinner-stage"/);
  assert.match(html, /id="food-snacks-stage"/);
  assert.match(html, /id="food-snack-preset-grid"/);
  assert.match(html, /id="food-snack-form"/);
  assert.doesNotMatch(html, /id="food-day-balance"/);
  assert.match(html, /value="main">Almoço ou jantar/);
  assert.doesNotMatch(html, /class="food-sequence"/);
});

test('cada refeição permite registar apenas as kcal totais', () => {
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    assert.match(html, new RegExp(`data-meal-calorie-form="${meal}"`));
  }
});

test('a página não recupera a antiga secção separada para dias de endurance', () => {
  assert.doesNotMatch(html, /food-endurance-note/);
});

test('regista porções independentes sem saldo disponível ou recomendações por défice', () => {
  assert.match(script, /calculateRecordedPlan/);
  assert.doesNotMatch(script, /calculateDailyPlan|recommendMainMeals|caloriesRemaining|calorieTarget|recalculadas/);
  assert.doesNotMatch(html, /2 400|Escolhido \/ meta|food-summary-remaining/);
  assert.match(html, /Total das refeições registadas/);
});
