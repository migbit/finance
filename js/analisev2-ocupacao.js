import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { parseLocalDate, consolidarFaturas, MONTH_LABELS, VIEW_APTS } from './analisev2-core.js';

const COLORS = {
  total: 'rgb(20, 78, 3)',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};

const monthLabels = MONTH_LABELS;
const MIN_OCCUPANCY_YEAR = 2025;

const state = {
  view: 'total',
  reservas: [],
  chart: null
};
let ocupacaoButtonsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="ocupacao"]')) return;
  bindOcupacaoButtons();
  await loadReservas();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'ocupacao') loadReservas();
});

window.addEventListener('beforeunload', cleanupOcupacaoResources);

function bindOcupacaoButtons() {
  if (ocupacaoButtonsController) ocupacaoButtonsController.abort();
  ocupacaoButtonsController = new AbortController();
  const { signal } = ocupacaoButtonsController;

  document.querySelectorAll('[data-ocupacao-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.ocupacaoView;
      if (!view || view === state.view) return;
      state.view = view;
      document.querySelectorAll('[data-ocupacao-view]').forEach(b => {
        const active = b.dataset.ocupacaoView === view;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderOcupacao();
    }, { signal });
  });
}

async function loadReservas() {
  window.loadingManager?.show('ocupacao', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.reservas = consolidarFaturas(raw);
    if (!state.reservas.length) {
      renderEmpty('Sem dados disponíveis.');
    } else {
      renderOcupacao();
    }
  } catch (error) {
    window.errorHandler?.handleError('ocupacao', error, 'loadReservas', loadReservas);
    state.reservas = [];
    renderEmpty('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('ocupacao');
  }
}

function renderOcupacao() {
  const rows = filterByApartments(state.reservas, VIEW_APTS[state.view]);
  if (!rows.length) {
    renderEmpty('Sem dados para esta vista.');
    return;
  }

  const ocupacao = aggregateOcupacao(rows, VIEW_APTS[state.view].length);
  const years = ocupacao.years;
  if (!years.length) {
    renderEmpty('Sem dados suficientes.');
    return;
  }
  const latestYear = years[years.length - 1];
  const prevYear = years.length > 1 ? years[years.length - 2] : null;
  renderOcupacaoChart(ocupacao, latestYear, prevYear);
}

function renderOcupacaoChart(agg, latestYear, prevYear) {
  resetChart();
  const canvas = document.getElementById('chart-ocupacao');
  if (!canvas) return;
  canvas.parentElement?.querySelector('.ocupacao-empty')?.remove();

  const datasets = [];
  if (prevYear) {
    datasets.push({
      label: `${prevYear}`,
      data: agg.percent[prevYear],
      borderColor: 'rgba(148,163,184,1)',
      backgroundColor: withAlpha('rgba(148,163,184,1)', 0.2),
      borderDash: [4,4],
      borderWidth: 1.5,
      tension: 0.25,
      pointRadius: 2,
      pointHoverRadius: 4
    });
  }
  datasets.push({
    label: `${latestYear}`,
    data: agg.percent[latestYear],
    borderColor: COLORS[state.view] || COLORS.total,
    backgroundColor: withAlpha(COLORS[state.view] || COLORS.total, 0.35),
    borderWidth: 1,
  tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5
  });

  const plugins = [];
  if (typeof ChartDataLabels !== 'undefined') {
    plugins.push(ChartDataLabels);
  }

  state.chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: monthLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (value) => `${Math.round(value)}%` },
          grid: { color: 'rgba(0,0,0,0.06)' },
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
            label: ctx => {
              const val = ctx.parsed.y;
              const rounded = Number.isFinite(val) ? Math.round(val) : 0;
              return `${ctx.dataset.label}: ${rounded}%`;
            }
          }
        },
        legend: { position: 'top' },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          color: '#111827',
          anchor: 'center',
          align: 'center',
          formatter: (value) => `${Math.round(value ?? 0)}%`,
          font: {
            weight: '600',
            size: 11
          },
          clip: false
        } : undefined
      }
    },
    plugins
  });
}

function aggregateOcupacao(rows, apartmentsCount) {
  const occupancy = {};
  const yearsSet = new Set();

  rows.forEach((row) => {
    const noites = Number(row.noites || 0);
    if (!noites) return;

    const slices = splitReserva(row);
    slices.forEach(({ year, month }) => {
      if (!year || year < MIN_OCCUPANCY_YEAR) return;
      if (!occupancy[year]) occupancy[year] = Array(12).fill(0);
      occupancy[year][month - 1] += 1;
      yearsSet.add(year);
    });
  });

  const percent = {};
  Array.from(yearsSet).sort((a, b) => a - b).forEach((year) => {
    percent[year] = occupancy[year].map((occupied, idx) => {
      const days = diasNoMes(year, idx + 1) * apartmentsCount;
      if (!days) return 0;
      return Math.min(100, (occupied * 100) / days);
    });
  });

  return { percent, years: Array.from(yearsSet).sort((a, b) => a - b) };
}

function splitReserva(reserva) {
  const noites = Number(reserva.noites || 0);
  const slices = [];
  if (typeof reserva.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reserva.checkIn)) {
    const start = parseLocalDate(reserva.checkIn);
    if (start instanceof Date && !Number.isNaN(start.getTime())) {
      for (let i = 0; i < noites; i++) {
        const day = new Date(start);
        day.setDate(day.getDate() + i);
        if (day.getFullYear() >= MIN_OCCUPANCY_YEAR) {
          slices.push({ year: day.getFullYear(), month: day.getMonth() + 1 });
        }
      }
      return slices;
    }
  }
  const ano = Number(reserva.ano);
  const mes = Number(reserva.mes);
  if (!ano || !mes || ano < MIN_OCCUPANCY_YEAR) return slices;
  const cap = diasNoMes(ano, mes);
  const nightsInMonth = Math.min(cap, noites);
  for (let i = 0; i < nightsInMonth; i++) {
    slices.push({ year: ano, month: mes });
  }
  return slices;
}

function filterByApartments(rows, apartments) {
  if (!apartments || !apartments.length) return [];
  const allow = new Set(apartments.map(String));
  return rows.filter(r => allow.has(String(r.apartamento)));
}

function diasNoMes(ano, mes) {
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return 30;
  const date = new Date(ano, mes, 0);
  if (Number.isNaN(date.getTime())) return 30;
  return date.getDate();
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

function resetChart() {
  if (!state.chart) return;
  try {
    state.chart.destroy();
  } catch (err) {
    console.warn('Chart destruction failed (ocupacao)', err);
    const canvas = state.chart.canvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } finally {
    state.chart = null;
  }
}

function renderEmpty(message) {
  resetChart();
  const canvas = document.getElementById('chart-ocupacao');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const wrap = document.createElement('div');
  if (canvas && canvas.parentElement) {
    canvas.parentElement.querySelector('.ocupacao-empty')?.remove();
    wrap.className = 'ocupacao-empty';
    wrap.style.textAlign = 'center';
    wrap.style.color = 'var(--text-dim)';
    wrap.textContent = message;
    canvas.parentElement.appendChild(wrap);
  }
}

function cleanupOcupacaoResources() {
  if (ocupacaoButtonsController) {
    ocupacaoButtonsController.abort();
    ocupacaoButtonsController = null;
  }
  resetChart();
}
