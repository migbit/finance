// js/dca-main.js - Main initialization and event binding

import { 
  START_YM, DEFAULTS, TAXA_ANUAL_FIXA,
  ensureMonthsExist, loadParams, saveParams, loadAllDocs, saveRow,
  loadJuroSaldo, saveJuroSaldo, isAuthenticated, onAuthChange
} from './dca-core.js';

import {
  buildModel, calculateKPIs, calculateScenarios, calculateProgress,
  calculateGoalStatus, calculateJuroMensal, somaJuroTabelaDCA, diasNoMes
} from './dca-calculations.js';

import {
  renderTable, applyYearVisibility, updateKPIs, updateProgressBar,
  updateGoalStatus, updateScenarios, writeParamsToUI, readParamsFromUI,
  updateJuroUI, addScrollIndicators, showLoading, showError
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
  isLoading: false
};

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
  document.getElementById('btn-juro-editar')?.addEventListener('click', () => {
    saldoInp.removeAttribute('disabled');
    saldoInp.focus();
  });

  document.getElementById('btn-juro-gravar')?.addEventListener('click', async () => {
    saldoInp.setAttribute('disabled', 'disabled');
    try {
      await saveJuroSaldo(saldoInp.value);
      const data = await loadJuroSaldo();
      if (data.saldo != null) {
        saldoInp.value = parseFloat(data.saldo).toFixed(2);
      }
    } catch (err) {
      alert(err.message || 'Erro ao gravar saldo.');
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
        b.textContent = '💾';
        b.disabled = false;
      }, 1000);

      await boot(true);
    } catch (err) {
      b.textContent = '❌';
      b.disabled = false;
      alert(err.message || 'Erro ao gravar. Tente novamente.');
      setTimeout(() => {
        b.textContent = '💾';
      }, 2000);
    }
  });
}

// ---------- Toggle Years Button ----------
function bindGlobalButtons() {
  const btn = document.getElementById('toggle-others');
  if (!btn || btn.__bound) return;
  btn.__bound = true;
  
  btn.addEventListener('click', () => {
    state.showOthers = !state.showOthers;
    applyYearVisibility(state.showOthers);
  });
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
    }

    await ensureMonthsExist(state.params.endYM);
    const docs = await loadAllDocs();

    const limId = `${state.params.endYM.y}-${String(state.params.endYM.m).padStart(2,'0')}`;
    const subset = docs.filter(d => d.id <= limId);
    const rows = buildModel(subset, state.params);

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

    // Update progress bar
    const progress = calculateProgress(state.params);
    updateProgressBar(progress);

    // Update goal status
    const goalStatus = calculateGoalStatus(kpis, progress);
    updateGoalStatus(goalStatus);

    // Update scenarios
    if (kpis && kpis.lastFilledRow) {
      const scenarios = calculateScenarios(kpis.lastFilledRow.totalNow);
      updateScenarios(scenarios);
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
    alert('As percentagens VWCE+AGGH devem somar 100%.');
    return;
  }
  
  const { pctSumOk, ...params } = p;
  state.params = params;
  
  try {
    await saveParams(params);
    await boot(true);
  } catch (err) {
    alert(err.message || 'Erro ao gravar parâmetros.');
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
    boot();
  }, { once: true });
} else {
  bindGlobalButtons();
  initJuroModule();
  boot();
}