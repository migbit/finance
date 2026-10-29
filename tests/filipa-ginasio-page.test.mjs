import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const configSource = await readFile(new URL('../js/filipa-ginasio-config.js', import.meta.url), 'utf8');
const { FILIPA_WORKOUT_TEMPLATES } = await import(
  `data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`
);

const expectedExercises = [
  ['Agachamento barra', 'Leg press 45°', 'Walking lunges', 'Leg extension com anca em extensão + sentado parciais no alongamento + encurtamento', 'Adutora'],
  ['Pull up', 'Lat pulldown', 'Kassam pulldown', 'Pull over bilateral na polia', 'Bíceps inclinado com halteres + parciais no alongamento', 'Bíceps curl na polia'],
  ['Hip thrust + parciais no encurtamento', 'Seated leg curl + parciais no alongamento', 'RDL com halteres', 'Búlgaro com défice', 'Abdutora de pé', 'Abdutora sentado'],
  ['Chest press', 'Shoulder press com barra sentado', 'Lateral raise sentado com halteres', 'Overhead tricep extension na polia', 'Triceps pushdown'],
  ['Passadeira', 'Remos', 'Agachamento com press de ombros']
];

test('configura um ginásio, cinco treinos e os 25 exercícios do plano atualizado', () => {
  assert.deepEqual(Object.keys(FILIPA_WORKOUT_TEMPLATES), ['Solinca Foz']);

  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  assert.equal(workouts.length, 5);
  assert.deepEqual(workouts.map(workout => workout.map(exercise => exercise.name)), expectedExercises);
  assert.equal(workouts.flat().length, 25);
});

test('as cargas ficam vazias e os totais de séries correspondem ao plano', () => {
  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  const exercises = workouts.flat();
  assert.deepEqual(
    workouts.map(workout => workout.reduce((total, exercise) => total + exercise.series.length, 0)),
    [14, 18, 19, 20, 12]
  );
  exercises.forEach(exercise => {
    assert.equal(exercise.initialResistance, null);
    assert.ok(exercise.series.every(series => series.baseWeight === 0));
  });
});

test('as séries, repetições e RIR de todos os exercícios correspondem ao plano pedido', () => {
  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  const prescription = [
    [[3, '8–10', '1-2'], [3, '8–10', '1-2'], [3, '15', '1-2'], [4, '10–12', '1-2'], [1, '50', '1']],
    [[3, 'máx.', '0'], [4, '8–10', '1-2'], [4, '8–10', '1-2'], [3, '10–12', '1-2'], [2, '10–12', '1-2'], [2, '10–12', '1-2']],
    [[4, ['15', '12', '10', '8'], '1-2'], [3, '10–12', '1-2'], [3, '8–10', '2-3'], [3, '8–10', '1-2'], [3, '10–12', '1-2'], [3, '10–12', '1-2']],
    [[4, '10–12', '1-2'], [4, '6–8', '1-2'], [4, '8–10', '?'], [4, '10–12', '1-2'], [4, '10–12', '1-2']],
    [[4, '800 m', '—'], [4, '500 m', '—'], [4, '20', '?']]
  ];
  workouts.forEach((workout, index) => workout.forEach((exercise, exerciseIndex) => {
    const [count, reps, rir] = prescription[index][exerciseIndex];
    assert.equal(exercise.series.length, count, exercise.name);
    assert.deepEqual(exercise.rules.series.map(series => series.reps || series.volume),
      Array.isArray(reps) ? reps : Array(count).fill(reps), exercise.name);
    assert.ok(exercise.rules.series.every(series => series.rir === rir), exercise.name);
    assert.ok(exercise.series.every(series => series.rir === (exercise.completionOnly ? '?' : rir)), exercise.name);
    assert.equal(exercise.rules.restMinSec, undefined);
  }));
  assert.deepEqual(workouts[2][0].series.map(series => series.targetReps), [15, 12, 10, 8]);
});

test('os três supersets mantêm os pares e a ordem indicados', () => {
  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  for (const [workoutIndex, firstIndex] of [[0, 1], [2, 4], [3, 3]]) {
    const [first, second] = workouts[workoutIndex].slice(firstIndex, firstIndex + 2);
    assert.match(first.block, /Superset/);
    assert.equal(first.block, second.block);
    assert.match(first.note, /Superset:/);
    assert.match(second.note, /Segundo exercício/);
  }
});

test('o treino híbrido regista quatro distâncias por aparelho e quatro séries de 20 repetições', () => {
  const hybrid = FILIPA_WORKOUT_TEMPLATES['Solinca Foz']['Treino híbrido'];
  for (const [index, volume] of [[0, '800 m'], [1, '500 m']]) {
    assert.equal(hybrid[index].completionOnly, true);
    assert.equal(hybrid[index].trackIntensity, false);
    assert.ok(hybrid[index].series.every(series => series.volumeLabel === volume && series.completionOnly));
  }
  assert.equal(hybrid[2].series.length, 4);
  assert.ok(hybrid[2].series.every(series => series.targetReps === 20));
  assert.equal(hybrid[2].completionOnly, undefined);
});

test('o seletor permite registar as 50 repetições da adutora e recuperar valores superiores', async () => {
  const gymSource = await readFile(new URL('../js/ginasio.js', import.meta.url), 'utf8');
  const createRepsSelect = vm.runInNewContext(
    gymSource.slice(gymSource.indexOf('function createRepsSelect('), gymSource.indexOf('function createCompletionSelect(')) + '\ncreateRepsSelect',
    { document: { createElement: () => ({ children: [], setAttribute() {}, appendChild(child) { this.children.push(child); } }) } }
  );
  const select = createRepsSelect(50, 50);
  assert.equal(select.children.length, 51);
  assert.equal(select.children[50].selected, true);
  assert.equal(createRepsSelect().children.length, 31);
  assert.equal(createRepsSelect(55, 50).children[55].selected, true);
  assert.match(gymSource, /option value="0" \$\{rirValue === '0' \? 'selected'/);
});

test('a página monta a interface partilhada e usa armazenamento isolado', async () => {
  const [html, pageSource, gymSource, workerSource] = await Promise.all([
    readFile(new URL('../modules/filipa-ginasio.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/filipa-ginasio-page.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/ginasio.js', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8')
  ]);

  assert.match(html, /data-page="filipa-ginasio"/);
  assert.match(html, /filipa-ginasio-page\.js/);
  assert.match(pageSource, /ginasio\.html/);
  assert.match(pageSource, /import\('\.\/ginasio\.js'\)/);
  assert.match(gymSource, /collection\(db, 'users', FILIPA_UID, name\)/);
  assert.match(gymSource, /PROFILE_STORAGE_PREFIX = IS_FILIPA_GYM \? 'filipa-ginasio' : 'ginasio'/);
  assert.match(gymSource, /createCompletionSelect/);
  assert.match(gymSource, /createRpeSelect/);
  assert.match(gymSource, /series\.completionOnly/);
  assert.doesNotMatch(gymSource, /collection\(db, 'ginasio_(?:treinos|pesos|resumos|aquecimentos|maquinas_custom|reps_recomendadas)'\)/);
  assert.match(workerSource, /\.\/js\/filipa-ginasio-config\.js/);
  assert.match(workerSource, /\.\/js\/filipa-ginasio-page\.js/);
});
