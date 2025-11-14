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

const VIEW_LABELS = {
  total: 'Total',
  '123': 'Apartamento 123',
  '1248': 'Apartamento 1248',
  compare: 'Comparação'
};

const MIN_REVPAN_YEAR = 2025;
const OCCUPANCY_TARGET = 75;
const TARGET_REVPAN_RATIO = 0.75;

const state = {
  view: 'total',
  months: [],
  chart: null,
  scatterChart: null
};

let buttonsController = null;
let revpanPluginsRegistered = false;

const revpanQuadrantPlugin = {
  id: 'revpanQuadrants',
  afterDraw(chart, args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!opts || !scales?.x || !scales?.y) return;
    const { xThreshold, yThreshold } = opts;
    const x = scales.x.getPixelForValue?.(xThreshold);
    const y = scales.y.getPixelForValue?.(yThreshold);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(107,114,128,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();

    const labels = opts.labels || {
      topRight: '✓ Zona ideal',
      bottomRight: '⚠ Subprecificado',
      topLeft: '💡 Procura baixa',
      bottomLeft: '🚨 Atenção'
    };
    ctx.font = '600 11px var(--font-sans, system-ui, sans-serif)';
    ctx.fillStyle = 'rgba(55,65,81,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midTop = (chartArea.top + y) / 2;
    const midBottom = (chartArea.bottom + y) / 2;
    const midLeft = (chartArea.left + x) / 2;
    const midRight = (chartArea.right + x) / 2;
    ctx.fillText(labels.topRight, midRight, midTop);
    ctx.fillText(labels.bottomRight, midRight, midBottom);
    ctx.fillText(labels.topLeft, midLeft, midTop);
    ctx.fillText(labels.bottomLeft, midLeft, midBottom);
    ctx.restore();
  }
};

function ensureRevpanPlugins() {
  if (revpanPluginsRegistered) return;
  if (typeof Chart === 'undefined' || !Chart?.register) return;
  try {
    Chart.register(revpanQuadrantPlugin);
    revpanPluginsRegistered = true;
  } catch (error) {
    console.error('Falha ao registar plugins do RevPAN', error);
  }
}

ensureRevpanPlugins();

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
  destroyScatterChart();
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
    renderRevpanSummary(null);
    renderRevpanScatter(null);
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
  renderRevpanSummary(series);
  renderRevpanScatter(series);
}

function buildRevpanSeries(months, apartments) {
  if (!Array.isArray(apartments) || !apartments.length) {
    return { years: [], map: new Map(), metrics: [] };
  }
  const metrics = aggregateMonthlyMetrics(months, apartments);
  const years = new Map();
  metrics.forEach((metric) => {
    if (!years.has(metric.year)) years.set(metric.year, Array(12).fill(null));
    const arr = years.get(metric.year);
    arr[metric.month - 1] = Number.isFinite(metric.revpan) ? metric.revpan : null;
  });
  const sortedYears = Array.from(years.keys()).sort((a, b) => a - b);
  return { years: sortedYears, map: years, metrics };
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
            callback: (value) => formatRevpanValue(value)
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: { grid: { display: false } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatRevpanValue(context.parsed.y)}`
          }
        },
        legend: { position: 'top' }
      }
    }
  }, { previousChart: state.chart });

  const info = document.getElementById('revpan-highlight');
  if (info) {
    info.innerHTML = `
      <h5>Insights</h5>
      <p>Comparação direta entre apartamentos 123 e 1248.</p>
    `;
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
  const targetRevpan = calculateTargetRevpan(series.metrics);
  if (targetRevpan > 0) {
    datasets.push({
      label: 'Alvo RevPAN (75% ocup.)',
      data: Array(12).fill(targetRevpan),
      borderColor: '#0ea5e9',
      borderWidth: 1.5,
      borderDash: [6, 6],
      tension: 0,
      spanGaps: true,
      pointRadius: 0
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
            callback: (value) => formatRevpanValue(value)
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
              return `${context.dataset.label}: ${formatRevpanValue(value)}`;
            }
          }
        },
        legend: { position: 'top' },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          align: 'top',
          anchor: 'end',
          formatter: (value) => (value != null ? formatEuro(value) : ''),
          font: { size: 10, weight: '600' }
        } : undefined
      }
    }
  }, { previousChart: state.chart, preserveAspectRatio: true });
}

function renderHighlight(series) {
  const info = document.getElementById('revpan-highlight');
  if (!info) return;
  if (state.view === 'compare') {
    info.innerHTML = `
      <h5>Insights</h5>
      <p>Use uma vista individual para obter recomendações de preço.</p>
    `;
    return;
  }
  const latestYear = series.years[series.years.length - 1];
  if (!latestYear) {
    info.innerHTML = '<p>Sem dados recentes para RevPAN.</p>';
    return;
  }
  const latestMetrics = (series.metrics || []).filter((metric) => metric.year === latestYear);
  if (!latestMetrics.length) {
    info.innerHTML = '<p>Sem dados recentes para RevPAN.</p>';
    return;
  }
  const lastMetric = latestMetrics.reduce((acc, metric) => (!acc || metric.month > acc.month ? metric : acc), null);
  const prevYear = series.years.length > 1 ? series.years[series.years.length - 2] : null;
  const prevValue = prevYear && lastMetric ? series.map.get(prevYear)?.[lastMetric.month - 1] : null;
  const insights = [];
  const snapshot = buildSnapshotInsight(lastMetric, prevValue, prevYear);
  if (snapshot) insights.push(snapshot);
  insights.push(...generateRevpanInsights(latestMetrics));
  info.innerHTML = `
    <h5>Insights ${VIEW_LABELS[state.view] || ''}</h5>
    ${insights.length
      ? `<ul>${insights.map((item) => `<li class="revpan-insight--${item.type}">${item.message}</li>`).join('')}</ul>`
      : '<p>Performance estável – sem alertas críticos.</p>'}
  `;
}

function renderEmpty(message) {
  destroyChart();
  renderRevpanSummary(null);
  renderRevpanScatter(null);
  const info = document.getElementById('revpan-highlight');
  if (info) info.innerHTML = `<p>${message}</p>`;
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

function formatRevpanValue(value) {
  if (!Number.isFinite(value)) return '—';
  return `${formatEuro(value)} /noite`;
}

function aggregateMonthlyMetrics(months, apartments = []) {
  if (!Array.isArray(apartments) || !apartments.length) return [];
  return months.map((month) => {
    const fallback = month.availableTotal && apartments.length ? month.availableTotal / apartments.length : 0;
    const revenue = apartments.reduce((sum, apt) => sum + (month.revenueByApt?.[apt] || 0), 0);
    const occupied = apartments.reduce((sum, apt) => sum + (month.occupiedByApt?.[apt] || 0), 0);
    const available = apartments.reduce((sum, apt) => sum + (month.availableByApt?.[apt] ?? fallback), 0);
    const revpan = available ? revenue / available : null;
    const avgPrice = occupied ? revenue / occupied : 0;
    const rawOccupancy = available ? (occupied / available) * 100 : null;
    let occupancy = Number.isFinite(rawOccupancy) ? Math.max(0, Math.min(rawOccupancy, 100)) : null;
    if (Number.isFinite(rawOccupancy) && rawOccupancy > 100.5) {
      console.warn(`Ocupação acima de 100% detectada em ${month.year}-${month.month}: ${rawOccupancy.toFixed(1)}%. Verifique noites disponíveis.`);
    }
    return {
      year: month.year,
      month: month.month,
      revpan: Number.isFinite(revpan) ? revpan : null,
      occupancy,
      avgPrice,
      revenue,
      available,
      occupied
    };
  }).filter((entry) => entry.revpan != null);
}

function calculateEfficiency(revpan, avgPrice) {
  if (!Number.isFinite(revpan) || !Number.isFinite(avgPrice) || avgPrice <= 0) return null;
  return Math.max(0, (revpan / avgPrice) * 100);
}

function calculateTargetRevpan(metrics = []) {
  if (!metrics.length) return 0;
  const revenue = metrics.reduce((sum, item) => sum + item.revenue, 0);
  const occupied = metrics.reduce((sum, item) => sum + item.occupied, 0);
  if (!occupied) return 0;
  const avgPrice = revenue / occupied;
  return avgPrice * TARGET_REVPAN_RATIO;
}

function calculateYtdRevpan(metrics = []) {
  if (!metrics.length) return null;
  const latestYear = Math.max(...metrics.map((m) => m.year));
  if (!Number.isFinite(latestYear)) return null;
  const latestYearRows = metrics.filter((m) => m.year === latestYear);
  if (!latestYearRows.length) return null;
  const cutoffMonth = Math.max(...latestYearRows.map((m) => m.month));
  const collectStats = (year) => {
    const rows = metrics.filter((m) => m.year === year && m.month <= cutoffMonth);
    if (!rows.length) return null;
    const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const available = rows.reduce((sum, row) => sum + row.available, 0);
    const occupied = rows.reduce((sum, row) => sum + row.occupied, 0);
    if (!available) return null;
    const revpan = revenue / available;
    const avgPrice = occupied ? revenue / occupied : null;
    return { revpan, avgPrice };
  };
  const currentStats = collectStats(latestYear);
  if (!currentStats || !Number.isFinite(currentStats.revpan)) return null;
  const prevStats = collectStats(latestYear - 1);
  const prevValue = prevStats?.revpan ?? null;
  return {
    currentLabel: `${MONTH_LABELS[cutoffMonth - 1]} ${latestYear}`,
    prevLabel: Number.isFinite(prevValue) ? `${MONTH_LABELS[cutoffMonth - 1]} ${latestYear - 1}` : null,
    currentValue: currentStats.revpan,
    prevValue: Number.isFinite(prevValue) ? prevValue : null,
    delta: Number.isFinite(prevValue) ? currentStats.revpan - prevValue : null,
    changePercent: Number.isFinite(prevValue) && prevValue !== 0 ? ((currentStats.revpan - prevValue) / prevValue) * 100 : null,
    efficiency: calculateEfficiency(currentStats.revpan, currentStats.avgPrice)
  };
}

function generateRevpanInsights(latestMetrics = []) {
  const insights = [];
  const TH = {
    critical: { occupancy: 40, ratio: 0.4 },
    warning: { occupancy: 50, ratio: 0.5 },
    underpriced: { occupancy: 85, ratio: 0.7 },
    excellent: { occupancy: 75, ratio: 0.75 }
  };
  latestMetrics.forEach((metric) => {
    if (!Number.isFinite(metric.revpan) || !Number.isFinite(metric.occupancy) || !Number.isFinite(metric.avgPrice)) return;
    const monthName = MONTH_LABELS[metric.month - 1];
    const ratio = metric.avgPrice > 0 ? metric.revpan / metric.avgPrice : 0;
    if (metric.occupancy < TH.critical.occupancy && ratio < TH.critical.ratio) {
      insights.push({
        type: 'critical',
        priority: 1,
        message: `🚨 ${monthName}: Ocupação ${metric.occupancy.toFixed(0)}% e RevPAN ${formatRevpanValue(metric.revpan)} → ação urgente.`
      });
      return;
    }
    if (metric.occupancy >= TH.underpriced.occupancy && ratio < TH.underpriced.ratio) {
      insights.push({
        type: 'warning',
        priority: 2,
        message: `⚠️ ${monthName}: Subprecificado (${metric.occupancy.toFixed(0)}%) → aumentar preços 10-15%.`
      });
      return;
    }
    if (metric.occupancy < TH.warning.occupancy && ratio < TH.warning.ratio) {
      insights.push({
        type: 'problem',
        priority: 3,
        message: `💡 ${monthName}: Procura fraca (${metric.occupancy.toFixed(0)}%) → promoções ou estadias longas.`
      });
      return;
    }
    if (metric.occupancy >= TH.excellent.occupancy && ratio >= TH.excellent.ratio) {
      insights.push({
        type: 'success',
        priority: 4,
        message: `✅ ${monthName}: Excelente equilíbrio (${metric.occupancy.toFixed(0)}% · ${formatRevpanValue(metric.revpan)}).`
      });
    }
  });
  return insights
    .sort((a, b) => (a.priority || 5) - (b.priority || 5))
    .slice(0, 4);
}

function buildSnapshotInsight(metric, prevValue, prevYear) {
  if (!metric || !Number.isFinite(metric.revpan)) return null;
  const monthName = MONTH_LABELS[metric.month - 1];
  if (!Number.isFinite(prevValue)) {
    return {
      type: 'info',
      message: `Último dado (${monthName} ${metric.year}): ${formatRevpanValue(metric.revpan)}.`
    };
  }
  const delta = metric.revpan - prevValue;
  const pct = prevValue !== 0 ? (delta / prevValue) * 100 : null;
  const compareLabel = prevYear ?? (metric.year - 1);
  return {
    type: delta >= 0 ? 'success' : 'problem',
    message: `Último dado (${monthName} ${metric.year}): ${formatRevpanValue(metric.revpan)} (${delta >= 0 ? '+' : '−'}${formatEuro(Math.abs(delta))}${Number.isFinite(pct) ? ` · ${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%` : ''} vs ${compareLabel}).`
  };
}

function renderRevpanSummary(series) {
  const card = document.getElementById('revpan-ytd-card');
  if (!card) return;
  if (state.view === 'compare') {
    card.innerHTML = `
      <p class="eyebrow">YTD RevPAN</p>
      <div class="value">—</div>
      <p class="delta muted">Disponível apenas nas vistas Total ou individuais.</p>
    `;
    return;
  }
  const summary = series?.metrics ? calculateYtdRevpan(series.metrics) : null;
  if (!summary) {
    card.innerHTML = `
      <p class="eyebrow">YTD RevPAN</p>
      <div class="value">—</div>
      <p class="delta muted">Sem dados suficientes.</p>
    `;
    return;
  }
  let deltaText = 'Sem base do ano anterior.';
  let deltaClass = 'delta muted';
  if (summary.prevLabel && Number.isFinite(summary.delta)) {
    const pct = Number.isFinite(summary.changePercent)
      ? ` (${summary.changePercent >= 0 ? '+' : '−'}${Math.abs(summary.changePercent).toFixed(1)}%)`
      : '';
    deltaClass = summary.delta >= 0 ? 'delta positive' : 'delta negative';
    deltaText = `${summary.delta >= 0 ? '+' : '−'}${formatEuro(Math.abs(summary.delta))}${pct} vs ${summary.prevLabel}`;
  }
  card.innerHTML = `
    <p class="eyebrow">Até ${summary.currentLabel}</p>
    <div class="value">${formatRevpanValue(summary.currentValue)}</div>
    <p class="${deltaClass}">${deltaText}</p>
    <p class="efficiency">${summary.efficiency != null
      ? `Eficiência: ${summary.efficiency.toFixed(0)}% do potencial (preço médio)`
      : 'Eficiência: indisponível'}</p>
  `;
}

function renderRevpanScatter(series) {
  const canvas = document.getElementById('chart-revpan-scatter');
  if (!canvas || typeof Chart === 'undefined') return;
  ensureRevpanPlugins();
  if (!series?.metrics || !series.metrics.length || state.view === 'compare') {
    destroyScatterChart();
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setScatterNote(state.view === 'compare'
      ? 'Gráfico de dispersão disponível apenas para Total ou um apartamento.'
      : 'Sem dados suficientes para o gráfico de dispersão.');
    return;
  }
  const points = series.metrics
    .filter((metric) => Number.isFinite(metric.revpan) && Number.isFinite(metric.occupancy))
    .map((metric) => ({
      x: Number(metric.occupancy.toFixed(1)),
      y: metric.revpan,
      label: `${MONTH_LABELS[metric.month - 1].slice(0, 3)} ${String(metric.year).slice(-2)}`
    }));
  if (!points.length) {
    destroyScatterChart();
    setScatterNote('Sem dados suficientes para o gráfico de dispersão.');
    return;
  }
  const avgRevpan = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  destroyScatterChart();
  state.scatterChart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Meses',
        data: points,
        pointBackgroundColor: COLORS[state.view] || COLORS.total,
        pointBorderColor: '#111827',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Ocupação (%)' },
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}%` }
        },
        y: {
          title: { display: true, text: 'RevPAN (€/noite)' },
          beginAtZero: true,
          ticks: { callback: (value) => formatRevpanValue(value) }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw;
              return `${point.label}: ${context.parsed.x}% · ${formatRevpanValue(context.parsed.y)}`;
            }
          }
        },
        revpanQuadrants: {
          xThreshold: OCCUPANCY_TARGET,
          yThreshold: avgRevpan,
          labels: {
            topRight: '✓ Zona ideal',
            bottomRight: '⚠ Subprecificado',
            topLeft: '💡 Procura baixa',
            bottomLeft: '🚨 Atenção'
          }
        },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          align: 'left',
          anchor: 'center',
          offset: 8,
          color: '#1f2937',
          font: { size: 10, weight: 600 },
          formatter: (value, context) => context.dataset.data[context.dataIndex].label
        } : undefined
      }
    }
  });
  setScatterNote('Cada ponto cruza Ocupação × RevPAN para expor meses sub ou sobre precificados.');
}

function destroyScatterChart() {
  if (state.scatterChart) {
    destroyChartSafe(state.scatterChart);
    state.scatterChart = null;
  }
}

function setScatterNote(message) {
  const note = document.getElementById('revpan-scatter-note');
  if (note) note.textContent = message;
}
