import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const VIEW_APTS = {
  total: ['123', '1248'],
  '123': ['123'],
  '1248': ['1248']
};

const METRICS = {
  parcial: { labelId: 'label-parcial', textId: 'donut-parcial-text', canvasId: 'donut-parcial' },
  ate: { labelId: 'label-ateset', textId: 'donut-ateset-text', canvasId: 'donut-ateset' },
  vs: { labelId: 'label-vs', textId: 'donut-vs-text', canvasId: 'donut-vs' },
  avg: { labelId: 'label-avg', textId: 'donut-avg-text', canvasId: 'donut-avg' }
};

let currentView = 'total';
let faturasData = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="progresso"]')) return;

  bindFilterButtons();
  updateUpdatedAt(null);

  await loadFaturasData();
  if (!faturasData.length) {
    showEmptyState('Sem dados disponíveis');
    return;
  }

  updateProgressoCharts();
});

function bindFilterButtons() {
  document.querySelectorAll('[data-progress-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.progressView;
      if (!view || view === currentView) return;
      currentView = view;
      updateButtonState();
      updateProgressoCharts();
    });
  });

  updateButtonState();
}

async function loadFaturasData() {
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    faturasData = consolidarFaturas(raw).filter(f => VIEW_APTS.total.includes(String(f.apartamento)));
  } catch (error) {
    console.error('Erro ao carregar faturas:', error);
    faturasData = [];
  }
}

function updateProgressoCharts() {
  const filtered = getFilteredFaturas();
  if (!filtered.length) {
    showEmptyState('Sem dados para esta vista');
    return;
  }

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
  Object.values(METRICS).forEach(metric => {
    const textEl = document.getElementById(metric.textId);
    if (textEl) textEl.textContent = message;
    makeDonut(document.getElementById(metric.canvasId), 0);
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

function getFilteredFaturas() {
  const targets = VIEW_APTS[currentView] || VIEW_APTS.total;
  return faturasData.filter(f => targets.includes(String(f.apartamento)));
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

  makeDonut(document.getElementById(metric.canvasId), pct);
}

function somar(faturas, predicate) {
  return faturas.reduce((acc, f) => {
    if (!predicate(f)) return acc;
    return acc + valorFatura(f);
  }, 0);
}

function valorFatura(f) {
  return Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
}

function obterNomeMes(numeroMes) {
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const idx = Math.max(1, Math.min(12, Number(numeroMes))) - 1;
  return nomes[idx];
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

function formatEuro(value) {
  const num = Math.round(Number(value) || 0);
  return num.toLocaleString('pt-PT', { maximumFractionDigits: 0, useGrouping: true })
    .replace(/\./g, ' ') + ' €';
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

function consolidarFaturas(arr) {
  const buckets = new Map();
  for (const f of arr) {
    const key = `${f.ano}-${f.mes}-${String(f.apartamento)}`;
    const isDetailed =
      (typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) ||
      Number(f.noites || 0) > 0 ||
      f.tipo === 'reserva';

    if (!buckets.has(key)) buckets.set(key, { detailed: [], manual: [] });
    const bucket = buckets.get(key);
    (isDetailed ? bucket.detailed : bucket.manual).push(f);
  }

  const flattened = [];
  for (const { detailed, manual } of buckets.values()) {
    if (detailed.length) flattened.push(...detailed);
    else flattened.push(...manual);
  }

  return flattened;
}

const cssVar = (name, fallback) =>
  (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;

const centerText = {
  id: 'centerText',
  afterDraw(chart, args, opts) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const { left, right, top, bottom } = chartArea;
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    const txt = opts.text || '';
    if (!txt) return;
    ctx.save();
    ctx.fillStyle = opts.color || '#0f172a';
    ctx.font = '600 14px Montserrat, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
    ctx.restore();
  }
};

function makeDonut(canvas, percentSigned) {
  if (!canvas) return null;

  canvas.style.width = '160px';
  canvas.style.height = '160px';
  canvas.width = 160;
  canvas.height = 160;

  if (canvas._chart) {
    try { canvas._chart.destroy(); } catch (_) { /* noop */ }
  }

  const value = Math.max(0, Math.min(100, Math.abs(percentSigned)));
  const ring = percentSigned >= 0 ? cssVar('--ok', '#16a34a') : cssVar('--bad', '#e11d48');
  const formatted = value.toFixed(2);

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value, 100 - value],
        backgroundColor: [ring, '#eef2f7'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      devicePixelRatio: 1,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        centerText: {
          text: `${percentSigned > 0 ? '+' : ''}${formatted}%`,
          color: ring
        }
      },
      animation: false
    },
    plugins: [centerText]
  });

  canvas._chart = chart;
  return chart;
}
