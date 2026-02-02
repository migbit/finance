import { db } from './script.js';
import { showToast } from './toast.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const START_YM = { y: 2026, m: 1 };
const MONTHLY_INV = 50;
const SETTINGS_DOC = doc(collection(db, 'dca_revolut_settings'), 'params');
const VALUES_COL = collection(db, 'dca_revolut');

const state = {
  endYM: null,
  values: {},
  invested: {},
  showPastYears: false,
  showFutureYears: false,
  chart: null
};

function ymToId(ym) {
  return `${ym.y}-${String(ym.m).padStart(2, '0')}`;
}

function parseYMString(str) {
  if (typeof str !== 'string') return null;
  const match = str.match(/^(\d{4})-(\d{2})$/);
  return match ? { y: Number(match[1]), m: Number(match[2]) } : null;
}

function parseDateInput(str) {
  if (typeof str !== 'string') return null;
  const ym = parseYMString(str);
  if (ym) return ym;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) };
}

function monthsBetween(a, b) {
  const out = [];
  let y = a.y;
  let m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    out.push({ y, m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

async function loadParams() {
  try {
    const snap = await getDoc(SETTINGS_DOC);
    if (!snap.exists()) return null;
    return snap.data() || null;
  } catch {
    return null;
  }
}

async function saveParams(params) {
  await setDoc(SETTINGS_DOC, params, { merge: true });
}

async function loadValues() {
  try {
    const q = query(VALUES_COL, orderBy('id', 'asc'));
    const snap = await getDocs(q);
    const out = { values: {}, invested: {} };
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data?.id) return;
      out.values[data.id] = data.value ?? null;
      out.invested[data.id] = data.invested ?? null;
    });
    return out;
  } catch {
    return { values: {}, invested: {} };
  }
}

async function saveValue(id, value) {
  const ym = parseYMString(id);
  if (!ym) return;
  await setDoc(doc(VALUES_COL, id), {
    id,
    y: ym.y,
    m: ym.m,
    value: value ?? null,
    updated_at: Date.now()
  }, { merge: true });
}

async function saveInvested(id, invested) {
  const ym = parseYMString(id);
  if (!ym) return;
  await setDoc(doc(VALUES_COL, id), {
    id,
    y: ym.y,
    m: ym.m,
    invested: invested ?? null,
    updated_at: Date.now()
  }, { merge: true });
}

function formatMonthLabel(ym) {
  const date = new Date(ym.y, ym.m - 1, 1);
  return date.toLocaleDateString('pt-PT', {
    month: 'short',
    year: 'numeric'
  });
}

function buildInvestedTotals(months) {
  const totals = {};
  let running = 0;

  months.forEach((ym, index) => {
    const id = ymToId(ym);
    const override = state.invested[id];
    if (Number.isFinite(override)) {
      running = override;
    } else if (index === 0 && running === 0) {
      running = MONTHLY_INV;
    } else {
      running += MONTHLY_INV;
    }
    totals[id] = running;
  });

  return totals;
}

function buildTable(months) {
  const wrap = document.getElementById('revolut-table-wrap');
  if (!wrap) return;

  const rowsByYear = new Map();
  months.forEach((ym) => {
    if (!rowsByYear.has(ym.y)) rowsByYear.set(ym.y, []);
    rowsByYear.get(ym.y).push(ym);
  });

  const table = document.createElement('table');
  table.className = 'table-dca';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Mês</th>
      <th class="num">INV</th>
      <th class="num">Valor Carteira</th>
      <th class="num">Variação</th>
    </tr>
  `;
  table.appendChild(thead);

  const investedTotals = buildInvestedTotals(months);

  const years = Array.from(rowsByYear.keys()).sort((a, b) => a - b);
  years.forEach((year) => {
    const tbody = document.createElement('tbody');
    tbody.className = 'year-group';
    tbody.dataset.year = String(year);

    rowsByYear.get(year).forEach((ym) => {
      const id = ymToId(ym);
      const investedTotal = investedTotals[id] ?? 0;
      const storedValue = state.values[id];
      const hasValue = Number.isFinite(storedValue);
      const diff = hasValue ? storedValue - investedTotal : null;
      const diffPct = hasValue && investedTotal > 0 ? (diff / investedTotal * 100) : null;
      const diffClass = diff != null && diff >= 0 ? 'pos' : (diff != null ? 'neg' : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatMonthLabel(ym)}</td>
        <td class="num">
          <input
            type="number"
            step="0.01"
            min="0"
            class="revolut-invested-input cell"
            data-id="${id}"
            data-default="${investedTotal.toFixed(2)}"
            placeholder="${investedTotal.toFixed(2)}"
          />
        </td>
        <td class="num">
          <input
            type="number"
            step="0.01"
            min="0"
            class="revolut-value-input cell"
            data-id="${id}"
            placeholder="0.00"
          />
        </td>
        <td class="num ${diffClass}">
          ${hasValue ? `${diff.toFixed(2)} € (${diffPct.toFixed(2)}%)` : '-'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
  });

  wrap.innerHTML = '';
  wrap.appendChild(table);

  applyValuesToInputs();
  bindInputHandlers();
  applyYearVisibility();
}

function applyValuesToInputs() {
  const inputs = document.querySelectorAll('.revolut-value-input');
  inputs.forEach((input) => {
    const id = input.dataset.id;
    if (!id) return;
    const value = state.values[id];
    input.value = Number.isFinite(value) ? Number(value).toFixed(2) : '';
  });

  const investedInputs = document.querySelectorAll('.revolut-invested-input');
  investedInputs.forEach((input) => {
    const id = input.dataset.id;
    if (!id) return;
    const value = state.invested[id];
    if (Number.isFinite(value)) {
      input.value = Number(value).toFixed(2);
    } else {
      input.value = input.dataset.default ?? '';
    }
  });
}

function bindInputHandlers() {
  document.querySelectorAll('.revolut-value-input').forEach((input) => {
    input.addEventListener('change', async () => {
      const id = input.dataset.id;
      if (!id) return;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0) {
        input.value = '';
        delete state.values[id];
      } else {
        state.values[id] = value;
      }
      try {
        await saveValue(id, state.values[id] ?? null);
        render();
      } catch (err) {
        console.error('Erro ao gravar valor Revolut:', err);
        showToast('Erro ao gravar valor mensal.', 'error');
      }
    });
  });

  document.querySelectorAll('.revolut-invested-input').forEach((input) => {
    input.addEventListener('change', async () => {
      const id = input.dataset.id;
      if (!id) return;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0) {
        input.value = '';
        delete state.invested[id];
      } else {
        state.invested[id] = value;
      }
      try {
        await saveInvested(id, state.invested[id] ?? null);
        render();
      } catch (err) {
        console.error('Erro ao gravar valor investido Revolut:', err);
        showToast('Erro ao gravar valor investido.', 'error');
      }
    });
  });
}

function updateChart(months) {
  const canvas = document.getElementById('revolut-chart');
  if (!canvas) return;

  const labels = [];
  const investedSeries = [];
  const valueSeries = [];
  const investedTotals = buildInvestedTotals(months);

  months.forEach((ym, index) => {
    const id = ymToId(ym);
    const value = state.values[id];
    if (!Number.isFinite(value)) return;
    labels.push(formatMonthLabel(ym));
    const investedTotal = investedTotals[id] ?? (MONTHLY_INV * (index + 1));
    investedSeries.push(investedTotal);
    valueSeries.push(value);
  });

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  if (labels.length === 0) return;

  state.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Investido',
          data: investedSeries,
          borderColor: '#1565c0',
          backgroundColor: 'rgba(21, 101, 192, 0.15)',
          borderWidth: 2,
          tension: 0.25
        },
        {
          label: 'Valor Carteira',
          data: valueSeries,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.15)',
          borderWidth: 2,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} €`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => `${Number(value).toFixed(0)} €`
          }
        }
      }
    }
  });
}

function updateProgress(months) {
  const pctEl = document.getElementById('revolut-progress-percentage');
  const fillEl = document.getElementById('revolut-progress-bar-fill');
  const textEl = document.getElementById('revolut-progress-bar-text');
  const investedEl = document.getElementById('revolut-progress-invested');
  const targetEl = document.getElementById('revolut-progress-target');
  const remainingEl = document.getElementById('revolut-progress-remaining');

  if (!pctEl || !fillEl || !textEl || !investedEl || !targetEl || !remainingEl) return;

  const investedTotals = buildInvestedTotals(months);
  const totalMonths = months.length;
  const lastId = totalMonths > 0 ? ymToId(months[totalMonths - 1]) : null;
  const totalTarget = lastId ? (investedTotals[lastId] ?? 0) : 0;

  const now = new Date();
  const currentYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
  let currentIndex = -1;
  months.forEach((ym, idx) => {
    if (ym.y < currentYM.y || (ym.y === currentYM.y && ym.m <= currentYM.m)) {
      currentIndex = idx;
    }
  });

  const currentId = currentIndex >= 0 ? ymToId(months[currentIndex]) : null;
  const investedSoFar = currentId ? (investedTotals[currentId] ?? 0) : 0;
  const remaining = Math.max(0, totalTarget - investedSoFar);
  const percentage = totalTarget > 0 ? (investedSoFar / totalTarget * 100) : 0;

  pctEl.textContent = `${percentage.toFixed(1)}%`;
  fillEl.style.width = `${Math.min(percentage, 100)}%`;
  textEl.textContent = investedSoFar > 0 ? `${investedSoFar.toFixed(0)} €` : '';
  investedEl.textContent = `${investedSoFar.toFixed(0)} €`;
  targetEl.textContent = `${totalTarget.toFixed(0)} €`;
  remainingEl.textContent = `Faltam ${remaining.toFixed(0)} €`;
}

function applyYearVisibility() {
  const groups = Array.from(document.querySelectorAll('.year-group'))
    .map((el) => ({
      el,
      year: Number(el.dataset.year)
    }))
    .filter((g) => Number.isFinite(g.year));

  const pastBtn = document.getElementById('toggle-past-years');
  const futureBtn = document.getElementById('toggle-future-years');

  if (groups.length === 0) return;

  const nowYear = new Date().getFullYear();
  const years = groups.map((g) => g.year);
  const anchorYear = years.includes(nowYear)
    ? nowYear
    : Math.max(...years);

  groups.forEach(({ el, year }) => {
    const visible = year === anchorYear
      || (state.showPastYears && year < anchorYear)
      || (state.showFutureYears && year > anchorYear);
    el.style.display = visible ? '' : 'none';
  });

  const hasPast = groups.some((g) => g.year < anchorYear);
  const hasFuture = groups.some((g) => g.year > anchorYear);

  if (pastBtn) {
    pastBtn.textContent = state.showPastYears ? 'Ocultar anos passados' : 'Expandir anos passados';
    pastBtn.setAttribute('aria-expanded', state.showPastYears ? 'true' : 'false');
    pastBtn.disabled = !hasPast && !state.showPastYears;
  }

  if (futureBtn) {
    futureBtn.textContent = state.showFutureYears ? 'Ocultar anos futuros' : 'Expandir anos futuros';
    futureBtn.setAttribute('aria-expanded', state.showFutureYears ? 'true' : 'false');
    futureBtn.disabled = !hasFuture && !state.showFutureYears;
  }
}

function bindYearToggles() {
  const pastBtn = document.getElementById('toggle-past-years');
  const futureBtn = document.getElementById('toggle-future-years');

  pastBtn?.addEventListener('click', () => {
    state.showPastYears = !state.showPastYears;
    applyYearVisibility();
  });

  futureBtn?.addEventListener('click', () => {
    state.showFutureYears = !state.showFutureYears;
    applyYearVisibility();
  });
}

function getDefaultEndYM() {
  const now = new Date();
  const year = Math.max(START_YM.y, now.getFullYear() + 2);
  return { y: year, m: 12 };
}

function syncEndDateInput() {
  const input = document.getElementById('revolut-end-date');
  if (!input || !state.endYM) return;
  input.min = `${ymToId(START_YM)}-01`;
  input.value = `${ymToId(state.endYM)}-01`;
}

function bindEndDateInput() {
  const input = document.getElementById('revolut-end-date');
  if (!input) return;
  const maybeShowPicker = () => {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    }
  };
  input.addEventListener('focus', maybeShowPicker);
  input.addEventListener('click', maybeShowPicker);
}

function bindParamsButtons() {
  const saveBtn = document.getElementById('revolut-save-params');
  const input = document.getElementById('revolut-end-date');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const ym = parseDateInput(input?.value);
      if (!ym) {
        showToast('Data final inválida.', 'error');
        return;
      }
      const normalized = (ym.y < START_YM.y || (ym.y === START_YM.y && ym.m < START_YM.m))
        ? { ...START_YM }
        : ym;

      try {
        await saveParams({ endYM: normalized });
        state.endYM = normalized;
        render();
        showToast('Parâmetros gravados.', 'success');
      } catch (err) {
        console.error('Erro ao gravar data final Revolut:', err);
        showToast('Erro ao gravar parâmetros.', 'error');
      }
    });
  }
}

function render() {
  if (!state.endYM) return;
  const months = monthsBetween(START_YM, state.endYM);
  buildTable(months);
  syncEndDateInput();
  updateChart(months);
  updateProgress(months);
}

async function init() {
  const params = await loadParams();
  state.endYM = parseYMString(params?.endYM) || params?.endYM || getDefaultEndYM();
  if (!state.endYM?.y) state.endYM = getDefaultEndYM();
  const loaded = await loadValues();
  state.values = loaded.values || {};
  state.invested = loaded.invested || {};

  bindEndDateInput();
  bindParamsButtons();
  bindYearToggles();
  syncEndDateInput();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
