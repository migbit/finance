function createExercise(id, name, {
  seriesCount,
  reps,
  targetReps,
  rir = '1-2',
  rirBySeries = null,
  rest,
  restMinSec,
  note = ''
}) {
  const prescribedRir = rirBySeries || Array.from({ length: seriesCount }, () => rir);

  return {
    id,
    name,
    initialResistance: null,
    series: Array.from({ length: seriesCount }, (_, index) => ({
      baseWeight: 0,
      targetReps,
      rir: prescribedRir[index]
    })),
    rules: {
      series: Array.from({ length: seriesCount }, (_, index) => ({
        reps,
        rir: prescribedRir[index],
        rest: index === seriesCount - 1 ? 'fim' : rest
      })),
      restMinSec
    },
    note
  };
}

const descendingRir = ['2', '1-2', '1'];

export const FILIPA_WORKOUT_TEMPLATES = {
  'Solinca Foz': {
    'Inferiores · Quadríceps, gémeos e adutores': [
      createExercise('agachamento', 'Agachamento', {
        seriesCount: 3,
        reps: '6–10',
        targetReps: 6,
        rirBySeries: descendingRir,
        rest: '2:00–2:30',
        restMinSec: 120
      }),
      createExercise('leg-press-45', 'Leg Press 45º', {
        seriesCount: 3,
        reps: '8–12',
        targetReps: 8,
        rirBySeries: descendingRir,
        rest: '2:00',
        restMinSec: 120
      }),
      createExercise('leg-extension', 'Leg Extension', {
        seriesCount: 2,
        reps: '10–15',
        targetReps: 10,
        rest: '1:15–1:30',
        restMinSec: 75
      }),
      createExercise('lunges', 'Lunges', {
        seriesCount: 2,
        reps: '8–12 / perna',
        targetReps: 8,
        rest: '1:30–2:00',
        restMinSec: 90
      }),
      createExercise('adutores', 'Máquina de adutores', {
        seriesCount: 2,
        reps: '12–20',
        targetReps: 12,
        rest: '1:00–1:15',
        restMinSec: 60
      }),
      createExercise('calf-raises', 'Calf Raises', {
        seriesCount: 3,
        reps: '8–15',
        targetReps: 8,
        rest: '1:00–1:30',
        restMinSec: 60
      })
    ],
    'Superiores · Costas e bíceps': [
      createExercise('lat-pulldown', 'Lat Pulldown', {
        seriesCount: 3,
        reps: '8–12',
        targetReps: 8,
        rirBySeries: descendingRir,
        rest: '1:30–2:00',
        restMinSec: 90
      }),
      createExercise('seated-row', 'Seated Row', {
        seriesCount: 3,
        reps: '8–12',
        targetReps: 8,
        rirBySeries: descendingRir,
        rest: '1:30–2:00',
        restMinSec: 90
      }),
      createExercise('puxada-unilateral-cruzada', 'Puxada unilateral cruzada', {
        seriesCount: 2,
        reps: '10–15 / lado',
        targetReps: 10,
        rest: '1:00–1:30',
        restMinSec: 60,
        note: 'Executar na polia alta, um lado de cada vez.'
      }),
      createExercise('pullover-polia-barra', 'Pullover na polia', {
        seriesCount: 2,
        reps: '10–15',
        targetReps: 10,
        rest: '1:00–1:30',
        restMinSec: 60,
        note: 'Executar na polia alta com barra, puxando de cima para baixo.'
      }),
      createExercise('bicep-curl', 'Bicep Curl', {
        seriesCount: 3,
        reps: '8–15',
        targetReps: 8,
        rest: '1:00–1:30',
        restMinSec: 60,
        note: 'Na última série pode ocasionalmente chegar a RIR 0–1, desde que a técnica não se deteriore.'
      })
    ],
    'Inferiores · Posteriores e glúteos': [
      createExercise('hip-thrust', 'Hip Thrust', {
        seriesCount: 3,
        reps: '6–10',
        targetReps: 6,
        rirBySeries: descendingRir,
        rest: '2:00',
        restMinSec: 120,
        note: 'Monitorizar a combinação Hip Thrust + Deadlift + extensão da anca + hiperextensão. Depois dos primeiros registos, avaliar se um deles pode ser retirado sem perder resultados.'
      }),
      createExercise('deadlift-halteres', 'Deadlift com halteres', {
        seriesCount: 3,
        reps: '6–10',
        targetReps: 6,
        rirBySeries: descendingRir,
        rest: '2:00–2:30',
        restMinSec: 120
      }),
      createExercise('leg-curl', 'Leg Curl', {
        seriesCount: 3,
        reps: '10–15',
        targetReps: 10,
        rest: '1:15–1:30',
        restMinSec: 75
      }),
      createExercise('extensao-anca-polia', 'Extensão da anca na polia', {
        seriesCount: 2,
        reps: '10–15 / perna',
        targetReps: 10,
        rest: '1:00–1:15',
        restMinSec: 60,
        note: 'Executar com tornozeleira.'
      }),
      createExercise('abducao-anca-polia', 'Abdução da anca na polia', {
        seriesCount: 2,
        reps: '12–20 / perna',
        targetReps: 12,
        rest: '1:00–1:15',
        restMinSec: 60,
        note: 'Executar com tornozeleira, logo após a extensão da anca.'
      }),
      createExercise('hiperextensao', 'Hiperextensão', {
        seriesCount: 2,
        reps: '10–15',
        targetReps: 10,
        rir: '2',
        rest: '1:00–1:30',
        restMinSec: 60
      })
    ],
    'Superiores · Peitoral, ombros e tríceps': [
      createExercise('chest-press', 'Chest Press', {
        seriesCount: 3,
        reps: '8–12',
        targetReps: 8,
        rirBySeries: descendingRir,
        rest: '1:30–2:00',
        restMinSec: 90
      }),
      createExercise('shoulder-press', 'Shoulder Press', {
        seriesCount: 3,
        reps: '8–12',
        targetReps: 8,
        rirBySeries: descendingRir,
        rest: '1:30–2:00',
        restMinSec: 90
      }),
      createExercise('pec-fly', 'Pec Fly', {
        seriesCount: 2,
        reps: '10–15',
        targetReps: 10,
        rest: '1:00–1:30',
        restMinSec: 60,
        note: 'Sentada na máquina, abrir e fechar os braços.'
      }),
      createExercise('lateral-raises', 'Lateral Raises', {
        seriesCount: 3,
        reps: '12–20',
        targetReps: 12,
        rest: '1:00–1:15',
        restMinSec: 60,
        note: 'Na última série pode ocasionalmente chegar a RIR 0–1.'
      }),
      createExercise('tricep-extension-polia', 'Tricep Extension na polia', {
        seriesCount: 2,
        reps: '10–15',
        targetReps: 10,
        rest: '1:00–1:15',
        restMinSec: 60,
        note: 'Na última série pode ocasionalmente chegar a RIR 0–1.'
      }),
      createExercise('tricep-press-polia', 'Tricep Press na polia', {
        seriesCount: 2,
        reps: '10–15',
        targetReps: 10,
        rest: '1:00–1:15',
        restMinSec: 60,
        note: 'Na última série pode ocasionalmente chegar a RIR 0–1.'
      })
    ]
  }
};
