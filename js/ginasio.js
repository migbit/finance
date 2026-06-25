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
            note: 'RPM moderado e sem dor: normal. RPM duro ou joelho 3–4/10: reduzir quad. Dor ≥5/10: cortar exercício provocador.',
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
            note: 'Usar só com joelho verde. Se o joelho estiver amarelo/vermelho, cortar hack pesado e evitar amplitude agressiva.',
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
        note: 'Opcional e só com joelho verde. Joelho amarelo: trocar por isometria ou cortar. Joelho vermelho: cortar.',
        initialResistance: 9.5,
        series: [
          { baseWeight: 50, targetReps: 15, rir: '3+' },
          { baseWeight: 50, targetReps: 15, rir: '3+' }
        ],
        rules: {
          series: [
            { reps: '12–15 opcional', rir: '3–5', rest: '75–120 s' },
            { reps: '12–15 opcional', rir: '3–5', rest: 'fim' }
          ],
          progression: 'Só progredir se houver vários treinos sem dor. Se houver dor no joelho, cortar.',
          warmup: '1 série a ~60% × 12 reps | RIR 4+ | descanso 60 s',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 3, rirMax: 5 },
            { minReps: 15, rirMin: 3, rirMax: 5 }
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
        note: 'Se o glúteo médio estiver irritado, fazer só isométrica leve ou cortar.',
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
      
    ],
    'Peito': [
      {
        id: 'chest-press-dragao',
        name: 'Chest Press',
        note: 'Banco n.º 5 / costas n.º 3. Sem dor no ombro.',
        initialResistance: null,
        series: [
          { baseWeight: 50, targetReps: 12, rir: '2' },
          { baseWeight: 50, targetReps: 12, rir: '1-2' },
          { baseWeight: 50, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '2', rest: '2–3 min' },
            { reps: '8–12', rir: '1–2', rest: '2–3 min' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir carga quando fizeres 50 kg × 12 / 12 / 12, mantendo RIR 1–2 e sem dor no ombro.',
          warmup: '32 kg × 12–15 | RIR 4+; 41 kg × 8–10 | RIR 3+',
          restMinSec: 120,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'pec-fly-dragao',
        name: 'Pec Fly',
        note: 'Banco n.º 6. 3.ª série opcional se o ombro estiver bem. Sem amplitude profunda.',
        initialResistance: null,
        series: [
          { baseWeight: 27, targetReps: 15, rir: '2' },
          { baseWeight: 32, targetReps: 15, rir: '1-2' },
          { baseWeight: 32, targetReps: 15, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '12–20', rir: '2', rest: '75–90 s' },
            { reps: '12–20', rir: '1–2', rest: '75–90 s' },
            { reps: '12–20 opcional', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir carga quando fizeres 32 kg × 15–16 reps em 2 séries, com controlo, sem amplitude profunda e sem dor na AC/ombro.',
          warmup: '18–23 kg × 12–15 | RIR 3–4',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      }
    ],
    'Braços': [
      {
        id: 'triceps-press-dragao',
        name: 'Triceps Press',
        note: 'Banco 5. Usar o treino de braços isolado só se não fizeres braços no dia de peito.',
        initialResistance: null,
        series: [
          { baseWeight: 41, targetReps: 15, rir: '1-2' },
          { baseWeight: 41, targetReps: 15, rir: '1-2' },
          { baseWeight: 41, targetReps: 15, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–15', rir: '1–2', rest: '90 s' },
            { reps: '10–15', rir: '1–2', rest: '90 s' },
            { reps: '10–15', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir carga quando fizeres 3 × 15 com RIR 1–2.',
          warmup: '23 kg × 12–15',
          restMinSec: 90,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'dependent-curl-dragao',
        name: 'Dependent Curl',
        note: 'Banco 4.',
        initialResistance: null,
        series: [
          { baseWeight: 18, targetReps: 12, rir: '1-2' },
          { baseWeight: 18, targetReps: 12, rir: '1-2' },
          { baseWeight: 18, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '1–2', rest: '90 s' },
            { reps: '8–12', rir: '1–2', rest: '90 s' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir carga quando fizeres 3 × 12 com RIR 1–2.',
          warmup: '14 kg × 10–12',
          restMinSec: 90,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'triceps-extension-dragao',
        name: 'Triceps Extension',
        note: 'Banco 3.',
        initialResistance: null,
        series: [
          { baseWeight: 27, targetReps: 15, rir: '1-2' },
          { baseWeight: 27, targetReps: 15, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–15', rir: '1–2', rest: '75–90 s' },
            { reps: '10–15', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir carga quando fizeres 2 × 15 com RIR 1–2.',
          warmup: 'Nenhum aquecimento definido',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'biceps-curl-dragao',
        name: 'Biceps Curl',
        note: 'Banco 5. Recomendado: 18 kg, 2 × 12–15. Alternativa: 23 kg, 2 × 8–12.',
        initialResistance: null,
        series: [
          { baseWeight: 18, targetReps: 15, rir: '1-2' },
          { baseWeight: 18, targetReps: 15, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '12–15 leve ou 8–12 pesado', rir: '1–2', rest: '75–90 s' },
            { reps: '12–15 leve ou 8–12 pesado', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir carga quando fizeres 2 × 15 na opção leve ou 2 × 12 na opção pesada.',
          warmup: 'Nenhum aquecimento definido',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      }
    ],
    'Peito + Ombro + Braços': [
      {
        id: 'chest-press-dragao-pob',
        name: 'Chest Press',
        note: 'Exercício principal. Ombro verde: normal. Ombro amarelo: só press confortável + lateral raise + rotação externa. Ombro vermelho: cortar press pesado e fly.',
        initialResistance: null,
        series: [
          { baseWeight: 50, targetReps: 12, rir: '1-2' },
          { baseWeight: 50, targetReps: 12, rir: '1-2' },
          { baseWeight: 50, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '6–12', rir: '1–2', rest: '2 min' },
            { reps: '6–12', rir: '1–2', rest: '2 min' },
            { reps: '6–12', rir: '1–2', rest: 'fim' }
          ],
          progression: '3×12 com RIR 1–2.',
          warmup: '32 kg × 12–15; 41 kg × 8–10',
          restMinSec: 120,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'pec-fly-dragao-pob',
        name: 'Pec Fly ou Crossover curto',
        note: 'Opcional se ombro sensível. Banco n.º 5 se for Pec Fly. Cortar ao primeiro sinal de picada.',
        initialResistance: null,
        series: [
          { baseWeight: 27, targetReps: 20, rir: '2-3' },
          { baseWeight: 32, targetReps: 20, rir: '2-3' }
        ],
        rules: {
          series: [
            { reps: '12–20', rir: '2–3', rest: '90 s' },
            { reps: '12–20', rir: '2–3', rest: 'fim' }
          ],
          progression: '32 kg × 15–16 em 2 séries.',
          warmup: '18–23 kg × 12–15',
          restMinSec: 90,
          progressCheck: [
            { minReps: 15, rirMin: 2, rirMax: 3 },
            { minReps: 15, rirMin: 2, rirMax: 3 }
          ]
        }
      },
      {
        id: 'lateral-raise-maquina-dragao-pob',
        name: 'Lateral Raise máquina',
        note: 'Só amplitude confortável.',
        initialResistance: null,
        series: [
          { baseWeight: 0, targetReps: 20, rir: '1-2' },
          { baseWeight: 0, targetReps: 20, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '12–20', rir: '1–2', rest: '75–90 s' },
            { reps: '12–20', rir: '1–2', rest: 'fim' }
          ],
          progression: '2×20 limpas.',
          warmup: 'Leve × 12–15',
          restMinSec: 75,
          progressCheck: [
            { minReps: 20, rirMin: 1, rirMax: 2 },
            { minReps: 20, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'triceps-press-dragao-pob',
        name: 'Triceps Press',
        note: '2 séries são suficientes neste treino combinado.',
        initialResistance: null,
        series: [
          { baseWeight: 55, targetReps: 15, rir: '1-2' },
          { baseWeight: 55, targetReps: 15, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–15', rir: '1–2', rest: '90 s' },
            { reps: '10–15', rir: '1–2', rest: 'fim' }
          ],
          progression: '2×15 com RIR 1–2.',
          warmup: '32 kg × 12–15; 45 kg × 8–10',
          restMinSec: 90,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'dependent-curl-dragao-pob',
        name: 'Dependent Curl',
        note: '2 séries são suficientes neste treino combinado.',
        initialResistance: null,
        series: [
          { baseWeight: 18, targetReps: 12, rir: '1-2' },
          { baseWeight: 18, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '1–2', rest: '90 s' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          progression: '2×12 com RIR 1–2.',
          warmup: '14 kg × 10–12',
          restMinSec: 90,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'triceps-extension-dragao-pob',
        name: 'Triceps Extension',
        initialResistance: null,
        series: [
          { baseWeight: 32, targetReps: 12, rir: '1-2' },
          { baseWeight: 32, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '1–2', rest: '75–90 s' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          progression: '2×12 com RIR 1–2.',
          warmup: 'Nenhum aquecimento definido',
          restMinSec: 75,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'biceps-curl-dragao-pob',
        name: 'Biceps Curl',
        initialResistance: null,
        series: [
          { baseWeight: 23, targetReps: 12, rir: '1-2' },
          { baseWeight: 23, targetReps: 12, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '8–12', rir: '1–2', rest: '75–90 s' },
            { reps: '8–12', rir: '1–2', rest: 'fim' }
          ],
          progression: '2×12 com RIR 1–2.',
          warmup: 'Nenhum aquecimento definido',
          restMinSec: 75,
          progressCheck: [
            { minReps: 12, rirMin: 1, rirMax: 2 },
            { minReps: 12, rirMin: 1, rirMax: 2 }
          ]
        }
      }
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
        note: 'Menos agressiva. Se houver dor no joelho, cortar ou reduzir para trabalho leve tolerado.',
        initialResistance: 9.5,
        series: [
          { baseWeight: 50, targetReps: 15, rir: '2-3' },
          { baseWeight: 50, targetReps: 15, rir: '2-3' }
        ],
        rules: {
          series: [
            { reps: '12–15', rir: '2–3', rest: '75–120 s' },
            { reps: '12–15', rir: '2–3', rest: 'fim' }
          ],
          progression: 'Topo do range limpo e sem dor durante 2–3 treinos → +1 pino',
          warmup: '1 série a ~60% × 12 reps | RIR 4+ | descanso 60 s',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 2, rirMax: 3 },
            { minReps: 15, rirMin: 2, rirMax: 3 }
          ]
        }
      },
      {
        id: 'calf-leg-press-arrabida',
        name: 'Calf Raises Leg Press',
        initialResistance: null,
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
        note: 'Longe da falha. Se houver qualquer sinal no glúteo médio, fazer só isométrica leve ou cortar.',
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
        }
      }
    ]
  },
  'Constituição': {
    'Pernas': [
      {
        id: 'technogym-glute-constituicao',
        name: 'Technogym Glute',
        initialResistance: null,
        series: [
          { baseWeight: 30, targetReps: 15, rir: '2-3' },
          { baseWeight: 30, targetReps: 15, rir: '2-3' },
          { baseWeight: 30, targetReps: 15, rir: '2-3' }
        ],
        rules: {
          series: [
            { reps: '12–15', rir: '2–3', rest: '90–120 s' },
            { reps: '12–15', rir: '2–3', rest: '90–120 s' },
            { reps: '12–15 opcional', rir: '2–3', rest: 'fim' }
          ],
          progression: 'Subir para 35 kg quando fizer 3×14–15 RIR 2 sem dor.',
          warmup: '15 kg × 10',
          restMinSec: 90,
          progressCheck: [
            { minReps: 14, rirMin: 2, rirMax: 2 },
            { minReps: 14, rirMin: 2, rirMax: 2 },
            { minReps: 14, rirMin: 2, rirMax: 2 }
          ]
        }
      },
      {
        id: 'leg-curl-sentado-constituicao',
        name: 'Leg Curl sentado',
        initialResistance: null,
        series: [
          { baseWeight: 37.5, targetReps: 15, rir: '2' },
          { baseWeight: 37.5, targetReps: 15, rir: '2' },
          { baseWeight: 37.5, targetReps: 15, rir: '2' }
        ],
        rules: {
          series: [
            { reps: '10–15', rir: '2', rest: '90 s' },
            { reps: '10–15', rir: '2', rest: '90 s' },
            { reps: '10–15 opcional', rir: '2', rest: 'fim' }
          ],
          progression: 'Subir para 40 kg quando fizer 3×13–15 RIR 2 sem falha.',
          warmup: '25 kg × 10–12',
          restMinSec: 90,
          progressCheck: [
            { minReps: 13, rirMin: 2, rirMax: 2 },
            { minReps: 13, rirMin: 2, rirMax: 2 },
            { minReps: 13, rirMin: 2, rirMax: 2 }
          ]
        }
      },
      {
        id: 'leg-press-horizontal-constituicao',
        name: 'Leg Press horizontal',
        initialResistance: null,
        series: [
          { baseWeight: 130, targetReps: 15, rir: '3' },
          { baseWeight: 130, targetReps: 15, rir: '3' },
          { baseWeight: 130, targetReps: 15, rir: '3' }
        ],
        rules: {
          series: [
            { reps: '12–15', rir: '3', rest: '120 s' },
            { reps: '12–15', rir: '3', rest: '120 s' },
            { reps: '12–15 opcional', rir: '3', rest: 'fim' }
          ],
          progression: 'Só subir após 2–3 treinos sem dor e sem agravamento na bike.',
          warmup: '100 kg × 10; opcional 120 kg × 6–8',
          restMinSec: 120
        }
      },
      {
        id: 'leg-extension-constituicao-cortada',
        name: 'Leg Extension',
        note: 'Cortada. Reintroduzir leve: 20–25 kg × 15–20, RIR 4–5.',
        initialResistance: null,
        series: [],
        rules: {
          progression: 'Reintroduzir leve: 20–25 kg × 15–20, RIR 4–5.',
          warmup: 'Cortada'
        }
      },
      {
        id: 'gemeos-leg-press-constituicao',
        name: 'Gémeos na Leg Press',
        initialResistance: null,
        series: [
          { baseWeight: 120, targetReps: 15, rir: '1-2' },
          { baseWeight: 120, targetReps: 15, rir: '1-2' },
          { baseWeight: 120, targetReps: 15, rir: '1-2' }
        ],
        rules: {
          series: [
            { reps: '10–15', rir: '1–2', rest: '75–90 s' },
            { reps: '10–15', rir: '1–2', rest: '75–90 s' },
            { reps: '10–15 opcional', rir: '1–2', rest: 'fim' }
          ],
          progression: 'Subir para 130 kg quando fizer 3×15 com boa amplitude.',
          warmup: '70 kg × 12',
          restMinSec: 75,
          progressCheck: [
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 },
            { minReps: 15, rirMin: 1, rirMax: 2 }
          ]
        }
      },
      {
        id: 'technogym-abductor-constituicao',
        name: 'Technogym Abductor',
        note: 'Se o glúteo médio estiver irritado, fazer só isométrica leve ou cortar.',
        initialResistance: null,
        series: [
          { baseWeight: 25, targetReps: 25, rir: '3' },
          { baseWeight: 25, targetReps: 25, rir: '3' }
        ],
        rules: {
          series: [
            { reps: '20–25', rir: '3', rest: '60–75 s' },
            { reps: '20–25', rir: '3', rest: 'fim' }
          ],
          progression: 'Subir para 30 kg quando fizer 2×25 RIR 3+ sem dor.',
          warmup: 'Não necessário',
          restMinSec: 60,
          progressCheck: [
            { minReps: 25, rirMin: 3, rirMax: 99 },
            { minReps: 25, rirMin: 3, rirMax: 99 }
          ]
        }
      }
    ],
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
        note: 'Aquecimento opcional: 1×12 reps a ~70% se o ombro estiver “frio”. Fazer 2 séries; 3.ª só se estiveres fresco.',
        rules: {
          series: [
            { reps: '12–13', rir: '2', rest: '90 s' },
            { reps: '11–12', rir: '1–2', rest: '90 s' },
            { reps: '10–11 opcional', rir: '1', rest: 'fim' }
          ],
          progression: 'Quando fizeres 2×12 limpo, considera subir. 3.ª série só opcional.',
          warmup: 'Opcional: 1×12 reps a ~70% se o ombro estiver “frio”',
          restMinSec: 90,
          progressCheck: [
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
        note: 'A S1 já é aquecimento funcional. Fazer 2 séries; 3.ª só opcional. Se a AC reclamar, regressa à carga anterior.',
        rules: {
          series: [
            { reps: '15–18', rir: '2', rest: '60 s' },
            { reps: '14–16', rir: '1–2', rest: '60 s' },
            { reps: '12–15 opcional', rir: '2', rest: 'fim' }
          ],
          progression: '18 / 16 com boa forma → +1 pino. 3.ª série opcional.',
          warmup: 'A S1 já é aquecimento funcional',
          restMinSec: 60,
          progressCheck: [
            { minReps: 18, rirMin: 1, rirMax: 2 },
            { minReps: 16, rirMin: 1, rirMax: 2 }
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
        note: 'Ombro verde: normal. Ombro amarelo: manter press confortável, lateral raise e rotação externa. Ombro vermelho: cortar press pesado e fly.'
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
        note: 'Só subir carga quando fizeres S3 = 10 reps com RIR 2 limpo e zero picada. Se houver picada, reduzir halteres ou cortar este segundo press.'
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
        note: 'Opcional. Se o ombro estiver sensível, reduzir ou cortar. Cortar ao primeiro sinal no AC. Amplitude curta sempre.'
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
const totalTimerEl = document.getElementById('gym-total-timer');
const workoutProgressEl = document.getElementById('gym-workout-progress');
const activeRestEl = document.getElementById('gym-active-rest');
const activeRestMachineEl = document.getElementById('gym-active-rest-machine');
const activeRestTimeEl = document.getElementById('gym-active-rest-time');
const restAddBtn = document.getElementById('gym-rest-add');
const restCancelBtn = document.getElementById('gym-rest-cancel');
const clearDraftBtn = document.getElementById('gym-clear-draft');
const enableNotificationsBtn = document.getElementById('gym-enable-notifications');
const notificationStatusEl = document.getElementById('gym-notification-status');
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
  warmupDefaults: {},
  customMachines: [],
  timing: {
    startedAt: null,
    lastSetAt: null
  }
};

const baseWeightTimers = new Map();
const recommendedTimers = new Map();
const warmupDefaultTimers = new Map();
const restTimerIntervals = new Map();
const restTimerUpdates = new Map();
const warmupTimerIntervals = new Map();
const LOCAL_DRAFT_CURRENT_KEY = 'ginasio-current-draft-v1';
const LOCAL_DRAFT_PREFIX = 'ginasio-session-draft-v1';
let localDraftTimer = null;
let localDraftDirty = false;
let totalTimerInterval = null;
let activeRest = null;
let restAudioContext = null;

function formatWeight(value) {
  if (value === null || Number.isNaN(value)) return '';
  const fixed = Number(value).toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

function formatClockDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimeOfDay(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) return '';
  return new Date(value).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSamsungDevice() {
  return /samsung|sm-[a-z0-9]+/i.test(navigator.userAgent);
}

function getRestAudioContext() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!restAudioContext) restAudioContext = new AudioContextCtor();
  return restAudioContext;
}

function unlockRestAudio() {
  const audioContext = getRestAudioContext();
  if (!audioContext) return;
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
}

function playRestFinishedBeep() {
  const audioContext = getRestAudioContext();
  if (!audioContext) return;
  const play = () => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  };
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(play).catch(() => {});
    return;
  }
  play();
}

function updateNotificationStatus() {
  if (!notificationStatusEl) return;
  if (!('Notification' in window)) {
    notificationStatusEl.textContent = 'Este browser não suporta notificações web.';
    notificationStatusEl.dataset.state = 'warning';
    if (enableNotificationsBtn) enableNotificationsBtn.disabled = true;
    return;
  }

  const permission = Notification.permission;
  if (enableNotificationsBtn) {
    enableNotificationsBtn.disabled = permission === 'granted';
    enableNotificationsBtn.textContent = permission === 'granted'
      ? 'Notificações ativas'
      : 'Ativar notificações';
  }

  if (permission === 'granted') {
    notificationStatusEl.textContent = isSamsungDevice()
      ? 'Ativas. No Samsung, permite ecrã bloqueado, som/vibração e espelhamento no Galaxy Wearable.'
      : (isStandaloneApp()
          ? 'Ativas. Confirma também som e ecrã bloqueado nas definições do telemóvel.'
          : 'Ativas. Para maior fiabilidade, instala a aplicação no ecrã principal.');
    notificationStatusEl.dataset.state = 'ready';
    return;
  }
  if (permission === 'denied') {
    notificationStatusEl.textContent = 'Bloqueadas pelo sistema. Ativa-as nas definições do browser/aplicação.';
    notificationStatusEl.dataset.state = 'warning';
    return;
  }
  if (isIosDevice() && !isStandaloneApp()) {
    notificationStatusEl.textContent = 'No iPhone, adiciona primeiro ao ecrã principal e abre como aplicação.';
  } else {
    notificationStatusEl.textContent = 'Ativa para receber o fim do descanso no ecrã bloqueado.';
  }
  notificationStatusEl.dataset.state = 'warning';
}

async function requestNotificationPermission() {
  unlockRestAudio();
  if (!('Notification' in window)) {
    updateNotificationStatus();
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    updateNotificationStatus();
    showToast('As notificações estão bloqueadas nas definições do sistema.', 'warning');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    updateNotificationStatus();
    if (permission === 'granted') {
      showToast('Notificações ativadas.', 'success');
      return true;
    }
  } catch (err) {
    console.error('Erro ao pedir permissão de notificações:', err);
  }
  updateNotificationStatus();
  return false;
}

function getTodayLocalISO() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function roundToNearestHalf(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 2) / 2;
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

function getLocalDraftKey(gym, treino, date) {
  if (!gym || !treino || !date) return '';
  return `${LOCAL_DRAFT_PREFIX}-${getSessionId(gym, treino, date)}`;
}

function readLocalJson(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[ginasio] erro ao ler rascunho local:', err);
    return null;
  }
}

function writeLocalJson(key, value) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[ginasio] erro ao guardar rascunho local:', err);
  }
}

function removeLocalKey(key) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[ginasio] erro ao remover rascunho local:', err);
  }
}

function saveCurrentSelection() {
  setStateFromInputs();
  if (!state.gym && !state.treino && !state.date) return;
  writeLocalJson(LOCAL_DRAFT_CURRENT_KEY, {
    gym: state.gym,
    treino: state.treino,
    date: state.date,
    updatedAt: Date.now()
  });
}

function restoreCurrentSelection() {
  const current = readLocalJson(LOCAL_DRAFT_CURRENT_KEY);
  if (!current) return;
  if (current.gym && gymSelect) gymSelect.value = current.gym;
  if (current.treino && trainingSelect) trainingSelect.value = current.treino;
}

function readLocalDraft(gym, treino, date) {
  const draft = readLocalJson(getLocalDraftKey(gym, treino, date));
  if (!draft?.session?.machines) return null;
  return draft;
}

function persistLocalDraft() {
  setStateFromInputs();
  saveCurrentSelection();
  if (!state.gym || !state.treino || !state.date) return;
  if (!workoutWrap?.querySelector('.gym-machine-card')) return;
  const session = buildSessionFromDom();
  writeLocalJson(getLocalDraftKey(state.gym, state.treino, state.date), {
    session,
    updatedAt: Date.now()
  });
}

function scheduleLocalDraftSave() {
  localDraftDirty = true;
  if (localDraftTimer) clearTimeout(localDraftTimer);
  localDraftTimer = setTimeout(() => {
    persistLocalDraft();
  }, 250);
}

function clearLocalDraft(gym, treino, date) {
  if (localDraftTimer) {
    clearTimeout(localDraftTimer);
    localDraftTimer = null;
  }
  removeLocalKey(getLocalDraftKey(gym, treino, date));
  localDraftDirty = false;
}

function clearCurrentDraft() {
  setStateFromInputs();
  if (!state.gym || !state.treino || !state.date) {
    showToast('Não há seleção de treino para apagar.', 'warning');
    return;
  }
  clearLocalDraft(state.gym, state.treino, state.date);
  warmupTimerIntervals.forEach(timer => clearInterval(timer));
  warmupTimerIntervals.clear();
  state.session = null;
  resetWorkoutTiming();
  renderWorkout();
  showToast('Treino temporário apagado.', 'success');
}

function getBaseWeightId(machineId, variantId, seriesIndex) {
  const variantKey = variantId ? normalizeKey(variantId) : 'base';
  return `${normalizeKey(machineId)}-${variantKey}-s${seriesIndex}`;
}

function getSeriesKey(machineId, variantId, seriesIndex) {
  return `${machineId}|${variantId || ''}|${seriesIndex}`;
}

function getRecommendedId(gym, machineId, variantId, seriesIndex) {
  const variantKey = variantId ? normalizeKey(variantId) : 'base';
  return `${normalizeKey(gym)}-${normalizeKey(machineId)}-${variantKey}-rec-s${seriesIndex}`;
}

function getWarmupDefaultId(gym, machineId, variantId, warmupIndex) {
  const variantKey = variantId ? normalizeKey(variantId) : 'base';
  return `${normalizeKey(gym)}-${normalizeKey(machineId)}-${variantKey}-warmup-${warmupIndex}`;
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
  updateWorkoutProgress();
}

function getSavedMachine(machineId) {
  return state.session?.machines?.[machineId] || null;
}

function getSavedSeries(savedMachine, index) {
  if (!Array.isArray(savedMachine?.series)) return {};
  return savedMachine.series.find(item => Number(item?.seriesIndex) === index)
    || savedMachine.series[index]
    || {};
}

function getSavedWarmup(savedMachine, index) {
  if (!Array.isArray(savedMachine?.warmups)) return {};
  return savedMachine.warmups[index] || {};
}

function getTimedSeriesRows() {
  return Array.from(workoutWrap.querySelectorAll('[data-series-row][data-registered-at]'))
    .map(row => ({
      row,
      registeredAt: Number(row.dataset.registeredAt || 0)
    }))
    .filter(item => item.registeredAt > 0)
    .sort((a, b) => a.registeredAt - b.registeredAt);
}

function getWarmupRows() {
  return Array.from(workoutWrap.querySelectorAll('[data-warmup-row]'));
}

function getWarmupIntervals() {
  return getWarmupRows()
    .map(row => {
      const startedAt = Number(row.dataset.startedAt || 0);
      const finishedAt = Number(row.dataset.finishedAt || 0);
      if (!startedAt) return null;
      return {
        startedAt,
        finishedAt: finishedAt || Date.now()
      };
    })
    .filter(Boolean);
}

function getOverlapSec(start, end, intervals) {
  return intervals.reduce((total, interval) => {
    const overlapStart = Math.max(start, interval.startedAt);
    const overlapEnd = Math.min(end, interval.finishedAt);
    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0) / 1000;
}

function syncTimingFromDom() {
  const timedRows = getTimedSeriesRows();
  const warmupStarts = getWarmupIntervals().map(interval => interval.startedAt).filter(Boolean);
  const firstWorkAt = timedRows[0]?.registeredAt || null;
  state.timing.startedAt = [firstWorkAt, ...warmupStarts].filter(Boolean).sort((a, b) => a - b)[0] || null;
  state.timing.lastSetAt = timedRows[timedRows.length - 1]?.registeredAt || null;
}

function resetWorkoutTiming() {
  state.timing = {
    startedAt: null,
    lastSetAt: null
  };
  stopTotalTimer();
  updateTotalTimer();
}

function getNextExerciseOrder() {
  const orders = Array.from(workoutWrap.querySelectorAll('.gym-machine-card'))
    .map(card => Number(card.dataset.exerciseOrder || 0))
    .filter(order => order > 0);
  return orders.length ? Math.max(...orders) + 1 : 1;
}

function markExerciseTouched(target) {
  const card = target?.closest?.('.gym-machine-card');
  if (!card || Number(card.dataset.exerciseOrder || 0) > 0) return;
  card.dataset.exerciseOrder = String(getNextExerciseOrder());
  const meta = card.querySelector('[data-order-label]');
  if (meta) meta.textContent = `Feito em ${card.dataset.exerciseOrder}º`;
}

function updateCardDataState(target) {
  const card = target?.closest?.('.gym-machine-card');
  if (!card) return;
  const hasWork = Array.from(card.querySelectorAll('[data-reps]'))
    .some(input => Number(input.value || 0) > 0);
  const hasWarmup = Array.from(card.querySelectorAll('[data-warmup-row]'))
    .some(row => row.dataset.recorded === 'true'
      || row.dataset.touched === 'true'
      || Number(row.dataset.startedAt || 0) > 0);
  card.dataset.hasData = String(hasWork || hasWarmup);
}

function updateWorkoutProgress() {
  if (!workoutProgressEl) return;
  const rows = Array.from(workoutWrap.querySelectorAll('[data-series-row]'));
  const completed = rows.filter(row => Number(row.querySelector('[data-reps]')?.value || 0) > 0).length;
  workoutProgressEl.textContent = `${completed} / ${rows.length} séries`;
}

function recordSeriesTiming(target) {
  const row = target?.closest?.('[data-series-row]');
  if (!row || Number(target.value || 0) <= 0 || Number(row.dataset.registeredAt || 0) > 0) return;
  syncTimingFromDom();
  const now = Date.now();
  const warmupOverlapSec = state.timing.lastSetAt
    ? getOverlapSec(state.timing.lastSetAt, now, getWarmupIntervals())
    : 0;
  const restBeforeSec = state.timing.lastSetAt
    ? Math.max(0, Math.round((now - state.timing.lastSetAt) / 1000 - warmupOverlapSec))
    : 0;
  row.dataset.registeredAt = String(now);
  row.dataset.restBeforeSec = String(restBeforeSec);
  if (!state.timing.startedAt) state.timing.startedAt = now;
  state.timing.lastSetAt = now;
  updateTotalTimer();
  startTotalTimer();
}

function updateTotalTimer() {
  if (!totalTimerEl) return;
  const startedAt = Number(state.timing.startedAt || 0);
  if (!startedAt) {
    totalTimerEl.textContent = '00:00';
    return;
  }
  totalTimerEl.textContent = formatClockDuration((Date.now() - startedAt) / 1000);
}

function startTotalTimer() {
  if (totalTimerInterval || !state.timing.startedAt) return;
  updateTotalTimer();
  totalTimerInterval = setInterval(updateTotalTimer, 1000);
}

function stopTotalTimer() {
  if (totalTimerInterval) {
    clearInterval(totalTimerInterval);
    totalTimerInterval = null;
  }
}

function parseWarmupSets(text, workWeight = 0) {
  const raw = String(text || '').trim();
  if (!raw || /nenhum|não necessário|nao necessário|cortada/i.test(raw)) return [];
  return raw.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const weightMatch = part.match(/(\d+(?:[,.]\d+)?)\s*kg/i);
    const percentMatch = part.match(/~?\s*(\d+(?:[,.]\d+)?)\s*%/i);
    const repsMatch = part.match(/[x×]\s*(\d+(?:\s*[–-]\s*\d+)?)/i);
    const rirMatch = part.match(/RIR\s*([0-9?]+(?:[–+\-][0-9]+|\+)?)/i);
    const percentWeight = percentMatch
      ? roundToNearestHalf(Number(workWeight || 0) * Number(percentMatch[1].replace(',', '.')) / 100)
      : 0;
    return {
      baseWeight: weightMatch ? Number(weightMatch[1].replace(',', '.')) : percentWeight,
      reps: repsMatch ? repsMatch[1].replace(/\s+/g, '') : '',
      rir: rirMatch ? rirMatch[1].replace('–', '-') : '?'
    };
  });
}

function renderWarmupBlock(card, machine, variant, savedMachine) {
  const rules = variant?.rules || machine.rules || null;
  const firstWorkWeight = Number(variant?.series?.[0]?.baseWeight ?? machine.series?.[0]?.baseWeight ?? 0) || 0;
  const templateWarmups = parseWarmupSets(rules?.warmup || '', firstWorkWeight);
  const savedWarmups = Array.isArray(savedMachine?.warmups) ? savedMachine.warmups : [];
  const variantId = variant?.id || '';
  const warmups = savedWarmups.length
    ? savedWarmups
    : templateWarmups.map((warmup, index) => ({
        ...warmup,
        ...(state.warmupDefaults[getSeriesKey(machine.id, variantId, index)] || {})
      }));
  if (!warmups.length) return;

  const block = document.createElement('div');
  block.className = 'gym-warmup';
  block.setAttribute('data-warmup-block', 'true');

  const header = document.createElement('div');
  header.className = 'gym-warmup-header';
  const title = document.createElement('strong');
  title.textContent = 'Aquecimento';
  const actions = document.createElement('div');
  actions.className = 'gym-warmup-actions';
  const status = document.createElement('span');
  status.className = 'gym-warmup-status';
  status.setAttribute('data-warmup-status', 'true');
  status.textContent = '00:00';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Iniciar aquecimento';
  btn.setAttribute('data-warmup-toggle', 'true');
  actions.append(status, btn);
  header.append(title, actions);
  block.appendChild(header);

  const table = document.createElement('table');
  table.className = 'gym-series-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Série</th>
        <th>Peso (kg)</th>
        <th>Reps</th>
        <th>RIR</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  warmups.forEach((warmup, index) => {
    const row = document.createElement('tr');
    row.setAttribute('data-warmup-row', 'true');
    row.setAttribute('data-warmup-index', String(index));
    if (savedWarmups[index]) row.dataset.recorded = 'true';
    if (warmup.startedAt) row.dataset.startedAt = String(warmup.startedAt);
    if (warmup.finishedAt) row.dataset.finishedAt = String(warmup.finishedAt);
    row.innerHTML = `
      <td data-label="Série">${index + 1}ª aquecimento</td>
      <td data-label="Peso"><input type="number" min="0" step="0.1" value="${warmup.baseWeight ?? 0}" data-warmup-weight></td>
      <td data-label="Reps"><input type="text" value="${warmup.reps ?? ''}" data-warmup-reps></td>
      <td data-label="RIR"></td>
    `;
    row.querySelector('td:nth-child(4)').appendChild(createRirSelect(warmup.rir ?? '?'));
    tbody.appendChild(row);
  });
  block.appendChild(table);

  btn.addEventListener('click', () => toggleWarmup(card, btn, status));
  const seriesWrap = card.querySelector('[data-series-wrap]');
  if (seriesWrap) {
    card.insertBefore(block, seriesWrap);
  } else {
    card.appendChild(block);
  }
  updateWarmupStatus(block);
  const hasActiveWarmup = Array.from(block.querySelectorAll('[data-warmup-row]'))
    .some(row => Number(row.dataset.startedAt || 0) && !Number(row.dataset.finishedAt || 0));
  if (hasActiveWarmup) {
    const key = `${card.dataset.machineId}-${card.dataset.variantId || 'base'}-warmup`;
    card.dataset.warmupTimerKey = key;
    if (warmupTimerIntervals.has(key)) clearInterval(warmupTimerIntervals.get(key));
    warmupTimerIntervals.set(key, setInterval(() => updateWarmupStatus(block), 1000));
  }
}

function updateWarmupStatus(block) {
  const status = block.querySelector('[data-warmup-status]');
  const btn = block.querySelector('[data-warmup-toggle]');
  const rows = Array.from(block.querySelectorAll('[data-warmup-row]'));
  const startedAt = rows.map(row => Number(row.dataset.startedAt || 0)).filter(Boolean).sort((a, b) => a - b)[0] || 0;
  const activeRow = rows.find(row => Number(row.dataset.startedAt || 0) && !Number(row.dataset.finishedAt || 0));
  const finishedAt = rows.map(row => Number(row.dataset.finishedAt || 0)).filter(Boolean).sort((a, b) => b - a)[0] || 0;
  const end = activeRow ? Date.now() : finishedAt;
  const durationSec = startedAt && end ? Math.max(0, Math.round((end - startedAt) / 1000)) : 0;
  if (status) status.textContent = formatClockDuration(durationSec);
  if (btn) btn.textContent = activeRow ? 'Terminar aquecimento' : (durationSec ? 'Reiniciar aquecimento' : 'Iniciar aquecimento');
}

function toggleWarmup(card, btn, status) {
  const block = card.querySelector('[data-warmup-block]');
  const rows = Array.from(block?.querySelectorAll('[data-warmup-row]') || []);
  if (!rows.length) return;
  const activeRows = rows.filter(row => Number(row.dataset.startedAt || 0) && !Number(row.dataset.finishedAt || 0));
  const now = Date.now();
  if (activeRows.length) {
    activeRows.forEach(row => {
      row.dataset.finishedAt = String(now);
      row.dataset.touched = 'true';
    });
    const key = card.dataset.warmupTimerKey;
    if (key && warmupTimerIntervals.has(key)) {
      clearInterval(warmupTimerIntervals.get(key));
      warmupTimerIntervals.delete(key);
    }
    updateWarmupStatus(block);
    updateCardDataState(card);
    scheduleLocalDraftSave();
    return;
  }
  rows.forEach(row => {
    row.dataset.startedAt = String(now);
    row.dataset.touched = 'true';
    delete row.dataset.finishedAt;
  });
  if (!state.timing.startedAt) {
    state.timing.startedAt = now;
    startTotalTimer();
  }
  const key = `${card.dataset.machineId}-${card.dataset.variantId || 'base'}-warmup`;
  card.dataset.warmupTimerKey = key;
  if (warmupTimerIntervals.has(key)) clearInterval(warmupTimerIntervals.get(key));
  warmupTimerIntervals.set(key, setInterval(() => updateWarmupStatus(block), 1000));
  updateWarmupStatus(block);
  updateCardDataState(card);
  scheduleLocalDraftSave();
}

function finishActiveWarmups() {
  const now = Date.now();
  getWarmupRows().forEach(row => {
    if (Number(row.dataset.startedAt || 0) && !Number(row.dataset.finishedAt || 0)) {
      row.dataset.finishedAt = String(now);
    }
  });
  warmupTimerIntervals.forEach(timer => clearInterval(timer));
  warmupTimerIntervals.clear();
  Array.from(workoutWrap.querySelectorAll('[data-warmup-block]')).forEach(updateWarmupStatus);
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

function createRepsSelect(value = 0) {
  const select = document.createElement('select');
  select.setAttribute('data-reps', 'true');
  for (let i = 0; i <= 30; i += 1) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = i === 0 ? '-' : String(i);
    if (Number(value) === i) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

function createRirSelect(value) {
  const select = document.createElement('select');
  select.setAttribute('data-rir', 'true');
  const options = ['falha', '?', '1', '2', '3', '4', '5', '2+', '3+', '4+', '1-2', '2-3', '2-4', '3-5', '4-5'];
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
  const docId = getBaseWeightId(machineId, variantId, seriesIndex);
  const ref = doc(collection(db, 'ginasio_pesos'), docId);
  await setDoc(ref, {
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

async function saveWarmupDefault(gym, machineId, variantId, warmupIndex, warmup) {
  if (!gym) return;
  const docId = getWarmupDefaultId(gym, machineId, variantId, warmupIndex);
  const ref = doc(collection(db, 'ginasio_aquecimentos'), docId);
  await setDoc(ref, {
    gym,
    machineId,
    variantId: variantId || '',
    warmupIndex,
    baseWeight: warmup.baseWeight,
    reps: warmup.reps,
    rir: warmup.rir,
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

function scheduleWarmupDefaultSave(target) {
  const row = target?.closest?.('[data-warmup-row]');
  const card = target?.closest?.('.gym-machine-card');
  if (!row || !card || !state.gym) return;

  const machineId = card.dataset.machineId || '';
  const variantId = card.dataset.variantId || '';
  const warmupIndex = Number(row.dataset.warmupIndex || 0);
  const gym = state.gym;
  const stateKey = getSeriesKey(machineId, variantId, warmupIndex);
  const timerKey = `${gym}|${stateKey}`;
  const warmup = {
    baseWeight: parseFloat(row.querySelector('[data-warmup-weight]')?.value || 0) || 0,
    reps: row.querySelector('[data-warmup-reps]')?.value.trim() || '',
    rir: row.querySelector('[data-rir]')?.value || '?'
  };

  if (warmupDefaultTimers.has(timerKey)) {
    clearTimeout(warmupDefaultTimers.get(timerKey));
  }
  warmupDefaultTimers.set(timerKey, setTimeout(async () => {
    try {
      await saveWarmupDefault(gym, machineId, variantId, warmupIndex, warmup);
      state.warmupDefaults[stateKey] = warmup;
    } catch (err) {
      console.error('Erro ao gravar aquecimento:', err);
      showToast('Erro ao gravar valor do aquecimento.', 'error');
    } finally {
      warmupDefaultTimers.delete(timerKey);
    }
  }, 700));
}

async function persistRecordedWarmupDefaults() {
  const tasks = Array.from(workoutWrap.querySelectorAll('[data-warmup-row]'))
    .filter(row => row.dataset.recorded === 'true'
      || row.dataset.touched === 'true'
      || Number(row.dataset.startedAt || 0) > 0)
    .map(row => {
      const card = row.closest('.gym-machine-card');
      const machineId = card?.dataset.machineId || '';
      const variantId = card?.dataset.variantId || '';
      const warmupIndex = Number(row.dataset.warmupIndex || 0);
      const stateKey = getSeriesKey(machineId, variantId, warmupIndex);
      const timerKey = `${state.gym}|${stateKey}`;
      const warmup = {
        baseWeight: parseFloat(row.querySelector('[data-warmup-weight]')?.value || 0) || 0,
        reps: row.querySelector('[data-warmup-reps]')?.value.trim() || '',
        rir: row.querySelector('[data-rir]')?.value || '?'
      };
      if (warmupDefaultTimers.has(timerKey)) {
        clearTimeout(warmupDefaultTimers.get(timerKey));
        warmupDefaultTimers.delete(timerKey);
      }
      state.warmupDefaults[stateKey] = warmup;
      return saveWarmupDefault(state.gym, machineId, variantId, warmupIndex, warmup);
    });
  await Promise.all(tasks);
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
    const savedSeries = getSavedSeries(savedMachine, index);
    const seriesKey = getSeriesKey(machine.id, variant?.id, index);
    const row = document.createElement('tr');
    row.setAttribute('data-series-row', 'true');
    row.setAttribute('data-series-index', String(index));
    row.setAttribute('data-target-reps', String(series.targetReps ?? ''));
    row.setAttribute('data-initial-resistance', initialResistance ?? '');
    row.setAttribute('data-series-machine-id', machine.id);
    row.setAttribute('data-series-variant-id', variant?.id || '');
    if (savedSeries.registeredAt) {
      row.setAttribute('data-registered-at', String(savedSeries.registeredAt));
    }
    if (typeof savedSeries.restBeforeSec === 'number') {
      row.setAttribute('data-rest-before-sec', String(savedSeries.restBeforeSec));
    }

    const baseWeight = state.baseWeights[seriesKey]
      ?? state.lastWeights?.[seriesKey]
      ?? savedSeries.baseWeight
      ?? series.baseWeight
      ?? 0;
    const repsValue = savedSeries.reps ?? 0;
    const rirValue = savedSeries.rir
      ?? state.lastRir[seriesKey]
      ?? series.rir
      ?? '?';

    const ruleText = rules?.series?.[index]
      ? `${rules.series[index].reps} reps | RIR ${rules.series[index].rir}`
      : '';
    row.innerHTML = `
      <td data-label="Série">
        ${index + 1}ª série
        ${ruleText ? `<span class="gym-series-rule">${ruleText}</span>` : ''}
      </td>
      <td data-label="Peso" data-total-cell="true">
        <input type="number" min="0" step="0.1" value="${baseWeight}" data-base-weight>
        <span class="gym-total" data-total-weight></span>
      </td>
      <td data-label="Reps"></td>
      <td data-label="RIR">
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
  if (rules.progression) {
    const p = document.createElement('div');
    p.className = 'gym-rule-note';
    p.textContent = `Subir carga: ${rules.progression}`;
    block.appendChild(p);
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
  if (raw.includes('–')) {
    const [minRaw, maxRaw] = raw.split('–').map(Number);
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

async function startRestTimer(machine, variantId, seconds, label, button) {
  if (!state.gym || !state.treino) return;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    showToast('Não foi possível calcular o tempo de descanso.', 'error');
    return;
  }
  unlockRestAudio();
  const notificationsEnabled = await requestNotificationPermission();
  if (activeRest?.key) {
    await cancelRestTimer(activeRest.key, { silent: true });
  }
  const key = `gym-rest-${normalizeKey(state.gym)}-${normalizeKey(state.treino)}-${machine.id}-${variantId || 'base'}`;
  const endAt = Date.now() + seconds * 1000;
  localStorage.setItem(key, String(endAt));
  localStorage.removeItem(`${key}-completed`);
  runRestTimer(key, machine, variantId, label, button);
  if (notificationsEnabled) {
    showRestNotification(key, machine, seconds, false, endAt);
  } else if (!('Notification' in window) || Notification.permission !== 'denied') {
    showToast('Descanso iniciado sem notificação do sistema.', 'warning');
  }
}

async function closeRestNotification(key) {
  if (!navigator.serviceWorker?.ready) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag: `gym-rest-${key}` });
    notifications.forEach(notification => notification.close());
  } catch (err) {
    console.warn('Não foi possível fechar a notificação de descanso:', err);
  }
}

function updateActiveRestPanel(key, machine, remaining) {
  if (!activeRestEl || activeRest?.key !== key) return;
  activeRestEl.dataset.active = 'true';
  if (activeRestMachineEl) activeRestMachineEl.textContent = machine.name;
  if (activeRestTimeEl) activeRestTimeEl.textContent = formatClockDuration(remaining);
}

function clearActiveRestPanel(key = '') {
  if (key && activeRest?.key !== key) return;
  activeRest = null;
  if (activeRestEl) activeRestEl.dataset.active = 'false';
  if (activeRestMachineEl) activeRestMachineEl.textContent = 'Descanso';
  if (activeRestTimeEl) activeRestTimeEl.textContent = '00:00';
}

async function cancelRestTimer(key, { silent = false } = {}) {
  const current = activeRest?.key === key ? activeRest : null;
  if (restTimerIntervals.has(key)) {
    clearInterval(restTimerIntervals.get(key));
    restTimerIntervals.delete(key);
  }
  restTimerUpdates.delete(key);
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}-completed`);
  if (current?.button) current.button.textContent = `Descanso ${current.label}`;
  clearActiveRestPanel(key);
  await closeRestNotification(key);
  if (!silent) showToast('Descanso cancelado.', 'success');
}

function addTimeToActiveRest(seconds) {
  if (!activeRest?.key) return;
  const endAt = Number(localStorage.getItem(activeRest.key) || 0);
  if (!endAt) return;
  const nextEndAt = Math.max(Date.now(), endAt) + seconds * 1000;
  localStorage.setItem(activeRest.key, String(nextEndAt));
  localStorage.removeItem(`${activeRest.key}-completed`);
  activeRest.update?.();
  const remaining = Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000));
  showRestNotification(activeRest.key, activeRest.machine, remaining, false, nextEndAt);
}

function showFallbackNotification(title, options) {
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => notification.close();
  } catch (err) {
    console.warn('Notificação direta não suportada:', err);
  }
}

function showRestNotification(key, machine, remaining, done = false, endAt = null) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const tag = `gym-rest-${key}`;
  const finishLabel = endAt ? formatTimeOfDay(endAt) : '';
  const title = done
    ? 'Descanso terminado'
    : `Descanso até ${finishLabel || '--:--'} · ${formatClockDuration(remaining)}`;
  const body = done
    ? `${machine.name} · próxima série`
    : `${machine.name} · termina às ${finishLabel || '--:--'}`;
  const icon = new URL('../icons/icon-192-v2.png', location.href).href;
  const options = {
    body,
    tag,
    icon,
    badge: icon,
    renotify: true,
    silent: false,
    requireInteraction: true,
    vibrate: done ? [300, 150, 300, 150, 500] : [120],
    timestamp: done ? Date.now() : (endAt || Date.now()),
    lang: 'pt-PT',
    data: { url: location.href, tag, restKey: key },
    actions: [{ action: 'dismiss', title: 'Fechar' }]
  };
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready
      .then(reg => {
        if (!done && endAt && Date.now() >= endAt) return undefined;
        return reg.showNotification(title, options);
      })
      .catch(() => {
        if (!done && endAt && Date.now() >= endAt) return;
        showFallbackNotification(title, options);
      });
    return;
  }
  showFallbackNotification(title, options);
}

function runRestTimer(key, machine, variantId, label, button) {
  if (restTimerIntervals.has(key)) {
    clearInterval(restTimerIntervals.get(key));
    restTimerIntervals.delete(key);
  }
  restTimerUpdates.delete(key);
  const updateLabel = () => {
    const endAt = Number(localStorage.getItem(key) || 0);
    const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (!remaining) {
      localStorage.removeItem(key);
      if (button) button.textContent = `Descanso ${label}`;
      if (!localStorage.getItem(`${key}-completed`)) {
        localStorage.setItem(`${key}-completed`, String(Date.now()));
        showToast(`Descanso terminado: ${machine.name}`, 'success');
        playRestFinishedBeep();
        showRestNotification(key, machine, 0, true, endAt);
        if ('vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 500]);
      }
      if (restTimerIntervals.has(key)) {
        clearInterval(restTimerIntervals.get(key));
        restTimerIntervals.delete(key);
      }
      restTimerUpdates.delete(key);
      clearActiveRestPanel(key);
      return;
    }
    if (button) {
      const mm = Math.floor(remaining / 60);
      const ss = String(remaining % 60).padStart(2, '0');
      button.textContent = `Descanso ${mm}:${ss}`;
    }
    updateActiveRestPanel(key, machine, remaining);
  };
  activeRest = { key, machine, variantId, label, button, update: updateLabel };
  restTimerUpdates.set(key, updateLabel);
  updateLabel();
  if (!localStorage.getItem(key)) return;
  const timer = setInterval(updateLabel, 1000);
  restTimerIntervals.set(key, timer);
}

function refreshRestTimers() {
  restTimerUpdates.forEach(update => update());
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
  const card = document.createElement('details');
  card.className = 'gym-machine-card';
  card.setAttribute('data-machine-id', machine.id);
  card.setAttribute('data-machine-name', machine.name);
  card.setAttribute('data-variant-id', machine.id);
  card.setAttribute('data-variant-label', '');
  card.setAttribute('data-exercise-order', savedMachine?.order ? String(savedMachine.order) : '');

  const header = document.createElement('summary');
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
  meta.setAttribute('data-order-label', 'true');

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
    const resistanceLabel = displayResistance === null || displayResistance === undefined
      ? 'Sem resistência inicial'
      : `Resistência inicial: ${formatWeight(displayResistance)} kg`;
    const order = Number(card.dataset.exerciseOrder || 0);
    meta.textContent = order > 0 ? `Feito em ${order}º` : resistanceLabel;
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
        const warmupKey = card.dataset.warmupTimerKey;
        if (warmupKey && warmupTimerIntervals.has(warmupKey)) {
          clearInterval(warmupTimerIntervals.get(warmupKey));
          warmupTimerIntervals.delete(warmupKey);
        }
        card.querySelector('[data-warmup-block]')?.remove();
        await loadBaseWeights(state.gym);
        await loadRecommendedReps(state.gym);
        await loadLastReps(state.gym, state.treino);
        renderWarmupBlock(card, machine, selected || machine, savedMachine);
        seriesWrap.appendChild(createSeriesTable(machine, selected || machine, savedMachine));
        renderRecommendations(card, machine);
        if (canProgress(machine, card.dataset.variantId || '')) {
          progressBadge.style.display = 'inline-flex';
        } else {
          progressBadge.style.display = 'none';
        }
        scheduleLocalDraftSave();
      }
    });
  }

  const seriesWrap = document.createElement('div');
  seriesWrap.setAttribute('data-series-wrap', 'true');
  renderWarmupBlock(card, machine, variant, savedMachine);
  seriesWrap.appendChild(createSeriesTable(machine, variant, savedMachine));
  card.appendChild(seriesWrap);
  renderRecommendations(card, machine);
  updateMeta();
  if (canProgress(machine, card.dataset.variantId || '')) {
    progressBadge.style.display = 'inline-flex';
  }
  updateCardDataState(card);
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
  updateWorkoutProgress();
  syncTimingFromDom();
  const savedDuration = Number(state.session?.timing?.durationSec || 0);
  const savedFinishedAt = Number(state.session?.timing?.finishedAt || 0);
  if (savedFinishedAt && savedDuration) {
    stopTotalTimer();
    if (totalTimerEl) totalTimerEl.textContent = formatClockDuration(savedDuration);
  } else if (state.timing.startedAt) {
    startTotalTimer();
  } else {
    stopTotalTimer();
  }
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
    <td data-label="Série">${index}ª</td>
    <td data-label="Peso"><input type="number" step="0.1" min="0" value="${data.baseWeight ?? ''}" data-series-weight></td>
    <td data-label="Reps"><input type="number" step="1" min="0" value="${data.targetReps ?? ''}" data-series-reps></td>
    <td data-label="RIR"></td>
    <td data-label="Ações"><button type="button" data-remove-series>Remover</button></td>
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
    state.warmupDefaults = {};
    state.customMachines = [];
    resetWorkoutTiming();
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
    await loadWarmupDefaults(state.gym);
  } catch (err) {
    console.error('Erro ao carregar aquecimentos:', err);
    showToast('Erro ao carregar valores dos aquecimentos.', 'error');
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
    resetWorkoutTiming();
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
    resetWorkoutTiming();
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
  const localDraft = readLocalDraft(state.gym, state.treino, state.date);
  if (localDraft) {
    state.session = localDraft.session;
    localDraftDirty = true;
    showToast('Rascunho local do treino recuperado.', 'success', 1800);
  } else {
    localDraftDirty = false;
  }
  if (!state.session) resetWorkoutTiming();
  renderWorkout();
  resetAddMachineForm();
}

async function loadBaseWeights(gym) {
  if (!gym) {
    state.baseWeights = {};
    return;
  }
  const snap = await getDocs(collection(db, 'ginasio_pesos'));
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

async function loadWarmupDefaults(gym) {
  if (!gym) {
    state.warmupDefaults = {};
    return;
  }
  const q = query(collection(db, 'ginasio_aquecimentos'), where('gym', '==', gym));
  const snap = await getDocs(q);
  const warmups = {};
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const key = getSeriesKey(data.machineId, data.variantId, data.warmupIndex);
    warmups[key] = {
      baseWeight: Number(data.baseWeight) || 0,
      reps: String(data.reps || ''),
      rir: String(data.rir || '?')
    };
  });
  state.warmupDefaults = warmups;
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
    where('treino', '==', treino)
  );
  const snap = await getDocs(q);
  const docs = snap.docs
    .map(docSnap => docSnap.data())
    .filter(data => data.gym === gym);
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
  syncTimingFromDom();
  const session = {
    gym: state.gym,
    treino: state.treino,
    date: state.date,
    machines: {},
    timing: {
      startedAt: state.timing.startedAt || null,
      finishedAt: null,
      durationSec: null
    }
  };

  const machineEls = Array.from(document.querySelectorAll('.gym-machine-card'));
  machineEls.forEach((machineEl, machineIndex) => {
    const machineId = machineEl.dataset.machineId;
    const machineName = machineEl.dataset.machineName || '';
    const variantId = machineEl.dataset.variantId || '';
    const variantLabel = machineEl.dataset.variantLabel || '';
    let seriesRows = Array.from(machineEl.querySelectorAll('[data-series-row]'));
    if (!seriesRows.length) {
      seriesRows = Array.from(machineEl.querySelectorAll('.gym-series-table tbody tr'));
    }
    if (seriesRows.length === 0) return;

    const initialResistance = parseFloat(seriesRows[0].dataset.initialResistance);
    const warmups = Array.from(machineEl.querySelectorAll('[data-warmup-row]')).map(row => {
      const startedAt = Number(row.dataset.startedAt || 0) || null;
      const finishedAt = Number(row.dataset.finishedAt || 0) || null;
      return {
        recorded: row.dataset.recorded === 'true'
          || row.dataset.touched === 'true'
          || Boolean(startedAt),
        baseWeight: parseFloat(row.querySelector('[data-warmup-weight]')?.value || 0) || 0,
        reps: row.querySelector('[data-warmup-reps]')?.value.trim() || '',
        rir: row.querySelector('[data-rir]')?.value || '?',
        startedAt,
        finishedAt,
        durationSec: startedAt && finishedAt ? Math.max(0, Math.round((finishedAt - startedAt) / 1000)) : 0
      };
    })
      .filter(item => item.recorded)
      .map(({ recorded, ...warmup }) => warmup);
    const series = seriesRows.map(row => {
      const rowMachineId = row.dataset.seriesMachineId || machineId;
      const rowVariantId = row.dataset.seriesVariantId || variantId;
      const rowIndex = parseInt(row.dataset.seriesIndex || 0, 10);
      const seriesKey = getSeriesKey(rowMachineId, rowVariantId, rowIndex);

      const baseWeight = parseFloat(row.querySelector('[data-base-weight]')?.value || 0);
      const targetReps = parseInt(row.dataset.targetReps || 0, 10);
      const repsInput = parseInt(row.querySelector('[data-reps]')?.value || 0, 10);
      const reps = repsInput > 0 ? repsInput : 0;
      const rirInput = row.querySelector('[data-rir]')?.value || '?';
      const rir = rirInput === '?' && state.lastRir[seriesKey]
        ? state.lastRir[seriesKey]
        : rirInput;
      const registeredAt = Number(row.dataset.registeredAt || 0) || null;
      const restBeforeSec = Number(row.dataset.restBeforeSec || 0) || 0;
      return { seriesIndex: rowIndex, baseWeight, reps, targetReps, rir, registeredAt, restBeforeSec };
    }).filter(item => item.reps > 0);

    if (!series.length && !warmups.length) return;

    session.machines[machineId] = {
      name: machineName,
      variantId,
      variantLabel,
      initialResistance: Number.isNaN(initialResistance) ? null : initialResistance,
      order: Number(machineEl.dataset.exerciseOrder || 0) || machineIndex + 1,
      warmups,
      series
    };
  });

  if (!session.timing.startedAt) {
    delete session.timing;
  }
  return session;
}

function buildSummaryText(session) {
  if (!session) return '';
  const lines = [];
  lines.push(`${session.date} — ${session.gym} / ${session.treino}`);
  const durationSec = Number(session.timing?.durationSec || 0);
  if (durationSec > 0) {
    const startLabel = formatTimeOfDay(session.timing?.startedAt);
    const finishLabel = formatTimeOfDay(session.timing?.finishedAt);
    if (startLabel || finishLabel) {
      lines.push(`Hora: ${startLabel || '-'}–${finishLabel || '-'}`);
    }
    lines.push(`Tempo total: ${formatDuration(durationSec)}`);
  }
  const machines = Array.isArray(session.machines)
    ? session.machines
    : Object.values(session.machines || {});
  machines
    .filter(machine => {
      const seriesList = Array.isArray(machine.series)
        ? machine.series
        : Object.values(machine.series || {});
      const warmupList = Array.isArray(machine.warmups)
        ? machine.warmups
        : Object.values(machine.warmups || {});
      return seriesList.some(series => Number(series?.reps || 0) > 0)
        || warmupList.some(warmup => warmup?.baseWeight || warmup?.reps);
    })
    .sort((a, b) => (Number(a.order || 0) || 9999) - (Number(b.order || 0) || 9999))
    .forEach(machine => {
      const seriesList = Array.isArray(machine.series)
        ? machine.series
        : Object.values(machine.series || {});
      const label = machine.variantLabel
        ? `${machine.name} (${machine.variantLabel})`
        : machine.name;
      const warmups = Array.isArray(machine.warmups) ? machine.warmups : [];
      warmups.filter(warmup => warmup.baseWeight || warmup.reps).forEach((warmup, index) => {
        const durationLabel = Number(warmup.durationSec || 0) > 0
          ? ` | tempo ${formatDuration(warmup.durationSec)}`
          : '';
        lines.push(`${label} aquecimento ${index + 1} ${formatWeight(Number(warmup.baseWeight) || 0)}kg x${warmup.reps || '-'} RIR ${warmup.rir || '-'}${durationLabel}`);
      });
      seriesList
        .filter(series => Number(series?.reps || 0) > 0)
        .sort((a, b) => Number(a.seriesIndex ?? 0) - Number(b.seriesIndex ?? 0))
        .forEach((series, index) => {
          const baseWeight = Number(series.baseWeight) || 0;
          const initial = machine.initialResistance ? Number(machine.initialResistance) : 0;
          const total = baseWeight + initial;
          const repsLabel = series.reps ? series.reps : '-';
          const rirLabel = series.rir ? series.rir : '-';
          const seriesNumber = Number(series.seriesIndex ?? index) + 1;
          const restLabel = Number(series.restBeforeSec || 0) > 0
            ? ` | descanso ${formatDuration(series.restBeforeSec)}`
            : '';
          lines.push(`${label} ${seriesNumber}ª série ${formatWeight(total)}kg x${repsLabel} RIR ${rirLabel}${restLabel}`);
        });
    });
  return lines.join('\n');
}

async function saveSession() {
  if (saveBtn?.disabled) return;
  setStateFromInputs();
  if (!state.gym || !state.treino || !state.date) {
    showToast('Seleciona o ginásio, o treino e a data antes de gravar.', 'warning');
    return;
  }
  finishActiveWarmups();
  const session = buildSessionFromDom();
  const hasWorkSeries = Object.values(session.machines || {}).some(machine => {
    const seriesList = Array.isArray(machine.series) ? machine.series : Object.values(machine.series || {});
    return seriesList.some(series => Number(series?.reps || 0) > 0);
  });
  if (!hasWorkSeries) {
    showToast('Preenche pelo menos uma série antes de gravar.', 'warning');
    return;
  }
  if (session.timing?.startedAt) {
    const previousFinishedAt = Number(state.session?.timing?.finishedAt || 0) || 0;
    const lastSetAt = Number(state.timing.lastSetAt || 0);
    const finishedAt = previousFinishedAt && lastSetAt <= previousFinishedAt
      ? previousFinishedAt
      : Date.now();
    session.timing.finishedAt = finishedAt;
    session.timing.durationSec = Math.max(0, Math.round((finishedAt - session.timing.startedAt) / 1000));
  }
  window.lastGymSession = session;
  console.log('[ginasio] session payload', session);
  const docId = getSessionId(state.gym, state.treino, state.date);
  const ref = doc(collection(db, 'ginasio_treinos'), docId);
  const originalSaveLabel = saveBtn?.textContent || 'Guardar treino';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'A guardar…';
  }

  try {
    await persistRecordedWarmupDefaults();
  } catch (err) {
    console.error('Erro ao gravar valores reutilizáveis do aquecimento:', err);
    showToast('O treino será guardado, mas não foi possível atualizar o próximo aquecimento.', 'warning');
  }

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
    clearLocalDraft(session.gym, session.treino, session.date);
    stopTotalTimer();
    if (totalTimerEl) totalTimerEl.textContent = formatClockDuration(session.timing?.durationSec || 0);
    saveCurrentSelection();
    showToast('Treino gravado com sucesso.', 'success');
    await loadSummaries();
  } catch (err) {
    console.error('Erro ao gravar treino:', err);
    showToast('Erro ao gravar treino no Firebase.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalSaveLabel;
    }
  }
}

async function deleteSessionById(docId) {
  try {
    await deleteDoc(doc(collection(db, 'ginasio_treinos'), docId));
    await deleteDoc(doc(collection(db, 'ginasio_resumos'), docId));
    clearLocalDraft(state.gym, state.treino, state.date);
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
  summariesWrap.dataset.expanded = 'false';
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

  if (summaries.length > 1) {
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'gym-summary-more';
    moreBtn.textContent = 'Mostrar mais';
    moreBtn.addEventListener('click', () => {
      const expanded = summariesWrap.dataset.expanded === 'true';
      summariesWrap.dataset.expanded = expanded ? 'false' : 'true';
      moreBtn.textContent = expanded ? 'Mostrar mais' : 'Mostrar menos';
    });
    summariesWrap.appendChild(moreBtn);
  }
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
  restoreCurrentSelection();
  if (dateInput) dateInput.value = getTodayLocalISO();
  trainingSelect.disabled = !gymSelect.value;
  updateNotificationStatus();

  gymSelect.addEventListener('change', () => {
    trainingSelect.disabled = !gymSelect.value;
    saveCurrentSelection();
    loadSession();
  });
  trainingSelect.addEventListener('change', () => {
    saveCurrentSelection();
    loadSession();
  });
  dateInput.addEventListener('change', () => {
    saveCurrentSelection();
    loadSession();
  });
  workoutWrap.addEventListener('input', scheduleLocalDraftSave);
  workoutWrap.addEventListener('input', event => {
    const warmupRow = event.target?.closest?.('[data-warmup-row]');
    if (warmupRow) warmupRow.dataset.touched = 'true';
    updateCardDataState(event.target);
    if (event.target?.matches?.('[data-warmup-weight], [data-warmup-reps]')) {
      scheduleWarmupDefaultSave(event.target);
    }
  });
  workoutWrap.addEventListener('change', () => {
    setTimeout(scheduleLocalDraftSave, 0);
  });
  workoutWrap.addEventListener('change', event => {
    const warmupRow = event.target?.closest?.('[data-warmup-row]');
    if (warmupRow) warmupRow.dataset.touched = 'true';
    updateCardDataState(event.target);
    updateWorkoutProgress();
    if (event.target?.closest?.('[data-warmup-row]')) {
      scheduleWarmupDefaultSave(event.target);
    }
  });
  workoutWrap.addEventListener('change', event => {
    if (!event.target?.matches?.('[data-reps]')) return;
    if (Number(event.target.value || 0) > 0) {
      recordSeriesTiming(event.target);
      markExerciseTouched(event.target);
      return;
    }
    const row = event.target.closest('[data-series-row]');
    if (row) {
      delete row.dataset.registeredAt;
      delete row.dataset.restBeforeSec;
      syncTimingFromDom();
    }
  });
  window.addEventListener('pagehide', () => {
    if (localDraftDirty) persistLocalDraft();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && localDraftDirty) {
      persistLocalDraft();
    }
    if (document.visibilityState === 'visible') {
      refreshRestTimers();
      updateNotificationStatus();
    }
  });
  saveBtn.addEventListener('click', saveSession);
  if (clearDraftBtn) {
    clearDraftBtn.addEventListener('click', clearCurrentDraft);
  }
  enableNotificationsBtn?.addEventListener('click', requestNotificationPermission);
  window.addEventListener('focus', () => {
    refreshRestTimers();
    updateNotificationStatus();
  });
  window.matchMedia?.('(display-mode: standalone)')
    .addEventListener?.('change', updateNotificationStatus);
  restAddBtn?.addEventListener('click', () => addTimeToActiveRest(30));
  restCancelBtn?.addEventListener('click', () => {
    if (activeRest?.key) cancelRestTimer(activeRest.key);
  });
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
