function createExercise(id, name, {
  seriesCount, reps, targetReps, repsBySeries = null, rir = '1-2', block = '', note = ''
}) {
  return {
    id, name, block, initialResistance: null,
    series: Array.from({ length: seriesCount }, (_, index) => ({
      baseWeight: 0, targetReps: repsBySeries?.[index] ?? targetReps, rir
    })),
    rules: {
      series: Array.from({ length: seriesCount }, (_, index) => ({
        reps: repsBySeries ? String(repsBySeries[index]) : reps, rir, rest: '—'
      }))
    },
    note
  };
}

function createDistanceBlock(id, name, volume) {
  return {
    id, name, initialResistance: null, completionOnly: true,
    trackIntensity: false, completionLabel: 'série',
    series: Array.from({ length: 4 }, () => ({
      baseWeight: 0, targetReps: 1, rir: '?', completionOnly: true,
      completionLabel: 'série', volumeLabel: volume
    })),
    rules: { series: Array.from({ length: 4 }, () => ({ volume, rir: '—', rest: '—' })) }
  };
}

export const FILIPA_WORKOUT_TEMPLATES = {
  'Solinca Foz': {
    'Inferiores · Quadríceps e adutores': [
      createExercise('agachamento-barra', 'Agachamento barra', {
        seriesCount: 3, reps: '8–10', targetReps: 8
      }),
      createExercise('leg-press-45', 'Leg press 45°', {
        seriesCount: 3, reps: '8–10', targetReps: 8,
        block: '2. Superset · Leg press 45° → Walking lunges',
        note: 'Superset: fazer Leg press 45° e depois Walking lunges. Repetir 3 vezes.'
      }),
      createExercise('walking-lunges', 'Walking lunges', {
        seriesCount: 3, reps: '15', targetReps: 15,
        block: '2. Superset · Leg press 45° → Walking lunges',
        note: 'Segundo exercício do superset com Leg press 45°.'
      }),
      createExercise('leg-extension-anca-extensao-parciais', 'Leg extension com anca em extensão + sentado parciais no alongamento + encurtamento', {
        seriesCount: 4, reps: '10–12', targetReps: 10, block: '3. Leg extension',
        note: 'Anca em extensão + sentado com parciais no alongamento + encurtamento.'
      }),
      createExercise('adutores', 'Adutora', {
        seriesCount: 1, reps: '50', targetReps: 50, rir: '1', block: '4. Adutora'
      })
    ],
    'Superiores · Costas e bíceps': [
      createExercise('pull-up', 'Pull up', {
        seriesCount: 3, reps: 'máx.', targetReps: 0, rir: '0'
      }),
      createExercise('lat-pulldown', 'Lat pulldown', {
        seriesCount: 4, reps: '8–10', targetReps: 8
      }),
      createExercise('kassam-pulldown', 'Kassam pulldown', {
        seriesCount: 4, reps: '8–10', targetReps: 8
      }),
      createExercise('pullover-bilateral-polia', 'Pull over bilateral na polia', {
        seriesCount: 3, reps: '10–12', targetReps: 10
      }),
      createExercise('biceps-inclinado-halteres-parciais', 'Bíceps inclinado com halteres + parciais no alongamento', {
        seriesCount: 2, reps: '10–12', targetReps: 10,
        note: 'Acrescentar parciais no alongamento.'
      }),
      createExercise('biceps-curl-polia', 'Bíceps curl na polia', {
        seriesCount: 2, reps: '10–12', targetReps: 10
      })
    ],
    'Inferiores · Posteriores e glúteos': [
      createExercise('hip-thrust-parciais', 'Hip thrust + parciais no encurtamento', {
        seriesCount: 4, repsBySeries: [15, 12, 10, 8],
        note: 'Acrescentar parciais no encurtamento em cada série.'
      }),
      createExercise('seated-leg-curl-parciais', 'Seated leg curl + parciais no alongamento', {
        seriesCount: 3, reps: '10–12', targetReps: 10,
        note: 'Acrescentar parciais no alongamento.'
      }),
      createExercise('rdl-halteres', 'RDL com halteres', {
        seriesCount: 3, reps: '8–10', targetReps: 8, rir: '2-3'
      }),
      createExercise('bulgaro-deficit', 'Búlgaro com défice', {
        seriesCount: 3, reps: '8–10', targetReps: 8
      }),
      createExercise('abdutora-pe', 'Abdutora de pé', {
        seriesCount: 3, reps: '10–12', targetReps: 10,
        block: '5. Superset · Abdutora de pé → Abdutora sentado',
        note: 'Superset: fazer Abdutora de pé e depois Abdutora sentado. Repetir 3 vezes.'
      }),
      createExercise('abdutora-sentado', 'Abdutora sentado', {
        seriesCount: 3, reps: '10–12', targetReps: 10,
        block: '5. Superset · Abdutora de pé → Abdutora sentado',
        note: 'Segundo exercício do superset com Abdutora de pé.'
      })
    ],
    'Superiores · Peitoral, ombros e tríceps': [
      createExercise('chest-press', 'Chest press', {
        seriesCount: 4, reps: '10–12', targetReps: 10
      }),
      createExercise('shoulder-press-barra-sentado', 'Shoulder press com barra sentado', {
        seriesCount: 4, reps: '6–8', targetReps: 6
      }),
      createExercise('lateral-raise-sentado-halteres', 'Lateral raise sentado com halteres', {
        seriesCount: 4, reps: '8–10', targetReps: 8, rir: '?'
      }),
      createExercise('overhead-tricep-extension-polia', 'Overhead tricep extension na polia', {
        seriesCount: 4, reps: '10–12', targetReps: 10,
        block: '4. Superset · Overhead tricep extension → Triceps pushdown',
        note: 'Superset: fazer Overhead tricep extension na polia e depois Triceps pushdown. Repetir 4 vezes.'
      }),
      createExercise('triceps-pushdown', 'Triceps pushdown', {
        seriesCount: 4, reps: '10–12', targetReps: 10,
        block: '4. Superset · Overhead tricep extension → Triceps pushdown',
        note: 'Segundo exercício do superset com Overhead tricep extension na polia.'
      })
    ],
    'Treino híbrido': [
      createDistanceBlock('hibrido-passadeira-800m', 'Passadeira', '800 m'),
      createDistanceBlock('hibrido-remo-500m', 'Remos', '500 m'),
      createExercise('hibrido-agachamento-press-ombros', 'Agachamento com press de ombros', {
        seriesCount: 4, reps: '20', targetReps: 20, rir: '?'
      })
    ]
  }
};
