import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { VIEW_APTS, MONTH_LABELS, formatEuro } from './analisev2-core.js';
const YEAR_START = 2024;
const YEAR_BG = ['#fbfbff', '#d9f4e2ff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

const state = {
  view: 'total',
  rows: []
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="taxa-limpeza"]')) return;
  bindButtons();
  await loadData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'taxa-limpeza') loadData();
});

function bindButtons() {
  document.querySelectorAll('[data-limpeza-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.limpezaView;
      if (!next || next === state.view) return;
      state.view = next;
      updateButtons();
      render();
    });
  });
  updateButtons();
}

function updateButtons() {
  document.querySelectorAll('[data-limpeza-view]').forEach((btn) => {
    const active = btn.dataset.limpezaView === state.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadData() {
  window.loadingManager?.show('taxa-limpeza', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    state.rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!state.rows.length) {
      renderTable('<div class="heatmap-muted">Sem dados disponíveis.</div>');
    } else {
      render();
    }
  } catch (error) {
    window.errorHandler?.handleError('taxa-limpeza', error, 'loadData', loadData);
    state.rows = [];
    renderTable('<div class="heatmap-muted">Sem dados disponíveis.</div>');
  } finally {
    window.loadingManager?.hide('taxa-limpeza');
  }
}

function render() {
  const rows = filterRows(VIEW_APTS[state.view]);
  if (!rows.length) {
    renderTable('<div class="heatmap-muted">Sem dados para esta vista.</div>');
    return;
  }

  const tableHtml = buildTable(rows);
  renderTable(tableHtml);
}

function filterRows(allowed) {
  if (!allowed || !allowed.length) return [];
  const allowSet = new Set(allowed.map(String));
  return state.rows.filter((row) => allowSet.has(String(row.apartamento)));
}

function buildTable(rows) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = YEAR_START; year <= currentYear; year++) years.push(year);

  const map = years.reduce((acc, year) => {
    acc[year] = Array.from({ length: 12 }, () => ({ n: 0, total: 0 }));
    return acc;
  }, {});

  rows.forEach((row) => {
    const year = Number(row.ano);
    const month = Number(row.mes);
    if (!map[year] || !month || month < 1 || month > 12) return;
    const value = Number(row.taxaLimpeza || 0);
    if (value <= 0) return;
    const slot = map[year][month - 1];
    slot.n += 1;
    slot.total += value;
  });

  const yearsWithData = years.filter((year) =>
    map[year].some((m) => m.n > 0 || m.total > 0)
  );
  if (!yearsWithData.length) return '<div class="heatmap-muted">Sem dados suficientes.</div>';

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${yearsWithData.map((year) => `<th colspan="2">${year}</th>`).join('')}
        </tr>
        <tr>
          ${yearsWithData.map(() => '<th>N.</th><th>Total</th>').join('')}
        </tr>
      </thead>
      <tbody>
  `;

  MONTH_LABELS.forEach((label, monthIdx) => {
    html += `<tr><td>${label}</td>`;
    yearsWithData.forEach((year, idx) => {
      const data = map[year][monthIdx];
      const bg = YEAR_BG[idx % YEAR_BG.length];
      html += `<td style="background:${bg};text-align:center">${data.n}</td>`;
      html += `<td style="background:${bg};text-align:center">${formatEuro(data.total)}</td>`;
    });
    html += '</tr>';
  });

  html += '<tr><td><strong>Total</strong></td>';
  yearsWithData.forEach((year, idx) => {
    const totalN = map[year].reduce((sum, m) => sum + m.n, 0);
    const totalV = map[year].reduce((sum, m) => sum + m.total, 0);
    const bg = YEAR_BG[idx % YEAR_BG.length];
    html += `<td style="background:${bg};text-align:center"><strong>${totalN}</strong></td>`;
    html += `<td style="background:${bg};text-align:center"><strong>${formatEuro(totalV)}</strong></td>`;
  });
  html += '</tr>';

  html += '</tbody></table>';
  return html;
}

function renderTable(html) {
  const container = document.getElementById('taxa-limpeza-table');
  if (container) container.innerHTML = html;
}
