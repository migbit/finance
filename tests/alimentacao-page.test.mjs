import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../modules/alimentacao.html', import.meta.url), 'utf8');

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

test('o plano disponibiliza pequeno-almoço, almoço e jantar de forma independente', () => {
  assert.match(html, /data-food-meal-jump="breakfast"/);
  assert.match(html, /data-food-meal-jump="lunch"/);
  assert.match(html, /data-food-meal-jump="dinner"/);
  assert.match(html, /id="food-skip-breakfast"/);
  assert.match(html, /id="food-external-lunch"/);
  assert.match(html, /id="food-lunch-stage"/);
  assert.match(html, /id="food-dinner-stage"/);
  assert.match(html, /id="food-snacks-stage"/);
  assert.match(html, /id="food-snack-preset-grid"/);
  assert.match(html, /id="food-snack-form"/);
  assert.match(html, /id="food-day-balance"/);
  assert.match(html, /value="main">Almoço ou jantar/);
  assert.doesNotMatch(html, /class="food-sequence"/);
});

test('a página não recupera a antiga secção separada para dias de endurance', () => {
  assert.doesNotMatch(html, /food-endurance-note/);
});
