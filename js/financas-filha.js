import { whenAccessResolved } from './script.js';
import { showConfirm, showToast } from './toast.js';
import {
  CHILD_PROFILES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  VAULT_TERMS,
  aggregateCategories,
  eurosToCents,
  formatEuro,
  formatFinanceDate,
  formatFinanceDateTime,
  getVisibleMovements,
  loadFamilyFinanceSnapshot,
  normalizeSnapshot,
  postFamilyFinanceAction
} from './financas-core.js';

const childId = document.body.dataset.child || '';
const profile = CHILD_PROFILES[childId];
const DEFAULT_MOVEMENT_LIMIT = 5;
const CHART_COLORS = ['#5557c7', '#147d64', '#cf7b25', '#8c5fb3', '#4388a8', '#a64b32', '#6e7c91'];

const elements = {
  main: document.getElementById('financas-conteudo'),
  status: document.getElementById('financas-status'),
  statusText: document.getElementById('financas-status-text'),
  retry: document.getElementById('financas-retry'),
  available: document.getElementById('balance-available'),
  parents: document.getElementById('balance-parents'),
  childCash: document.getElementById('balance-child-cash'),
  pending: document.getElementById('balance-pending'),
  goals: document.getElementById('balance-goals'),
  projected: document.getElementById('balance-projected'),
  vault: document.getElementById('balance-vault'),
  market: document.getElementById('balance-market'),
  debt: document.getElementById('balance-debt'),
  debtCard: document.getElementById('balance-debt-card'),
  debtHelp: document.getElementById('balance-debt-help'),
  total: document.getElementById('balance-total'),
  goal: document.getElementById('goal-content'),
  goalEdit: document.getElementById('goal-edit'),
  movements: document.getElementById('movements-list'),
  movementsMore: document.getElementById('movements-more'),
  vaults: document.getElementById('vaults-list'),
  positions: document.getElementById('positions-list'),
  quotesUpdated: document.getElementById('quotes-updated'),
  investmentChartSummary: document.getElementById('investment-chart-summary'),
  monthlySummary: document.getElementById('monthly-summary'),
  incomeSummary: document.getElementById('income-chart-summary'),
  expenseSummary: document.getElementById('expense-chart-summary'),
  dialog: document.getElementById('finance-dialog'),
  form: document.getElementById('finance-form'),
  dialogKicker: document.getElementById('finance-dialog-kicker'),
  dialogTitle: document.getElementById('finance-dialog-title'),
  dialogIntro: document.getElementById('finance-dialog-intro'),
  dialogFields: document.getElementById('finance-dialog-fields'),
  formPreview: document.getElementById('finance-form-preview'),
  formError: document.getElementById('finance-form-error'),
  submit: document.getElementById('finance-submit')
};

const state = {
  user: null,
  snapshot: normalizeSnapshot({}, childId),
  dialogMode: null,
  editingRequest: null,
  editingReflection: null,
  movementsExpanded: false,
  charts: { income: null, expense: null, investment: null },
  loading: false,
  submitting: false,
  refreshController: null
};

function createElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== '') element.textContent = text;
  return element;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function requestKey(prefix = 'request') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function applyProfileCopy() {
  if (!profile) return;
  document.querySelectorAll('[data-profile-kicker]').forEach(node => { node.textContent = profile.kicker; });
  document.querySelectorAll('[data-profile-title]').forEach(node => { node.textContent = profile.title; });
  document.querySelectorAll('[data-profile-lead]').forEach(node => { node.textContent = profile.lead; });
  document.querySelectorAll('[data-invest-label]').forEach(node => { node.textContent = profile.investLabel; });
  document.querySelectorAll('[data-available-label]').forEach(node => { node.textContent = profile.availableLabel; });
  document.querySelectorAll('[data-goal-empty]').forEach(node => { node.textContent = profile.goalEmpty; });
  const movementIntro = document.getElementById('movements-intro');
  if (movementIntro) movementIntro.textContent = profile.movementIntro;
  const tip = document.getElementById('learning-tip');
  if (tip) {
    const dayIndex = Math.floor(Date.now() / 86400000) % profile.learningTips.length;
    tip.textContent = profile.learningTips[dayIndex];
  }
}

function setPageStatus(message = '', { error = false, retry = false } = {}) {
  if (!elements.status || !elements.statusText) return;
  elements.status.hidden = !message;
  elements.status.classList.toggle('is-error', error);
  elements.statusText.textContent = message;
  if (elements.retry) elements.retry.hidden = !retry;
}

function setActionAvailability(enabled) {
  document.querySelectorAll('[data-open-finance-dialog]').forEach(button => {
    button.disabled = !enabled;
    if (!enabled) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  });
}

async function getToken(forceRefresh = false) {
  if (!state.user || typeof state.user.getIdToken !== 'function') {
    throw new Error('Inicia sessão para usar esta área.');
  }
  return state.user.getIdToken(forceRefresh);
}

function renderBalances() {
  const account = state.snapshot.account;
  elements.available.textContent = formatEuro(account.availableCents);
  if (elements.parents) elements.parents.textContent = formatEuro(account.parentHeldCents);
  if (elements.childCash) elements.childCash.textContent = formatEuro(account.childCashCents);
  elements.pending.textContent = formatEuro(account.pendingCents);
  if (elements.goals) elements.goals.textContent = formatEuro(account.goalReservedCents);
  elements.vault.textContent = formatEuro(account.vaultCents);
  elements.market.textContent = formatEuro(account.marketCents);
  elements.total.textContent = formatEuro(account.totalCents);
  if (elements.projected) {
    elements.projected.hidden = account.pendingCents <= 0;
    elements.projected.textContent = account.projectedDebtCents > 0
      ? profile.age <= 8
        ? `Se os pais validarem todos estes movimentos, terás uma dívida de ${formatEuro(account.projectedDebtCents)} aos pais.`
        : `Se todos os movimentos forem validados, ficarás com uma dívida de ${formatEuro(account.projectedDebtCents)} aos pais.`
      : `Se todos os movimentos forem validados: ${formatEuro(account.projectedAvailableCents)} disponíveis.`;
    if (!elements.projected.hidden && (account.pendingCashWithdrawalCents > 0 || account.pendingCashReturnCents > 0)) {
      elements.projected.textContent += ` Desse valor, ${formatEuro(account.projectedChildCashCents)} ficarão contigo e ${formatEuro(account.projectedParentHeldCents)} com os pais.`;
    }
  }
  const hasDebt = account.debtCents > 0;
  if (elements.debt) elements.debt.textContent = formatEuro(account.debtCents);
  if (elements.debtCard) elements.debtCard.hidden = !hasDebt;
  if (elements.debtHelp) {
    elements.debtHelp.hidden = !hasDebt;
    elements.debtHelp.textContent = profile.age <= 8
      ? `Tens uma dívida de ${formatEuro(account.debtCents)} aos pais. O próximo dinheiro recebido paga primeiro esta parte, sem juros.`
      : `A dívida aos pais é ${formatEuro(account.debtCents)}. As próximas entradas reduzem primeiro esse valor, sem juros.`;
  }
}

function renderGoal() {
  if (!elements.goal) return;
  elements.goal.replaceChildren();
  const goal = state.snapshot.goal;
  if (!goal) {
    elements.goal.append(createElement('p', '', profile.goalEmpty));
    elements.goalEdit.textContent = profile.age <= 8 ? 'Escolher' : 'Criar objetivo';
    return;
  }

  const percentage = goal.targetCents > 0
    ? Math.min(100, Math.max(0, (goal.reservedCents / goal.targetCents) * 100))
    : 0;
  const nameRow = createElement('div', 'financas-goal-name');
  nameRow.append(
    createElement('strong', '', goal.title),
    createElement('span', '', `${formatEuro(goal.reservedCents)} reservados de ${formatEuro(goal.targetCents)}`)
  );
  const progress = createElement('div', 'financas-progress');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', `Progresso do objetivo ${goal.title}`);
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
  const fill = createElement('span');
  fill.style.width = `${percentage}%`;
  progress.append(fill);

  const remaining = Math.max(0, goal.targetCents - goal.reservedCents);
  const captionText = remaining === 0
    ? 'Objetivo alcançado.'
    : profile.age <= 8
      ? `Faltam ${formatEuro(remaining)}. Cada moeda ajuda.`
      : `Faltam ${formatEuro(remaining)} para chegares ao objetivo.`;
  const caption = createElement('p', 'financas-goal-caption', captionText);
  if (goal.targetDateMs) caption.append(` Data escolhida: ${formatFinanceDate(goal.targetDateMs)}.`);
  const actions = createElement('div', 'financas-goal-actions');
  const reserve = createElement('button', 'financas-small-button', profile.age <= 8 ? 'Guardar dinheiro' : 'Guardar dinheiro para este objetivo');
  reserve.type = 'button';
  reserve.dataset.openFinanceDialog = 'goal-reserve';
  reserve.disabled = state.snapshot.account.parentHeldCents <= 0;
  actions.append(reserve);
  if (goal.reservedCents > 0) {
    const release = createElement('button', 'financas-secondary-button', 'Retirar dinheiro do objetivo');
    release.type = 'button';
    release.dataset.openFinanceDialog = 'goal-release';
    actions.append(release);
  }
  elements.goal.append(nameRow, progress, caption, actions);
  elements.goalEdit.textContent = 'Alterar';
}

function movementPresentation(movement) {
  const presentations = {
    income: { icon: '+', direction: 'income', title: movement.categoryLabel },
    expense: { icon: '−', direction: 'expense', title: movement.categoryLabel },
    cash_withdrawal: { icon: '→', direction: 'transfer', title: 'Dinheiro entregue pelos pais' },
    cash_return: { icon: '←', direction: 'transfer', title: 'Dinheiro devolvido aos pais' },
    vault_open: {
      icon: '▣',
      direction: 'transfer',
      title: `Cofre${movement.termDays ? ` · ${movement.termDays} dias` : ''}`
    },
    vault_early_withdraw: { icon: '↩', direction: 'transfer', title: 'Resgate antecipado do cofre' },
    vault_early_withdrawal: { icon: '↩', direction: 'transfer', title: 'Resgate antecipado do cofre' },
    vault_maturity: { icon: '+', direction: 'income', title: 'Cofre terminado' },
    goal_reserve: { icon: '◎', direction: 'transfer', title: 'Guardado para o objetivo' },
    goal_release: { icon: '↩', direction: 'transfer', title: 'Retirado do objetivo' },
    reversal: { icon: '↶', direction: 'transfer', title: 'Estorno de um movimento' },
    market_buy: {
      icon: '↗',
      direction: 'transfer',
      title: movement.symbol ? `Compra de ${movement.symbol}` : 'Compra no mercado'
    },
    market_sell: {
      icon: '↙',
      direction: 'transfer',
      title: movement.symbol ? `Venda de ${movement.symbol}` : 'Venda no mercado'
    }
  };
  return presentations[movement.kind] || { icon: '•', direction: 'transfer', title: movement.categoryLabel || 'Movimento' };
}

function movementStatus(status) {
  const values = {
    approved: { label: 'Validado', icon: '✓' },
    pending: { label: profile.age <= 8 ? 'Para os pais validarem' : 'A aguardar validação', icon: '…' },
    correction_required: { label: 'Precisa de correção', icon: '!' },
    rejected: { label: 'Reprovado', icon: '×' },
    cancelled: { label: 'Cancelado', icon: '×' }
  };
  return values[status] || { label: status || 'Por confirmar', icon: '•' };
}

function amountPrefix(movement, direction) {
  if (direction === 'income') return '+';
  if (direction === 'expense') return '−';
  if (movement.kind === 'market_buy' || movement.kind === 'vault_open') return '↗ ';
  if (movement.kind === 'market_sell' || movement.kind === 'vault_early_withdraw') return '↙ ';
  if (movement.kind === 'goal_reserve') return '→ ';
  if (movement.kind === 'goal_release') return '← ';
  if (movement.kind === 'cash_withdrawal') return '→ ';
  if (movement.kind === 'cash_return') return '← ';
  return '';
}

function renderMovements() {
  if (!elements.movements) return;
  const visible = getVisibleMovements(state.snapshot.movements);
  const displayed = state.movementsExpanded ? visible : visible.slice(0, DEFAULT_MOVEMENT_LIMIT);
  elements.movements.replaceChildren();

  if (!displayed.length) {
    elements.movements.append(createElement('li', 'financas-empty', 'Ainda não há movimentos.'));
  } else {
    displayed.forEach(movement => {
      const presentation = movementPresentation(movement);
      const status = movementStatus(movement.status);
      const item = createElement(
        'li',
        `financas-movement financas-movement--${movement.status} financas-movement--${presentation.direction}`
      );
      const icon = createElement('span', 'financas-movement-icon', presentation.icon);
      icon.setAttribute('aria-hidden', 'true');

      const copy = createElement('div', 'financas-movement-copy');
      copy.append(createElement('strong', '', presentation.title));
      const details = [formatFinanceDate(movement.occurredAtMs || movement.createdAtMs)];
      if (movement.note) details.push(movement.note);
      if (movement.debtPaidCents > 0) {
        details.push(`${formatEuro(movement.debtPaidCents)} pagaram a dívida aos pais`);
        if (movement.availableAddedCents > 0) details.push(`${formatEuro(movement.availableAddedCents)} ficaram disponíveis`);
      }
      if (movement.reflection === 'need') details.push('Classifiquei como necessidade');
      if (movement.reflection === 'want') details.push('Classifiquei como desejo');
      if (movement.kind === 'expense' && movement.cashLocation === 'child') details.push('Paguei com o dinheiro que tinha comigo');
      if (movement.kind === 'expense' && movement.cashLocation === 'parents') details.push('Os pais pagaram');
      if (movement.status === 'rejected') {
        const reason = movement.rejectionReason || movement.decisionNote || movement.reviewNote;
        if (reason) details.push(`Explicação: ${reason}`);
      }
      if (movement.status === 'correction_required' && movement.correctionReason) {
        details.push(`Correção pedida: ${movement.correctionReason}`);
      }
      if (movement.kind === 'market_sell' && Number.isFinite(Number(movement.realizedPnlCents))) {
        const result = Number(movement.realizedPnlCents) || 0;
        if (Number(movement.costBasisRemovedCents) > 0) {
          details.push(`Nesta parte investiste ${formatEuro(movement.costBasisRemovedCents)} e vendeste por ${formatEuro(movement.amountCents)}`);
        }
        details.push(result >= 0
          ? `Ganho realizado: ${formatEuro(result)}`
          : `Perda realizada: ${formatEuro(Math.abs(result))}`);
      }
      copy.append(createElement('span', '', details.join(' · ')));

      const value = createElement('div', 'financas-movement-value');
      value.append(createElement(
        'strong',
        '',
        `${amountPrefix(movement, presentation.direction)}${formatEuro(movement.amountCents)}`
      ));
      value.append(createElement('small', 'financas-status-badge', `${status.icon} ${status.label}`));

      if (movement.status === 'pending') {
        const cancel = createElement('button', 'financas-cancel-request', 'Cancelar pedido');
        cancel.type = 'button';
        cancel.dataset.cancelRequest = movement.requestId || movement.id;
        value.append(cancel);
      }
      if (movement.status === 'correction_required') {
        const correct = createElement('button', 'financas-correct-request', 'Corrigir movimento');
        correct.type = 'button';
        correct.dataset.correctRequest = movement.requestId || movement.id;
        value.append(correct);
      }
      if (movement.status === 'approved' && movement.kind === 'expense') {
        const reflect = createElement('button', 'financas-reflect-request', movement.reflection ? 'Rever reflexão' : 'Necessidade ou desejo?');
        reflect.type = 'button';
        reflect.dataset.reflectMovement = movement.id;
        value.append(reflect);
      }
      item.append(icon, copy, value);
      elements.movements.append(item);
    });
  }

  const hiddenCount = Math.max(0, visible.length - DEFAULT_MOVEMENT_LIMIT);
  elements.movementsMore.hidden = hiddenCount === 0;
  elements.movementsMore.textContent = state.movementsExpanded
    ? 'Mostrar apenas os últimos 5'
    : `Mostrar mais${hiddenCount ? ` (${hiddenCount})` : ''}`;
  elements.movementsMore.setAttribute('aria-expanded', String(state.movementsExpanded));
}

function renderVaults() {
  if (!elements.vaults) return;
  const activeVaults = state.snapshot.vaults.filter(vault => (
    !['withdrawn', 'withdrawn_early', 'matured', 'cancelled', 'rejected'].includes(vault.status)
  ));
  elements.vaults.replaceChildren();
  if (!activeVaults.length) {
    elements.vaults.append(createElement('p', 'financas-empty', 'Ainda não tens dinheiro num cofre.'));
    return;
  }

  const list = createElement('div', 'financas-investment-list');
  activeVaults.forEach(vault => {
    const row = createElement('div', 'financas-investment-row');
    const head = createElement('div', 'financas-investment-row-head');
    head.append(
      createElement('strong', '', `${vault.termDays || ''} ${vault.termDays === 1 ? 'dia' : 'dias'}`.trim()),
      createElement('span', '', formatEuro(vault.principalCents))
    );
    const metrics = createElement('div', 'financas-investment-metrics');
    const annualRateBps = Number(vault.annualRateBps) || 0;
    const maturityValueCents = vault.principalCents + vault.rewardCents;
    metrics.append(
      createElement('span', '', vault.maturesAtMs ? `Termina em ${formatFinanceDate(vault.maturesAtMs)}` : 'Data por confirmar'),
      createElement('span', '', `Juro previsto ${formatEuro(vault.rewardCents)}`),
      createElement('span', '', `Total previsto ${formatEuro(maturityValueCents)}`)
    );
    if (annualRateBps > 0) {
      metrics.append(createElement(
        'span',
        '',
        `Taxa anual ${(annualRateBps / 100).toLocaleString('pt-PT', { maximumFractionDigits: 2 })}% · recebes apenas a parte correspondente aos ${vault.termDays} ${vault.termDays === 1 ? 'dia' : 'dias'}`
      ));
    }
    row.append(head, metrics);
    if (vault.status === 'active' && !vault.pendingWithdrawalRequestId) {
      const withdraw = createElement('button', 'financas-withdraw-button', 'Pedir resgate sem juros');
      withdraw.type = 'button';
      withdraw.dataset.withdrawVault = vault.id;
      row.append(withdraw);
    } else if (vault.pendingWithdrawalRequestId) {
      row.append(createElement('p', 'financas-field-hint', 'O pedido de resgate está a aguardar validação.'));
    }
    list.append(row);
  });
  elements.vaults.append(list);
}

function renderPositions() {
  if (!elements.positions) return;
  elements.positions.replaceChildren();
  const openPositions = state.snapshot.positions.filter(position => position.quantity > 0);
  if (!openPositions.length) {
    elements.positions.append(createElement('p', 'financas-empty', 'Ainda não tens ETF nem ações.'));
    return;
  }

  const list = createElement('div', 'financas-investment-list');
  openPositions.forEach(position => {
    const row = createElement('div', 'financas-investment-row');
    const head = createElement('div', 'financas-investment-row-head');
    const typeLabel = position.instrumentType === 'stock' ? 'Ação' : 'ETF';
    head.append(
      createElement('strong', '', `${position.symbol || position.name} · ${typeLabel}`),
      createElement('span', '', formatEuro(position.currentValueCents))
    );
    const metrics = createElement('div', 'financas-investment-metrics');
    metrics.append(createElement('span', '', `Colocaste ${formatEuro(position.investedCents)}`));
    const result = createElement(
      'span',
      position.resultCents >= 0 ? 'financas-result-positive' : 'financas-result-negative',
      `Hoje: ${position.resultCents >= 0 ? '+' : '−'}${formatEuro(Math.abs(position.resultCents))}`
    );
    metrics.append(result);
    const returnPct = position.investedCents > 0 ? (position.resultCents / position.investedCents) * 100 : 0;
    metrics.append(createElement(
      'span',
      returnPct >= 0 ? 'financas-result-positive' : 'financas-result-negative',
      `Rentabilidade atual: ${returnPct >= 0 ? '+' : ''}${returnPct.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`
    ));
    const realized = Number(position.realizedPnlCents) || 0;
    if (realized !== 0) {
      metrics.append(createElement(
        'span',
        realized >= 0 ? 'financas-result-positive' : 'financas-result-negative',
        `Resultado realizado ao vender: ${realized >= 0 ? '+' : '−'}${formatEuro(Math.abs(realized))}`
      ));
    }
    if (profile.age >= 11 && position.quote?.nativeCurrency === 'USD') {
      metrics.append(createElement('span', '', 'O valor em euros muda com o preço da ação e com a relação entre o dólar e o euro.'));
    }
    row.append(head, metrics);
    list.append(row);
  });
  elements.positions.append(list);
  elements.positions.append(createElement('p', 'financas-field-hint', 'Nesta simulação acompanhamos apenas a evolução do preço. Dividendos não estão incluídos.'));
}

function renderQuoteTimestamp() {
  if (!elements.quotesUpdated) return;
  const updated = state.snapshot.quoteUpdatedAtMs;
  if (!updated) {
    elements.quotesUpdated.textContent = profile.age <= 8
      ? 'Preços ainda não carregados'
      : 'Cotações ainda não carregadas';
    elements.quotesUpdated.removeAttribute('datetime');
    return;
  }
  elements.quotesUpdated.dateTime = new Date(updated).toISOString();
  const prefix = profile.age <= 8 ? 'Preços educativos' : 'Cotações educativas';
  elements.quotesUpdated.textContent = `${prefix}: ${formatFinanceDateTime(updated)}${state.snapshot.quotesStale ? ' · em cache' : ''}`;
}

function chartBreakdown(group) {
  const fromServer = group === 'income'
    ? state.snapshot.breakdown.incomeByCategory
    : state.snapshot.breakdown.expenseByCategory;
  return fromServer.length ? fromServer : aggregateCategories(state.snapshot.movements, group);
}

function renderChartSummary(container, items, emptyMessage) {
  container.replaceChildren();
  if (!items.length) {
    container.textContent = emptyMessage;
    return;
  }
  const list = createElement('ul');
  items.forEach((item, index) => {
    const entry = createElement('li');
    const dot = createElement('span', 'financas-chart-dot');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.setProperty('--dot-color', CHART_COLORS[index % CHART_COLORS.length]);
    entry.append(dot, document.createTextNode(`${item.label}: ${formatEuro(item.amountCents)}`));
    list.append(entry);
  });
  container.append(list);
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function renderChart(key, items) {
  const canvas = document.getElementById(`${key}-chart`);
  if (!canvas) return;
  destroyChart(key);
  canvas.parentElement.hidden = !items.length;
  if (!items.length || typeof globalThis.Chart !== 'function') return;

  const isSimpleProfile = profile.chartMode === 'bar';
  const data = {
    labels: items.map(item => item.label),
    datasets: [{
      data: items.map(item => item.amountCents / 100),
      backgroundColor: items.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
      borderColor: '#ffffff',
      borderWidth: isSimpleProfile ? 0 : 3,
      borderRadius: isSimpleProfile ? 8 : 0
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 350 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: context => `${context.label}: ${formatEuro(Math.round(context.raw * 100))}` }
      }
    }
  };
  if (isSimpleProfile) {
    options.indexAxis = 'y';
    options.scales = {
      x: {
        beginAtZero: true,
        grid: { color: '#edf0f5' },
        ticks: { callback: value => `${value} €` }
      },
      y: { grid: { display: false } }
    };
  } else {
    options.cutout = '62%';
  }
  state.charts[key] = new globalThis.Chart(canvas, {
    type: isSimpleProfile ? 'bar' : 'doughnut',
    data,
    options
  });
}

function renderCharts() {
  const income = chartBreakdown('income');
  const expense = chartBreakdown('expense');
  renderChartSummary(
    elements.incomeSummary,
    income,
    profile.age <= 8 ? 'Ainda não há dinheiro recebido e validado.' : 'Ainda não há entradas validadas.'
  );
  renderChartSummary(
    elements.expenseSummary,
    expense,
    profile.age <= 8 ? 'Ainda não há compras validadas.' : 'Ainda não há gastos validados.'
  );
  renderChart('income', income);
  renderChart('expense', expense);
}

function renderInvestmentChart() {
  const canvas = document.getElementById('investment-chart');
  if (!canvas || !elements.investmentChartSummary) return;
  destroyChart('investment');
  const heldSymbols = new Set(state.snapshot.positions
    .filter(position => position.quantity > 0)
    .map(position => position.symbol));
  const grouped = new Map();
  state.snapshot.quoteHistory.forEach(point => {
    if (!heldSymbols.has(point.symbol) || point.priceCents <= 0) return;
    if (!grouped.has(point.symbol)) grouped.set(point.symbol, []);
    grouped.get(point.symbol).push(point);
  });
  const datasets = [...grouped.entries()].map(([symbol, points], index) => {
    const ordered = points.sort((a, b) => (a.marketAsOfMs || 0) - (b.marketAsOfMs || 0));
    const base = ordered[0]?.priceCents || 0;
    return {
      label: symbol,
      data: ordered.map(point => ({
        x: formatFinanceDate(point.marketAsOfMs || point.cachedAtMs),
        y: base > 0 ? ((point.priceCents / base) - 1) * 100 : 0
      })),
      borderColor: CHART_COLORS[index % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
      tension: 0.22,
      pointRadius: ordered.length > 20 ? 0 : 2
    };
  }).filter(dataset => dataset.data.length >= 2);

  if (!datasets.length || typeof globalThis.Chart !== 'function') {
    elements.investmentChartSummary.textContent = profile.age <= 8
      ? 'Ainda não há preços suficientes para desenhar.'
      : 'O gráfico aparece depois de existirem pelo menos dois preços guardados para uma posição.';
    return;
  }
  elements.investmentChartSummary.textContent = '0% é o primeiro preço guardado de cada ativo.';
  state.charts.investment = new globalThis.Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.raw.y >= 0 ? '+' : ''}${context.raw.y.toFixed(2)}%` } } },
      scales: {
        y: { ticks: { callback: value => `${value}%` } },
        x: { grid: { display: false } }
      }
    }
  });
}

function categoryLabel(key) {
  return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].find(item => item.value === key)?.label || key || 'Outro';
}

function renderMonthlySummary() {
  if (!elements.monthlySummary) return;
  const summary = state.snapshot.monthlySummary;
  elements.monthlySummary.replaceChildren();
  if (!summary) {
    elements.monthlySummary.append(createElement('p', 'financas-empty', 'Ainda não existe resumo para este mês.'));
    return;
  }
  const periodDate = new Date(`${summary.period}-01T12:00:00`);
  const title = createElement('h3', '', periodDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }));
  const metrics = createElement('dl', 'financas-monthly-grid');
  const rows = [
    ['Recebeste', summary.receivedCents],
    ['Gastaste', summary.spentCents],
    ['Levaste contigo', summary.cashTakenCents],
    ['Devolveste aos pais', summary.cashReturnedCents],
    [profile.age <= 8 ? 'Guardaste para objetivos' : 'Reservaste para objetivos', summary.goalReservedCents],
    ['Colocaste em cofres', summary.vaultPlacedCents],
    ['Investiste', summary.investedCents],
    ['Juros recebidos', summary.interestReceivedCents],
    ['Resultado de vendas', summary.realizedNetCents],
    ['Necessidades', summary.needSpentCents],
    ['Desejos', summary.wantSpentCents],
    ['Variação registada do património', summary.wealthChangeCents]
  ];
  rows.forEach(([label, amount]) => {
    const item = createElement('div');
    item.append(createElement('dt', '', label), createElement('dd', '', formatEuro(Number(amount) || 0)));
    metrics.append(item);
  });
  const insights = createElement('ul', 'financas-monthly-insights');
  (summary.insights || []).forEach(insight => {
    let text = '';
    if (insight.type === 'wants_share') text = `${insight.percentage}% do dinheiro gasto foi classificado como desejos.`;
    if (insight.type === 'top_expense') text = `A categoria com mais gastos foi ${categoryLabel(insight.category)}: ${formatEuro(insight.amountCents)}.`;
    if (insight.type === 'saved_or_invested_share') text = `Guardaste ou investiste o equivalente a ${insight.percentage}% do dinheiro recebido.`;
    if (text) insights.append(createElement('li', '', text));
  });
  elements.monthlySummary.append(title, metrics);
  if (insights.children.length) elements.monthlySummary.append(insights);
}

function renderAll() {
  renderBalances();
  renderGoal();
  renderMovements();
  renderVaults();
  renderPositions();
  renderQuoteTimestamp();
  renderCharts();
  renderInvestmentChart();
  renderMonthlySummary();
}

function categoryOptions(categories, selected = '') {
  return categories.map(category => (
    `<option value="${escapeHtml(category.value)}"${category.value === selected ? ' selected' : ''}>${escapeHtml(category.label)}</option>`
  )).join('');
}

function amountField(label = 'Valor (€)') {
  return `
    <div class="financas-field">
      <label for="finance-amount">${escapeHtml(label)}</label>
      <input id="finance-amount" name="amount" type="text" inputmode="decimal" autocomplete="off"
        placeholder="0,00" aria-describedby="finance-amount-hint" required>
      <p id="finance-amount-hint" class="financas-field-hint">Usa euros e cêntimos, por exemplo 5,50.</p>
    </div>`;
}

function noteField(label = 'Nota (opcional)') {
  return `
    <div class="financas-field financas-field--full">
      <label for="finance-note">${escapeHtml(label)}</label>
      <textarea id="finance-note" name="note" maxlength="160"></textarea>
    </div>`;
}

function renderIncomeFields() {
  elements.dialogFields.innerHTML = `
    ${amountField(profile.age <= 8 ? 'Quanto dinheiro entrou? (€)' : 'Quanto recebeste? (€)')}
    <div class="financas-field">
      <label for="finance-category">De onde veio?</label>
      <select id="finance-category" name="category" required>${categoryOptions(INCOME_CATEGORIES, 'gift')}</select>
    </div>
    <div class="financas-field">
      <label for="finance-date">Em que dia?</label>
      <input id="finance-date" name="occurredOn" type="date" value="${localDateValue()}" required>
    </div>
    <div class="financas-field">
      <label for="finance-cash-location">Onde ficou o dinheiro?</label>
      <select id="finance-cash-location" name="cashLocation" required>
        <option value="parents">Guardado com os pais</option>
        <option value="child">Ficou comigo</option>
      </select>
    </div>
    ${noteField(profile.age <= 8 ? 'Queres contar alguma coisa? (opcional)' : 'Nota (opcional)')}`;
}

function renderExpenseFields() {
  const reflection = `
    <div class="financas-field">
      <label for="finance-reflection">${profile.age <= 8 ? 'Era algo de que precisavas ou que querias?' : 'Como classificas esta compra? (opcional)'}</label>
      <select id="finance-reflection" name="reflection">
        <option value="">Ainda não sei</option>
        <option value="need">Necessidade</option>
        <option value="want">Desejo</option>
      </select>
    </div>`;
  elements.dialogFields.innerHTML = `
    ${amountField(profile.age <= 8 ? 'Quanto custou? (€)' : 'Quanto gastaste? (€)')}
    <div class="financas-field">
      <label for="finance-category">Em quê?</label>
      <select id="finance-category" name="category" required>${categoryOptions(EXPENSE_CATEGORIES, 'toys')}</select>
    </div>
    <div class="financas-field">
      <label for="finance-date">Em que dia compraste?</label>
      <input id="finance-date" name="occurredOn" type="date" value="${localDateValue()}" required>
    </div>
    <div class="financas-field">
      <label for="finance-cash-location">Quem pagou?</label>
      <select id="finance-cash-location" name="cashLocation" required>
        <option value="parents">Os pais pagaram</option>
        <option value="child">Paguei com dinheiro que tinha comigo</option>
      </select>
    </div>
    ${reflection}
    ${noteField(profile.age <= 8 ? 'O que compraste? (opcional)' : 'O que compraste? (opcional)')}`;
}

function renderCashFields() {
  elements.dialogFields.innerHTML = `
    <fieldset class="financas-field financas-field--full financas-choice-group">
      <legend>O que queres fazer?</legend>
      <div class="financas-choice-grid">
        <label class="financas-choice">
          <input type="radio" name="cashDirection" value="withdrawal" checked>
          <span>Pedir aos pais<small>O dinheiro passa para as tuas mãos</small></span>
        </label>
        <label class="financas-choice">
          <input type="radio" name="cashDirection" value="return"${state.snapshot.account.childCashCents <= 0 ? ' disabled' : ''}>
          <span>Devolver aos pais<small>Volta a ficar guardado</small></span>
        </label>
      </div>
    </fieldset>
    ${amountField(profile.age <= 8 ? 'Quanto dinheiro queres ter contigo? (€)' : 'Quanto queres movimentar? (€)')}
    <div class="financas-field">
      <label for="finance-date">Em que dia?</label>
      <input id="finance-date" name="occurredOn" type="date" value="${localDateValue()}" required>
    </div>
    ${noteField(profile.age <= 8 ? 'Para quê? (opcional)' : 'Motivo, por exemplo saída com amigas (opcional)')}`;
}

function vaultOfferForDays(days) {
  return state.snapshot.vaultOffers.find(offer => (
    Number(offer.days ?? offer.termDays ?? offer.durationDays) === Number(days)
  ));
}

function offerRateLabel(offer) {
  if (!offer) return '';
  const annualRateBps = Number(offer.annualRateBps ?? offer.rateBps);
  if (!Number.isFinite(annualRateBps)) return '';
  return ` · ${(annualRateBps / 100).toLocaleString('pt-PT', { maximumFractionDigits: 2 })}% ao ano`;
}

function vaultTermOptions() {
  return VAULT_TERMS.map(term => {
    const offer = vaultOfferForDays(term.days);
    const label = offer?.label || term.label;
    return `<option value="${term.days}">${escapeHtml(label)}${escapeHtml(offerRateLabel(offer))}</option>`;
  }).join('');
}

function renderVaultInvestmentFields() {
  const target = document.getElementById('finance-investment-specific');
  if (!target) return;
  target.innerHTML = `
    ${amountField(profile.age <= 8 ? 'Quanto queres guardar? (€)' : 'Quanto queres bloquear? (€)')}
    <div class="financas-field">
      <label for="finance-term">Durante quanto tempo?</label>
      <select id="finance-term" name="termDays" required>${vaultTermOptions()}</select>
      <p class="financas-field-hint">Se pedires o dinheiro antes do fim, recebes o valor guardado sem juros.</p>
    </div>`;
}

function availableInstruments(type, side = 'buy') {
  const heldSymbols = new Set(
    state.snapshot.positions
      .filter(position => position.quantity > 0)
      .map(position => position.symbol)
  );
  return state.snapshot.instruments.filter(instrument => (
    (instrument.instrumentType === type || (type === 'stock' && instrument.instrumentType === 'action'))
    && (side !== 'sell' || heldSymbols.has(instrument.symbol))
  ));
}

function instrumentOptions(type, selected = '', side = 'buy') {
  const instruments = availableInstruments(type, side);
  if (!instruments.length) {
    return `<option value="">${side === 'sell' ? 'Não tens investimentos deste tipo para vender' : 'Sem preços disponíveis'}</option>`;
  }
  return instruments.map(instrument => {
    const isSelected = instrument.symbol === selected;
    const price = instrument.priceCents > 0 ? ` · ${formatEuro(instrument.priceCents)}` : ' · sem preço';
    return `<option value="${escapeHtml(instrument.symbol)}"${isSelected ? ' selected' : ''}${instrument.priceCents <= 0 ? ' disabled' : ''}>${escapeHtml(instrument.name)} (${escapeHtml(instrument.symbol)})${escapeHtml(price)}</option>`;
  }).join('');
}

function renderMarketInvestmentFields({ type = 'etf', side = 'buy', symbol = '' } = {}) {
  const target = document.getElementById('finance-investment-specific');
  if (!target) return;
  target.innerHTML = `
    <fieldset class="financas-field financas-field--full financas-choice-group">
      <legend>O que queres fazer?</legend>
      <div class="financas-choice-grid">
        <label class="financas-choice">
          <input type="radio" name="marketSide" value="buy"${side === 'buy' ? ' checked' : ''}>
          <span>Comprar<small>Colocar dinheiro no mercado</small></span>
        </label>
        <label class="financas-choice">
          <input type="radio" name="marketSide" value="sell"${side === 'sell' ? ' checked' : ''}>
          <span>Vender<small>Trazer dinheiro para o saldo</small></span>
        </label>
      </div>
    </fieldset>
    <fieldset class="financas-field financas-field--full financas-choice-group">
      <legend>Queres repartir ou escolher uma empresa?</legend>
      <div class="financas-choice-grid">
        <label class="financas-choice">
          <input type="radio" name="instrumentType" value="etf"${type === 'etf' ? ' checked' : ''}>
          <span>ETF<small>Reparte por muitas empresas ou obrigações</small></span>
        </label>
        <label class="financas-choice">
          <input type="radio" name="instrumentType" value="stock"${type === 'stock' ? ' checked' : ''}>
          <span>Ação<small>Depende de uma empresa</small></span>
        </label>
      </div>
    </fieldset>
    <div class="financas-field financas-field--full">
      <label for="finance-symbol">Escolhe o investimento</label>
      <select id="finance-symbol" name="symbol" required>${instrumentOptions(type, symbol, side)}</select>
      <p id="finance-quote-help" class="financas-field-hint"></p>
    </div>
    ${amountField(side === 'sell' ? 'Quanto queres vender? (€)' : 'Quanto queres comprar? (€)')}`;
  updateQuoteHelp();
}

function renderInvestmentFields(path = 'vault') {
  elements.dialogFields.innerHTML = `
    <fieldset class="financas-field financas-field--full financas-choice-group">
      <legend>Como queres pôr o dinheiro a crescer?</legend>
      <div class="financas-choice-grid">
        <label class="financas-choice">
          <input type="radio" name="investmentPath" value="vault"${path === 'vault' ? ' checked' : ''}>
          <span>Cofre a prazo<small>Recompensa garantida pelos pais</small></span>
        </label>
        <label class="financas-choice">
          <input type="radio" name="investmentPath" value="market"${path === 'market' ? ' checked' : ''}>
          <span>Mercado simulado<small>O valor pode subir ou descer</small></span>
        </label>
      </div>
    </fieldset>
    <div id="finance-investment-specific" class="financas-nested-fields financas-field--full"></div>`;
  if (path === 'vault') renderVaultInvestmentFields();
  else renderMarketInvestmentFields();
}

function renderGoalFields() {
  const goal = state.snapshot.goal;
  elements.dialogFields.innerHTML = `
    <div class="financas-field financas-field--full">
      <label for="finance-goal-title">O que queres alcançar?</label>
      <input id="finance-goal-title" name="title" type="text" maxlength="80" value="${escapeHtml(goal?.title || '')}" required>
    </div>
    ${amountField('Quanto custa o objetivo? (€)')}
    <div class="financas-field financas-field--full">
      <label for="finance-note">Porque é importante para ti? (opcional)</label>
      <textarea id="finance-note" name="note" maxlength="160">${escapeHtml(goal?.note || '')}</textarea>
    </div>`;
  const amount = document.getElementById('finance-amount');
  if (amount && goal?.targetCents) amount.value = (goal.targetCents / 100).toFixed(2).replace('.', ',');
}

function renderGoalTransferFields(direction) {
  const goal = state.snapshot.goal;
  const maximum = direction === 'reserve'
    ? state.snapshot.account.availableCents
    : goal?.reservedCents || 0;
  elements.dialogFields.innerHTML = `
    ${amountField(direction === 'reserve' ? 'Quanto queres guardar? (€)' : 'Quanto queres retirar? (€)')}
    <div class="financas-field financas-field--full">
      <p class="financas-field-hint">${direction === 'reserve'
        ? `Tens ${formatEuro(maximum)} disponíveis. O dinheiro reservado continua a ser teu e não fica bloqueado.`
        : `Tens ${formatEuro(maximum)} reservados para ${escapeHtml(goal?.title || 'o objetivo')}.`}</p>
    </div>`;
}

function renderReflectionFields(movement) {
  elements.dialogFields.innerHTML = `
    <div class="financas-field financas-field--full">
      <label for="finance-reflection">Hoje, como classificas esta compra?</label>
      <select id="finance-reflection" name="reflection" required>
        <option value="need"${movement?.reflection === 'need' ? ' selected' : ''}>Necessidade</option>
        <option value="want"${movement?.reflection === 'want' ? ' selected' : ''}>Desejo</option>
      </select>
      <p class="financas-field-hint">Não há uma resposta automática. A tua reflexão fica guardada no histórico.</p>
    </div>`;
}

function dialogCopy(mode) {
  const simple = profile.age <= 8;
  const copies = {
    income: {
      kicker: simple ? 'Entrou dinheiro' : 'Novo movimento',
      title: simple ? 'Receber dinheiro' : 'Registar dinheiro recebido',
      intro: simple
        ? 'Conta quanto entrou. Um dos pais valida antes de aparecer no teu saldo.'
        : 'Regista a origem e o valor. O saldo só muda depois da validação de um dos pais.',
      submit: simple ? 'Enviar para validar' : 'Enviar para validação'
    },
    expense: {
      kicker: simple ? 'Uma compra que já fizeste' : 'Registo de uma compra',
      title: simple ? 'Registar o que gastaste' : 'Registar dinheiro gasto',
      intro: simple
        ? 'Este registo é para algo que já compraste. Conta quanto custou e em quê.'
        : 'Este é o registo de algo já comprado, não um pedido de autorização para comprar. Os pais validam o movimento.',
      submit: simple ? 'Enviar para validar' : 'Enviar para validação'
    },
    cash: {
      kicker: simple ? 'Dinheiro nas tuas mãos' : 'Mover dinheiro físico',
      title: simple ? 'Dinheiro comigo' : 'Pedir ou devolver dinheiro',
      intro: simple
        ? 'Podes pedir dinheiro aos pais para levares contigo ou devolver o que sobrou. Isto não é um gasto.'
        : 'Move dinheiro entre o que está guardado com os pais e o que tens contigo. O património não muda e os pais confirmam a entrega.',
      submit: simple ? 'Enviar para os pais' : 'Enviar para validação'
    },
    invest: {
      kicker: simple ? 'Aprender a esperar' : 'Simulação educativa',
      title: simple ? 'Pôr dinheiro a crescer' : 'Investir dinheiro',
      intro: simple
        ? 'No cofre, os pais prometem uma recompensa. No mercado, o valor sobe e desce.'
        : 'Escolhe entre um prazo garantido pelos pais e o mercado simulado. Nenhuma ordem segue para uma corretora.',
      submit: simple ? 'Enviar para validar' : 'Enviar para validação'
    },
    goal: {
      kicker: simple ? 'Algo que eu quero' : 'Planear antes de gastar',
      title: simple ? 'Escolher um objetivo' : 'Definir objetivo de poupança',
      intro: simple
        ? 'Dá um nome ao que gostavas de alcançar e diz quanto custa.'
        : 'Um objetivo torna o custo de cada escolha mais fácil de comparar.',
      submit: 'Guardar objetivo'
    },
    'goal-reserve': {
      kicker: simple ? 'Guardar para algo' : 'Reservar sem bloquear',
      title: simple ? 'Guardar dinheiro no objetivo' : 'Guardar dinheiro para este objetivo',
      intro: simple
        ? 'Este dinheiro deixa de estar disponível para compras, mas podes retirá-lo quando quiseres.'
        : 'O valor deixa de estar disponível para compras, continua no património, não rende juros e pode ser retirado a qualquer momento.',
      submit: 'Guardar no objetivo'
    },
    'goal-release': {
      kicker: simple ? 'Mudar o que guardaste' : 'Retirar da reserva',
      title: 'Retirar dinheiro do objetivo',
      intro: 'O dinheiro regressa ao disponível. O património total não muda.',
      submit: 'Retirar do objetivo'
    },
    reflection: {
      kicker: simple ? 'Pensar na compra' : 'Reflexão educativa',
      title: 'Necessidade ou desejo?',
      intro: simple
        ? 'Podes mudar de ideia depois de pensar melhor. Isto não altera o dinheiro.'
        : 'Podes rever a tua classificação. O valor e o saldo não mudam; a alteração fica na auditoria.',
      submit: 'Guardar reflexão'
    }
  };
  return copies[mode];
}

function prefillCorrectionForm(request) {
  if (!request) return;
  if (request.kind === 'market_buy' || request.kind === 'market_sell') {
    const type = request.instrumentType || state.snapshot.instruments.find(item => item.symbol === request.symbol)?.instrumentType || 'etf';
    const path = elements.form.elements.namedItem('investmentPath');
    if (path) path.value = 'market';
    renderMarketInvestmentFields({
      type,
      side: request.kind === 'market_sell' ? 'sell' : 'buy',
      symbol: request.symbol
    });
  }
  const values = {
    amount: (request.amountCents / 100).toFixed(2).replace('.', ','),
    category: request.category,
    occurredOn: request.occurredOn || localDateValue(),
    note: request.note || '',
    reflection: request.reflection || '',
    cashLocation: request.cashLocation || 'parents',
    cashDirection: request.kind === 'cash_return' ? 'return' : 'withdrawal',
    termDays: request.termDays || ''
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = elements.form.elements.namedItem(name);
    if (field && value !== '') field.value = value;
  });
  if (['cash_withdrawal', 'cash_return'].includes(request.kind)) {
    const requiredDirection = request.kind === 'cash_return' ? 'return' : 'withdrawal';
    elements.form.querySelectorAll('[name="cashDirection"]').forEach(option => {
      option.checked = option.value === requiredDirection;
      option.disabled = option.value !== requiredDirection;
    });
  }
  updateQuoteHelp();
}

function openDialog(mode, { request = null, movement = null } = {}) {
  if (!['income', 'expense', 'cash', 'invest', 'goal', 'goal-reserve', 'goal-release', 'reflection'].includes(mode) || !elements.dialog) return;
  state.dialogMode = mode;
  state.editingRequest = request;
  state.editingReflection = movement;
  elements.form.reset();
  elements.formError.hidden = true;
  elements.formError.textContent = '';
  elements.formPreview.textContent = '';
  const copy = dialogCopy(mode);
  elements.dialogKicker.textContent = copy.kicker;
  elements.dialogTitle.textContent = copy.title;
  elements.dialogIntro.textContent = copy.intro;
  elements.submit.textContent = copy.submit;
  if (mode === 'income') renderIncomeFields();
  if (mode === 'expense') renderExpenseFields();
  if (mode === 'cash') renderCashFields();
  if (mode === 'invest') renderInvestmentFields();
  if (mode === 'goal') renderGoalFields();
  if (mode === 'goal-reserve') renderGoalTransferFields('reserve');
  if (mode === 'goal-release') renderGoalTransferFields('release');
  if (mode === 'reflection') renderReflectionFields(movement);
  if (request) {
    elements.dialogKicker.textContent = 'Correção pedida pelos pais';
    elements.dialogTitle.textContent = 'Corrigir movimento';
    elements.dialogIntro.textContent = request.correctionReason || 'Confirma os dados e volta a enviar para validação.';
    elements.submit.textContent = 'Voltar a enviar para validação';
    prefillCorrectionForm(request);
  }
  updateFormPreview();

  if (typeof elements.dialog.showModal === 'function') elements.dialog.showModal();
  else elements.dialog.setAttribute('open', '');
  window.setTimeout(() => {
    elements.dialog.querySelector('input:not([type="radio"]), select, textarea, button')?.focus();
  }, 20);
}

function closeDialog() {
  if (!elements.dialog) return;
  if (typeof elements.dialog.close === 'function') elements.dialog.close();
  else elements.dialog.removeAttribute('open');
  state.dialogMode = null;
  state.editingRequest = null;
  state.editingReflection = null;
}

function updateQuoteHelp() {
  const select = document.getElementById('finance-symbol');
  const help = document.getElementById('finance-quote-help');
  if (!select || !help) return;
  const quote = state.snapshot.instruments.find(item => item.symbol === select.value);
  if (!quote || quote.priceCents <= 0) {
    help.textContent = 'Preço educativo indisponível. A compra ou venda não pode ser enviada agora.';
    return;
  }
  const asOf = quote.marketAsOfMs || quote.cachedAtMs || state.snapshot.quoteUpdatedAtMs;
  help.textContent = `${profile.age <= 8 ? 'Preço guardado' : 'Último preço educativo'}: ${formatEuro(quote.priceCents)}${asOf ? ` · ${formatFinanceDateTime(asOf)}` : ''}.`;
}

function selectedValue(name) {
  return elements.form.querySelector(`[name="${name}"]:checked`)?.value
    || elements.form.elements.namedItem(name)?.value
    || '';
}

function estimateVaultReward(amountCents, termDays) {
  const offer = vaultOfferForDays(termDays);
  const annualRateBps = Number(offer?.annualRateBps ?? offer?.rateBps);
  if (!Number.isFinite(annualRateBps)) return null;
  return Math.round((amountCents * annualRateBps * Number(termDays)) / (10000 * 365));
}

function updateFormPreview() {
  const mode = state.dialogMode;
  const amountCents = eurosToCents(elements.form.elements.namedItem('amount')?.value);
  if (!amountCents || amountCents <= 0) {
    elements.formPreview.textContent = '';
    return;
  }
  const {
    availableCents: available,
    parentHeldCents,
    childCashCents,
    balanceCents: balance,
    debtCents: debt
  } = state.snapshot.account;
  if (mode === 'income') {
    const location = elements.form.elements.namedItem('cashLocation')?.value || 'parents';
    const childAmount = location === 'child' ? Math.max(0, amountCents - Math.min(debt, amountCents)) : 0;
    if (debt > amountCents) {
      elements.formPreview.textContent = `Depois de validado, este dinheiro reduz a dívida aos pais. Ficam ainda ${formatEuro(debt - amountCents)} por pagar.`;
    } else if (debt > 0) {
      elements.formPreview.textContent = location === 'child'
        ? `Depois de validado, a dívida fica paga e ${formatEuro(childAmount)} ficam contigo.`
        : `Depois de validado, a dívida fica paga e sobram ${formatEuro(amountCents - debt)} guardados com os pais.`;
    } else {
      elements.formPreview.textContent = location === 'child'
        ? `Depois de validado, ficas com ${formatEuro(childCashCents + amountCents)} contigo. O total disponível passa para ${formatEuro(available + amountCents)}.`
        : `Depois de validado, ficam ${formatEuro(parentHeldCents + amountCents)} guardados com os pais.`;
    }
    return;
  }
  if (mode === 'expense') {
    const location = elements.form.elements.namedItem('cashLocation')?.value || 'parents';
    if (location === 'child') {
      elements.formPreview.textContent = amountCents > childCashCents
        ? `Tens ${formatEuro(childCashCents)} contigo. Não podes registar ${formatEuro(amountCents)} como pago por ti.`
        : `Pagas com o dinheiro que tens contigo: ficam ${formatEuro(childCashCents - amountCents)} nas tuas mãos e o património diminui ${formatEuro(amountCents)}.`;
      return;
    }
    const parentCustodyAfter = balance - childCashCents - amountCents;
    const availableAfter = Math.max(0, parentCustodyAfter) + childCashCents;
    const goal = state.snapshot.goal;
    const missingGoalCents = goal ? Math.max(0, goal.targetCents - goal.reservedCents) : 0;
    const goalImpact = missingGoalCents > 0
      ? ` Esta compra vale ${Math.min(999, Math.round((amountCents / missingGoalCents) * 100))}% do que ainda falta para “${goal.title}”.`
      : '';
    elements.formPreview.textContent = parentCustodyAfter >= 0
      ? `Tens ${formatEuro(available)} disponíveis. Esta compra custa ${formatEuro(amountCents)} e, depois de validada, ficam ${formatEuro(availableAfter)}.${goalImpact}`
      : profile.age <= 8
        ? `Tens ${formatEuro(available)} disponíveis. Esta compra custa ${formatEuro(amountCents)} e, depois de validada, ficas com uma dívida de ${formatEuro(Math.abs(parentCustodyAfter))} aos pais. O próximo dinheiro recebido paga primeiro essa parte.${goalImpact}`
        : `Tens ${formatEuro(available)} disponíveis. Esta compra custa ${formatEuro(amountCents)} e, depois de validada, cria uma dívida de ${formatEuro(Math.abs(parentCustodyAfter))} aos pais. As próximas entradas amortizam primeiro esse valor.${goalImpact}`;
    return;
  }
  if (mode === 'cash') {
    const direction = selectedValue('cashDirection') || 'withdrawal';
    if (direction === 'return') {
      elements.formPreview.textContent = amountCents > childCashCents
        ? `Só tens ${formatEuro(childCashCents)} contigo para devolver.`
        : `Depois de os pais validarem, ficam ${formatEuro(childCashCents - amountCents)} contigo e ${formatEuro(parentHeldCents + amountCents)} guardados com eles. O património não muda.`;
    } else {
      elements.formPreview.textContent = amountCents > parentHeldCents
        ? `Só estão ${formatEuro(parentHeldCents)} guardados com os pais.`
        : `Depois de os pais entregarem e validarem, ficas com ${formatEuro(childCashCents + amountCents)} contigo e ${formatEuro(parentHeldCents - amountCents)} guardados com eles. O património não muda.`;
    }
    return;
  }
  if (mode === 'goal') {
    elements.formPreview.textContent = profile.age <= 8
      ? `O teu objetivo vale ${formatEuro(amountCents)}. Podes chegar lá moeda a moeda.`
      : `Meta definida em ${formatEuro(amountCents)}. O progresso será atualizado com o dinheiro que guardares.`;
    return;
  }
  if (mode === 'goal-reserve' || mode === 'goal-release') {
    const goal = state.snapshot.goal;
    const reserved = goal?.reservedCents || 0;
    const afterReserved = mode === 'goal-reserve' ? reserved + amountCents : reserved - amountCents;
    if (mode === 'goal-reserve') {
      elements.formPreview.textContent = amountCents > parentHeldCents
        ? `Só tens ${formatEuro(parentHeldCents)} guardados com os pais para reservar.`
        : `Ficam ${formatEuro(parentHeldCents - amountCents)} guardados com os pais e ${formatEuro(afterReserved)} reservados. O património não muda.`;
    } else {
      const parentCustodyAfter = balance - childCashCents + amountCents;
      elements.formPreview.textContent = amountCents > reserved
        ? `Só tens ${formatEuro(reserved)} reservados neste objetivo.`
        : parentCustodyAfter < 0
          ? `Ficam ${formatEuro(afterReserved)} reservados. Este valor reduz a dívida aos pais para ${formatEuro(Math.abs(parentCustodyAfter))}; o património não muda.`
          : `Ficam ${formatEuro(afterReserved)} reservados e ${formatEuro(parentCustodyAfter + childCashCents)} disponíveis. O património não muda.`;
    }
    return;
  }
  if (mode !== 'invest') return;

  const path = selectedValue('investmentPath');
  if (path === 'vault') {
    const termDays = Number(elements.form.elements.namedItem('termDays')?.value || 0);
    const reward = estimateVaultReward(amountCents, termDays);
    const offer = vaultOfferForDays(termDays);
    const annualRateBps = Number(offer?.annualRateBps ?? offer?.rateBps);
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + termDays);
    const outcome = reward == null
      ? 'A recompensa exata será confirmada antes da validação.'
      : `No fim, o cofre terá ${formatEuro(amountCents + reward)} (${formatEuro(reward)} de recompensa).`;
    const rateExplanation = Number.isFinite(annualRateBps)
      ? ` A taxa de ${(annualRateBps / 100).toLocaleString('pt-PT', { maximumFractionDigits: 2 })}% é anual: como este prazo dura ${termDays} ${termDays === 1 ? 'dia' : 'dias'}, recebes apenas a parte correspondente desse ano.`
      : '';
    elements.formPreview.textContent = `Capital: ${formatEuro(amountCents)}. Prazo: ${termDays} ${termDays === 1 ? 'dia' : 'dias'}, até ${formatFinanceDate(maturity.getTime())}. ${outcome}${rateExplanation}`;
    return;
  }

  const side = selectedValue('marketSide');
  const symbol = elements.form.elements.namedItem('symbol')?.value || '';
  const quote = state.snapshot.instruments.find(item => item.symbol === symbol);
  if (side === 'sell') {
    const position = state.snapshot.positions.find(item => item.symbol === symbol);
    const positionValue = position?.currentValueCents || 0;
    elements.formPreview.textContent = amountCents > positionValue
      ? `O valor atual desta posição é ${formatEuro(positionValue)}; não podes vender ${formatEuro(amountCents)}.`
      : `Vendes aproximadamente ${formatEuro(amountCents)} de ${symbol || 'este investimento'}. O ganho ou perda só fica realizado quando os pais validarem a venda, usando o preço educativo guardado.`;
  } else if (quote?.priceCents > 0) {
    const fraction = amountCents / quote.priceCents;
    const currentPosition = state.snapshot.positions.find(item => item.symbol === symbol);
    const futureMarket = state.snapshot.account.marketCents + amountCents;
    const futurePosition = (currentPosition?.currentValueCents || 0) + amountCents;
    const concentration = futureMarket > 0 ? Math.round((futurePosition / futureMarket) * 100) : 0;
    const patrimony = state.snapshot.account.totalCents;
    const patrimonyShare = patrimony > 0 ? Math.round((amountCents / patrimony) * 100) : null;
    const diversification = quote.instrumentType === 'stock'
      ? 'Uma ação depende de uma só empresa, por isso tende a concentrar mais risco.'
      : 'Um ETF reparte o dinheiro por vários ativos, embora continue a poder subir ou descer.';
    const warning = concentration >= 50
      ? ` Atenção: cerca de ${concentration}% do dinheiro no mercado ficaria neste único ativo.`
      : ` Cerca de ${concentration}% do dinheiro no mercado ficaria neste ativo.`;
    const patrimonyText = patrimonyShare === null
      ? `Estás a investir ${formatEuro(amountCents)}; o património atual é ${formatEuro(patrimony)}.`
      : `Estás a investir ${formatEuro(amountCents)} de um património total de ${formatEuro(patrimony)}. Isto representa ${patrimonyShare}% do património.`;
    elements.formPreview.textContent = `${patrimonyText} Compras aproximadamente ${fraction.toLocaleString('pt-PT', { maximumFractionDigits: 4 })} unidades de ${symbol} e ficam ${formatEuro(Math.max(0, parentHeldCents - amountCents))} guardados com os pais. ${diversification}${warning}`;
  } else {
    elements.formPreview.textContent = 'É preciso existir um preço educativo guardado antes de comprar.';
  }
}

function handleDynamicFormChange(event) {
  if (state.dialogMode === 'invest' && event.target.name === 'investmentPath') {
    if (event.target.value === 'vault') renderVaultInvestmentFields();
    else renderMarketInvestmentFields();
  } else if (state.dialogMode === 'invest' && event.target.name === 'instrumentType') {
    const side = selectedValue('marketSide') || 'buy';
    renderMarketInvestmentFields({ type: event.target.value, side });
  } else if (state.dialogMode === 'invest' && event.target.name === 'marketSide') {
    const type = selectedValue('instrumentType') || 'etf';
    const symbol = elements.form.elements.namedItem('symbol')?.value || '';
    renderMarketInvestmentFields({ type, side: event.target.value, symbol });
  }
  if (event.target.name === 'symbol') updateQuoteHelp();
  updateFormPreview();
}

function formAmountCents() {
  const amountCents = eurosToCents(elements.form.elements.namedItem('amount')?.value);
  if (!amountCents || amountCents <= 0) throw new Error('Escreve um valor maior do que zero.');
  return amountCents;
}

function createRequestPayload() {
  const mode = state.dialogMode;
  const amountCents = formAmountCents();
  const base = {
    amountCents,
    note: String(elements.form.elements.namedItem('note')?.value || '').trim(),
    occurredOn: elements.form.elements.namedItem('occurredOn')?.value || localDateValue(),
    idempotencyKey: requestKey(`${childId}-${mode}`)
  };
  if (mode === 'income' || mode === 'expense') {
    return {
      ...base,
      kind: mode,
      category: elements.form.elements.namedItem('category')?.value || 'other',
      reflection: elements.form.elements.namedItem('reflection')?.value || null,
      cashLocation: elements.form.elements.namedItem('cashLocation')?.value || 'parents'
    };
  }
  if (mode === 'cash') {
    return {
      ...base,
      kind: selectedValue('cashDirection') === 'return' ? 'cash_return' : 'cash_withdrawal',
      category: 'cash_transfer'
    };
  }

  const path = selectedValue('investmentPath');
  if (path === 'vault') {
    return {
      ...base,
      kind: 'vault_open',
      category: 'vault',
      termDays: Number(elements.form.elements.namedItem('termDays')?.value)
    };
  }
  const side = selectedValue('marketSide') || 'buy';
  return {
    ...base,
    kind: side === 'sell' ? 'market_sell' : 'market_buy',
    category: 'market',
    symbol: elements.form.elements.namedItem('symbol')?.value || '',
    instrumentType: selectedValue('instrumentType') || 'etf'
  };
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.hidden = false;
  elements.formError.focus?.();
}

async function submitDialog(event) {
  event.preventDefault();
  if (state.submitting) return;
  elements.formError.hidden = true;
  if (!elements.form.checkValidity()) {
    elements.form.reportValidity();
    return;
  }

  try {
    state.submitting = true;
    elements.submit.disabled = true;
    const token = await getToken();
    if (state.dialogMode === 'reflection') {
      const reflection = selectedValue('reflection');
      if (!state.editingReflection || !['need', 'want'].includes(reflection)) {
        throw new Error('Escolhe necessidade ou desejo.');
      }
      await postFamilyFinanceAction({
        childId,
        token,
        action: 'updateExpenseReflection',
        payload: { ledgerId: state.editingReflection.id, reflection }
      });
      closeDialog();
      showToast('Reflexão guardada no histórico.', 'success');
    } else if (state.dialogMode === 'goal') {
      const targetCents = formAmountCents();
      const title = String(elements.form.elements.namedItem('title')?.value || '').trim();
      if (!title) throw new Error('Dá um nome ao objetivo.');
      await postFamilyFinanceAction({
        childId,
        token,
        action: 'saveGoal',
        payload: {
          goal: {
            title,
            targetCents,
            note: String(elements.form.elements.namedItem('note')?.value || '').trim()
          }
        }
      });
      closeDialog();
      showToast('Objetivo guardado.', 'success');
    } else if (state.dialogMode === 'goal-reserve' || state.dialogMode === 'goal-release') {
      const amountCents = formAmountCents();
      const direction = state.dialogMode === 'goal-reserve' ? 'reserve' : 'release';
      const maximum = direction === 'reserve'
        ? state.snapshot.account.parentHeldCents
        : state.snapshot.goal?.reservedCents || 0;
      if (amountCents > maximum) throw new Error(`Só podes movimentar até ${formatEuro(maximum)}.`);
      await postFamilyFinanceAction({
        childId,
        token,
        action: 'transferGoalFunds',
        payload: { direction, amountCents, idempotencyKey: requestKey(`${childId}-goal-${direction}`) }
      });
      closeDialog();
      showToast(direction === 'reserve' ? 'Dinheiro reservado para o objetivo.' : 'Dinheiro devolvido ao disponível.', 'success');
    } else {
      const request = createRequestPayload();
      const submittedMode = state.dialogMode;
      const wasCorrection = Boolean(state.editingRequest);
      const spendsAvailable = ['vault_open', 'market_buy'].includes(request.kind);
      if (spendsAvailable && request.amountCents > state.snapshot.account.parentHeldCents) {
        throw new Error(`Só tens ${formatEuro(state.snapshot.account.parentHeldCents)} guardados com os pais para este investimento.`);
      }
      if (request.kind === 'expense' && request.cashLocation === 'child' && request.amountCents > state.snapshot.account.childCashCents) {
        throw new Error(`Só tens ${formatEuro(state.snapshot.account.childCashCents)} contigo.`);
      }
      if (request.kind === 'cash_withdrawal' && request.amountCents > state.snapshot.account.parentHeldCents) {
        throw new Error(`Só estão ${formatEuro(state.snapshot.account.parentHeldCents)} guardados com os pais.`);
      }
      if (request.kind === 'cash_return' && request.amountCents > state.snapshot.account.childCashCents) {
        throw new Error(`Só tens ${formatEuro(state.snapshot.account.childCashCents)} contigo para devolver.`);
      }
      if (request.kind.startsWith('market_') && !request.symbol) {
        throw new Error('Escolhe um investimento com preço disponível.');
      }
      if (state.editingRequest) {
        await postFamilyFinanceAction({
          childId,
          token,
          action: 'resubmitCorrection',
          payload: {
            requestId: state.editingRequest.requestId || state.editingRequest.id,
            request,
            idempotencyKey: request.idempotencyKey
          }
        });
      } else {
        await postFamilyFinanceAction({ childId, token, action: 'createRequest', payload: request });
      }
      closeDialog();
      const message = wasCorrection
        ? 'Movimento corrigido e enviado novamente para validação.'
        : submittedMode === 'expense'
          ? 'Registo enviado para validação.'
          : 'Movimento enviado para validação.';
      showToast(message, 'success');
    }
    await refreshSnapshot({ quiet: true });
  } catch (error) {
    showFormError(error?.message || 'Não foi possível enviar. Tenta novamente.');
  } finally {
    state.submitting = false;
    elements.submit.disabled = false;
  }
}

async function cancelRequest(requestId) {
  const execute = async () => {
    try {
      const token = await getToken();
      await postFamilyFinanceAction({
        childId,
        token,
        action: 'cancelRequest',
        payload: { requestId }
      });
      showToast('Pedido cancelado.', 'info');
      await refreshSnapshot({ quiet: true });
    } catch (error) {
      showToast(error?.message || 'Não foi possível cancelar o pedido.', 'error');
    }
  };
  showConfirm('Queres cancelar este pedido enquanto ainda está a aguardar?', execute);
}

async function requestEarlyWithdrawal(vaultId) {
  const vault = state.snapshot.vaults.find(item => item.id === vaultId);
  const principal = vault?.principalCents || 0;
  const reward = vault?.rewardCents || 0;
  const execute = async () => {
    try {
      const token = await getToken();
      await postFamilyFinanceAction({
        childId,
        token,
        action: 'earlyWithdraw',
        payload: { vaultId, idempotencyKey: requestKey(`${childId}-withdraw`) }
      });
      showToast('Pedido de resgate enviado para validação. Recebes o capital e perdes os juros.', 'info', 5000);
      await refreshSnapshot({ quiet: true });
    } catch (error) {
      showToast(error?.message || 'Não foi possível pedir o resgate.', 'error');
    }
  };
  showConfirm(
    `Se levantares agora, regressam ${formatEuro(principal)} ao disponível e perdes ${formatEuro(reward)} de juros previstos.`,
    execute,
    undefined,
    { confirmLabel: 'Levantar agora', cancelLabel: 'Continuar no cofre' }
  );
}

async function refreshSnapshot({ quiet = false } = {}) {
  if (state.loading || !state.user) return;
  state.loading = true;
  elements.main?.setAttribute('aria-busy', 'true');
  if (!quiet) setPageStatus(profile.age <= 8 ? 'A procurar o teu dinheiro…' : 'A atualizar as tuas finanças…');
  state.refreshController?.abort();
  state.refreshController = new AbortController();
  try {
    const token = await getToken();
    state.snapshot = await loadFamilyFinanceSnapshot({
      childId,
      token,
      signal: state.refreshController.signal
    });
    renderAll();
    setPageStatus('');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    renderAll();
    setPageStatus(
      error?.message || 'Não foi possível atualizar. Os valores apresentados podem estar desatualizados.',
      { error: true, retry: true }
    );
  } finally {
    state.loading = false;
    elements.main?.setAttribute('aria-busy', 'false');
  }
}

function bindEvents() {
  elements.main?.addEventListener('click', event => {
    const opener = event.target.closest('[data-open-finance-dialog]');
    if (opener && !opener.disabled) {
      openDialog(opener.dataset.openFinanceDialog);
      return;
    }
    const correct = event.target.closest('[data-correct-request]');
    if (correct) {
      const request = state.snapshot.movements.find(item => (
        (item.requestId || item.id) === correct.dataset.correctRequest
        && item.status === 'correction_required'
      ));
      if (!request) return;
      const mode = request.kind === 'income' || request.kind === 'expense'
        ? request.kind
        : ['cash_withdrawal', 'cash_return'].includes(request.kind)
          ? 'cash'
          : 'invest';
      openDialog(mode, { request });
      return;
    }
    const reflect = event.target.closest('[data-reflect-movement]');
    if (!reflect) return;
    const movement = state.snapshot.movements.find(item => item.id === reflect.dataset.reflectMovement);
    if (movement?.kind === 'expense' && movement.status === 'approved') {
      openDialog('reflection', { movement });
    }
  });
  document.querySelectorAll('[data-close-finance-dialog]').forEach(button => {
    button.addEventListener('click', closeDialog);
  });
  elements.form?.addEventListener('submit', submitDialog);
  elements.dialogFields?.addEventListener('input', updateFormPreview);
  elements.dialogFields?.addEventListener('change', handleDynamicFormChange);
  elements.retry?.addEventListener('click', () => refreshSnapshot());
  elements.movementsMore?.addEventListener('click', () => {
    state.movementsExpanded = !state.movementsExpanded;
    renderMovements();
  });
  elements.movements?.addEventListener('click', event => {
    const button = event.target.closest('[data-cancel-request]');
    if (button) cancelRequest(button.dataset.cancelRequest);
  });
  elements.vaults?.addEventListener('click', event => {
    const button = event.target.closest('[data-withdraw-vault]');
    if (button) requestEarlyWithdrawal(button.dataset.withdrawVault);
  });
  elements.dialog?.addEventListener('close', () => {
    state.dialogMode = null;
    state.editingRequest = null;
    state.editingReflection = null;
    elements.formError.hidden = true;
  });
  window.addEventListener('finance:clear-private-data', () => {
    state.snapshot = normalizeSnapshot({}, childId);
    renderAll();
  });
}

async function init() {
  if (!profile) {
    setPageStatus('Esta página não identifica a conta infantil.', { error: true });
    elements.main?.setAttribute('aria-busy', 'false');
    return;
  }
  applyProfileCopy();
  renderAll();
  bindEvents();
  setActionAvailability(false);

  const access = await whenAccessResolved();
  if (!access?.user) {
    setPageStatus('Inicia sessão para veres e registares o teu dinheiro.', { error: true });
    elements.main?.setAttribute('aria-busy', 'false');
    return;
  }
  state.user = access.user;
  setActionAvailability(true);
  await refreshSnapshot();

  window.setInterval(renderMovements, 60 * 1000);
}

init().catch(error => {
  console.error('Erro ao iniciar finanças infantis:', error);
  setPageStatus(error?.message || 'Não foi possível abrir esta página.', { error: true, retry: true });
  elements.main?.setAttribute('aria-busy', 'false');
});
