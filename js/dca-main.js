// js/dca-main.js - Main initialization and event binding

import {
  START_YM, DEFAULTS, TAXA_ANUAL_FIXA,
  ensureMonthsExist, loadParams, saveParams, loadAllDocs, saveRow,
  loadJuroSaldo, saveJuroSaldo,
  ymCompare, getPreviousMonth, ymMin,
  loadShareQuantities,
  loadAutomationSettings, saveAutomationSettings,
  loadReinforcements, loadRecentJuroMovements, loadMonthlyClosures,
  createReinforcement, voidReinforcement, reconcileShareQuantities
} from './dca-core.js';

import { 
  buildModel, calculateKPIs, calculateProgress,
  calculateGoalStatus, calculateJuroMensal, somaJuroTabelaDCA,
  prepareChartData, calculateAdvancedMetrics, calculateRebalancingSuggestions
} from './dca-calculations.js';

import {
  renderTable, applyYearVisibility, updateKPIs, updateProgressBar,
  updateGoalStatus, writeParamsToUI, readParamsFromUI,
  addScrollIndicators, showLoading, showError,
  initializeCharts, updatePerformanceChart, exportChartAsImage,
  updateAdvancedMetrics, updateRebalancingSuggestions,
  exportToCSV
} from './dca-ui.js';
import { initEtfQuotes } from './dca-quotes.js';
import { whenAccessResolved } from './script.js';
import { showConfirm, showToast } from './toast.js';

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
  showPastYears: false,
  showFutureYears: false,
  isLoading: false,
  rows: [],
  chartType: 'portfolio-growth',
  chartRange: null,
  chartData: null,
  rebalancingAlertSent: false,
  accessMode: 'write',
  automation: null,
  reinforcements: [],
  juroMovements: [],
  closures: [],
  reinforcementOperationId: null,
  reconciliation: null,

  // NEW: Live data tracking
  liveData: {
    quotes: null,        // { vwce: {...}, aggh: {...} }
    shares: null,        // { vwce: 1.2345, aggh: 0.5678 }
    saldo: 0,           // Current cash balance
    juroLive: 0         // Live juro calculation (previous month)
  }
};

function applyDcaReadOnlyUI() {
  if (state.accessMode !== 'read') return;

  const inputs = [
    '#etf-vwce-qty', '#etf-aggh-qty', '#juro-saldo', '#juro-saldo-display',
    '#end-date', '#pct-swda', '#pct-aggh', '#monthly-contribution',
    '#automation-enabled', '#automation-effective-from', '#automation-vwce-amount', '#automation-aggh-amount',
    '#automation-interest-rate',
    '.swda', '.aggh', '.cash', '.inv-swda-extra', '.inv-aggh-extra'
  ];
  document.querySelectorAll(inputs.join(',')).forEach(element => { element.disabled = true; });

  const writeButtons = [
    '#btn-save-saldo', '#btn-juro-gravar', '#btn-save-params',
    '#btn-save-automation', '#btn-new-reinforcement', '#btn-new-reinforcement-secondary',
    '#btn-use-rebalance', '#btn-reconcile-shares', '.btn-void-reinforcement',
    '.btn-save-qty', '.btn-save', '.btn-add-inv-swda', '.btn-add-inv-aggh'
  ];
  document.querySelectorAll(writeButtons.join(',')).forEach(element => {
    element.disabled = true;
    element.hidden = true;
  });
}

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
    const shares = await loadShareQuantities({ readOnly: state.accessMode === 'read' });

    // Load saldo
    const juroData = await loadJuroSaldo();
    const saldo = juroData.saldo || 0;
    const annualInterestRate = Number(state.automation?.annualInterestRate ?? juroData.taxa ?? TAXA_ANUAL_FIXA);

    // Calculate juro for previous month (mês atual - 1)
    const now = new Date();
    const prevYM = getPreviousMonth({ y: now.getFullYear(), m: now.getMonth() + 1 });
    const juroLive = calculateJuroMensal(
      saldo,
      `${prevYM.y}-${String(prevYM.m).padStart(2, '0')}`,
      annualInterestRate
    );

    return {
      quotes,
      shares,
      saldo,
      juroLive,
      lastClosedMonth: juroData.lastClosedMonth || null,
      lastMonthlyInterest: Number(juroData.lastMonthlyInterest) || null,
      annualInterestRate,
      balanceUpdatedAt: juroData.updatedAt?.toDate?.() || juroData.updatedAt || null
    };
  } catch (err) {
    console.error('Error loading live data:', err);
    return {
      quotes: null,
      shares: { vwce: 0, aggh: 0 },
      saldo: 0,
      juroLive: 0,
      lastClosedMonth: null,
      lastMonthlyInterest: null
    };
  }
}

function updateLiveCalculations() {
  if (!state.liveData.shares) return;

  // Recalculate juro
  const now = new Date();
  const prevYM = getPreviousMonth({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const prevYMStr = `${prevYM.y}-${String(prevYM.m).padStart(2, '0')}`;
  state.liveData.juroLive = calculateJuroMensal(state.liveData.saldo, prevYMStr, state.liveData.annualInterestRate);

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
  const target = new Date(currentYear, currentMonth - 1, 1);
  target.setMonth(target.getMonth() + 3);
  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth() + 1;

  let targetIndex = -1;
  let closestBeforeIndex = -1;
  let lastAvailableIndex = labels.length - 1;

  labels.forEach((label, idx) => {
    const { month, year } = parseLabelToYM(label);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;

    // Exact match for target month/year (current + 3 months)
    if (year === targetYear && month === targetMonth) {
      targetIndex = idx;
    }
    // Closest month before or equal to target
    else if (year < targetYear || (year === targetYear && month < targetMonth)) {
      closestBeforeIndex = idx;
    }
  });

  // Priority: target month → closest before → last available
  let chosenIndex = -1;
  if (targetIndex >= 0) {
    chosenIndex = targetIndex;
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

function hasCurrentMonthData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const currentRow = rows.find(row => row.isCurrent);
  return !!currentRow?.hasCurrent;
}

function broadcastInvestedTotals(rows) {
  const totals = getInvestedTotalsUntil(rows);
  window.dispatchEvent(new CustomEvent('dca:invested-totals', {
    detail: { ...totals, hasCurrentData: hasCurrentMonthData(rows) }
  }));
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

const money = value => (Number(value) || 0).toLocaleString('pt-PT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
});
const units = value => (Number(value) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 8 });
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const asDate = value => value?.toDate?.() || (value ? new Date(value) : null);
const formatDateTime = value => {
  const date = asDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-PT') : '—';
};

function writeAutomationToUI() {
  if (!state.automation) return;
  const fields = {
    'automation-enabled': String(state.automation.enabled),
    'automation-effective-from': state.automation.effectiveFrom,
    'automation-vwce-amount': state.automation.vwceAmount,
    'automation-aggh-amount': state.automation.agghAmount,
    'automation-interest-rate': state.automation.annualInterestRate * 100
  };
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.value = value;
  });
  const badge = document.getElementById('automation-enabled-badge');
  if (badge) {
    badge.textContent = state.automation.enabled ? 'Ativo' : 'Pausado';
    badge.classList.toggle('is-paused', !state.automation.enabled);
  }
}

function updateOverview() {
  const allocationEl = document.getElementById('kpi-allocation');
  const portfolio = window.DcaFinancial?.calculatePortfolioValue({
    shares: state.liveData.shares,
    quotes: state.liveData.quotes,
    balance: state.liveData.saldo
  });
  if (allocationEl) {
    if (portfolio?.etfValue > 0) {
      allocationEl.textContent = `VWCE ${(portfolio.vwceValue / portfolio.etfValue * 100).toFixed(1)}% · AGGH ${(portfolio.agghValue / portfolio.etfValue * 100).toFixed(1)}%`;
    } else {
      const fallback = [...state.rows].reverse().find(row => row.etfTotalNow > 0);
      allocationEl.textContent = fallback
        ? `VWCE ${(fallback.swdaNow / fallback.etfTotalNow * 100).toFixed(1)}% · AGGH ${(fallback.agghNow / fallback.etfTotalNow * 100).toFixed(1)}% (último registo)`
        : '—';
    }
  }
}

function renderJuroMovements() {
  const root = document.getElementById('juro-movements-list');
  if (!root) return;
  if (!state.juroMovements.length) {
    root.innerHTML = '<p class="muted">Ainda não existem movimentos.</p>';
    return;
  }
  const labels = {
    deposit: 'Depósito', withdrawal: 'Levantamento', dca: 'DCA', reinforcement: 'Reforço',
    reinforcement_void: 'Anulação de reforço', interest: 'Juro', manual_correction: 'Correção manual', set_balance: 'Correção antiga'
  };
  root.innerHTML = state.juroMovements.map(item => `
    <div class="dca-list-row">
      <span><strong>${escapeHTML(labels[item.type] || item.type || 'Movimento')}</strong><small>${escapeHTML(formatDateTime(item.effectiveAt))}</small></span>
      <span class="num">${item.amount == null ? '—' : money(item.amount)}<small>Saldo: ${money(item.balanceAfter ?? item.balance)}</small></span>
      ${item.description ? `<span class="dca-list-note">${escapeHTML(item.description)}</span>` : ''}
    </div>`).join('');
}

function renderReinforcementsHistory() {
  const root = document.getElementById('reinforcements-history');
  if (!root) return;
  if (!state.reinforcements.length) {
    root.innerHTML = '<p class="muted">Ainda não existem reforços.</p>';
    return;
  }
  root.innerHTML = `<div class="table-wrap"><table class="table-dca dca-reinforcement-table"><thead><tr>
    <th>Data</th><th>Total</th><th>VWCE</th><th>AGGH</th><th>Origem</th><th>Execução</th><th>Notas</th><th>Estado</th><th></th>
  </tr></thead><tbody>${state.reinforcements.map(item => {
    const active = (item.status || 'active') === 'active';
    return `<tr class="${active ? '' : 'is-void'}" data-reinforcement-id="${escapeHTML(item.id)}">
      <td>${escapeHTML(item.date)}</td><td class="num">${money(item.totalAmount ?? Number(item.totalAmountCents) / 100)}</td>
      <td class="num">${money(item.vwceAmount)}<small>${units(item.vwceQuantity)} un. @ ${money(item.vwcePrice)}</small></td>
      <td class="num">${money(item.agghAmount)}<small>${units(item.agghQuantity)} un. @ ${money(item.agghPrice)}</small></td>
      <td>${item.fundingSource === 'trade_republic_balance' ? 'Saldo TR' : 'Capital externo'}</td>
      <td><small>${escapeHTML(item.quoteSource || 'manual')}<br>${escapeHTML(formatDateTime(item.quoteTimestamp))}</small></td>
      <td>${escapeHTML(item.notes || '—')}</td><td>${active ? 'Ativo' : 'Anulado'}</td>
      <td>${active && state.accessMode === 'write' ? '<button type="button" class="btn-void-reinforcement">Anular</button>' : ''}</td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function reinforcementInput() {
  const value = id => document.getElementById(id)?.value;
  const liveVWCE = Number(state.liveData.quotes?.vwce?.price);
  const liveAGGH = Number(state.liveData.quotes?.aggh?.price);
  const enteredVWCE = Number(value('reinforcement-vwce-price'));
  const enteredAGGH = Number(value('reinforcement-aggh-price'));
  const usesLive = Number.isFinite(liveVWCE) && Number.isFinite(liveAGGH)
    && Math.abs(enteredVWCE - liveVWCE) < 0.000001 && Math.abs(enteredAGGH - liveAGGH) < 0.000001;
  return {
    operationId: state.reinforcementOperationId,
    date: value('reinforcement-date'),
    totalAmount: value('reinforcement-total'),
    allocationMode: value('reinforcement-mode'),
    vwcePercentage: value('reinforcement-vwce-pct'),
    agghPercentage: value('reinforcement-aggh-pct'),
    vwceAmount: value('reinforcement-vwce-amount'),
    agghAmount: value('reinforcement-aggh-amount'),
    vwcePrice: value('reinforcement-vwce-price'),
    agghPrice: value('reinforcement-aggh-price'),
    fundingSource: value('reinforcement-source'),
    notes: value('reinforcement-notes'),
    currentShares: state.liveData.shares,
    currentBalance: state.liveData.saldo,
    currentVWCE: (Number(state.liveData.shares?.vwce) || 0) * (enteredVWCE || 0),
    currentAGGH: (Number(state.liveData.shares?.aggh) || 0) * (enteredAGGH || 0),
    vwceTarget: state.params.pctSWDA,
    agghTarget: state.params.pctAGGH,
    quoteSource: usesLive ? 'alpha_vantage' : 'manual',
    quoteTimestamp: usesLive ? (window.dcaQuoteUpdatedAt || new Date()) : null
  };
}

function updateReinforcementPreview() {
  const mode = document.getElementById('reinforcement-mode')?.value;
  document.querySelectorAll('.reinforcement-percentage').forEach(element => { element.hidden = mode !== 'manual_percentage'; });
  const amountFields = ['reinforcement-vwce-amount', 'reinforcement-aggh-amount'].map(id => document.getElementById(id));
  amountFields.forEach(element => { if (element) element.readOnly = mode !== 'manual_amounts'; });
  const previewRoot = document.getElementById('reinforcement-preview');
  const feedback = document.getElementById('reinforcement-feedback');
  if (feedback) feedback.textContent = '';
  try {
    const input = reinforcementInput();
    if (!input.totalAmount) {
      if (previewRoot) previewRoot.innerHTML = '<p class="muted">Introduza um montante para ver a pré-visualização.</p>';
      return null;
    }
    const preview = window.DcaFinancial.buildReinforcementPreview(input);
    if (mode !== 'manual_amounts') {
      document.getElementById('reinforcement-vwce-amount').value = preview.vwceAmount.toFixed(2);
      document.getElementById('reinforcement-aggh-amount').value = preview.agghAmount.toFixed(2);
    }
    const beforeAllocation = window.DcaFinancial.calculateAllocation({
      currentVWCE: preview.beforeValues.vwceValue, currentAGGH: preview.beforeValues.agghValue,
      vwceTarget: state.params.pctSWDA, agghTarget: state.params.pctAGGH
    });
    const afterAllocation = window.DcaFinancial.calculateAllocation({
      currentVWCE: preview.afterValues.vwceValue, currentAGGH: preview.afterValues.agghValue,
      vwceTarget: state.params.pctSWDA, agghTarget: state.params.pctAGGH
    });
    const suggestion = document.getElementById('reinforcement-suggestion');
    if (suggestion) suggestion.textContent = mode === 'automatic'
      ? `Distribuição sugerida para rebalancear com novo capital: ${money(preview.vwceAmount)} em VWCE e ${money(preview.agghAmount)} em AGGH.`
      : '';
    if (previewRoot) previewRoot.innerHTML = `
      <div><span>Montante</span><strong>${money(preview.totalAmount)}</strong></div>
      <div><span>VWCE</span><strong>${money(preview.vwceAmount)} · ${units(preview.vwceQuantity)} un.</strong><small>Preço ${money(preview.vwcePrice)}</small></div>
      <div><span>AGGH</span><strong>${money(preview.agghAmount)} · ${units(preview.agghQuantity)} un.</strong><small>Preço ${money(preview.agghPrice)}</small></div>
      <div><span>Posição antes</span><strong>${money(preview.beforeValues.etfValue)}</strong><small>${units(preview.currentShares.vwce)} VWCE · ${units(preview.currentShares.aggh)} AGGH</small></div>
      <div><span>Posição depois</span><strong>${money(preview.afterValues.etfValue)}</strong><small>${units(preview.afterShares.vwce)} VWCE · ${units(preview.afterShares.aggh)} AGGH</small></div>
      <div><span>Distribuição</span><strong>${beforeAllocation.vwcePct.toFixed(1)}% / ${beforeAllocation.agghPct.toFixed(1)}% → ${afterAllocation.vwcePct.toFixed(1)}% / ${afterAllocation.agghPct.toFixed(1)}%</strong></div>
      <div><span>Impacto no saldo</span><strong>${money(preview.balanceImpact)}</strong><small>Saldo depois: ${money(preview.afterValues.balance)}</small></div>
      <div><span>Origem da cotação</span><strong>${input.quoteSource === 'alpha_vantage' ? 'Alpha Vantage' : 'Preço manual'}</strong><small>${input.quoteTimestamp ? formatDateTime(input.quoteTimestamp) : 'Introduzido pelo utilizador'}</small></div>`;
    return preview;
  } catch (error) {
    if (previewRoot) previewRoot.innerHTML = '';
    if (feedback) {
      feedback.textContent = error.message;
      feedback.className = 'form-feedback error';
    }
    return null;
  }
}

function openReinforcement(prefill = {}) {
  if (state.accessMode !== 'write') return;
  const dialog = document.getElementById('reinforcement-dialog');
  const form = document.getElementById('reinforcement-form');
  if (!dialog || !form) return;
  form.reset();
  state.reinforcementOperationId = globalThis.crypto?.randomUUID?.().replace(/-/g, '_')
    || `reinforcement_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const today = new Date();
  document.getElementById('reinforcement-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  document.getElementById('reinforcement-mode').value = prefill.mode || 'automatic';
  document.getElementById('reinforcement-total').value = prefill.total || '';
  document.getElementById('reinforcement-vwce-pct').value = state.params.pctSWDA;
  document.getElementById('reinforcement-aggh-pct').value = state.params.pctAGGH;
  document.getElementById('reinforcement-vwce-price').value = state.liveData.quotes?.vwce?.price || '';
  document.getElementById('reinforcement-aggh-price').value = state.liveData.quotes?.aggh?.price || '';
  updateReinforcementPreview();
  dialog.showModal();
}

function updateRebalancingPreview(rebalancingData = null) {
  const root = document.getElementById('rebalance-preview');
  if (!root) return;
  const amount = Number(document.getElementById('rebalance-amount')?.value);
  const data = rebalancingData || calculateRebalancingSuggestions(state.rows, state.params, state.liveData);
  if (!data || !Number.isFinite(amount) || amount <= 0) {
    root.textContent = '—';
    return;
  }
  try {
    const allocation = window.DcaFinancial.calculateReinforcementAllocation({
      totalAmount: amount,
      currentVWCE: data.allocations.find(item => item.asset === 'VWCE')?.current / 100 * data.totalValue,
      currentAGGH: data.allocations.find(item => item.asset === 'AGGH')?.current / 100 * data.totalValue,
      vwceTarget: state.params.pctSWDA,
      agghTarget: state.params.pctAGGH
    });
    root.textContent = `VWCE ${money(allocation.vwceAmount)} · AGGH ${money(allocation.agghAmount)} (${data.source === 'live' ? 'cotações atuais' : 'último registo mensal'})`;
  } catch (error) {
    root.textContent = error.message;
  }
}

function updateReconciliation() {
  const root = document.getElementById('reconciliation-status');
  const button = document.getElementById('btn-reconcile-shares');
  if (!root || !button) return;
  const latest = [...state.closures].reverse().find(item => item.status === 'complete' && item.sharesAfterPurchase);
  if (!latest) {
    root.innerHTML = '<p class="muted">A reconciliação fica disponível depois do primeiro fecho automático com unidades registadas.</p>';
    button.hidden = true;
    return;
  }
  const sinceMonth = latest.currentMonth || latest.month;
  const laterReinforcements = state.reinforcements.filter(item => (item.month || item.date?.slice(0, 7)) >= sinceMonth);
  const expected = window.DcaFinancial.calculateExpectedShares({ baselineShares: latest.sharesAfterPurchase, reinforcements: laterReinforcements });
  const current = state.liveData.shares || { vwce: 0, aggh: 0 };
  const differs = Math.abs(expected.vwce - current.vwce) > 0.0000001 || Math.abs(expected.aggh - current.aggh) > 0.0000001;
  state.reconciliation = { expected, current, differs, baselineMonth: latest.month };
  root.innerHTML = differs
    ? `<p class="neg">Existe uma diferença entre as unidades calculadas e as unidades registadas.</p><p>Esperado: VWCE ${units(expected.vwce)} · AGGH ${units(expected.aggh)}<br>Registado: VWCE ${units(current.vwce)} · AGGH ${units(current.aggh)}</p>`
    : `<p class="pos">As unidades coincidem com o histórico desde o fecho de ${escapeHTML(latest.month)}.</p>`;
  button.hidden = !differs || state.accessMode !== 'write';
}

function bindDcaFeatures() {
  ['btn-new-reinforcement', 'btn-new-reinforcement-secondary'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => openReinforcement());
  });
  document.querySelectorAll('[data-close-reinforcement]').forEach(button => {
    button.addEventListener('click', () => document.getElementById('reinforcement-dialog')?.close());
  });
  document.getElementById('reinforcement-dialog')?.addEventListener('click', event => {
    if (event.target.id === 'reinforcement-dialog') event.target.close();
  });
  document.getElementById('reinforcement-form')?.addEventListener('input', updateReinforcementPreview);
  document.getElementById('reinforcement-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const preview = updateReinforcementPreview();
    if (!preview) return;
    const button = document.getElementById('btn-save-reinforcement');
    button.disabled = true;
    try {
      await createReinforcement(reinforcementInput());
      document.getElementById('reinforcement-dialog').close();
      showToast('Reforço registado e posições atualizadas.', 'success');
      await boot(true);
    } catch (error) {
      showFeedback('reinforcement-feedback', error.message || 'Não foi possível registar o reforço.', 'error', 8000);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById('reinforcements-history')?.addEventListener('click', event => {
    const button = event.target.closest('.btn-void-reinforcement');
    if (!button) return;
    const id = button.closest('[data-reinforcement-id]')?.dataset.reinforcementId;
    if (!id) return;
    showConfirm('Anular este reforço? As unidades e, se aplicável, o saldo serão revertidos. O registo será preservado.', async () => {
      try {
        await voidReinforcement(id, 'Anulação confirmada pelo utilizador');
        showToast('Reforço anulado com registo de auditoria.', 'success');
        await boot(true);
      } catch (error) {
        showToast(error.message, 'error', 6000);
      }
    }, null, { confirmLabel: 'Anular reforço' });
  });
  document.getElementById('btn-save-automation')?.addEventListener('click', event => {
    const button = event.currentTarget;
    showConfirm('Guardar estas definições no plano automático real?', async () => {
      button.disabled = true;
      try {
        state.automation = await saveAutomationSettings({
          enabled: document.getElementById('automation-enabled').value === 'true',
          effectiveFrom: document.getElementById('automation-effective-from').value,
          vwceAmount: document.getElementById('automation-vwce-amount').value,
          agghAmount: document.getElementById('automation-aggh-amount').value,
          annualInterestRate: Number(document.getElementById('automation-interest-rate').value) / 100,
          timezone: 'Europe/Lisbon', day: 1, time: '01:10'
        });
        showFeedback('automation-feedback', 'Plano automático guardado.');
        await boot(true);
      } catch (error) {
        showFeedback('automation-feedback', error.message, 'error', 6000);
      } finally {
        button.disabled = false;
      }
    }, null, { confirmLabel: 'Guardar plano real' });
  });
  document.getElementById('btn-focus-balance')?.addEventListener('click', () => {
    document.getElementById('juro-saldo-display')?.focus();
    document.getElementById('juro-saldo-display')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    const container = document.getElementById('params-container');
    if (container) container.style.display = 'block';
    document.getElementById('btn-open-settings')?.setAttribute('aria-expanded', 'true');
    container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    const container = document.getElementById('params-container');
    if (container) container.style.display = 'none';
    document.getElementById('btn-open-settings')?.setAttribute('aria-expanded', 'false');
    document.getElementById('btn-open-settings')?.focus();
  });
  document.getElementById('rebalance-amount')?.addEventListener('input', () => updateRebalancingPreview());
  document.getElementById('btn-use-rebalance')?.addEventListener('click', () => openReinforcement({
    total: document.getElementById('rebalance-amount')?.value,
    mode: 'automatic'
  }));
  document.getElementById('btn-reconcile-shares')?.addEventListener('click', () => {
    if (!state.reconciliation?.differs) return;
    showConfirm('Substituir explicitamente as quantidades registadas pelas quantidades calculadas? Será criado um registo de auditoria.', async () => {
      try {
        await reconcileShareQuantities(state.reconciliation.expected, `Reconciliação desde ${state.reconciliation.baselineMonth}`);
        showToast('Quantidades reconciliadas.', 'success');
        await boot(true);
      } catch (error) {
        showToast(error.message, 'error', 6000);
      }
    }, null, { confirmLabel: 'Reconciliar' });
  });
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
    // Handle save button
    const saveBtn = ev.target.closest('.btn-save');
    if (saveBtn) {
      const tr = saveBtn.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;

      const manualSW = null;
      const manualAG = null;
      const optionalNumber = selector => {
        const raw = tr.querySelector(selector)?.value;
        if (raw === '' || raw == null) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) throw new Error('Os valores mensais devem ser números não negativos.');
        return Math.round(value * 100) / 100;
      };
      let extraSW;
      let extraAG;
      let swda;
      let aggh;
      let cash;
      try {
        extraSW = optionalNumber('.inv-swda-extra');
        extraAG = optionalNumber('.inv-aggh-extra');
        swda = optionalNumber('.swda');
        aggh = optionalNumber('.aggh');
        cash = optionalNumber('.cash');
      } catch (error) {
        showToast(error.message, 'warning');
        return;
      }

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
        showToast(err.message || 'Erro ao gravar. Tente novamente.', 'error');
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
  const pastBtn = document.getElementById('toggle-past-years');
  if (pastBtn && !pastBtn.__bound) {
    pastBtn.__bound = true;
    pastBtn.addEventListener('click', () => {
      state.showPastYears = !state.showPastYears;
      applyYearVisibility({ showPastYears: state.showPastYears, showFutureYears: state.showFutureYears });
    });
  }

  const futureBtn = document.getElementById('toggle-future-years');
  if (futureBtn && !futureBtn.__bound) {
    futureBtn.__bound = true;
    futureBtn.addEventListener('click', async () => {
      state.showFutureYears = !state.showFutureYears;
      if (state.showFutureYears) {
        const endDateVal = document.getElementById('end-date')?.value;
        if (endDateVal) {
          const [ey, em] = endDateVal.split('-').map(Number);
          if (Number.isFinite(ey) && Number.isFinite(em)) {
            state.params = { ...state.params, endYM: { y: ey, m: em } };
          }
        }
      }
      await boot(true);
    });
  }
  
  const exportBtn = document.getElementById('export-csv-inline');
  if (exportBtn && !exportBtn.__bound) {
    exportBtn.__bound = true;
    exportBtn.addEventListener('click', () => {
      if (state.rows && state.rows.length > 0) {
        exportToCSV(state.rows);
      } else {
        showToast('Não há dados para exportar.', 'warning');
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
      state.params = await loadParams({ readOnly: state.accessMode === 'read' });
      writeParamsToUI(state.params);
    }

    state.automation = await loadAutomationSettings({ readOnly: state.accessMode === 'read' });
    writeAutomationToUI();
    [state.reinforcements, state.juroMovements, state.closures] = await Promise.all([
      loadReinforcements(),
      loadRecentJuroMovements(),
      loadMonthlyClosures()
    ]);
    renderReinforcementsHistory();
    renderJuroMovements();

    const now = new Date();

    // NEW: Load live data
    state.liveData = await loadLiveData();
    updateJuroDisplay();

    if (state.accessMode !== 'read') {
      await ensureMonthsExist(state.params.endYM);
    }
    const docs = await loadAllDocs();

    // Por defeito, mostrar o ano corrente completo (Jan–Dez). Se "anos futuros" estiver ativo,
    // mostrar até à data final (endYM).
    const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
    const yearEndYM = { y: nowYM.y, m: 12 };
    const viewLimit = state.showFutureYears ? state.params.endYM : ymMin(state.params.endYM, yearEndYM);
    const limId = `${viewLimit.y}-${String(viewLimit.m).padStart(2,'0')}`;
    const subset = docs.filter(d => d.id <= limId);
    const chartLimitId = `${state.params.endYM.y}-${String(state.params.endYM.m).padStart(2,'0')}`;
    const chartDocs = docs.filter(d => d.id <= chartLimitId);

    // MODIFIED: Pass liveData to buildModel
    const rows = buildModel(subset, state.params, state.liveData, state.reinforcements, state.closures);
    const chartRows = buildModel(chartDocs, state.params, state.liveData, state.reinforcements, state.closures);
    state.rows = rows; // Store rows for table/export
    broadcastInvestedTotals(rows);

    // Initialize charts
    initializeCharts();
    
    // Update charts with data
    const chartData = prepareChartData(chartRows, state.params, state.liveData);
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
      applyYearVisibility({ showPastYears: state.showPastYears, showFutureYears: state.showFutureYears });
      applyDcaReadOnlyUI();
      // Recalculate juro acumulado depois da tabela estar disponível
      updateJuroDisplay();
    }

    // Calculate and update KPIs
    const kpis = calculateKPIs(rows, state.liveData);
    const obsRoot = document.getElementById('dca-table-wrap');
    const totalInterest = somaJuroTabelaDCA(obsRoot, { excludeCurrentMonth: true });
    updateKPIs(kpis, totalInterest);
    updateOverview();

    // Calculate and update advanced metrics
    const advancedMetrics = calculateAdvancedMetrics(rows, state.params, state.liveData);
    updateAdvancedMetrics(advancedMetrics);

    // Calculate rebalancing suggestions
    const rebalancingData = calculateRebalancingSuggestions(rows, state.params, state.liveData);
    updateRebalancingSuggestions(rebalancingData);
    updateRebalancingPreview(rebalancingData);
    maybeSendRebalancingAlert(rebalancingData);

    // Update progress bar
    const progress = calculateProgress(state.params);
    updateProgressBar(progress);

    // Update goal status
    const goalStatus = calculateGoalStatus(kpis, progress);
    updateGoalStatus(goalStatus);

    // Add scroll indicators
    requestAnimationFrame(addScrollIndicators);
    updateReconciliation();

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
  const p = readParamsFromUI(state.params);
  if (!p.pctSumOk) {
    showFeedback('params-feedback', 'As percentagens VWCE+AGGH devem somar 100%.', 'error');
    return;
  }
  if (!Number.isFinite(p.monthlyContribution) || p.monthlyContribution < 0) {
    showFeedback('params-feedback', 'A contribuição mensal deve ser um valor não negativo.', 'error');
    return;
  }
  if (!p.endYM?.y || !p.endYM?.m || ymCompare(p.endYM, START_YM) < 0) {
    showFeedback('params-feedback', 'A data final não pode ser anterior a setembro de 2025.', 'error');
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
    showToast('Saldo inválido. Introduza um valor não negativo.', 'warning');
    return;
  }

  try {
    await saveJuroSaldo(newSaldo, 'Correção manual do saldo');
    state.liveData.saldo = newSaldo;
    showToast('Saldo corrigido e movimento registado.', 'success');
    await boot(true);
  } catch (err) {
    showToast(err.message || 'Erro ao guardar saldo.', 'error');
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
async function initializeDcaPage() {
  const access = await whenAccessResolved();
  if (access.moduleKey !== 'dca' || access.mode === 'none') return;
  state.accessMode = access.mode;
  bindGlobalButtons();
  bindDcaFeatures();
  await initJuroModule();
  initializeChartControls();
  await initEtfQuotes({ readOnly: state.accessMode === 'read' });
  await boot();
  applyDcaReadOnlyUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDcaPage, { once: true });
} else {
  initializeDcaPage();
}
