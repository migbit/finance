// js/dca-main.js - Main initialization and event binding

import {
  START_YM, DEFAULTS, TAXA_ANUAL_FIXA,
  ensureMonthsExist, loadParams, saveParams, loadAllDocs, saveRow,
  loadJuroSaldo, saveJuroSaldo, isAuthenticated, onAuthChange,
  ymCompare, ymToId, getPreviousMonth, ymMin,
  loadShareQuantities, saveShareQuantities
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
import { initEtfQuotes } from './dca-quotes.js';

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
  rebalancingAlertSent: false,

  // NEW: Live data tracking
  liveData: {
    quotes: null,        // { vwce: {...}, aggh: {...} }
    shares: null,        // { vwce: 1.2345, aggh: 0.5678 }
    saldo: 0,           // Current cash balance
    juroLive: 0         // Live juro calculation (previous month)
  }
};

const feedbackTimers = new Map();

// ---------- Live Data Management ----------
async function loadLiveData() {
  try {
    // Load quotes from global window object (set by dca-quotes.js)
    const quotes = {
      vwce: window.dcaQuotes?.vwce || null,
      aggh: window.dcaQuotes?.aggh || null
    };

    // Load shares from Firebase
    const shares = await loadShareQuantities();

    // Load saldo
    const juroData = await loadJuroSaldo();
    const saldo = juroData.saldo || 0;

    // Calculate juro for previous month (mês atual - 1)
    const now = new Date();
    const prevYM = getPreviousMonth({ y: now.getFullYear(), m: now.getMonth() + 1 });
    const juroLive = calculateJuroMensal(
      saldo,
      `${prevYM.y}-${String(prevYM.m).padStart(2, '0')}`
    );

    return { quotes, shares, saldo, juroLive };
  } catch (err) {
    console.error('Error loading live data:', err);
    return {
      quotes: null,
      shares: { vwce: 0, aggh: 0 },
      saldo: 0,
      juroLive: 0
    };
  }
}

function updateLiveCalculations() {
  if (!state.liveData.shares) return;

  // Recalculate juro
  const now = new Date();
  const prevYM = getPreviousMonth({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const prevYMStr = `${prevYM.y}-${String(prevYM.m).padStart(2, '0')}`;
  state.liveData.juroLive = calculateJuroMensal(state.liveData.saldo, prevYMStr);

  // Update UI
  updateJuroDisplay();

  // Rebuild model and refresh
  boot(true);
}

function updateJuroDisplay() {
  const saldoDisplay = document.getElementById('juro-saldo-display');
  const mensalDisplay = document.getElementById('juro-mensal-display');
  const acumDisplay = document.getElementById('juro-acumulado-display');

  if (saldoDisplay) {
    const saldoValue = Number(state.liveData.saldo || 0);
    if (saldoDisplay.tagName === 'INPUT') {
      saldoDisplay.value = saldoValue.toFixed(2);
    } else {
      saldoDisplay.textContent = saldoValue.toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' €';
    }
  }

  if (mensalDisplay) {
    mensalDisplay.textContent = state.liveData.juroLive.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }

  // Calculate total accumulated juro from table
  const obsRoot = document.getElementById('dca-table-wrap');
  const totalJuro = somaJuroTabelaDCA(obsRoot, { excludeCurrentMonth: true });
  if (acumDisplay) {
    acumDisplay.textContent = totalJuro.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }

  // Keep saldo inline input in sync (if present)
  const saldoInput = document.getElementById('juro-saldo-display');
  if (saldoInput && saldoInput.tagName === 'INPUT') {
    saldoInput.value = Number(state.liveData.saldo || 0).toFixed(2);
  }
}

// ---------- Month Closure UI ----------
function showMonthClosureBanner(monthYM) {
  const banner = document.getElementById('month-closure-banner');
  const label = document.getElementById('month-to-close-label');

  if (banner && label) {
    const monthName = new Date(monthYM.y, monthYM.m - 1).toLocaleDateString('pt-PT', {
      month: 'long',
      year: 'numeric'
    });
    label.textContent = monthName;
    banner.style.display = 'block';
  }
}

function hideMonthClosureBanner() {
  const banner = document.getElementById('month-closure-banner');
  if (banner) banner.style.display = 'none';
}

function parseLabelToYM(label) {
  if (!label || typeof label !== 'string') return { month: null, year: null };
  const parts = label.split('/');
  if (parts.length !== 2) return { month: null, year: null };
  const month = Number(parts[0]);
  let year = Number(parts[1]);
  if (Number.isFinite(year)) {
    year = year >= 0 && year < 100 ? 2000 + year : year;
  } else {
    year = null;
  }
  return {
    month: Number.isFinite(month) ? month : null,
    year: Number.isFinite(year) ? year : null
  };
}

function determineDefaultChartRange(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  let currentMonthIndex = -1;
  let closestBeforeIndex = -1;
  let lastAvailableIndex = labels.length - 1;

  labels.forEach((label, idx) => {
    const { month, year } = parseLabelToYM(label);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;

    // Exact match for current month/year
    if (year === currentYear && month === currentMonth) {
      currentMonthIndex = idx;
    }
    // Closest month before or equal to current month
    else if (year < currentYear || (year === currentYear && month < currentMonth)) {
      closestBeforeIndex = idx;
    }
  });

  // Priority: current month → closest before → last available
  let chosenIndex = -1;
  if (currentMonthIndex >= 0) {
    chosenIndex = currentMonthIndex;
  } else if (closestBeforeIndex >= 0) {
    chosenIndex = closestBeforeIndex;
  } else {
    chosenIndex = lastAvailableIndex;
  }

  return chosenIndex + 1;
}

function getInvestedTotalsUntil(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { vwce: 0, aggh: 0 };
  const now = new Date();
  const targetYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
  let snapshot = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rowYM = { y: row.y, m: row.m };
    if (ymCompare(rowYM, START_YM) < 0) continue;
    if (ymCompare(rowYM, targetYM) <= 0) {
      snapshot = row;
      break;
    }
  }
  if (!snapshot) return { vwce: 0, aggh: 0 };
  return {
    vwce: Number(snapshot.investedCumSWDA ?? 0),
    aggh: Number(snapshot.investedCumAGGH ?? 0)
  };
}

function broadcastInvestedTotals(rows) {
  const totals = getInvestedTotalsUntil(rows);
  window.dispatchEvent(new CustomEvent('dca:invested-totals', { detail: totals }));
}

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
    const now = new Date();
    const prevYM = getPreviousMonth({ y: now.getFullYear(), m: now.getMonth() + 1 });
    const prevYMStr = `${prevYM.y}-${String(prevYM.m).padStart(2, '0')}`;
    const mensal = calculateJuroMensal(saldo, prevYMStr);
    
    mensalLbl.textContent = mensal.toLocaleString('pt-PT', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';

    const obsRoot = document.getElementById('dca-table-wrap');
    const soma = somaJuroTabelaDCA(obsRoot, { excludeCurrentMonth: true });
    acumLbl.textContent = soma.toLocaleString('pt-PT', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';
  }, 300);

  ['input', 'change'].forEach(evt => {
    saldoInp.addEventListener(evt, updateJuro);
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
    // Handle + extra buttons
    const addSW = ev.target.closest('.btn-add-inv-swda');
    if (addSW) {
      const tr = addSW.closest('tr');
      const input = tr?.querySelector('.inv-swda-extra');
      if (input) {
        const val = prompt('Adicionar extra VWCE para este mês (valor único):', input.value || '');
        if (val !== null) input.value = val;
      }
      return;
    }
    const addAG = ev.target.closest('.btn-add-inv-aggh');
    if (addAG) {
      const tr = addAG.closest('tr');
      const input = tr?.querySelector('.inv-aggh-extra');
      if (input) {
        const val = prompt('Adicionar extra AGGH para este mês (valor único):', input.value || '');
        if (val !== null) input.value = val;
      }
      return;
    }

    // Handle save button
    const saveBtn = ev.target.closest('.btn-save');
    if (saveBtn) {
      const tr = saveBtn.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;

      const manualSW = null;
      const manualAG = null;
      const extraSW = parseFloat(tr.querySelector('.inv-swda-extra')?.value);
      const extraAG = parseFloat(tr.querySelector('.inv-aggh-extra')?.value);

      const swda = parseFloat(tr.querySelector('.swda')?.value) || null;
      const aggh = parseFloat(tr.querySelector('.aggh')?.value) || null;
      const cash = parseFloat(tr.querySelector('.cash')?.value) || null;

      try {
        saveBtn.textContent = '⏳';
        saveBtn.disabled = true;

        await saveRow(id, {
          swda_value: swda,
          aggh_value: aggh,
          cash_interest: cash,
          manual_inv_swda: Number.isFinite(manualSW) ? manualSW : null,
          manual_inv_aggh: Number.isFinite(manualAG) ? manualAG : null,
          manual_inv_swda_extra: Number.isFinite(extraSW) ? extraSW : null,
          manual_inv_aggh_extra: Number.isFinite(extraAG) ? extraAG : null,
          manual_swda_value: swda,
          manual_aggh_value: aggh
        });

        saveBtn.textContent = '✅';
        setTimeout(() => {
          saveBtn.textContent = '✓';
          saveBtn.disabled = false;
        }, 1000);

        await boot(true);
      } catch (err) {
        saveBtn.textContent = '❌';
        saveBtn.disabled = false;
        alert(err.message || 'Erro ao gravar. Tente novamente.');
        setTimeout(() => {
          saveBtn.textContent = '✓';
        }, 2000);
      }
      return;
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
  
  // Toggle Params button (ID changed from params-juro-container to params-container)
  const toggleParamsBtn = document.getElementById('btn-toggle-params');
  const paramsContainer = document.getElementById('params-container');
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

    const now = new Date();

    // NEW: Load live data
    state.liveData = await loadLiveData();
    updateJuroDisplay();

    await ensureMonthsExist(state.params.endYM);
    const docs = await loadAllDocs();

    // Só considerar meses até ao mês corrente (ou endYM se for mais cedo)
    const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
    const viewLimit = ymMin(state.params.endYM, nowYM);
    const limId = `${viewLimit.y}-${String(viewLimit.m).padStart(2,'0')}`;
    const subset = docs.filter(d => d.id <= limId);

    // MODIFIED: Pass liveData to buildModel
    const rows = buildModel(subset, state.params, state.liveData);
    state.rows = rows; // Store rows for chart data
    broadcastInvestedTotals(rows);

    // Initialize charts
    initializeCharts();
    
    // Update charts with data
    const chartData = prepareChartData(rows, state.params);
    if (chartData) {
      state.chartData = chartData;
      if (!state.chartRange) {
        state.chartRange = determineDefaultChartRange(chartData.labels) || chartData.labels.length;
      } else if (state.chartRange > chartData.labels.length) {
        state.chartRange = chartData.labels.length;
      } else if (state.chartRange < 1) {
        state.chartRange = 1;
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
      // Recalculate juro acumulado depois da tabela estar disponível
      updateJuroDisplay();
    }

    // Calculate and update KPIs
    const kpis = calculateKPIs(rows, state.liveData);
    const obsRoot = document.getElementById('dca-table-wrap');
    const totalInterest = somaJuroTabelaDCA(obsRoot, { excludeCurrentMonth: true });
    updateKPIs(kpis, totalInterest);

    // Calculate and update advanced metrics
    const advancedMetrics = calculateAdvancedMetrics(rows, state.params, state.liveData);
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
      const scenarioRow = { ...kpis.lastFilledRow, totalNow: kpis.currentValue };
      const scenarios = calculateScenarios(scenarioRow, state.params);
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

document.getElementById('btn-save-saldo')?.addEventListener('click', async () => {
  const input = document.getElementById('juro-saldo-display');
  if (!input) return;

  const newSaldo = parseFloat(input.value);
  if (!Number.isFinite(newSaldo) || newSaldo < 0) {
    alert('Saldo inválido. Por favor, introduza um valor válido.');
    return;
  }

  try {
    await saveJuroSaldo(newSaldo);
    state.liveData.saldo = newSaldo;
    updateLiveCalculations();
  } catch (err) {
    alert(err.message || 'Erro ao guardar saldo.');
  }
});

// ---------- Listen for Quote Updates ----------
window.addEventListener('dca:quotes-updated', (event) => {
  state.liveData.quotes = event.detail;
  updateLiveCalculations();
});

// ---------- Listen for Share Updates ----------
window.addEventListener('dca:shares-updated', (event) => {
  state.liveData.shares = event.detail;
  updateLiveCalculations();
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
    initEtfQuotes();
    boot();
  }, { once: true });
} else {
  bindGlobalButtons();
  initJuroModule();
  initializeChartControls();
  initEtfQuotes();
  boot();
}
