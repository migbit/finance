// js/dca-main.js - Main initialization and event binding

import { 
  START_YM, DEFAULTS, TAXA_ANUAL_FIXA,
  ensureMonthsExist, loadParams, saveParams, loadAllDocs, saveRow,
  loadJuroSaldo, saveJuroSaldo, isAuthenticated, onAuthChange
} from './dca-core.js';

import { 
  buildModel, calculateKPIs, calculateScenarios, calculateProgress,
  calculateGoalStatus, calculateJuroMensal, somaJuroTabelaDCA, diasNoMes,
  prepareChartData, calculateAdvancedMetrics, calculateRebalancingSuggestions
} from './dca-calculations.js';

import {
  renderTable, applyYearVisibility, updateKPIs, updateProgressBar,
  updateGoalStatus, updateScenarios, writeParamsToUI, readParamsFromUI,
  addScrollIndicators, showLoading, showError,
  initializeCharts, updatePerformanceChart, exportChartAsImage,
  updateAdvancedMetrics, updateRebalancingSuggestions,
  exportToCSV
} from './dca-ui.js';

// ---------- Mobile Menu ----------
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const menuBtn = document.getElementById('menu-icon');
  const navMenu = document.getElementById('nav-menu');

  if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
      header.classList.toggle('active');
    });
  }

  if (navMenu && header) {
    navMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) header.classList.remove('active');
    });
  }
});

// ---------- State ----------
const state = {
  params: { ...DEFAULTS },
  showOthers: false,
  isLoading: false,
  rows: [],
  chartType: 'portfolio-growth',
  chartRange: null,
  chartData: null,
  rebalancingAlertSent: false
};

const feedbackTimers = new Map();

function showFeedback(targetId, message, tone = 'success', timeout = 3200) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message || '';
  el.className = `form-feedback${tone ? ' ' + tone : ''}`;
  
  if (feedbackTimers.has(targetId)) {
    clearTimeout(feedbackTimers.get(targetId));
    feedbackTimers.delete(targetId);
  }
  
  if (message) {
    const timer = setTimeout(() => {
      el.textContent = '';
      el.className = 'form-feedback';
      feedbackTimers.delete(targetId);
    }, timeout);
    feedbackTimers.set(targetId, timer);
  }
}

function updateChartRangeLabel(totalPoints) {
  const labelEl = document.getElementById('chart-range-label');
  if (!labelEl || !state.chartData || !totalPoints) {
    if (labelEl) labelEl.textContent = '-';
    return;
  }
  if (!state.chartRange || state.chartRange >= totalPoints) {
    labelEl.textContent = 'Completo';
  } else {
    const index = Math.max(Math.min(state.chartRange, totalPoints), 1) - 1;
    labelEl.textContent = state.chartData.labels[index] || '-';
  }
}

function syncChartRangeControl() {
  const rangeInput = document.getElementById('chart-range-end');
  if (!rangeInput) return;
  
  const totalPoints = state.chartData?.labels?.length ?? 0;
  if (totalPoints <= 0) {
    rangeInput.disabled = true;
    rangeInput.value = 1;
    updateChartRangeLabel(0);
    return;
  }
  
  rangeInput.disabled = false;
  rangeInput.max = totalPoints;
  
  if (!state.chartRange || state.chartRange > totalPoints) {
    state.chartRange = totalPoints;
  } else if (state.chartRange < 1) {
    state.chartRange = 1;
  }
  
  rangeInput.value = state.chartRange;
  updateChartRangeLabel(totalPoints);
}

function maybeSendRebalancingAlert() {
  state.rebalancingAlertSent = false;
}

// ---------- Debounce Helper ----------
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ---------- Chart Controls ----------
function initializeChartControls() {
  const chartTypeSelect = document.getElementById('chart-type');
  const exportChartBtn = document.getElementById('export-chart');
  const chartRangeInput = document.getElementById('chart-range-end');
  
  if (chartTypeSelect) {
    chartTypeSelect.value = state.chartType;
    chartTypeSelect.addEventListener('change', (e) => {
      state.chartType = e.target.value;
      if (state.chartData) {
        updatePerformanceChart(state.chartData, state.chartType, state.chartRange);
      }
    });
  }
  
  if (exportChartBtn) {
    exportChartBtn.addEventListener('click', exportChartAsImage);
  }
  
  if (chartRangeInput) {
    chartRangeInput.addEventListener('input', (e) => {
      if (!state.chartData) return;
      const total = state.chartData.labels.length;
      const raw = Number(e.target.value);
      state.chartRange = Math.min(Math.max(Math.round(raw), 1), total);
      updateChartRangeLabel(total);
      updatePerformanceChart(state.chartData, state.chartType, state.chartRange);
    });
  }
}

// ---------- Juro Module ----------
async function initJuroModule() {
  const saldoInp = document.getElementById('juro-saldo');
  const taxaInp = document.getElementById('juro-taxa');
  const mensalLbl = document.getElementById('juro-mensal');
  const acumLbl = document.getElementById('juro-acumulado');
  const endDateInp = document.getElementById('end-date');

  if (!saldoInp || !taxaInp || !mensalLbl || !acumLbl) return;

  taxaInp.value = '2.00';
  taxaInp.setAttribute('disabled', 'disabled');

  // Load saved saldo
  try {
    const data = await loadJuroSaldo();
    if (data.saldo != null) {
      saldoInp.value = parseFloat(data.saldo).toFixed(2);
    }
  } catch (err) {
    console.error('Error loading juro:', err);
  }

  const updateJuro = debounce(() => {
    const saldo = parseFloat((saldoInp.value || '').toString().replace(',', '.')) || 0;
    const dias = diasNoMes(endDateInp?.value);
    const mensal = calculateJuroMensal(saldo, endDateInp?.value);
    
    mensalLbl.textContent = mensal.toLocaleString('pt-PT', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';

    const obsRoot = document.getElementById('dca-table-wrap');
    const soma = somaJuroTabelaDCA(obsRoot);
    acumLbl.textContent = soma.toLocaleString('pt-PT', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';
  }, 300);

  ['input', 'change'].forEach(evt => {
    saldoInp.addEventListener(evt, updateJuro);
    endDateInp?.addEventListener(evt, updateJuro);
  });

  // Observe table changes
  const obsRoot = document.getElementById('dca-table-wrap');
  if (obsRoot && 'MutationObserver' in window) {
    const mo = new MutationObserver(updateJuro);
    mo.observe(obsRoot, { childList: true, subtree: true, characterData: true });
  }

  // Buttons
  document.getElementById('btn-juro-gravar')?.addEventListener('click', async () => {
    try {
      await saveJuroSaldo(saldoInp.value);
      const data = await loadJuroSaldo();
      if (data.saldo != null) {
        saldoInp.value = parseFloat(data.saldo).toFixed(2);
      }
      showFeedback('juro-feedback', 'Gravado');
    } catch (err) {
      showFeedback('juro-feedback', err.message || 'Erro ao gravar saldo.', 'error');
    }
  });

  updateJuro();
}

// ---------- Save Row Handler (Event Delegation) ----------
function bindTableSaveHandler() {
  const wrap = document.getElementById('dca-table-wrap');
  if (!wrap) return;
  if (wrap.__boundSave) return;
  wrap.__boundSave = true;

  wrap.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.btn-save');
    if (!b) return;
    
    const tr = b.closest('tr');
    const id = tr?.dataset?.id;
    if (!id) return;

    const swda = parseFloat(tr.querySelector('.swda')?.value) || null;
    const aggh = parseFloat(tr.querySelector('.aggh')?.value) || null;
    const cash = parseFloat(tr.querySelector('.cash')?.value) || null;

    try {
      b.textContent = '⏳';
      b.disabled = true;
      
      await saveRow(id, {
        swda_value: swda,
        aggh_value: aggh,
        cash_interest: cash
      });

      b.textContent = '✅';
      setTimeout(() => {
        b.textContent = '✓';
        b.disabled = false;
      }, 1000);

      await boot(true);
    } catch (err) {
      b.textContent = '❌';
      b.disabled = false;
      alert(err.message || 'Erro ao gravar. Tente novamente.');
      setTimeout(() => {
        b.textContent = '✓';
      }, 2000);
    }
  });
}

// ---------- Toggle Years Button ----------
function bindGlobalButtons() {
  const btn = document.getElementById('toggle-others');
  if (btn && !btn.__bound) {
    btn.__bound = true;
    btn.addEventListener('click', () => {
      state.showOthers = !state.showOthers;
      applyYearVisibility(state.showOthers);
    });
  }
  
  // Toggle Params/Juro button
  const toggleParamsBtn = document.getElementById('btn-toggle-params');
  const paramsContainer = document.getElementById('params-juro-container');
  if (toggleParamsBtn && paramsContainer && !toggleParamsBtn.__bound) {
    toggleParamsBtn.__bound = true;
    toggleParamsBtn.addEventListener('click', () => {
      const isHidden = paramsContainer.style.display === 'none';
      paramsContainer.style.display = isHidden ? 'block' : 'none';
      toggleParamsBtn.textContent = isHidden ? 'Ocultar Parâmetros' : 'Mostrar Parâmetros';
    });
  }

  const exportBtn = document.getElementById('export-csv-inline');
  if (exportBtn && !exportBtn.__bound) {
    exportBtn.__bound = true;
    exportBtn.addEventListener('click', () => {
      if (state.rows && state.rows.length > 0) {
        exportToCSV(state.rows);
      } else {
        alert('Não há dados para exportar.');
      }
    });
  }
}

// ---------- Main Boot ----------
async function boot(skipParamUI = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  try {
    const wrapEl = document.getElementById('dca-table-wrap');
    
    if (!skipParamUI) {
      if (wrapEl) showLoading(wrapEl, 'A carregar dados...');
      state.params = await loadParams();
      writeParamsToUI(state.params);
      updateScenarios(null, state.params);
    }

    await ensureMonthsExist(state.params.endYM);
    const docs = await loadAllDocs();

    const limId = `${state.params.endYM.y}-${String(state.params.endYM.m).padStart(2,'0')}`;
    const subset = docs.filter(d => d.id <= limId);
    const rows = buildModel(subset, state.params);
    state.rows = rows; // Store rows for chart data

    // Initialize charts
    initializeCharts();
    
    // Update charts with data
    const chartData = prepareChartData(rows, state.params);
    if (chartData) {
      state.chartData = chartData;
      if (!state.chartRange || state.chartRange > chartData.labels.length) {
        state.chartRange = chartData.labels.length;
      }
      syncChartRangeControl();
      updatePerformanceChart(chartData, state.chartType, state.chartRange);
    } else {
      state.chartData = null;
      state.chartRange = null;
      syncChartRangeControl();
    }

    // Render table
    if (wrapEl) {
      renderTable(rows, wrapEl);
      bindTableSaveHandler();
      applyYearVisibility(state.showOthers);
    }

    // Calculate and update KPIs
    const kpis = calculateKPIs(rows);
    const obsRoot = document.getElementById('dca-table-wrap');
    const totalInterest = somaJuroTabelaDCA(obsRoot);
    updateKPIs(kpis, totalInterest);

    // Calculate and update advanced metrics
    const advancedMetrics = calculateAdvancedMetrics(rows, state.params);
    updateAdvancedMetrics(advancedMetrics);

    // Calculate rebalancing suggestions
    const rebalancingData = calculateRebalancingSuggestions(rows);
    updateRebalancingSuggestions(rebalancingData);
    maybeSendRebalancingAlert(rebalancingData);

    // Update progress bar
    const progress = calculateProgress(state.params);
    updateProgressBar(progress);

    // Update goal status
    const goalStatus = calculateGoalStatus(kpis, progress);
    updateGoalStatus(goalStatus);

    // Update scenarios
    if (kpis && kpis.lastFilledRow) {
      const scenarios = calculateScenarios(kpis.lastFilledRow, state.params);
      updateScenarios(scenarios, state.params);
    } else {
      updateScenarios(null, state.params);
    }

    // Add scroll indicators
    requestAnimationFrame(addScrollIndicators);

  } catch (err) {
    console.error('Boot error:', err);
    const wrapEl = document.getElementById('dca-table-wrap');
    if (wrapEl) showError(wrapEl, err.message || 'Erro ao carregar dados.');
  } finally {
    state.isLoading = false;
  }
}

// ---------- Save Params Button ----------
document.getElementById('btn-save-params')?.addEventListener('click', async () => {
  const p = readParamsFromUI(DEFAULTS);
  if (!p.pctSumOk) {
    showFeedback('params-feedback', 'As percentagens VWCE+AGGH devem somar 100%.', 'error');
    return;
  }
  
  const { pctSumOk, ...params } = p;
  state.params = params;
  
  try {
    await saveParams(params);
    await boot(true);
    showFeedback('params-feedback', 'Gravado');
  } catch (err) {
    showFeedback('params-feedback', err.message || 'Erro ao gravar parâmetros.', 'error');
  }
});

// ---------- Window Resize Handler ----------
window.addEventListener('resize', debounce(() => {
  addScrollIndicators();
}, 250));

// ---------- Initialize ----------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bindGlobalButtons();
    initJuroModule();
    initializeChartControls();
    boot();
  }, { once: true });
} else {
  bindGlobalButtons();
  initJuroModule();
  initializeChartControls();
  boot();
}
