import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configSource = await readFile(new URL('../js/filipa-ginasio-config.js', import.meta.url), 'utf8');
const { FILIPA_WORKOUT_TEMPLATES } = await import(
  `data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`
);

const expectedExercises = [
  ['Agachamento', 'Leg Press 45º', 'Leg Extension', 'Lunges', 'Máquina de adutores', 'Calf Raises'],
  ['Lat Pulldown', 'Seated Row', 'Puxada unilateral cruzada', 'Pullover na polia', 'Bicep Curl'],
  ['Hip Thrust', 'Deadlift com halteres', 'Leg Curl', 'Extensão da anca na polia', 'Abdução da anca na polia', 'Hiperextensão'],
  ['Chest Press', 'Shoulder Press', 'Pec Fly', 'Lateral Raises', 'Tricep Extension na polia', 'Tricep Press na polia']
];

test('configura um ginásio, quatro treinos e os 23 exercícios indicados', () => {
  assert.deepEqual(Object.keys(FILIPA_WORKOUT_TEMPLATES), ['Solinca Foz']);

  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  assert.equal(workouts.length, 4);
  assert.deepEqual(workouts.map(workout => workout.map(exercise => exercise.name)), expectedExercises);
  assert.equal(workouts.flat().length, 23);
});

test('as cargas ficam vazias e os totais de séries correspondem ao plano', () => {
  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  const exercises = workouts.flat();
  assert.deepEqual(
    workouts.map(workout => workout.reduce((total, exercise) => total + exercise.series.length, 0)),
    [15, 13, 15, 15]
  );
  exercises.forEach(exercise => {
    assert.equal(exercise.initialResistance, null);
    assert.ok(exercise.series.every(series => series.baseWeight === 0));
  });
});

test('guarda intervalos, RIR progressivo, descansos e notas especiais', () => {
  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  const squat = workouts[0][0];
  assert.equal(squat.rules.series[0].reps, '6–10');
  assert.deepEqual(squat.series.map(series => series.rir), ['2', '1-2', '1']);
  assert.equal(squat.rules.series[0].rest, '2:00–2:30');
  assert.equal(squat.rules.restMinSec, 120);

  assert.match(workouts[1][4].note, /RIR 0–1/);
  assert.match(workouts[2][0].note, /Hip Thrust \+ Deadlift/);
  assert.match(workouts[3][3].note, /RIR 0–1/);
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
  assert.doesNotMatch(gymSource, /collection\(db, 'ginasio_(?:treinos|pesos|resumos|aquecimentos|maquinas_custom|reps_recomendadas)'\)/);
  assert.match(workerSource, /\.\/js\/filipa-ginasio-config\.js/);
  assert.match(workerSource, /\.\/js\/filipa-ginasio-page\.js/);
});
