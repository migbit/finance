const FAMILY_FINANCE_FUNCTION_ENDPOINT =
  'https://europe-west1-apartments-a4b17.cloudfunctions.net/familyFinance';

export function resolveFamilyFinanceEndpoint(hostname = globalThis.location?.hostname || '') {
  const host = String(hostname || '').trim().toLowerCase();
  const onFirebaseHosting = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
  return onFirebaseHosting ? '/api/family-finance' : FAMILY_FINANCE_FUNCTION_ENDPOINT;
}

export const FAMILY_FINANCE_ENDPOINT = resolveFamilyFinanceEndpoint();
const REJECTED_VISIBLE_FOR_MS = 24 * 60 * 60 * 1000;

const euroFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export const CHILD_PROFILES = Object.freeze({
  francisca: Object.freeze({
    id: 'francisca',
    name: 'Francisca',
    age: 11,
    kicker: 'Aprender hoje para escolher melhor amanhã',
    title: 'As minhas finanças',
    lead: 'Planeia, distingue necessidades de desejos e descobre como o dinheiro pode crescer.',
    investLabel: 'Investir',
    availableLabel: 'Disponível para usar',
    goalEmpty: 'Cria um objetivo e acompanha quanto falta para o alcançar.',
    movementIntro: 'Aqui vês o que aconteceu e o que ainda aguarda validação.',
    chartMode: 'doughnut',
    learningTips: Object.freeze([
      'Antes de gastar, compara o preço com o valor que esse dinheiro tem para o teu objetivo.',
      'Um ETF reparte o dinheiro por várias empresas; uma ação depende de uma só empresa.',
      'O valor de mercado sobe e desce. Ganhos e perdas só ficam realizados quando vendes.'
    ])
  }),
  leonor: Object.freeze({
    id: 'leonor',
    name: 'Leonor',
    age: 8,
    kicker: 'Aprender passo a passo',
    title: 'O meu dinheiro',
    lead: 'Vê quanto tens, escolhe com calma e aprende para onde vai cada moeda.',
    investLabel: 'Pôr a crescer',
    availableLabel: 'Dinheiro que podes usar',
    goalEmpty: 'Escolhe algo para o qual gostavas de guardar dinheiro.',
    movementIntro: 'Os teus últimos movimentos e os registos por validar aparecem aqui.',
    chartMode: 'bar',
    learningTips: Object.freeze([
      'Guardar um pouco agora pode ajudar-te a comprar algo importante mais tarde.',
      'Antes de gastar, pergunta: preciso mesmo ou posso esperar?',
      'Quando o dinheiro está no mercado, o valor pode subir e também pode descer.'
    ])
  })
});

export const VAULT_TERMS = Object.freeze([
  Object.freeze({ days: 1, label: '1 dia' }),
  Object.freeze({ days: 7, label: '7 dias' }),
  Object.freeze({ days: 30, label: '30 dias' }),
  Object.freeze({ days: 90, label: '90 dias' }),
  Object.freeze({ days: 365, label: '1 ano' })
]);

export const INCOME_CATEGORIES = Object.freeze([
  Object.freeze({ value: 'gift', label: 'Prenda' }),
  Object.freeze({ value: 'allowance', label: 'Mesada ou semanada' }),
  Object.freeze({ value: 'task', label: 'Tarefa ou pequeno trabalho' }),
  Object.freeze({ value: 'sale', label: 'Venda' }),
  Object.freeze({ value: 'reward', label: 'Juros ou recompensa' }),
  Object.freeze({ value: 'other', label: 'Outro' })
]);

export const EXPENSE_CATEGORIES = Object.freeze([
  Object.freeze({ value: 'toys', label: 'Brinquedos' }),
  Object.freeze({ value: 'school', label: 'Material escolar' }),
  Object.freeze({ value: 'food', label: 'Lanches e comida' }),
  Object.freeze({ value: 'books', label: 'Livros' }),
  Object.freeze({ value: 'leisure', label: 'Lazer e experiências' }),
  Object.freeze({ value: 'gifts', label: 'Presentes ou doações' }),
  Object.freeze({ value: 'technology', label: 'Tecnologia' }),
  Object.freeze({ value: 'other', label: 'Outro' })
]);

const CATEGORY_LABELS = new Map([
  ...[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map(category => [category.value, category.label]),
  ['adjustment', 'Ajuste dos pais'],
  ['investment_interest', 'Juros do cofre'],
  ['investment_realized_gain', 'Ganhos realizados'],
  ['investment_realized_loss', 'Perdas realizadas'],
  ['vault', 'Cofre a prazo'],
  ['market', 'Mercado simulado'],
  ['savings_goal', 'Objetivo de poupança'],
  ['reversal', 'Estorno']
]);

const STATUS_ALIASES = Object.freeze({
  awaiting_approval: 'pending',
  awaiting: 'pending',
  requested: 'pending',
  accepted: 'approved',
  confirmed: 'approved',
  declined: 'rejected',
  refused: 'rejected',
  canceled: 'cancelled',
  needs_correction: 'correction_required',
  correction_needed: 'correction_required',
  requires_correction: 'correction_required'
});

const KIND_ALIASES = Object.freeze({
  receive: 'income',
  received: 'income',
  credit: 'income',
  spend: 'expense',
  spent: 'expense',
  debit: 'expense',
  vault: 'vault_open',
  term_open: 'vault_open',
  term_deposit: 'vault_open',
  buy: 'market_buy',
  investment_buy: 'market_buy',
  sell: 'market_sell',
  investment_sell: 'market_sell',
  goal_save: 'goal_reserve',
  goal_withdraw: 'goal_release'
});

function finiteNumber(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function firstValue(objects, keys) {
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue;
    for (const key of keys) {
      if (object[key] != null) return object[key];
    }
  }
  return null;
}

function readMoneyCents(objects, centsKeys, euroKeys = []) {
  const cents = firstFinite(firstValue(objects, centsKeys));
  if (cents != null) return Math.round(cents);
  const euros = firstFinite(firstValue(objects, euroKeys));
  return euros == null ? null : Math.round(euros * 100);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).map(([id, item]) => (
    item && typeof item === 'object' ? { id, ...item } : { id, value: item }
  ));
}

function dateToMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'object') {
    const seconds = firstFinite(value.seconds, value._seconds);
    if (seconds != null) return seconds * 1000;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeStatus(value) {
  const status = String(value || 'pending').trim().toLowerCase();
  return STATUS_ALIASES[status] || status;
}

function normalizeKind(value) {
  const kind = String(value || 'other').trim().toLowerCase();
  return KIND_ALIASES[kind] || kind;
}

function normalizeMovement(raw = {}, index = 0) {
  const kind = normalizeKind(raw.kind || raw.requestKind || raw.type || raw.movementType);
  const rawAmount = readMoneyCents(
    [raw],
    ['amountCents', 'valueCents', 'principalCents', 'totalCents'],
    ['amount', 'value', 'principal', 'total']
  ) ?? 0;
  const rawDelta = readMoneyCents(
    [raw],
    ['deltaCents', 'signedAmountCents'],
    ['delta', 'signedAmount']
  );
  const createdAtMs = dateToMs(raw.createdAt || raw.requestedAt || raw.timestamp || raw.date);
  const occurredAtMs = dateToMs(raw.occurredAt || raw.occurredOn || raw.transactionDate) ?? createdAtMs;
  const decidedAtMs = dateToMs(raw.decidedAt || raw.reviewedAt || raw.approvedAt || raw.rejectedAt);
  const inferredStatus = raw.status || raw.state
    || (raw.deltaCents != null || raw.sequence != null || raw.balanceAfterCents != null ? 'approved' : 'pending');

  return {
    ...raw,
    id: String(raw.id || raw.requestId || raw.ledgerId || `movement-${index}`),
    requestId: raw.requestId ? String(raw.requestId) : null,
    kind,
    status: normalizeStatus(inferredStatus),
    category: String(raw.category || raw.categoryId || 'other'),
    categoryLabel: String(raw.categoryLabel || CATEGORY_LABELS.get(raw.category || raw.categoryId) || 'Outro'),
    amountCents: Math.abs(rawAmount),
    signedAmountCents: rawDelta ?? (kind === 'expense' ? -Math.abs(rawAmount) : rawAmount),
    note: String(raw.note || raw.description || '').trim(),
    rejectionReason: String(raw.rejectionReason || raw.decisionReason || '').trim(),
    correctionReason: String(raw.correctionReason || '').trim(),
    symbol: String(raw.symbol || raw.instrumentSymbol || raw.instrumentId || '').trim().toUpperCase(),
    instrumentType: String(raw.instrumentType || raw.assetType || '').trim().toLowerCase(),
    termDays: firstFinite(raw.termDays, raw.durationDays),
    createdAtMs,
    occurredAtMs,
    decidedAtMs,
    rejectedAtMs: dateToMs(raw.rejectedAt) ?? (normalizeStatus(inferredStatus) === 'rejected' ? decidedAtMs : null),
    visibleToChildUntilMs: dateToMs(raw.visibleToChildUntil)
  };
}

function mergeMovements(snapshot) {
  const sources = [
    ...asArray(snapshot.movements),
    ...asArray(snapshot.activity),
    ...asArray(snapshot.ledger),
    ...asArray(snapshot.requests)
  ];
  const seen = new Map();

  sources.forEach((raw, index) => {
    const movement = normalizeMovement(raw, index);
    const key = movement.requestId && movement.id !== movement.requestId
      ? movement.id
      : movement.requestId || movement.id;
    const existing = seen.get(key);
    if (!existing || (existing.status === 'pending' && movement.status !== 'pending')) {
      seen.set(key, movement);
    }
  });

  return [...seen.values()].sort((a, b) => (
    (b.occurredAtMs || b.createdAtMs || 0) - (a.occurredAtMs || a.createdAtMs || 0)
  ));
}

function normalizeVault(raw = {}, index = 0) {
  const principalCents = readMoneyCents(
    [raw],
    ['principalCents', 'amountCents', 'lockedCents'],
    ['principal', 'amount', 'locked']
  ) ?? 0;
  const rewardCents = readMoneyCents(
    [raw],
    ['rewardCents', 'interestCents', 'expectedInterestCents', 'bonusCents'],
    ['reward', 'interest', 'bonus']
  ) ?? 0;
  return {
    ...raw,
    id: String(raw.id || raw.vaultId || `vault-${index}`),
    status: normalizeStatus(raw.status || 'active'),
    principalCents: Math.max(0, principalCents),
    rewardCents: Math.max(0, rewardCents),
    currentValueCents: Math.max(0, readMoneyCents(
      [raw],
      ['currentValueCents', 'maturityValueCents'],
      ['currentValue', 'maturityValue']
    ) ?? (principalCents + rewardCents)),
    termDays: firstFinite(raw.termDays, raw.durationDays) || 0,
    openedAtMs: dateToMs(raw.openedAt || raw.createdAt),
    maturesAtMs: dateToMs(raw.maturesAt || raw.maturityDate || raw.endsAt)
  };
}

function normalizePosition(raw = {}, index = 0) {
  const investedCents = readMoneyCents(
    [raw],
    ['investedCents', 'costCents', 'costBasisCents'],
    ['invested', 'cost', 'costBasis']
  ) ?? 0;
  const currentValueCents = readMoneyCents(
    [raw],
    ['currentValueCents', 'marketValueCents', 'valueCents'],
    ['currentValue', 'marketValue', 'value']
  ) ?? 0;
  return {
    ...raw,
    id: String(raw.id || raw.symbol || `position-${index}`),
    symbol: String(raw.symbol || raw.instrumentSymbol || '').trim().toUpperCase(),
    name: String(raw.name || raw.instrumentName || raw.symbol || 'Investimento'),
    instrumentType: String(raw.instrumentType || raw.assetType || 'etf').trim().toLowerCase(),
    quantity: firstFinite(raw.quantity, raw.units, raw.shares)
      ?? ((firstFinite(raw.quantityMicros) || 0) / 1_000_000),
    investedCents: Math.max(0, investedCents),
    currentValueCents: Math.max(0, currentValueCents),
    resultCents: currentValueCents - investedCents
  };
}

function normalizeQuote(raw = {}, index = 0) {
  const symbol = String(raw.symbol || raw.ticker || raw.id || `quote-${index}`).trim().toUpperCase();
  return {
    ...raw,
    id: symbol,
    symbol,
    name: String(raw.name || raw.instrumentName || symbol),
    instrumentType: String(raw.instrumentType || raw.assetType || raw.type || 'etf').trim().toLowerCase(),
    priceCents: Math.max(0, readMoneyCents(
      [raw],
      ['priceCents', 'currentPriceCents', 'lastPriceCents'],
      ['price', 'currentPrice', 'lastPrice']
    ) ?? 0),
    changePercent: firstFinite(raw.changePercent, raw.changePct, raw.percentChange),
    currency: String(raw.currency || 'EUR').toUpperCase(),
    marketAsOfMs: dateToMs(raw.marketAsOf || raw.asOf || raw.updatedAt),
    cachedAtMs: dateToMs(raw.cachedAt || raw.fetchedAt || raw.updatedAt),
    stale: Boolean(raw.stale)
  };
}

function normalizeGoal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const targetCents = readMoneyCents([raw], ['targetCents', 'amountCents'], ['target', 'amount']) ?? 0;
  const reservedCents = readMoneyCents(
    [raw],
    ['reservedCents', 'savedCents', 'progressCents'],
    ['reserved', 'saved', 'progress']
  ) ?? 0;
  if (!raw.title && targetCents <= 0) return null;
  return {
    ...raw,
    id: String(raw.id || 'main-goal'),
    title: String(raw.title || raw.name || 'O meu objetivo').trim(),
    targetCents: Math.max(0, targetCents),
    reservedCents: Math.max(0, reservedCents),
    savedCents: Math.max(0, reservedCents),
    targetDateMs: dateToMs(raw.targetDate || raw.dueDate)
  };
}

function normalizeCategoryBreakdown(value) {
  if (value && !Array.isArray(value) && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => {
      if (typeof item === 'number') {
        return {
          key,
          label: String(CATEGORY_LABELS.get(key) || key),
          amountCents: Math.max(0, Math.round(item))
        };
      }
      return { key, ...(item || {}) };
    }).map((item, index) => {
      const key = String(item.key || item.category || item.id || `category-${index}`);
      return {
        key,
        label: String(item.label || item.categoryLabel || CATEGORY_LABELS.get(key) || key),
        amountCents: Math.max(0, readMoneyCents(
          [item],
          ['amountCents', 'valueCents'],
          ['amount', 'value']
        ) ?? 0)
      };
    }).filter(item => item.amountCents > 0);
  }
  return asArray(value).map((item, index) => {
    const key = String(item.key || item.category || item.id || `category-${index}`);
    return {
      key,
      label: String(item.label || item.categoryLabel || CATEGORY_LABELS.get(key) || key),
      amountCents: Math.max(0, readMoneyCents([item], ['amountCents', 'valueCents'], ['amount', 'value']) ?? 0)
    };
  }).filter(item => item.amountCents > 0);
}

export function normalizeSnapshot(rawSnapshot = {}, childId = '') {
  const snapshot = rawSnapshot?.data && typeof rawSnapshot.data === 'object'
    ? rawSnapshot.data
    : rawSnapshot;
  const account = snapshot.account || snapshot.summary || {};
  const balances = snapshot.balances || account.balances || {};
  const objects = [balances, account, snapshot];
  const movements = mergeMovements(snapshot);
  const vaults = asArray(snapshot.vaults || snapshot.termPositions || snapshot.termDeposits).map(normalizeVault);
  const quotes = asArray(snapshot.quotes || snapshot.market?.quotes).map(normalizeQuote);
  const quotesById = new Map(quotes.flatMap(quote => (
    [quote.id, quote.symbol, quote.instrumentId]
      .filter(Boolean)
      .map(key => [String(key).toUpperCase(), quote])
  )));
  const instruments = asArray(snapshot.instruments || snapshot.market?.instruments).map((instrument, index) => {
    const key = String(instrument.id || instrument.symbol || '').toUpperCase();
    return normalizeQuote({ ...(quotesById.get(key) || {}), ...instrument }, index);
  });
  const instrumentKeys = new Set(instruments.flatMap(instrument => [instrument.id, instrument.symbol]));
  quotes.forEach(quote => {
    if (!instrumentKeys.has(quote.id) && !instrumentKeys.has(quote.symbol)) instruments.push(quote);
  });
  const instrumentById = new Map(instruments.flatMap(instrument => (
    [instrument.id, instrument.symbol]
      .filter(Boolean)
      .map(key => [String(key).toUpperCase(), instrument])
  )));
  const positions = asArray(snapshot.positions || snapshot.marketPositions || snapshot.portfolio)
    .map(normalizePosition)
    .map(position => {
      const instrument = instrumentById.get(String(position.instrumentId || position.symbol || '').toUpperCase());
      return {
        ...position,
        name: instrument?.name || position.name,
        instrumentType: instrument?.instrumentType || position.instrumentType
      };
    });

  const computedPending = movements
    .filter(movement => movement.status === 'pending')
    .reduce((total, movement) => total + movement.amountCents, 0);
  const computedVault = vaults
    .filter(vault => !['cancelled', 'withdrawn', 'withdrawn_early', 'matured'].includes(vault.status))
    .reduce((total, vault) => total + vault.principalCents, 0);
  const computedMarket = positions.reduce((total, position) => total + position.currentValueCents, 0);

  const balanceCents = readMoneyCents(
    objects,
    ['rawBalanceCents', 'balanceCents', 'confirmedBalanceCents'],
    ['rawBalance', 'balance', 'confirmedBalance']
  ) ?? readMoneyCents(
    objects,
    ['availableCents', 'availableBalanceCents', 'cashCents'],
    ['available', 'availableBalance', 'cash']
  ) ?? 0;
  const debtCents = Math.max(0, readMoneyCents(
    objects,
    ['debtCents', 'amountOwedCents'],
    ['debt', 'amountOwed']
  ) ?? -balanceCents);
  const pendingIncomingCents = Math.max(0, readMoneyCents(
    objects,
    ['pendingIncomingCents'],
    ['pendingIncoming']
  ) ?? 0);
  const pendingOutgoingCents = Math.max(0, readMoneyCents(
    objects,
    ['pendingOutgoingCents'],
    ['pendingOutgoing']
  ) ?? 0);
  const availableCents = Math.max(0, readMoneyCents(
    objects,
    ['availableCents', 'availableBalanceCents', 'cashCents'],
    ['available', 'availableBalance', 'cash']
  ) ?? balanceCents);
  const pendingCents = Math.max(0, readMoneyCents(
    objects,
    ['pendingCents', 'awaitingApprovalCents', 'reservedCents'],
    ['pending', 'awaitingApproval', 'reserved']
  ) ?? computedPending);
  const vaultCents = Math.max(0, readMoneyCents(
    objects,
    ['vaultCents', 'lockedCents', 'termCents'],
    ['vault', 'locked', 'term']
  ) ?? computedVault);
  const marketCents = Math.max(0, readMoneyCents(
    objects,
    ['marketCents', 'marketValueCents', 'investedMarketCents'],
    ['market', 'marketValue', 'investedMarket']
  ) ?? computedMarket);
  const goal = normalizeGoal(snapshot.goal || snapshot.savingsGoal);
  const goalReservedCents = Math.max(0, readMoneyCents(
    objects,
    ['goalReservedCents', 'reservedForGoalsCents'],
    ['goalReserved', 'reservedForGoals']
  ) ?? goal?.reservedCents ?? 0);
  const totalCents = readMoneyCents(
    objects,
    ['totalCents', 'netWorthCents'],
    ['total', 'netWorth']
  ) ?? (balanceCents + goalReservedCents + vaultCents + marketCents);

  const breakdown = snapshot.breakdown || snapshot.charts || {};
  const incomeByCategory = normalizeCategoryBreakdown(
    breakdown.incomeByCategory || breakdown.income || snapshot.incomeByCategory
  );
  const expenseByCategory = normalizeCategoryBreakdown(
    breakdown.expenseByCategory || breakdown.expenses || snapshot.expenseByCategory
  );

  if (goal) {
    goal.reservedCents = goalReservedCents;
    goal.savedCents = goalReservedCents;
  }

  const projectedBalanceCents = readMoneyCents(
    objects,
    ['projectedBalanceCents'],
    ['projectedBalance']
  ) ?? (balanceCents + pendingIncomingCents - pendingOutgoingCents);

  return {
    childId: String(snapshot.childId || account.childId || childId),
    account: {
      balanceCents,
      rawBalanceCents: balanceCents,
      debtCents,
      availableCents,
      pendingCents,
      pendingIncomingCents,
      pendingOutgoingCents,
      projectedBalanceCents,
      projectedAvailableCents: Math.max(0, readMoneyCents(
        objects,
        ['projectedAvailableCents'],
        ['projectedAvailable']
      ) ?? projectedBalanceCents),
      projectedDebtCents: Math.max(0, readMoneyCents(
        objects,
        ['projectedDebtCents'],
        ['projectedDebt']
      ) ?? -projectedBalanceCents),
      goalReservedCents,
      vaultCents,
      marketCents,
      totalCents
    },
    movements,
    vaults,
    positions,
    quotes,
    quoteHistory: asArray(snapshot.quoteHistory || snapshot.market?.history).map(normalizeQuote),
    quoteUpdatedAtMs: dateToMs(
      snapshot.quoteUpdatedAt || snapshot.quotesUpdatedAt || snapshot.market?.cachedAt
    ) || Math.max(0, ...quotes.map(quote => quote.cachedAtMs || quote.marketAsOfMs || 0)),
    quotesStale: Boolean(snapshot.quotesStale || snapshot.market?.stale || quotes.some(quote => quote.stale)),
    goal,
    vaultOffers: asArray(snapshot.vaultOffers || snapshot.termOffers || snapshot.products),
    instruments,
    breakdown: { incomeByCategory, expenseByCategory },
    monthlySummary: snapshot.monthlySummary || null,
    updatedAtMs: dateToMs(snapshot.updatedAt || account.updatedAt)
  };
}

export function getVisibleMovements(movements = [], nowMs = Date.now()) {
  return movements.filter(movement => {
    if (normalizeStatus(movement.status) !== 'rejected') return true;
    if (movement.visibleToChildUntilMs) return movement.visibleToChildUntilMs > nowMs;
    const rejectedAtMs = movement.rejectedAtMs ?? movement.decidedAtMs ?? dateToMs(movement.rejectedAt);
    if (!rejectedAtMs) return true;
    return nowMs - rejectedAtMs <= REJECTED_VISIBLE_FOR_MS;
  }).sort((a, b) => (
    (b.occurredAtMs || b.createdAtMs || 0) - (a.occurredAtMs || a.createdAtMs || 0)
  ));
}

function kindGroup(kind) {
  const normalized = normalizeKind(kind);
  if (normalized === 'income') return 'income';
  if (normalized === 'expense') return 'expense';
  return normalized;
}

export function aggregateCategories(movements = [], group) {
  const totals = new Map();
  movements.forEach(movement => {
    if (normalizeStatus(movement.status) !== 'approved') return;
    if (kindGroup(movement.kind) !== group) return;
    const key = String(movement.category || movement.kind || 'other');
    const current = totals.get(key) || {
      key,
      label: movement.categoryLabel || CATEGORY_LABELS.get(key) || 'Outro',
      amountCents: 0
    };
    current.amountCents += Math.abs(Math.round(Number(movement.amountCents) || 0));
    totals.set(key, current);
  });
  return [...totals.values()].sort((a, b) => b.amountCents - a.amountCents);
}

export function eurosToCents(value) {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/\s/g, '').replace(',', '.')
    : value;
  const euros = finiteNumber(normalized);
  return euros == null ? null : Math.round(euros * 100);
}

export function formatEuro(cents = 0) {
  return euroFormatter.format((finiteNumber(cents) || 0) / 100);
}

export function formatFinanceDate(value) {
  const time = typeof value === 'number' ? value : dateToMs(value);
  return time ? dateFormatter.format(new Date(time)) : 'Data por confirmar';
}

export function formatFinanceDateTime(value) {
  const time = typeof value === 'number' ? value : dateToMs(value);
  return time ? dateTimeFormatter.format(new Date(time)) : 'hora por confirmar';
}

function apiErrorMessage(response, data) {
  if (data?.error && typeof data.error === 'string') return data.error;
  if (data?.message && typeof data.message === 'string') return data.message;
  if (response.status === 401) return 'Inicia sessão para consultar esta área.';
  if (response.status === 403) return 'Esta conta não tem acesso às finanças desta criança.';
  if (response.status === 409) return 'Os dados mudaram entretanto. Atualiza a página e tenta novamente.';
  return `Não foi possível concluir o pedido (${response.status}).`;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  }
  if (!response.ok) throw new Error(apiErrorMessage(response, data));
  if (!contentType.includes('application/json')) {
    throw new Error('O servidor devolveu uma resposta inesperada. Atualiza a página e tenta novamente.');
  }
  return data;
}

function bearerHeaders(token, hasBody = false) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
}

export async function loadFamilyFinanceSnapshot({ childId, token, signal } = {}) {
  if (!childId) throw new Error('Falta identificar a criança.');
  const params = new URLSearchParams({ childId });
  const response = await fetch(`${FAMILY_FINANCE_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers: bearerHeaders(token),
    signal,
    cache: 'no-store'
  });
  return normalizeSnapshot(await parseResponse(response), childId);
}

export async function postFamilyFinanceAction({ childId, token, action, payload = {}, signal } = {}) {
  if (!childId) throw new Error('Falta identificar a criança.');
  if (!action) throw new Error('Falta indicar a ação.');
  const response = await fetch(FAMILY_FINANCE_ENDPOINT, {
    method: 'POST',
    headers: bearerHeaders(token, true),
    signal,
    body: JSON.stringify({ action, childId, ...payload })
  });
  return parseResponse(response);
}

export const FAMILY_FINANCE_API = Object.freeze({
  endpoint: FAMILY_FINANCE_ENDPOINT,
  loadSnapshot: loadFamilyFinanceSnapshot,
  postAction: postFamilyFinanceAction
});
