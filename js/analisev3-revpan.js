import { MONTH_LABELS, formatEuro } from './analisev2-core.js';
import { createChart, destroyChartSafe } from './analisev2-charts.js';
import { getMonthlyPerformance } from './analisev3-data.js';

const VIEW_APTS = {
  total: ['123', '1248'],
  '123': ['123'],
  '1248': ['1248'],
  compare: []
};

const COLORS = {
  total: '#0f6e2f',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};

const MIN_REVPAN_YEAR = 2025;

const state = {
  view: 'total',
  months: [],
  chart: null
};

let buttonsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="revpan"]')) return;
  bindViewButtons();
  await loadRevpan();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'revpan') loadRevpan();
});

window.addEventListener('beforeunload', () => {
  if (buttonsController) buttonsController.abort();
  destroyChart();
});

function bindViewButtons() {
  if (buttonsController) buttonsController.abort();
  buttonsController = new AbortController();
  const { signal } = buttonsController;
  document.querySelectorAll('[data-revpan-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.revpanView;
      if (!view || view === state.view) return;
      state.view = view;
      updateViewButtons();
      renderRevpan();
    }, { signal });
  });
  updateViewButtons();
}

function updateViewButtons() {
  document.querySelectorAll('[data-revpan-view]').forEach((btn) => {
    const active = btn.dataset.revpanView === state.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadRevpan() {
  window.loadingManager?.show('revpan', { type: 'skeleton' });
  try {
    const { months } = await getMonthlyPerformance();
    const filtered = months.filter((month) => Number(month.year) >= MIN_REVPAN_YEAR);
    state.months = filtered;
    if (!filtered.length) {
      renderEmpty(`Sem dados disponíveis (apenas ${MIN_REVPAN_YEAR}+).`);
    } else {
      renderRevpan();
    }
  } catch (error) {
    window.errorHandler?.handleError('revpan', error, 'loadRevpan', loadRevpan);
    state.months = [];
    renderEmpty('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('revpan');
  }
}

function renderRevpan() {
  if (!state.months.length) {
    renderEmpty('Sem dados.');
    return;
  }

  if (state.view === 'compare') {
    renderRevpanCompare();
    return;
  }

  const viewApts = VIEW_APTS[state.view];
  const series = buildRevpanSeries(state.months, viewApts);
  if (!series.years.length) {
    renderEmpty('Sem dados suficientes.');
    return;
  }

  renderChart(series);
  renderHighlight(series);
}

function buildRevpanSeries(months, apartments) {
  const years = new Map();
  months.forEach((month) => {
    if (!apartments?.length) return;
    const key = month.year;
    if (!years.has(key)) years.set(key, Array(12).fill(null));
    const revenue = apartments.reduce((sum, apt) => sum + (month.revenueByApt?.[apt] || 0), 0);
    const available = apartments.reduce((sum, apt) => sum + (month.availableByApt?.[apt] || month.availableTotal / 2), 0);
    if (!available) return;
    const value = (revenue / available) * 100;
    const arr = years.get(key);
    arr[month.month - 1] = Number.isFinite(value) ? value : null;
  });
  const sortedYears = Array.from(years.keys()).sort((a, b) => a - b);
  return { years: sortedYears, map: years };
}

function renderRevpanCompare() {
  const canvas = document.getElementById('chart-revpan');
  if (!canvas || typeof Chart === 'undefined') return;
  const series123 = buildRevpanSeries(state.months, ['123']);
  const series1248 = buildRevpanSeries(state.months, ['1248']);
  const year123 = selectLatestYear(series123.years);
  const year1248 = selectLatestYear(series1248.years);
  if (!year123 && !year1248) {
    renderEmpty('Sem dados suficientes para comparar.');
    return;
  }

  destroyChart();
  const datasets = [];
  if (year123 && series123.map.get(year123)) {
    datasets.push({
      label: `123 (${year123})`,
      data: series123.map.get(year123),
      borderColor: COLORS['123'],
      backgroundColor: withAlpha(COLORS['123'], 0.2),
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 3,
      pointHoverRadius: 5
    });
  }
  if (year1248 && series1248.map.get(year1248)) {
    datasets.push({
      label: `1248 (${year1248})`,
      data: series1248.map.get(year1248),
      borderColor: COLORS['1248'],
      backgroundColor: withAlpha(COLORS['1248'], 0.2),
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 3,
      pointHoverRadius: 5
    });
  }

  state.chart = createChart(canvas, {
    type: 'line',
    data: { labels: MONTH_LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${formatEuro(value)} /100 noites`
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: { grid: { display: false } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatEuro(context.parsed.y)} /100 noites`
          }
        },
        legend: { position: 'top' }
      }
    }
  }, { previousChart: state.chart });

  const info = document.getElementById('revpan-highlight');
  if (info) {
    info.textContent = 'Comparação direta entre apartamentos 123 e 1248.';
  }
}

function renderChart(series) {
  destroyChart();
  const canvas = document.getElementById('chart-revpan');
  if (!canvas || typeof Chart === 'undefined') return;
  const datasets = [];
  const latestYear = series.years[series.years.length - 1];
  const prevYear = series.years.length > 1 ? series.years[series.years.length - 2] : null;
  if (prevYear) {
    datasets.push({
      label: `${prevYear}`,
      data: series.map.get(prevYear),
      borderColor: 'rgba(148,163,184,1)',
      backgroundColor: 'rgba(148,163,184,0.15)',
      borderWidth: 1,
      tension: 0.25,
      spanGaps: true
    });
  }
  if (latestYear) {
    datasets.push({
      label: `${latestYear}`,
      data: series.map.get(latestYear),
      borderColor: COLORS[state.view] || COLORS.total,
      backgroundColor: withAlpha(COLORS[state.view] || COLORS.total, 0.15),
      borderWidth: 2,
      tension: 0.3,
      spanGaps: true,
      pointRadius: 3,
      pointHoverRadius: 5
    });
  }

  const plugins = [];
  if (typeof ChartDataLabels !== 'undefined') plugins.push(ChartDataLabels);

  state.chart = createChart(canvas, {
    type: 'line',
    data: { labels: MONTH_LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${formatEuro(value)} /100 noites`
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: { grid: { display: false } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              return `${context.dataset.label}: ${formatEuro(value)} /100 noites`;
            }
          }
        },
        legend: { position: 'top' },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          align: 'top',
          anchor: 'end',
          formatter: (value) => (value ? formatEuro(value) : ''),
          font: { size: 10, weight: '600' }
        } : undefined
      }
    }
  }, { previousChart: state.chart, preserveAspectRatio: true });
}

function renderHighlight(series) {
  if (state.view === 'compare') return;
  const info = document.getElementById('revpan-highlight');
  if (!info) return;
  const latestYear = series.years[series.years.length - 1];
  const prevYear = series.years.length > 1 ? series.years[series.years.length - 2] : null;
  const latestArray = latestYear ? series.map.get(latestYear) : null;
  if (!latestArray) {
    info.textContent = 'Sem dados recentes para RevPAN.';
    return;
  }
  const lastIndex = findLastValueIndex(latestArray);
  if (lastIndex === -1) {
    info.textContent = 'Sem valores no ano atual.';
    return;
  }
  const latestValue = latestArray[lastIndex];
  const prevValue = prevYear ? series.map.get(prevYear)?.[lastIndex] : null;
  const monthName = MONTH_LABELS[lastIndex];
  if (latestValue == null) {
    info.textContent = 'Sem valores calculados.';
    return;
  }
  let trend = null;
  if (prevValue != null) {
    const delta = latestValue - prevValue;
    const symbol = delta >= 0 ? '+' : '−';
    trend = `${symbol}${formatEuro(Math.abs(delta))}`;
  }
  info.textContent = prevValue != null
    ? `${monthName}: RevPAN ${formatEuro(latestValue)} /100 noites (${trend} vs ${prevYear})`
    : `${monthName}: RevPAN ${formatEuro(latestValue)} /100 noites`;
}

function findLastValueIndex(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return i;
  }
  return -1;
}

function renderEmpty(message) {
  destroyChart();
  const info = document.getElementById('revpan-highlight');
  if (info) info.textContent = message;
  const canvas = document.getElementById('chart-revpan');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function destroyChart() {
  if (state.chart) {
    destroyChartSafe(state.chart);
    state.chart = null;
  }
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

function selectLatestYear(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[list.length - 1];
}
