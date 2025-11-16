import { db } from './script.js';
import { createChart, destroyChartSafe } from './analisev2-charts.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { parseLocalDate, consolidarFaturas, valorFatura, formatEuro, MONTH_LABELS } from './analisev2-core.js';

const BASE_YEAR = 2024;
const monthLabels = MONTH_LABELS;
const COLORS = {
  total: 'rgb(20, 78, 3)',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const VIEW_CONFIG = {
  total:   { type: 'aggregate', apartments: ['123','1248'], color: COLORS.total },
  '123':   { type: 'single', apartments: ['123'], color: COLORS['123'] },
  '1248':  { type: 'single', apartments: ['1248'], color: COLORS['1248'] },
  compare: { type: 'compare', apartments: ['123','1248'] }
};

const state = {
  view: 'total',
  chartType: 'line',
  granularity: 'mes',
  faturas: [],
  chart: null
};
let viewButtonsController = null;
let chartTypeButtonsController = null;
let granularityButtonsController = null;

function setChartTransition(active) {
  const wrap = document.querySelector('#mod-faturacao .chart-wrap');
  if (wrap) wrap.classList.toggle('is-loading', !!active);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="faturacao"]')) return;
  setupFilterButtons();
  bindExportButton();
  await loadData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'faturacao') loadData();
});

window.addEventListener('beforeunload', cleanupFaturacaoResources);

function setupFilterButtons() {
  bindViewButtons();
  bindChartTypeButtons();
  bindGranularityButtons();
}

function bindViewButtons() {
  if (viewButtonsController) viewButtonsController.abort();
  viewButtonsController = new AbortController();
  const { signal } = viewButtonsController;

  document.querySelectorAll('[data-faturacao-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const target = btn.dataset.faturacaoView;
      if (!target || target === state.view) return;
      addPressEffect(btn);
      temporarilyDisable(btn);
      state.view = target;
      updateFilterButtonState();
      renderCurrentView();
    }, { signal });
  });
  updateFilterButtonState();
}

function bindChartTypeButtons() {
  if (chartTypeButtonsController) chartTypeButtonsController.abort();
  chartTypeButtonsController = new AbortController();
  const { signal } = chartTypeButtonsController;

  document.querySelectorAll('[data-chart-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const type = btn.dataset.chartType;
      if (!type || type === state.chartType) return;
      addPressEffect(btn);
      temporarilyDisable(btn);
      state.chartType = type;
      updateChartTypeButtons();
      renderCurrentView();
    }, { signal });
  });
  updateChartTypeButtons();
}

function bindGranularityButtons() {
  if (granularityButtonsController) granularityButtonsController.abort();
  granularityButtonsController = new AbortController();
  const { signal } = granularityButtonsController;

  document.querySelectorAll('[data-granularity]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const mode = btn.dataset.granularity;
      if (!mode || mode === state.granularity) return;
      addPressEffect(btn);
      temporarilyDisable(btn);
      state.granularity = mode;
      updateGranularityButtons();
      renderCurrentView();
    }, { signal });
  });
  updateGranularityButtons();
}

function updateFilterButtonState() {
  document.querySelectorAll('[data-faturacao-view]').forEach(btn => {
    const isActive = btn.dataset.faturacaoView === state.view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateChartTypeButtons() {
  document.querySelectorAll('[data-chart-type]').forEach(btn => {
    const isActive = btn.dataset.chartType === state.chartType;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateGranularityButtons() {
  document.querySelectorAll('[data-granularity]').forEach(btn => {
    const isActive = btn.dataset.granularity === state.granularity;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

async function loadData() {
  window.loadingManager?.show('faturacao', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.faturas = consolidarFaturas(rows).filter(f => ['123','1248'].includes(String(f.apartamento)));
    if (!state.faturas.length) {
      showEmptyState('Sem dados disponíveis.');
    } else {
      renderCurrentView();
    }
  } catch (error) {
    window.errorHandler?.handleError('faturacao', error, 'loadData', loadData);
    state.faturas = [];
    showEmptyState('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('faturacao');
  }
}

function renderCurrentView() {
  const cfg = VIEW_CONFIG[state.view];
  if (!cfg) return;

  if (typeof setChartTransition === 'function') setChartTransition(true);
  try {
    const faturasView = filterByApartments(state.faturas, cfg.apartments);
    if (!faturasView.length) {
      showEmptyState('Sem dados para esta vista.');
      return;
    }

    if (cfg.type === 'compare') {
      renderComparativoChart(state.faturas);
      renderTabelaComparativa(state.faturas, 'tabela-faturacao-v2');
      return;
    }

    renderYearComparisonChart(faturasView, cfg.color);

    if (cfg.type === 'aggregate') {
      renderTabelaTotal(faturasView, 'tabela-faturacao-v2');
    } else {
      renderTabelaPorApartamento(faturasView, cfg.apartments[0], 'tabela-faturacao-v2');
    }
  } finally {
    if (typeof setChartTransition === 'function') setChartTransition(false);
  }
}

function filterByApartments(faturas, apartments) {
  if (!apartments || !apartments.length) return [];
  const allow = new Set(apartments.map(String));
  return faturas.filter(f => allow.has(String(f.apartamento)));
}

function showEmptyState(message) {
  resetChart();
  const table = document.getElementById('tabela-faturacao-v2');
  if (table) table.innerHTML = `<p style="text-align:center;color:var(--text-dim);">${message}</p>`;
}

function renderYearComparisonChart(faturas, color) {
  if (!faturas.length) {
    resetChart();
    return;
  }

  const agg = aggregateTotals(faturas);
  const years = agg.years;
  if (!years.length) {
    resetChart();
    return;
  }

  const ultimoAno = years[years.length - 1];
  const penultimoAno = years.length > 1 ? years[years.length - 2] : null;

  const atual = agg.totals[ultimoAno] || Array(12).fill(0);
  const anterior = penultimoAno ? (agg.totals[penultimoAno] || Array(12).fill(0)) : [];

  const datasets = [];
  if (penultimoAno) {
    datasets.push({
      label: `${penultimoAno}`,
      data: anterior,
      borderDash: [4, 4],
      borderWidth: 1.5,
      borderColor: 'rgba(120,120,120,1)',
      backgroundColor: 'rgba(120,120,120,0.1)',
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  datasets.push({
    label: `${ultimoAno}`,
    data: atual,
    borderColor: color,
    backgroundColor: withAlpha(color, 0.15),
    borderWidth: 2,
    tension: 0.1,
    pointRadius: 5,
    pointHoverRadius: 7
  });

  const maxValue = Math.max(...atual, ...(anterior.length ? anterior : [0]));
  const suggestedMax = maxValue > 0 ? Math.ceil(maxValue * 1.15 / 500) * 500 : undefined;

  resetChart();
  const canvas = document.getElementById('chart-faturacao-v2');
  if (!canvas) return;

  const chartType = state.chartType === 'bar' ? 'bar' : 'line';

  state.chart = createChart(canvas, {
    type: chartType,
    data: { labels: monthLabels, datasets },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax,
          ticks: { stepSize: 500, precision: 0 },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: true }
        }
      }
    }
  }, { previousChart: state.chart });

  attachMobileXAxisRotation(state.chart);
}

function renderComparativoChart(faturas) {
  const agg123 = aggregateTotals(faturas, ['123']);
  const agg1248 = aggregateTotals(faturas, ['1248']);
  const end = determineTimelineEnd([agg123.totals, agg1248.totals]);
  const seq = buildTimelineSequence(end.year, end.month);
  if (!seq.length) {
    resetChart();
    return;
  }

  const data123 = seq.map(({ year, month }) => agg123.totals[year]?.[month - 1] ?? 0);
  const data1248 = seq.map(({ year, month }) => agg1248.totals[year]?.[month - 1] ?? 0);
  const labels = seq.map(({ year, month }) => `${monthLabels[month - 1]} ${String(year).slice(-2)}`);

  resetChart();
  const canvas = document.getElementById('chart-faturacao-v2');
  if (!canvas) return;

  const chartType = state.chartType === 'bar' ? 'bar' : 'line';

  state.chart = createChart(canvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: 'Apartamento 123',
          data: data123,
          borderColor: COLORS['123'],
          backgroundColor: withAlpha(COLORS['123'], 0.1),
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: true
        },
        {
          label: 'Apartamento 1248',
          data: data1248,
          borderColor: COLORS['1248'],
          backgroundColor: withAlpha(COLORS['1248'], 0.1),
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: true
        }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          ticks: { precision: 0 },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: true }
        }
      }
    }
  }, { previousChart: state.chart });
}

function renderTabelaTotal(faturas, targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const agg = aggregateTotals(faturas);
  const years = agg.years;
  if (!years.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-dim);">Sem dados para apresentar.</p>';
    return;
  }

  const totals = agg.totals;
  const nights = agg.nights;
  const mostraMedia = {};
  years.forEach(year => { mostraMedia[year] = nights[year].some(v => v > 0); });

  const colors = ['#f9fafb', '#eef6ff', '#fef7ed', '#eefcf3', '#f6f0ff'];
  const currentMonth = new Date().getMonth() + 1;

  const yoyCell = (curr, prev, bg) => {
    const diff = Math.round(curr - prev);
    if (diff === 0) return `<td style="background:${bg};text-align:center;color:#555">€0</td>`;
  const sign = diff > 0 ? '+' : '-';
    const color = diff > 0 ? '#16a34a' : '#dc2626';
    return `<td style="background:${bg};text-align:center;color:${color}"><strong>${sign} ${euroInt(Math.abs(diff))}</strong></td>`;
  };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${years.map((year, idx) => {
            const span = (mostraMedia[year] ? 2 : 1) + (idx > 0 ? 1 : 0);
            return `<th colspan="${span}" style="text-align:center">${year}</th>`;
          }).join('')}
        </tr>
        <tr>
          ${years.map((year, idx) => {
            const parts = [];
            if (mostraMedia[year]) parts.push('<th>Média</th>');
            parts.push('<th>Total</th>');
            if (idx > 0) parts.push('<th>Δ</th>');
            return parts.join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  monthLabels.forEach((label, monthIdx) => {
    html += `<tr><td>${label}</td>`;
    years.forEach((year, idx) => {
      const bg = colors[idx % colors.length];
      const totalMes = totals[year][monthIdx];
      const nightsMes = nights[year][monthIdx];
      const media = nightsMes > 0 ? Math.round(totalMes / nightsMes) : null;

      if (mostraMedia[year]) {
        html += `<td style="background:${bg};text-align:center">${media != null ? euroInt(media) : '—'}</td>`;
      }
      html += `<td style="background:${bg};text-align:center">${euroInt(totalMes)}</td>`;

      if (idx > 0) {
        if (year === years[years.length - 1] && (monthIdx + 1) > currentMonth) {
          html += `<td style="background:${bg};text-align:center;color:#999">—</td>`;
        } else {
          const prev = totals[years[idx - 1]]?.[monthIdx] ?? 0;
          html += yoyCell(totalMes, prev, bg);
        }
      }
    });
    html += '</tr>';
  });

  html += `<tr><td><strong>Total</strong></td>`;
  years.forEach((year, idx) => {
    const bg = colors[idx % colors.length];
    const totalAno = totals[year].reduce((sum, v) => sum + v, 0);
    const medias = totals[year]
      .map((t, m) => nights[year][m] > 0 ? t / nights[year][m] : null)
      .filter(v => v != null);
    const medio = medias.length ? Math.round(medias.reduce((s, v) => s + v, 0) / medias.length) : null;

    if (mostraMedia[year]) {
      html += `<td style="background:${bg};text-align:center"><strong>${medio != null ? euroInt(medio) : '—'}</strong></td>`;
    }
    html += `<td style="background:${bg};text-align:center"><strong>${euroInt(totalAno)}</strong></td>`;

    if (idx > 0) {
      const prevAno = totals[years[idx - 1]].reduce((sum, v) => sum + v, 0);
      html += yoyCell(totalAno, prevAno, bg);
    }
  });
  html += '</tr>';

  html += `<tr><td><strong>Média mensal</strong></td>`;
  years.forEach((year, idx) => {
    const bg = colors[idx % colors.length];
    const totalAno = totals[year].reduce((sum, v) => sum + v, 0);
    const mediaMensal = totalAno / 12;

    if (mostraMedia[year]) html += `<td style="background:${bg};text-align:center">—</td>`;
    html += `<td style="background:${bg};text-align:center"><strong>${euroInt(mediaMensal)}</strong></td>`;

    if (idx > 0) {
      const prevAno = totals[years[idx - 1]].reduce((sum, v) => sum + v, 0);
      html += yoyCell(mediaMensal, prevAno / 12, bg);
    }
  });
  html += '</tr></tbody></table>';

  container.innerHTML = html;
}

function renderTabelaPorApartamento(faturas, apartamento, targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const agg = aggregateTotals(faturas, [apartamento]);
  const years = agg.years;
  if (!years.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-dim);">Sem dados para apresentar.</p>';
    return;
  }

  const totals = agg.totals;
  const nights = agg.nights;
  const mostraMedia = {};
  years.forEach(year => { mostraMedia[year] = nights[year].some(v => v > 0); });

  const colors = ['#f9fafb', '#eef6ff', '#fef7ed', '#eefcf3', '#f6f0ff'];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const yoyCell = (curr, prev, bg, isFuture) => {
    if (isFuture) return `<td style="background:${bg};text-align:center;color:#999">—</td>`;
    const diff = Math.round(curr - prev);
    if (diff === 0) return `<td style="background:${bg};text-align:center;color:#555">€0</td>`;
    const color = diff > 0 ? '#16a34a' : '#dc2626';
  const sign = diff > 0 ? '+' : '-';
    return `<td style="background:${bg};text-align:center;color:${color}"><strong>${sign} ${euroInt(Math.abs(diff))}</strong></td>`;
  };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${years.map((year, idx) => {
            const span = (mostraMedia[year] ? 2 : 1) + (idx > 0 ? 1 : 0);
            return `<th colspan="${span}" style="text-align:center">${year}</th>`;
          }).join('')}
        </tr>
        <tr>
          ${years.map((year, idx) => {
            const parts = [];
            if (mostraMedia[year]) parts.push('<th>Média</th>');
            parts.push('<th>Total</th>');
            if (idx > 0) parts.push('<th>Δ</th>');
            return parts.join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  monthLabels.forEach((label, monthIdx) => {
    html += `<tr><td>${label}</td>`;
    years.forEach((year, idx) => {
      const bg = colors[idx % colors.length];
      const tot = totals[year][monthIdx];
      const nightsMes = nights[year][monthIdx];
      const media = nightsMes > 0 ? Math.round(tot / nightsMes) : null;

      if (mostraMedia[year]) {
        html += `<td style="background:${bg};text-align:center">${media != null ? euroInt(media) : '—'}</td>`;
      }
      html += `<td style="background:${bg};text-align:center">${euroInt(tot)}</td>`;

      if (idx > 0) {
        const isFuture = year === currentYear && (monthIdx + 1) > currentMonth;
        const prev = totals[years[idx - 1]]?.[monthIdx] ?? 0;
        html += yoyCell(tot, prev, bg, isFuture);
      }
    });
    html += '</tr>';
  });

  html += `<tr><td><strong>Total</strong></td>`;
  years.forEach((year, idx) => {
    const bg = colors[idx % colors.length];
    const totalAno = totals[year].reduce((sum, v) => sum + v, 0);
    const medias = totals[year]
      .map((t, m) => nights[year][m] > 0 ? t / nights[year][m] : null)
      .filter(v => v != null);
    const medio = medias.length ? Math.round(medias.reduce((s, v) => s + v, 0) / medias.length) : null;

    if (mostraMedia[year]) {
      html += `<td style="background:${bg};text-align:center"><strong>${medio != null ? euroInt(medio) : '—'}</strong></td>`;
    }
    html += `<td style="background:${bg};text-align:center"><strong>${euroInt(totalAno)}</strong></td>`;

    if (idx > 0) {
      const prevAno = totals[years[idx - 1]].reduce((sum, v) => sum + v, 0);
      html += yoyCell(totalAno, prevAno, bg, false);
    }
  });
  html += '</tr>';

  html += `<tr><td><strong>Média mensal</strong></td>`;
  years.forEach((year, idx) => {
    const bg = colors[idx % colors.length];
    const totalAno = totals[year].reduce((sum, v) => sum + v, 0);
    const mediaMensal = totalAno / 12;

    if (mostraMedia[year]) html += `<td style="background:${bg};text-align:center">—</td>`;
    html += `<td style="background:${bg};text-align:center"><strong>${euroInt(mediaMensal)}</strong></td>`;

    if (idx > 0) {
      const prevAno = totals[years[idx - 1]].reduce((sum, v) => sum + v, 0);
      html += yoyCell(mediaMensal, prevAno / 12, bg, false);
    }
  });
  html += '</tr></tbody></table>';

  container.innerHTML = html;
}

function renderTabelaComparativa(faturas, targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const agg123 = aggregateTotals(faturas, ['123']);
  const agg1248 = aggregateTotals(faturas, ['1248']);
  const years = agg123.years;
  if (!years.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-dim);">Sem dados para apresentar.</p>';
    return;
  }

  const totals123 = agg123.totals;
  const totals1248 = agg1248.totals;
  const nights123 = agg123.nights;
  const nights1248 = agg1248.nights;

  const colors = ['#fbfbff', '#e9ffeb', '#fffaf5', '#f8f9ff', '#f9f7ff'];

  const diffCell = (v123, v1248, bg) => {
    const diff = Math.abs(v123 - v1248);
    if (diff === 0) return `<td style="background:${bg};text-align:center;color:#555">—</td>`;
    const winner = v123 > v1248 ? '123' : '1248';
    const cls = winner === '123' ? 'apt-123' : 'apt-1248';
    return `<td style="background:${bg};text-align:center"><strong class="${cls}">${euroInt(diff)}</strong></td>`;
  };

  const diffMediaCell = (media123, media1248, bg) => {
    if (media123 == null && media1248 == null) {
      return `<td style="background:${bg};text-align:center">—</td>`;
    }
    const diff = Math.abs((media123 || 0) - (media1248 || 0));
    if (diff === 0) return `<td style="background:${bg};text-align:center;color:#555">—</td>`;
    const winner = (media123 || 0) > (media1248 || 0) ? '123' : '1248';
    const cls = winner === '123' ? 'apt-123' : 'apt-1248';
    return `<td style="background:${bg};text-align:center"><strong class="${cls}">${euroInt(diff)}</strong></td>`;
  };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${years.map(year => {
            const extra = year >= 2025 ? 2 : 1;
            return `<th colspan="${extra}" style="text-align:center">${year}</th>`;
          }).join('')}
        </tr>
        <tr>
          ${years.map(year => {
            const parts = ['<th>Δ</th>'];
            if (year >= 2025) parts.push('<th>Δ Média Noite</th>');
            return parts.join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  monthLabels.forEach((label, monthIdx) => {
    html += `<tr><td>${label}</td>`;
    years.forEach((year, idx) => {
      const bg = colors[idx % colors.length];
      const tot123 = totals123[year]?.[monthIdx] ?? 0;
      const tot1248 = totals1248[year]?.[monthIdx] ?? 0;
      const media123 = nights123[year]?.[monthIdx] > 0 ? Math.round(tot123 / nights123[year][monthIdx]) : null;
      const media1248 = nights1248[year]?.[monthIdx] > 0 ? Math.round(tot1248 / nights1248[year][monthIdx]) : null;

      html += diffCell(tot123, tot1248, bg);
      if (year >= 2025) {
        html += diffMediaCell(media123, media1248, bg);
      }
    });
    html += '</tr>';
  });

  html += `<tr><td><strong>Total</strong></td>`;
  years.forEach((year, idx) => {
    const bg = colors[idx % colors.length];
    const total123 = totals123[year]?.reduce((sum, v) => sum + v, 0) ?? 0;
    const total1248 = totals1248[year]?.reduce((sum, v) => sum + v, 0) ?? 0;
    const mediaAnual123 = promedioAnual(totals123[year] || [], nights123[year] || []);
    const mediaAnual1248 = promedioAnual(totals1248[year] || [], nights1248[year] || []);

    html += diffCell(total123, total1248, bg);
    if (year >= 2025) {
      html += diffMediaCell(mediaAnual123, mediaAnual1248, bg);
    }
  });
  html += '</tr>';

  html += `<tr><td><strong>Média mensal</strong></td>`;
  years.forEach((year, idx) => {
    const bg = colors[idx % colors.length];
    const total123 = totals123[year]?.reduce((sum, v) => sum + v, 0) ?? 0;
    const total1248 = totals1248[year]?.reduce((sum, v) => sum + v, 0) ?? 0;
    html += diffCell(total123 / 12, total1248 / 12, bg);
    if (year >= 2025) {
      const med123 = promedioAnual(totals123[year] || [], nights123[year] || []);
      const med1248 = promedioAnual(totals1248[year] || [], nights1248[year] || []);
      html += diffMediaCell(med123, med1248, bg);
    }
  });
  html += '</tr></tbody></table>';

  container.innerHTML = html;
}

function promedioAnual(series, nightsSeries) {
  const medias = (series || [])
    .map((v, idx) => {
      const nights = nightsSeries?.[idx] || 0;
      return nights > 0 ? v / nights : null;
    })
    .filter(v => v != null);
  if (!medias.length) return null;
  return Math.round(medias.reduce((sum, v) => sum + v, 0) / medias.length);
}

function aggregateTotals(faturas, apartments = null) {
  const allow = apartments ? new Set(apartments.map(String)) : null;
  const totalsMap = new Map();
  const nightsMap = new Map();
  const useSplit = state.granularity === 'dia';

  const pushValue = (year, month, value, nightsInc = 0) => {
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return;
    addToBucket(totalsMap, year, month, value);
    if (nightsInc) addToBucket(nightsMap, year, month, nightsInc);
  };

  faturas.forEach(f => {
    if (allow && !allow.has(String(f.apartamento))) return;
    if (useSplit && distributeByDay(f, pushValue)) return;
    const year = Number(f.ano);
    const month = Number(f.mes);
    if (!year || !month) return;
    pushValue(year, month, valorFatura(f), Number(f.noites || 0));
  });

  const currentYear = new Date().getFullYear();
  const maxTotalsYear = totalsMap.size ? Math.max(...totalsMap.keys()) : BASE_YEAR;
  const maxNightsYear = nightsMap.size ? Math.max(...nightsMap.keys()) : BASE_YEAR;
  const limitYear = Math.max(currentYear, maxTotalsYear, maxNightsYear);
  const totals = {};
  const nights = {};
  const years = [];
  for (let year = BASE_YEAR; year <= limitYear; year++) {
    totals[year] = totalsMap.get(year) ? [...totalsMap.get(year)] : Array(12).fill(0);
    nights[year] = nightsMap.get(year) ? [...nightsMap.get(year)] : Array(12).fill(0);
    years.push(year);
  }
  return { totals, nights, years };
}

function distributeByDay(f, callback) {
  const nights = Number(f.noites || 0);
  if (!nights || nights <= 0) return false;
  if (typeof f.checkIn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) return false;

  const start = parseLocalDate(f.checkIn);
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
  if (start.getFullYear() < 2025) return false;

  const nightlyValue = valorFatura(f) / nights;
  for (let i = 0; i < nights; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    callback(date.getFullYear(), date.getMonth() + 1, nightlyValue, 1);
  }
  return true;
}

function addToBucket(map, year, month, amount) {
  if (!map.has(year)) map.set(year, Array(12).fill(0));
  map.get(year)[month - 1] += amount;
}

function determineTimelineEnd(totalsList) {
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const dataEnd = totalsList.reduce((end, totals) => {
    Object.entries(totals).forEach(([year, months]) => {
      months.forEach((value, idx) => {
        if (value > 0) {
          const y = Number(year);
          const m = idx + 1;
          if (y > end.year || (y === end.year && m > end.month)) {
            end = { year: y, month: m };
          }
        }
      });
    });
    return end;
  }, { year: BASE_YEAR, month: 1 });

  if (today.year > dataEnd.year || (today.year === dataEnd.year && today.month > dataEnd.month)) {
    return today;
  }
  return dataEnd;
}

function buildTimelineSequence(endYear, endMonth) {
  const sequence = [];
  for (let year = BASE_YEAR; year <= endYear; year++) {
    const monthEnd = year === endYear ? endMonth : 12;
    for (let month = 1; month <= monthEnd; month++) {
      sequence.push({ year, month });
    }
  }
  return sequence;
}

function resetChart() {
  if (!state.chart) return;
  destroyChartSafe(state.chart);
  state.chart = null;
}

function euroInt(value) {
  return formatEuro(value);
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

function addPressEffect(btn) {
  if (!btn) return;
  btn.classList.add('press');
  const timeout = reduceMotionQuery.matches ? 0 : 120;
  setTimeout(() => btn.classList.remove('press'), timeout);
}

function cleanupFaturacaoResources() {
  if (viewButtonsController) {
    viewButtonsController.abort();
    viewButtonsController = null;
  }
  if (chartTypeButtonsController) {
    chartTypeButtonsController.abort();
    chartTypeButtonsController = null;
  }
  if (granularityButtonsController) {
    granularityButtonsController.abort();
    granularityButtonsController = null;
  }
  resetChart();
}

function temporarilyDisable(btn, delay) {
  if (!btn) return;
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, delay || 240);
}

const mqMobile = window.matchMedia('(max-width: 1024px)');
function attachMobileXAxisRotation(chart) {
  if (!chart) return;
  const apply = () => {
    const isMobile = mqMobile.matches;
    const x = chart.options.scales?.x || (chart.options.scales.x = {});
    const ticks = x.ticks || (x.ticks = {});
    ticks.autoSkip = !isMobile;
    ticks.maxRotation = isMobile ? 90 : 0;
    ticks.minRotation = isMobile ? 90 : 0;
    ticks.padding = 4;
    chart.update('none');
  };
  apply();
  mqMobile.addEventListener?.('change', apply);
  mqMobile.addListener?.(apply);
}

function bindExportButton() {
  const button = document.querySelector('[data-export-target="faturacao"]');
  if (!button) return;
  button.addEventListener('click', () => exportFaturacaoTable(button));
}

async function exportFaturacaoTable(button) {
  const tableContainer = document.querySelector('#tabela-faturacao-v2');
  if (!tableContainer) return;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'A gerar…';
    }

    await ensureFaturacaoExportLibs();
    const doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Title based on current view
    const viewLabels = {
      total: 'Total (123 + 1248)',
      '123': 'Apartamento 123',
      '1248': 'Apartamento 1248',
      compare: 'Comparação 123 vs 1248'
    };

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Faturação - ${viewLabels[state.view]}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    const today = new Date().toLocaleDateString('pt-PT');
    doc.text(`Relatório de ${today}`, margin, yPos);
    yPos += 8;

    // Get table HTML
    const table = tableContainer.querySelector('table');
    if (!table) {
      throw new Error('Tabela não encontrada');
    }

    // Convert table to PDF using autoTable
    doc.autoTable({
      html: table,
      startY: yPos,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
      styles: {
        fontSize: 9,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [54, 83, 145],
        textColor: 255,
        fontStyle: 'bold'
      },
      bodyStyles: {
        textColor: 50
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      didDrawPage: (data) => {
        // Add page number
        const pageSize = doc.internal.pageSize;
        const pageCount = doc.internal.getNumberOfPages();
        const pageNum = data.pageNumber;
        if (pageCount > 1) {
          doc.setFontSize(8);
          doc.text(`Página ${pageNum}/${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
        }
      }
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const viewName = state.view === 'compare' ? '123vs1248' : state.view;
    doc.save(`export-faturacao-${viewName}-${stamp}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar faturação', error);
    if (button) button.textContent = 'Erro';
    setTimeout(() => {
      if (button) button.textContent = 'Exportar';
    }, 2000);
    return;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Exportar';
    }
  }
}

async function ensureFaturacaoExportLibs() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    const module = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (module?.jspdf) window.jspdf = module.jspdf;
  }
  
  // Load autoTable plugin
  if (!window.jspdf.jsPDF.prototype.autoTable) {
    await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.41/jspdf.plugin.autotable.min.js');
  }
}
