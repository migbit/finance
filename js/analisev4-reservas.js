import { MONTH_LABELS, VIEW_APTS, formatEuro, parseLocalDate } from './analisev2-core.js';
import { getFaturas, getNightlyEntries } from './analise-data.js';
import { bucketLeadTimes, computeWeekpartMetrics } from './analise-metrics.js';

const NIGHT_BUCKETS = ['2', '3', '4', '5', '6', '7', '≥8'];
const GUEST_BUCKETS = ['1', '2', '3', '4', '5', '6', '7', '8+'];
const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const TABLE_RENDERERS = {
  nights: renderNightsTable,
  guests: renderGuestsTable,
  leadtime: renderLeadtimeTable,
  weekpart: renderWeekpartTable,
  weekdays: renderWeekdaysTable,
  'booking-month': renderBookingMonthTable
};

const state = {
  view: 'total',
  year: String(new Date().getFullYear()),
  table: 'nights',
  rows: [],
  nightlyEntries: []
};

let controlsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="reservas-v4"]')) return;
  bindControls();
  await loadData();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'reservas-v4') loadData();
});

window.addEventListener('beforeunload', cleanup);

async function loadData() {
  window.loadingManager?.show('reservas-v4', { type: 'skeleton' });
  try {
    const [rows, nightlyEntries] = await Promise.all([
      getFaturas(),
      getNightlyEntries({ preciseOnly: true })
    ]);
    state.rows = rows;
    state.nightlyEntries = nightlyEntries;
    syncYearSelect();
    render();
    renderQualityDashboard();
  } catch (error) {
    state.rows = [];
    state.nightlyEntries = [];
    renderMessage('Sem dados disponíveis.');
    const qualityTarget = document.getElementById('qualidade-v4-content');
    const qualityCount = document.getElementById('qualidade-v4-count');
    const qualityToggle = document.getElementById('qualidade-v4-toggle');
    if (qualityTarget) {
      qualityTarget.hidden = false;
      qualityTarget.innerHTML = '<p class="faturacao-v4-empty">Não foi possível verificar os registos.</p>';
    }
    if (qualityCount) qualityCount.textContent = '—';
    if (qualityToggle) qualityToggle.hidden = true;
    window.errorHandler?.handleError('reservas-v4', error, 'loadData', loadData);
  } finally {
    window.loadingManager?.hide('reservas-v4');
  }
}

function bindControls() {
  controlsController?.abort();
  controlsController = new AbortController();
  const { signal } = controlsController;

  document.querySelectorAll('[data-reservas-v4-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.reservasV4View;
      if (!view || view === state.view) return;
      state.view = view;
      syncYearSelect();
      updateControls();
      render();
    }, { signal });
  });

  document.querySelectorAll('[data-reservas-v4-table]').forEach((button) => {
    button.addEventListener('click', () => {
      const table = button.dataset.reservasV4Table;
      if (!TABLE_RENDERERS[table] || table === state.table) return;
      state.table = table;
      updateControls();
      render();
    }, { signal });
  });

  document.getElementById('reservas-v4-year')?.addEventListener('change', (event) => {
    state.year = event.target.value || 'all';
    render();
  }, { signal });

  document.getElementById('reservas-v4-expand-table')?.addEventListener('click', (event) => {
    const wrap = document.querySelector('.reservas-v4-table-wrap');
    const expanded = !wrap?.classList.contains('is-expanded');
    wrap?.classList.toggle('is-expanded', expanded);
    document.body.classList.toggle('analisev4-table-open', expanded);
    event.currentTarget.classList.toggle('table-expand-btn-active', expanded);
    event.currentTarget.textContent = expanded ? 'Fechar largura total' : 'Ver em largura total';
    event.currentTarget.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }, { signal });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const button = document.getElementById('reservas-v4-expand-table');
    if (document.querySelector('.reservas-v4-table-wrap')?.classList.contains('is-expanded')) button?.click();
  }, { signal });

  document.getElementById('qualidade-v4-toggle')?.addEventListener('click', (event) => {
    const content = document.getElementById('qualidade-v4-content');
    if (!content) return;
    const expanded = content.hidden;
    content.hidden = !expanded;
    event.currentTarget.textContent = expanded ? 'Ocultar correções' : 'Ver correções';
    event.currentTarget.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }, { signal });
  updateControls();
}

function updateControls() {
  document.querySelectorAll('[data-reservas-v4-view]').forEach((button) => {
    const active = button.dataset.reservasV4View === state.view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-reservas-v4-table]').forEach((button) => {
    const active = button.dataset.reservasV4Table === state.table;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const yearSelect = document.getElementById('reservas-v4-year');
  if (yearSelect) yearSelect.value = state.year;
}

function syncYearSelect() {
  const select = document.getElementById('reservas-v4-year');
  if (!select) return;
  const apartments = VIEW_APTS[state.view] || VIEW_APTS.total;
  const allowed = new Set(apartments.map(String));
  const years = [...new Set(state.rows
    .filter((row) => allowed.has(String(row.apartamento ?? '')))
    .map((row) => analysisYear(row))
    .filter((year) => Number.isFinite(year) && year >= 2025)
  )].sort((a, b) => b - a);

  if (state.year !== 'all' && !years.includes(Number(state.year))) {
    const currentYear = new Date().getFullYear();
    state.year = String(years.includes(currentYear) ? currentYear : years[0] || 'all');
  }
  select.innerHTML = `
    <option value="all">Todos os anos</option>
    ${years.map((year) => `<option value="${year}">${year}</option>`).join('')}
  `;
  select.value = state.year;
}

function render() {
  const renderer = TABLE_RENDERERS[state.table];
  if (!renderer) return;
  const rows = filterRows(state.rows);
  const entries = filterRows(state.nightlyEntries);
  renderer(rows, entries);
}

function filterRows(rows) {
  const apartments = VIEW_APTS[state.view] || VIEW_APTS.total;
  const allowed = new Set(apartments.map(String));
  const today = new Date();
  return (rows || []).filter((row) => {
    const year = analysisYear(row);
    const date = analysisDate(row);
    return allowed.has(String(row.apartamento ?? row.apartment ?? ''))
      && year >= 2025
      && (state.year === 'all' || year === Number(state.year))
      && (!date || date <= today);
  });
}

function renderNightsTable(rows) {
  if (!rows.length) {
    renderMessage('Sem reservas com número de noites registado.');
    return;
  }

  const matrix = Array.from({ length: 12 }, () =>
    Object.fromEntries(NIGHT_BUCKETS.map((bucket) => [bucket, 0]))
  );
  rows.forEach((row) => {
    const month = analysisMonth(row);
    const bucket = nightBucket(row.noites);
    if (!isMonth(month) || !bucket) return;
    matrix[month - 1][bucket] += 1;
  });

  const totals = Object.fromEntries(NIGHT_BUCKETS.map((bucket) => [bucket, 0]));
  NIGHT_BUCKETS.forEach((bucket) => {
    totals[bucket] = matrix.reduce((sum, month) => sum + month[bucket], 0);
  });
  const dominantBucket = findDominantBucket(totals);
  const body = MONTH_LABELS.map((label, monthIdx) => {
    const total = NIGHT_BUCKETS.reduce((sum, bucket) => sum + matrix[monthIdx][bucket], 0);
    return `<tr><td>${label}</td>${NIGHT_BUCKETS.map((bucket) =>
      `<td class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}">${matrix[monthIdx][bucket]}</td>`).join('')}<td><strong>${total}</strong></td></tr>`;
  }).join('');
  const grandTotal = NIGHT_BUCKETS.reduce((sum, bucket) => sum + totals[bucket], 0);
  if (!grandTotal) {
    renderMessage('Sem reservas com número de noites registado.');
    return;
  }
  const totalRow = `<tr class="reservas-v4-total-row"><td><strong>${periodTotalLabel()}</strong></td>${
    NIGHT_BUCKETS.map((bucket) => `<td class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}"><strong>${totals[bucket]}</strong></td>`).join('')
  }<td><strong>${grandTotal}</strong></td></tr>`;
  const pctRow = grandTotal
    ? `<tr><td><strong>%</strong></td>${NIGHT_BUCKETS.map((bucket) =>
      `<td class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}"><strong>${formatPercent((totals[bucket] / grandTotal) * 100)}</strong></td>`).join('')
    }<td><strong>100%</strong></td></tr>`
    : '';

  renderTable(`
    <p class="reservas-v4-note">Distribuição mensal por duração · ${periodLabel()}.</p>
    <table class="media-faturacao reservas-v4-table">
      <thead><tr><th>Mês</th>${NIGHT_BUCKETS.map((bucket) =>
        `<th class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}">${bucket} noites</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${body}${totalRow}${pctRow}</tbody>
    </table>
  `);
}

function renderGuestsTable(rows) {
  if (!rows.length) {
    renderMessage('Sem reservas com hóspedes registados.');
    return;
  }

  const matrix = Array.from({ length: 12 }, () =>
    Object.fromEntries(GUEST_BUCKETS.map((bucket) => [bucket, 0]))
  );
  rows.forEach((row) => {
    const month = analysisMonth(row);
    const bucket = guestBucket(row);
    if (!isMonth(month)) return;
    if (!bucket) return;
    matrix[month - 1][bucket] += 1;
  });

  const totals = Object.fromEntries(GUEST_BUCKETS.map((bucket) => [bucket, 0]));
  GUEST_BUCKETS.forEach((bucket) => {
    totals[bucket] = matrix.reduce((sum, month) => sum + month[bucket], 0);
  });
  const dominantBucket = findDominantBucket(totals);
  const body = MONTH_LABELS.map((label, monthIdx) => {
    const total = GUEST_BUCKETS.reduce((sum, bucket) => sum + matrix[monthIdx][bucket], 0);
    return `<tr><td>${label}</td>${GUEST_BUCKETS.map((bucket) =>
      `<td class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}">${matrix[monthIdx][bucket]}</td>`).join('')}<td><strong>${total}</strong></td></tr>`;
  }).join('');
  const grandTotal = GUEST_BUCKETS.reduce((sum, bucket) => sum + totals[bucket], 0);
  if (!grandTotal) {
    renderMessage('Sem reservas com hóspedes registados.');
    return;
  }
  const totalRow = `<tr class="reservas-v4-total-row"><td><strong>${periodTotalLabel()}</strong></td>${
    GUEST_BUCKETS.map((bucket) => `<td class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}"><strong>${totals[bucket]}</strong></td>`).join('')
  }<td><strong>${grandTotal}</strong></td></tr>`;
  const pctRow = grandTotal
    ? `<tr><td><strong>%</strong></td>${GUEST_BUCKETS.map((bucket) =>
      `<td class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}"><strong>${formatPercent((totals[bucket] / grandTotal) * 100)}</strong></td>`).join('')
    }<td><strong>100%</strong></td></tr>`
    : '';

  renderTable(`
    <p class="reservas-v4-note">Distribuição mensal por número de hóspedes · ${periodLabel()}.</p>
    <table class="media-faturacao reservas-v4-table">
      <thead><tr><th>Mês</th>${GUEST_BUCKETS.map((bucket) =>
        `<th class="${bucket === dominantBucket ? 'reservas-v4-highlight' : ''}">${bucket} hósp.</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${body}${totalRow}${pctRow}</tbody>
    </table>
  `);
}

function renderLeadtimeTable(rows) {
  const result = bucketLeadTimes(rows);
  if (!result.total) {
    renderMessage('Sem reservas com datas de reserva e check-in.');
    return;
  }
  const maxReservations = Math.max(...result.rows.map((row) => row.count));
  const body = result.rows.map((row) => `
    <tr class="${row.count === maxReservations && maxReservations > 0 ? 'reservas-v4-highlight' : ''}">
      <td>${row.label}</td>
      <td>${row.count}</td>
      <td>${row.avgPrice ? formatEuro(row.avgPrice) : '—'}</td>
      <td>${formatPercent(row.pct)}</td>
    </tr>
  `).join('');
  renderTable(`
    <p class="reservas-v4-note">Antecedência entre a data da reserva e o check-in · ${periodLabel()}.</p>
    <table class="media-faturacao reservas-v4-table">
      <thead><tr><th>Antecedência</th><th>Reservas</th><th>Preço/noite</th><th>% do total</th></tr></thead>
      <tbody>${body}<tr class="reservas-v4-total-row"><td><strong>Total</strong></td><td><strong>${result.total}</strong></td><td>—</td><td><strong>100%</strong></td></tr></tbody>
    </table>
  `);
}

function renderWeekpartTable(rows, entries) {
  const apartments = VIEW_APTS[state.view] || VIEW_APTS.total;
  const years = [...new Set(rows.map((row) => analysisYear(row)).filter((year) => year >= 2025))];
  const metrics = computeWeekpartMetrics(entries, { apartments, years });
  if (!metrics) {
    renderMessage('Sem datas precisas suficientes para comparar os dias.');
    return;
  }
  const priceDiff = metrics.weekendPrice - metrics.weekdayPrice;
  const occupancyDiff = metrics.weekendOcc - metrics.weekdayOcc;
  renderTable(`
    <p class="reservas-v4-note">Preço e ocupação das noites de sexta/sábado face aos restantes dias · ${periodLabel()}.</p>
    <table class="media-faturacao reservas-v4-table">
      <thead><tr><th>Métrica</th><th>Dias úteis</th><th>Fim de semana</th><th>Diferença</th></tr></thead>
      <tbody>
        <tr><td>Preço médio</td><td>${formatEuro(metrics.weekdayPrice)}</td><td>${formatEuro(metrics.weekendPrice)}</td><td>${formatSignedEuro(priceDiff)}</td></tr>
        <tr><td>Ocupação</td><td>${formatPercent(metrics.weekdayOcc)}</td><td>${formatPercent(metrics.weekendOcc)}</td><td>${formatSignedPoints(occupancyDiff)}</td></tr>
        <tr class="reservas-v4-total-row"><td><strong>Prémio de fim de semana</strong></td><td>—</td><td><strong>${formatSignedPercent(metrics.premium)}</strong></td><td>—</td></tr>
      </tbody>
    </table>
  `);
}

function renderWeekdaysTable(rows) {
  const checkins = Array(7).fill(0);
  const bookings = Array(7).fill(0);
  rows.forEach((row) => {
    addWeekdayCount(checkins, row.checkIn);
    addWeekdayCount(bookings, row.dataReserva);
  });
  const totalCheckins = checkins.reduce((sum, value) => sum + value, 0);
  const totalBookings = bookings.reduce((sum, value) => sum + value, 0);
  if (!totalCheckins && !totalBookings) {
    renderMessage('Sem datas suficientes para analisar os dias da semana.');
    return;
  }
  const body = WEEKDAY_LABELS.map((label, idx) => `
    <tr>
      <td>${label}</td>
      <td>${checkins[idx]}</td>
      <td>${totalCheckins ? formatPercent((checkins[idx] / totalCheckins) * 100) : '—'}</td>
      <td>${bookings[idx]}</td>
      <td>${totalBookings ? formatPercent((bookings[idx] / totalBookings) * 100) : '—'}</td>
    </tr>
  `).join('');
  renderTable(`
    <p class="reservas-v4-note">Dias em que acontecem os check-ins e em que as reservas são efetuadas · ${periodLabel()}.</p>
    <table class="media-faturacao reservas-v4-table">
      <thead><tr><th>Dia</th><th>Check-ins</th><th>% check-ins</th><th>Reservas</th><th>% reservas</th></tr></thead>
      <tbody>${body}<tr class="reservas-v4-total-row"><td><strong>Total</strong></td><td><strong>${totalCheckins}</strong></td><td><strong>${totalCheckins ? '100%' : '—'}</strong></td><td><strong>${totalBookings}</strong></td><td><strong>${totalBookings ? '100%' : '—'}</strong></td></tr></tbody>
    </table>
  `);
}

function renderBookingMonthTable(rows) {
  const matrix = Array.from({ length: 12 }, () => Array(12).fill(0));
  rows.forEach((row) => {
    const stay = parseLocalDate(row.checkIn);
    const booking = parseLocalDate(row.dataReserva);
    if (!stay || !booking) return;
    matrix[stay.getMonth()][booking.getMonth()] += 1;
  });
  const max = Math.max(0, ...matrix.flat());
  if (!max) {
    renderMessage('Sem datas suficientes para cruzar estadias e reservas.');
    return;
  }
  const body = MONTH_LABELS.map((stayLabel, stayIdx) => {
    const total = matrix[stayIdx].reduce((sum, value) => sum + value, 0);
    const cells = matrix[stayIdx].map((value) => {
      const alpha = value ? 0.08 + (value / max) * 0.32 : 0;
      return `<td style="background:rgba(20, 78, 3, ${alpha.toFixed(3)})">${value || '—'}</td>`;
    }).join('');
    return `<tr><td>${stayLabel}</td>${cells}<td><strong>${total}</strong></td></tr>`;
  }).join('');
  const columnTotals = Array.from({ length: 12 }, (_, bookingIdx) =>
    matrix.reduce((sum, stayMonths) => sum + stayMonths[bookingIdx], 0)
  );
  const grandTotal = columnTotals.reduce((sum, value) => sum + value, 0);
  renderTable(`
    <p class="reservas-v4-note">Linhas: mês da estadia · Colunas: mês em que a reserva foi feita · ${periodLabel()}.</p>
    <table class="media-faturacao reservas-v4-table">
      <thead><tr><th>Estadia ↓ / Reserva →</th>${MONTH_LABELS.map((label) => `<th>${label}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${body}<tr class="reservas-v4-total-row"><td><strong>Total</strong></td>${columnTotals.map((value) =>
        `<td><strong>${value}</strong></td>`).join('')}<td><strong>${grandTotal}</strong></td></tr></tbody>
    </table>
  `);
}

function renderQualityDashboard() {
  const target = document.getElementById('qualidade-v4-content');
  const count = document.getElementById('qualidade-v4-count');
  const toggle = document.getElementById('qualidade-v4-toggle');
  if (!target || !count || !toggle) return;

  const rows = state.rows.filter((row) => analysisYear(row) >= 2025);
  const duplicateCounts = new Map();
  rows.forEach((row) => {
    const key = duplicateKey(row);
    if (key) duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  });

  const findings = rows.map((row) => {
    const issues = [];
    const checkIn = strictLocalDate(row.checkIn);
    const checkOut = strictLocalDate(row.checkOut);
    const booking = strictLocalDate(row.dataReserva);
    const nights = Number(row.noites);
    const guests = (Number(row.hospedesAdultos) || 0) + (Number(row.hospedesCriancas) || 0);

    if (!checkIn) issues.push('Sem check-in');
    if (!checkOut) issues.push('Sem checkout');
    if (!booking) issues.push('Sem data da reserva');
    const minimumNights = isDirectInvoice(row) ? 1 : 2;
    if (!Number.isInteger(nights) || nights < minimumNights) issues.push('Noites inválidas');
    if (guests < 1) issues.push('Sem hóspedes');
    const key = duplicateKey(row);
    if (key && duplicateCounts.get(key) > 1) issues.push('Possível duplicado');
    return issues.length ? { row, issues, checkIn } : null;
  }).filter(Boolean);

  if (!findings.length) {
    count.textContent = 'Completo';
    count.classList.add('is-complete');
    toggle.hidden = true;
    target.hidden = false;
    target.innerHTML = '<p class="qualidade-v4-success">Todos os registos desde 2025 têm os dados essenciais preenchidos.</p>';
    return;
  }

  count.classList.remove('is-complete');
  count.textContent = `${findings.length} ${findings.length === 1 ? 'registo' : 'registos'}`;
  toggle.hidden = false;
  toggle.textContent = 'Ver correções';
  toggle.setAttribute('aria-expanded', 'false');
  target.hidden = true;
  const body = findings.map(({ row, issues, checkIn }) => {
    const reference = row.numeroFatura || row.id || 'Sem referência';
    const editLink = row.id
      ? `<a class="qualidade-v4-edit" href="faturas.html?editar=${encodeURIComponent(row.id)}">Corrigir</a>`
      : '<span class="qualidade-v4-no-link">Sem ligação</span>';
    return `
      <tr>
        <td><strong>${escapeHtml(reference)}</strong></td>
        <td>${escapeHtml(String(row.apartamento || '—'))}</td>
        <td>${checkIn ? formatShortDate(checkIn) : '—'}</td>
        <td><div class="qualidade-v4-issues">${issues.map((issue) =>
          `<span>${escapeHtml(issue)}</span>`).join('')}</div></td>
        <td>${editLink}</td>
      </tr>
    `;
  }).join('');

  target.innerHTML = `
    <p class="reservas-v4-note">Registos que podem afetar os cálculos. Os bebés não entram na validação de hóspedes e as extensões diretas da série D podem ter uma noite.</p>
    <div class="table-wrap qualidade-v4-table-wrap">
      <table class="media-faturacao qualidade-v4-table">
        <thead><tr><th>Fatura</th><th>Apartamento</th><th>Check-in</th><th>A corrigir</th><th>Ação</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function analysisDate(row) {
  const checkIn = strictLocalDate(row?.checkIn);
  if (checkIn) return checkIn;
  const year = Number(row?.ano);
  const month = Number(row?.mes);
  const day = Number(row?.dia);
  if (!Number.isInteger(year) || !isMonth(month) || !Number.isInteger(day) || day < 1) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function analysisYear(row) {
  return analysisDate(row)?.getFullYear() || Number(row?.ano);
}

function analysisMonth(row) {
  return analysisDate(row)?.getMonth() + 1 || Number(row?.mes);
}

function strictLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseLocalDate(value);
  if (!date) return null;
  const normalized = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  return normalized === value ? date : null;
}

function isDirectInvoice(row) {
  const channel = String(row?.canal || '').trim().toUpperCase();
  const reference = String(row?.numeroFatura || '').trim();
  return channel === 'DIRETO' || /^D\d+$/i.test(reference);
}

function duplicateKey(row) {
  const checkIn = strictLocalDate(row?.checkIn);
  const checkOut = strictLocalDate(row?.checkOut);
  if (!checkIn || !checkOut) return null;
  return `${String(row.apartamento || '')}|${row.checkIn}|${row.checkOut}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nightBucket(value) {
  const nights = Number(value);
  if (!Number.isFinite(nights) || nights < 2) return null;
  const rounded = Math.round(nights);
  return rounded >= 8 ? '≥8' : String(rounded);
}

function guestBucket(row) {
  const guests = Math.round(
    (Number(row.hospedesAdultos) || 0) + (Number(row.hospedesCriancas) || 0)
  );
  if (guests < 1) return null;
  return guests >= 8 ? '8+' : String(guests);
}

function findDominantBucket(totals) {
  const entries = Object.entries(totals);
  if (!entries.length) return null;
  const [bucket, value] = entries.reduce((best, entry) =>
    entry[1] > best[1] ? entry : best
  );
  return value > 0 ? bucket : null;
}

function periodLabel() {
  return state.year === 'all' ? 'todos os anos' : state.year;
}

function periodTotalLabel() {
  return state.year === 'all' ? 'Total geral' : `Total ${state.year}`;
}

function addWeekdayCount(target, value) {
  const date = parseLocalDate(value);
  if (!date || date > new Date()) return;
  target[(date.getDay() + 6) % 7] += 1;
}

function isMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1).replace('.', ',')}%`;
}

function formatSignedPercent(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? '+' : '−'}${formatPercent(Math.abs(number))}`;
}

function formatSignedPoints(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? '+' : '−'}${Math.abs(number).toFixed(1).replace('.', ',')} pp`;
}

function formatSignedEuro(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? '+' : '−'} ${formatEuro(Math.abs(number))}`;
}

function renderTable(html) {
  const target = document.getElementById('reservas-v4-table');
  if (target) target.innerHTML = html;
}

function renderMessage(message) {
  renderTable(`<p class="faturacao-v4-empty">${message}</p>`);
}

function cleanup() {
  controlsController?.abort();
  controlsController = null;
  document.body.classList.remove('analisev4-table-open');
}
