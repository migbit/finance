import { whenAccessResolved } from './script.js';
import { showConfirm, showToast } from './toast.js';
import { FAMILY_FINANCE_ENDPOINT } from './financas-core.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

const CHILDREN = Object.freeze([
  { id: 'francisca', name: 'Francisca' },
  { id: 'leonor', name: 'Leonor' }
]);

const CHILD_NAME = Object.freeze(Object.fromEntries(CHILDREN.map(child => [child.id, child.name])));
const KIND_META = Object.freeze({
  income: { label: 'Entrada', icon: '💶', direction: 1 },
  expense: { label: 'Saída', icon: '🛍️', direction: -1 },
  cash_withdrawal: { label: 'Dinheiro entregue', icon: '💵', direction: 0 },
  cash_return: { label: 'Dinheiro devolvido', icon: '↩️', direction: 0 },
  vault_open: { label: 'Investimento a prazo', icon: '🔒', direction: -1 },
  vault_maturity: { label: 'Prazo terminado', icon: '🔓', direction: 1 },
  vault_withdrawal: { label: 'Levantamento antecipado', icon: '↩️', direction: 1 },
  vault_early_withdraw: { label: 'Levantamento antecipado', icon: '↩️', direction: 1 },
  vault_early_withdrawal: { label: 'Levantamento antecipado', icon: '↩️', direction: 1 },
  market_buy: { label: 'Compra de investimento', icon: '📈', direction: -1 },
  market_sell: { label: 'Venda de investimento', icon: '📉', direction: 1 },
  interest: { label: 'Juros recebidos', icon: '✨', direction: 1 },
  adjustment: { label: 'Ajuste dos pais', icon: '🧾', direction: 1 },
  goal_reserve: { label: 'Reserva para objetivo', icon: '◎', direction: -1 },
  goal_release: { label: 'Retirada do objetivo', icon: '↩️', direction: 1 },
  reversal: { label: 'Estorno', icon: '↶', direction: 1 }
});

const STATUS_META = Object.freeze({
  pending: { label: 'A aguardar validação', className: 'is-pending' },
  correction_required: { label: 'Precisa de correção', className: 'is-correction' },
  approved: { label: 'Validado', className: 'is-approved' },
  rejected: { label: 'Reprovado', className: 'is-rejected' },
  cancelled: { label: 'Cancelado', className: 'is-cancelled' }
});

const CATEGORY_LABELS = Object.freeze({
  gift: 'Prenda',
  allowance: 'Mesada',
  task: 'Tarefa',
  sale: 'Venda',
  reward: 'Recompensa',
  toys: 'Brinquedos',
  school: 'Material escolar',
  food: 'Alimentos',
  books: 'Livros',
  leisure: 'Lazer',
  gifts: 'Presentes',
  technology: 'Tecnologia',
  other: 'Outro',
  adjustment: 'Ajuste dos pais',
  investment_interest: 'Juros do cofre',
  investment_realized_gain: 'Ganhos realizados',
  investment_realized_loss: 'Perdas realizadas',
  vault: 'Cofre a prazo',
  market: 'Mercado simulado',
  savings_goal: 'Objetivo de poupança',
  cash_transfer: 'Dinheiro físico',
  reversal: 'Estorno'
});

const ADJUSTMENT_CATEGORIES = Object.freeze({
  income: ['gift', 'allowance', 'task', 'sale', 'reward', 'other'],
  expense: ['toys', 'school', 'food', 'books', 'leisure', 'gifts', 'technology', 'other']
});

const state = {
  snapshots: new Map(),
  errors: new Map(),
  activeTab: 'pending',
  loading: false,
  mutating: false,
  lastLoadedAt: null
};

const elements = {
  summary: document.getElementById('finance-admin-summary'),
  syncPill: document.getElementById('finance-admin-sync-pill'),
  syncMeta: document.getElementById('finance-admin-sync-meta'),
  reload: document.getElementById('finance-admin-reload'),
  refreshQuotes: document.getElementById('finance-admin-refresh-quotes'),
  addMovement: document.getElementById('finance-admin-add'),
  pendingCount: document.getElementById('finance-pending-count'),
  pendingList: document.getElementById('finance-pending-list'),
  movementsBody: document.getElementById('finance-movements-body'),
  investments: document.getElementById('finance-investments-content'),
  monthly: document.getElementById('finance-monthly-content'),
  auditBody: document.getElementById('finance-audit-body'),
  filters: document.getElementById('finance-admin-filters'),
  childFilter: document.getElementById('finance-filter-child'),
  statusFilter: document.getElementById('finance-filter-status'),
  kindFilter: document.getElementById('finance-filter-kind'),
  searchFilter: document.getElementById('finance-filter-search'),
  adjustmentDialog: document.getElementById('finance-adjustment-dialog'),
  adjustmentForm: document.getElementById('finance-adjustment-form'),
  adjustmentKind: document.getElementById('finance-adjustment-kind'),
  adjustmentCategory: document.getElementById('finance-adjustment-category'),
  rejectDialog: document.getElementById('finance-reject-dialog'),
  rejectForm: document.getElementById('finance-reject-form'),
  rejectSummary: document.getElementById('finance-reject-summary'),
  correctionDialog: document.getElementById('finance-correction-dialog'),
  correctionForm: document.getElementById('finance-correction-form'),
  correctionSummary: document.getElementById('finance-correction-summary'),
  reversalDialog: document.getElementById('finance-reversal-dialog'),
  reversalForm: document.getElementById('finance-reversal-form'),
  reversalSummary: document.getElementById('finance-reversal-summary')
};

async function familyFinanceApi({ childId, action = '', payload = {} } = {}) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Inicia sessão para consultar as finanças.');

  const token = await user.getIdToken();
  const url = new URL(FAMILY_FINANCE_ENDPOINT, window.location.origin);
  if (childId) url.searchParams.set('childId', childId);

  const options = {
    method: action ? 'POST' : 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  };

  if (action) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ action, childId, ...payload });
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Não foi possível concluir o pedido (HTTP ${response.status}).`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function normalizeSnapshot(payload, childId) {
  const data = payload?.snapshot || payload?.data || payload || {};
  return {
    ...data,
    childId: data.childId || childId,
    account: data.account || data.summary || {},
    requests: asArray(data.requests || data.pendingRequests),
    movements: asArray(data.movements || data.ledger || data.entries),
    vaults: asArray(data.vaults || data.termPositions || data.termDeposits || data.fixedTerms),
    positions: asArray(data.positions || data.marketPositions || data.holdings),
    auditEvents: asArray(data.auditEvents),
    products: asArray(data.products || data.instruments),
    quotes: data.quotes || {}
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([id, item]) => ({ id, ...(item || {}) }));
  }
  return [];
}

async function loadAllData({ quiet = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  setToolbarDisabled(true);
  if (!quiet) setSyncState('is-neutral', 'A atualizar…', 'A carregar Francisca e Leonor.');

  try {
    const results = await Promise.allSettled(CHILDREN.map(async child => ({
      child,
      payload: await familyFinanceApi({ childId: child.id })
    })));

    state.errors.clear();
    results.forEach((result, index) => {
      const child = CHILDREN[index];
      if (result.status === 'fulfilled') {
        state.snapshots.set(child.id, normalizeSnapshot(result.value, child.id));
      } else {
        state.errors.set(child.id, result.reason);
      }
    });

    state.lastLoadedAt = new Date();
    renderAll();

    if (state.errors.size === 0) {
      setSyncState('is-success', 'Sincronizado', `Atualizado às ${formatTime(state.lastLoadedAt)}.`);
    } else if (state.snapshots.size > 0) {
      setSyncState('is-warning', 'Parcial', 'Uma das contas não pôde ser atualizada.');
    } else {
      throw Array.from(state.errors.values())[0] || new Error('Não foi possível carregar as contas.');
    }
  } catch (error) {
    console.error('Erro ao carregar gestão financeira:', error);
    renderAll();
    setSyncState('is-error', 'Sem ligação', error.message || 'Não foi possível carregar os dados.');
    if (!quiet) showToast(error.message || 'Erro ao carregar as finanças.', 'error', 5000);
  } finally {
    state.loading = false;
    setToolbarDisabled(false);
  }
}

function setToolbarDisabled(disabled) {
  [elements.reload, elements.refreshQuotes, elements.addMovement].forEach(button => {
    if (button) button.disabled = disabled || state.mutating;
  });
}

function setSyncState(className, label, meta) {
  if (elements.syncPill) {
    elements.syncPill.className = `finance-status-pill ${className}`;
    elements.syncPill.textContent = label;
  }
  if (elements.syncMeta) elements.syncMeta.textContent = meta;
}

function renderAll() {
  renderSummary();
  renderPending();
  renderMovements();
  renderInvestments();
  renderMonthly();
  renderAudit();
}

function renderSummary() {
  if (!elements.summary) return;
  elements.summary.innerHTML = CHILDREN.map(child => {
    const error = state.errors.get(child.id);
    const snapshot = state.snapshots.get(child.id);
    if (error && !snapshot) {
      return `
        <article class="finance-summary-card" data-child="${child.id}">
          <div class="finance-summary-heading"><h2>${child.name}</h2></div>
          <div class="finance-error-state">Não foi possível carregar esta conta.</div>
        </article>`;
    }

    const account = snapshot?.account || {};
    const balance = centsFrom(account, ['rawBalanceCents', 'balanceCents', 'confirmedBalanceCents']);
    const childCash = Math.max(0, firstFinite(account.childCashCents, 0));
    const parentHeld = Math.max(0, firstFiniteOrNull(account.parentHeldCents) ?? (balance - childCash));
    const available = Math.max(0, firstFiniteOrNull(account.availableCents, account.cashCents) ?? (parentHeld + childCash));
    const debt = Math.max(0, firstFiniteOrNull(account.debtCents) ?? (childCash - balance));
    const pending = centsFrom(account, ['pendingCents']);
    const goalReserved = centsFrom(account, ['goalReservedCents']);
    const vault = centsFrom(account, ['vaultCents', 'termCents', 'lockedCents']);
    const market = centsFrom(account, ['marketCents', 'marketValueCents', 'investedCents']);
    const total = firstFinite(account.totalCents, account.netWorthCents, balance + goalReserved + vault + market);
    const pendingCount = getRequests(child.id).filter(item => normalizeStatus(item.status) === 'pending').length;

    return `
      <article class="finance-summary-card" data-child="${child.id}">
        <div class="finance-summary-heading">
          <h2>${child.name}</h2>
          <span>${pendingCount === 1 ? '1 movimento para validar' : `${pendingCount} movimentos para validar`}</span>
        </div>
        <strong class="finance-summary-total">${formatEuro(total)}</strong>
        <div class="finance-summary-metrics">
          ${summaryMetric('Disponível', available)}
          ${summaryMetric('Com os pais', parentHeld)}
          ${summaryMetric('Com ela', childCash)}
          ${debt > 0 ? summaryMetric('Dívida aos pais', debt, 'is-debt') : ''}
          ${summaryMetric('A aguardar', pending)}
          ${summaryMetric('Em objetivos', goalReserved)}
          ${summaryMetric('A prazo', vault)}
          ${summaryMetric('Mercado', market)}
        </div>
        ${pending > 0 ? `<p class="finance-summary-projected">Se tudo for validado: ${formatEuro(firstFinite(account.projectedAvailableCents, 0))} disponíveis · ${formatEuro(firstFinite(account.projectedParentHeldCents, parentHeld))} com os pais · ${formatEuro(firstFinite(account.projectedChildCashCents, childCash))} com ela${firstFinite(account.projectedDebtCents, 0) > 0 ? ` · dívida de ${formatEuro(account.projectedDebtCents)}` : ''}.</p>` : ''}
      </article>`;
  }).join('');
}

function summaryMetric(label, value, className = '') {
  return `<div class="finance-summary-metric ${className}"><span>${label}</span><strong>${formatEuro(value)}</strong></div>`;
}

function combinedRequests() {
  return CHILDREN.flatMap(child => getRequests(child.id).map(item => ({ ...item, childId: item.childId || child.id })));
}

function getRequests(childId) {
  return state.snapshots.get(childId)?.requests || [];
}

function combinedMovements() {
  return CHILDREN.flatMap(child => (
    state.snapshots.get(child.id)?.movements || []
  ).map(item => ({ ...item, childId: item.childId || child.id })));
}

function combinedAuditEvents() {
  return CHILDREN.flatMap(child => (
    state.snapshots.get(child.id)?.auditEvents || []
  ).map(item => ({ ...item, childId: item.childId || child.id })));
}

function renderPending() {
  if (!elements.pendingList) return;
  const allPending = combinedRequests()
    .filter(item => normalizeStatus(item.status) === 'pending')
    .sort((a, b) => itemTime(b) - itemTime(a));

  if (elements.pendingCount) elements.pendingCount.textContent = String(allPending.length);
  const filtered = allPending.filter(item => matchesFilters(item));
  if (!filtered.length) {
    elements.pendingList.innerHTML = '<div class="finance-empty-state">Não há movimentos a aguardar validação com estes filtros.</div>';
    return;
  }

  elements.pendingList.innerHTML = filtered.map(request => {
    const kind = kindMeta(request.kind || request.type);
    const requestId = itemId(request);
    const amount = requestAmountCents(request);
    const category = categoryLabel(request.category);
    const requestSymbol = request.symbol || request.instrumentId || '';
    const symbol = requestSymbol ? ` · ${escapeHtml(requestSymbol)}` : '';
    const term = request.termDays ? ` · ${escapeHtml(formatTermDays(request.termDays))}` : '';
    const cashDetail = request.kind === 'expense'
      ? request.cashLocation === 'child' ? ' · pago por ela' : ' · pago pelos pais'
      : request.kind === 'income'
        ? request.cashLocation === 'child' ? ' · fica com ela' : ' · fica com os pais'
        : '';
    return `
      <article class="finance-request-card">
        <div class="finance-request-icon" aria-hidden="true">${kind.icon}</div>
        <div class="finance-request-main">
          <div class="finance-request-title">
            <strong>${escapeHtml(CHILD_NAME[request.childId] || request.childId)}</strong>
            <span class="finance-request-status is-pending">A aguardar validação</span>
          </div>
          <p class="finance-request-meta">${escapeHtml(kind.label)} · ${escapeHtml(category)}${symbol}${term}${cashDetail} · ${formatDateTime(itemDate(request))}</p>
          ${request.note ? `<p class="finance-request-note">“${escapeHtml(request.note)}”</p>` : ''}
          ${request.reflection ? `<p class="finance-request-note">Classificação: ${escapeHtml(reflectionLabel(request.reflection))}</p>` : ''}
        </div>
        <div class="finance-request-side">
          <span class="finance-request-amount">${formatEuro(amount)}</span>
          <div class="finance-request-actions">
            <button type="button" class="finance-approve-button" data-approve-request="${escapeAttr(requestId)}" data-child-id="${escapeAttr(request.childId)}">Validar</button>
            ${request.createdByRole === 'child' && request.kind !== 'vault_early_withdraw'
              ? `<button type="button" class="finance-correction-button" data-correct-request="${escapeAttr(requestId)}" data-child-id="${escapeAttr(request.childId)}">Pedir correção</button>`
              : ''}
            <button type="button" class="finance-danger-button" data-reject-request="${escapeAttr(requestId)}" data-child-id="${escapeAttr(request.childId)}">Reprovar</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function renderMovements() {
  if (!elements.movementsBody) return;
  const rows = combinedMovements()
    .filter(item => matchesFilters(item, { defaultStatus: 'approved' }))
    .sort((a, b) => itemTime(b) - itemTime(a));

  if (!rows.length) {
    elements.movementsBody.innerHTML = '<tr><td colspan="7"><div class="finance-empty-state">Sem movimentos para estes filtros.</div></td></tr>';
    return;
  }

  elements.movementsBody.innerHTML = rows.map(movement => {
    const kind = kindMeta(movement.kind || movement.type);
    const delta = movementDeltaCents(movement);
    const isCashTransfer = ['cash_withdrawal', 'cash_return'].includes(movement.kind || movement.type);
    const movementId = itemId(movement);
    const alreadyReversed = combinedMovements().some(item => item.reversalOfLedgerId === movementId);
    const canReverse = ['income', 'expense'].includes(movement.kind || movement.type) && !alreadyReversed;
    return `
      <tr>
        <td>${formatDateTime(itemDate(movement))}</td>
        <td><strong>${escapeHtml(CHILD_NAME[movement.childId] || movement.childId)}</strong></td>
        <td>${kind.icon} ${escapeHtml(kind.label)}</td>
        <td>${escapeHtml(categoryLabel(movement.category))}${movement.symbol || movement.instrumentId ? ` · ${escapeHtml(movement.symbol || movement.instrumentId)}` : ''}</td>
        <td>${escapeHtml([
          movement.note || movement.description,
          movement.kind === 'expense' ? movement.cashLocation === 'child' ? 'Pago por ela' : 'Pago pelos pais' : '',
          movement.kind === 'income' ? movement.cashLocation === 'child' ? 'Ficou com ela' : 'Ficou com os pais' : '',
          movement.reflection ? `Classificação: ${reflectionLabel(movement.reflection)}` : ''
        ].filter(Boolean).join(' · ') || '—')}</td>
        <td class="is-number ${isCashTransfer ? '' : delta >= 0 ? 'finance-money-positive' : 'finance-money-negative'}">${isCashTransfer ? `${movement.kind === 'cash_withdrawal' ? '→' : '←'} ${formatEuro(requestAmountCents(movement))}` : formatSignedEuro(delta)}</td>
        <td>${canReverse ? `<button type="button" class="finance-table-action" data-reverse-movement="${escapeAttr(movementId)}" data-child-id="${escapeAttr(movement.childId)}">Estornar</button>` : '—'}</td>
      </tr>`;
  }).join('');
}

function renderAudit() {
  if (!elements.auditBody) return;
  const events = combinedAuditEvents()
    .filter(matchesAuditFilters)
    .sort((a, b) => itemTime(b) - itemTime(a));
  if (events.length) {
    elements.auditBody.innerHTML = events.map(event => {
      const details = event.details || {};
      const amount = firstFiniteOrNull(details.amountCents, details.deltaCents);
      const detailParts = [
        details.reason,
        details.kind ? `Tipo: ${kindMeta(details.kind).label}` : '',
        details.from || details.to ? `Reflexão: ${reflectionLabel(details.from || 'sem classificação')} → ${reflectionLabel(details.to)}` : '',
        details.revision != null ? `Revisão ${details.revision}` : '',
        details.balanceAfterCents != null ? `Saldo após: ${formatEuro(details.balanceAfterCents)}` : ''
      ].filter(Boolean);
      const actor = event.actorRole === 'child'
        ? CHILD_NAME[event.childId]
        : event.actorRole === 'system' ? 'Sistema' : 'Pais';
      return `
        <tr>
          <td><strong>${escapeHtml(auditEventLabel(event.event))}</strong></td>
          <td>${escapeHtml(CHILD_NAME[event.childId] || event.childId)}</td>
          <td>${escapeHtml(actor)}</td>
          <td>${formatDateTime(event.occurredAt)}</td>
          <td>${escapeHtml(event.requestId || details.ledgerId || details.originalLedgerId || '—')}</td>
          <td>${escapeHtml(detailParts.join(' · ') || '—')}</td>
          <td class="is-number">${amount === null ? '—' : formatSignedEuro(amount)}</td>
        </tr>`;
    }).join('');
    return;
  }
  const rows = combinedRequests()
    .filter(item => matchesFilters(item))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || itemTime(b) - itemTime(a));

  if (!rows.length) {
    elements.auditBody.innerHTML = '<tr><td colspan="7"><div class="finance-empty-state">Sem decisões para estes filtros.</div></td></tr>';
    return;
  }

  elements.auditBody.innerHTML = rows.map(request => {
    const kind = kindMeta(request.kind || request.type);
    const noteParts = [request.correctionReason, request.lastCorrectionReason, request.rejectionReason, request.reason, request.decisionReason, request.note].filter(Boolean);
    return `
      <tr>
        <td><strong>${kind.icon} ${escapeHtml(kind.label)}</strong><br><small>${escapeHtml(categoryLabel(request.category))}${request.symbol || request.instrumentId ? ` · ${escapeHtml(request.symbol || request.instrumentId)}` : ''}</small></td>
        <td>${escapeHtml(CHILD_NAME[request.childId] || request.childId)}</td>
        <td>Pais / filha</td>
        <td>${formatDateTime(itemDate(request))}</td>
        <td>${escapeHtml(itemId(request))}</td>
        <td>${escapeHtml(noteParts.join(' · ') || '—')}</td>
        <td class="is-number">${formatEuro(requestAmountCents(request))}</td>
      </tr>`;
  }).join('');
}

function matchesAuditFilters(event) {
  const child = elements.childFilter?.value || 'all';
  const kind = elements.kindFilter?.value || 'all';
  const search = String(elements.searchFilter?.value || '').trim().toLocaleLowerCase('pt-PT');
  if (child !== 'all' && event.childId !== child) return false;
  if (kind !== 'all' && event.details?.kind !== kind) return false;
  if (!search) return true;
  return [
    event.event,
    auditEventLabel(event.event),
    event.requestId,
    event.actorUid,
    event.actorRole,
    event.details?.reason,
    event.details?.kind,
    event.details?.ledgerId,
    CHILD_NAME[event.childId]
  ].filter(Boolean).join(' ').toLocaleLowerCase('pt-PT').includes(search);
}

function auditEventLabel(event) {
  return ({
    'request.created': 'Movimento criado',
    'request.approved': 'Movimento validado',
    'request.correction_requested': 'Correção pedida',
    'request.correction_resubmitted': 'Correção reenviada',
    'request.rejected': 'Movimento reprovado',
    'request.cancelled': 'Movimento cancelado',
    'goal.saved': 'Objetivo guardado',
    'goal.reserve': 'Dinheiro reservado',
    'goal.release': 'Dinheiro libertado',
    'ledger.reversed': 'Movimento estornado',
    'expense.reflection_changed': 'Reflexão alterada',
    'vault.matured': 'Cofre vencido'
  })[event] || humanize(String(event || 'Evento').replaceAll('.', ' '));
}

function renderMonthly() {
  if (!elements.monthly) return;
  elements.monthly.innerHTML = selectedChildIds().map(childId => {
    const summary = state.snapshots.get(childId)?.monthlySummary;
    if (!summary) {
      return `<article class="finance-monthly-admin-card"><h3>${escapeHtml(CHILD_NAME[childId])}</h3><div class="finance-empty-state">Ainda sem resumo deste mês.</div></article>`;
    }
    const period = new Date(`${summary.period}-01T12:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    const metrics = [
      ['Recebeu', summary.receivedCents],
      ['Gastou', summary.spentCents],
      ['Levou consigo', summary.cashTakenCents],
      ['Devolveu aos pais', summary.cashReturnedCents],
      ['Reservou para objetivos', summary.goalReservedCents],
      ['Colocou em cofres', summary.vaultPlacedCents],
      ['Investiu', summary.investedCents],
      ['Juros recebidos', summary.interestReceivedCents],
      ['Ganhos realizados', summary.realizedGainsCents],
      ['Perdas realizadas', summary.realizedLossesCents],
      ['Resultado realizado líquido', summary.realizedNetCents],
      ['Necessidades', summary.needSpentCents],
      ['Desejos', summary.wantSpentCents],
      ['Variação registada do património', summary.wealthChangeCents]
    ];
    const insights = (summary.insights || []).map(insight => {
      if (insight.type === 'wants_share') return `${insight.percentage}% das despesas foram classificadas como desejos.`;
      if (insight.type === 'top_expense') return `Maior categoria de despesa: ${categoryLabel(insight.category)}, ${formatEuro(insight.amountCents)}.`;
      if (insight.type === 'saved_or_invested_share') return `O valor reservado ou investido equivale a ${insight.percentage}% do dinheiro recebido.`;
      return '';
    }).filter(Boolean);
    return `
      <article class="finance-monthly-admin-card">
        <div class="finance-monthly-heading"><h3>${escapeHtml(CHILD_NAME[childId])}</h3><span>${escapeHtml(period)}</span></div>
        <dl class="finance-monthly-metrics">
          ${metrics.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${formatEuro(Number(value) || 0)}</dd></div>`).join('')}
        </dl>
        ${insights.length ? `<ul class="finance-monthly-insights">${insights.map(insight => `<li>${escapeHtml(insight)}</li>`).join('')}</ul>` : ''}
      </article>`;
  }).join('');
}

function renderInvestments() {
  if (!elements.investments) return;
  const visibleChildren = selectedChildIds();
  elements.investments.innerHTML = visibleChildren.map(childId => renderInvestmentCard(childId)).join('');
}

function renderInvestmentCard(childId) {
  const childName = CHILD_NAME[childId] || childId;
  const snapshot = state.snapshots.get(childId);
  if (!snapshot) {
    return `<article class="finance-investment-card"><h3>${escapeHtml(childName)}</h3><div class="finance-error-state">Conta indisponível.</div></article>`;
  }

  const account = snapshot.account || {};
  const cash = Math.max(0, centsFrom(account, ['availableCents', 'balanceCents', 'cashCents']));
  const balance = centsFrom(account, ['rawBalanceCents', 'balanceCents', 'confirmedBalanceCents']);
  const debt = Math.max(0, firstFinite(account.debtCents, -balance));
  const vaultValue = Math.max(0, centsFrom(account, ['vaultCents', 'termCents', 'lockedCents']));
  const marketValue = Math.max(0, centsFrom(account, ['marketCents', 'marketValueCents', 'investedCents']));
  const exposureTotal = cash + vaultValue + marketValue;
  const netWorth = firstFinite(account.totalCents, account.netWorthCents, balance + vaultValue + marketValue);
  const width = value => exposureTotal > 0 ? Math.max(0, (value / exposureTotal) * 100) : 0;
  const positions = snapshot.positions.filter(position => positionQuantity(position) !== 0);
  const vaults = snapshot.vaults.filter(vault => !['cancelled', 'rejected'].includes(String(vault.status || '').toLowerCase()));

  return `
    <article class="finance-investment-card" data-child="${escapeAttr(childId)}">
      <h3>${escapeHtml(childName)}</h3>
      <span class="finance-exposure-total">Património líquido: <strong class="${netWorth < 0 ? 'finance-money-negative' : ''}">${formatEuro(netWorth)}</strong>${debt > 0 ? ` · Dívida aos pais <strong class="finance-money-negative">${formatEuro(debt)}</strong>` : ''}</span>
      <div class="finance-exposure-bar" aria-label="Exposição de ${escapeAttr(childName)}">
        <span class="finance-exposure-segment is-cash" style="width:${width(cash).toFixed(2)}%" title="Disponível ${formatEuro(cash)}"></span>
        <span class="finance-exposure-segment is-vault" style="width:${width(vaultValue).toFixed(2)}%" title="A prazo ${formatEuro(vaultValue)}"></span>
        <span class="finance-exposure-segment is-market" style="width:${width(marketValue).toFixed(2)}%" title="Mercado ${formatEuro(marketValue)}"></span>
      </div>
      <div class="finance-exposure-legend">
        <span style="--legend-color:var(--finance-green)">Disponível ${formatPercentage(width(cash))}</span>
        <span style="--legend-color:#e2a72f">A prazo ${formatPercentage(width(vaultValue))}</span>
        <span style="--legend-color:var(--finance-blue)">Mercado ${formatPercentage(width(marketValue))}</span>
      </div>
      <h4>Posições de mercado</h4>
      <div class="finance-position-list">
        ${positions.length ? positions.map(renderPosition).join('') : '<div class="finance-empty-state">Ainda sem posições de mercado.</div>'}
      </div>
      <h4>Investimentos a prazo</h4>
      <div class="finance-vault-list">
        ${vaults.length ? vaults.map(vault => renderVault(vault, childId)).join('') : '<div class="finance-empty-state">Ainda sem dinheiro bloqueado a prazo.</div>'}
      </div>
    </article>`;
}

function renderPosition(position) {
  const symbol = String(position.symbol || position.ticker || 'Ativo').toUpperCase();
  const name = position.name || position.label || symbol;
  const quantity = positionQuantity(position);
  const value = firstFinite(position.marketValueCents, position.valueCents, position.currentValueCents, 0);
  const pnl = firstFiniteOrNull(
    position.unrealizedPnlCents,
    position.pnlCents,
    position.resultCents,
    position.gainCents
  );
  const invested = firstFinite(position.costBasisCents, position.investedCents, position.costCents, 0);
  const returnPct = invested > 0 && Number.isFinite(pnl) ? (pnl / invested) * 100 : null;
  const realized = firstFiniteOrNull(position.realizedPnlCents);
  return `
    <div class="finance-position-row">
      <div><strong>${escapeHtml(symbol)} · ${escapeHtml(name)}</strong><span>${formatQuantity(quantity)} unidades</span></div>
      <div class="finance-position-values"><strong>${formatEuro(value)}</strong>${Number.isFinite(pnl) ? `<span class="${pnl >= 0 ? 'finance-money-positive' : 'finance-money-negative'}">Atual ${formatSignedEuro(pnl)}${returnPct !== null ? ` · ${returnPct >= 0 ? '+' : ''}${returnPct.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%` : ''}</span>` : ''}${realized !== null && realized !== 0 ? `<span class="${realized >= 0 ? 'finance-money-positive' : 'finance-money-negative'}">Realizado ${formatSignedEuro(realized)}</span>` : ''}</div>
    </div>`;
}

function renderVault(vault, childId) {
  const id = itemId(vault);
  const principal = firstFinite(vault.principalCents, vault.amountCents, vault.balanceCents, 0);
  const expected = firstFinite(
    vault.maturityValueCents,
    vault.expectedCents,
    vault.expectedValueCents,
    principal + firstFinite(vault.expectedInterestCents, vault.interestPaidCents, 0)
  );
  const maturity = vault.maturesAt || vault.maturityAt || vault.endAt || vault.unlockAt;
  const status = String(vault.status || 'active').toLowerCase();
  const canWithdraw = ['active', 'open', 'locked'].includes(status) && Boolean(id);
  return `
    <div class="finance-vault-row">
      <div>
        <strong>${escapeHtml(formatTermDays(vault.termDays || vault.durationDays))} · ${escapeHtml(formatRate(vault))}</strong>
        <span>Termina ${formatDate(maturity)}</span>
      </div>
      <div class="finance-vault-values"><strong>${formatEuro(principal)}</strong><span>Previsto ${formatEuro(expected)}</span></div>
      ${canWithdraw ? `<button type="button" data-withdraw-vault="${escapeAttr(id)}" data-child-id="${escapeAttr(childId)}" data-principal-cents="${principal}" data-reward-cents="${Math.max(0, expected - principal)}">Levantar antes do prazo</button>` : ''}
    </div>`;
}

function matchesFilters(item, { defaultStatus = '' } = {}) {
  const child = elements.childFilter?.value || 'all';
  const status = elements.statusFilter?.value || 'all';
  const kind = elements.kindFilter?.value || 'all';
  const search = String(elements.searchFilter?.value || '').trim().toLocaleLowerCase('pt-PT');
  const itemStatus = normalizeStatus(item.status || defaultStatus);
  const itemKind = String(item.kind || item.type || '');

  if (child !== 'all' && item.childId !== child) return false;
  if (status !== 'all' && itemStatus !== status) return false;
  if (kind !== 'all' && itemKind !== kind) return false;
  if (search) {
    const haystack = [
      itemKind,
      kindMeta(itemKind).label,
      item.category,
      categoryLabel(item.category),
      item.note,
      item.description,
      item.reason,
      item.decisionReason,
      item.correctionReason,
      item.lastCorrectionReason,
      item.symbol,
      item.instrumentId,
      CHILD_NAME[item.childId]
    ].filter(Boolean).join(' ').toLocaleLowerCase('pt-PT');
    if (!haystack.includes(search)) return false;
  }
  return true;
}

function selectedChildIds() {
  const selected = elements.childFilter?.value || 'all';
  return selected === 'all' ? CHILDREN.map(child => child.id) : [selected];
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('[data-finance-tab]').forEach(button => {
    const active = button.dataset.financeTab === tabName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-finance-panel]').forEach(panel => {
    panel.hidden = panel.dataset.financePanel !== tabName;
  });
}

async function decideRequest(childId, requestId, decision, reason = '') {
  await runMutation({
    childId,
    action: 'decideRequest',
    payload: { requestId, decision, ...(reason ? { reason } : {}) },
    successMessage: decision === 'approved' ? 'Movimento validado e saldo atualizado.' : 'Movimento reprovado e guardado no histórico.'
  });
}

async function runMutation({ childId, action, payload, successMessage }) {
  if (state.mutating) return;
  state.mutating = true;
  setToolbarDisabled(true);
  document.querySelectorAll('.finance-admin-workspace button').forEach(button => { button.disabled = true; });
  setSyncState('is-neutral', 'A guardar…', 'A validar e atualizar a conta.');
  try {
    await familyFinanceApi({ childId, action, payload });
    showToast(successMessage, 'success');
    await loadAllData({ quiet: true });
  } catch (error) {
    console.error(`Erro na ação ${action}:`, error);
    showToast(error.message || 'Não foi possível guardar a alteração.', 'error', 5500);
    setSyncState('is-error', 'Não guardado', error.message || 'Tenta novamente.');
  } finally {
    state.mutating = false;
    setToolbarDisabled(false);
    document.querySelectorAll('.finance-admin-workspace button').forEach(button => { button.disabled = false; });
  }
}

function openRejectDialog(childId, requestId) {
  const request = combinedRequests().find(item => item.childId === childId && itemId(item) === requestId);
  if (!request || !elements.rejectDialog || !elements.rejectForm) return;
  elements.rejectForm.elements.childId.value = childId;
  elements.rejectForm.elements.requestId.value = requestId;
  elements.rejectForm.elements.reason.value = '';
  if (elements.rejectSummary) {
    elements.rejectSummary.textContent = `${CHILD_NAME[childId]} · ${kindMeta(request.kind || request.type).label} · ${formatEuro(requestAmountCents(request))}`;
  }
  elements.rejectDialog.showModal();
  requestAnimationFrame(() => elements.rejectForm.elements.reason.focus());
}

function requestDialogSummary(request, childId) {
  return `${CHILD_NAME[childId]} · ${kindMeta(request.kind || request.type).label} · ${formatEuro(requestAmountCents(request))}`;
}

function openCorrectionDialog(childId, requestId) {
  const request = combinedRequests().find(item => item.childId === childId && itemId(item) === requestId);
  if (!request || !elements.correctionDialog || !elements.correctionForm) return;
  elements.correctionForm.elements.childId.value = childId;
  elements.correctionForm.elements.requestId.value = requestId;
  elements.correctionForm.elements.reason.value = '';
  if (elements.correctionSummary) elements.correctionSummary.textContent = requestDialogSummary(request, childId);
  elements.correctionDialog.showModal();
  requestAnimationFrame(() => elements.correctionForm.elements.reason.focus());
}

function openReversalDialog(childId, ledgerId) {
  const movement = combinedMovements().find(item => item.childId === childId && itemId(item) === ledgerId);
  if (!movement || !elements.reversalDialog || !elements.reversalForm) return;
  elements.reversalForm.elements.childId.value = childId;
  elements.reversalForm.elements.ledgerId.value = ledgerId;
  elements.reversalForm.elements.reason.value = '';
  if (elements.reversalSummary) {
    elements.reversalSummary.textContent = `${CHILD_NAME[childId]} · ${kindMeta(movement.kind || movement.type).label} · ${formatSignedEuro(movementDeltaCents(movement))}. O original permanece no extrato e será criado um movimento inverso.`;
  }
  elements.reversalDialog.showModal();
  requestAnimationFrame(() => elements.reversalForm.elements.reason.focus());
}

function openAdjustmentDialog() {
  if (!elements.adjustmentDialog || !elements.adjustmentForm) return;
  elements.adjustmentForm.reset();
  elements.adjustmentForm.elements.occurredOn.value = todayLocal();
  populateAdjustmentCategories();
  elements.adjustmentDialog.showModal();
  requestAnimationFrame(() => elements.adjustmentForm.elements.amount.focus());
}

function populateAdjustmentCategories() {
  if (!elements.adjustmentCategory) return;
  const kind = elements.adjustmentKind?.value || 'income';
  elements.adjustmentCategory.innerHTML = (ADJUSTMENT_CATEGORIES[kind] || ADJUSTMENT_CATEGORIES.income)
    .map(category => `<option value="${category}">${escapeHtml(categoryLabel(category))}</option>`)
    .join('');
}

async function submitAdjustment(event) {
  event.preventDefault();
  if (!elements.adjustmentForm?.reportValidity()) return;
  const form = new FormData(elements.adjustmentForm);
  const amountCents = Math.round(Number(form.get('amount')) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    showToast('Introduz um valor válido.', 'warning');
    return;
  }

  const childId = String(form.get('childId') || '');
  const category = String(form.get('category') || 'other');
  const note = String(form.get('note') || '').trim();
  const payload = {
    deltaCents: String(form.get('kind') || '') === 'expense' ? -amountCents : amountCents,
    category,
    occurredOn: String(form.get('occurredOn') || ''),
    note: note || categoryLabel(category),
    idempotencyKey: crypto.randomUUID?.() || `parent-${Date.now()}-${Math.random().toString(36).slice(2)}`
  };
  elements.adjustmentDialog.close();
  await runMutation({
    childId,
    action: 'parentAdjustment',
    payload,
    successMessage: `Movimento de ${CHILD_NAME[childId]} guardado e validado.`
  });
}

async function submitRejection(event) {
  event.preventDefault();
  if (!elements.rejectForm?.reportValidity()) return;
  const form = new FormData(elements.rejectForm);
  const childId = String(form.get('childId') || '');
  const requestId = String(form.get('requestId') || '');
  const reason = String(form.get('reason') || '').trim();
  elements.rejectDialog.close();
  await decideRequest(childId, requestId, 'rejected', reason);
}

async function submitCorrection(event) {
  event.preventDefault();
  if (!elements.correctionForm?.reportValidity()) return;
  const form = new FormData(elements.correctionForm);
  const childId = String(form.get('childId') || '');
  const requestId = String(form.get('requestId') || '');
  const reason = String(form.get('reason') || '').trim();
  elements.correctionDialog.close();
  await runMutation({
    childId,
    action: 'requestCorrection',
    payload: { requestId, reason },
    successMessage: `Correção pedida a ${CHILD_NAME[childId]}. O movimento continua sem alterar o saldo.`
  });
}

async function submitReversal(event) {
  event.preventDefault();
  if (!elements.reversalForm?.reportValidity()) return;
  const form = new FormData(elements.reversalForm);
  const childId = String(form.get('childId') || '');
  const ledgerId = String(form.get('ledgerId') || '');
  const reason = String(form.get('reason') || '').trim();
  elements.reversalDialog.close();
  await runMutation({
    childId,
    action: 'reverseMovement',
    payload: { ledgerId, reason },
    successMessage: 'Estorno criado sem alterar nem apagar o movimento original.'
  });
}

async function refreshQuotes() {
  const selected = selectedChildIds()[0] || 'francisca';
  await runMutation({
    childId: selected,
    action: 'refreshQuotes',
    payload: {},
    successMessage: 'Cotações verificadas. O limite diário e a cache foram respeitados.'
  });
}

function bindEvents() {
  elements.reload?.addEventListener('click', () => loadAllData());
  elements.refreshQuotes?.addEventListener('click', refreshQuotes);
  elements.addMovement?.addEventListener('click', openAdjustmentDialog);
  elements.adjustmentKind?.addEventListener('change', populateAdjustmentCategories);
  elements.adjustmentForm?.addEventListener('submit', submitAdjustment);
  elements.rejectForm?.addEventListener('submit', submitRejection);
  elements.correctionForm?.addEventListener('submit', submitCorrection);
  elements.reversalForm?.addEventListener('submit', submitReversal);
  window.addEventListener('finance:clear-private-data', () => {
    state.snapshots.clear();
    state.errors.clear();
    renderAll();
    setSyncState('is-neutral', 'Sessão terminada', 'Os dados privados foram removidos deste ecrã.');
  });

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close());
  });

  document.querySelectorAll('[data-finance-tab]').forEach(button => {
    button.addEventListener('click', () => setActiveTab(button.dataset.financeTab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const tabs = Array.from(document.querySelectorAll('[data-finance-tab]'));
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (tabs.indexOf(button) + direction + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[nextIndex].focus();
      setActiveTab(tabs[nextIndex].dataset.financeTab);
    });
  });

  elements.filters?.addEventListener('input', renderAll);
  elements.filters?.addEventListener('change', renderAll);
  elements.filters?.addEventListener('reset', () => setTimeout(renderAll));

  document.querySelector('.finance-admin-workspace')?.addEventListener('click', event => {
    const approveButton = event.target.closest('[data-approve-request]');
    if (approveButton) {
      const requestId = approveButton.dataset.approveRequest;
      const childId = approveButton.dataset.childId;
      const request = combinedRequests().find(item => item.childId === childId && itemId(item) === requestId);
      const summary = request
        ? `${CHILD_NAME[childId]}: ${kindMeta(request.kind || request.type).label.toLocaleLowerCase('pt-PT')} de ${formatEuro(requestAmountCents(request))}`
        : `este pedido de ${CHILD_NAME[childId] || childId}`;
      showConfirm(`Validar ${summary}?`, () => void decideRequest(childId, requestId, 'approved'), undefined, {
        confirmLabel: 'Validar movimento',
        cancelLabel: 'Voltar'
      });
      return;
    }

    const correctButton = event.target.closest('[data-correct-request]');
    if (correctButton) {
      openCorrectionDialog(correctButton.dataset.childId, correctButton.dataset.correctRequest);
      return;
    }

    const rejectButton = event.target.closest('[data-reject-request]');
    if (rejectButton) {
      openRejectDialog(rejectButton.dataset.childId, rejectButton.dataset.rejectRequest);
      return;
    }

    const reverseButton = event.target.closest('[data-reverse-movement]');
    if (reverseButton) {
      openReversalDialog(reverseButton.dataset.childId, reverseButton.dataset.reverseMovement);
      return;
    }

    const withdrawButton = event.target.closest('[data-withdraw-vault]');
    if (withdrawButton) {
      const childId = withdrawButton.dataset.childId;
      const vaultId = withdrawButton.dataset.withdrawVault;
      const principal = Number(withdrawButton.dataset.principalCents) || 0;
      const reward = Number(withdrawButton.dataset.rewardCents) || 0;
      showConfirm(`Ao levantar antes do prazo, regressam ${formatEuro(principal)} ao disponível e perdem-se ${formatEuro(reward)} de juros previstos.`, () => {
        void runMutation({
          childId,
          action: 'earlyWithdraw',
          payload: { vaultId },
          successMessage: 'Levantamento antecipado registado.'
        });
      }, undefined, { confirmLabel: 'Levantar agora', cancelLabel: 'Manter no cofre' });
    }
  });
}

function centsFrom(object, keys) {
  for (const key of keys) {
    const value = Number(object?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function firstFinite(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function kindMeta(kind) {
  return KIND_META[kind] || { label: humanize(kind || 'Movimento'), icon: '🧾', direction: 1 };
}

function statusMeta(status) {
  return STATUS_META[normalizeStatus(status)] || { label: humanize(status || 'Desconhecido'), className: 'is-cancelled' };
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['pending', 'correction_required', 'approved', 'rejected', 'cancelled'].includes(value)) return value;
  if (value === 'approve' || value === 'accepted') return 'approved';
  if (value === 'reject' || value === 'denied') return 'rejected';
  if (value === 'canceled') return 'cancelled';
  if (['needs_correction', 'correction_needed', 'requires_correction'].includes(value)) return 'correction_required';
  return value;
}

function statusRank(status) {
  return { pending: 0, correction_required: 1, rejected: 2, approved: 3, cancelled: 4 }[normalizeStatus(status)] ?? 5;
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || humanize(category || 'other');
}

function reflectionLabel(reflection) {
  return reflection === 'need' ? 'necessidade' : reflection === 'want' ? 'desejo' : humanize(reflection);
}

function requestAmountCents(request) {
  return Math.abs(firstFinite(
    request.executedAmountCents,
    request.amountCents,
    request.totalCents,
    request.valueCents,
    request.cashAmountCents,
    0
  ));
}

function positionQuantity(position) {
  const direct = firstFiniteOrNull(position.quantity, position.units, position.shares);
  if (direct !== null) return direct;
  const micros = firstFiniteOrNull(position.quantityMicros);
  return micros === null ? 0 : micros / 1_000_000;
}

function movementDeltaCents(movement) {
  const explicit = firstFiniteOrNull(movement.deltaCents, movement.balanceDeltaCents, movement.signedAmountCents);
  if (explicit !== null) return explicit;
  const amount = Math.abs(firstFinite(movement.amountCents, movement.totalCents, movement.valueCents, 0));
  return amount * kindMeta(movement.kind || movement.type).direction;
}

function firstFiniteOrNull(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function itemId(item) {
  return String(item?.id || item?.requestId || item?.movementId || item?.vaultId || '');
}

function itemDate(item) {
  return item?.createdAt || item?.requestedAt || item?.occurredAt || item?.occurredOn || item?.date || item?.updatedAt;
}

function itemTime(item) {
  return toDate(itemDate(item))?.getTime() || 0;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'object') {
    const seconds = firstFiniteOrNull(value.seconds, value._seconds);
    if (seconds !== null) return new Date(seconds * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function formatDateTime(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

function formatTime(value) {
  return value.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function formatEuro(cents) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format((Number(cents) || 0) / 100);
}

function formatSignedEuro(cents) {
  const value = Number(cents) || 0;
  return `${value >= 0 ? '+' : '−'}${formatEuro(Math.abs(value))}`;
}

function formatPercentage(value) {
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Number(value) || 0)}%`;
}

function formatQuantity(value) {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 6 }).format(Number(value) || 0);
}

function formatTermDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return 'Prazo';
  if (days === 1) return '1 dia';
  if (days === 30) return '1 mês';
  if (days === 365) return '1 ano';
  return `${days} dias`;
}

function formatRate(vault) {
  const rateBps = firstFiniteOrNull(vault?.annualRateBps, vault?.rateBps);
  if (rateBps !== null) return `${rateBps / 100}% ao ano`;
  const raw = firstFiniteOrNull(vault?.annualRate, vault?.rate, vault?.interestRate);
  if (raw === null) return 'taxa definida';
  const percentage = Math.abs(raw) <= 1 ? raw * 100 : raw;
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(percentage)}% ao ano`;
}

function humanize(value) {
  const text = String(value || '').replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1) : 'Outro';
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function initialize() {
  bindEvents();
  populateAdjustmentCategories();
  const access = await whenAccessResolved();
  if (access.moduleKey !== 'gestao-financas' || access.mode === 'none') return;
  await loadAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
