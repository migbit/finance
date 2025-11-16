import { MONTH_LABELS, formatEuro, VIEW_APTS } from './analisev2-core.js';
import { getNightlyEntries } from './analisev3-data.js';

const MIN_GAP = 3;
const MIN_DISPLAY_YEAR = 2025;
const DEFAULT_APARTMENTS = VIEW_APTS?.total || ['123', '1248'];
const gapState = {
  view: 'total',
  entries: []
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="gap-analysis"]')) return;
  bindGapViewEvents();
  await renderGapAnalysis();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'gap-analysis') renderGapAnalysis();
});

function bindGapViewEvents() {
  window.addEventListener('gap-analysis:set-view', (event) => {
    const next = event.detail?.view;
    if (!next) return;
    gapState.view = next;
    if (gapState.entries.length) renderGapAnalysisView();
  });
}

async function renderGapAnalysis() {
  window.loadingManager?.show('gap-analysis', { type: 'skeleton' });
  try {
    const entries = await getNightlyEntries({ preciseOnly: true });
    gapState.entries = entries;
    if (!entries.length) {
      setGapSummary('Sem datas com check-in detalhado.');
      setGapTable('');
      setGapSuggestions([]);
      return;
    }
    renderGapAnalysisView();
  } catch (error) {
    window.errorHandler?.handleError('gap-analysis', error, 'renderGapAnalysis', renderGapAnalysis);
    gapState.entries = [];
    setGapSummary('Erro ao analisar gaps.');
    setGapTable('');
    setGapSuggestions([]);
  } finally {
    window.loadingManager?.hide('gap-analysis');
  }
}

function renderGapAnalysisView() {
  if (!gapState.entries.length) return;
  const apartments = VIEW_APTS?.[gapState.view] || DEFAULT_APARTMENTS;
  const summary = computeGaps(gapState.entries, apartments);
  if (!summary.rows.length) {
    setGapSummary('Sem lacunas maiores que 2 noites nos últimos meses.');
    setGapTable('<div class="heatmap-muted">Sem gaps relevantes.</div>');
    setGapSuggestions([]);
    return;
  }
  renderTable(summary.rows);
  renderSummary(summary);
  renderSuggestions(summary.rows);
}

function computeGaps(entries, apartments = DEFAULT_APARTMENTS) {
  const allowed = new Set((apartments && apartments.length ? apartments : DEFAULT_APARTMENTS).map(String));
  const filteredEntries = entries.filter((entry) => allowed.has(String(entry.apartamento ?? entry.apartment ?? '')));
  if (!filteredEntries.length) {
    return { rows: [], totalEmpty: 0, totalLost: 0 };
  }

  const occupied = new Set();
  const monthlyRates = new Map();
  let globalValue = 0;
  let globalNights = 0;

  filteredEntries.forEach((entry) => {
    const key = `${entry.apartamento}|${formatDateKey(entry.ano, entry.mes, entry.dia)}`;
    occupied.add(key);
    const monthKey = `${entry.ano}-${pad(entry.mes)}`;
    if (!monthlyRates.has(monthKey)) monthlyRates.set(monthKey, { value: 0, nights: 0 });
    const slot = monthlyRates.get(monthKey);
    slot.value += Number(entry.valor) || 0;
    slot.nights += 1;
    globalValue += Number(entry.valor) || 0;
    globalNights += 1;
  });

  const monthKeys = Array.from(monthlyRates.keys()).sort();
  const rows = monthKeys.map((key) => {
    const [year, monthStr] = key.split('-').map(Number);
    const avgRate = deriveAvgRate(monthlyRates.get(key), globalValue, globalNights);
    const emptyNights = countGapsForMonth(year, monthStr, occupied, allowed);
    const lost = emptyNights * avgRate;
    return {
      key,
      label: `${MONTH_LABELS[monthStr - 1]} ${year}`,
      emptyNights,
      avgRate,
      lostRevenue: lost,
      action: selectAction(emptyNights)
    };
  });

  const filteredRows = rows.filter((row) => getYearFromKey(row.key) >= MIN_DISPLAY_YEAR);

  return {
    rows: filteredRows,
    totalEmpty: filteredRows.reduce((sum, row) => sum + row.emptyNights, 0),
    totalLost: filteredRows.reduce((sum, row) => sum + row.lostRevenue, 0)
  };
}

function countGapsForMonth(year, month, occupied, apartmentsSet) {
  const days = daysInMonth(year, month);
  let total = 0;
  const targets = apartmentsSet && apartmentsSet.size ? Array.from(apartmentsSet) : DEFAULT_APARTMENTS;
  targets.forEach((apt) => {
    let run = 0;
    for (let day = 1; day <= days; day++) {
      const dayKey = `${apt}|${formatDateKey(year, month, day)}`;
      if (occupied.has(dayKey)) {
        if (run >= MIN_GAP) total += run;
        run = 0;
        continue;
      }
      run += 1;
    }
    if (run >= MIN_GAP) total += run;
  });
  return total;
}

function deriveAvgRate(slot, globalValue, globalNights) {
  if (slot?.nights) return slot.value / slot.nights;
  if (globalNights) return globalValue / globalNights;
  return 0;
}

function selectAction(emptyNights) {
  if (emptyNights >= 12) return 'Campanha agressiva (+15%)';
  if (emptyNights >= 8) return 'Promo week-day targeted';
  if (emptyNights >= 4) return 'Abrir calendário + upsell';
  return 'Gap normal';
}

function renderTable(rows) {
  if (!rows.length) {
    setGapTable('<div class="heatmap-muted">Sem gaps relevantes.</div>');
    return;
  }
  const html = [`<table class="media-faturacao"><thead><tr><th>Mês</th><th>Noites vazias &gt;2</th><th>Rec. perdida</th><th>Ação sugerida</th></tr></thead><tbody>`];
  rows.forEach((row) => {
    html.push(`<tr><td>${row.label}</td><td>${row.emptyNights}</td><td>${formatEuro(row.lostRevenue)}</td><td>${row.action}</td></tr>`);
  });
  html.push('</tbody></table>');
  setGapTable(html.join(''));
}

function renderSummary(summary) {
  const text = summary.totalEmpty
    ? `${summary.totalEmpty} noites vazias identificadas nos períodos analisados.`
    : 'Sem lacunas maiores que 2 noites nos últimos meses.';
  setGapSummary(text);
}

function renderSuggestions(rows) {
  const upcoming = rows.filter((row) => isCurrentOrFuture(row.key));
  const top = upcoming.slice(0, 2);
  const items = top.map((row) => `${row.label}: ${row.emptyNights} noites → ${row.action}`);
  setGapSuggestions(items, upcoming.length);
}

function setGapSummary(text) {
  const el = document.getElementById('gap-summary');
  if (el) el.textContent = text;
}

function setGapTable(html) {
  const el = document.getElementById('gap-table');
  if (el) el.innerHTML = html;
}

function setGapSuggestions(items, totalUpcoming = 0) {
  const wrap = document.getElementById('gap-suggestions');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

function isCurrentOrFuture(key) {
  if (!key) return false;
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return false;
  const reference = new Date();
  const compareValue = year * 12 + (month - 1);
  const currentValue = reference.getFullYear() * 12 + reference.getMonth();
  return compareValue >= currentValue;
}

function formatDateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function daysInMonth(year, month) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  const date = new Date(year, month, 0);
  return Number.isNaN(date.getTime()) ? 30 : date.getDate();
}

function getYearFromKey(key) {
  if (typeof key !== 'string') return 0;
  const [yearStr] = key.split('-');
  return Number(yearStr) || 0;
}
