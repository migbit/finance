import { formatEuro } from './analisev2-core.js';
import { getNightlyEntries } from './analisev3-data.js';
import { computeWeekpartMetrics } from './analisev3-metrics.js';

const VIEW_APTS = {
  total: ['123', '1248'],
  '123': ['123'],
  '1248': ['1248']
};

const state = {
  view: 'total',
  entries: []
};

let weekpartButtonsController = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="weekpart"]')) return;
  bindWeekpartButtons();
  await loadWeekpartEntries();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'weekpart') loadWeekpartEntries();
});

function bindWeekpartButtons() {
  if (weekpartButtonsController) weekpartButtonsController.abort();
  weekpartButtonsController = new AbortController();
  const { signal } = weekpartButtonsController;
  document.querySelectorAll('[data-weekpart-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.weekpartView;
      if (!view || view === state.view) return;
      state.view = view;
      updateWeekpartButtons();
      renderWeekpart();
    }, { signal });
  });
  updateWeekpartButtons();
}

function updateWeekpartButtons() {
  document.querySelectorAll('[data-weekpart-view]').forEach((btn) => {
    const active = btn.dataset.weekpartView === state.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadWeekpartEntries() {
  window.loadingManager?.show('weekpart', { type: 'skeleton' });
  try {
    state.entries = await getNightlyEntries({ preciseOnly: true });
    renderWeekpart();
  } catch (error) {
    window.errorHandler?.handleError('weekpart', error, 'loadWeekpartEntries', loadWeekpartEntries);
    state.entries = [];
    renderWeekpart(true);
  } finally {
    window.loadingManager?.hide('weekpart');
  }
}

function renderWeekpart(forceEmpty = false) {
  const entries = state.entries;
  if (!entries.length || forceEmpty) {
    toggleWeekpartMode('single');
    setWeekpartText('weekday-price', '—');
    setWeekpartText('weekend-price', '—');
    setWeekpartText('weekday-occ', '—');
    setWeekpartText('weekend-occ', '—');
    setWeekpartText('weekend-premium', '—');
    setRecommendation('Sem dados suficientes para comparar.');
    toggleCompareTable(false);
    return;
  }

  if (state.view === 'compare') {
    renderWeekpartCompare(entries);
    return;
  }

  toggleCompareTable(false);
  const apartments = VIEW_APTS[state.view] || VIEW_APTS.total;
  const metrics = computeWeekpartMetrics(entries, { apartments });
  if (!metrics) {
    setWeekpartText('weekday-price', '—');
    setWeekpartText('weekend-price', '—');
    setWeekpartText('weekday-occ', '—');
    setWeekpartText('weekend-occ', '—');
    setWeekpartText('weekend-premium', '—');
    setRecommendation('Sem dados suficientes para esta vista.');
    return;
  }

  setWeekpartText('weekday-price', formatEuro(metrics.weekdayPrice));
  setWeekpartText('weekend-price', formatEuro(metrics.weekendPrice));
  setWeekpartText('weekday-occ', `${metrics.weekdayOcc.toFixed(1)}%`);
  setWeekpartText('weekend-occ', `${metrics.weekendOcc.toFixed(1)}%`);
  setWeekpartText('weekend-premium', `${metrics.premium.toFixed(1)}%`);
  setRecommendation(buildRecommendation(metrics));
}

function renderWeekpartCompare(entries) {
  const metrics1248 = computeWeekpartMetrics(entries, { apartments: ['1248'] });
  const metrics123 = computeWeekpartMetrics(entries, { apartments: ['123'] });
  toggleCompareTable(true);
  if (!metrics1248 && !metrics123) {
    setCompareRow('weekday-price', '—', '—');
    setCompareRow('weekend-price', '—', '—');
    setCompareRow('weekday-occ', '—', '—');
    setCompareRow('weekend-occ', '—', '—');
    setCompareRow('premium', '—', '—');
    setRecommendation('Sem dados suficientes para comparar os apartamentos.');
    return;
  }

  setCompareRow(
    'weekday-price',
    metrics1248 ? formatEuro(metrics1248.weekdayPrice) : '—',
    metrics123 ? formatEuro(metrics123.weekdayPrice) : '—'
  );
  setCompareRow(
    'weekend-price',
    metrics1248 ? formatEuro(metrics1248.weekendPrice) : '—',
    metrics123 ? formatEuro(metrics123.weekendPrice) : '—'
  );
  setCompareRow(
    'weekday-occ',
    metrics1248 ? `${metrics1248.weekdayOcc.toFixed(1)}%` : '—',
    metrics123 ? `${metrics123.weekdayOcc.toFixed(1)}%` : '—'
  );
  setCompareRow(
    'weekend-occ',
    metrics1248 ? `${metrics1248.weekendOcc.toFixed(1)}%` : '—',
    metrics123 ? `${metrics123.weekendOcc.toFixed(1)}%` : '—'
  );
  setCompareRow(
    'premium',
    metrics1248 ? `${metrics1248.premium.toFixed(1)}%` : '—',
    metrics123 ? `${metrics123.premium.toFixed(1)}%` : '—'
  );

  const priceDiff = (metrics1248?.weekendPrice || 0) - (metrics123?.weekendPrice || 0);
  const leader = priceDiff >= 0 ? '1248' : '123';
  const diffText = formatEuro(Math.abs(priceDiff));
  setRecommendation(`Apt ${leader} lidera no preço de fim de semana por ${diffText}. Ajuste o outro apartamento para equilibrar o prémio.`);
}

function buildRecommendation(metrics) {
  if (metrics.weekendOcc >= 90 && metrics.weekdayOcc < 60) {
    return 'Fins-de-semana lotados: aumente tarifas de sexta/sábado e crie promoções mid-week.';
  }
  if (metrics.premium < 10) {
    return 'Premium de fim-de-semana abaixo de 10% – reveja tarifas e mínimo de noites para capturar mais valor.';
  }
  if (metrics.weekdayOcc < 40) {
    return 'Dias úteis fracos: aposte em empresas e estadias longas para encher o calendário.';
  }
  return 'Bom equilíbrio: mantenha premium de fim-de-semana e monitore próximas semanas.';
}

function toggleCompareTable(showCompare) {
  const grid = document.querySelector('.weekpart-grid');
  const table = document.getElementById('weekpart-compare');
  if (grid) grid.style.display = showCompare ? 'none' : 'grid';
  if (table) table.style.display = showCompare ? 'block' : 'none';
}

function setCompareRow(metricKey, val1248, val123) {
  const cell1248 = document.getElementById(`compare-${metricKey}-1248`);
  const cell123 = document.getElementById(`compare-${metricKey}-123`);
  if (cell1248) cell1248.textContent = val1248;
  if (cell123) cell123.textContent = val123;
}

function setWeekpartText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setRecommendation(text) {
  const el = document.getElementById('weekpart-recommendation');
  if (el) el.textContent = text;
}
