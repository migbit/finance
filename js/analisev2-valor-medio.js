import { db } from './script.js';
import { createChart, destroyChartSafe } from './analisev2-charts.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import {
  consolidarFaturas,
  splitFaturaPorDia,
  valorFatura,
  formatEuro,
  MONTH_LABELS,
  VIEW_APTS as BASE_VIEW_APTS
} from './analisev2-core.js';

const VIEW_APTS = {
  ...BASE_VIEW_APTS,
  compare: ['123', '1248']
};

const COLORS = {
  total: 'rgb(20, 78, 3)',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};

const monthLabels = MONTH_LABELS;
const MIN_VALOR_MEDIO_YEAR = 2025;

const state = {
  view: 'total',
  faturas: [],
  nightlyEntries: [],
  chart: null
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="valor-medio"]')) return;
  bindViewButtons();
  await loadValorMedioData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'valor-medio') loadValorMedioData();
});

window.addEventListener('beforeunload', () => {
  resetValorMedioChart();
});

function bindViewButtons() {
  document.querySelectorAll('[data-valor-medio-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.valorMedioView;
      if (!next || next === state.view) return;
      document.querySelectorAll('[data-valor-medio-view]').forEach(b => {
        const active = b.dataset.valorMedioView === next;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      state.view = next;
      renderValorMedio();
    });
  });
}

async function loadValorMedioData() {
  window.loadingManager?.show('valor-medio', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.faturas = consolidarFaturas(raw);
    state.nightlyEntries = expandNightlyEntries(state.faturas);
    renderCompetitiveCard();
    if (!state.nightlyEntries.length) {
      showValorMedioEmptyState('Sem dados disponíveis.');
    } else {
      renderValorMedio();
    }
  } catch (error) {
    window.errorHandler?.handleError('valor-medio', error, 'loadValorMedioData', loadValorMedioData);
    state.faturas = [];
    state.nightlyEntries = [];
    renderCompetitiveCard();
    showValorMedioEmptyState('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('valor-medio');
  }
}

function renderValorMedio() {
  if (state.view === 'compare') {
    renderValorMedioComparativo();
    return;
  }

  const filtered = filterEntries(state.nightlyEntries, VIEW_APTS[state.view]);
  if (!filtered.length) {
    showValorMedioEmptyState('Sem dados para esta vista.');
    return;
  }

  const aggregate = aggregateAverages(filtered);
  const years = aggregate.years;
  if (!years.length) {
    showValorMedioEmptyState('Sem dados suficientes.');
    return;
  }

  const latestYear = years[years.length - 1];
  const prevYear = years.length > 1 ? years[years.length - 2] : null;
  if (!aggregate.avgs[latestYear]) {
    showValorMedioEmptyState('Sem dados para este ano.');
    return;
  }

  renderValorMedioChart(aggregate, latestYear, prevYear);
}

function renderValorMedioComparativo() {
  const data123 = filterEntries(state.nightlyEntries, ['123']);
  const data1248 = filterEntries(state.nightlyEntries, ['1248']);
  if (!data123.length && !data1248.length) {
    showValorMedioEmptyState('Sem dados para comparar.');
    return;
  }

  const agg123 = aggregateAverages(data123);
  const agg1248 = aggregateAverages(data1248);
  const currentYear = new Date().getFullYear();
  const year123 = selectLatestYear(agg123.years);
  const year1248 = selectLatestYear(agg1248.years);

  if (!year123 && !year1248) {
    showValorMedioEmptyState('Sem dados anuais disponíveis.');
    return;
  }

  resetValorMedioChart();
  const canvas = document.getElementById('chart-valor-medio');
  if (!canvas) return;

  const datasets = [];
  if (year123 && agg123.avgs[year123]) {
    datasets.push({
      label: `123 (${year123})`,
      data: agg123.avgs[year123],
      borderColor: COLORS['123'],
      backgroundColor: withAlpha(COLORS['123'], 0.2),
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: false,
      spanGaps: true
    });
  }
  if (year1248 && agg1248.avgs[year1248]) {
    datasets.push({
      label: `1248 (${year1248})`,
      data: agg1248.avgs[year1248],
      borderColor: COLORS['1248'],
      backgroundColor: withAlpha(COLORS['1248'], 0.2),
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: false,
      spanGaps: true
    });
  }

  state.chart = createChart(canvas, {
    type: 'line',
    data: { labels: monthLabels, datasets },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => formatEuro(val) },
          grid: { color: 'rgba(0,0,0,0.05)' },
          border: { display: false }
        },
        x: { grid: { display: false }, border: { display: false } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => `${context.dataset.label}: ${formatEuro(context.parsed.y)}`
          }
        },
        legend: { position: 'top' }
      }
    }
  }, { previousChart: state.chart });
}

function renderValorMedioChart(agg, latestYear, prevYear) {
  resetValorMedioChart();
  const canvas = document.getElementById('chart-valor-medio');
  if (!canvas) return;

  const datasets = [];
  if (prevYear) {
    datasets.push({
      label: `${prevYear}`,
      data: agg.avgs[prevYear],
      borderColor: 'rgba(148,163,184,1)',
      backgroundColor: withAlpha('rgba(148,163,184,1)', 0.15),
      borderDash: [4,4],
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: false,
      spanGaps: true
    });
  }

  datasets.push({
    label: `${latestYear}`,
    data: agg.avgs[latestYear],
    borderColor: COLORS[state.view] || COLORS.total,
    backgroundColor: withAlpha(COLORS[state.view] || COLORS.total, 0.15),
    borderWidth: 2,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
    fill: false,
    spanGaps: true
  });

  state.chart = createChart(canvas, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => formatEuro(val) },
          grid: { color: 'rgba(0,0,0,0.05)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: false }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => `${context.dataset.label}: ${formatEuro(context.parsed.y)}`
          }
        },
        legend: { position: 'top' }
      }
    }
  }, { previousChart: state.chart });
}

function showValorMedioEmptyState(message) {
  resetValorMedioChart();
  const canvas = document.getElementById('chart-valor-medio');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function filterEntries(entries, apartments) {
  if (!apartments || !apartments.length || !Array.isArray(entries)) return [];
  const allow = new Set(apartments.map(String));
  return entries.filter(row => allow.has(String(row.apartamento)));
}

function aggregateAverages(entries) {
  const buckets = new Map();

  entries.forEach(entry => {
    const ano = Number(entry.ano);
    const mes = Number(entry.mes);
    const valor = Number(entry.valor);
    if (!ano || ano < MIN_VALOR_MEDIO_YEAR || !mes || !Number.isFinite(valor)) return;

    if (!buckets.has(ano)) buckets.set(ano, createMonthlyBuckets());
    const monthBucket = buckets.get(ano)[mes - 1];
    monthBucket.sum += valor;
    monthBucket.count += 1;
  });

  const years = Array.from(buckets.keys()).sort((a, b) => a - b);
  const avgs = {};
  years.forEach(year => {
    avgs[year] = buckets.get(year).map(bucket => {
      if (!bucket.count) return null;
      return bucket.sum / bucket.count;
    });
  });

  return { avgs, years };
}

function selectLatestYear(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[list.length - 1];
}

function createMonthlyBuckets() {
  return Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
}

function renderCompetitiveCard() {
  const container = document.getElementById('competitive-indicator');
  if (!container) return;
  if (!state.nightlyEntries.length || !state.faturas.length) {
    container.innerHTML = '<div class="competitive-placeholder">Sem dados para comparar os apartamentos.</div>';
    return;
  }
  const metrics = computeCompetitiveMetrics();
  if (!metrics) {
    container.innerHTML = '<div class="competitive-placeholder">Sem dados para comparar os apartamentos.</div>';
    return;
  }

  const leader = metrics.reduce((best, item) => item.avgNightly > best.avgNightly ? item : best, metrics[0]);
  const rival = metrics.find((item) => item.apartamento !== leader.apartamento);
  const diffNightly = rival ? leader.avgNightly - rival.avgNightly : 0;

  const trend123 = calculatePriceTrend(state.nightlyEntries, '123');
  const trend1248 = calculatePriceTrend(state.nightlyEntries, '1248');

  container.innerHTML = `
    ${metrics.map((item) => `
      <div class="competitive-item apt-${item.apartamento}">
        <h6><span class="apt-tag apt-${item.apartamento}">Apt ${item.apartamento}</span></h6>
        <p><span class="metric-label">€ / noite</span><strong>${formatEuro(item.avgNightly)}</strong></p>
        <p><span class="metric-label">€ / mês</span><strong>${formatEuro(item.avgMonthly)}</strong></p>
        <p><span class="metric-label">€ / hóspede</span><strong>${formatEuro(item.perGuest)}</strong></p>
      </div>
    `).join('')}
    <div class="competitive-summary">
      ${rival ? `
        Apt ${leader.apartamento} lidera por ${formatEuro(Math.abs(diffNightly))} / noite.
        <div class="competitive-trends">
          <p>Apt 123: ${formatTrendIndicator(trend123)}</p>
          <p>Apt 1248: ${formatTrendIndicator(trend1248)}</p>
        </div>
      ` : 'Apenas um apartamento com dados.'}
    </div>
  `;
}

function computeCompetitiveMetrics(windowSize = 6) {
  const entries = state.nightlyEntries;
  if (!Array.isArray(entries) || !entries.length) return null;
  const monthKeys = Array.from(new Set(entries.map((entry) => `${entry.ano}-${pad(entry.mes)}`))).sort();
  const targetKeys = new Set(monthKeys.slice(-windowSize));
  if (!targetKeys.size) return null;

  const base = {
    '123': { revenue: 0, nights: 0, months: new Set(), guests: 0 },
    '1248': { revenue: 0, nights: 0, months: new Set(), guests: 0 }
  };

  entries.forEach((entry) => {
    const key = `${entry.ano}-${pad(entry.mes)}`;
    const apt = String(entry.apartamento);
    if (!targetKeys.has(key) || !base[apt]) return;
    base[apt].revenue += Number(entry.valor) || 0;
    base[apt].nights += 1;
    base[apt].months.add(key);
  });

  state.faturas.forEach((fatura) => {
    const key = `${fatura.ano}-${pad(fatura.mes)}`;
    const apt = String(fatura.apartamento);
    if (!targetKeys.has(key) || !base[apt]) return;
    const guests = Number(fatura.hospedesAdultos || 0) + Number(fatura.hospedesCriancas || 0) + Number(fatura.hospedesBebes || 0);
    base[apt].guests += Math.max(guests, 1);
  });

  return Object.entries(base).map(([apartamento, info]) => ({
    apartamento,
    avgNightly: info.nights ? info.revenue / info.nights : 0,
    avgMonthly: info.months.size ? info.revenue / info.months.size : info.revenue,
    perGuest: info.guests ? info.revenue / info.guests : 0
  }));
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function calculatePriceTrend(entries, apartment) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const filtered = entries.filter((entry) => String(entry.apartamento) === String(apartment));
  if (filtered.length < 8) return null;
  const recent = filtered.slice(-6);
  const older = filtered.slice(-12, -6);
  if (!recent.length || !older.length) return null;
  const recentAvg = recent.reduce((sum, entry) => sum + (entry.valor || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, entry) => sum + (entry.valor || 0), 0) / older.length;
  if (!Number.isFinite(recentAvg) || !Number.isFinite(olderAvg) || olderAvg === 0) return null;
  return ((recentAvg - olderAvg) / olderAvg) * 100;
}

function formatTrendIndicator(trend) {
  if (trend == null) return 'Dados insuficientes';
  if (trend > 5) return `📈 Subindo (${trend.toFixed(1)}%)`;
  if (trend < -5) return `📉 Descendo (${trend.toFixed(1)}%)`;
  return `➡️ Estável (${trend.toFixed(1)}%)`;
}

function expandNightlyEntries(faturas) {
  if (!Array.isArray(faturas)) return [];
  const entries = [];
  faturas.forEach(fatura => {
    const slices = splitFaturaPorDia(fatura);
    if (slices?.length) {
      slices.forEach(slice => {
        entries.push({
          apartamento: String(fatura.apartamento),
          ano: slice.ano,
          mes: slice.mes,
          valor: slice.valorDistribuido
        });
      });
      return;
    }

    const nightly = nightlyFromFatura(fatura);
    const ano = Number(fatura.ano);
    const mes = Number(fatura.mes);
    if (!nightly || !ano || !mes) return;

    entries.push({
      apartamento: String(fatura.apartamento),
      ano,
      mes,
      valor: nightly
    });
  });
  return entries;
}

function nightlyFromFatura(fatura) {
  const noites = Number(fatura.noites || 0);
  if (!noites || noites <= 0) return null;
  return valorFatura(fatura) / noites;
}

function resetValorMedioChart() {
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
