import { formatEuro, MONTH_LABELS, parseLocalDate, VIEW_APTS } from './analisev2-core.js';
import { getFaturas } from './analisev3-data.js';
import { bucketLeadTimes } from './analisev3-metrics.js';

const APARTMENT_TOTAL = Array.isArray(VIEW_APTS?.total) ? VIEW_APTS.total : ['123', '1248'];
const APARTMENT_123 = Array.isArray(VIEW_APTS?.['123']) ? VIEW_APTS['123'] : ['123'];
const APARTMENT_1248 = Array.isArray(VIEW_APTS?.['1248']) ? VIEW_APTS['1248'] : ['1248'];

const LEADTIME_VIEWS = Object.freeze({
  total: { label: 'Total', apartments: APARTMENT_TOTAL },
  '123': { label: 'Apt 123', apartments: APARTMENT_123 },
  '1248': { label: 'Apt 1248', apartments: APARTMENT_1248 }
});

const leadtimeState = {
  view: 'total',
  faturas: []
};

let leadtimeToolbarController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="leadtime"]')) return;
  bindLeadtimeToolbar();
  await loadLeadtimeData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'leadtime') loadLeadtimeData();
});

function bindLeadtimeToolbar() {
  if (leadtimeToolbarController) leadtimeToolbarController.abort();
  leadtimeToolbarController = new AbortController();
  const { signal } = leadtimeToolbarController;
  document.querySelectorAll('[data-leadtime-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.leadtimeView;
      if (!view || view === leadtimeState.view) return;
      leadtimeState.view = view;
      updateLeadtimeButtons();
      if (leadtimeState.faturas.length) renderLeadtime();
    }, { signal });
  });
  updateLeadtimeButtons();
}

function updateLeadtimeButtons() {
  document.querySelectorAll('[data-leadtime-view]').forEach((btn) => {
    const active = btn.dataset.leadtimeView === leadtimeState.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadLeadtimeData() {
  window.loadingManager?.show('leadtime', { type: 'skeleton' });
  try {
    leadtimeState.faturas = await getFaturas();
    renderLeadtime();
  } catch (error) {
    window.errorHandler?.handleError('leadtime', error, 'loadLeadtimeData', loadLeadtimeData);
    leadtimeState.faturas = [];
    setTable('<div class="heatmap-muted">Erro ao calcular lead time.</div>');
    setSummary('Sem dados.');
    setBooking('<div class="heatmap-muted">Sem dados de reservas.</div>');
  } finally {
    window.loadingManager?.hide('leadtime');
  }
}

function renderLeadtime() {
  const { apartments } = getLeadtimeViewMeta();
  const filtered = (leadtimeState.faturas || []).filter((f) => apartments.includes(String(f.apartamento ?? '')));

  if (!filtered.length) {
    setTable('<div class="heatmap-muted">Sem reservas nesta vista.</div>');
    setSummary('Sem dados disponíveis para estes apartamentos.');
    setBooking('<div class="heatmap-muted">Sem dados para construir o calendário.</div>');
    return;
  }

  const { rows, total } = bucketLeadTimes(filtered);
  renderBookingCalendar(filtered);

  if (!total) {
    setTable('<div class="heatmap-muted">Sem reservas com datas de reserva/check-in.</div>');
    setSummary('Ainda sem dados para lead time nesta vista.');
    return;
  }

  renderTable(rows);
  renderSummary(rows);
}

function renderTable(rows) {
  const leader = rows.reduce((best, row) => (row.count > (best?.count ?? 0) ? row : best), null);
  const leaderKey = leader && leader.count > 0 ? leader.key : null;
  const html = [`<table class="media-faturacao"><thead><tr><th>Lead time</th><th>Reservas</th><th>Preço médio</th><th>% do total</th></tr></thead><tbody>`];
  rows.forEach((row) => {
    const highlightClass = leaderKey && row.key === leaderKey ? ' class="leadtime-row-highlight"' : '';
    html.push(`<tr${highlightClass}>
      <td>${row.label}</td>
      <td>${row.count}</td>
      <td>${row.avgPrice ? formatEuro(row.avgPrice) : '—'}</td>
      <td>${row.pct.toFixed(1)}%</td>
    </tr>`);
  });
  html.push('</tbody></table>');
  setTable(html.join(''));
}

function renderSummary(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    setSummary('Sem dados de lead time nesta vista.');
    return;
  }

  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  if (!totalCount) {
    setSummary('Sem reservas com datas nesta vista.');
    return;
  }

  const hottest = rows.reduce((best, row) => (row.pct > best.pct ? row : best), rows[0]);
  const lastMinute = rows.find((row) => row.key === '0-7');
  const summaryParts = [];
  if (hottest && hottest.count > 0) {
    summaryParts.push(`${hottest.label} representa ${hottest.pct.toFixed(1)}% das reservas (${formatEuro(hottest.avgPrice)} médio).`);
  }
  if (lastMinute && lastMinute.pct >= 20) {
    summaryParts.push('Última hora acima de 20% → ajuste mínimos e reforçe preços dinâmicos.');
  }
  if (!summaryParts.length) summaryParts.push('Distribuição equilibrada de reservas ao longo das janelas.');
  setSummary(summaryParts.join(' '));
}

function setTable(html) {
  const el = document.getElementById('leadtime-table');
  if (el) el.innerHTML = html;
}

function setSummary(text) {
  const el = document.getElementById('leadtime-summary');
  if (el) el.textContent = text;
}

function setBooking(content) {
  const el = document.getElementById('leadtime-booking');
  if (el) el.innerHTML = content;
}

function getLeadtimeViewMeta() {
  return LEADTIME_VIEWS[leadtimeState.view] || LEADTIME_VIEWS.total;
}

function renderBookingCalendar(faturas) {
  if (!Array.isArray(faturas) || !faturas.length) {
    setBooking('<div class="heatmap-muted">Sem reservas com datas nesta vista.</div>');
    return;
  }

  const { rows, hasData, leaderMonth } = buildBookingRows(faturas);
  if (!hasData) {
    setBooking('<div class="heatmap-muted">Sem datas de reserva e check-in alinhadas nesta vista.</div>');
    return;
  }

  const { label } = getLeadtimeViewMeta();
  const cards = rows.map((row) => {
    const highlight = leaderMonth != null && row.monthIndex === leaderMonth
      ? ' leadtime-booking-card--leader'
      : '';
    const items = row.topBookings.length
      ? row.topBookings.map((entry, idx) => `
        <li>
          <span class="leadtime-booking-rank">#${idx + 1}</span>
          <span class="leadtime-booking-highlight">${entry.monthLabel}</span>
          <span class="leadtime-booking-sub">${entry.count} reservas · ${entry.pct.toFixed(0)}%</span>
        </li>
      `).join('')
      : '<li class="leadtime-booking-empty">Sem dados suficientes</li>';
    return `<div class="leadtime-booking-card${highlight}">
      <p class="leadtime-booking-month">${row.monthLabel}</p>
      <ol class="leadtime-booking-list">
        ${items}
      </ol>
    </div>`;
  });

  const rowsHtml = [];
  for (let i = 0; i < cards.length; i += 3) {
    rowsHtml.push(`<div class="leadtime-booking-row">${cards.slice(i, i + 3).join('')}</div>`);
  }

  setBooking(`
    <h5>Calendário de reservas · ${label}</h5>
    <div class="leadtime-booking-grid">
      ${rowsHtml.join('')}
    </div>
  `);
}

function buildBookingRows(faturas) {
  const matrix = Array.from({ length: 12 }, () => Array(12).fill(0));
  let hasData = false;

  faturas.forEach((fatura) => {
    const checkDate = parseLocalDate(fatura.checkIn);
    const bookingDate = parseLocalDate(fatura.dataReserva);
    if (!checkDate || !bookingDate) return;
    const stayMonth = checkDate.getMonth();
    const bookingMonth = bookingDate.getMonth();
    if (stayMonth < 0 || stayMonth > 11 || bookingMonth < 0 || bookingMonth > 11) return;
    matrix[stayMonth][bookingMonth] += 1;
    hasData = true;
  });

  let leader = null;
  const rows = MONTH_LABELS.map((label, monthIndex) => {
    const counts = matrix[monthIndex];
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (!total) {
      return { monthIndex, monthLabel: label, total: 0, topBookings: [] };
    }
    const sorted = counts
      .map((value, idx) => ({ idx, count: value }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ idx, count }) => ({
        monthIndex: idx,
        monthLabel: MONTH_LABELS[idx],
        count,
        pct: (count / total) * 100
      }));
    if (!leader || total > leader.total) {
      leader = { monthIndex, total };
    }
    return {
      monthIndex,
      monthLabel: label,
      total,
      topBookings: sorted
    };
  });

  return {
    rows,
    hasData,
    leaderMonth: leader && leader.total > 0 ? leader.monthIndex : null
  };
}
