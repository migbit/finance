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
  ['Chest Press', 'Shoulder Press', 'Pec Fly', 'Lateral Raises', 'Tricep Extension na polia', 'Tricep Press na polia'],
  ['Bicicleta ou remo', 'Mobilidade + acelerações', 'Kettlebell Swing', 'Push-ups', 'Bicicleta — intervalos', 'Bicicleta / remo / caminhada inclinada']
];

test('configura um ginásio, cinco treinos e os 29 exercícios indicados', () => {
  assert.deepEqual(Object.keys(FILIPA_WORKOUT_TEMPLATES), ['Solinca Foz']);

  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  assert.equal(workouts.length, 5);
  assert.deepEqual(workouts.map(workout => workout.map(exercise => exercise.name)), expectedExercises);
  assert.equal(workouts.flat().length, 29);
});

test('as cargas ficam vazias e os totais de séries correspondem ao plano', () => {
  const workouts = Object.values(FILIPA_WORKOUT_TEMPLATES['Solinca Foz']);
  const exercises = workouts.flat();
  assert.deepEqual(
    workouts.map(workout => workout.reduce((total, exercise) => total + exercise.series.length, 0)),
    [15, 13, 15, 15, 19]
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

test('o treino híbrido mantém blocos, volumes, RPE e duração prevista', () => {
  const hybrid = FILIPA_WORKOUT_TEMPLATES['Solinca Foz']['Treino híbrido'];
  assert.deepEqual(hybrid.map(exercise => exercise.block), [
    '1. Aquecimento',
    '1. Aquecimento',
    '2. Força/potência — EMOM',
    '2. Força/potência — EMOM',
    '3. Cardio intervalado',
    '4. Cardio fácil'
  ]);
  assert.equal(hybrid[0].completionOnly, true);
  assert.equal(hybrid[0].rules.series[0].volume, '3 min progressivo');
  assert.equal(hybrid[0].rules.series[0].rir, 'RPE 3 → 5');
  assert.equal(hybrid[2].series.length, 4);
  assert.equal(hybrid[2].rules.series[0].rir, '3-4');
  assert.equal(hybrid[4].series.length, 8);
  assert.equal(hybrid[4].series[0].volumeLabel, '45 s forte + 75 s fácil');
  assert.match(hybrid[5].note, /31–35 min/);
  assert.match(hybrid[5].note, /sem criar fadiga excessiva nas pernas/);
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
