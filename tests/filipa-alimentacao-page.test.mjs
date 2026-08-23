import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../modules/filipa-alimentacao.html', import.meta.url), 'utf8');

test('a página da Filipa usa o módulo e o estilo de alimentação próprios', () => {
  assert.match(html, /data-page="filipa-alimentacao"/);
  assert.match(html, /css\/alimentacao\.css/);
  assert.match(html, /js\/filipa-alimentacao\.js/);
  assert.match(html, /Base diária · 1 650 kcal/);
});

test('a página apresenta quatro áreas iguais e agrupa lanche, ceia e extras', () => {
  for (const stage of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    assert.match(html, new RegExp(`data-food-meal-jump="${stage}"`));
  }
  assert.doesNotMatch(html, /data-food-meal-jump="snack"|data-food-meal-jump="bedtime"/);
  assert.match(html, /id="food-snack-grid"/);
  assert.match(html, /id="food-bedtime-grid"/);
  assert.match(html, /id="food-extra-form"/);
  assert.match(html, /Margem para extras/);
  assert.match(html, /data-food-snack-substage/);
});

test('a meta diária é a única configuração e todas as refeições aceitam kcal totais', () => {
  assert.match(html, /data-food-settings-open/);
  assert.match(html, /id="food-settings-calories"/);
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    assert.match(html, new RegExp(`data-meal-calorie-form="${meal}"`));
  }
  assert.doesNotMatch(html, /id="food-skip-breakfast"|id="food-external-lunch"/);
});

test('o editor permite criar receitas para lanche e ceia', () => {
  assert.match(html, /value="snack">Lanche/);
  assert.match(html, /value="bedtime">Ceia/);
});
