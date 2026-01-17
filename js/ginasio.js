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
        name: 'Glute Trainer',
        initialResistance: 22.7,
        series: [
          { baseWeight: 20, targetReps: 7, rir: '?' },
          { baseWeight: 29.8, targetReps: 8, rir: '?' },
          { baseWeight: 29.8, targetReps: 9, rir: '?' }
        ]
      },
      {
        id: 'leg-press-hack',
        name: 'Leg press / Hack Squat',
        variants: [
          { id: 'leg-press', label: 'Leg press', initialResistance: null, series: [] },
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
        defaultVariant: 'hack-squat'
      },
      {
        id: 'leg-curl',
        name: 'Leg curl deitado',
        initialResistance: 9.5,
        series: [
          { baseWeight: 40, targetReps: 12, rir: '?' },
          { baseWeight: 40, targetReps: 12, rir: '?' },
          { baseWeight: 45, targetReps: 10, rir: '2' }
        ]
      },
      {
        id: 'leg-extension',
        name: 'Leg extension',
        initialResistance: 9.5,
        series: [
          { baseWeight: 50, targetReps: 10, rir: '?' },
          { baseWeight: 50, targetReps: 10, rir: '?' },
          { baseWeight: 50, targetReps: 10, rir: '?' }
        ]
      },
      {
        id: 'seated-calf',
        name: 'Seated Calf',
        initialResistance: 11.3,
        series: [
          { baseWeight: 50, targetReps: 8, rir: '?' },
          { baseWeight: 50, targetReps: 9, rir: '?' },
          { baseWeight: 50, targetReps: 9, rir: '?' }
        ]
      },
      {
        id: 'abdutora',
        name: 'Abdutora',
        initialResistance: null,
        series: [
          { baseWeight: 45, targetReps: 15, rir: '?' },
          { baseWeight: 45, targetReps: 15, rir: '?' }
        ]
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
          { baseWeight: 45, targetReps: 11, rir: '2' },
          { baseWeight: 45, targetReps: 10, rir: '1' }
        ],
        note: 'Aquecimento: 1×12–15 reps a 30–35 kg, foco técnico, sem fadiga.\nSe a S1 sair muito fácil, mantém carga. Se a S3 cair <8 reps, não forces.'
      },
      {
        id: 'seated-row-peito',
        name: 'Seated Row com apoio de peito',
        initialResistance: null,
        series: [
          { baseWeight: 45, targetReps: 12, rir: '2' },
          { baseWeight: 47.5, targetReps: 12, rir: '2' },
          { baseWeight: 50, targetReps: 10, rir: '2' }
        ],
        note: 'Aquecimento: 1×10–12 reps a 35 kg, controlo total.\nSe a AC não estiver 100%, mantém 47.5 kg em todas as séries.'
      },
      {
        id: 'remada-cabo-lat',
        name: 'Remada em cabo / Lat nos cabos',
        initialResistance: null,
        series: [
          { baseWeight: 40, targetReps: 13, rir: '2' },
          { baseWeight: 40, targetReps: 12, rir: '2' },
          { baseWeight: 40, targetReps: 11, rir: '1' }
        ],
        note: 'Aquecimento opcional: 1×12–15 reps a 30–35 kg se o ombro estiver “frio”.\nQuando fizeres 3×12 limpo, sobe para 42.5 kg no treino seguinte.'
      },
      {
        id: 'lower-back',
        name: 'Lower back (leve)',
        initialResistance: null,
        series: [
          { baseWeight: 32.5, targetReps: 15, rir: '3' },
          { baseWeight: 32.5, targetReps: 12, rir: '3' }
        ],
        note: 'A primeira série já funciona como aquecimento.\nAmplitude controlada, foco postural, sem progressão agressiva.'
      },
      {
        id: 'face-pull',
        name: 'Face Pull',
        initialResistance: null,
        series: [
          { baseWeight: 7.5, targetReps: 18, rir: '2' },
          { baseWeight: 7.5, targetReps: 16, rir: '2' },
          { baseWeight: 7.5, targetReps: 15, rir: '2' }
        ],
        note: 'Aquecimento integrado na S1.\nCotovelos abertos, foco em escápula. Se a AC reclamar, reduz carga ou amplitude.'
      },
      {
        id: 'rotacao-externa',
        name: 'Rotação externa (cabo ou elástico)',
        initialResistance: null,
        series: [
          { baseWeight: 2.5, targetReps: 20, rir: '3' },
          { baseWeight: 2.5, targetReps: 20, rir: '3' }
        ],
        note: 'Não precisa aquecimento separado.\nMovimento lento, controlo total. Este exercício mede saúde, não progresso.'
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

const state = {
  gym: '',
  treino: '',
  date: '',
  session: null,
  baseWeights: {},
  lastReps: {},
  lastRir: {},
  recommendedReps: {}
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
  return WORKOUT_TEMPLATES?.[gym]?.[treino] || null;
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

    row.innerHTML = `
      <td> ${index + 1}ª série </td>
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

  const notes = document.createElement('div');
  notes.className = 'gym-recommendations';
  const notesTitle = document.createElement('div');
  notesTitle.className = 'gym-machine-meta';
  notesTitle.textContent = 'Notas';
  notes.appendChild(notesTitle);

  const variantId = card.dataset.variantId || '';
  const noteKey = getSeriesKey(machine.id, variantId, 'notes');
  const legacyKey = getSeriesKey(machine.id, '', 'notes');
  const noteValue = state.recommendedReps[noteKey]
    ?? state.recommendedReps[legacyKey]
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

  const meta = document.createElement('div');
  meta.className = 'gym-machine-meta';
  const baseResistance = machine.initialResistance;
  meta.textContent = baseResistance === null || baseResistance === undefined
    ? 'Sem resistência inicial'
    : `Resistência inicial: ${formatWeight(baseResistance)} kg`;

  header.append(title, meta);
  card.appendChild(header);

  let variant = machine;
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
      const seriesWrap = card.querySelector('[data-series-wrap]');
      if (seriesWrap) {
        seriesWrap.innerHTML = '';
        await loadBaseWeights(state.gym);
        await loadRecommendedReps(state.gym);
        await loadLastReps(state.gym, state.treino);
        seriesWrap.appendChild(createSeriesTable(machine, selected || machine, savedMachine));
        renderRecommendations(card, machine);
      }
    });
  }

  const seriesWrap = document.createElement('div');
  seriesWrap.setAttribute('data-series-wrap', 'true');
  seriesWrap.appendChild(createSeriesTable(machine, variant, savedMachine));
  card.appendChild(seriesWrap);
  renderRecommendations(card, machine);
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
}

async function loadSession() {
  setStateFromInputs();
  if (!state.gym) {
    state.session = null;
    state.baseWeights = {};
    state.lastReps = {};
    state.lastRir = {};
    state.recommendedReps = {};
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
  if (!state.treino) {
    state.session = null;
    state.lastReps = {};
    state.lastRir = {};
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

async function loadLastReps(gym, treino) {
  if (!gym || !treino) {
    state.lastReps = {};
    state.lastRir = {};
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
  if (latest) {
    const machines = latest?.machines || {};
    Object.entries(machines).forEach(([machineId, machine]) => {
      const variantId = machine?.variantId || '';
      (machine?.series || []).forEach((series, index) => {
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
      const baseWeight = parseFloat(row.querySelector('[data-base-weight]')?.value || 0);
      const targetReps = parseInt(row.dataset.targetReps || 0, 10);
      const repsInput = parseInt(row.querySelector('[data-reps]')?.value || 0, 10);
      const reps = repsInput > 0 ? repsInput : targetReps;
      const rir = row.querySelector('[data-rir]')?.value || '?';
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

  loadSession();
  loadSummaries();
}

init();
