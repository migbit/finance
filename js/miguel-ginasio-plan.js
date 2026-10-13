// Plano aprovado em 12/10/2026. As cargas e identidades das máquinas são preservadas.
export const MIGUEL_PLAN_VERSION = '2026-10-12';
export const SHORT_SUFFIX = ' — curto (exceção)';
export const normalTraining = name => name.endsWith(SHORT_SUFFIX) ? name.slice(0, -SHORT_SUFFIX.length) : name;
export const isReviewedMiguelTraining = (gym, training) =>
  (gym === 'Dragão' && ['Pernas', 'Peito + Ombro + Braços'].includes(normalTraining(training)))
  || (gym === 'Constituição' && ['Costas', 'Peito + Ombro + Braços'].includes(normalTraining(training)));
const clone = value => JSON.parse(JSON.stringify(value));

function prescribe(exercise, count, reps, rest, { rir = '1–3', introduction = '', note = '' } = {}) {
  const previous = exercise.series;
  exercise.series = Array.from({ length: count }, (_, index) => ({
    ...clone(previous[index] || previous.at(-1)),
    targetReps: Number(reps.split('–')[1]),
    rir: rir === '1–3' ? '2' : rir.replace('–', '-'),
    ...(index >= previous.length && introduction ? { introduction } : {})
  }));
  exercise.rules = {
    ...exercise.rules,
    series: exercise.series.map((_, index) => ({ reps, rir, rest: index === count - 1 ? 'fim' : rest })),
    restMinSec: rest.includes(':') ? Number(rest.split(':')[0]) * 60 + Number(rest.split(':')[1]) : Number(rest.split(' ')[0]),
    progression: 'Confirmar o topo do intervalo em todas as séries, em duas sessões normais comparáveis, com execução controlada, RIR-alvo e boa recuperação. Só depois considerar o menor aumento de carga. Não aumentar automaticamente.',
    progressCheck: []
  };
  exercise.note = note || 'Manter execução e configuração comparáveis. Ajustar se os sintomas aumentarem ou alterarem o movimento.';
  return exercise;
}

export function buildMiguelPlans(legacy) {
  const plans = clone(legacy);
  const legs = plans['Dragão']['Pernas'];
  prescribe(legs[0], 3, '8–12', '2:30', { rir: '2–3' });
  prescribe(legs[1].variants[0], 3, '10–15', '3:00', { rir: '2–3' });
  prescribe(legs[2].variants[0], 4, '10–15', '2:00', {
    introduction: 'Acrescentar só depois de consolidar a sessão completa e recuperar bem.'
  });
  // Outras máquinas/variantes conservam a prescrição anterior até revisão específica.
  prescribe(legs[3], 2, '10–15', '1:30', { rir: '2–3', note: 'Fazer se bem tolerado. Se os sintomas aumentarem, adaptar ou omitir; não substituir automaticamente por isometrias.' });
  prescribe(legs[4], 3, '8–15', '1:30', { note: 'Reintroduzir gradualmente. Se reaparecer a dor na perna, interromper e reavaliar este exercício.' });
  prescribe(legs[5], 2, '12–20', '1:15', { rir: '2–3', note: 'Reintroduzir conforme tolerância da anca, sem aumentar simultaneamente séries e carga.' });
  legs[1].note = 'A alternativa Hack Squat conserva a prescrição anterior; não comparar os quilogramas entre máquinas.';

  const back = plans['Constituição']['Costas'];
  [[3, '8–12', '2:30'], [3, '10–15', '2:30'], [2, '10–15', '2:00'],
    [2, '12–15', '1:30'], [2, '12–20', '1:30'], [2, '8–15', '1:00']]
    .forEach(([count, reps, rest], index) => prescribe(back[index], count, reps, rest,
      index === 3 || index === 5 ? { rir: '3+', note: 'Movimento controlado, com margem. Não procurar falha nem progressão automática.' } : {}));
  back[3].rules.warmup = 'Se necessário, uma série leve de preparação, separada das duas séries de trabalho.';
  back[4].rules.warmup = 'Se necessário, uma série leve de preparação, separada das duas séries de trabalho.';

  const chest = plans['Dragão']['Peito + Ombro + Braços'];
  const gradual = 'Série acrescentada: introduzir gradualmente se houver boa recuperação.';
  [[3, '8–12', '2:30'], [3, '12–20', '1:30'], [3, '12–20', '1:30'],
    [3, '10–15', '1:30'], [3, '8–12', '1:30'], [3, '8–12', '1:30'], [3, '8–12', '1:30']]
    .forEach(([count, reps, rest], index) => prescribe(chest[index], count, reps, rest, {
      introduction: gradual,
      ...(index === 1 || index === 2 ? { rir: '2–3', note: 'Usar amplitude confortável. Acrescentar a terceira série só se o ombro tolerar e recuperar bem.' } : {})
    }));
  const triceps = { id: 'triceps-choice', name: 'Tríceps', choices: [chest[3], chest[5]] };
  const biceps = { id: 'biceps-choice', name: 'Bíceps', choices: [chest[4], chest[6]] };
  plans['Dragão']['Peito + Ombro + Braços'] = [...chest.slice(0, 3), triceps, biceps];

  // Equipamento da Constituição: cargas próprias, a calibrar na primeira sessão.
  // O antigo Peito fica apenas no catálogo legado e nos registos já guardados.
  const constitutionExercise = (id, name, reps, rest, note, warmup, options = {}) => {
    const exercise = prescribe({
      id: `${id}-constituicao-pob`, name, initialResistance: null,
      series: [{ baseWeight: 0 }], rules: { warmup }
    }, 3, reps, rest, { ...options, note });
    return exercise;
  };
  const calibrate = 'Carga a definir nesta máquina: começar com 2–3 repetições em reserva. Não copiar os kg do Dragão.';
  const lightWarmup = 'Se necessário, 1×10–12 leve de familiarização | RIR 4+';
  const constitutionChest = [
    constitutionExercise('chest-press', 'Technogym Chest Press', '8–12', '2:30',
      `${calibrate} Escolher a pega horizontal ou vertical conforme conforto e execução. Registar a pega e o ajuste do banco nas notas.`,
      '1×10–12 leve | RIR 4+; Opcional: 1×6–8 de aproximação | RIR 4+'),
    constitutionExercise('pectoral', 'Technogym Pectoral', '12–20', '1:30',
      `${calibrate} Usar amplitude confortável, sem forçar o alongamento. Introduzir a terceira série conforme tolerância e recuperação do ombro.`,
      lightWarmup, { rir: '2–3' }),
    constitutionExercise('lateral-halteres', 'Elevação lateral com halteres', '12–20', '1:30',
      'Dois braços em simultâneo. Registar o peso de cada halter. Carga a definir com 2–3 repetições em reserva e amplitude confortável. Introduzir a terceira série conforme tolerância do ombro.',
      lightWarmup, { rir: '2–3' }),
    constitutionExercise('arm-extension', 'Technogym Arm Extension', '10–15', '1:30',
      `${calibrate} Ajustar o apoio e manter o movimento controlado.`, lightWarmup),
    constitutionExercise('arm-curl', 'Technogym Arm Curl', '8–12', '1:30',
      `${calibrate} Ajustar o banco e manter os braços apoiados.`, lightWarmup)
  ];
  const withAlternative = (index, id, name, note) => {
    const main = constitutionChest[index];
    const alternative = constitutionExercise(id, name, main.rules.series[0].reps, '1:30',
      note, lightWarmup, { rir: main.rules.series[0].rir });
    constitutionChest[index] = { id: `${id}-choice-constituicao`, name: main.name, choices: [main, alternative] };
  };
  withAlternative(2, 'lateral-cabo', 'Elevação lateral no cabo unilateral',
    'Carga própria do cabo, a definir. Cada série inclui os dois lados, com 12–20 repetições por lado. Usar amplitude confortável; no normal, introduzir a terceira série conforme tolerância.');
  withAlternative(3, 'triceps-cabo', 'Extensão de tríceps no cabo',
    'Alternativa à Arm Extension. Carga própria do cabo, a definir com 2–3 repetições em reserva. Registar o acessório usado nas notas.');
  withAlternative(4, 'scott-halter', 'Curl Scott com halter',
    'Alternativa à Arm Curl. Registar o peso de um halter. Cada série inclui os dois braços, com 8–12 repetições por braço. Carga a definir com 2–3 repetições em reserva.');
  delete plans['Constituição']['Peito'];
  plans['Constituição']['Peito + Ombro + Braços'] = constitutionChest;

  // As versões curtas são sessões distintas: não substituem o plano normal nem a sua progressão.
  const shorten = (exercises, counts) => exercises.flatMap((exercise, index) => {
    if (!counts[index]) return [];
    const item = clone(exercise);
    const trim = entry => {
      if (entry.choices) return entry.choices.forEach(trim);
      if (entry.variants) return entry.variants.forEach(trim);
      entry.series = entry.series.slice(0, counts[index]).map(({ introduction, ...series }) => series);
      if (entry.rules) {
        entry.rules.series = entry.rules.series.slice(0, counts[index]);
        if (entry.rules.series.length) entry.rules.series.at(-1).rest = 'fim';
        entry.rules.progressCheck = [];
        entry.rules.progression = 'Exceção por falta de tempo. Não compensar com falha ou descansos apressados. Comparar com outras sessões curtas.';
      }
    };
    trim(item);
    return [item];
  });
  plans['Dragão'][`Pernas${SHORT_SUFFIX}`] = shorten(legs, [2, 2, 2, 0, 2, 0]);
  plans['Constituição'][`Costas${SHORT_SUFFIX}`] = shorten(back, [2, 2, 0, 0, 0, 2]);
  plans['Dragão'][`Peito + Ombro + Braços${SHORT_SUFFIX}`] = shorten(plans['Dragão']['Peito + Ombro + Braços'], [3, 0, 2, 1, 1]);
  plans['Constituição'][`Peito + Ombro + Braços${SHORT_SUFFIX}`] = shorten(constitutionChest, [3, 0, 2, 1, 1]);
  return plans;
}

export function resolveExerciseChoices(template, session) {
  return clone(template).flatMap(exercise => {
    if (!exercise.choices) return [exercise];
    const selectedId = session?.exerciseChoices?.[exercise.id];
    const chosen = exercise.choices.find(item => item.id === selectedId)
      || exercise.choices.find(item => session?.machines?.[item.id]) || exercise.choices[0];
    return [{ ...chosen, choiceGroup: exercise.id,
      choiceOptions: exercise.choices.map(item => ({ id: item.id, name: item.name })) }];
  });
}

export function usesLegacyPlan(session) {
  return Boolean(session && (!session.planVersion || session.planVersion === 'legacy'));
}
