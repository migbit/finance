import { createChart, destroyChartSafe } from './analisev2-charts.js';
import { getFaturas } from './analise-data.js';
import { computeOccupancyPercent } from './analise-metrics.js';
import { formatEuro, parseLocalDate, splitFaturaPorDia, valorFatura, MONTH_LABELS } from './analisev2-core.js';

const BASE_YEAR = 2024;
const OCCUPANCY_BASE_YEAR = 2024;
const APARTMENTS = ['123', '1248'];
const COLORS = {
  total: 'rgb(20, 78, 3)',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};
const HISTORICAL_AVERAGE_COLOR = 'rgba(71, 85, 105, 0.72)';
const TOTAL_YEAR_COLORS = [
  'rgb(20, 78, 3)',
  'rgba(99,102,241,1)',
  'rgba(16,185,129,1)',
  'rgba(225,29,72,1)',
  'rgba(100,116,139,1)',
  'rgba(147,51,234,1)'
];
const APARTMENT_YEAR_COLORS = {
  '123': [
    'rgba(37,99,235,1)',
    'rgba(14,165,233,1)',
    'rgba(29,78,216,1)',
    'rgba(6,182,212,1)',
    'rgba(30,64,175,1)',
    'rgba(96,165,250,1)'
  ],
  '1248': [
    'rgba(217,119,6,1)',
    'rgba(245,158,11,1)',
    'rgba(234,88,12,1)',
    'rgba(251,191,36,1)',
    'rgba(194,65,12,1)',
    'rgba(253,186,116,1)'
  ]
};

const VIEW_CONFIG = {
  total: { apartments: ['123', '1248'], color: COLORS.total },
  '123': { apartments: ['123'], color: COLORS['123'] },
  '1248': { apartments: ['1248'], color: COLORS['1248'] },
  compare: { apartments: ['123', '1248'] }
};

const state = {
  metric: 'revenue',
  mode: 'mes',
  view: 'total',
  progressView: 'total',
  faturas: [],
  dailyEntries: [],
  chart: null,
  tableVisible: false,
  showAllYears: false,
  showAllChartYears: false,
  tableExpanded: false
};

let modeButtonsController = null;
let metricButtonsController = null;
let viewButtonsController = null;
let tableButtonsController = null;
let progressButtonsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="faturacao-v4"]')) return;
  bindControls();
  await loadData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'faturacao-v4') loadData();
});

window.addEventListener('beforeunload', cleanup);

async function loadData() {
  window.loadingManager?.show('faturacao-v4', { type: 'skeleton' });
  try {
    const rows = await getFaturas();
    state.faturas = rows.filter((row) => APARTMENTS.includes(String(row.apartamento)));
    state.dailyEntries = buildDailyEntries(state.faturas);
    if (!state.dailyEntries.length) {
      showEmptyState('Sem dados disponíveis.');
      return;
    }
    render();
  } catch (error) {
    window.errorHandler?.handleError('faturacao-v4', error, 'loadData', loadData);
    state.faturas = [];
    state.dailyEntries = [];
    showEmptyState('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('faturacao-v4');
  }
}

function bindControls() {
  bindMetricButtons();
  bindModeButtons();
  bindViewButtons();
  bindTableButtons();
  bindProgressButtons();
}

function bindMetricButtons() {
  if (metricButtonsController) metricButtonsController.abort();
  metricButtonsController = new AbortController();
  const { signal } = metricButtonsController;

  document.querySelectorAll('[data-faturacao-v4-metric]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const metric = btn.dataset.faturacaoV4Metric;
      if (!metric || metric === state.metric) return;
      state.metric = metric;
      if (metric === 'avg-night') state.mode = 'mes';
      updateMetricButtons();
      updateModeButtons();
      render();
    }, { signal });
  });
  updateMetricButtons();
}

function bindModeButtons() {
  if (modeButtonsController) modeButtonsController.abort();
  modeButtonsController = new AbortController();
  const { signal } = modeButtonsController;

  document.querySelectorAll('[data-faturacao-v4-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.faturacaoV4Mode;
      if (!mode || mode === state.mode) return;
      state.mode = mode;
      updateModeButtons();
      render();
    }, { signal });
  });
  updateModeButtons();
}

function bindViewButtons() {
  if (viewButtonsController) viewButtonsController.abort();
  viewButtonsController = new AbortController();
  const { signal } = viewButtonsController;

  document.querySelectorAll('[data-faturacao-v4-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.faturacaoV4View;
      if (!view || view === state.view) return;
      state.view = view;
      updateViewButtons();
      render();
    }, { signal });
  });
  updateViewButtons();
}

function bindTableButtons() {
  if (tableButtonsController) tableButtonsController.abort();
  tableButtonsController = new AbortController();
  const { signal } = tableButtonsController;

  const tableBtn = document.getElementById('faturacao-v4-toggle-table');
  const yearsBtn = document.getElementById('faturacao-v4-toggle-years');
  const chartYearsBtn = document.getElementById('faturacao-v4-toggle-chart-years');
  const expandBtn = document.getElementById('faturacao-v4-expand-table');

  tableBtn?.addEventListener('click', () => {
    state.tableVisible = !state.tableVisible;
    updateTableVisibility();
    if (state.tableVisible) renderTable();
  }, { signal });

  yearsBtn?.addEventListener('click', () => {
    state.showAllYears = !state.showAllYears;
    updateTableVisibility();
    renderTable();
  }, { signal });

  chartYearsBtn?.addEventListener('click', () => {
    state.showAllChartYears = !state.showAllChartYears;
    updateTableVisibility();
    renderChart();
  }, { signal });

  expandBtn?.addEventListener('click', () => {
    state.tableExpanded = !state.tableExpanded;
    document.getElementById('faturacao-v4-table-wrap')?.classList.toggle('is-expanded', state.tableExpanded);
    document.body.classList.toggle('analisev4-table-open', state.tableExpanded);
    expandBtn.classList.toggle('table-expand-btn-active', state.tableExpanded);
    expandBtn.textContent = state.tableExpanded ? 'Fechar largura total' : 'Ver em largura total';
    expandBtn.setAttribute('aria-expanded', state.tableExpanded ? 'true' : 'false');
  }, { signal });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.tableExpanded) expandBtn?.click();
  }, { signal });
}

function bindProgressButtons() {
  if (progressButtonsController) progressButtonsController.abort();
  progressButtonsController = new AbortController();
  const { signal } = progressButtonsController;

  document.querySelectorAll('[data-progresso-v4-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.progressoV4View;
      if (!view || view === state.progressView) return;
      state.progressView = view;
      updateProgressButtons();
      renderProgressDashboard();
    }, { signal });
  });
  updateProgressButtons();
}

function updateModeButtons() {
  document.querySelectorAll('[data-faturacao-v4-mode]').forEach((btn) => {
    const active = btn.dataset.faturacaoV4Mode === state.mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateMetricButtons() {
  document.querySelectorAll('[data-faturacao-v4-metric]').forEach((btn) => {
    const active = btn.dataset.faturacaoV4Metric === state.metric;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateViewButtons() {
  document.querySelectorAll('[data-faturacao-v4-view]').forEach((btn) => {
    const active = btn.dataset.faturacaoV4View === state.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateProgressButtons() {
  document.querySelectorAll('[data-progresso-v4-view]').forEach((btn) => {
    const active = btn.dataset.progressoV4View === state.progressView;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateTableVisibility() {
  const wrap = document.getElementById('faturacao-v4-table-wrap');
  const tableBtn = document.getElementById('faturacao-v4-toggle-table');
  const yearsBtn = document.getElementById('faturacao-v4-toggle-years');
  const chartYearsBtn = document.getElementById('faturacao-v4-toggle-chart-years');
  const expandBtn = document.getElementById('faturacao-v4-expand-table');
  const tableActions = document.querySelector('.faturacao-v4-table-actions');
  const modeSwitch = document.getElementById('faturacao-v4-mode-switch');
  const cumulativeButton = document.querySelector('[data-faturacao-v4-mode="cumulativo"]');
  const isTablelessMetric = state.metric === 'revpan' || state.metric === 'avg-night';
  if ((!state.tableVisible || isTablelessMetric) && state.tableExpanded) {
    state.tableExpanded = false;
    wrap?.classList.remove('is-expanded');
    expandBtn?.classList.remove('table-expand-btn-active');
    if (expandBtn) {
      expandBtn.textContent = 'Ver em largura total';
      expandBtn.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('analisev4-table-open');
  }
  if (wrap) wrap.hidden = !state.tableVisible || isTablelessMetric;
  if (tableActions) tableActions.hidden = isTablelessMetric;
  if (modeSwitch) modeSwitch.hidden = false;
  if (cumulativeButton) {
    cumulativeButton.hidden = state.metric === 'avg-night';
    cumulativeButton.textContent = state.metric === 'revpan' ? 'YTD' : 'Cumulativo';
  }
  if (tableBtn) {
    tableBtn.textContent = state.tableVisible ? 'Ocultar tabela' : 'Mostrar tabela';
    tableBtn.setAttribute('aria-expanded', state.tableVisible ? 'true' : 'false');
  }
  if (yearsBtn) {
    yearsBtn.hidden = !state.tableVisible || getAvailableYears().length <= getDefaultTableYears().length;
    yearsBtn.textContent = state.showAllYears ? 'Mostrar só atual e anterior' : 'Mostrar anos desde 2024';
  }
  if (chartYearsBtn) {
    const metricYears = getDataYearsForMetric();
    const canExpandYears = metricYears.length > getDefaultChartYears(metricYears).length && state.view !== 'compare';
    chartYearsBtn.hidden = !canExpandYears;
    chartYearsBtn.textContent = state.showAllChartYears ? 'Ver 2024, atual e anterior' : 'Ver todos os anos';
    chartYearsBtn.setAttribute('aria-pressed', state.showAllChartYears ? 'true' : 'false');
  }
  if (expandBtn) {
    expandBtn.hidden = !state.tableVisible || isTablelessMetric;
  }
}

function render() {
  if (!state.dailyEntries.length) {
    showEmptyState('Sem dados disponíveis.');
    renderProgressEmpty();
    return;
  }
  renderProgressDashboard();
  renderChart();
  if (state.tableVisible && state.metric !== 'revpan' && state.metric !== 'avg-night') renderTable();
  updateTableVisibility();
}

function renderProgressDashboard() {
  const currentYear = getCurrentDataYear();
  const previousYear = currentYear - 1;
  const previousYearEl = document.getElementById('progresso-v4-previous-year');
  if (previousYearEl) previousYearEl.textContent = previousYear;

  const apartments = VIEW_CONFIG[state.progressView]?.apartments || VIEW_CONFIG.total.apartments;
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const currentMonth = summarizeEntries({ apartments, year: currentYear, month, maxDay: day });
  const previousMonth = summarizeEntries({ apartments, year: previousYear, month, maxDay: day });
  const currentYtd = summarizeEntries({ apartments, year: currentYear, maxMonth: month, currentMonthDay: day });
  const previousYtd = summarizeEntries({ apartments, year: previousYear, maxMonth: month, currentMonthDay: day });
  const previousFullYear = summarizeEntries({ apartments, year: previousYear });

  setProgressTile('month', {
    value: formatEuro(currentMonth.revenue),
    meta: `${MONTH_LABELS[month - 1]} ${currentYear}: ${formatEuro(previousMonth.revenue)} em ${previousYear}`,
    diff: currentMonth.revenue - previousMonth.revenue,
    base: previousMonth.revenue
  });
  setProgressTile('ytd', {
    value: formatEuro(currentYtd.revenue),
    meta: `Jan-${MONTH_LABELS[month - 1]} ${currentYear}: ${formatEuro(previousYtd.revenue)} em ${previousYear}`,
    diff: currentYtd.revenue - previousYtd.revenue,
    base: previousYtd.revenue
  });
  setProgressTile('target', {
    value: formatTargetGap(currentYtd.revenue, previousFullYear.revenue),
    meta: `Total ${previousYear}: ${formatEuro(previousFullYear.revenue)}`,
    diff: currentYtd.revenue - previousFullYear.revenue,
    base: previousFullYear.revenue,
    neutral: true
  });
  updateTargetProgress(currentYtd.revenue, previousFullYear.revenue);
  setProgressTile('avg', {
    value: formatEuro(avgNight(currentYtd)),
    meta: `${previousYear}: ${formatEuro(avgNight(previousYtd))}`,
    diff: avgNight(currentYtd) - avgNight(previousYtd),
    base: avgNight(previousYtd)
  });
  setProgressTile('nights', {
    value: formatNumber(currentYtd.nights),
    meta: `${previousYear}: ${formatNumber(previousYtd.nights)} noites`,
    diff: currentYtd.nights - previousYtd.nights,
    base: previousYtd.nights,
    unit: 'noites'
  });
}

function renderProgressEmpty() {
  ['month', 'ytd', 'target', 'avg', 'nights'].forEach((key) => {
    setText(`progresso-v4-${key}-value`, '—');
    setText(`progresso-v4-${key}-meta`, 'Sem dados');
    setText(`progresso-v4-${key}-delta`, '—');
  });
  updateTargetProgress(0, 0);
}

function formatTargetGap(currentRevenue, previousFullYearRevenue) {
  const diff = currentRevenue - previousFullYearRevenue;
  if (diff >= 0) return `${formatEuro(diff)} acima`;
  return `Faltam ${formatEuro(Math.abs(diff))}`;
}

function setProgressTile(key, { value, meta, diff, base, unit = '€', neutral = false }) {
  setText(`progresso-v4-${key}-value`, value);
  setText(`progresso-v4-${key}-meta`, meta);
  const delta = document.getElementById(`progresso-v4-${key}-delta`);
  if (!delta) return;
  delta.classList.remove('is-positive', 'is-negative', 'is-neutral');
  if (neutral) {
    const progress = base > 0 ? Math.max(0, ((Number(diff) || 0) + base) / base) : 0;
    delta.classList.add('is-neutral');
    delta.textContent = progress ? `${Math.round(progress * 100)}% do total anterior` : formatProgressDelta(diff, base, unit);
    return;
  }
  delta.classList.add(diff >= 0 ? 'is-positive' : 'is-negative');
  delta.textContent = formatProgressDelta(diff, base, unit);
}

function updateTargetProgress(currentRevenue, previousRevenue) {
  const progress = previousRevenue > 0 ? (currentRevenue / previousRevenue) * 100 : 0;
  const bounded = Math.max(0, Math.min(100, progress));
  const track = document.getElementById('progresso-v4-target-progress');
  const bar = document.getElementById('progresso-v4-target-bar');
  const delta = document.getElementById('progresso-v4-target-delta');
  if (bar) bar.style.width = `${bounded}%`;
  if (track) track.setAttribute('aria-valuenow', String(Math.round(bounded)));
  if (delta) {
    delta.classList.remove('is-positive', 'is-negative');
    delta.classList.add('is-neutral');
    delta.textContent = previousRevenue > 0
      ? `${Math.round(progress)}% do total anterior`
      : 'Sem base de comparação';
  }
}

function summarizeEntries({ apartments, year, month = null, maxMonth = null, maxDay = null, currentMonthDay = null }) {
  const allow = new Set(apartments.map(String));
  return state.dailyEntries.reduce((summary, entry) => {
    if (!allow.has(entry.apartamento) || entry.year !== year) return summary;
    if (month && entry.month !== month) return summary;
    if (maxMonth && entry.month > maxMonth) return summary;
    if (maxDay && entry.day > maxDay) return summary;
    if (maxMonth && currentMonthDay && entry.month === maxMonth && entry.day > currentMonthDay) return summary;
    summary.revenue += entry.amount;
    summary.nights += 1;
    return summary;
  }, { revenue: 0, nights: 0 });
}

function avgNight(summary) {
  return summary.nights ? summary.revenue / summary.nights : 0;
}

function formatProgressDelta(diff, base, unit) {
  const rounded = Math.round(Number(diff) || 0);
  const sign = rounded >= 0 ? '+' : '-';
  const value = unit === 'noites' ? `${formatNumber(Math.abs(rounded))} noites` : formatEuro(Math.abs(rounded));
  const pct = base ? ` (${sign}${Math.abs((diff / base) * 100).toFixed(1)}%)` : '';
  return `${sign} ${value}${pct}`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('pt-PT');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showEmptyState(message) {
  resetChart();
  const table = document.getElementById('tabela-faturacao-v4');
  if (table) table.innerHTML = `<p class="faturacao-v4-empty">${escapeHtml(message)}</p>`;
}

function renderChart() {
  if (state.view === 'compare') {
    renderCompareChart();
    return;
  }
  renderYearChart();
}

function renderYearChart() {
  const cfg = VIEW_CONFIG[state.view] || VIEW_CONFIG.total;
  const labels = MONTH_LABELS;
  let yearly;
  if (state.metric === 'occupancy') {
    yearly = aggregateOccupancyByYear(cfg.apartments);
  } else if (state.metric === 'revpan') {
    yearly = aggregateRevpanByYear(cfg.apartments);
  } else if (state.metric === 'avg-night') {
    yearly = aggregateAverageNightByYear(cfg.apartments);
  } else if (state.metric === 'cleaning') {
    yearly = aggregateCleaningByYear(cfg.apartments);
  } else {
    yearly = aggregateMonthlyForChart(cfg.apartments);
  }
  const allYears = getChartYears(yearly, { all: true });
  const years = state.showAllChartYears ? allYears : getDefaultChartYears(allYears);
  const currentYear = getCurrentDataYear();

  const datasets = years.map((year) => {
    const values = yearly[year] || emptySeriesForMode();
    const color = resolveYearColor(year, cfg, years);
    const data = prepareChartData(values, year);
    return {
      label: String(year),
      data,
      borderColor: color,
      backgroundColor: withAlpha(color, year === currentYear ? 0.14 : 0.06),
      borderDash: year === currentYear ? [] : [6, 4],
      borderWidth: year === currentYear ? 2.5 : 1.6,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: color,
      pointBorderWidth: 2,
      tension: 0.18,
      spanGaps: true
    };
  });

  appendHistoricalAverage(
    datasets,
    'Média histórica',
    allYears.map((year) => prepareChartData(yearly[year] || emptySeriesForMode(), year))
  );
  createOrUpdateChart(labels, datasets);
}

function resolveYearColor(year, cfg, years) {
  const idx = years.indexOf(year);
  if (state.view === '123' || state.view === '1248') {
    const palette = APARTMENT_YEAR_COLORS[state.view];
    return palette[idx % palette.length];
  }
  if (state.view !== 'total') return cfg.color;
  return TOTAL_YEAR_COLORS[idx % TOTAL_YEAR_COLORS.length];
}

function renderCompareChart() {
  if (state.metric === 'occupancy') {
    renderOccupancyDifferenceChart();
    return;
  }
  if (state.metric === 'revpan') {
    renderNightlyMetricComparisonChart(aggregateRevpanByYear);
    return;
  }
  if (state.metric === 'avg-night') {
    renderNightlyMetricComparisonChart(aggregateAverageNightByYear);
    return;
  }

  const monthly123 = state.metric === 'cleaning'
    ? aggregateCleaningByYear(['123'])
    : aggregateMonthlyForChart(['123']);
  const monthly1248 = state.metric === 'cleaning'
    ? aggregateCleaningByYear(['1248'])
    : aggregateMonthlyForChart(['1248']);
  const timeline = buildCompareTimeline([monthly123, monthly1248]);
  const labels = timeline.map(({ year, month }) => `${MONTH_LABELS[month - 1]} ${String(year).slice(-2)}`);
  const series123 = timeline.map(({ year, month }) => monthly123[year]?.[month - 1] || 0);
  const series1248 = timeline.map(({ year, month }) => monthly1248[year]?.[month - 1] || 0);
  const data123 = state.mode === 'cumulativo' ? cumulativeTimeline(series123, timeline) : series123;
  const data1248 = state.mode === 'cumulativo' ? cumulativeTimeline(series1248, timeline) : series1248;
  const historicalMonthlyAverage = buildHistoricalMonthlyAverage([monthly123, monthly1248], timeline);
  const historicalAverage = state.mode === 'cumulativo'
    ? cumulativeTimeline(historicalMonthlyAverage, timeline)
    : historicalMonthlyAverage;

  const datasets = [
    {
      label: '123',
      data: data123,
      borderColor: COLORS['123'],
      backgroundColor: withAlpha(COLORS['123'], 0.1),
      borderWidth: 2.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: COLORS['123'],
      pointBorderWidth: 2,
      tension: 0.18
    },
    {
      label: '1248',
      data: data1248,
      borderColor: COLORS['1248'],
      backgroundColor: withAlpha(COLORS['1248'], 0.1),
      borderWidth: 2.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: COLORS['1248'],
      pointBorderWidth: 2,
      tension: 0.18
    },
    historicalAverageDataset(historicalAverage, 'Média histórica / apt.')
  ];

  createOrUpdateChart(labels, datasets);
}

function renderNightlyMetricComparisonChart(aggregateMetric) {
  const values123 = aggregateMetric(['123']);
  const values1248 = aggregateMetric(['1248']);
  const years = [...new Set([
    ...getChartYears(values123),
    ...getChartYears(values1248)
  ])].sort((a, b) => a - b);
  const latestYear = years[years.length - 1];
  if (!latestYear) {
    createOrUpdateChart(MONTH_LABELS, []);
    return;
  }

  const datasets = [
    {
      label: `123 · ${latestYear}`,
      data: monthlyToDate(values123[latestYear], latestYear),
      borderColor: COLORS['123'],
      backgroundColor: withAlpha(COLORS['123'], 0.1),
      borderWidth: 2.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: COLORS['123'],
      pointBorderWidth: 2,
      tension: 0.18,
      spanGaps: true
    },
    {
      label: `1248 · ${latestYear}`,
      data: monthlyToDate(values1248[latestYear], latestYear),
      borderColor: COLORS['1248'],
      backgroundColor: withAlpha(COLORS['1248'], 0.1),
      borderWidth: 2.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#fff',
      pointBorderColor: COLORS['1248'],
      pointBorderWidth: 2,
      tension: 0.18,
      spanGaps: true
    }
  ];

  createOrUpdateChart(MONTH_LABELS, datasets);
}

function renderOccupancyDifferenceChart() {
  const occ123 = aggregateOccupancyByYear(['123']);
  const occ1248 = aggregateOccupancyByYear(['1248']);
  const years = getOccupancyCompareYears(occ123, occ1248);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const datasets = years.map((year, idx) => {
    const pointColors = [];
    const winners = [];
    const data = MONTH_LABELS.map((label, monthIdx) => {
      if (year === currentYear && monthIdx + 1 > currentMonth) {
        pointColors.push('rgba(148,163,184,1)');
        winners.push('');
        return null;
      }
      const value123 = occ123[year]?.[monthIdx] || 0;
      const value1248 = occ1248[year]?.[monthIdx] || 0;
      const winner = value1248 > value123 ? '1248' : '123';
      winners.push(value123 === value1248 ? 'igual' : winner);
      pointColors.push(winner === '1248' ? COLORS['1248'] : COLORS['123']);
      return Math.abs(value123 - value1248);
    });

    return {
      label: String(year),
      data,
      winners,
      borderColor: TOTAL_YEAR_COLORS[idx % TOTAL_YEAR_COLORS.length],
      backgroundColor: withAlpha(TOTAL_YEAR_COLORS[idx % TOTAL_YEAR_COLORS.length], 0.08),
      borderDash: year === currentYear ? [] : [6, 4],
      borderWidth: year === currentYear ? 2.5 : 1.6,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: pointColors,
      pointBorderColor: pointColors,
      pointBorderWidth: 2,
      tension: 0.18,
      spanGaps: true
    };
  });

  appendHistoricalAverage(datasets, 'Média histórica Δ');
  createOrUpdateChart(MONTH_LABELS, datasets);
}

function appendHistoricalAverage(datasets, label = 'Média histórica', sourceSeries = null) {
  const series = sourceSeries || datasets
    .filter((dataset) => !dataset.isHistoricalAverage)
    .map((dataset) => dataset.data);
  if (series.length < 2) return;
  const data = averageSeries(series);
  if (!data.some((value) => value != null)) return;
  datasets.push(historicalAverageDataset(data, label));
}

function averageSeries(seriesList) {
  const length = Math.max(0, ...seriesList.map((series) => series?.length || 0));
  return Array.from({ length }, (_, index) => {
    const values = seriesList
      .map((series) => series?.[index])
      .filter((value) => value != null && Number.isFinite(Number(value)))
      .map(Number);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function historicalAverageDataset(data, label) {
  return {
    label,
    data,
    isHistoricalAverage: true,
    borderColor: HISTORICAL_AVERAGE_COLOR,
    backgroundColor: 'transparent',
    borderDash: [],
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 3,
    pointHitRadius: 8,
    pointStyle: 'line',
    tension: 0.18,
    spanGaps: true
  };
}

function buildHistoricalMonthlyAverage(monthlyMaps, timeline) {
  const years = getAvailableYears();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const averagesByMonth = Array.from({ length: 12 }, (_, monthIdx) => {
    const values = monthlyMaps.flatMap((monthly) => years
      .filter((year) => year !== currentYear || monthIdx + 1 <= currentMonth)
      .map((year) => monthly[year]?.[monthIdx])
      .filter((value) => value != null && Number.isFinite(Number(value)))
      .map(Number));
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  });
  return timeline.map(({ month }) => averagesByMonth[month - 1]);
}

function getOccupancyCompareYears(occ123, occ1248) {
  return getAvailableYears()
    .filter((year) => year >= OCCUPANCY_BASE_YEAR)
    .filter((year) =>
      (occ123[year] || []).some((value) => value > 0)
      || (occ1248[year] || []).some((value) => value > 0)
    );
}

function buildCompareTimeline(monthlyMaps) {
  const end = determineCompareTimelineEnd(monthlyMaps);
  const startYear = state.metric === 'occupancy' ? OCCUPANCY_BASE_YEAR : BASE_YEAR;
  const timeline = [];
  for (let year = startYear; year <= end.year; year++) {
    const lastMonth = year === end.year ? end.month : 12;
    for (let month = 1; month <= lastMonth; month++) {
      timeline.push({ year, month });
    }
  }
  return timeline;
}

function determineCompareTimelineEnd(monthlyMaps) {
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const startYear = state.metric === 'occupancy' ? OCCUPANCY_BASE_YEAR : BASE_YEAR;
  const dataEnd = monthlyMaps.reduce((end, monthly) => {
    Object.entries(monthly || {}).forEach(([year, months]) => {
      months.forEach((value, idx) => {
        const y = Number(year);
        const m = idx + 1;
        if (Number(value) > 0 && (y > end.year || (y === end.year && m > end.month))) {
          end = { year: y, month: m };
        }
      });
    });
    return end;
  }, { year: startYear, month: 1 });

  if (today.year > dataEnd.year || (today.year === dataEnd.year && today.month > dataEnd.month)) {
    return today;
  }
  return dataEnd;
}

function cumulativeTimeline(values, timeline = []) {
  let running = 0;
  let activeYear = null;
  return values.map((value, index) => {
    const year = timeline[index]?.year;
    if (year != null && year !== activeYear) {
      running = 0;
      activeYear = year;
    }
    running += Number(value) || 0;
    return running;
  });
}

function createOrUpdateChart(labels, datasets) {
  resetChart();
  const canvas = document.getElementById('chart-faturacao-v4');
  if (!canvas) return;

  const maxValue = Math.max(0, ...datasets.flatMap((dataset) => dataset.data.map((value) => Number(value) || 0)));
  const isOccupancyDiff = state.metric === 'occupancy' && state.view === 'compare';
  const yMax = isOccupancyDiff
    ? Math.max(5, Math.ceil((maxValue * 1.2) / 5) * 5)
    : state.metric === 'occupancy'
      ? Math.min(100, Math.max(10, Math.ceil(((maxValue * 1.12) || 10) / 10) * 10))
      : (maxValue > 0 ? Math.ceil(maxValue * 1.1) : undefined);
  const yMin = 0;

  state.chart = createChart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y || 0;
              if (isOccupancyDiff) {
                const winner = context.dataset.winners?.[context.dataIndex];
                const suffix = winner && winner !== 'igual' ? ` mais ${winner}` : '';
                return `${context.dataset.label}: ${value.toFixed(1)}%${suffix}`;
              }
              return `${context.dataset.label}: ${formatChartValue(value)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          min: yMin,
          max: yMax,
          ticks: {
            precision: 0,
            callback(value) {
              return formatChartValue(value, true);
            }
          },
          grid: { color: 'rgba(15, 23, 42, 0.06)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12
          }
        }
      }
    }
  }, { previousChart: state.chart });
}

function formatChartValue(value, rounded = false) {
  if (state.metric === 'occupancy') {
    return `${rounded ? Math.round(value) : Number(value).toFixed(1)}%`;
  }
  const formatted = formatEuro(value);
  const isNightlyMetric = state.metric === 'revpan' || state.metric === 'avg-night';
  return isNightlyMetric && !rounded ? `${formatted} / noite` : formatted;
}

function renderTable() {
  const container = document.getElementById('tabela-faturacao-v4');
  if (!container) return;
  const years = getTableYears();
  if (!years.length) {
    container.innerHTML = '<p class="faturacao-v4-empty">Sem dados para apresentar.</p>';
    return;
  }

  if (state.metric === 'cleaning') {
    container.innerHTML = state.view === 'compare'
      ? buildCleaningCompareTable(years)
      : buildCleaningTable(years, VIEW_CONFIG[state.view]?.apartments || VIEW_CONFIG.total.apartments);
    return;
  }

  if (state.metric === 'occupancy') {
    container.innerHTML = state.view === 'compare'
      ? buildOccupancyCompareTable(years)
      : buildOccupancyYearTable(years, VIEW_CONFIG[state.view]?.apartments || VIEW_CONFIG.total.apartments);
    return;
  }

  container.innerHTML = state.view === 'compare'
    ? buildCompareTable(years)
    : buildYearTable(years, VIEW_CONFIG[state.view]?.apartments || VIEW_CONFIG.total.apartments);
}

function buildOccupancyYearTable(years, apartments) {
  const occupancy = aggregateOccupancyByYear(apartments);
  const currentYear = getCurrentDataYear();
  const previousYear = currentYear - 1;
  const currentMonth = new Date().getMonth() + 1;
  const visibleYears = years.filter((year) => year >= OCCUPANCY_BASE_YEAR);
  const showYearDiff = visibleYears.includes(currentYear) && visibleYears.includes(previousYear);
  const diffHeading = showYearDiff ? `<th>Δ ${currentYear} vs ${previousYear}</th>` : '';
  const heading = visibleYears.map((year) => `<th>${year}</th>`).join('') + diffHeading;
  const rows = MONTH_LABELS.map((label, monthIdx) => {
    const monthValues = visibleYears.map((year) => occupancy[year]?.[monthIdx] || 0);
    const bestValue = Math.max(0, ...monthValues);
    const cells = visibleYears.map((year) => {
      const empty = monthIdx + 1 > currentMonth;
      const value = occupancy[year]?.[monthIdx] || 0;
      return `<td class="${bestValueClass(value, bestValue, empty)}">${empty ? '—' : formatPercent(value)}</td>`;
    }).join('');
    const diff = showYearDiff
      ? occupancyDiffCell((occupancy[currentYear]?.[monthIdx] || 0) - (occupancy[previousYear]?.[monthIdx] || 0), monthIdx + 1 > currentMonth)
      : '';
    return `<tr><td>${label}</td>${cells}${diff}</tr>`;
  }).join('');
  const totalValues = visibleYears.map((year) => occupancyYtdForYear(apartments, year));
  const bestTotal = Math.max(0, ...totalValues);
  const totals = visibleYears.map((year, index) => {
    const value = totalValues[index];
    return `<td class="${bestValueClass(value, bestTotal)}"><strong>${formatPercent(value)}</strong></td>`;
  }).join('');
  const totalDiff = showYearDiff
    ? occupancyDiffCell(occupancyYtdForYear(apartments, currentYear) - occupancyYtdForYear(apartments, previousYear), false, true)
    : '';

  return `
    <table class="media-faturacao faturacao-v4-table">
      <thead><tr><th>Mês</th>${heading}</tr></thead>
      <tbody>${rows}<tr class="faturacao-v4-total-row"><td><strong>YTD</strong></td>${totals}${totalDiff}</tr></tbody>
    </table>
  `;
}

function occupancyDiffCell(diff, empty = false, strong = false) {
  if (empty) return '<td class="faturacao-v4-diff-empty">—</td>';
  const content = formatSignedPercent(diff);
  return `<td>${strong ? `<strong>${content}</strong>` : content}</td>`;
}

function buildOccupancyCompareTable(years) {
  const occ123 = aggregateOccupancyByYear(['123']);
  const occ1248 = aggregateOccupancyByYear(['1248']);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const visibleYears = years.filter((year) => year >= OCCUPANCY_BASE_YEAR);
  const heading = visibleYears.map((year) => `<th colspan="3">${year}</th>`).join('');
  const subHeading = visibleYears.map(() => '<th>123</th><th>1248</th><th>Δ</th>').join('');
  const rows = MONTH_LABELS.map((label, monthIdx) => {
    const cells = visibleYears.map((year) => {
      const empty = monthIdx + 1 > currentMonth;
      return occupancyCompareCells(occ123[year]?.[monthIdx] || 0, occ1248[year]?.[monthIdx] || 0, false, empty);
    }).join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }).join('');
  const totals = visibleYears.map((year) => {
    const value123 = occupancyYtdForYear(['123'], year);
    const value1248 = occupancyYtdForYear(['1248'], year);
    return occupancyCompareCells(value123, value1248, true);
  }).join('');

  return `
    <table class="media-faturacao faturacao-v4-table faturacao-v4-compare-table">
      <thead>
        <tr><th rowspan="2">Mês</th>${heading}</tr>
        <tr>${subHeading}</tr>
      </thead>
      <tbody>${rows}<tr class="faturacao-v4-total-row"><td><strong>YTD</strong></td>${totals}</tr></tbody>
    </table>
  `;
}

function occupancyCompareCells(value123, value1248, strong = false, empty = false) {
  if (empty) {
    return '<td class="faturacao-v4-diff-empty">—</td><td class="faturacao-v4-diff-empty">—</td><td class="faturacao-v4-diff-empty">—</td>';
  }
  const diff = value123 - value1248;
  const open = strong ? '<strong>' : '';
  const close = strong ? '</strong>' : '';
  return `
    <td class="faturacao-v4-cell-123 ${diff > 0 ? 'faturacao-v4-best' : ''}">${open}${formatPercent(value123)}${close}</td>
    <td class="faturacao-v4-cell-1248 ${diff < 0 ? 'faturacao-v4-best' : ''}">${open}${formatPercent(value1248)}${close}</td>
    <td>${open}${formatSignedPercent(diff)}${close}</td>
  `;
}

function buildCleaningTable(years, apartments) {
  const stats = aggregateCleaningStats(apartments);
  const currentMonth = new Date().getMonth() + 1;
  const visibleYears = years.filter((year) =>
    (stats[year] || []).some((month) => month.count > 0)
  );
  if (!visibleYears.length) {
    return '<p class="faturacao-v4-empty">Sem taxas de limpeza para apresentar.</p>';
  }

  const heading = visibleYears.map((year) => `<th colspan="2">${year}</th>`).join('');
  const subHeading = visibleYears.map(() => '<th>N.º</th><th>Total</th>').join('');
  const rows = MONTH_LABELS.map((label, monthIdx) => {
    const monthStats = visibleYears.map((year) => stats[year][monthIdx]);
    const maxCount = Math.max(0, ...monthStats.map((month) => month.count));
    const maxTotal = Math.max(0, ...monthStats.map((month) => month.total));
    const cells = visibleYears.map((year) => {
      if (monthIdx + 1 > currentMonth) return '<td>—</td><td>—</td>';
      const month = stats[year][monthIdx];
      return `
        <td class="${bestValueClass(month.count, maxCount)}">${formatNumber(month.count)}</td>
        <td class="${bestValueClass(month.total, maxTotal)}">${formatEuro(month.total)}</td>
      `;
    }).join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }).join('');
  const yearTotals = visibleYears.map((year) =>
    stats[year].slice(0, currentMonth).reduce((summary, month) => ({
      count: summary.count + month.count,
      value: summary.value + month.total
    }), { count: 0, value: 0 })
  );
  const maxTotalCount = Math.max(0, ...yearTotals.map((total) => total.count));
  const maxTotalValue = Math.max(0, ...yearTotals.map((total) => total.value));
  const totals = yearTotals.map((total) => {
    return `
      <td class="${bestValueClass(total.count, maxTotalCount)}"><strong>${formatNumber(total.count)}</strong></td>
      <td class="${bestValueClass(total.value, maxTotalValue)}"><strong>${formatEuro(total.value)}</strong></td>
    `;
  }).join('');

  return `
    <table class="media-faturacao faturacao-v4-table">
      <thead>
        <tr><th rowspan="2">Mês</th>${heading}</tr>
        <tr>${subHeading}</tr>
      </thead>
      <tbody>${rows}<tr class="faturacao-v4-total-row"><td><strong>YTD</strong></td>${totals}</tr></tbody>
    </table>
  `;
}

function buildCleaningCompareTable(years) {
  const stats123 = aggregateCleaningStats(['123']);
  const stats1248 = aggregateCleaningStats(['1248']);
  const currentMonth = new Date().getMonth() + 1;
  const visibleYears = years.filter((year) =>
    (stats123[year] || []).some((month) => month.count > 0)
    || (stats1248[year] || []).some((month) => month.count > 0)
  );
  if (!visibleYears.length) {
    return '<p class="faturacao-v4-empty">Sem taxas de limpeza para apresentar.</p>';
  }

  const heading = visibleYears.map((year) => `<th colspan="4">${year}</th>`).join('');
  const subHeading = visibleYears
    .map(() => '<th>123 · N.º</th><th>123 · Total</th><th>1248 · N.º</th><th>1248 · Total</th>')
    .join('');
  const rows = MONTH_LABELS.map((label, monthIdx) => {
    const cells = visibleYears.map((year) => {
      if (monthIdx + 1 > currentMonth) {
        return '<td>—</td><td>—</td><td>—</td><td>—</td>';
      }
      const apt123 = stats123[year][monthIdx];
      const apt1248 = stats1248[year][monthIdx];
      const countDiff = apt123.count - apt1248.count;
      const totalDiff = apt123.total - apt1248.total;
      return `
        <td class="faturacao-v4-cell-123 ${countDiff > 0 ? 'faturacao-v4-best' : ''}">${formatNumber(apt123.count)}</td>
        <td class="faturacao-v4-cell-123 ${totalDiff > 0 ? 'faturacao-v4-best' : ''}">${formatEuro(apt123.total)}</td>
        <td class="faturacao-v4-cell-1248 ${countDiff < 0 ? 'faturacao-v4-best' : ''}">${formatNumber(apt1248.count)}</td>
        <td class="faturacao-v4-cell-1248 ${totalDiff < 0 ? 'faturacao-v4-best' : ''}">${formatEuro(apt1248.total)}</td>
      `;
    }).join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }).join('');
  const totals = visibleYears.map((year) => {
    const apt123 = cleaningYearTotal(stats123[year].slice(0, currentMonth));
    const apt1248 = cleaningYearTotal(stats1248[year].slice(0, currentMonth));
    const countDiff = apt123.count - apt1248.count;
    const totalDiff = apt123.total - apt1248.total;
    return `
      <td class="faturacao-v4-cell-123 ${countDiff > 0 ? 'faturacao-v4-best' : ''}"><strong>${formatNumber(apt123.count)}</strong></td>
      <td class="faturacao-v4-cell-123 ${totalDiff > 0 ? 'faturacao-v4-best' : ''}"><strong>${formatEuro(apt123.total)}</strong></td>
      <td class="faturacao-v4-cell-1248 ${countDiff < 0 ? 'faturacao-v4-best' : ''}"><strong>${formatNumber(apt1248.count)}</strong></td>
      <td class="faturacao-v4-cell-1248 ${totalDiff < 0 ? 'faturacao-v4-best' : ''}"><strong>${formatEuro(apt1248.total)}</strong></td>
    `;
  }).join('');

  return `
    <table class="media-faturacao faturacao-v4-table faturacao-v4-compare-table">
      <thead>
        <tr><th rowspan="2">Mês</th>${heading}</tr>
        <tr>${subHeading}</tr>
      </thead>
      <tbody>${rows}<tr class="faturacao-v4-total-row"><td><strong>YTD</strong></td>${totals}</tr></tbody>
    </table>
  `;
}

function cleaningYearTotal(months = []) {
  return months.reduce((summary, month) => ({
    count: summary.count + month.count,
    total: summary.total + month.total
  }), { count: 0, total: 0 });
}

function buildYearTable(years, apartments) {
  const monthly = aggregateMonthlyForChart(apartments);
  const currentYear = getCurrentDataYear();
  const previousYear = currentYear - 1;
  const currentMonth = new Date().getMonth() + 1;
  const showYearDiff = years.includes(currentYear) && years.includes(previousYear);
  const diffHeading = showYearDiff ? `<th>Δ ${currentYear} vs ${previousYear}</th>` : '';
  const heading = years.map((year) => `<th>${year}</th>`).join('') + diffHeading;
  const rows = MONTH_LABELS.map((label, monthIdx) => {
    const empty = monthIdx + 1 > currentMonth;
    const monthValues = years.map((year) => monthly[year]?.[monthIdx] || 0);
    const bestValue = Math.max(0, ...monthValues);
    const cells = years.map((year) => {
      const value = monthly[year]?.[monthIdx] || 0;
      return `<td class="${bestValueClass(value, bestValue, empty)}">${empty ? '—' : formatEuro(value)}</td>`;
    }).join('');
    const diff = showYearDiff
      ? yearDiffCell((monthly[currentYear]?.[monthIdx] || 0) - (monthly[previousYear]?.[monthIdx] || 0), false, monthIdx + 1 > currentMonth)
      : '';
    return `<tr><td>${label}</td>${cells}${diff}</tr>`;
  }).join('');
  const totalValues = years.map((year) => sumUntilMonth(monthly[year], currentMonth));
  const bestTotal = Math.max(0, ...totalValues);
  const totals = years.map((year, index) => {
    const total = totalValues[index];
    return `<td class="${bestValueClass(total, bestTotal)}"><strong>${formatEuro(total)}</strong></td>`;
  }).join('');
  const currentYtd = sumUntilMonth(monthly[currentYear], currentMonth);
  const previousYtd = sumUntilMonth(monthly[previousYear], currentMonth);
  const totalDiff = showYearDiff ? yearDiffCell(currentYtd - previousYtd, true) : '';

  return `
    <table class="media-faturacao faturacao-v4-table">
      <thead><tr><th>Mês</th>${heading}</tr></thead>
      <tbody>${rows}<tr class="faturacao-v4-total-row"><td><strong>YTD</strong></td>${totals}${totalDiff}</tr></tbody>
    </table>
  `;
}

function sumUntilMonth(values, month) {
  return (values || []).slice(0, month).reduce((sum, value) => sum + value, 0);
}

function bestValueClass(value, best, empty = false) {
  return !empty && Number(best) > 0 && Number(value) === Number(best)
    ? 'faturacao-v4-best'
    : '';
}

function yearDiffCell(diff, strong = false, empty = false) {
  if (empty) return '<td class="faturacao-v4-diff-empty">—</td>';
  const value = Math.round(Number(diff) || 0);
  const cls = value > 0
    ? 'faturacao-v4-diff-positive'
    : value < 0
      ? 'faturacao-v4-diff-negative'
      : 'faturacao-v4-diff-neutral';
  const label = value === 0 ? formatEuro(0) : `${value > 0 ? '+ ' : '- '}${formatEuro(Math.abs(value))}`;
  const content = `<span class="${cls}">${label}</span>`;
  return `<td>${strong ? `<strong>${content}</strong>` : content}</td>`;
}

function buildCompareTable(years) {
  const monthly123 = aggregateMonthlyForChart(['123']);
  const monthly1248 = aggregateMonthlyForChart(['1248']);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const heading = years.map((year) => `<th colspan="3">${year}</th>`).join('');
  const subHeading = years.map(() => '<th>123</th><th>1248</th><th>Δ</th>').join('');
  const rows = MONTH_LABELS.map((label, monthIdx) => {
    const cells = years.map((year) => {
      const value123 = monthly123[year]?.[monthIdx] || 0;
      const value1248 = monthly1248[year]?.[monthIdx] || 0;
      const isFuture = monthIdx + 1 > currentMonth;
      return compareCells(value123, value1248, false, isFuture);
    }).join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }).join('');
  const totals = years.map((year) => {
    const total123 = sumUntilMonth(monthly123[year], currentMonth);
    const total1248 = sumUntilMonth(monthly1248[year], currentMonth);
    return compareCells(total123, total1248, true);
  }).join('');

  return `
    <table class="media-faturacao faturacao-v4-table faturacao-v4-compare-table">
      <thead>
        <tr><th rowspan="2">Mês</th>${heading}</tr>
        <tr>${subHeading}</tr>
      </thead>
      <tbody>${rows}<tr class="faturacao-v4-total-row"><td><strong>YTD</strong></td>${totals}</tr></tbody>
    </table>
  `;
}

function compareCells(value123, value1248, strong = false, empty = false) {
  if (empty) {
    return '<td class="faturacao-v4-diff-empty">—</td><td class="faturacao-v4-diff-empty">—</td><td class="faturacao-v4-diff-empty">—</td>';
  }
  const diff = value123 - value1248;
  const winnerClass = diff > 0 ? 'apt-123' : diff < 0 ? 'apt-1248' : 'faturacao-v4-diff-neutral';
  const open = strong ? '<strong>' : '';
  const close = strong ? '</strong>' : '';
  return `
    <td class="faturacao-v4-cell-123 ${diff > 0 ? 'faturacao-v4-best' : ''}">${open}${formatEuro(value123)}${close}</td>
    <td class="faturacao-v4-cell-1248 ${diff < 0 ? 'faturacao-v4-best' : ''}">${open}${formatEuro(value1248)}${close}</td>
    <td>${open}<span class="${winnerClass}">${formatEuro(Math.abs(diff))}</span>${close}</td>
  `;
}

function buildDailyEntries(faturas) {
  const entries = [];
  faturas.forEach((fatura) => {
    const apt = String(fatura.apartamento);
    if (!APARTMENTS.includes(apt)) return;

    const slices = splitFaturaPorDia(fatura);
    if (Array.isArray(slices) && slices.length) {
      slices.forEach((slice) => {
        const year = Number(slice.ano);
        const month = Number(slice.mes);
        const day = Number(slice.dia);
        if (year >= BASE_YEAR && isValidMonth(month) && isValidDay(year, month, day)) {
          entries.push({
            apartamento: apt,
            year,
            month,
            day,
            amount: Number(slice.valorDistribuido) || 0,
            precise: true
          });
        }
      });
      return;
    }

    entries.push(...fallbackMonthlyEntries(fatura, apt));
  });
  return entries;
}

function fallbackMonthlyEntries(fatura, apt) {
  const year = Number(fatura.ano);
  const month = Number(fatura.mes);
  if (year < BASE_YEAR || !isValidMonth(month)) return [];
  const days = daysInMonth(year, month);
  const amount = valorFatura(fatura) / days;
  return Array.from({ length: days }, (_, index) => ({
    apartamento: apt,
    year,
    month,
    day: index + 1,
    amount,
    precise: false
  }));
}

function aggregateMonthlyForChart(apartments) {
  const allow = new Set(apartments.map(String));
  const result = createYearSeries(12);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  state.dailyEntries.forEach((entry) => {
    if (!allow.has(entry.apartamento)) return;
    if (entry.year === currentYear) {
      if (entry.month > currentMonth) return;
    }
    if (entry.month === currentMonth && entry.day > currentDay) return;
    if (!result[entry.year]) result[entry.year] = Array(12).fill(0);
    result[entry.year][entry.month - 1] += entry.amount;
  });
  return result;
}

function aggregateRevpanByYear(apartments, mode = state.mode) {
  const revenue = aggregateMonthlyForChart(apartments);
  const result = createYearSeries(12);
  Object.keys(result).forEach((yearKey) => {
    const year = Number(yearKey);
    let runningRevenue = 0;
    let runningAvailable = 0;
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const available = availableNights(year, monthIdx + 1, apartments.length);
      const monthlyRevenue = revenue[year]?.[monthIdx] || 0;
      if (mode === 'cumulativo') {
        runningRevenue += monthlyRevenue;
        runningAvailable += available;
        result[year][monthIdx] = runningAvailable ? runningRevenue / runningAvailable : 0;
      } else {
        result[year][monthIdx] = available ? monthlyRevenue / available : 0;
      }
    }
  });
  return result;
}

function aggregateCleaningByYear(apartments) {
  const allow = new Set(apartments.map(String));
  const result = createYearSeries(12);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  state.faturas.forEach((row) => {
    if (!allow.has(String(row.apartamento))) return;
    if (!isDetailedReservation(row)) return;
    const { year, month, day } = getStayPeriod(row);
    const value = Number(row.taxaLimpeza || 0);
    if (!result[year] || !isValidMonth(month) || value <= 0) return;
    if (year === currentYear && month > currentMonth) return;
    if (month === currentMonth && day != null && day > currentDay) return;
    result[year][month - 1] += value;
  });
  return result;
}

function aggregateCleaningStats(apartments) {
  const allow = new Set(apartments.map(String));
  const result = {};
  getAvailableYears().forEach((year) => {
    result[year] = Array.from({ length: 12 }, () => ({ count: 0, total: 0 }));
  });
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  state.faturas.forEach((row) => {
    if (!allow.has(String(row.apartamento))) return;
    if (!isDetailedReservation(row)) return;
    const { year, month, day } = getStayPeriod(row);
    const value = Number(row.taxaLimpeza || 0);
    if (!result[year] || !isValidMonth(month) || value <= 0) return;
    if (year === currentYear && month > currentMonth) return;
    if (month === currentMonth && day != null && day > currentDay) return;
    result[year][month - 1].count += 1;
    result[year][month - 1].total += value;
  });
  return result;
}

function aggregateAverageNightByYear(apartments) {
  const revenue = aggregateMonthlyForChart(apartments);
  const occupied = aggregateOccupiedByYear(apartments);
  const result = createYearSeries(12);
  Object.keys(result).forEach((yearKey) => {
    const year = Number(yearKey);
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const nights = occupied[year]?.[monthIdx] || 0;
      result[year][monthIdx] = nights
        ? (revenue[year]?.[monthIdx] || 0) / nights
        : null;
    }
  });
  return result;
}

function aggregateOccupancyByYear(apartments, mode = state.mode) {
  const occupied = aggregateOccupiedByYear(apartments);
  const result = createYearSeries(12, OCCUPANCY_BASE_YEAR);
  Object.keys(result).forEach((yearKey) => {
    const year = Number(yearKey);
    let runningOccupied = 0;
    let runningAvailable = 0;
    for (let idx = 0; idx < 12; idx++) {
      const month = idx + 1;
      const available = availableNights(year, month, apartments.length);
      const nights = occupied[year]?.[idx] || 0;
      const monthPct = computeOccupancyPercent(nights, available);
      if (mode === 'cumulativo') {
        runningOccupied += nights;
        runningAvailable += available;
        result[year][idx] = computeOccupancyPercent(runningOccupied, runningAvailable);
      } else {
        result[year][idx] = monthPct;
      }
    }
  });
  return result;
}

function aggregateOccupiedByYear(apartments) {
  const allow = new Set(apartments.map(String));
  const result = createYearSeries(12, OCCUPANCY_BASE_YEAR);
  const occupiedDays = new Set();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  state.dailyEntries.forEach((entry) => {
    if (!allow.has(entry.apartamento)) return;
    if (entry.year === currentYear) {
      if (entry.month > currentMonth) return;
    }
    if (entry.month === currentMonth && entry.day > currentDay) return;
    if (entry.year < OCCUPANCY_BASE_YEAR) return;
    occupiedDays.add(`${entry.apartamento}-${entry.year}-${entry.month}-${entry.day}`);
  });
  occupiedDays.forEach((key) => {
    const [, yearValue, monthValue] = key.split('-');
    const year = Number(yearValue);
    const month = Number(monthValue);
    if (!result[year]) result[year] = Array(12).fill(0);
    result[year][month - 1] += 1;
  });
  return result;
}

function availableNights(year, month, apartmentCount) {
  const now = new Date();
  let days = daysInMonth(year, month);
  if (month === now.getMonth() + 1) {
    days = Math.min(days, now.getDate());
  }
  return days * apartmentCount;
}

function occupancyYtdForYear(apartments, year) {
  const now = new Date();
  const monthLimit = now.getMonth() + 1;
  const occupied = aggregateOccupiedByYear(apartments)[year] || [];
  let occupiedTotal = 0;
  let availableTotal = 0;
  for (let month = 1; month <= monthLimit; month++) {
    occupiedTotal += Number(occupied[month - 1]) || 0;
    availableTotal += availableNights(Number(year), month, apartments.length);
  }
  return computeOccupancyPercent(occupiedTotal, availableTotal);
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1).replace('.', ',')}%`;
}

function formatSignedPercent(value) {
  const num = Number(value) || 0;
  const cls = num > 0
    ? 'faturacao-v4-diff-positive'
    : num < 0
      ? 'faturacao-v4-diff-negative'
      : 'faturacao-v4-diff-neutral';
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  return `<span class="${cls}">${sign ? `${sign} ` : ''}${formatPercent(Math.abs(num))}</span>`;
}

function prepareChartData(values, year) {
  if (
    state.metric === 'occupancy'
    || state.metric === 'revpan'
    || state.metric === 'avg-night'
  ) {
    return monthlyToDate(values, year);
  }
  return state.mode === 'cumulativo' ? cumulativeMonthlyToDate(values, year) : monthlyToDate(values, year);
}

function monthlyToDate(values, year) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const series = Array.isArray(values) ? [...values] : Array(12).fill(0);
  const limitAllYears = state.mode === 'cumulativo';
  return series.map((value, idx) => (
    idx + 1 > currentMonth && (Number(year) === currentYear || limitAllYears)
      ? null
      : value
  ));
}

function createYearSeries(length, startYear = BASE_YEAR) {
  const currentYear = new Date().getFullYear();
  const maxYear = Math.max(currentYear, getMaxEntryYear());
  const result = {};
  for (let year = startYear; year <= maxYear; year++) {
    result[year] = Array(length).fill(0);
  }
  return result;
}

function getAvailableYears() {
  return [...new Set(state.dailyEntries
    .map((entry) => Number(entry.year))
    .filter((year) => Number.isFinite(year) && year >= BASE_YEAR)
  )].sort((a, b) => a - b);
}

function getDefaultTableYears() {
  const years = getAvailableYears();
  const currentYear = getCurrentDataYear();
  const previousYear = currentYear - 1;
  return years.filter((year) => year === previousYear || year === currentYear);
}

function getTableYears() {
  return state.showAllYears ? getAvailableYears() : getDefaultTableYears();
}

function getChartYears(yearly, options = {}) {
  const { all = false } = options;
  const available = getAvailableYears();
  const minYear = state.metric === 'occupancy' ? OCCUPANCY_BASE_YEAR : BASE_YEAR;
  const years = available
    .filter((year) => year >= minYear)
    .filter((year) => (yearly[year] || []).some((value) => Number(value) > 0));
  return all ? years : getDefaultChartYears(years);
}

function getDefaultChartYears(years) {
  if (years.length <= 2) return years;
  const currentDataYear = getCurrentDataYear();
  const preferred = years.filter((year) => (
    year === BASE_YEAR
    || year === currentDataYear
    || year === currentDataYear - 1
  ));
  return preferred.length ? preferred : years.slice(-2);
}

function getDataYearsForMetric() {
  const apartments = VIEW_CONFIG[state.view]?.apartments || VIEW_CONFIG.total.apartments;
  let yearly;
  if (state.metric === 'occupancy') yearly = aggregateOccupancyByYear(apartments);
  else if (state.metric === 'revpan') yearly = aggregateRevpanByYear(apartments);
  else if (state.metric === 'avg-night') yearly = aggregateAverageNightByYear(apartments);
  else if (state.metric === 'cleaning') yearly = aggregateCleaningByYear(apartments);
  else yearly = aggregateMonthlyForChart(apartments);
  return getChartYears(yearly, { all: true });
}

function getCurrentDataYear() {
  const currentYear = new Date().getFullYear();
  const years = getAvailableYears();
  return years.includes(currentYear) ? currentYear : years[years.length - 1] || currentYear;
}

function getMaxEntryYear() {
  return state.dailyEntries.reduce((max, entry) => Math.max(max, Number(entry.year) || BASE_YEAR), BASE_YEAR);
}

function emptySeriesForMode() {
  return Array(12).fill(0);
}

function cumulativeMonthlyToDate(values, year) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  let running = 0;
  return values.map((value, idx) => {
    const month = idx + 1;
    if (month > currentMonth && (Number(year) === currentYear || state.mode === 'cumulativo')) return null;
    running += Number(value) || 0;
    return running;
  });
}

function daysInMonth(year, month) {
  const date = new Date(year, month, 0);
  return Number.isNaN(date.getTime()) ? 30 : date.getDate();
}

function isValidMonth(month) {
  return Number.isFinite(month) && month >= 1 && month <= 12;
}

function isValidDay(year, month, day) {
  return Number.isFinite(day) && day >= 1 && day <= daysInMonth(year, month);
}

function getStayPeriod(row) {
  const date = parseLocalDate(row?.checkIn);
  if (date) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }
  return {
    year: Number(row?.ano),
    month: Number(row?.mes),
    day: null
  };
}

function isDetailedReservation(row) {
  return Boolean(
    parseLocalDate(row?.checkIn)
    || Number(row?.noites || 0) >= 2
    || row?.tipo === 'reserva'
  );
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resetChart() {
  if (!state.chart) return;
  destroyChartSafe(state.chart);
  state.chart = null;
}

function cleanup() {
  metricButtonsController?.abort();
  modeButtonsController?.abort();
  viewButtonsController?.abort();
  tableButtonsController?.abort();
  progressButtonsController?.abort();
  modeButtonsController = null;
  metricButtonsController = null;
  viewButtonsController = null;
  tableButtonsController = null;
  progressButtonsController = null;
  document.body.classList.remove('analisev4-table-open');
  resetChart();
}
