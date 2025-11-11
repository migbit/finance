import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const VIEW_APTS = {
  total: ['123', '1248'],
  '123': ['123'],
  '1248': ['1248']
};

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const containerId = 'heatmap-variacao-analisev2';

const state = {
  view: 'total',
  rows: []
};

document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('[data-module="heatmap"]')) return;
  bindHeatmapButtons();
  initHeatmap();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'heatmap') initHeatmap();
});

function bindHeatmapButtons() {
  document.querySelectorAll('[data-heatmap-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.heatmapView;
      if (!next || next === state.view) return;
      state.view = next;
      updateHeatmapButtons();
      renderHeatmap(filterRows());
    });
  });
  updateHeatmapButtons();
}

function updateHeatmapButtons() {
  document.querySelectorAll('[data-heatmap-view]').forEach((btn) => {
    const isActive = btn.dataset.heatmapView === state.view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

async function initHeatmap() {
  window.loadingManager?.show('heatmap', { type: 'skeleton' });
  try {
    state.rows = await loadHeatmapData();
    renderHeatmap(filterRows());
  } catch (error) {
    window.errorHandler?.handleError('heatmap', error, 'initHeatmap', initHeatmap);
    setHeatmapContent('<div class="heatmap-wrap"><div class="heatmap-muted">Erro ao carregar dados.</div></div>');
  } finally {
    window.loadingManager?.hide('heatmap');
  }
}

async function loadHeatmapData() {
  const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function filterRows() {
  const allowed = VIEW_APTS[state.view] || VIEW_APTS.total;
  const set = new Set((allowed || []).map(String));
  return state.rows.filter((row) => set.has(String(row.apartamento)));
}

function renderHeatmap(rows) {
  const totals = {};
  rows.forEach(row => {
    const ano = Number(row.ano);
    const mes = Number(row.mes);
    if (!ano || !mes || mes < 1 || mes > 12) return;
    const valor = Number(row.valorTransferencia || 0) + Number(row.taxaAirbnb || 0);
    if (!totals[ano]) totals[ano] = {};
    totals[ano][mes] = (totals[ano][mes] || 0) + valor;
  });

  const years = Object.keys(totals).map(Number).sort((a, b) => a - b);
  const validYears = years.filter(year => totals[year - 1]);
  if (!validYears.length) {
    setHeatmapContent('<div class="heatmap-wrap"><div class="heatmap-muted">Sem base do ano anterior para calcular variação.</div></div>');
    return;
  }

  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth() + 1;

  let html = `
    <div class="heatmap-wrap">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th>Mês \\ Ano</th>
            ${validYears.map(year => `<th>${year}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (let month = 1; month <= 12; month++) {
    html += `<tr><th>${MONTH_LABELS[month - 1]}</th>`;
    validYears.forEach(year => {
      if (year === currYear && month > currMonth) {
        html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
        return;
      }
      const prev = totals[year - 1]?.[month] ?? null;
      const curr = totals[year]?.[month] ?? null;
      const pct = computeDelta(prev, curr);
      if (pct === null) {
        html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
      } else {
        const bg = pctToColor(pct);
        const fg = idealTextOn(bg);
        html += `<td class="heatmap-cell" style="background:${bg};color:${fg}">${formatPct(pct)}</td>`;
      }
    });
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  setHeatmapContent(html);
}

function computeDelta(prev, curr) {
  if (prev === null || typeof prev === 'undefined') return null;
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0 && curr !== 0) return null;
  if (typeof curr !== 'number') return null;
  return (curr - prev) / prev;
}

function pctToColor(value) {
  if (value === null) return '#f5f5f5';
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const pct = clamp(value, -1, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const toHex = (num) => num.toString(16).padStart(2, '0');
  const makeColor = (r, g, b) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  const NEG = [139, 0, 0];
  const MID = [236, 236, 236];
  const POS = [40, 167, 69];

  let c;
  if (pct <= 0) {
    const k = Math.pow((pct + 1) / 1, 0.65);
    c = [lerp(NEG[0], MID[0], k), lerp(NEG[1], MID[1], k), lerp(NEG[2], MID[2], k)];
  } else {
    const k = Math.pow(pct / 1, 0.9);
    c = [lerp(MID[0], POS[0], k), lerp(MID[1], POS[1], k), lerp(MID[2], POS[2], k)];
  }
  return makeColor(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]));
}

function idealTextOn(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 160 ? '#fff' : '#111';
}

function formatPct(value) {
  const pct = (value * 100);
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function setHeatmapContent(html) {
  const target = document.getElementById(containerId);
  if (target) target.innerHTML = html;
}
