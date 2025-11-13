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
let currentGranularity = 'mes';
let faturasData = [];
let faturasByGranularity = { mes: [], dia: [] };
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
    faturasByGranularity = { mes: [], dia: [] };
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

  const currentYear = new Date().getFullYear();
  const years = [...new Set(filtered.map(f => Number(f.ano)).filter(Boolean))].sort((a, b) => a - b);
  const ultimoAno = currentYear;
  const penultimoAno = years.length > 1 ? years[years.length - 2] : (ultimoAno - 1);

  updateParcial(filtered, ultimoAno, penultimoAno);
  updateAte(filtered, ultimoAno, penultimoAno);
  updateVs(filtered, ultimoAno, penultimoAno);
  updateAvg(filtered, ultimoAno, years);

  updateUpdatedAt(formatTimestamp(new Date()));
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
  const dataset = faturasByGranularity[currentGranularity] || faturasByGranularity.mes || [];
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

function updateAte(faturas, ultimoAno, penultimoAno) {
  const mesAtual = new Date().getMonth() + 1;
  const atual = somar(faturas, f => Number(f.ano) === ultimoAno && Number(f.mes) < mesAtual);
  const anterior = somar(faturas, f => Number(f.ano) === penultimoAno && Number(f.mes) < mesAtual);
  const prevMonth = obterNomeMes(Math.max(1, mesAtual - 1));
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

  setMetricLabel('label-avg', `${ultimoAno} vs anos anteriores`);

  if (!previousYears.length) {
    const textEl = document.getElementById('donut-avg-text');
    if (textEl) textEl.textContent = 'Sem anos anteriores para calcular a média';
    makeDonut(document.getElementById('donut-avg'), 0);
    return;
  }

  const totalPrev = previousYears.reduce((acc, ano) => {
    return acc + somar(faturas, f => Number(f.ano) === ano);
  }, 0);

  const mediaAnterior = totalPrev / previousYears.length;

  renderMetric('avg', {
    labelText: `${ultimoAno} vs anos anteriores`,
    atual,
    comparacao: mediaAnterior,
    labels: {
      positive: 'Acima da média em',
      negative: 'Abaixo da média em',
      equal: 'Em linha com a média histórica'
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
  return { mes: monthly, dia: perDay };
}

const cssVar = (name, fallback) =>
  (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;

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
