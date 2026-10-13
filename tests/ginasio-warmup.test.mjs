import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../js/ginasio-warmup.js', import.meta.url), 'utf8');
const { warmupAdvice, warmupProfile, WARMUP_WINDOW_MS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = 2000000;
const sets = id => [1, 2].map(i => ({ id, name: id, reps: 10, at: now - i * 60000 }));
const mode = (id, work = []) => warmupAdvice({ id }, work, now).mode;

test('o primeiro exercício mantém preparação e uma série isolada não dispensa outro aquecimento', () => {
  assert.equal(mode('arm-extension-constituicao-pob'), 'full');
  assert.equal(mode('arm-extension-constituicao-pob', sets('chest-press-constituicao-pob').slice(0, 1)), 'full');
});
test('transferência tem direção: press prepara tríceps, tríceps não dispensa o press', () => {
  assert.equal(mode('arm-extension-constituicao-pob', sets('chest-press-constituicao-pob')), 'optional');
  assert.equal(mode('chest-press-constituicao-pob', sets('arm-extension-constituicao-pob')), 'full');
  assert.equal(mode('pectoral-constituicao-pob', sets('chest-press-constituicao-pob')), 'optional');
  assert.equal(mode('chest-press-constituicao-pob', sets('pectoral-constituicao-pob')), 'specific');
});
test('remadas/puxadas mantêm adaptação específica; bíceps pode dispensar repetição', () => {
  assert.equal(mode('seated-row-peito', sets('lat-pulldown-neutro')), 'specific');
  assert.equal(mode('lat-pulldown-neutro', sets('seated-row-peito')), 'specific');
  assert.equal(mode('biceps-curl-dragao-pob', sets('seated-row-peito')), 'optional');
});
test('não confunde músculos diferentes nem preparação geral com específica', () => {
  assert.equal(mode('leg-curl-deitado', sets('glute-trainer')), 'full');
  assert.equal(mode('seated-calf', sets('leg-press-45')), 'full');
  assert.equal(mode('leg-extension', sets('leg-press-45')), 'optional');
  assert.equal(mode('leg-press-45', sets('leg-extension')), 'specific');
  assert.equal(mode('lateral-halteres-constituicao-pob', sets('chest-press-constituicao-pob')), 'full');
  assert.equal(mode('rotacao-externa', sets('lat-pulldown-neutro')), 'full');
  assert.equal(mode('lower-back', sets('face-pull')), 'full');
  assert.equal(mode('rotacao-externa', sets('face-pull')), 'full');
});
test('registos apagados, sem hora, futuros ou antigos não contam', () => {
  for (const replacement of [{ reps: 0 }, { at: 0 }, { at: now + 1 }, { at: now - WARMUP_WINDOW_MS - 1 }]) {
    assert.equal(mode('triceps-press-dragao-pob', sets('chest-press-dragao-pob').map(set => ({ ...set, ...replacement }))), 'full');
  }
});
test('ordem da grelha é irrelevante; o trabalho realizado no próprio exercício evita repetição', () => {
  const work = [...sets('chest-press-constituicao-pob'), ...sets('arm-curl-constituicao-pob')];
  assert.deepEqual(warmupAdvice({ id: 'arm-extension-constituicao-pob' }, work, now), warmupAdvice({ id: 'arm-extension-constituicao-pob' }, work.toReversed(), now));
  assert.equal(mode('arm-curl-constituicao-pob', work), 'optional');
});
test('máquinas personalizadas/desconhecidas não recebem transferências presumidas', () => {
  assert.equal(warmupProfile('custom-press-123'), null);
  assert.equal(mode('custom-press-123', sets('chest-press-dragao-pob')), 'full');
  assert.equal(mode('arm-extension-constituicao-pob', sets('custom-press-123')), 'full');
});
