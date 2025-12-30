import { db } from './script.js';
import { createChart, destroyChartSafe } from './analisev2-charts.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import {
  consolidarFaturas,
  splitFaturaPorDia,
  valorFatura,
  formatEuro,
  MONTH_LABELS,
  VIEW_APTS
} from './analisev2-core.js';

const METRICS = {
  parcial: { labelId: 'label-parcial', textId: 'donut-parcial-text', canvasId: 'donut-parcial' },
  ate: { labelId: 'label-ateset', textId: 'donut-ateset-text', canvasId: 'donut-ateset' },
  vs: { labelId: 'label-vs', textId: 'donut-vs-text', canvasId: 'donut-vs' },
  avg: { labelId: 'label-avg', textId: 'donut-avg-text', canvasId: 'donut-avg' }
};

const donutStates = new Map();
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let currentView = 'total';
let currentGranularity = 'dia';
let faturasData = [];
let faturasByGranularity = { dia: [] };
let filterButtonsController = null;
let granularityButtonsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="progresso"]')) return;

  bindFilterButtons();
  bindGranularityButtons();
  updateUpdatedAt(null);

  await loadFaturasData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'progresso') {
    loadFaturasData();
  }
});

window.addEventListener('beforeunload', handleModuleTeardown);

function bindFilterButtons() {
  if (filterButtonsController) filterButtonsController.abort();
  filterButtonsController = new AbortController();
  const { signal } = filterButtonsController;

  document.querySelectorAll('[data-progress-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.progressView;
      if (!view || view === currentView) return;
      currentView = view;
      updateButtonState();
      updateProgressoCharts();
    }, { signal });
  });

  updateButtonState();
}

function bindGranularityButtons() {
  if (granularityButtonsController) granularityButtonsController.abort();
  granularityButtonsController = new AbortController();
  const { signal } = granularityButtonsController;

  document.querySelectorAll('[data-progress-granularity]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.progressGranularity;
      if (!mode || mode === currentGranularity) return;
      currentGranularity = mode;
      updateGranularityButtons();
      updateProgressoCharts();
    }, { signal });
  });
  updateGranularityButtons();
}

function updateProgressTitleYear(previousYear) {
  const yearSpan = document.getElementById('progress-compare-year');
  if (!yearSpan) return;
  const year = Number.isFinite(previousYear) ? previousYear : (new Date().getFullYear() - 1);
  yearSpan.textContent = year;
}

async function loadFaturasData() {
  window.loadingManager?.show('progresso', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    faturasData = consolidarFaturas(raw).filter(f => VIEW_APTS.total.includes(String(f.apartamento)));
    faturasByGranularity = buildGranularityDatasets(faturasData);

    if (!faturasData.length) {
      showEmptyState('Sem dados disponíveis');
    } else {
      updateProgressoCharts();
    }
  } catch (error) {
    window.errorHandler?.handleError('progresso', error, 'loadFaturasData', loadFaturasData);
    faturasData = [];
    faturasByGranularity = { dia: [] };
    showEmptyState('Sem dados disponíveis');
  } finally {
    window.loadingManager?.hide('progresso');
  }
}

function updateProgressoCharts() {
  const filtered = getFilteredFaturas();
  if (!filtered.length) {
    showEmptyState('Sem dados para esta vista');
    return;
  }
  cleanupDonuts();

  const { years, ultimoAno, penultimoAno } = deriveReferenceYears(filtered);
  const cutoffMonth = deriveCutoffMonth();

  updateProgressTitleYear(penultimoAno);

  updateParcial(filtered, ultimoAno, penultimoAno);
  updateAte(filtered, ultimoAno, penultimoAno, cutoffMonth);
  updateVs(filtered, ultimoAno, penultimoAno);
  updateAvg(filtered, ultimoAno, years);

  updateUpdatedAt(formatTimestamp(new Date()));
}

function deriveReferenceYears(faturas) {
  const years = [...new Set((faturas || []).map(f => Number(f.ano)).filter(Number.isFinite))]
    .sort((a, b) => a - b);
  const nowYear = new Date().getFullYear();

  const eligible = years.filter(y => y <= nowYear);
  const ultimoAno = eligible.length
    ? eligible[eligible.length - 1]
    : (years.length ? years[years.length - 1] : nowYear);

  const idx = years.indexOf(ultimoAno);
  const penultimoAno = idx > 0 ? years[idx - 1] : (ultimoAno - 1);

  return { years, ultimoAno, penultimoAno };
}

function showEmptyState(message) {
  cleanupDonuts();
  Object.values(METRICS).forEach(metric => {
    const textEl = document.getElementById(metric.textId);
    if (textEl) textEl.textContent = message;
    renderNeutralDonut(document.getElementById(metric.canvasId));
  });
  updateUpdatedAt(null);
}

function updateButtonState() {
  document.querySelectorAll('[data-progress-view]').forEach(btn => {
    const isActive = btn.dataset.progressView === currentView;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateGranularityButtons() {
  document.querySelectorAll('[data-progress-granularity]').forEach(btn => {
    const isActive = btn.dataset.progressGranularity === currentGranularity;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function getFilteredFaturas() {
  const targets = VIEW_APTS[currentView] || VIEW_APTS.total;
  const dataset = currentGranularity === 'dia'
    ? (faturasByGranularity.dia || [])
    : (faturasData || []);
  return dataset.filter(f => targets.includes(String(f.apartamento)));
}

function updateParcial(faturas, ultimoAno, penultimoAno) {
  const mesAtual = new Date().getMonth() + 1;
  const atual = somar(faturas, f => Number(f.ano) === ultimoAno && Number(f.mes) === mesAtual);
  const anterior = somar(faturas, f => Number(f.ano) === penultimoAno && Number(f.mes) === mesAtual);
  renderMetric('parcial', {
    labelText: `Parcial ${obterNomeMes(mesAtual)}`,
    atual,
    comparacao: anterior
  });
}

function updateAte(faturas, ultimoAno, penultimoAno, cutoffMonth) {
  const monthLimit = clampMonth(cutoffMonth);
  const atual = somar(faturas, f => Number(f.ano) === ultimoAno && Number(f.mes) <= monthLimit);
  const anterior = somar(faturas, f => Number(f.ano) === penultimoAno && Number(f.mes) <= monthLimit);
  const prevMonth = obterNomeMes(monthLimit);
  renderMetric('ate', {
    labelText: `Até ${prevMonth}`,
    atual,
    comparacao: anterior
  });
}

function updateVs(faturas, ultimoAno, penultimoAno) {
  const atual = somar(faturas, f => Number(f.ano) === ultimoAno);
  const anterior = somar(faturas, f => Number(f.ano) === penultimoAno);
  renderMetric('vs', {
    labelText: `${ultimoAno} vs ${penultimoAno}`,
    atual,
    comparacao: anterior
  });
}

function updateAvg(faturas, ultimoAno, years) {
  const atual = somar(faturas, f => Number(f.ano) === ultimoAno);
  const previousYears = years.filter(y => y < ultimoAno);

  if (!previousYears.length) {
    setMetricLabel('label-avg', `${ultimoAno} vs anos anteriores`);
    const textEl = document.getElementById('donut-avg-text');
    if (textEl) textEl.textContent = 'Sem anos anteriores para calcular a média';
    makeDonut(document.getElementById('donut-avg'), 0);
    return;
  }

  const totalPrev = previousYears.reduce((acc, ano) => acc + somar(faturas, f => Number(f.ano) === ano), 0);
  const mediaAnterior = totalPrev / previousYears.length;
  const labelText = `${ultimoAno} vs ${previousYears.join(', ')}`;

  renderMetric('avg', {
    labelText,
    atual,
    comparacao: mediaAnterior,
    labels: {
      positive: 'Acima da média em',
      negative: 'Abaixo da média em',
      equal: 'Em linha com a média'
    }
  });
}

function renderMetric(metricKey, { labelText, atual, comparacao, labels }) {
  const metric = METRICS[metricKey];
  if (!metric) return;

  if (labelText) setMetricLabel(metric.labelId, labelText);

  const diff = atual - comparacao;
  const base = comparacao === 0 ? (atual === 0 ? 1 : Math.abs(atual)) : comparacao;
  const pct = (diff / base) * 100;

  const txt = document.getElementById(metric.textId);
  if (txt) txt.textContent = formatDelta(diff, labels);

  updateDonut(metric.canvasId, pct, diff);
}

function somar(faturas, predicate) {
  return faturas.reduce((acc, f) => {
    if (!predicate(f)) return acc;
    return acc + valorFatura(f);
  }, 0);
}

function obterNomeMes(numeroMes) {
  const idx = Math.max(1, Math.min(12, Number(numeroMes))) - 1;
  return MONTH_LABELS[idx];
}

function formatDelta(diff, labels = {}) {
  const {
    positive = 'Excedeu',
    negative = 'Faltam',
    equal = 'Em linha com o período de comparação'
  } = labels;

  if (!Number.isFinite(diff)) return '—';
  if (diff === 0) return equal;

  const abs = formatEuro(Math.abs(diff));
  return diff > 0 ? `${positive} ${abs}` : `${negative} ${abs}`;
}

function setMetricLabel(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateUpdatedAt(formatted) {
  const el = document.getElementById('analisev2-updated');
  if (!el) return;
  el.textContent = formatted ? `Atualizado a ${formatted}` : 'Atualizado a —';
}

function formatTimestamp(date) {
  const d = date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const t = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return `${d} ${t}`;
}

function buildGranularityDatasets(base) {
  const monthly = Array.isArray(base) ? [...base] : [];
  const perDay = [];
  monthly.forEach(f => {
    const slices = splitFaturaPorDia(f);
    if (slices && slices.length) perDay.push(...slices);
    else perDay.push(f);
  });
  return { dia: perDay };
}

const cssVar = (name, fallback) =>
  (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;

function deriveCutoffMonth() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const previousMonth = currentMonth > 1 ? currentMonth - 1 : 12;
  return clampMonth(previousMonth);
}

function updateDonut(canvasId, percentSigned, diff) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const nextValue = clamp(Math.abs(percentSigned), 0, 100);
  const isPositive = diff >= 0;
  const color = isPositive ? cssVar('--ok', '#16a34a') : cssVar('--bad', '#e11d48');
  const label = `${percentSigned >= 0 ? '+' : ''}${nextValue.toFixed(2)}%`;

  let state = donutStates.get(canvasId);

  if (!state) {
    const chart = createDonut(canvas, nextValue, color, label);
    donutStates.set(canvasId, { chart, value: nextValue, color });
    return;
  }

  const { chart } = state;
  const dataset = chart.data.datasets[0];
  dataset.data = [nextValue, 100 - nextValue];
  dataset.backgroundColor[0] = color;
  chart.options.plugins.centerText.text = label;
  chart.options.plugins.centerText.color = color;
  if (reduceMotionQuery.matches) {
    chart.update('none');
  } else {
    chart.options.animation = {
      duration: 700,
      easing: 'easeOutCubic'
    };
    chart.update();
    triggerDonutPulse(canvas, isPositive);
  }
  state.value = nextValue;
  state.color = color;
}

function createDonut(canvas, value, color, label) {
  if (!canvas) return null;
  canvas.style.width = '160px';
  canvas.style.height = '160px';
  canvas.width = 160;
  canvas.height = 160;

  const chart = createChart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value, 100 - value],
        backgroundColor: [color, '#eef2f7'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      devicePixelRatio: 1,
      cutout: '70%',
      animation: reduceMotionQuery.matches ? false : { duration: 700, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
        centerText: {
          text: label,
          color
        }
      }
    },
  });

  if (!reduceMotionQuery.matches) triggerDonutPulse(canvas, color === cssVar('--ok', '#16a34a'));

  return chart;
}

function renderNeutralDonut(canvas) {
  if (!canvas) return;
  if (donutStates.has(canvas.id)) {
    const state = donutStates.get(canvas.id);
    if (state && state.chart) {
      destroyChartSafe(state.chart);
    }
    donutStates.delete(canvas.id);
  }

  canvas.style.width = '160px';
  canvas.style.height = '160px';
  canvas.width = 160;
  canvas.height = 160;

  const chart = createChart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [50, 50],
        backgroundColor: ['#e2e8f0', '#f1f5f9'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false }
      },
      animation: false
    }
  });
  donutStates.set(canvas.id, { chart, value: 50, color: '#e2e8f0' });
}

function triggerDonutPulse(canvas, positive) {
  if (reduceMotionQuery.matches) return;
  const cls = positive ? 'pulse-positive' : 'pulse-negative';
  canvas.classList.remove('pulse-positive', 'pulse-negative');
  void canvas.offsetWidth;
  canvas.classList.add(cls);
  setTimeout(() => canvas.classList.remove(cls), 320);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampMonth(month) {
  const m = Number(month);
  if (!Number.isFinite(m)) return 1;
  return Math.min(12, Math.max(1, Math.round(m)));
}

function cleanupDonuts() {
  donutStates.forEach((state, canvasId) => {
    if (state?.chart) {
      destroyChartSafe(state.chart);
    }
  });
  donutStates.clear();
}

function cleanupControllers() {
  if (filterButtonsController) {
    filterButtonsController.abort();
    filterButtonsController = null;
  }
  if (granularityButtonsController) {
    granularityButtonsController.abort();
    granularityButtonsController = null;
  }
}

function handleModuleTeardown() {
  cleanupDonuts();
  cleanupControllers();
}
