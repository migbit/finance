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

test('a página apresenta cinco momentos alimentares e uma margem separada', () => {
  for (const stage of ['breakfast', 'lunch', 'snack', 'dinner', 'bedtime']) {
    assert.match(html, new RegExp(`data-food-meal-jump="${stage}"`));
  }
  assert.match(html, /id="food-snack-grid"/);
  assert.match(html, /id="food-bedtime-grid"/);
  assert.match(html, /id="food-extra-form"/);
  assert.match(html, /Margem para extras/);
  assert.match(html, /150 kcal/);
});

test('o editor permite criar receitas para lanche e ceia', () => {
  assert.match(html, /value="snack">Lanche/);
  assert.match(html, /value="bedtime">Ceia/);
});
