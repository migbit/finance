const requiredModules = new Set(['progresso', 'faturacao']);
const moduleReady = new Set();
const moduleState = new Map();

const spinnerEl = document.getElementById('global-spinner');
const tableWrapEl = document.querySelector('#tabela-faturacao-v2');
const chartWrapEl = document.querySelector('#chart-faturacao-v2');
const tableWrap = tableWrapEl ? tableWrapEl.parentElement : null;
const chartWrap = chartWrapEl ? chartWrapEl.parentElement : null;

function setSpinner(active) {
  if (!spinnerEl) return;
  spinnerEl.classList.toggle('active', active);
}

function toggleSkeleton(selector, on) {
  document.querySelectorAll(selector).forEach(el => {
    el.classList.toggle('is-visible', on);
  });
}

function toggleModuleSkeleton(module, on) {
  if (module === 'progresso') {
    toggleSkeleton('[data-skeleton="progresso"]', on);
  } else if (module === 'faturacao') {
    toggleSkeleton('[data-skeleton="faturacao-chart"]', on);
    toggleSkeleton('[data-skeleton="faturacao-table"]', on);
  }
}

function setModuleError(module, detail) {
  const box = document.querySelector(`[data-error-for="${module}"]`);
  if (!box) return;
  if (detail) {
    const span = box.querySelector(`[data-error-detail="${module}"]`);
    if (span && detail.detail) span.textContent = detail.detail;
    box.hidden = false;
  } else {
    box.hidden = true;
  }
}

function handleModuleLoaded(module) {
  moduleReady.add(module);
  toggleModuleSkeleton(module, false);
  setModuleError(module, null);
  if (moduleReady.size === requiredModules.size) {
    setSpinner(false);
  }
}

function handleModuleLoading(module) {
  moduleState.set(module, 'loading');
  toggleModuleSkeleton(module, true);
  setModuleError(module, null);
  setSpinner(true);
}

function handleMiniLoading(target, state) {
  const enable = state === 'start';
  if (target === 'chart' && chartWrap) {
    chartWrap.classList.toggle('is-loading', enable);
    toggleSkeleton('[data-skeleton="faturacao-chart"]', enable);
  }
  if (target === 'table' && tableWrap) {
    tableWrap.classList.toggle('is-loading', enable);
    toggleSkeleton('[data-skeleton="faturacao-table"]', enable);
  }
}

window.addEventListener('analisev2:module-loading', (evt) => {
  const detail = evt && evt.detail ? evt.detail : {};
  const module = detail.module;
  if (!module) return;
  handleModuleLoading(module);
});

window.addEventListener('analisev2:module-loaded', (evt) => {
  const detail = evt && evt.detail ? evt.detail : {};
  const module = detail.module;
  if (!module) return;
  moduleState.set(module, 'ready');
  handleModuleLoaded(module);
});

window.addEventListener('analisev2:module-error', (evt) => {
  const detail = evt && evt.detail ? evt.detail : {};
  const module = detail.module;
  if (!module) return;
  setSpinner(false);
  toggleModuleSkeleton(module, false);
  setModuleError(module, { detail: detail.message || 'Erro desconhecido' });
});

window.addEventListener('analisev2:view-loading', (evt) => {
  const { target, state } = evt.detail || {};
  handleMiniLoading(target, state);
});

const retryProg = document.querySelector('[data-retry-progresso]');
if (retryProg) {
  retryProg.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('analisev2:retry', { detail: { module: 'progresso' } }));
  });
}

const retryFat = document.querySelector('[data-retry-faturacao]');
if (retryFat) {
  retryFat.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('analisev2:retry', { detail: { module: 'faturacao' } }));
  });
}

// Initialize skeletons visible until modules report ready
toggleSkeleton('[data-skeleton]', true);

setSpinner(true);
