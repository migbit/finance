import { db, copiarMensagem } from './script.js';
import { showToast } from './toast.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const WORKOUT_TEMPLATES = {
  'Dragão': {
    'Pernas': [
      {
        id: 'glute-trainer',
        name: 'Glute Trainer / Hip Thrust',
        initialResistance: 22.7,
        series: [
          { baseWeight: 20, targetReps: 7, rir: '?' },
          { baseWeight: 29.8, targetReps: 8, rir: '?' },
          { baseWeight: 29.8, targetReps: 9, rir: '?' }
        ],
        rules: {
          series: [
            { reps: '6–8', rir: '2–3', rest: '2:30–3:30' },
            { reps: '8–9', rir: '2', rest: '2:30–3:30' },
            { reps: '8–10', rir: '1–2', rest: 'fim' }
          ],
          progression: 'S1 ≥8, S2 ≥9, S3 ≥10 com os RIR acima → +1 pino',
          warmup: '1 série a ~70% da carga de trabalho × 6 reps | RIR 4+ | descanso 90 s',
          restMinSec: 150,
          progressCheck: [
            { minReps: 8, rirMin: 2, rirMax: 3 },
            { minReps: 9, rirMin: 2, rirMax: 2 },
            { minReps: 10, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'leg-press-hack',
        name: 'Leg press / Hack Squat',
        variants: [
          {
            id: 'leg-press-45',
            label: 'Leg press 45º',
            initialResistance: 75.7,
            series: [
              { baseWeight: 40, targetReps: 10, rir: '3+' },
              { baseWeight: 80, targetReps: 10, rir: '3+' },
              { baseWeight: 120, targetReps: 12, rir: '2-4' }
            ],
            rules: {
              series: [
                { reps: '8–10', rir: '2–3', rest: '2:30–4:00' },
                { reps: '9–11', rir: '2', rest: '2:30–4:00' },
                { reps: '10–12', rir: '1–2', rest: 'fim' }
              ],
              progression: '3 séries ≥12 com os RIR acima → +1 pino',
              warmup: '1 série a ~60% da carga de trabalho × 8 reps | RIR 4+ | descanso 90 s',
              restMinSec: 150,
              progressCheck: [
                { minReps: 12, rirMin: 2, rirMax: 3 },
                { minReps: 12, rirMin: 2, rirMax: 2 },
                { minReps: 12, rirMin: 1, rirMax: 2 }
              ]
            }
          },
          {
            id: 'hack-squat',
            label: 'Hack Squat',
            initialResistance: 47.6,
            series: [
              { baseWeight: 20, targetReps: 8, rir: '2' },
              { baseWeight: 20, targetReps: 8, rir: '2' },
              { baseWeight: 20, targetReps: 8, rir: '2' }
            ]
          }
        ],
        defaultVariant: 'leg-press-45'
      },
      {
        id: 'leg-curl',
        name: 'Leg curl',
        variants: [
          {
            id: 'leg-curl-deitado',
            label: 'Leg curl deitado',
            initialResistance: 9.5,
            series: [
              { baseWeight: 40, targetReps: 12, rir: '?' },
              { baseWeight: 40, targetReps: 12, rir: '?' },
              { baseWeight: 45, targetReps: 10, rir: '2' }
            ],
            rules: {
              series: [
                { reps: '8–10', rir: '2–3', rest: '90–150 s' },
                { reps: '10–12', rir: '2', rest: '90–150 s' },
                { reps: '10–12', rir: '1–2', rest: 'fim' }
              ],
              progression: 'Todas ≥12 com os RIR acima → +1 pino',
              warmup: '1 série a ~60% × 10 reps | RIR 4+ | descanso 60–90 s',
              restMinSec: 90,
              progressCheck: [
                { minReps: 12, rirMin: 2, rirMax: 3 },
                { minReps: 12, rirMin: 2, rirMax: 2 },
                { minReps: 12, rirMin: 1, rirMax: 2 }
              ]
            }
          },
          {
            id: 'leg-curl-sentado',
            label: 'Leg curl sentado',
            initialResistance: null,
            series: [
              { baseWeight: 35, targetReps: 14, rir: '2' },
              { baseWeight: 35, targetReps: 14, rir: '2' },
              { baseWeight: 35, targetReps: 14, rir: '1-2' }
            ],
            rules: {
              series: [
                { reps: '10–14', rir: '2', rest: '90–150 s' },
                { reps: '10–14', rir: '2', rest: '90–150 s' },
                { reps: '10–14', rir: '1–2', rest: 'fim' }
              ],
              progression: '3×14 com RIR 1–2 → +1 pino',
              warmup: '1 série a ~60% × 10 reps | RIR 4+ | descanso 60–90 s',
              restMinSec: 90,
              progressCheck: [
                { minReps: 14, rirMin: 1, rirMax: 2 },
                { minReps: 14, rirMin: 1, rirMax: 2 },
                { minReps: 14, rirMin: 1, rirMax: 2 }
              ]
            }
          }
        ],
        defaultVariant: 'leg-curl-deitado'
      },
      {
        id: 'leg-extension',
        name: 'Leg extension',
        initialResistance: 9.5,
        series: [
          { baseWeight: 50, targetReps: 10, rir: '?' },
          { baseWeight: 50, targetReps: 10, rir: '?' },
          { baseWeight: 50, targetReps: 10, rir: '?' }
        ],
        rules: {
          series: [
            { reps: '10–12', rir: '2–3', rest: '75–120 s' },
            { reps: '12–14', rir: '2', rest: '75–120 s' },
            { reps: '12–15', rir: '1–2', rest: 'fim' }
          ],
          progression: 'S3 ≥15 limpo com RIR 1–2 → +1 pino',
          warmup: '1 série a ~60% × 12 reps | RIR 4+ | descanso 60 s',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2, seriesIndex: 2 }
          ]
        }
      },
      {
        id: 'seated-calf',
        name: 'Seated Calf Raise',
        initialResistance: 11.3,
        series: [
          { baseWeight: 50, targetReps: 8, rir: '?' },
          { baseWeight: 50, targetReps: 9, rir: '?' },
          { baseWeight: 50, targetReps: 9, rir: '?' }
        ],
        rules: {
          series: [
            { reps: '8–10', rir: '2–3', rest: '60–90 s' },
            { reps: '9–11', rir: '1–2', rest: '60–90 s' },
            { reps: '9–12', rir: '1–2', rest: 'fim' }
          ],
          progression: '3×12 com RIR 1–2 e amplitude controlada → +1 pino',
          warmup: '1 série a ~60% × 12 reps | RIR 4+ | descanso 45–60 s',
          restMinSec: 60,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'abdutora',
        name: 'Hip Abductor (encosto regulável)',
        initialResistance: null,
        series: [
          { baseWeight: 45, targetReps: 15, rir: '?' },
          { baseWeight: 45, targetReps: 15, rir: '?' }
        ],
        rules: {
          series: [
            { reps: '15–20', rir: '3–5', rest: '45–75 s' },
            { reps: '15–20', rir: '3–5', rest: 'fim' }
          ],
          progression: 'Se houver qualquer desconforto no glúteo médio → cortas',
          warmup: 'Nenhum aquecimento',
          restMinSec: 45
        }
      },
      
    ]
  },
  'Arrábida': {
    'Pernas': [
      {
        id: 'glute-trainer-arrabida',
        name: 'Glute Trainer / Hip Thrust',
        initialResistance: 22.7,
        series: [
          { baseWeight: 20, targetReps: 8, rir: '1-2' },
          { baseWeight: 29.8, targetReps: 8, rir: '1-2' },
          { baseWeight: 29.8, targetReps: 8, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '6–10', rir: '1–2', rest: '2:30–3:30' },
            { reps: '6–10', rir: '1–2', rest: '2:30–3:30' },
            { reps: '6–10', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Topo do range com RIR alvo → +1 pino',
          warmup: '1 série a ~70% da carga de trabalho × 6 reps | RIR 4+ | descanso 90 s',
          restMinSec: 150,
          progressCheck: [
            { minReps: 10, rirMin: 1, rirMax: 2 },
            { minReps: 10, rirMin: 1, rirMax: 2 },
            { minReps: 10, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'leg-press-arrabida',
        name: 'Leg Press 45º',
        initialResistance: 75.7,
        series: [
          { baseWeight: 40, targetReps: 10, rir: '1-2' },
          { baseWeight: 80, targetReps: 10, rir: '1-2' },
          { baseWeight: 120, targetReps: 10, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '1–2', rest: '2:30–4:00' },
            { reps: '8–12', rir: '1–2', rest: '2:30–4:00' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          warmup: '1 série a ~60% × 8 reps | RIR 4+ | descanso 90 s',
          restMinSec: 150
        },
        note: 'Sem grind, sem falha. Se a técnica começar a colapsar, ficas nas reps baixas do range.'
      },
      {
        id: 'seated-leg-curl-arrabida',
        name: 'Seated Leg Curl',
        initialResistance: null,
        series: [
          { baseWeight: 35, targetReps: 12, rir: '1-2' },
          { baseWeight: 35, targetReps: 12, rir: '1-2' },
          { baseWeight: 35, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–12', rir: '1–2', rest: '90–150 s' },
            { reps: '10–12', rir: '1–2', rest: '90–150 s' },
            { reps: '10–12', rir: '1–2', rest: 'fim' }
          ],
          warmup: '1 série a ~60% × 10 reps | RIR 4+ | descanso 60–90 s',
          restMinSec: 90
        },
        note: 'Reps > carga, controlo total, sem puxar lombar.'
      },
      {
        id: 'leg-extension-arrabida',
        name: 'Leg Extension pinos',
        initialResistance: 9.5,
        series: [
          { baseWeight: 50, targetReps: 12, rir: '1-2' },
          { baseWeight: 50, targetReps: 12, rir: '1-2' },
          { baseWeight: 50, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–15', rir: '1–2', rest: '75–120 s' },
            { reps: '10–15', rir: '1–2', rest: '75–120 s' },
            { reps: '10–15', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Topo do range limpo → +1 pino',
          warmup: '1 série a ~60% × 12 reps | RIR 4+ | descanso 60 s',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2, seriesIndex: 2 }
          ]
        },
        note: 'Progressão lenta: só subir pino quando fechares topo do range limpo.'
      },
      {
        id: 'calf-leg-press-arrabida',
        name: 'Calf Raises na Leg Press 45º',
        initialResistance: 75.7,
        series: [
          { baseWeight: 0, targetReps: 10, rir: '1-2' },
          { baseWeight: 0, targetReps: 10, rir: '1-2' },
          { baseWeight: 0, targetReps: 10, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '1–2', rest: '60–90 s' },
            { reps: '8–12', rir: '1–2', rest: '60–90 s' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          warmup: '1 série a ~60% × 12 reps | RIR 4+ | descanso 45–60 s',
          restMinSec: 60
        },
        note: 'Amplitude grande e controlada, pausa em baixo, sem “bounce”.'
      },
      {
        id: 'hip-abductor-arrabida',
        name: 'Hip Abductor',
        initialResistance: null,
        series: [
          { baseWeight: 45, targetReps: 18, rir: '3-5' },
          { baseWeight: 45, targetReps: 18, rir: '3-5' }
        ],
        rules: {
          series: [
            { reps: '15–20', rir: '3–5', rest: '45–75 s' },
            { reps: '15–20', rir: '3–5', rest: 'fim' }
          ],
          warmup: 'Nenhum aquecimento',
          restMinSec: 45
        },
        note: 'Longe da falha. Se houver qualquer sinal no glúteo médio, cortar sem substituir.'
      }
    ]
  },
  'Constituição': {
    'Costas': [
      {
        id: 'lat-pulldown-neutro',
        name: 'Lat Pulldown neutro',
        initialResistance: null,
        series: [
          { baseWeight: 42.5, targetReps: 12, rir: '2' },
          { baseWeight: 45, targetReps: 11, rir: '1-2' },
          { baseWeight: 45, targetReps: 10, rir: '1' }
        ],
        rules: {
          series: [
            { reps: '10–12', rir: '2', rest: '2:00 min' },
            { reps: '9–11', rir: '1–2', rest: '2:00 min' },
            { reps: '8–10', rir: '1', rest: 'fim' }
          ],
          progression: 'Mantém a carga até conseguires 10 / 10 / 10 limpo. Depois +1 pino (2.5 kg). Após subir, volta a 8–9 reps na S1.',
          warmup: '1×12–15 reps a ~65–70% da carga de trabalho | foco técnico, sem fadiga',
          restMinSec: 120,
          progressCheck: [
            { minReps: 10, rirMin: 1, rirMax: 2 },
            { minReps: 10, rirMin: 1, rirMax: 2 },
            { minReps: 10, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'seated-row-peito',
        name: 'Seated Row com apoio de peito',
        initialResistance: null,
        series: [
          { baseWeight: 45, targetReps: 12, rir: '2' },
          { baseWeight: 47.5, targetReps: 11, rir: '1-2' },
          { baseWeight: 50, targetReps: 10, rir: '1-2' }
        ],
        note: 'Nunca subir carga se a execução perder estabilidade escapular.',
        rules: {
          series: [
            { reps: '10–12', rir: '2', rest: '2:00 min' },
            { reps: '9–11', rir: '1–2', rest: '2:00 min' },
            { reps: '8–10', rir: '1–2', rest: 'fim' }
          ],
          progression: '3 séries ≥11 reps com RIR ≤2 → +1 pino',
          warmup: '1×10–12 reps a ~60–65% da carga | ritmo controlado, foco em escápula',
          restMinSec: 120,
          progressCheck: [
            { minReps: 11, rirMin: 1, rirMax: 2 },
            { minReps: 11, rirMin: 1, rirMax: 2 },
            { minReps: 11, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'remada-cabo-lat',
        name: 'Remada em cabo / Lat nos cabos',
        initialResistance: null,
        series: [
          { baseWeight: 40, targetReps: 13, rir: '2' },
          { baseWeight: 40, targetReps: 12, rir: '1-2' },
          { baseWeight: 40, targetReps: 11, rir: '1' }
        ],
        note: 'Aquecimento opcional: 1×12 reps a ~70% se o ombro estiver “frio”.',
        rules: {
          series: [
            { reps: '12–13', rir: '2', rest: '90 s' },
            { reps: '11–12', rir: '1–2', rest: '90 s' },
            { reps: '10–11', rir: '1', rest: 'fim' }
          ],
          progression: 'Quando fizeres 3×12 limpo → +1 pino. Após subida, alvo volta a 10–11 reps.',
          warmup: 'Opcional: 1×12 reps a ~70% se o ombro estiver “frio”',
          restMinSec: 90,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'lower-back',
        name: 'Lower back (leve)',
        initialResistance: null,
        series: [
          { baseWeight: 32.5, targetReps: 15, rir: '3+' },
          { baseWeight: 32.5, targetReps: 14, rir: '3+' }
        ],
        note: 'A S1 já funciona como aquecimento. Amplitude controlada, foco postural.',
        rules: {
          series: [
            { reps: '12–15', rir: '3+', rest: '60–90 s' },
            { reps: '10–14', rir: '3+', rest: 'fim' }
          ],
          progression: 'Só sobe carga se fizeres 15 reps muito fáceis nas duas séries.',
          warmup: 'A S1 já funciona como aquecimento',
          restMinSec: 60
        }
      },
      {
        id: 'face-pull',
        name: 'Face Pull',
        initialResistance: null,
        series: [
          { baseWeight: 7.5, targetReps: 18, rir: '2' },
          { baseWeight: 7.5, targetReps: 16, rir: '1-2' },
          { baseWeight: 7.5, targetReps: 15, rir: '2' }
        ],
        note: 'A S1 já é aquecimento funcional. Cotovelos abertos, foco em escápula. Se a AC reclamar, regressa à carga anterior.',
        rules: {
          series: [
            { reps: '15–18', rir: '2', rest: '60 s' },
            { reps: '14–16', rir: '1–2', rest: '60 s' },
            { reps: '12–15', rir: '2', rest: 'fim' }
          ],
          progression: '18 / 16 / 15 com boa forma → +1 pino',
          warmup: 'A S1 já é aquecimento funcional',
          restMinSec: 60,
          progressCheck: [
            { minReps: 18, rirMin: 1, rirMax: 2 },
            { minReps: 16, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'rotacao-externa',
        name: 'Rotação externa (cabo ou elástico)',
        initialResistance: null,
        series: [
          { baseWeight: 2.5, targetReps: 15, rir: '3+' },
          { baseWeight: 2.5, targetReps: 15, rir: '3+' }
        ],
        note: 'Não necessita aquecimento separado. Movimento lento, controlo total. Não progressiva no curto prazo.',
        rules: {
          series: [
            { reps: '8–15', rir: '3+', rest: '45–60 s' },
            { reps: '8–15', rir: '3+', rest: 'fim' }
          ],
          progression: 'Só aumentar carga após semanas sem dor e reps controladas.',
          warmup: 'Não necessita aquecimento separado',
          restMinSec: 45
        }
      }
    ],
    'Peito': [
      {
        id: 'vertical-chest-press',
        name: 'Vertical Chest Press (pegas verticais)',
        initialResistance: null,
        series: [
          { baseWeight: 35, targetReps: 12, rir: '2-3' },
          { baseWeight: 40, targetReps: 12, rir: '1-2' },
          { baseWeight: 42.5, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–12', rir: '2–3', rest: '2–3 min' },
            { reps: '10–12', rir: '1–2', rest: '2–3 min' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          warmup: '1×8 reps a ~60% da carga de trabalho | RIR 4+ | descanso 90 s',
          restMinSec: 120,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 99, seriesIndex: 2 }
          ]
        },
        note: 'Nunca subir carga se houver perda de controlo ou stress anterior no ombro.'
      },
      {
        id: 'press-halteres-plano',
        name: 'Press com halteres no banco plano (0°)',
        initialResistance: null,
        series: [
          { baseWeight: 14, targetReps: 12, rir: '3+' },
          { baseWeight: 16, targetReps: 11, rir: '2+' },
          { baseWeight: 18, targetReps: 10, rir: '2+' }
        ],
        rules: {
          series: [
            { reps: '10–12', rir: '3+', rest: '2–3 min' },
            { reps: '9–11', rir: '2+', rest: '2–3 min' },
            { reps: '8–10', rir: '≥2', rest: 'fim' }
          ],
          warmup: '1×10 reps com halteres ~70% da carga alvo | RIR 4+ | descanso 90 s',
          restMinSec: 120,
          progressCheck: [
            { minReps: 10, rirMin: 2, rirMax: 2, seriesIndex: 2 }
          ]
        },
        note: 'Só subir carga quando fizeres S3 = 10 reps com RIR 2 limpo e zero picada. Se houver qualquer picada → manter carga e consolidar reps.'
      },
      {
        id: 'fly-halteres-plano',
        name: 'Fly com halteres no banco plano',
        initialResistance: null,
        series: [
          { baseWeight: 12, targetReps: 20, rir: '2-3' },
          { baseWeight: 12, targetReps: 20, rir: '2' }
        ],
        rules: {
          series: [
            { reps: '15–20', rir: '2–3', rest: '60–90 s' },
            { reps: '15–20', rir: '2', rest: 'fim' }
          ],
          warmup: 'Não necessário',
          restMinSec: 60,
          progressCheck: [
            { minReps: 20, rirMin: 2, rirMax: 3 },
            { minReps: 20, rirMin: 2, rirMax: 3 }
          ]
        },
        note: 'Opcional. Cortar ao primeiro sinal no AC. Amplitude curta sempre.'
      },
      {
        id: 'lateral-cabo',
        name: 'Elevação lateral no cabo',
        initialResistance: null,
        series: [
          { baseWeight: 2.5, targetReps: 18, rir: '2-3' },
          { baseWeight: 2.5, targetReps: 16, rir: '1-2' },
          { baseWeight: 2.5, targetReps: 14, rir: '2' }
        ],
        rules: {
          series: [
            { reps: '14–18', rir: '2–3', rest: '60–90 s' },
            { reps: '12–16', rir: '1–2', rest: '60–90 s' },
            { reps: '10–14', rir: '2', rest: 'fim' }
          ],
          warmup: '1×12 reps muito leve | RIR 4+ | descanso 60 s',
          restMinSec: 60,
          progressCheck: [
            { minReps: 16, rirMin: 1, rirMax: 3 },
            { minReps: 16, rirMin: 1, rirMax: 3 },
            { minReps: 16, rirMin: 1, rirMax: 3 }
          ]
        },
        note: 'Subir carga quando fizeres 3 séries ≥16 reps com técnica limpa. Prioridade absoluta ao lado do ombro AC.'
      }
    ]
  }
};

const gymSelect = document.getElementById('gym-select');
const trainingSelect = document.getElementById('training-select');
const dateInput = document.getElementById('session-date');
const workoutWrap = document.getElementById('gym-workout');
const saveBtn = document.getElementById('gym-save');
const summariesWrap = document.getElementById('gym-summaries');
const summariesRefreshBtn = document.getElementById('summaries-refresh');
const machineNameInput = document.getElementById('gym-machine-name');
const machineResistanceInput = document.getElementById('gym-machine-resistance');
const machineBaseSelect = document.getElementById('gym-machine-base');
const machineSeriesList = document.getElementById('gym-series-list');
const machineAddSeriesBtn = document.getElementById('gym-add-series');
const machineAddBtn = document.getElementById('gym-add-machine');
const machineNoteInput = document.getElementById('gym-machine-note');

const state = {
  gym: '',
  treino: '',
  date: '',
  session: null,
  baseWeights: {},
  lastReps: {},
  lastRir: {},
  lastWeights: {},
  recommendedReps: {},
  customMachines: []
};

const baseWeightTimers = new Map();
const recommendedTimers = new Map();

function formatWeight(value) {
  if (value === null || Number.isNaN(value)) return '';
  const fixed = Number(value).toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

function normalizeKey(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getSessionId(gym, treino, date) {
  return `${normalizeKey(date)}-${normalizeKey(gym)}-${normalizeKey(treino)}`;
}

function getBaseWeightId(gym, machineId, variantId, seriesIndex) {
  const variantKey = variantId ? normalizeKey(variantId) : 'base';
  return `${normalizeKey(gym)}-${normalizeKey(machineId)}-${variantKey}-s${seriesIndex}`;
}

function getSeriesKey(machineId, variantId, seriesIndex) {
  return `${machineId}|${variantId || ''}|${seriesIndex}`;
}

function getRecommendedId(gym, machineId, variantId, seriesIndex) {
  const variantKey = variantId ? normalizeKey(variantId) : 'base';
  return `${normalizeKey(gym)}-${normalizeKey(machineId)}-${variantKey}-rec-s${seriesIndex}`;
}

function setStateFromInputs() {
  state.gym = gymSelect.value;
  state.treino = trainingSelect.value;
  state.date = dateInput.value;
}

function getTemplate(gym, treino) {
  const base = WORKOUT_TEMPLATES?.[gym]?.[treino];
  if (!base) return null;
  const merged = JSON.parse(JSON.stringify(base));
  if (!state.customMachines.length) return merged;

  state.customMachines.forEach(custom => {
    if (custom.baseMachineId) {
      const existing = merged.find(machine => machine.id === custom.baseMachineId);
      if (existing) {
        if (!existing.variants) {
          existing.variants = [
            {
              id: existing.id,
              label: existing.name,
              initialResistance: existing.initialResistance ?? null,
              series: existing.series || []
            }
          ];
          existing.defaultVariant = existing.id;
          existing.series = [];
          existing.initialResistance = null;
        }
        existing.variants.push({
          id: custom.id,
          label: custom.name,
          initialResistance: custom.initialResistance ?? null,
          series: custom.series || [],
          note: custom.note || ''
        });
        return;
      }
    }
    merged.push({
      id: custom.id,
      name: custom.name,
      initialResistance: custom.initialResistance ?? null,
      series: custom.series || [],
      note: custom.note || ''
    });
  });

  return merged;
}

function renderEmpty(message) {
  workoutWrap.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'gym-empty';
  empty.textContent = message;
  workoutWrap.appendChild(empty);
}

function getSavedMachine(machineId) {
  return state.session?.machines?.[machineId] || null;
}

function updateTotalDisplay(row, initialResistance) {
  const baseInput = row.querySelector('[data-base-weight]');
  const totalEl = row.querySelector('[data-total-weight]');
  const totalCell = row.querySelector('[data-total-cell]');
  if (!baseInput || !totalEl) return;
  const baseValue = parseFloat(baseInput.value) || 0;
  const baseLabel = `${formatWeight(baseValue)} kg`;
  if (initialResistance === null || Number.isNaN(initialResistance)) {
    totalEl.textContent = '';
    if (totalCell) totalCell.dataset.totalCell = 'true';
    return;
  }
  if (totalCell) totalCell.dataset.totalCell = 'false';
  const total = baseValue + initialResistance;
  totalEl.textContent = `Resistência inicial ${formatWeight(initialResistance)} kg + ${baseLabel} = ${formatWeight(total)} kg`;
}

function createRepsSelect(value) {
  const select = document.createElement('select');
  select.setAttribute('data-reps', 'true');
  for (let i = 0; i <= 30; i += 1) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    if (Number(value) === i) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

function createRirSelect(value) {
  const select = document.createElement('select');
  select.setAttribute('data-rir', 'true');
  const options = ['falha', '?', '1', '2', '3', '2+', '3+', '2-4', '1-2', '2-3', '3-5', '4+'];
  options.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (String(value) === optionValue) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

async function saveBaseWeight(machineId, variantId, seriesIndex, baseWeight) {
  if (!state.gym) return;
  const docId = getBaseWeightId(state.gym, machineId, variantId, seriesIndex);
  const ref = doc(collection(db, 'ginasio_pesos'), docId);
  await setDoc(ref, {
    gym: state.gym,
    machineId,
    variantId: variantId || '',
    seriesIndex,
    baseWeight,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveRecommendedRep(machineId, variantId, seriesIndex, reps) {
  if (!state.gym) return;
  const docId = getRecommendedId(state.gym, machineId, variantId, seriesIndex);
  const ref = doc(collection(db, 'ginasio_reps_recomendadas'), docId);
  await setDoc(ref, {
    gym: state.gym,
    machineId,
    variantId: variantId || '',
    seriesIndex,
    reps,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function scheduleBaseWeightSave(machineId, variantId, seriesIndex, baseWeight) {
  if (!state.gym) return;
  const key = getSeriesKey(machineId, variantId, seriesIndex);
  if (baseWeightTimers.has(key)) {
    clearTimeout(baseWeightTimers.get(key));
  }
  baseWeightTimers.set(key, setTimeout(async () => {
    try {
      await saveBaseWeight(machineId, variantId, seriesIndex, baseWeight);
      state.baseWeights[key] = baseWeight;
      showToast('Peso extra guardado.', 'success', 1200);
    } catch (err) {
      console.error('Erro ao gravar peso extra:', err);
      showToast('Erro ao gravar peso extra.', 'error');
    }
  }, 700));
}

function scheduleRecommendedSave(machineId, variantId, seriesIndex, reps) {
  if (!state.gym) return;
  const key = getSeriesKey(machineId, variantId, seriesIndex);
  if (recommendedTimers.has(key)) {
    clearTimeout(recommendedTimers.get(key));
  }
  recommendedTimers.set(key, setTimeout(async () => {
    try {
      await saveRecommendedRep(machineId, variantId, seriesIndex, reps);
      state.recommendedReps[key] = reps;
      showToast('Reps recomendadas guardadas.', 'success', 1200);
    } catch (err) {
      console.error('Erro ao gravar reps recomendadas:', err);
      showToast('Erro ao gravar reps recomendadas.', 'error');
    }
  }, 700));
}

function createSeriesTable(machine, variant, savedMachine) {
  const initialResistance = variant?.initialResistance ?? machine.initialResistance ?? null;
  const rules = variant?.rules || machine.rules || null;
  if (!variant.series || variant.series.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gym-empty';
    empty.textContent = 'Sem dados para esta máquina.';
    return empty;
  }

  const table = document.createElement('table');
  table.className = 'gym-series-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Série</th>
        <th>Peso (kg)</th>
        <th>Reps feitas</th>
        <th>RIR</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  variant.series.forEach((series, index) => {
    const savedSeries = savedMachine?.series?.[index] || {};
    const seriesKey = getSeriesKey(machine.id, variant?.id, index);
    const row = document.createElement('tr');
    row.setAttribute('data-series-row', 'true');
    row.setAttribute('data-series-index', String(index));
    row.setAttribute('data-target-reps', String(series.targetReps ?? ''));
    row.setAttribute('data-initial-resistance', initialResistance ?? '');
    row.setAttribute('data-series-machine-id', machine.id);
    row.setAttribute('data-series-variant-id', variant?.id || '');

    const baseWeight = state.baseWeights[seriesKey]
      ?? state.lastWeights?.[seriesKey]
      ?? savedSeries.baseWeight
      ?? series.baseWeight
      ?? 0;
    const repsValue = savedSeries.reps
      ?? state.lastReps[seriesKey]
      ?? series.targetReps
      ?? 0;
    const rirValue = savedSeries.rir
      ?? state.lastRir[seriesKey]
      ?? series.rir
      ?? '?';

    const ruleText = rules?.series?.[index]
      ? `${rules.series[index].reps} reps | RIR ${rules.series[index].rir}`
      : '';
    row.innerHTML = `
      <td>
        ${index + 1}ª série
        ${ruleText ? `<span class="gym-series-rule">${ruleText}</span>` : ''}
      </td>
      <td data-total-cell="true">
        <input type="number" min="0" step="0.1" value="${baseWeight}" data-base-weight>
        <span class="gym-total" data-total-weight></span>
      </td>
      <td></td>
      <td>
        <select data-rir>
          <option value="falha" ${rirValue === 'falha' ? 'selected' : ''}>falha</option>
          <option value="?" ${rirValue === '?' ? 'selected' : ''}>?</option>
          <option value="1" ${rirValue === '1' ? 'selected' : ''}>1</option>
          <option value="2" ${rirValue === '2' ? 'selected' : ''}>2</option>
          <option value="3" ${rirValue === '3' ? 'selected' : ''}>3</option>
          <option value="2+" ${rirValue === '2+' ? 'selected' : ''}>2+</option>
          <option value="3+" ${rirValue === '3+' ? 'selected' : ''}>3+</option>
          <option value="2-4" ${rirValue === '2-4' ? 'selected' : ''}>2-4</option>
          <option value="1-2" ${rirValue === '1-2' ? 'selected' : ''}>1-2</option>
          <option value="2-3" ${rirValue === '2-3' ? 'selected' : ''}>2-3</option>
          <option value="3-5" ${rirValue === '3-5' ? 'selected' : ''}>3-5</option>
          <option value="4+" ${rirValue === '4+' ? 'selected' : ''}>4+</option>
        </select>
      </td>
    `;

    const baseInput = row.querySelector('[data-base-weight]');
    if (baseInput) {
      baseInput.addEventListener('input', () => {
        updateTotalDisplay(row, initialResistance);
        const value = parseFloat(baseInput.value) || 0;
        scheduleBaseWeightSave(machine.id, variant?.id || '', index, value);
      });
    }
    const repsCell = row.querySelector('td:nth-child(3)');
    if (repsCell) {
      const repsSelect = createRepsSelect(repsValue);
      repsCell.appendChild(repsSelect);
    }
    updateTotalDisplay(row, initialResistance);
    tbody.appendChild(row);
  });

  return table;
}

function renderRecommendations(card, machine) {
  const existing = card.querySelector('.gym-recommendations');
  if (existing) existing.remove();

  const variantId = card.dataset.variantId || '';
  const rules = getMachineRules(machine, variantId);

  const notes = document.createElement('div');
  notes.className = 'gym-recommendations';

  if (rules?.restMinSec) {
    const restWrap = document.createElement('div');
    restWrap.className = 'gym-rest-wrap';
    const restBtn = document.createElement('button');
    restBtn.type = 'button';
    restBtn.className = 'gym-rest-btn';
    const restLabel = rules.series?.[0]?.rest || `${Math.floor(rules.restMinSec / 60)}:${String(rules.restMinSec % 60).padStart(2, '0')}`;
    restBtn.textContent = `Descanso ${restLabel}`;
    restBtn.addEventListener('click', () => {
      const seconds = parseRestLabel(restLabel) || rules.restMinSec;
      startRestTimer(machine, variantId, seconds, restLabel, restBtn);
    });
    restWrap.appendChild(restBtn);
    notes.appendChild(restWrap);
  }

  const notesHeader = document.createElement('div');
  notesHeader.className = 'gym-machine-meta';
  notesHeader.textContent = 'Notas';
  notes.appendChild(notesHeader);

  const noteKey = getSeriesKey(machine.id, variantId, 'notes');
  const legacyKey = getSeriesKey(machine.id, '', 'notes');
  const variantNote = machine.variants
    ? (machine.variants.find(item => item.id === variantId)?.note || '')
    : '';
  const noteValue = state.recommendedReps[noteKey]
    ?? state.recommendedReps[legacyKey]
    ?? variantNote
    ?? machine.note
    ?? '';

  const textarea = document.createElement('textarea');
  textarea.rows = 1;
  textarea.placeholder = 'Escreve aqui as tuas notas para esta máquina...';
  textarea.value = String(noteValue);
  textarea.addEventListener('input', () => {
    scheduleRecommendedSave(machine.id, variantId, 'notes', textarea.value);
  });
  notes.appendChild(textarea);

  card.appendChild(notes);

  renderRulesBlock(card, rules);
}

function getMachineRules(machine, variantId) {
  if (!machine) return null;
  if (machine.variants && variantId) {
    const variant = machine.variants.find(item => item.id === variantId);
    if (variant?.rules) return variant.rules;
  }
  return machine.rules || null;
}

function renderRulesBlock(card, rules) {
  const existing = card.querySelector('.gym-rules');
  if (existing) existing.remove();
  if (!rules) return;

  const block = document.createElement('div');
  block.className = 'gym-rules';

  if (rules.warmup) {
    const w = document.createElement('div');
    w.className = 'gym-rule-note';
    w.textContent = `Aquecimento: ${rules.warmup}`;
    block.appendChild(w);
  }

  card.appendChild(block);
}

function parseRirRange(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (raw === '?' || raw === '') return null;
  if (raw === 'falha') return { min: 0, max: 0 };
  if (raw.endsWith('+')) {
    const num = Number(raw.replace('+', ''));
    return Number.isFinite(num) ? { min: num, max: Infinity } : null;
  }
  if (raw.includes('-')) {
    const [minRaw, maxRaw] = raw.split('-').map(Number);
    if (Number.isFinite(minRaw) && Number.isFinite(maxRaw)) {
      return { min: minRaw, max: maxRaw };
    }
  }
  const num = Number(raw);
  return Number.isFinite(num) ? { min: num, max: num } : null;
}

function meetsRirRange(actual, required) {
  if (!required) return true;
  if (!actual) return false;
  return actual.min >= required.min && actual.max <= required.max;
}

function canProgress(machine, variantId) {
  const rules = getMachineRules(machine, variantId);
  if (!rules?.progressCheck?.length) return false;
  return rules.progressCheck.every((check, index) => {
    const seriesIndex = check.seriesIndex ?? index;
    const seriesKey = getSeriesKey(machine.id, variantId, seriesIndex);
    const reps = state.lastReps[seriesKey];
    const rir = parseRirRange(state.lastRir[seriesKey]);
    if (typeof reps !== 'number') return false;
    if (check.minReps && reps < check.minReps) return false;
    if (!meetsRirRange(rir, { min: check.rirMin, max: check.rirMax })) return false;
    return true;
  });
}

function startRestTimer(machine, variantId, seconds, label, button) {
  if (!state.gym || !state.treino) return;
  const key = `gym-rest-${normalizeKey(state.gym)}-${normalizeKey(state.treino)}-${machine.id}-${variantId || 'base'}`;
  const endAt = Date.now() + seconds * 1000;
  localStorage.setItem(key, String(endAt));
  runRestTimer(key, machine, variantId, label, button);
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function runRestTimer(key, machine, variantId, label, button) {
  const updateLabel = () => {
    const endAt = Number(localStorage.getItem(key) || 0);
    const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (!remaining) {
      localStorage.removeItem(key);
      if (button) button.textContent = `Descanso ${label}`;
      showToast(`Descanso terminado: ${machine.name}`, 'success');
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Descanso terminado', { body: machine.name });
      }
      clearInterval(timer);
      return;
    }
    if (button) {
      const mm = Math.floor(remaining / 60);
      const ss = String(remaining % 60).padStart(2, '0');
      button.textContent = `Descanso ${mm}:${ss}`;
    }
  };
  updateLabel();
  const timer = setInterval(updateLabel, 1000);
}

function parseRestLabel(label) {
  if (!label) return 0;
  const clean = String(label).trim();
  const rangePart = clean.split('–')[0];
  if (rangePart.includes(':')) {
    const [minRaw, secRaw] = rangePart.split(':').map(part => part.trim());
    const min = Number(minRaw);
    const sec = Number(secRaw);
    if (Number.isFinite(min) && Number.isFinite(sec)) return min * 60 + sec;
  }
  const match = clean.match(/(\d+)\s*s/);
  return match ? Number(match[1]) : 0;
}

function renderMachine(machine) {
  const savedMachine = getSavedMachine(machine.id);
  const card = document.createElement('div');
  card.className = 'gym-machine-card';
  card.setAttribute('data-machine-id', machine.id);
  card.setAttribute('data-machine-name', machine.name);
  card.setAttribute('data-variant-id', machine.id);
  card.setAttribute('data-variant-label', '');

  const header = document.createElement('div');
  header.className = 'gym-machine-header';

  const title = document.createElement('div');
  title.className = 'gym-machine-title';
  title.textContent = machine.name;
  const progressBadge = document.createElement('span');
  progressBadge.className = 'gym-progress-badge';
  progressBadge.textContent = 'Progride!';
  progressBadge.style.display = 'none';

  const meta = document.createElement('div');
  meta.className = 'gym-machine-meta';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'center';
  titleWrap.style.gap = '0.5rem';
  titleWrap.append(title, progressBadge);
  header.append(titleWrap, meta);
  card.appendChild(header);

  let variant = machine;
  const updateMeta = () => {
    const displayResistance = machine.variants
      ? (variant?.initialResistance ?? null)
      : machine.initialResistance;
    meta.textContent = displayResistance === null || displayResistance === undefined
      ? 'Sem resistência inicial'
      : `Resistência inicial: ${formatWeight(displayResistance)} kg`;
  };
  if (machine.variants) {
    const variantSelect = document.createElement('select');
    variantSelect.setAttribute('data-variant-select', 'true');
    machine.variants.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.label;
      variantSelect.appendChild(option);
    });
    const savedVariant = savedMachine?.variantId;
    const defaultVariant = savedVariant || machine.defaultVariant || machine.variants[0]?.id;
    variantSelect.value = defaultVariant;
    card.setAttribute('data-variant-id', variantSelect.value);
    variant = machine.variants.find(opt => opt.id === variantSelect.value) || machine.variants[0];
    card.setAttribute('data-variant-label', variant?.label || '');
    updateMeta();

    const variantWrap = document.createElement('div');
    variantWrap.style.display = 'flex';
    variantWrap.style.flexWrap = 'wrap';
    variantWrap.style.gap = '0.6rem';
    variantWrap.style.alignItems = 'center';
    const variantLabel = document.createElement('span');
    variantLabel.className = 'gym-machine-meta';
    variantLabel.textContent = 'Selecionar máquina:';
    variantWrap.append(variantLabel, variantSelect);
    card.appendChild(variantWrap);

    variantSelect.addEventListener('change', async () => {
      const selected = machine.variants.find(opt => opt.id === variantSelect.value);
      card.setAttribute('data-variant-id', selected?.id || '');
      card.setAttribute('data-variant-label', selected?.label || '');
      variant = selected || machine.variants[0];
      updateMeta();
      const seriesWrap = card.querySelector('[data-series-wrap]');
      if (seriesWrap) {
        seriesWrap.innerHTML = '';
        await loadBaseWeights(state.gym);
        await loadRecommendedReps(state.gym);
        await loadLastReps(state.gym, state.treino);
        seriesWrap.appendChild(createSeriesTable(machine, selected || machine, savedMachine));
        renderRecommendations(card, machine);
        if (canProgress(machine, card.dataset.variantId || '')) {
          progressBadge.style.display = 'inline-flex';
        } else {
          progressBadge.style.display = 'none';
        }
      }
    });
  }

  const seriesWrap = document.createElement('div');
  seriesWrap.setAttribute('data-series-wrap', 'true');
  seriesWrap.appendChild(createSeriesTable(machine, variant, savedMachine));
  card.appendChild(seriesWrap);
  renderRecommendations(card, machine);
  updateMeta();
  if (canProgress(machine, card.dataset.variantId || '')) {
    progressBadge.style.display = 'inline-flex';
  }
  return card;
}

function renderWorkout() {
  workoutWrap.innerHTML = '';
  const template = getTemplate(state.gym, state.treino);
  if (!state.gym || !state.treino) {
    renderEmpty('Seleciona um ginásio e um tipo de treino para começar.');
    return;
  }
  if (!template) {
    renderEmpty('Treino ainda não configurado para esta combinação.');
    return;
  }
  template.forEach(machine => workoutWrap.appendChild(renderMachine(machine)));
  updateBaseMachineOptions(template);

  Array.from(workoutWrap.querySelectorAll('.gym-rest-btn')).forEach(button => {
    const machineId = button.closest('.gym-machine-card')?.dataset.machineId;
    const variantId = button.closest('.gym-machine-card')?.dataset.variantId || 'base';
    if (!machineId || !state.gym || !state.treino) return;
    const key = `gym-rest-${normalizeKey(state.gym)}-${normalizeKey(state.treino)}-${machineId}-${variantId}`;
    if (!localStorage.getItem(key)) return;
    const label = button.textContent.replace('Descanso ', '').trim() || 'Descanso';
    const machine = template.find(item => item.id === machineId);
    if (machine) runRestTimer(key, machine, variantId, label, button);
  });
}

function updateBaseMachineOptions(template) {
  if (!machineBaseSelect) return;
  machineBaseSelect.innerHTML = '<option value="">Nova máquina</option>';
  template.forEach(machine => {
    const option = document.createElement('option');
    option.value = machine.id;
    option.textContent = machine.name;
    machineBaseSelect.appendChild(option);
  });
}

function ensureSeriesTable() {
  if (!machineSeriesList) return null;
  let table = machineSeriesList.querySelector('table');
  if (!table) {
    table = document.createElement('table');
    table.className = 'gym-series-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Série</th>
          <th>Peso (kg)</th>
          <th>Reps</th>
          <th>RIR</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    machineSeriesList.appendChild(table);
  }
  return table;
}

function addSeriesRow(data = {}) {
  const table = ensureSeriesTable();
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const index = tbody.children.length + 1;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${index}ª</td>
    <td><input type="number" step="0.1" min="0" value="${data.baseWeight ?? ''}" data-series-weight></td>
    <td><input type="number" step="1" min="0" value="${data.targetReps ?? ''}" data-series-reps></td>
    <td></td>
    <td><button type="button" data-remove-series>Remover</button></td>
  `;
  const rirCell = row.querySelector('td:nth-child(4)');
  rirCell.appendChild(createRirSelect(data.rir ?? '?'));
  row.querySelector('[data-remove-series]').addEventListener('click', () => {
    row.remove();
    Array.from(tbody.children).forEach((tr, idx) => {
      tr.querySelector('td').textContent = `${idx + 1}ª`;
    });
  });
  tbody.appendChild(row);
}

function resetAddMachineForm() {
  if (machineNameInput) machineNameInput.value = '';
  if (machineResistanceInput) machineResistanceInput.value = '';
  if (machineNoteInput) machineNoteInput.value = '';
  if (machineSeriesList) machineSeriesList.innerHTML = '';
  addSeriesRow();
  addSeriesRow();
  addSeriesRow();
}

async function saveCustomMachine() {
  setStateFromInputs();
  if (!state.gym || !state.treino) {
    showToast('Seleciona ginásio e treino antes de adicionar máquina.', 'warning');
    return;
  }
  const name = machineNameInput?.value.trim();
  if (!name) {
    showToast('Indica o nome da máquina.', 'warning');
    return;
  }
  const initialResistanceValue = machineResistanceInput?.value;
  const initialResistance = initialResistanceValue === '' || initialResistanceValue === null
    ? null
    : parseFloat(initialResistanceValue);
  const baseMachineId = machineBaseSelect?.value || '';
  const note = machineNoteInput?.value.trim() || '';

  const rows = Array.from(machineSeriesList?.querySelectorAll('tbody tr') || []);
  const series = rows.map(row => {
    const baseWeight = parseFloat(row.querySelector('[data-series-weight]')?.value || 0);
    const targetReps = parseInt(row.querySelector('[data-series-reps]')?.value || 0, 10);
    const rir = row.querySelector('[data-rir]')?.value || '?';
    return { baseWeight, targetReps, rir };
  }).filter(item => item.baseWeight || item.targetReps);

  if (!series.length) {
    showToast('Adiciona pelo menos uma série.', 'warning');
    return;
  }

  const customMachine = {
    id: `${normalizeKey(name)}-${Date.now()}`,
    name,
    baseMachineId,
    initialResistance: Number.isNaN(initialResistance) ? null : initialResistance,
    series,
    note
  };

  const docId = `${normalizeKey(state.gym)}-${normalizeKey(state.treino)}`;
  const updatedMachines = [...state.customMachines, customMachine];
  try {
    await setDoc(doc(collection(db, 'ginasio_maquinas_custom'), docId), {
      gym: state.gym,
      treino: state.treino,
      machines: updatedMachines,
      updatedAt: serverTimestamp()
    }, { merge: true });
    state.customMachines = updatedMachines;
    showToast('Máquina adicionada.', 'success');
    resetAddMachineForm();
    renderWorkout();
  } catch (err) {
    console.error('Erro ao adicionar máquina:', err);
    showToast('Erro ao guardar máquina.', 'error');
  }
}

async function loadSession() {
  setStateFromInputs();
  if (!state.gym) {
    state.session = null;
    state.baseWeights = {};
    state.lastReps = {};
    state.lastRir = {};
    state.lastWeights = {};
    state.recommendedReps = {};
    state.customMachines = [];
    renderWorkout();
    return;
  }
  try {
    await loadBaseWeights(state.gym);
  } catch (err) {
    console.error('Erro ao carregar pesos:', err);
    showToast('Erro ao carregar pesos guardados.', 'error');
  }
  try {
    await loadRecommendedReps(state.gym);
  } catch (err) {
    console.error('Erro ao carregar reps recomendadas:', err);
    showToast('Erro ao carregar reps recomendadas.', 'error');
  }
  try {
    await loadCustomMachines(state.gym, state.treino);
  } catch (err) {
    console.error('Erro ao carregar máquinas customizadas:', err);
    showToast('Erro ao carregar máquinas customizadas.', 'error');
  }
  if (!state.treino) {
    state.session = null;
    state.lastReps = {};
    state.lastRir = {};
    state.lastWeights = {};
    renderWorkout();
    return;
  }
  try {
    await loadLastReps(state.gym, state.treino);
  } catch (err) {
    console.error('Erro ao carregar reps:', err);
    showToast('Erro ao carregar reps do último treino.', 'error');
  }
  if (!state.date) {
    state.session = null;
    renderWorkout();
    return;
  }
  try {
    const ref = doc(collection(db, 'ginasio_treinos'), getSessionId(state.gym, state.treino, state.date));
    const snap = await getDoc(ref);
    state.session = snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('Erro ao carregar treino:', err);
    state.session = null;
    showToast('Erro ao carregar treino do Firebase.', 'error');
  }
  renderWorkout();
  resetAddMachineForm();
}

async function loadBaseWeights(gym) {
  if (!gym) {
    state.baseWeights = {};
    return;
  }
  const q = query(collection(db, 'ginasio_pesos'), where('gym', '==', gym));
  const snap = await getDocs(q);
  const weights = {};
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const key = getSeriesKey(data.machineId, data.variantId, data.seriesIndex);
    weights[key] = data.baseWeight;
  });
  state.baseWeights = weights;
}

async function loadRecommendedReps(gym) {
  if (!gym) {
    state.recommendedReps = {};
    return;
  }
  const q = query(collection(db, 'ginasio_reps_recomendadas'), where('gym', '==', gym));
  const snap = await getDocs(q);
  const repsMap = {};
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const key = getSeriesKey(data.machineId, data.variantId, data.seriesIndex);
    repsMap[key] = data.reps;
  });
  state.recommendedReps = repsMap;
}

async function loadCustomMachines(gym, treino) {
  if (!gym || !treino) {
    state.customMachines = [];
    return;
  }
  const docId = `${normalizeKey(gym)}-${normalizeKey(treino)}`;
  const snap = await getDoc(doc(collection(db, 'ginasio_maquinas_custom'), docId));
  state.customMachines = snap.exists() ? (snap.data().machines || []) : [];
}

async function loadLastReps(gym, treino) {
  if (!gym || !treino) {
    state.lastReps = {};
    state.lastRir = {};
    state.lastWeights = {};
    return;
  }
  const q = query(
    collection(db, 'ginasio_treinos'),
    where('gym', '==', gym),
    where('treino', '==', treino)
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map(docSnap => docSnap.data());
  docs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const latest = docs[0];
  const lastReps = {};
  const lastRir = {};
  const lastWeights = {};
  if (latest) {
    const machines = latest?.machines || {};
    Object.entries(machines).forEach(([machineId, machine]) => {
      const variantId = machine?.variantId || '';
      (machine?.series || []).forEach((series, index) => {
        if (typeof series?.baseWeight === 'number') {
          const key = getSeriesKey(machineId, variantId, index);
          lastWeights[key] = series.baseWeight;
        }
        if (typeof series?.reps === 'number') {
          const key = getSeriesKey(machineId, variantId, index);
          lastReps[key] = series.reps;
        }
        if (typeof series?.rir === 'string' && series.rir) {
          const key = getSeriesKey(machineId, variantId, index);
          lastRir[key] = series.rir;
        }
      });
    });
  }
  state.lastReps = lastReps;
  state.lastRir = lastRir;
  state.lastWeights = lastWeights;
}

function buildSessionFromDom() {
  const session = {
    gym: state.gym,
    treino: state.treino,
    date: state.date,
    machines: {}
  };

  const machineEls = Array.from(document.querySelectorAll('.gym-machine-card'));
  machineEls.forEach(machineEl => {
    const machineId = machineEl.dataset.machineId;
    const machineName = machineEl.dataset.machineName || '';
    const variantId = machineEl.dataset.variantId || '';
    const variantLabel = machineEl.dataset.variantLabel || '';
    let seriesRows = Array.from(machineEl.querySelectorAll('[data-series-row]'));
    if (!seriesRows.length) {
      seriesRows = Array.from(machineEl.querySelectorAll('.gym-series-table tbody tr'));
    }
    if (seriesRows.length === 0) {
      session.machines[machineId] = {
        name: machineName,
        variantId,
        variantLabel,
        initialResistance: null,
        series: []
      };
      return;
    }

    const initialResistance = parseFloat(seriesRows[0].dataset.initialResistance);
    const series = seriesRows.map(row => {
      const rowMachineId = row.dataset.seriesMachineId || machineId;
      const rowVariantId = row.dataset.seriesVariantId || variantId;
      const rowIndex = parseInt(row.dataset.seriesIndex || 0, 10);
      const seriesKey = getSeriesKey(rowMachineId, rowVariantId, rowIndex);

      const baseWeight = parseFloat(row.querySelector('[data-base-weight]')?.value || 0);
      const targetReps = parseInt(row.dataset.targetReps || 0, 10);
      const repsInput = parseInt(row.querySelector('[data-reps]')?.value || 0, 10);
      const reps = repsInput > 0
        ? repsInput
        : (state.lastReps[seriesKey] ?? targetReps);
      const rirInput = row.querySelector('[data-rir]')?.value || '?';
      const rir = rirInput === '?' && state.lastRir[seriesKey]
        ? state.lastRir[seriesKey]
        : rirInput;
      return { baseWeight, reps, targetReps, rir };
    });

    session.machines[machineId] = {
      name: machineName,
      variantId,
      variantLabel,
      initialResistance: Number.isNaN(initialResistance) ? null : initialResistance,
      series
    };
  });

  return session;
}

function buildSummaryText(session) {
  if (!session) return '';
  const lines = [];
  lines.push(`${session.date} — ${session.gym} / ${session.treino}`);
  const machines = Array.isArray(session.machines)
    ? session.machines
    : Object.values(session.machines || {});
  machines.forEach((machine, machineIndex) => {
    const seriesList = Array.isArray(machine.series)
      ? machine.series
      : Object.values(machine.series || {});
    if (!seriesList.length) return;
    const label = machine.variantLabel
      ? `${machine.name} (${machine.variantLabel})`
      : machine.name;
    seriesList.forEach((series, index) => {
      const baseWeight = Number(series.baseWeight) || 0;
      const initial = machine.initialResistance ? Number(machine.initialResistance) : 0;
      const total = baseWeight + initial;
      const repsLabel = series.reps ? series.reps : '-';
      const rirLabel = series.rir ? series.rir : '-';
      lines.push(`${label} ${index + 1}ª série ${formatWeight(total)}kg x${repsLabel} RIR ${rirLabel}`);
    });
  });
  return lines.join('\n');
}

async function saveSession() {
  setStateFromInputs();
  if (!state.gym || !state.treino || !state.date) {
    showToast('Seleciona o ginásio, o treino e a data antes de gravar.', 'warning');
    return;
  }
  const session = buildSessionFromDom();
  window.lastGymSession = session;
  console.log('[ginasio] session payload', session);
  const docId = getSessionId(state.gym, state.treino, state.date);
  const ref = doc(collection(db, 'ginasio_treinos'), docId);

  try {
    await setDoc(ref, {
      ...session,
      createdAt: state.session?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    const summary = buildSummaryText(session);
    const summaryRef = doc(collection(db, 'ginasio_resumos'), docId);
    await setDoc(summaryRef, {
      date: session.date,
      gym: session.gym,
      treino: session.treino,
      summary,
      createdAt: state.session?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.session = { ...session };
    showToast('Treino gravado com sucesso.', 'success');
    await loadSummaries();
  } catch (err) {
    console.error('Erro ao gravar treino:', err);
    showToast('Erro ao gravar treino no Firebase.', 'error');
  }
}

async function deleteSessionById(docId) {
  try {
    await deleteDoc(doc(collection(db, 'ginasio_treinos'), docId));
    await deleteDoc(doc(collection(db, 'ginasio_resumos'), docId));
    state.session = null;
    showToast('Treino apagado.', 'success');
    await loadSummaries();
    renderWorkout();
  } catch (err) {
    console.error('Erro ao apagar treino:', err);
    showToast('Erro ao apagar treino.', 'error');
  }
}

function renderSummaries(summaries) {
  summariesWrap.innerHTML = '';
  if (!summaries.length) {
    const empty = document.createElement('div');
    empty.className = 'gym-empty';
    empty.textContent = 'Sem resumos gravados.';
    summariesWrap.appendChild(empty);
    return;
  }

  summaries.forEach(summaryDoc => {
    const card = document.createElement('div');
    card.className = 'gym-summary-card';

    const header = document.createElement('div');
    header.className = 'gym-summary-header';
    const title = document.createElement('strong');
    title.textContent = `${summaryDoc.date} • ${summaryDoc.gym} / ${summaryDoc.treino}`;
    const actions = document.createElement('div');
    actions.className = 'gym-summary-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copiar';
    copyBtn.addEventListener('click', () => copiarMensagem(summaryDoc.summary));
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Apagar';
    deleteBtn.addEventListener('click', () => {
      const docId = summaryDoc.id || getSessionId(summaryDoc.gym, summaryDoc.treino, summaryDoc.date);
      deleteSessionById(docId);
    });
    actions.append(deleteBtn, copyBtn);
    header.append(title, actions);

    const body = document.createElement('pre');
    body.textContent = summaryDoc.summary || '';

    card.append(header, body);
    summariesWrap.appendChild(card);
  });
}

async function loadSummaries() {
  try {
    const q = query(collection(db, 'ginasio_treinos'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    const summaries = await Promise.all(snap.docs.map(async docSnap => {
      const data = docSnap.data();
      const summaryText = buildSummaryText(data);
      if (summaryText) {
        await setDoc(doc(collection(db, 'ginasio_resumos'), docSnap.id), {
          date: data.date,
          gym: data.gym,
          treino: data.treino,
          summary: summaryText,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      return {
        id: docSnap.id,
        date: data.date,
        gym: data.gym,
        treino: data.treino,
        summary: summaryText
      };
    }));
    renderSummaries(summaries);
  } catch (err) {
    console.error('Erro ao carregar resumos:', err);
    renderSummaries([]);
    showToast('Erro ao carregar resumos do Firebase.', 'error');
  }
}

function init() {
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  trainingSelect.disabled = !gymSelect.value;

  gymSelect.addEventListener('change', () => {
    trainingSelect.disabled = !gymSelect.value;
    loadSession();
  });
  trainingSelect.addEventListener('change', loadSession);
  dateInput.addEventListener('change', loadSession);
  saveBtn.addEventListener('click', saveSession);
  summariesRefreshBtn.addEventListener('click', loadSummaries);
  if (machineAddSeriesBtn) {
    machineAddSeriesBtn.addEventListener('click', () => addSeriesRow());
  }
  if (machineAddBtn) {
    machineAddBtn.addEventListener('click', saveCustomMachine);
  }

  loadSession();
  loadSummaries();
  resetAddMachineForm();
}

init();
