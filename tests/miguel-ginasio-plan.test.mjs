import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../js/ginasio.js', import.meta.url), 'utf8');
const planSource = await readFile(new URL('../js/miguel-ginasio-plan.js', import.meta.url), 'utf8');
const { buildMiguelPlans, resolveExerciseChoices, usesLegacyPlan, isReviewedMiguelTraining, normalTraining, SHORT_SUFFIX } = await import(
  `data:text/javascript;base64,${Buffer.from(planSource).toString('base64')}`
);
const legacy = JSON.parse(JSON.stringify(vm.runInNewContext(
  source.slice(source.indexOf('const MIGUEL_LEGACY_TEMPLATES'), source.indexOf('const MIGUEL_WORKOUT_TEMPLATES')) + '\nMIGUEL_LEGACY_TEMPLATES'
)));
const original = JSON.stringify(legacy);
const plans = buildMiguelPlans(legacy);
const dose = workout => resolveExerciseChoices(workout).map(exercise =>
  (exercise.variants?.find(item => item.id === exercise.defaultVariant) || exercise).series.length);

test('plano aprovado: doses normais 17/14/15, sem modificar o plano legado', () => {
  assert.deepEqual(dose(plans['Dragão'].Pernas), [3, 3, 4, 2, 3, 2]);
  assert.deepEqual(dose(plans['Constituição'].Costas), [3, 3, 2, 2, 2, 2]);
  assert.deepEqual(dose(plans['Dragão']['Peito + Ombro + Braços']), [3, 3, 3, 3, 3]);
  assert.equal(JSON.stringify(legacy), original);
});

test('conserva outras combinações, máquinas e cargas não revistas', () => {
  assert.deepEqual(plans['Arrábida'], legacy['Arrábida']);
  assert.deepEqual(plans['Constituição'].Pernas, legacy['Constituição'].Pernas);
  for (const name of ['Peito', 'Braços']) assert.deepEqual(plans['Dragão'][name], legacy['Dragão'][name]);
  assert.deepEqual(plans['Dragão'].Pernas[1].variants[1], legacy['Dragão'].Pernas[1].variants[1]);
  assert.deepEqual(plans['Dragão'].Pernas[2].variants[1], legacy['Dragão'].Pernas[2].variants[1]);
  assert.deepEqual(plans['Dragão'].Pernas[0].series.map(s => s.baseWeight), legacy['Dragão'].Pernas[0].series.map(s => s.baseWeight));
});

test('curtos excecionais têm 8/6/7 séries e não alteram o plano normal', () => {
  for (const [gym, name, expected] of [['Dragão', 'Pernas', [2, 2, 2, 2]], ['Constituição', 'Costas', [2, 2, 2]], ['Dragão', 'Peito + Ombro + Braços', [3, 2, 1, 1]], ['Constituição', 'Peito + Ombro + Braços', [3, 2, 1, 1]]]) {
    assert.deepEqual(dose(plans[gym][name + SHORT_SUFFIX]), expected);
    assert.equal(normalTraining(name + SHORT_SUFFIX), name);
    assert.equal(normalTraining(name), name);
  }
  assert.deepEqual(dose(plans['Dragão'].Pernas), [3, 3, 4, 2, 3, 2]);
});

test('alternativas preservam IDs/cargas e escolhem apenas um exercício por grupo', () => {
  const workout = plans['Dragão']['Peito + Ombro + Braços'];
  const chosen = resolveExerciseChoices(workout, { exerciseChoices: { 'triceps-choice': 'triceps-extension-dragao-pob', 'biceps-choice': 'biceps-curl-dragao-pob' } });
  assert.equal(chosen.length, 5);
  assert.equal(chosen[3].id, 'triceps-extension-dragao-pob');
  assert.equal(chosen[4].id, 'biceps-curl-dragao-pob');
  assert.equal(chosen[3].series[0].baseWeight, legacy['Dragão']['Peito + Ombro + Braços'][5].series[0].baseWeight);
  assert.equal(resolveExerciseChoices(workout, { machines: { 'biceps-curl-dragao-pob': {} } })[4].id, 'biceps-curl-dragao-pob');
});

test('treinos e rascunhos antigos conservam a estrutura original', () => {
  assert.equal(usesLegacyPlan(null), false);
  assert.equal(usesLegacyPlan({ machines: {} }), true);
  assert.equal(usesLegacyPlan({ planVersion: 'legacy' }), true);
  assert.equal(usesLegacyPlan({ planVersion: '2026-10-12' }), false);
});

test('RIR predefinido pode ser representado no seletor, sem cair na opção falha', () => {
  const supported = new Set(['?', 'falha', '0-1', '1', '2', '3', '2+', '3+', '2-4', '1-2', '2-3', '3-4', '3-5', '4+']);
  const verify = exercise => {
    if (exercise.choices) return exercise.choices.forEach(verify);
    if (exercise.variants) return exercise.variants.forEach(verify);
    for (const series of exercise.series) assert.ok(supported.has(series.rir), `${exercise.id}: ${series.rir}`);
  };
  for (const [gym, name] of [['Dragão', 'Pernas'], ['Dragão', 'Peito + Ombro + Braços'], ['Constituição', 'Costas'], ['Constituição', 'Peito + Ombro + Braços']]) plans[gym][name].forEach(verify);
});

test('Constituição substitui Peito por cinco exercícios, com cargas independentes e legado intacto', () => {
  const name = 'Peito + Ombro + Braços';
  const exercises = resolveExerciseChoices(plans['Constituição'][name]);
  assert.equal(Object.hasOwn(plans['Constituição'], 'Peito'), false);
  assert.deepEqual(exercises.map(e => e.name), ['Technogym Chest Press', 'Technogym Pectoral',
    'Elevação lateral com halteres', 'Technogym Arm Extension', 'Technogym Arm Curl']);
  assert.deepEqual(dose(exercises), [3, 3, 3, 3, 3]);
  assert.deepEqual(exercises.map(e => e.rules.series[0].reps), ['8–12', '12–20', '12–20', '10–15', '8–12']);
  assert.deepEqual(exercises.map(e => e.rules.restMinSec), [150, 90, 90, 90, 90]);
  const oldIds = new Set(Object.values(legacy).flatMap(gym => Object.values(gym).flat()).map(e => e.id));
  for (const exercise of exercises) {
    assert.equal(oldIds.has(exercise.id), false);
    assert.ok(exercise.series.every(s => s.baseWeight === 0));
    assert.deepEqual(exercise.rules.progressCheck, []);
  }
  assert.equal(isReviewedMiguelTraining('Constituição', name), true);
  assert.equal(isReviewedMiguelTraining('Constituição', name + SHORT_SUFFIX), true);
  assert.equal(isReviewedMiguelTraining('Constituição', 'Peito'), false);
  assert.equal(legacy['Constituição'].Peito.length, 4);
  assert.equal(JSON.stringify(legacy), original);
});

test('alternativas da Constituição mantêm a dose e a seleção no curto e no normal', () => {
  const selection = { exerciseChoices: {
    'lateral-cabo-choice-constituicao': 'lateral-cabo-constituicao-pob',
    'triceps-cabo-choice-constituicao': 'triceps-cabo-constituicao-pob',
    'scott-halter-choice-constituicao': 'scott-halter-constituicao-pob'
  } };
  for (const suffix of ['', SHORT_SUFFIX]) {
    const chosen = resolveExerciseChoices(plans['Constituição']['Peito + Ombro + Braços' + suffix], selection);
    assert.deepEqual(chosen.slice(-3).map(e => e.id), Object.values(selection.exerciseChoices));
    assert.deepEqual(dose(chosen), suffix ? [3, 2, 1, 1] : [3, 3, 3, 3, 3]);
    assert.ok(chosen.flatMap(e => e.series).every(s => s.baseWeight === 0));
  }
});

test('séries omitidas não duplicam valores de outras séries ao recuperar um treino', () => {
  const fn = vm.runInNewContext(source.slice(source.indexOf('function getSavedSeries('), source.indexOf('function getSavedWarmup(')) + '\ngetSavedSeries');
  const saved = { series: [{ seriesIndex: 0, reps: 12 }, { seriesIndex: 2, reps: 9 }] };
  assert.equal(fn(saved, 1).reps, undefined);
  assert.equal(fn(saved, 2).reps, 9);
  assert.equal(fn({ series: [{ reps: 8 }] }, 0).reps, 8);
});
