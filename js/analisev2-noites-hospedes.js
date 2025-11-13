import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { VIEW_APTS, MONTH_LABELS, formatEuro } from './analisev2-core.js';
const NIGHT_BUCKETS = ['2','3','4','5','6','7','≥8'];
const HOSP_BUCKETS = [1,2,3,4,5,6,7,8];
const NIGHT_BASE_YEAR = 2025;
const HOSP_BASE_YEAR = 2025;

const state = {
  view: 'total',
  rows: [],
  table: 'noites'
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="noites-hospedes"]')) return;
  bindButtons();
  await loadRows();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'noites-hospedes') loadRows();
});

function bindButtons() {
  document.querySelectorAll('[data-nohosp-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.nohospView;
      if (!next || next === state.view) return;
      state.view = next;
      updateButtons();
      render();
    });
  });
  updateButtons();

  document.querySelectorAll('[data-table-select]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const table = btn.dataset.tableSelect;
      if (!table || table === state.table) return;
      state.table = table;
      updateTableSelector();
      toggleTables();
    });
  });
  updateTableSelector();
}

function updateButtons() {
  document.querySelectorAll('[data-nohosp-view]').forEach((btn) => {
    const isActive = btn.dataset.nohospView === state.view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateTableSelector() {
  document.querySelectorAll('[data-table-select]').forEach((btn) => {
    const active = btn.dataset.tableSelect === state.table;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadRows() {
  window.loadingManager?.show('noites-hospedes', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    state.rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!state.rows.length) {
      const msg = '<div class="heatmap-muted">Sem dados disponíveis.</div>';
      renderNoites(msg);
      renderHospedes(msg);
    } else {
      render();
    }
  } catch (error) {
    window.errorHandler?.handleError('noites-hospedes', error, 'loadRows', loadRows);
    state.rows = [];
    const msg = '<div class="heatmap-muted">Sem dados disponíveis.</div>';
    renderNoites(msg);
    renderHospedes(msg);
  } finally {
    window.loadingManager?.hide('noites-hospedes');
  }
}

function render() {
  const rows = filterRows(VIEW_APTS[state.view]);
  if (!rows.length) {
    const msg = '<div class="heatmap-muted">Sem dados para esta vista.</div>';
    renderNoites(msg);
    renderHospedes(msg);
    return;
  }

  renderNoites(buildNoitesTable(rows));
  renderHospedes(buildHospedesTable(rows));
  toggleTables();
}

function toggleTables() {
  const noites = document.getElementById('tabela-noites-combo');
  const hospedes = document.getElementById('tabela-hospedes-combo');
  if (noites) noites.style.display = state.table === 'noites' ? 'block' : 'none';
  if (hospedes) hospedes.style.display = state.table === 'hospedes' ? 'block' : 'none';
}

function filterRows(apartments) {
  if (!apartments || !apartments.length) return [];
  const allow = new Set(apartments.map(String));
  return state.rows.filter((row) => allow.has(String(row.apartamento)));
}

function renderNoites(html) {
  const target = document.getElementById('tabela-noites-combo');
  if (target) target.innerHTML = html;
}

function renderHospedes(html) {
  const target = document.getElementById('tabela-hospedes-combo');
  if (target) target.innerHTML = html;
}

function buildNoitesTable(rows) {
  const currentYear = new Date().getFullYear();
  if (currentYear < NIGHT_BASE_YEAR) return '<div class="heatmap-muted">Sem dados suficientes.</div>';

  const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '≥8' : String(v);
  };

  const mapCurrent = Array.from({ length: 12 }, () =>
    Object.fromEntries(NIGHT_BUCKETS.map((b) => [b, 0]))
  );

  rows.forEach((row) => {
    const year = Number(row.ano);
    const month = Number(row.mes);
    if (year !== currentYear || year < NIGHT_BASE_YEAR) return;
    if (!month || month < 1 || month > 12) return;
    const cat = bucket(row.noites);
    if (!cat) return;
    mapCurrent[month - 1][cat] += 1;
  });

  const totalsCurrent = Object.fromEntries(NIGHT_BUCKETS.map((b) => [b, 0]));
  let sumCurrent = 0;
  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th>Mês</th>
          ${NIGHT_BUCKETS.map((b) => `<th>${b} noites</th>`).join('')}
          <th>Total mês</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (currentYear >= NIGHT_BASE_YEAR) {
    MONTH_LABELS.forEach((label, idx) => {
      const rowData = mapCurrent[idx];
      const rowTotal = NIGHT_BUCKETS.reduce((sum, key) => sum + rowData[key], 0);
      sumCurrent += rowTotal;
      NIGHT_BUCKETS.forEach((key) => (totalsCurrent[key] += rowData[key]));

      html += `
        <tr>
          <td>${label}</td>
          ${NIGHT_BUCKETS.map((key) => `<td>${rowData[key]}</td>`).join('')}
          <td><strong>${rowTotal}</strong></td>
        </tr>
      `;
    });

    html += `
      <tr>
        <td><strong>Total ${currentYear}</strong></td>
        ${NIGHT_BUCKETS.map((key) => `<td><strong>${totalsCurrent[key]}</strong></td>`).join('')}
        <td><strong>${sumCurrent}</strong></td>
      </tr>
    `;

    if (sumCurrent > 0) {
      const pctValues = NIGHT_BUCKETS.map((key) => ((totalsCurrent[key] || 0) / sumCurrent) * 100);
      const maxPct = Math.max(...pctValues);
      const minPct = Math.min(...pctValues);
      html += '<tr><td><strong>%</strong></td>';
      pctValues.forEach((pct) => {
        const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
        const color = pctGradient(pct, minPct, maxPct);
        html += `<td class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
      });
      html += '<td class="pct-cell"><strong>100%</strong></td></tr>';
    }
  }

  const previousYears = Array.from(new Set(
    rows.map((row) => Number(row.ano))
  ))
    .filter((year) => year >= NIGHT_BASE_YEAR && year < currentYear)
    .sort((a, b) => b - a);

  previousYears.forEach((year) => {
    const totals = Object.fromEntries(NIGHT_BUCKETS.map((b) => [b, 0]));
    let totalYear = 0;

    rows.forEach((row) => {
      if (Number(row.ano) !== year) return;
      const cat = bucket(row.noites);
      if (!cat) return;
      totals[cat] += 1;
      totalYear += 1;
    });

    html += `
      <tr style="background-color:#f2f2f2;">
        <td><strong>Total ${year}</strong></td>
        ${NIGHT_BUCKETS.map((key) => `<td><strong>${totals[key]}</strong></td>`).join('')}
        <td><strong>${totalYear}</strong></td>
      </tr>
    `;

    if (totalYear > 0) {
      const pctValues = NIGHT_BUCKETS.map((key) => ((totals[key] || 0) / totalYear) * 100);
      const maxPct = Math.max(...pctValues);
      const minPct = Math.min(...pctValues);
      html += '<tr style="background-color:#f2f2f2;"><td><strong>%</strong></td>';
      pctValues.forEach((pct) => {
        const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
        const color = pctGradient(pct, minPct, maxPct);
        html += `<td class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
      });
      html += '<td class="pct-cell"><strong>100%</strong></td></tr>';
    }
  });

  html += '</tbody></table>';
  return html;
}

function buildHospedesTable(rows) {
  const currentYear = new Date().getFullYear();
  if (currentYear < HOSP_BASE_YEAR) return '<div class="heatmap-muted">Sem dados suficientes.</div>';

  const extraValue = (year, month, guests, nights) => {
    if (year < 2025) return 0;
    if (year === 2025 && month < 6) return 0;
    const g = Number(guests) || 0;
    const n = Number(nights) || 0;
    if (g <= 6 || n <= 0) return 0;
    return (g - 6) * 20 * n;
  };

  const clampGuests = (row) => {
    const adults = Number(row.hospedesAdultos || 0);
    const kids = Number(row.hospedesCriancas || 0);
    const sum = Math.max(1, Math.min(8, adults + kids));
    return sum;
  };

  const mapCurrent = Array.from({ length: 12 }, () =>
    Object.fromEntries(HOSP_BUCKETS.map((h) => [h, { n: 0, v: 0 }]))
  );

  rows.forEach((row) => {
    const year = Number(row.ano);
    const month = Number(row.mes);
    if (year !== currentYear || year < HOSP_BASE_YEAR) return;
    if (!month || month < 1 || month > 12) return;

    const guests = clampGuests(row);
    const value = extraValue(year, month, guests, row.noites);
    mapCurrent[month - 1][guests].n += 1;
    mapCurrent[month - 1][guests].v += value;
  });

  const totalsByGuests = Object.fromEntries(HOSP_BUCKETS.map((h) => [h, { n: 0, v: 0 }]));
  const totalsOverall = { n: 0, v: 0 };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${HOSP_BUCKETS.map((h) => `<th colspan="2">${h} Hósp.</th>`).join('')}
          <th colspan="2">Total</th>
        </tr>
        <tr>
          ${HOSP_BUCKETS.map(() => '<th>N.</th><th>V</th>').join('')}
          <th>N.</th><th>V</th>
        </tr>
      </thead>
      <tbody>
  `;

  MONTH_LABELS.forEach((label, idx) => {
    let rowTotalN = 0;
    let rowTotalV = 0;
    html += `<tr><td>${label}</td>`;
    HOSP_BUCKETS.forEach((bucket) => {
      const entry = mapCurrent[idx][bucket];
      const showValue = bucket <= 6 ? '' : formatEuro(entry.v);
      html += `<td style="text-align:center">${entry.n}</td><td style="text-align:center">${showValue}</td>`;
      totalsByGuests[bucket].n += entry.n;
      totalsByGuests[bucket].v += entry.v;
      rowTotalN += entry.n;
      rowTotalV += entry.v;
    });
    totalsOverall.n += rowTotalN;
    totalsOverall.v += rowTotalV;
    html += `<td style="text-align:center"><strong>${rowTotalN}</strong></td><td style="text-align:center"><strong>${formatEuro(rowTotalV)}</strong></td></tr>`;
  });

  html += `
    <tr>
      <td><strong>Total ${currentYear}</strong></td>
      ${HOSP_BUCKETS.map((bucket) => {
        const entry = totalsByGuests[bucket];
        const showValue = bucket <= 6 ? '' : formatEuro(entry.v);
        return `<td style="text-align:center"><strong>${entry.n}</strong></td><td style="text-align:center"><strong>${showValue}</strong></td>`;
      }).join('')}
      <td style="text-align:center"><strong>${totalsOverall.n}</strong></td>
      <td style="text-align:center"><strong>${formatEuro(totalsOverall.v)}</strong></td>
    </tr>
  `;

  if (totalsOverall.n > 0) {
    const pctValues = HOSP_BUCKETS.map((bucket) => (totalsByGuests[bucket].n / totalsOverall.n) * 100);
    const maxPct = Math.max(...pctValues);
    const minPct = Math.min(...pctValues);
    html += '<tr><td><strong>%</strong></td>';
    pctValues.forEach((pct) => {
      const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
      const color = pctGradient(pct, minPct, maxPct);
      html += `<td colspan="2" class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
    });
    html += '<td colspan="2" class="pct-cell"><strong>100%</strong></td></tr>';
  }

  const previousYears = Array.from(new Set(
    rows.map((row) => Number(row.ano))
  ))
    .filter((year) => year >= HOSP_BASE_YEAR && year < currentYear)
    .sort((a, b) => b - a);

  previousYears.forEach((year) => {
    const totals = Object.fromEntries(HOSP_BUCKETS.map((h) => [h, { n: 0, v: 0 }]));
    let sumN = 0;
    let sumV = 0;

    rows.forEach((row) => {
      if (Number(row.ano) !== year) return;
      const month = Number(row.mes);
      if (!month || month < 1 || month > 12) return;
      const guests = clampGuests(row);
      const value = extraValue(year, month, guests, row.noites);
      totals[guests].n += 1;
      totals[guests].v += value;
      sumN += 1;
      sumV += value;
    });

    html += `<tr style="background-color:#f2f2f2;">
      <td><strong>Total ${year}</strong></td>
      ${HOSP_BUCKETS.map((bucket) => {
        const entry = totals[bucket];
        const showValue = bucket <= 6 ? '' : formatEuro(entry.v);
        return `<td style="text-align:center"><strong>${entry.n}</strong></td><td style="text-align:center"><strong>${showValue}</strong></td>`;
      }).join('')}
      <td style="text-align:center"><strong>${sumN}</strong></td>
      <td style="text-align:center"><strong>${formatEuro(sumV)}</strong></td>
    </tr>`;

    if (sumN > 0) {
      const pctValues = HOSP_BUCKETS.map((bucket) => (totals[bucket].n / sumN) * 100);
      const maxPct = Math.max(...pctValues);
      const minPct = Math.min(...pctValues);
      html += `<tr style="background-color:#f2f2f2;">
        <td><strong>%</strong></td>
        ${pctValues.map((pct) => {
          const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
          const color = pctGradient(pct, minPct, maxPct);
          return `<td colspan="2" class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
        }).join('')}
        <td colspan="2" class="pct-cell"><strong>100%</strong></td>
      </tr>`;
    }
  });

  html += '</tbody></table>';
  return html;
}

function pctGradient(value, min, max) {
  if (!Number.isFinite(value)) return '#e2e8f0';
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-6) {
    return '#d1fae5';
  }
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const t = (clamp(value) - min) / (max - min);
  const lerp = (a, b, k) => Math.round(a + (b - a) * k);
  const green = [22, 163, 74];
  const red = [220, 38, 38];
  const r = lerp(green[0], red[0], t);
  const g = lerp(green[1], red[1], t);
  const b = lerp(green[2], red[2], t);
  return `rgb(${r}, ${g}, ${b})`;
}
