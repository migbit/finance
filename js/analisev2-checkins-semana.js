import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { parseLocalDate, VIEW_APTS } from './analisev2-core.js';

const SERIES_COLORS = {
  total: 'rgb(20, 78, 3)',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};

const LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const BASE_YEAR = 2025;
const fallbackPercentPlugin = {
  id: 'checkinsPercentLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    data.datasets.forEach((dataset, datasetIndex) => {
      const total = dataset.total || 0;
      if (!total) return;
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((element, index) => {
        const value = dataset.data?.[index];
        if (!Number.isFinite(value) || value <= 0) return;
        const pct = (value / total) * 100;
        if (!Number.isFinite(pct)) return;
        const text = `${Math.round(pct)}%`;
        ctx.save();
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 11px Montserrat, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const { x, y } = element.getCenterPoint();
        ctx.fillText(text, x, y);
        ctx.restore();
      });
    });
  }
};

const state = {
  view: 'total',
  rows: [],
  chart: null
};
let checkinsButtonsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="checkins-semana"]')) return;
  bindButtons();
  await loadRows();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'checkins-semana') loadRows();
});

window.addEventListener('beforeunload', cleanupCheckinsResources);

function bindButtons() {
  if (checkinsButtonsController) checkinsButtonsController.abort();
  checkinsButtonsController = new AbortController();
  const { signal } = checkinsButtonsController;

  document.querySelectorAll('[data-checkins-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.checkinsView;
      if (!next || next === state.view) return;
      state.view = next;
      updateButtons();
      render();
    }, { signal });
  });
  updateButtons();
}

function updateButtons() {
  document.querySelectorAll('[data-checkins-view]').forEach((btn) => {
    const active = btn.dataset.checkinsView === state.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadRows() {
  window.loadingManager?.show('checkins-semana', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    state.rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!state.rows.length) {
      renderEmpty('Sem dados disponíveis.');
    } else {
      render();
    }
  } catch (error) {
    window.errorHandler?.handleError('checkins-semana', error, 'loadRows', loadRows);
    state.rows = [];
    renderEmpty('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('checkins-semana');
  }
}

function render() {
  const rows = filterRows(VIEW_APTS[state.view]);
  if (!rows.length) {
    renderEmpty('Sem dados para esta vista.');
    return;
  }
  const dataset = calculateCounts(rows, state.view);
  if (!dataset.curr.some((v) => v > 0) && !dataset.prev.some((v) => v > 0)) {
    renderEmpty('Sem check-ins registados.');
    return;
  }
  renderChart(dataset);
}

function filterRows(apartments) {
  if (!apartments || !apartments.length) return [];
  const allow = new Set(apartments.map(String));
  return state.rows.filter((row) => allow.has(String(row.apartamento)));
}

function calculateCounts(rows, view) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const curr = Array(7).fill(0);
  const prev = Array(7).fill(0);

  rows.forEach((row) => {
    const checkIn = row.checkIn;
    if (typeof checkIn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return;
    if (checkIn > todayISO) return;
    const date = parseLocalDate(checkIn);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    if (year < BASE_YEAR) return;
    const idx = (date.getDay() + 6) % 7; // convert Sunday=0 to Monday=0
    if (year === currentYear) curr[idx] += 1;
    if (year === lastYear && lastYear >= BASE_YEAR) prev[idx] += 1;
  });

  const color = SERIES_COLORS[view] || SERIES_COLORS.total;

  return { curr, prev, currentYear, lastYear, color };
}

function renderChart({ curr, prev, currentYear, lastYear, color }) {
  const canvas = document.getElementById('chart-checkins-semana');
  if (!canvas) return;
  const wrap = document.querySelector('#mod-checkins-semana .chart-wrap');
  if (wrap) wrap.querySelector('.heatmap-muted')?.remove();
  destroyCheckinsChart();

  const datasets = [];
  const hasPrev = lastYear >= BASE_YEAR && prev.some((v) => v > 0);
  if (hasPrev) {
    const totalPrev = prev.reduce((sum, val) => sum + (val || 0), 0);
    datasets.push({
      label: String(lastYear),
      data: prev,
      backgroundColor: withAlpha('rgba(148,163,184,1)', 0.35),
      borderColor: 'rgba(148,163,184,1)',
      borderWidth: 1,
      categoryPercentage: 0.7,
      barPercentage: 0.8,
      total: totalPrev
    });
  }
  const totalCurr = curr.reduce((sum, val) => sum + (val || 0), 0);
  datasets.push({
    label: String(currentYear),
    data: curr,
    backgroundColor: withAlpha(color, 0.35),
    borderColor: color,
    borderWidth: 1,
    categoryPercentage: 0.7,
    barPercentage: 0.8,
    total: totalCurr
  });

  const hasDataLabelsPlugin = typeof ChartDataLabels !== 'undefined';
  const runtimePlugins = hasDataLabelsPlugin ? [ChartDataLabels] : [fallbackPercentPlugin];

  state.chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${context.parsed.y}`
          }
        },
        datalabels: hasDataLabelsPlugin ? {
          anchor: 'center',
          align: 'center',
          offset: 0,
          color: '#0f172a',
          font: {
            weight: '600',
            size: 11
          },
          formatter: (value, context) => {
            const total = context.dataset?.total || 0;
            if (!total) return '';
            const pct = (Number(value) / total) * 100;
            if (!Number.isFinite(pct)) return '';
            return `${Math.round(pct)}%`;
          }
        } : undefined
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        }
      }
    },
    plugins: runtimePlugins
  });
}

function renderEmpty(message) {
  destroyCheckinsChart();
  const canvas = document.getElementById('chart-checkins-semana');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const wrap = document.querySelector('#mod-checkins-semana .chart-wrap');
  if (wrap) {
    wrap.querySelector('.heatmap-muted')?.remove();
    const msg = document.createElement('div');
    msg.className = 'heatmap-muted';
    msg.textContent = message;
    wrap.appendChild(msg);
  }
}

function destroyCheckinsChart() {
  if (!state.chart) return;
  try {
    state.chart.destroy();
  } catch (err) {
    console.warn('Chart destruction failed (checkins-semana)', err);
    const canvas = state.chart.canvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } finally {
    state.chart = null;
  }
}

function cleanupCheckinsResources() {
  if (checkinsButtonsController) {
    checkinsButtonsController.abort();
    checkinsButtonsController = null;
  }
  destroyCheckinsChart();
}

function withAlpha(color, alpha) {
  if (color.startsWith('rgba')) {
    return color.replace(/rgba\(([^)]+),\s*[^,]+\)/, `rgba($1, ${alpha})`);
  }
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  return color;
}
