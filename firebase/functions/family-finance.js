const crypto = require("crypto");

const REGION = "europe-west1";
const TIME_ZONE = "Europe/Lisbon";
const CURRENCY = "EUR";
const MICROS_PER_UNIT = 1_000_000;
const REJECTED_VISIBILITY_MS = 24 * 60 * 60 * 1000;
const MAX_AMOUNT_CENTS = 100_000_000;

const FILIPA_UID = "SsNolBpIOxQK1upboCXIUwWlsuV2";
const CHILDREN = Object.freeze({
  francisca: Object.freeze({
    id: "francisca",
    name: "Francisca",
    uid: "Fg8GKPt6fNb1vXIZf3Eg0xsHQID3",
  }),
  leonor: Object.freeze({
    id: "leonor",
    name: "Leonor",
    uid: "9d2FHATsREVrX2t5gJDBviNWibv1",
  }),
});

const CHILD_BY_UID = new Map(Object.values(CHILDREN).map((child) => [child.uid, child]));

const ACCOUNT_COLLECTION = "family_finance_accounts";
const QUOTES_COLLECTION = "family_finance_quotes";
const QUOTE_HISTORY_COLLECTION = "family_finance_quote_history";
const META_COLLECTION = "family_finance_meta";
const AUDIT_COLLECTION = "family_finance_audit";

const REQUEST_KINDS = new Set([
  "income",
  "expense",
  "cash_withdrawal",
  "cash_return",
  "vault_open",
  "vault_early_withdraw",
  "market_buy",
  "market_sell",
]);

const INCOME_CATEGORIES = new Set([
  "gift",
  "allowance",
  "task",
  "sale",
  "reward",
  "other",
  "adjustment",
  "investment_interest",
]);
const EXPENSE_CATEGORIES = new Set([
  "toys",
  "school",
  "food",
  "books",
  "leisure",
  "gifts",
  "technology",
  "other",
  "adjustment",
]);

const VAULT_PRODUCTS = Object.freeze([
  Object.freeze({ id: "vault_1", days: 1, annualRateBps: 100, label: "1 dia", educational: true }),
  Object.freeze({ id: "vault_7", days: 7, annualRateBps: 200, label: "7 dias", educational: true }),
  Object.freeze({ id: "vault_30", days: 30, annualRateBps: 300, label: "30 dias", educational: true }),
  Object.freeze({ id: "vault_90", days: 90, annualRateBps: 400, label: "90 dias", educational: true }),
  Object.freeze({ id: "vault_365", days: 365, annualRateBps: 500, label: "1 ano", educational: true }),
]);
const VAULT_PRODUCT_BY_DAYS = new Map(VAULT_PRODUCTS.map((product) => [product.days, product]));

const MARKET_INSTRUMENTS = Object.freeze([
  Object.freeze({
    id: "VWCE",
    symbol: "VWCE",
    apiSymbols: ["VWCE.DE"],
    name: "Vanguard FTSE All-World UCITS ETF",
    type: "etf",
    exchange: "XETRA",
    isin: "IE00BK5BQT80",
    nativeCurrency: "EUR",
    riskLevel: 3,
  }),
  Object.freeze({
    id: "AGGH",
    symbol: "AGGH",
    apiSymbols: ["EUNA.DE", "AGGH.DE"],
    name: "iShares Core Global Aggregate Bond UCITS ETF",
    type: "etf",
    exchange: "XETRA",
    isin: "IE00BDBRDM35",
    nativeCurrency: "EUR",
    riskLevel: 2,
  }),
  Object.freeze({
    id: "AAPL",
    symbol: "AAPL",
    apiSymbols: ["AAPL"],
    name: "Apple",
    type: "stock",
    exchange: "NASDAQ",
    isin: "US0378331005",
    nativeCurrency: "USD",
    riskLevel: 4,
  }),
  Object.freeze({
    id: "MSFT",
    symbol: "MSFT",
    apiSymbols: ["MSFT"],
    name: "Microsoft",
    type: "stock",
    exchange: "NASDAQ",
    isin: "US5949181045",
    nativeCurrency: "USD",
    riskLevel: 4,
  }),
  Object.freeze({
    id: "KO",
    symbol: "KO",
    apiSymbols: ["KO"],
    name: "Coca-Cola",
    type: "stock",
    exchange: "NYSE",
    isin: "US1912161007",
    nativeCurrency: "USD",
    riskLevel: 4,
  }),
]);
const INSTRUMENT_BY_ID = new Map(MARKET_INSTRUMENTS.map((instrument) => [instrument.id, instrument]));
const INSTRUMENT_ALIASES = new Map([
  ["VWCE.DE", "VWCE"],
  ["EUNA.DE", "AGGH"],
  ["AGGH.DE", "AGGH"],
]);

class FamilyFinanceError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = "FamilyFinanceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function resolveFamilyActor(uid) {
  const normalizedUid = String(uid || "").trim();
  if (!normalizedUid) return { uid: "", role: "none", childId: null, isFilipa: false };
  const child = CHILD_BY_UID.get(normalizedUid);
  if (child) {
    return { uid: normalizedUid, role: "child", childId: child.id, isFilipa: false };
  }
  return {
    uid: normalizedUid,
    role: "parent",
    childId: null,
    isFilipa: normalizedUid === FILIPA_UID,
  };
}

function normalizeChildId(value) {
  const childId = String(value || "").trim().toLowerCase();
  if (!CHILDREN[childId]) {
    throw new FamilyFinanceError("invalid-child", "Conta infantil inválida.");
  }
  return childId;
}

function assertChildAccess(actor, childId) {
  if (!actor || actor.role === "none") {
    throw new FamilyFinanceError("unauthenticated", "Autenticação necessária.", 401);
  }
  if (actor.role === "child" && actor.childId !== childId) {
    throw new FamilyFinanceError("forbidden", "Não tem acesso a esta conta.", 403);
  }
}

function assertParent(actor) {
  if (!actor || actor.role !== "parent") {
    throw new FamilyFinanceError("parent-required", "Esta ação precisa da validação de um dos pais.", 403);
  }
}

function asDate(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function nowDate(value) {
  return asDate(value, new Date());
}

function dateKeyInLisbon(value = new Date()) {
  const date = nowDate(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function addDays(value, days) {
  return new Date(nowDate(value).getTime() + Number(days) * 24 * 60 * 60 * 1000);
}

function normalizeAmountCents(value, field = "amountCents") {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_CENTS) {
    throw new FamilyFinanceError(
      "invalid-amount",
      `${field} deve ser um número inteiro positivo em cêntimos.`,
    );
  }
  return amount;
}

function normalizeOptionalText(value, maxLength = 240) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.slice(0, maxLength);
}

function normalizeOccurredOn(value, now = new Date()) {
  if (value == null || value === "") return dateKeyInLisbon(now);
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new FamilyFinanceError("invalid-date", "A data do movimento é inválida.");
  }
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new FamilyFinanceError("invalid-date", "A data do movimento é inválida.");
  }
  return text;
}

function normalizeRequestKind(value) {
  const aliases = {
    receive: "income",
    receber: "income",
    spend: "expense",
    gastar: "expense",
    take_cash: "cash_withdrawal",
    withdraw_cash: "cash_withdrawal",
    return_cash: "cash_return",
    term_open: "vault_open",
    investment_term: "vault_open",
    buy: "market_buy",
    sell: "market_sell",
  };
  const raw = String(value || "").trim().toLowerCase();
  const kind = aliases[raw] || raw;
  if (!REQUEST_KINDS.has(kind) || kind === "vault_early_withdraw") {
    throw new FamilyFinanceError("invalid-kind", "Tipo de pedido inválido.");
  }
  return kind;
}

function normalizeCashLocation(value, fallback = "parents") {
  const aliases = {
    parent: "parents",
    parents: "parents",
    cofre: "parents",
    child: "child",
    comigo: "child",
    wallet: "child",
  };
  const raw = String(value || fallback).trim().toLowerCase();
  const location = aliases[raw] || raw;
  if (!["parents", "child"].includes(location)) {
    throw new FamilyFinanceError("invalid-cash-location", "A origem do dinheiro é inválida.");
  }
  return location;
}

function accountCashBreakdown(account = {}) {
  const balanceCents = Number.isSafeInteger(account.balanceCents) ? account.balanceCents : 0;
  const childCashCents = Number.isSafeInteger(account.childCashCents)
    ? Math.max(0, account.childCashCents)
    : 0;
  const parentCustodyNetCents = balanceCents - childCashCents;
  const parentHeldCents = Math.max(0, parentCustodyNetCents);
  const debtCents = Math.max(0, -parentCustodyNetCents);
  return {
    balanceCents,
    childCashCents,
    parentCustodyNetCents,
    parentHeldCents,
    debtCents,
    availableCents: parentHeldCents + childCashCents,
  };
}

function normalizeCategory(kind, value) {
  const rawCategory = String(value || "other").trim().toLowerCase();
  const category = rawCategory === "school_supplies" ? "school" : rawCategory;
  if (kind === "income" && !INCOME_CATEGORIES.has(category)) {
    throw new FamilyFinanceError("invalid-category", "Categoria de entrada inválida.");
  }
  if (kind === "expense" && !EXPENSE_CATEGORIES.has(category)) {
    throw new FamilyFinanceError("invalid-category", "Categoria de saída inválida.");
  }
  if (["vault_open", "vault_early_withdraw"].includes(kind)) return "vault";
  if (["market_buy", "market_sell"].includes(kind)) return "market";
  if (["cash_withdrawal", "cash_return"].includes(kind)) return "cash_transfer";
  return category;
}

function normalizeInstrumentId(value) {
  const raw = String(value || "").trim().toUpperCase();
  const instrumentId = INSTRUMENT_ALIASES.get(raw) || raw;
  if (!INSTRUMENT_BY_ID.has(instrumentId)) {
    throw new FamilyFinanceError("invalid-instrument", "Este investimento não está disponível.");
  }
  return instrumentId;
}

function normalizeTermDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || !VAULT_PRODUCT_BY_DAYS.has(days)) {
    throw new FamilyFinanceError("invalid-term", "Prazo do cofre inválido.");
  }
  return days;
}

function calculateVaultInterestCents(principalCents, annualRateBps, days) {
  const principal = normalizeAmountCents(principalCents, "principalCents");
  const rate = Number(annualRateBps);
  const duration = Number(days);
  if (!Number.isInteger(rate) || rate < 0 || !Number.isInteger(duration) || duration <= 0) {
    throw new FamilyFinanceError("invalid-interest", "Parâmetros de juro inválidos.");
  }
  return Math.round((principal * rate * duration) / (10_000 * 365));
}

function calculateMarketBuy(amountCents, priceCents) {
  const amount = normalizeAmountCents(amountCents);
  const price = normalizeAmountCents(priceCents, "priceCents");
  const quantityMicros = Math.floor((amount * MICROS_PER_UNIT) / price);
  if (quantityMicros <= 0) {
    throw new FamilyFinanceError("amount-too-small", "O valor é demasiado pequeno para esta compra.");
  }
  return { quantityMicros, executedAmountCents: amount };
}

function calculateMarketSell({ amountCents, quantityMicros, priceCents, heldQuantityMicros }) {
  const price = normalizeAmountCents(priceCents, "priceCents");
  const held = Number(heldQuantityMicros);
  if (!Number.isSafeInteger(held) || held <= 0) {
    throw new FamilyFinanceError("empty-position", "Não existem unidades disponíveis para vender.", 409);
  }

  let quantity = Number(quantityMicros);
  if (Number.isSafeInteger(quantity) && quantity > 0) {
    // Explicit quantity is accepted for API clients that can represent fractions.
  } else {
    const amount = normalizeAmountCents(amountCents);
    const fullValueCents = Math.round((held * price) / MICROS_PER_UNIT);
    quantity = amount >= fullValueCents
      ? held
      : Math.floor((amount * MICROS_PER_UNIT) / price);
  }

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new FamilyFinanceError("amount-too-small", "O valor é demasiado pequeno para esta venda.");
  }
  if (quantity > held) {
    throw new FamilyFinanceError("insufficient-position", "Não pode vender mais unidades do que possui.", 409);
  }
  const proceedsCents = Math.round((quantity * price) / MICROS_PER_UNIT);
  return { quantityMicros: quantity, proceedsCents };
}

function normalizeRequestPayload(payload, now = new Date()) {
  const input = payload && typeof payload === "object" ? payload : {};
  const kind = normalizeRequestKind(input.kind || input.type);
  const amountCents = normalizeAmountCents(input.amountCents);
  const normalized = {
    kind,
    amountCents,
    category: normalizeCategory(kind, input.category),
    note: normalizeOptionalText(input.note || input.description),
    occurredOn: normalizeOccurredOn(input.occurredOn || input.date, now),
  };
  if (kind === "expense" && ["need", "want"].includes(String(input.reflection || ""))) {
    normalized.reflection = String(input.reflection);
  }
  if (["income", "expense"].includes(kind)) {
    normalized.cashLocation = normalizeCashLocation(input.cashLocation || input.paymentSource);
  }

  if (kind === "vault_open") {
    normalized.termDays = normalizeTermDays(input.termDays || input.days);
    normalized.productId = VAULT_PRODUCT_BY_DAYS.get(normalized.termDays).id;
  }
  if (kind === "market_buy" || kind === "market_sell") {
    normalized.instrumentId = normalizeInstrumentId(input.symbol || input.instrumentId);
    if (kind === "market_sell" && input.quantityMicros != null) {
      const quantity = Number(input.quantityMicros);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new FamilyFinanceError("invalid-quantity", "Quantidade inválida.");
      }
      normalized.quantityMicros = quantity;
    }
  }
  return normalized;
}

function requestPayloadHash(payload) {
  const ordered = Object.keys(payload).sort().reduce((result, key) => {
    result[key] = payload[key];
    return result;
  }, {});
  return crypto.createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (key.length > 120) {
    throw new FamilyFinanceError("invalid-idempotency-key", "Chave de repetição inválida.");
  }
  return key;
}

function defaultAccount(childId, now = new Date()) {
  const child = CHILDREN[childId];
  return {
    childId,
    displayName: child.name,
    ownerUid: child.uid,
    currency: CURRENCY,
    balanceCents: 0,
    childCashCents: 0,
    ledgerSequence: 0,
    createdAt: nowDate(now),
    updatedAt: nowDate(now),
  };
}

function normalizeAccountData(childId, data, now = new Date()) {
  const base = defaultAccount(childId, now);
  const source = data || {};
  return {
    ...base,
    ...source,
    childId,
    displayName: CHILDREN[childId].name,
    ownerUid: CHILDREN[childId].uid,
    currency: CURRENCY,
    balanceCents: Number.isSafeInteger(source.balanceCents) ? source.balanceCents : 0,
    childCashCents: Number.isSafeInteger(source.childCashCents) ? Math.max(0, source.childCashCents) : 0,
    ledgerSequence: Number.isSafeInteger(source.ledgerSequence) ? source.ledgerSequence : 0,
  };
}

function accountRef(firestore, childId) {
  return firestore.collection(ACCOUNT_COLLECTION).doc(childId);
}

function childCollection(firestore, childId, name) {
  return accountRef(firestore, childId).collection(name);
}

function quoteRef(firestore, instrumentId) {
  return firestore.collection(QUOTES_COLLECTION).doc(instrumentId);
}

function auditRef(firestore, eventId) {
  return firestore.collection(AUDIT_COLLECTION).doc(eventId);
}

function docExists(snapshot) {
  return Boolean(snapshot && snapshot.exists);
}

function quoteSnapshot(data) {
  if (!data || !Number.isSafeInteger(data.priceCents) || data.priceCents <= 0) {
    throw new FamilyFinanceError("quote-unavailable", "Ainda não existe uma cotação disponível.", 503);
  }
  return {
    instrumentId: data.instrumentId,
    symbol: data.symbol,
    priceCents: data.priceCents,
    currency: CURRENCY,
    nativePrice: Number(data.nativePrice) || null,
    nativeCurrency: data.nativeCurrency || CURRENCY,
    fxUsdPerEur: Number(data.fxUsdPerEur) || null,
    fxAsOf: data.fxAsOf || null,
    marketAsOf: data.marketAsOf || null,
    fetchedAt: data.fetchedAt || null,
    source: data.source || "Alpha Vantage (último fecho)",
    educational: true,
    delayed: true,
  };
}

function transactionSetAccount(transaction, ref, current, patch, now) {
  transaction.set(ref, {
    childId: current.childId,
    displayName: current.displayName,
    ownerUid: current.ownerUid,
    currency: CURRENCY,
    createdAt: current.createdAt || now,
    ...patch,
    updatedAt: now,
  }, { merge: true });
}

function auditEvent({ childId, requestId = null, event, actor, now, details = null }) {
  return {
    childId,
    requestId,
    event,
    actorUid: actor?.uid || "system",
    actorRole: actor?.role || "system",
    isFilipa: Boolean(actor?.isFilipa),
    occurredAt: now,
    details,
  };
}

function buildApprovedMutation({ request, account, quote = null, position = null, vault = null, now, actor }) {
  const sequence = account.ledgerSequence + 1;
  const cashBefore = accountCashBreakdown(account);
  let deltaCents = 0;
  let childCashDeltaCents = 0;
  let executedAmountCents = request.amountCents;
  let ledgerType = request.kind;
  let positionPatch = null;
  let vaultPatch = null;
  let executionQuote = null;
  let quantityMicros = null;
  let realizedPnlCents = null;
  let costBasisRemovedCents = null;

  if (request.kind === "income") {
    deltaCents = request.amountCents;
    if (request.cashLocation === "child") {
      childCashDeltaCents = Math.max(0, request.amountCents - Math.min(cashBefore.debtCents, request.amountCents));
    }
  } else if (request.kind === "expense") {
    deltaCents = -request.amountCents;
    if (request.cashLocation === "child") {
      if (cashBefore.childCashCents < request.amountCents) {
        throw new FamilyFinanceError(
          "insufficient-child-cash",
          "O dinheiro que está com ela não chega para esta compra.",
          409,
          { childCashCents: cashBefore.childCashCents, requiredCents: request.amountCents },
        );
      }
      childCashDeltaCents = -request.amountCents;
    }
  } else if (request.kind === "cash_withdrawal") {
    if (cashBefore.parentHeldCents < request.amountCents) {
      throw new FamilyFinanceError(
        "insufficient-parent-cash",
        "O dinheiro guardado com os pais não chega para este levantamento.",
        409,
        { parentHeldCents: cashBefore.parentHeldCents, requiredCents: request.amountCents },
      );
    }
    childCashDeltaCents = request.amountCents;
  } else if (request.kind === "cash_return") {
    if (cashBefore.childCashCents < request.amountCents) {
      throw new FamilyFinanceError(
        "insufficient-child-cash",
        "Ela não tem esse valor consigo para devolver aos pais.",
        409,
        { childCashCents: cashBefore.childCashCents, requiredCents: request.amountCents },
      );
    }
    childCashDeltaCents = -request.amountCents;
  } else if (request.kind === "vault_open") {
    deltaCents = -request.amountCents;
    const product = VAULT_PRODUCT_BY_DAYS.get(request.termDays);
    if (!product) throw new FamilyFinanceError("invalid-term", "Prazo do cofre inválido.");
    const expectedInterestCents = calculateVaultInterestCents(
      request.amountCents,
      product.annualRateBps,
      product.days,
    );
    const vaultId = `vault_${request.id}`;
    vaultPatch = {
      id: vaultId,
      childId: request.childId,
      requestId: request.id,
      productId: product.id,
      productLabel: product.label,
      principalCents: request.amountCents,
      annualRateBps: product.annualRateBps,
      termDays: product.days,
      expectedInterestCents,
      status: "active",
      startedAt: now,
      maturesAt: addDays(now, product.days),
      pendingWithdrawalRequestId: null,
      interestPaidCents: 0,
      createdAt: now,
      updatedAt: now,
      educational: true,
    };
  } else if (request.kind === "vault_early_withdraw") {
    if (!vault || vault.status !== "active") {
      throw new FamilyFinanceError("vault-not-active", "Este cofre já não está ativo.", 409);
    }
    if (vault.pendingWithdrawalRequestId && vault.pendingWithdrawalRequestId !== request.id) {
      throw new FamilyFinanceError("withdrawal-already-pending", "Já existe um pedido de levantamento.", 409);
    }
    deltaCents = Number(vault.principalCents) || 0;
    executedAmountCents = deltaCents;
    ledgerType = "vault_early_withdrawal";
    vaultPatch = {
      ...vault,
      status: "withdrawn_early",
      interestPaidCents: 0,
      withdrawnAt: now,
      withdrawnByUid: actor.uid,
      pendingWithdrawalRequestId: null,
      updatedAt: now,
    };
  } else if (request.kind === "market_buy") {
    executionQuote = quoteSnapshot(quote);
    const purchase = calculateMarketBuy(request.amountCents, executionQuote.priceCents);
    quantityMicros = purchase.quantityMicros;
    executedAmountCents = purchase.executedAmountCents;
    deltaCents = -executedAmountCents;
    const currentQuantity = Number(position?.quantityMicros) || 0;
    const currentCost = Number(position?.costBasisCents) || 0;
    positionPatch = {
      childId: request.childId,
      instrumentId: request.instrumentId,
      symbol: request.instrumentId,
      quantityMicros: currentQuantity + quantityMicros,
      costBasisCents: currentCost + executedAmountCents,
      realizedPnlCents: Number(position?.realizedPnlCents) || 0,
      createdAt: position?.createdAt || now,
      updatedAt: now,
    };
  } else if (request.kind === "market_sell") {
    executionQuote = quoteSnapshot(quote);
    const currentQuantity = Number(position?.quantityMicros) || 0;
    const currentCost = Number(position?.costBasisCents) || 0;
    const sale = calculateMarketSell({
      amountCents: request.amountCents,
      quantityMicros: request.quantityMicros,
      priceCents: executionQuote.priceCents,
      heldQuantityMicros: currentQuantity,
    });
    quantityMicros = sale.quantityMicros;
    executedAmountCents = sale.proceedsCents;
    deltaCents = executedAmountCents;
    const removedCostCents = quantityMicros === currentQuantity
      ? currentCost
      : Math.round((currentCost * quantityMicros) / currentQuantity);
    costBasisRemovedCents = removedCostCents;
    realizedPnlCents = executedAmountCents - removedCostCents;
    positionPatch = {
      childId: request.childId,
      instrumentId: request.instrumentId,
      symbol: request.instrumentId,
      quantityMicros: currentQuantity - quantityMicros,
      costBasisCents: Math.max(0, currentCost - removedCostCents),
      realizedPnlCents: (Number(position?.realizedPnlCents) || 0) + realizedPnlCents,
      createdAt: position?.createdAt || now,
      updatedAt: now,
    };
  } else {
    throw new FamilyFinanceError("invalid-kind", "Tipo de pedido inválido.");
  }

  if (["vault_open", "market_buy"].includes(request.kind) && cashBefore.parentHeldCents < Math.abs(deltaCents)) {
    throw new FamilyFinanceError(
      "insufficient-balance",
      "O dinheiro guardado com os pais não chega para fazer este investimento.",
      409,
      { parentHeldCents: cashBefore.parentHeldCents, requiredCents: Math.abs(deltaCents) },
    );
  }

  const nextBalanceCents = account.balanceCents + deltaCents;
  const nextChildCashCents = cashBefore.childCashCents + childCashDeltaCents;
  if (nextChildCashCents < 0) {
    throw new FamilyFinanceError("invalid-child-cash", "O dinheiro físico não pode ficar negativo.", 409);
  }
  const cashAfter = accountCashBreakdown({
    balanceCents: nextBalanceCents,
    childCashCents: nextChildCashCents,
  });
  const debtBeforeCents = cashBefore.debtCents;
  const debtPaidCents = deltaCents > 0 ? Math.min(debtBeforeCents, deltaCents) : 0;
  const availableAddedCents = deltaCents > 0 ? Math.max(0, deltaCents - debtPaidCents) : 0;

  const ledger = {
    id: request.id,
    requestId: request.id,
    childId: request.childId,
    sequence,
    kind: ledgerType,
    category: request.category,
    note: request.note || "",
    reflection: request.reflection || null,
    occurredOn: request.occurredOn,
    amountCents: executedAmountCents,
    deltaCents,
    cashLocation: request.cashLocation || null,
    childCashDeltaCents,
    childCashAfterCents: cashAfter.childCashCents,
    parentHeldAfterCents: cashAfter.parentHeldCents,
    debtAfterCents: cashAfter.debtCents,
    balanceAfterCents: nextBalanceCents,
    debtPaidCents,
    availableAddedCents,
    createdByUid: request.createdByUid,
    approvedByUid: actor.uid,
    approvedAt: now,
    createdAt: now,
  };
  if (request.kind.startsWith("market_")) {
    Object.assign(ledger, {
      instrumentId: request.instrumentId,
      quantityMicros,
      quote: executionQuote,
      realizedPnlCents,
      costBasisRemovedCents,
    });
  }
  if (request.kind.startsWith("vault_")) {
    ledger.vaultId = request.kind === "vault_open" ? `vault_${request.id}` : request.vaultId;
    ledger.termDays = request.termDays || vault?.termDays || null;
    ledger.productId = request.productId || vault?.productId || null;
    if (request.kind === "vault_early_withdraw") ledger.interestPaidCents = 0;
  }

  return {
    accountPatch: {
      balanceCents: nextBalanceCents,
      childCashCents: nextChildCashCents,
      ledgerSequence: sequence,
    },
    requestPatch: {
      status: "approved",
      decidedByUid: actor.uid,
      decidedByRole: actor.role,
      decidedAt: now,
      approvedAt: now,
      updatedAt: now,
      visibleToChildUntil: null,
      executedAmountCents,
      executionQuote,
      quantityMicros,
      cashLocation: request.cashLocation || null,
      childCashDeltaCents,
      childCashAfterCents: cashAfter.childCashCents,
      parentHeldAfterCents: cashAfter.parentHeldCents,
    },
    ledger,
    positionPatch,
    vaultPatch,
  };
}

function applyApprovedMutation({
  transaction,
  firestore,
  childId,
  requestRef,
  request,
  account,
  mutation,
  actor,
  now,
}) {
  const accountDocument = accountRef(firestore, childId);
  transactionSetAccount(transaction, accountDocument, account, mutation.accountPatch, now);
  transaction.set(childCollection(firestore, childId, "ledger").doc(request.id), mutation.ledger);
  transaction.set(requestRef, mutation.requestPatch, { merge: true });

  if (mutation.positionPatch) {
    transaction.set(
      childCollection(firestore, childId, "positions").doc(request.instrumentId),
      mutation.positionPatch,
      { merge: true },
    );
  }
  if (mutation.vaultPatch) {
    const vaultId = mutation.vaultPatch.id || request.vaultId;
    transaction.set(
      childCollection(firestore, childId, "vaults").doc(vaultId),
      mutation.vaultPatch,
      { merge: true },
    );
  }
  transaction.set(
    auditRef(firestore, `request_${request.id}_approved`),
    auditEvent({
      childId,
      requestId: request.id,
      event: "request.approved",
      actor,
      now,
      details: {
        kind: request.kind,
        deltaCents: mutation.ledger.deltaCents,
        balanceAfterCents: mutation.ledger.balanceAfterCents,
        childCashAfterCents: mutation.ledger.childCashAfterCents,
        parentHeldAfterCents: mutation.ledger.parentHeldAfterCents,
      },
    }),
  );
}

function refsForRequest(firestore, childId, request) {
  const refs = {
    account: accountRef(firestore, childId),
    quote: null,
    position: null,
    vault: null,
  };
  if (request.kind === "market_buy" || request.kind === "market_sell") {
    refs.quote = quoteRef(firestore, request.instrumentId);
    refs.position = childCollection(firestore, childId, "positions").doc(request.instrumentId);
  }
  if (request.kind === "vault_early_withdraw") {
    refs.vault = childCollection(firestore, childId, "vaults").doc(request.vaultId);
  }
  return refs;
}

async function readApprovalState(transaction, refs) {
  const entries = Object.entries(refs).filter(([, ref]) => Boolean(ref));
  const snapshots = await Promise.all(entries.map(([, ref]) => transaction.get(ref)));
  return Object.fromEntries(entries.map(([key], index) => [key, snapshots[index]]));
}

function requestDocId(collectionRef, actor, childId, idempotencyKey) {
  if (!idempotencyKey) return collectionRef.doc();
  const digest = crypto
    .createHash("sha256")
    .update(`${actor.uid}|${childId}|${idempotencyKey}`)
    .digest("hex")
    .slice(0, 40);
  return collectionRef.doc(`idem_${digest}`);
}

async function createFinanceRequest({ firestore, actor, childId, payload, idempotencyKey = "", now = new Date() }) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const createdAt = nowDate(now);
  const normalized = normalizeRequestPayload(payload, createdAt);
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const requests = childCollection(firestore, targetChildId, "requests");
  const requestReference = requestDocId(requests, actor, targetChildId, normalizedKey);
  const payloadHash = requestPayloadHash(normalized);
  const request = {
    id: requestReference.id,
    childId: targetChildId,
    ...normalized,
    status: actor.role === "parent" ? "approved" : "pending",
    createdByUid: actor.uid,
    createdByRole: actor.role,
    createdAt,
    updatedAt: createdAt,
    payloadHash,
    idempotencyKey: normalizedKey || null,
    visibleToChildUntil: null,
  };
  const refs = refsForRequest(firestore, targetChildId, request);

  return firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(requestReference);
    const state = await readApprovalState(transaction, refs);
    if (docExists(existing)) {
      const existingData = { id: existing.id, ...existing.data() };
      if (existingData.payloadHash && existingData.payloadHash !== payloadHash) {
        throw new FamilyFinanceError(
          "idempotency-conflict",
          "Esta chave já foi usada para outro pedido.",
          409,
        );
      }
      return { request: existingData, idempotent: true };
    }

    const account = normalizeAccountData(
      targetChildId,
      docExists(state.account) ? state.account.data() : null,
      createdAt,
    );
    if (state.quote) request.quoteAtRequest = quoteSnapshot(state.quote.data());

    transaction.set(requestReference, request);
    transaction.set(
      auditRef(firestore, `request_${request.id}_created`),
      auditEvent({
        childId: targetChildId,
        requestId: request.id,
        event: "request.created",
        actor,
        now: createdAt,
        details: { kind: request.kind, amountCents: request.amountCents },
      }),
    );

    if (actor.role === "parent") {
      const mutation = buildApprovedMutation({
        request,
        account,
        quote: state.quote?.data?.() || null,
        position: state.position?.data?.() || null,
        vault: state.vault?.data?.() || null,
        now: createdAt,
        actor,
      });
      applyApprovedMutation({
        transaction,
        firestore,
        childId: targetChildId,
        requestRef: requestReference,
        request,
        account,
        mutation,
        actor,
        now: createdAt,
      });
      return { request: { ...request, ...mutation.requestPatch }, ledger: mutation.ledger, idempotent: false };
    }

    if (!docExists(state.account)) {
      transactionSetAccount(transaction, refs.account, account, {
        balanceCents: account.balanceCents,
        childCashCents: account.childCashCents,
        ledgerSequence: account.ledgerSequence,
      }, createdAt);
    }
    return { request, idempotent: false };
  });
}

function normalizeStoredRequest(childId, id, data, now = new Date()) {
  const source = data || {};
  const rawKind = String(source.kind || source.type || "").trim().toLowerCase();
  if (rawKind === "vault_early_withdraw") {
    const amountCents = normalizeAmountCents(source.amountCents);
    const vaultId = String(source.vaultId || "").trim();
    if (!vaultId) throw new FamilyFinanceError("invalid-vault", "Cofre inválido.");
    return {
      ...source,
      id,
      childId,
      kind: rawKind,
      amountCents,
      category: "vault",
      note: normalizeOptionalText(source.note),
      occurredOn: normalizeOccurredOn(source.occurredOn, now),
      vaultId,
    };
  }
  const normalized = normalizeRequestPayload(source, now);
  return { ...source, ...normalized, id, childId };
}

function normalizeDecision(value) {
  const decision = String(value || "").trim().toLowerCase();
  if (["approve", "approved", "aprovar"].includes(decision)) return "approved";
  if (["reject", "rejected", "rejeitar"].includes(decision)) return "rejected";
  throw new FamilyFinanceError("invalid-decision", "Decisão inválida.");
}

async function decideFinanceRequest({
  firestore,
  actor,
  childId,
  requestId,
  decision,
  reason = "",
  now = new Date(),
}) {
  assertParent(actor);
  const targetChildId = normalizeChildId(childId);
  const requestDocumentId = String(requestId || "").trim();
  if (!requestDocumentId) throw new FamilyFinanceError("invalid-request", "Pedido inválido.");
  const normalizedDecision = normalizeDecision(decision);
  const decidedAt = nowDate(now);
  const requestReference = childCollection(firestore, targetChildId, "requests").doc(requestDocumentId);

  return firestore.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestReference);
    if (!docExists(requestSnapshot)) {
      throw new FamilyFinanceError("request-not-found", "Pedido não encontrado.", 404);
    }
    const stored = requestSnapshot.data();
    if (stored.status !== "pending") {
      return {
        request: { id: requestSnapshot.id, ...stored },
        idempotent: true,
        alreadyFinal: true,
      };
    }
    const request = normalizeStoredRequest(targetChildId, requestSnapshot.id, stored, decidedAt);
    const refs = refsForRequest(firestore, targetChildId, request);
    const state = await readApprovalState(transaction, refs);

    if (normalizedDecision === "rejected") {
      const rejectionReason = normalizeOptionalText(reason, 300);
      if (rejectionReason.length < 3) {
        throw new FamilyFinanceError("reason-required", "A reprovação precisa de uma explicação.");
      }
      const visibleToChildUntil = new Date(decidedAt.getTime() + REJECTED_VISIBILITY_MS);
      const patch = {
        status: "rejected",
        rejectionReason,
        decidedByUid: actor.uid,
        decidedByRole: actor.role,
        decidedAt,
        rejectedAt: decidedAt,
        visibleToChildUntil,
        updatedAt: decidedAt,
      };
      transaction.set(requestReference, patch, { merge: true });
      if (state.vault && state.vault.data()?.pendingWithdrawalRequestId === request.id) {
        transaction.set(refs.vault, { pendingWithdrawalRequestId: null, updatedAt: decidedAt }, { merge: true });
      }
      transaction.set(
        auditRef(firestore, `request_${request.id}_rejected`),
        auditEvent({
          childId: targetChildId,
          requestId: request.id,
          event: "request.rejected",
          actor,
          now: decidedAt,
          details: { reason: patch.rejectionReason, visibleToChildUntil },
        }),
      );
      return { request: { ...request, ...patch }, idempotent: false };
    }

    const account = normalizeAccountData(
      targetChildId,
      docExists(state.account) ? state.account.data() : null,
      decidedAt,
    );
    const mutation = buildApprovedMutation({
      request,
      account,
      quote: state.quote?.data?.() || null,
      position: state.position?.data?.() || null,
      vault: state.vault?.data?.() || null,
      now: decidedAt,
      actor,
    });
    applyApprovedMutation({
      transaction,
      firestore,
      childId: targetChildId,
      requestRef: requestReference,
      request,
      account,
      mutation,
      actor,
      now: decidedAt,
    });
    return {
      request: { ...request, ...mutation.requestPatch },
      ledger: mutation.ledger,
      idempotent: false,
    };
  });
}

async function requestFinanceCorrection({
  firestore,
  actor,
  childId,
  requestId,
  reason,
  now = new Date(),
}) {
  assertParent(actor);
  const targetChildId = normalizeChildId(childId);
  const id = String(requestId || "").trim();
  const correctionReason = normalizeOptionalText(reason, 300);
  if (!id) throw new FamilyFinanceError("invalid-request", "Movimento inválido.");
  if (correctionReason.length < 3) {
    throw new FamilyFinanceError("reason-required", "O pedido de correção precisa de uma explicação.");
  }
  const requestedAt = nowDate(now);
  const requestReference = childCollection(firestore, targetChildId, "requests").doc(id);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestReference);
    if (!docExists(snapshot)) throw new FamilyFinanceError("request-not-found", "Movimento não encontrado.", 404);
    const request = { id: snapshot.id, ...snapshot.data() };
    if (request.status === "correction_required") {
      return { request, idempotent: true, alreadyRequested: true };
    }
    if (request.status !== "pending") {
      throw new FamilyFinanceError(
        "request-not-pending",
        "Só é possível pedir correção de um movimento que aguarda validação.",
        409,
      );
    }
    if (request.createdByRole !== "child") {
      throw new FamilyFinanceError("child-request-required", "Este movimento não foi criado por uma filha.", 409);
    }
    const patch = {
      status: "correction_required",
      correctionReason,
      correctionRequestedByUid: actor.uid,
      correctionRequestedAt: requestedAt,
      updatedAt: requestedAt,
      visibleToChildUntil: null,
    };
    transaction.set(requestReference, patch, { merge: true });
    transaction.set(
      auditRef(firestore, `request_${id}_correction_${requestedAt.getTime()}`),
      auditEvent({
        childId: targetChildId,
        requestId: id,
        event: "request.correction_requested",
        actor,
        now: requestedAt,
        details: { reason: correctionReason, revision: Number(request.revision) || 0 },
      }),
    );
    return { request: { ...request, ...patch }, idempotent: false };
  });
}

async function resubmitCorrectedRequest({
  firestore,
  actor,
  childId,
  requestId,
  payload,
  idempotencyKey = "",
  now = new Date(),
}) {
  const targetChildId = normalizeChildId(childId);
  if (actor?.role !== "child" || actor.childId !== targetChildId) {
    throw new FamilyFinanceError("child-required", "A correção deve ser feita pela titular da conta.", 403);
  }
  const id = String(requestId || "").trim();
  if (!id) throw new FamilyFinanceError("invalid-request", "Movimento inválido.");
  const correctedAt = nowDate(now);
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const requestReference = childCollection(firestore, targetChildId, "requests").doc(id);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestReference);
    if (!docExists(snapshot)) throw new FamilyFinanceError("request-not-found", "Movimento não encontrado.", 404);
    const stored = { id: snapshot.id, ...snapshot.data() };
    if (
      stored.status === "pending"
      && normalizedKey
      && stored.lastCorrectionResubmissionKey === normalizedKey
    ) {
      return { request: stored, idempotent: true };
    }
    if (stored.status !== "correction_required") {
      throw new FamilyFinanceError("correction-not-required", "Este movimento já não precisa de correção.", 409);
    }
    if (stored.createdByUid !== actor.uid) {
      throw new FamilyFinanceError("forbidden", "Só podes corrigir os teus próprios movimentos.", 403);
    }

    const normalized = normalizeRequestPayload(payload, correctedAt);
    if (normalized.kind !== stored.kind) {
      throw new FamilyFinanceError("kind-change-not-allowed", "O tipo do movimento não pode ser alterado.", 409);
    }
    const refs = refsForRequest(firestore, targetChildId, normalized);
    const approvalState = await readApprovalState(transaction, refs);
    const revision = (Number(stored.revision) || 0) + 1;
    const before = {
      kind: stored.kind,
      amountCents: stored.amountCents,
      category: stored.category,
      note: stored.note || "",
      occurredOn: stored.occurredOn,
      reflection: stored.reflection || null,
      cashLocation: stored.cashLocation || null,
      termDays: stored.termDays || null,
      instrumentId: stored.instrumentId || null,
    };
    const patch = {
      ...normalized,
      status: "pending",
      revision,
      payloadHash: requestPayloadHash(normalized),
      lastCorrectionReason: stored.correctionReason || "",
      correctionReason: null,
      correctionResolvedAt: correctedAt,
      correctionResolvedByUid: actor.uid,
      lastCorrectionResubmissionKey: normalizedKey || null,
      updatedAt: correctedAt,
      visibleToChildUntil: null,
    };
    if (approvalState.quote) patch.quoteAtRequest = quoteSnapshot(approvalState.quote.data());
    transaction.set(requestReference, patch, { merge: true });
    transaction.set(
      auditRef(firestore, `request_${id}_resubmitted_r${revision}`),
      auditEvent({
        childId: targetChildId,
        requestId: id,
        event: "request.correction_resubmitted",
        actor,
        now: correctedAt,
        details: { revision, reason: stored.correctionReason || "", before, after: normalized },
      }),
    );
    return { request: { ...stored, ...patch }, idempotent: false };
  });
}

async function cancelFinanceRequest({ firestore, actor, childId, requestId, now = new Date() }) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const cancelledAt = nowDate(now);
  const id = String(requestId || "").trim();
  if (!id) throw new FamilyFinanceError("invalid-request", "Pedido inválido.");
  const requestReference = childCollection(firestore, targetChildId, "requests").doc(id);

  return firestore.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestReference);
    if (!docExists(requestSnapshot)) {
      throw new FamilyFinanceError("request-not-found", "Pedido não encontrado.", 404);
    }
    const request = { id: requestSnapshot.id, childId: targetChildId, ...requestSnapshot.data() };
    if (!["pending", "correction_required"].includes(request.status)) {
      return { request, idempotent: true, alreadyFinal: true };
    }
    if (actor.role === "child" && request.createdByUid !== actor.uid) {
      throw new FamilyFinanceError("forbidden", "Só pode cancelar os seus pedidos.", 403);
    }

    let vaultReference = null;
    let vaultSnapshot = null;
    if (request.kind === "vault_early_withdraw" && request.vaultId) {
      vaultReference = childCollection(firestore, targetChildId, "vaults").doc(request.vaultId);
      vaultSnapshot = await transaction.get(vaultReference);
    }
    const patch = {
      status: "cancelled",
      cancelledByUid: actor.uid,
      cancelledAt,
      updatedAt: cancelledAt,
      visibleToChildUntil: null,
    };
    transaction.set(requestReference, patch, { merge: true });
    if (docExists(vaultSnapshot) && vaultSnapshot.data()?.pendingWithdrawalRequestId === request.id) {
      transaction.set(vaultReference, { pendingWithdrawalRequestId: null, updatedAt: cancelledAt }, { merge: true });
    }
    transaction.set(
      auditRef(firestore, `request_${request.id}_cancelled`),
      auditEvent({
        childId: targetChildId,
        requestId: request.id,
        event: "request.cancelled",
        actor,
        now: cancelledAt,
      }),
    );
    return { request: { ...request, ...patch }, idempotent: false };
  });
}

async function createEarlyWithdrawalRequest({
  firestore,
  actor,
  childId,
  vaultId,
  idempotencyKey = "",
  now = new Date(),
}) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const createdAt = nowDate(now);
  const targetVaultId = String(vaultId || "").trim();
  if (!targetVaultId) throw new FamilyFinanceError("invalid-vault", "Cofre inválido.");
  const requests = childCollection(firestore, targetChildId, "requests");
  const key = normalizeIdempotencyKey(idempotencyKey);
  const requestReference = requestDocId(requests, actor, targetChildId, key);
  const vaultReference = childCollection(firestore, targetChildId, "vaults").doc(targetVaultId);
  const accountDocument = accountRef(firestore, targetChildId);

  return firestore.runTransaction(async (transaction) => {
    const [existing, vaultSnapshot, accountSnapshot] = await Promise.all([
      transaction.get(requestReference),
      transaction.get(vaultReference),
      transaction.get(accountDocument),
    ]);
    if (docExists(existing)) return { request: { id: existing.id, ...existing.data() }, idempotent: true };
    if (!docExists(vaultSnapshot) || vaultSnapshot.data()?.status !== "active") {
      throw new FamilyFinanceError("vault-not-active", "Este cofre já não está ativo.", 409);
    }
    const vault = { id: vaultSnapshot.id, ...vaultSnapshot.data() };
    if (vault.pendingWithdrawalRequestId) {
      throw new FamilyFinanceError("withdrawal-already-pending", "Já existe um pedido de levantamento.", 409);
    }
    if (asDate(vault.maturesAt, new Date(0)) <= createdAt) {
      throw new FamilyFinanceError("vault-due", "Este cofre já chegou ao prazo e será creditado automaticamente.", 409);
    }
    const request = {
      id: requestReference.id,
      childId: targetChildId,
      kind: "vault_early_withdraw",
      category: "vault",
      amountCents: normalizeAmountCents(vault.principalCents),
      note: "Levantamento antecipado: o juro é perdido.",
      occurredOn: dateKeyInLisbon(createdAt),
      vaultId: targetVaultId,
      status: actor.role === "parent" ? "approved" : "pending",
      createdByUid: actor.uid,
      createdByRole: actor.role,
      createdAt,
      updatedAt: createdAt,
      visibleToChildUntil: null,
      idempotencyKey: key || null,
    };
    transaction.set(requestReference, request);
    transaction.set(
      auditRef(firestore, `request_${request.id}_created`),
      auditEvent({
        childId: targetChildId,
        requestId: request.id,
        event: "request.created",
        actor,
        now: createdAt,
        details: { kind: request.kind, vaultId: targetVaultId },
      }),
    );

    if (actor.role === "parent") {
      const account = normalizeAccountData(
        targetChildId,
        docExists(accountSnapshot) ? accountSnapshot.data() : null,
        createdAt,
      );
      const mutation = buildApprovedMutation({ request, account, vault, now: createdAt, actor });
      applyApprovedMutation({
        transaction,
        firestore,
        childId: targetChildId,
        requestRef: requestReference,
        request,
        account,
        mutation,
        actor,
        now: createdAt,
      });
      return { request: { ...request, ...mutation.requestPatch }, ledger: mutation.ledger, idempotent: false };
    }

    transaction.set(vaultReference, {
      pendingWithdrawalRequestId: request.id,
      updatedAt: createdAt,
    }, { merge: true });
    if (!docExists(accountSnapshot)) {
      const account = normalizeAccountData(targetChildId, null, createdAt);
      transactionSetAccount(transaction, accountDocument, account, {
        balanceCents: 0,
        childCashCents: 0,
        ledgerSequence: 0,
      }, createdAt);
    }
    return { request, idempotent: false };
  });
}

async function saveFinanceGoal({ firestore, actor, childId, goal, now = new Date() }) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const input = goal && typeof goal === "object" ? goal : {};
  const title = normalizeOptionalText(input.title || input.name, 80);
  if (!title) throw new FamilyFinanceError("invalid-goal", "O objetivo precisa de um nome.");
  const targetCents = normalizeAmountCents(input.targetCents || input.amountCents, "targetCents");
  const updatedAt = nowDate(now);
  const goalDocument = childCollection(firestore, targetChildId, "goals").doc("current");
  const payload = {
    childId: targetChildId,
    title,
    targetCents,
    note: normalizeOptionalText(input.note, 160),
    image: normalizeOptionalText(input.image, 240),
    updatedByUid: actor.uid,
    updatedAt,
  };
  await goalDocument.set(payload, { merge: true });
  await auditRef(firestore, `goal_${targetChildId}_${updatedAt.getTime()}`).set(
    auditEvent({
      childId: targetChildId,
      event: "goal.saved",
      actor,
      now: updatedAt,
      details: { title, targetCents },
    }),
  );
  return { goal: payload };
}

async function transferGoalFunds({
  firestore,
  actor,
  childId,
  direction,
  amountCents,
  idempotencyKey = "",
  now = new Date(),
}) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const transferDirection = String(direction || "").trim().toLowerCase();
  if (!['reserve', 'release'].includes(transferDirection)) {
    throw new FamilyFinanceError("invalid-goal-transfer", "Movimento do objetivo inválido.");
  }
  const amount = normalizeAmountCents(amountCents);
  const transferredAt = nowDate(now);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const accountDocument = accountRef(firestore, targetChildId);
  const goalDocument = childCollection(firestore, targetChildId, "goals").doc("current");
  const ledgerCollection = childCollection(firestore, targetChildId, "ledger");
  const ledgerDocument = requestDocId(ledgerCollection, actor, targetChildId, key);

  return firestore.runTransaction(async (transaction) => {
    const [existingLedger, accountSnapshot, goalSnapshot] = await Promise.all([
      transaction.get(ledgerDocument),
      transaction.get(accountDocument),
      transaction.get(goalDocument),
    ]);
    if (docExists(existingLedger)) {
      return { ledger: { id: existingLedger.id, ...existingLedger.data() }, idempotent: true };
    }
    if (!docExists(goalSnapshot)) {
      throw new FamilyFinanceError("goal-not-found", "Cria primeiro um objetivo de poupança.", 404);
    }
    const account = normalizeAccountData(
      targetChildId,
      docExists(accountSnapshot) ? accountSnapshot.data() : null,
      transferredAt,
    );
    const cashBefore = accountCashBreakdown(account);
    const goal = goalSnapshot.data() || {};
    const reservedBeforeCents = Math.max(0, Number(goal.reservedCents) || 0);
    if (transferDirection === 'reserve' && cashBefore.parentHeldCents < amount) {
      throw new FamilyFinanceError(
        "insufficient-balance",
        "Não existe dinheiro disponível suficiente para guardar no objetivo.",
        409,
      );
    }
    if (transferDirection === 'release' && reservedBeforeCents < amount) {
      throw new FamilyFinanceError(
        "insufficient-goal-reserve",
        "O objetivo não tem esse valor reservado.",
        409,
      );
    }
    const deltaCents = transferDirection === 'reserve' ? -amount : amount;
    const reservedAfterCents = reservedBeforeCents - deltaCents;
    const balanceAfterCents = account.balanceCents + deltaCents;
    const cashAfter = accountCashBreakdown({
      balanceCents: balanceAfterCents,
      childCashCents: cashBefore.childCashCents,
    });
    const debtPaidCents = deltaCents > 0
      ? Math.min(cashBefore.debtCents, deltaCents)
      : 0;
    const sequence = account.ledgerSequence + 1;
    const kind = transferDirection === 'reserve' ? 'goal_reserve' : 'goal_release';
    const ledger = {
      id: ledgerDocument.id,
      childId: targetChildId,
      sequence,
      kind,
      category: 'savings_goal',
      goalId: 'current',
      goalTitle: String(goal.title || 'Objetivo'),
      amountCents: amount,
      deltaCents,
      balanceAfterCents,
      childCashDeltaCents: 0,
      childCashAfterCents: cashAfter.childCashCents,
      parentHeldAfterCents: cashAfter.parentHeldCents,
      debtAfterCents: cashAfter.debtCents,
      debtPaidCents,
      availableAddedCents: deltaCents > 0 ? Math.max(0, deltaCents - debtPaidCents) : 0,
      reservedBeforeCents,
      reservedAfterCents,
      occurredOn: dateKeyInLisbon(transferredAt),
      note: transferDirection === 'reserve'
        ? `Dinheiro guardado para ${goal.title || 'o objetivo'}.`
        : `Dinheiro retirado de ${goal.title || 'o objetivo'}.`,
      createdByUid: actor.uid,
      createdByRole: actor.role,
      validatedByUid: actor.uid,
      validatedAt: transferredAt,
      approvedByUid: actor.uid,
      approvedAt: transferredAt,
      createdAt: transferredAt,
      idempotencyKey: key || null,
    };
    transactionSetAccount(transaction, accountDocument, account, {
      balanceCents: balanceAfterCents,
      childCashCents: cashBefore.childCashCents,
      ledgerSequence: sequence,
    }, transferredAt);
    transaction.set(goalDocument, {
      reservedCents: reservedAfterCents,
      updatedByUid: actor.uid,
      updatedAt: transferredAt,
    }, { merge: true });
    transaction.set(ledgerDocument, ledger);
    transaction.set(
      auditRef(firestore, `goal_${targetChildId}_${kind}_${ledgerDocument.id}`),
      auditEvent({
        childId: targetChildId,
        event: `goal.${transferDirection}`,
        actor,
        now: transferredAt,
        details: {
          ledgerId: ledgerDocument.id,
          amountCents: amount,
          balanceAfterCents,
          reservedBeforeCents,
          reservedAfterCents,
        },
      }),
    );
    return { ledger, goal: { ...goal, reservedCents: reservedAfterCents }, idempotent: false };
  });
}

async function createParentAdjustment({
  firestore,
  actor,
  childId,
  deltaCents,
  amountCents = null,
  kind = null,
  category = null,
  note = "",
  occurredOn = null,
  idempotencyKey = "",
  now = new Date(),
}) {
  assertParent(actor);
  const normalizedKind = kind == null || kind === ""
    ? null
    : normalizeRequestKind(kind);
  if (normalizedKind && !["income", "expense"].includes(normalizedKind)) {
    throw new FamilyFinanceError("invalid-kind", "Um ajuste parental deve ser entrada ou saída.");
  }
  const delta = deltaCents != null
    ? Number(deltaCents)
    : normalizedKind === "income"
      ? Number(amountCents)
      : normalizedKind === "expense"
        ? -Number(amountCents)
        : 0;
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > MAX_AMOUNT_CENTS) {
    throw new FamilyFinanceError("invalid-amount", "O ajuste deve ser um inteiro de cêntimos diferente de zero.");
  }
  const direction = delta > 0 ? "income" : "expense";
  return createFinanceRequest({
    firestore,
    actor,
    childId,
    payload: {
      kind: direction,
      amountCents: Math.abs(delta),
      category: normalizeCategory(direction, category || "adjustment"),
      note: normalizeOptionalText(note || "Ajuste parental"),
      occurredOn,
    },
    idempotencyKey,
    now,
  });
}

async function reverseLedgerMovement({
  firestore,
  actor,
  childId,
  ledgerId,
  reason,
  now = new Date(),
}) {
  assertParent(actor);
  const targetChildId = normalizeChildId(childId);
  const originalId = String(ledgerId || "").trim();
  const reversalReason = normalizeOptionalText(reason, 300);
  if (!originalId) throw new FamilyFinanceError("invalid-ledger", "Movimento inválido.");
  if (reversalReason.length < 3) {
    throw new FamilyFinanceError("reason-required", "O estorno precisa de uma explicação.");
  }
  const reversedAt = nowDate(now);
  const accountDocument = accountRef(firestore, targetChildId);
  const originalReference = childCollection(firestore, targetChildId, "ledger").doc(originalId);
  const reversalReference = childCollection(firestore, targetChildId, "ledger").doc(`reversal_${originalId}`);

  return firestore.runTransaction(async (transaction) => {
    const [originalSnapshot, reversalSnapshot, accountSnapshot] = await Promise.all([
      transaction.get(originalReference),
      transaction.get(reversalReference),
      transaction.get(accountDocument),
    ]);
    if (!docExists(originalSnapshot)) throw new FamilyFinanceError("ledger-not-found", "Movimento não encontrado.", 404);
    if (docExists(reversalSnapshot)) {
      return { ledger: { id: reversalSnapshot.id, ...reversalSnapshot.data() }, idempotent: true };
    }
    const original = { id: originalSnapshot.id, ...originalSnapshot.data() };
    if (!['income', 'expense'].includes(original.kind)) {
      throw new FamilyFinanceError(
        "reversal-not-supported",
        "Este tipo de movimento deve ser corrigido através da operação financeira inversa correspondente.",
        409,
      );
    }
    const originalDeltaCents = Number(original.deltaCents);
    if (!Number.isSafeInteger(originalDeltaCents) || originalDeltaCents === 0) {
      throw new FamilyFinanceError("invalid-ledger", "O movimento não tem um valor contabilístico válido.", 409);
    }
    const account = normalizeAccountData(
      targetChildId,
      docExists(accountSnapshot) ? accountSnapshot.data() : null,
      reversedAt,
    );
    const cashBefore = accountCashBreakdown(account);
    const deltaCents = -originalDeltaCents;
    const balanceAfterCents = account.balanceCents + deltaCents;
    const originalChildCashDeltaCents = Number.isSafeInteger(original.childCashDeltaCents)
      ? original.childCashDeltaCents
      : 0;
    const requestedChildCashDeltaCents = -originalChildCashDeltaCents;
    const childCashDeltaCents = requestedChildCashDeltaCents < 0
      ? -Math.min(cashBefore.childCashCents, Math.abs(requestedChildCashDeltaCents))
      : requestedChildCashDeltaCents;
    const childCashAfterCents = cashBefore.childCashCents + childCashDeltaCents;
    const cashAfter = accountCashBreakdown({ balanceCents: balanceAfterCents, childCashCents: childCashAfterCents });
    const sequence = account.ledgerSequence + 1;
    const reversal = {
      id: reversalReference.id,
      childId: targetChildId,
      sequence,
      kind: 'reversal',
      originalKind: original.kind,
      category: original.category || 'adjustment',
      amountCents: Math.abs(deltaCents),
      deltaCents,
      balanceAfterCents,
      childCashDeltaCents,
      childCashAfterCents,
      parentHeldAfterCents: cashAfter.parentHeldCents,
      debtAfterCents: cashAfter.debtCents,
      reversalOfLedgerId: originalId,
      reversalOfRequestId: original.requestId || null,
      occurredOn: dateKeyInLisbon(reversedAt),
      note: reversalReason,
      createdByUid: actor.uid,
      createdByRole: actor.role,
      validatedByUid: actor.uid,
      validatedAt: reversedAt,
      approvedByUid: actor.uid,
      approvedAt: reversedAt,
      createdAt: reversedAt,
    };
    transactionSetAccount(transaction, accountDocument, account, {
      balanceCents: balanceAfterCents,
      childCashCents: childCashAfterCents,
      ledgerSequence: sequence,
    }, reversedAt);
    transaction.set(reversalReference, reversal);
    transaction.set(
      auditRef(firestore, `ledger_${originalId}_reversed`),
      auditEvent({
        childId: targetChildId,
        requestId: original.requestId || null,
        event: 'ledger.reversed',
        actor,
        now: reversedAt,
        details: { originalLedgerId: originalId, reversalLedgerId: reversalReference.id, reason: reversalReason },
      }),
    );
    return { ledger: reversal, original, idempotent: false };
  });
}

async function updateExpenseReflection({
  firestore,
  actor,
  childId,
  ledgerId,
  reflection,
  now = new Date(),
}) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const id = String(ledgerId || "").trim();
  const nextReflection = String(reflection || "").trim().toLowerCase();
  if (!id) throw new FamilyFinanceError("invalid-ledger", "Movimento inválido.");
  if (!["need", "want"].includes(nextReflection)) {
    throw new FamilyFinanceError("invalid-reflection", "Escolhe necessidade ou desejo.");
  }
  const changedAt = nowDate(now);
  const ledgerReference = childCollection(firestore, targetChildId, "ledger").doc(id);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ledgerReference);
    if (!docExists(snapshot)) throw new FamilyFinanceError("ledger-not-found", "Movimento não encontrado.", 404);
    const movement = { id: snapshot.id, ...snapshot.data() };
    if (movement.kind !== "expense") {
      throw new FamilyFinanceError("expense-required", "Esta reflexão só se aplica a uma compra.", 409);
    }
    if (movement.reflection === nextReflection) return { movement, idempotent: true };
    const previousReflection = ["need", "want"].includes(movement.reflection) ? movement.reflection : null;
    const history = Array.isArray(movement.reflectionHistory) ? movement.reflectionHistory.slice(-19) : [];
    const patch = {
      reflection: nextReflection,
      reflectionUpdatedAt: changedAt,
      reflectionUpdatedByUid: actor.uid,
      reflectionHistory: [...history, {
        from: previousReflection,
        to: nextReflection,
        changedAt,
        changedByUid: actor.uid,
        changedByRole: actor.role,
      }],
    };
    transaction.set(ledgerReference, patch, { merge: true });
    transaction.set(
      auditRef(firestore, `ledger_${id}_reflection_${changedAt.getTime()}`),
      auditEvent({
        childId: targetChildId,
        requestId: movement.requestId || null,
        event: "expense.reflection_changed",
        actor,
        now: changedAt,
        details: { ledgerId: id, from: previousReflection, to: nextReflection },
      }),
    );
    return { movement: { ...movement, ...patch }, idempotent: false };
  });
}

async function matureVault({ firestore, childId, vaultId, now = new Date() }) {
  const targetChildId = normalizeChildId(childId);
  const maturedAt = nowDate(now);
  const vaultReference = childCollection(firestore, targetChildId, "vaults").doc(vaultId);
  const accountDocument = accountRef(firestore, targetChildId);
  const ledgerReference = childCollection(firestore, targetChildId, "ledger").doc(`maturity_${vaultId}`);

  return firestore.runTransaction(async (transaction) => {
    const [vaultSnapshot, accountSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(vaultReference),
      transaction.get(accountDocument),
      transaction.get(ledgerReference),
    ]);
    if (!docExists(vaultSnapshot)) return { skipped: true, reason: "not-found", vaultId };
    const vault = { id: vaultSnapshot.id, ...vaultSnapshot.data() };
    if (vault.status !== "active") return { skipped: true, reason: "not-active", vaultId };
    if (asDate(vault.maturesAt, new Date(8640000000000000)) > maturedAt) {
      return { skipped: true, reason: "not-due", vaultId };
    }
    if (docExists(ledgerSnapshot)) {
      transaction.set(vaultReference, {
        status: "matured",
        maturedAt: vault.maturedAt || maturedAt,
        pendingWithdrawalRequestId: null,
        updatedAt: maturedAt,
      }, { merge: true });
      return { skipped: true, reason: "already-credited", vaultId };
    }

    let pendingRequestReference = null;
    let pendingRequestSnapshot = null;
    if (vault.pendingWithdrawalRequestId) {
      pendingRequestReference = childCollection(firestore, targetChildId, "requests")
        .doc(vault.pendingWithdrawalRequestId);
      pendingRequestSnapshot = await transaction.get(pendingRequestReference);
    }

    const account = normalizeAccountData(
      targetChildId,
      docExists(accountSnapshot) ? accountSnapshot.data() : null,
      maturedAt,
    );
    const cashBefore = accountCashBreakdown(account);
    const principalCents = normalizeAmountCents(vault.principalCents, "principalCents");
    const interestCents = Number.isSafeInteger(vault.expectedInterestCents)
      ? Math.max(0, vault.expectedInterestCents)
      : calculateVaultInterestCents(principalCents, vault.annualRateBps, vault.termDays);
    const deltaCents = principalCents + interestCents;
    const sequence = account.ledgerSequence + 1;
    const balanceAfterCents = account.balanceCents + deltaCents;
    const cashAfter = accountCashBreakdown({
      balanceCents: balanceAfterCents,
      childCashCents: cashBefore.childCashCents,
    });
    const debtPaidCents = Math.min(cashBefore.debtCents, deltaCents);
    const ledger = {
      id: ledgerReference.id,
      childId: targetChildId,
      requestId: vault.requestId || null,
      vaultId,
      sequence,
      kind: "vault_maturity",
      category: "investment_interest",
      amountCents: deltaCents,
      deltaCents,
      principalCents,
      interestCents,
      balanceAfterCents,
      childCashDeltaCents: 0,
      childCashAfterCents: cashAfter.childCashCents,
      parentHeldAfterCents: cashAfter.parentHeldCents,
      debtAfterCents: cashAfter.debtCents,
      debtPaidCents,
      availableAddedCents: Math.max(0, deltaCents - debtPaidCents),
      occurredOn: dateKeyInLisbon(maturedAt),
      note: `Cofre de ${vault.termDays} dias concluído.`,
      createdByUid: "system",
      approvedByUid: "system",
      approvedAt: maturedAt,
      createdAt: maturedAt,
    };
    transactionSetAccount(transaction, accountDocument, account, {
      balanceCents: balanceAfterCents,
      childCashCents: cashBefore.childCashCents,
      ledgerSequence: sequence,
    }, maturedAt);
    transaction.set(ledgerReference, ledger);
    transaction.set(vaultReference, {
      status: "matured",
      interestPaidCents: interestCents,
      maturedAt,
      pendingWithdrawalRequestId: null,
      updatedAt: maturedAt,
    }, { merge: true });
    if (docExists(pendingRequestSnapshot) && pendingRequestSnapshot.data()?.status === "pending") {
      transaction.set(pendingRequestReference, {
        status: "cancelled",
        cancelledByUid: "system",
        cancelReason: "vault-matured",
        cancelledAt: maturedAt,
        updatedAt: maturedAt,
      }, { merge: true });
    }
    transaction.set(
      auditRef(firestore, `vault_${vaultId}_matured`),
      auditEvent({
        childId: targetChildId,
        requestId: vault.requestId || null,
        event: "vault.matured",
        actor: { uid: "system", role: "system" },
        now: maturedAt,
        details: { vaultId, principalCents, interestCents, balanceAfterCents },
      }),
    );
    return { skipped: false, vaultId, principalCents, interestCents, balanceAfterCents };
  });
}

async function matureDueVaults({ firestore, now = new Date() }) {
  const maturedAt = nowDate(now);
  const candidates = [];
  for (const childId of Object.keys(CHILDREN)) {
    const snapshot = await childCollection(firestore, childId, "vaults")
      .where("status", "==", "active")
      .get();
    snapshot.docs.forEach((doc) => {
      if (asDate(doc.data()?.maturesAt, new Date(8640000000000000)) <= maturedAt) {
        candidates.push({ childId, vaultId: doc.id });
      }
    });
  }
  const results = [];
  for (const candidate of candidates) {
    // Sequential transactions keep each account sequence deterministic.
    results.push(await matureVault({ firestore, ...candidate, now: maturedAt }));
  }
  return { checkedAt: maturedAt, candidates: candidates.length, results };
}

function parseAlphaVantageQuote(payload, apiSymbol) {
  if (payload?.Note || payload?.Information || payload?.["Error Message"]) {
    throw new FamilyFinanceError(
      "quote-provider-error",
      payload.Note || payload.Information || payload["Error Message"],
      502,
    );
  }
  const quote = payload?.["Global Quote"];
  const price = Number(quote?.["05. price"]);
  const marketAsOf = String(quote?.["07. latest trading day"] || "").trim();
  if (!(price > 0) || !Number.isFinite(price)) {
    throw new FamilyFinanceError(
      "quote-unavailable",
      `Sem último fecho disponível para ${apiSymbol}.`,
      502,
    );
  }
  return {
    apiSymbol,
    nativePrice: price,
    marketAsOf: /^\d{4}-\d{2}-\d{2}$/.test(marketAsOf) ? marketAsOf : null,
  };
}

function parseEcbDailyXml(xml) {
  const text = String(xml || "");
  const dateMatch = text.match(/<Cube\s+time=['"]([^'"]+)['"]/i);
  const usdMatch = text.match(/<Cube\s+currency=['"]USD['"]\s+rate=['"]([^'"]+)['"]\s*\/?\s*>/i);
  const usdPerEur = Number(usdMatch?.[1]);
  if (!(usdPerEur > 0) || !Number.isFinite(usdPerEur)) {
    throw new FamilyFinanceError("fx-unavailable", "Taxa de referência EUR/USD indisponível.", 502);
  }
  return {
    usdPerEur,
    asOf: dateMatch?.[1] || null,
    source: "ECB euro foreign exchange reference rates",
  };
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEcbUsdRate(fetchImpl) {
  const response = await fetchWithTimeout(
    fetchImpl,
    "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    { headers: { Accept: "application/xml,text/xml" } },
  );
  if (!response.ok) {
    throw new FamilyFinanceError("fx-provider-error", `ECB respondeu com ${response.status}.`, 502);
  }
  return parseEcbDailyXml(await response.text());
}

async function fetchAlphaVantageClose(fetchImpl, apiKey, apiSymbol) {
  if (!apiKey) {
    throw new FamilyFinanceError("quote-key-missing", "Chave Alpha Vantage não configurada.", 500);
  }
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", apiSymbol);
  url.searchParams.set("apikey", apiKey);
  const response = await fetchWithTimeout(fetchImpl, url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new FamilyFinanceError(
      "quote-provider-error",
      `Alpha Vantage respondeu com ${response.status} para ${apiSymbol}.`,
      502,
    );
  }
  return parseAlphaVantageQuote(await response.json(), apiSymbol);
}

async function fetchInstrumentClose(fetchImpl, apiKey, instrument) {
  let lastError = null;
  for (const apiSymbol of instrument.apiSymbols) {
    try {
      return await fetchAlphaVantageClose(fetchImpl, apiKey, apiSymbol);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new FamilyFinanceError("quote-unavailable", `Sem cotação para ${instrument.id}.`, 502);
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

async function getQuotesSnapshot(firestore) {
  const [quotesSnapshot, metaSnapshot, historySnapshot] = await Promise.all([
    firestore.collection(QUOTES_COLLECTION).get(),
    firestore.collection(META_COLLECTION).doc("quotes").get(),
    firestore.collection(QUOTE_HISTORY_COLLECTION).orderBy("fetchedAt", "desc").limit(500).get(),
  ]);
  const quotes = quotesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => a.instrumentId.localeCompare(b.instrumentId));
  return {
    quotes,
    instruments: MARKET_INSTRUMENTS.map((instrument) => ({
      id: instrument.id,
      symbol: instrument.symbol,
      name: instrument.name,
      type: instrument.type,
      exchange: instrument.exchange,
      isin: instrument.isin,
      currency: CURRENCY,
      nativeCurrency: instrument.nativeCurrency,
      riskLevel: instrument.riskLevel,
      educational: true,
      priceType: "last_close",
    })),
    quoteUpdatedAt: metaSnapshot.data()?.lastRefreshAt || null,
    quoteMeta: metaSnapshot.exists ? metaSnapshot.data() : {},
    quoteHistory: historySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.marketAsOf || a.fetchedAt).localeCompare(String(b.marketAsOf || b.fetchedAt))),
  };
}

async function reserveManualQuoteRefresh({ firestore, actor, now }) {
  assertParent(actor);
  const metaReference = firestore.collection(META_COLLECTION).doc("quotes");
  const today = dateKeyInLisbon(now);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(metaReference);
    const current = snapshot.exists ? snapshot.data() : {};
    const used = current.manualRefreshDate === today
      ? Number(current.manualRefreshCount) || 0
      : 0;
    if (used >= 1) return { allowed: false, today, used };
    transaction.set(metaReference, {
      manualRefreshDate: today,
      manualRefreshCount: used + 1,
      manualLastAttemptAt: now,
      manualLastAttemptByUid: actor.uid,
    }, { merge: true });
    return { allowed: true, today, used: used + 1 };
  });
}

async function refreshMarketQuotes({
  firestore,
  apiKey,
  actor = { uid: "system", role: "system" },
  manual = false,
  now = new Date(),
  fetchImpl = global.fetch,
  requestDelayMs = 1_100,
}) {
  const refreshedAt = nowDate(now);
  if (typeof fetchImpl !== "function") {
    throw new FamilyFinanceError("fetch-unavailable", "Cliente HTTP indisponível.", 500);
  }

  if (manual) {
    const reservation = await reserveManualQuoteRefresh({ firestore, actor, now: refreshedAt });
    if (!reservation.allowed) {
      return {
        ...(await getQuotesSnapshot(firestore)),
        refreshed: false,
        reason: "manual-daily-limit",
        nextRefreshDate: dateKeyInLisbon(addDays(refreshedAt, 1)),
      };
    }
  }

  const metaReference = firestore.collection(META_COLLECTION).doc("quotes");
  const previousMetaSnapshot = await metaReference.get();
  const previousMeta = previousMetaSnapshot.exists ? previousMetaSnapshot.data() : {};
  const automaticDate = dateKeyInLisbon(refreshedAt);
  if (!manual && previousMeta.lastAutomaticDate === automaticDate) {
    return { ...(await getQuotesSnapshot(firestore)), refreshed: false, reason: "already-refreshed" };
  }

  let fx;
  try {
    fx = await fetchEcbUsdRate(fetchImpl);
  } catch (error) {
    if (Number(previousMeta.fxUsdPerEur) > 0) {
      fx = {
        usdPerEur: Number(previousMeta.fxUsdPerEur),
        asOf: previousMeta.fxAsOf || null,
        source: previousMeta.fxSource || "ECB (cache)",
        cached: true,
      };
    } else {
      throw error;
    }
  }

  const quoteRows = [];
  const errors = [];
  for (let index = 0; index < MARKET_INSTRUMENTS.length; index += 1) {
    const instrument = MARKET_INSTRUMENTS[index];
    try {
      const close = await fetchInstrumentClose(fetchImpl, apiKey, instrument);
      const eurPrice = instrument.nativeCurrency === "USD"
        ? close.nativePrice / fx.usdPerEur
        : close.nativePrice;
      const priceCents = Math.round(eurPrice * 100);
      if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
        throw new FamilyFinanceError("invalid-quote", `Cotação convertida inválida para ${instrument.id}.`, 502);
      }
      quoteRows.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        apiSymbol: close.apiSymbol,
        name: instrument.name,
        type: instrument.type,
        priceCents,
        currency: CURRENCY,
        nativePrice: close.nativePrice,
        nativeCurrency: instrument.nativeCurrency,
        fxUsdPerEur: instrument.nativeCurrency === "USD" ? fx.usdPerEur : null,
        fxAsOf: instrument.nativeCurrency === "USD" ? fx.asOf : null,
        marketAsOf: close.marketAsOf,
        fetchedAt: refreshedAt,
        source: "Alpha Vantage GLOBAL_QUOTE (último fecho)",
        priceType: "last_close",
        delayed: true,
        educational: true,
      });
    } catch (error) {
      errors.push({ instrumentId: instrument.id, message: error.message });
    }
    if (index + 1 < MARKET_INSTRUMENTS.length) await sleep(requestDelayMs);
  }

  if (!quoteRows.length) {
    await metaReference.set({
      lastFailedAt: refreshedAt,
      lastErrors: errors,
    }, { merge: true });
    throw new FamilyFinanceError(
      "quotes-refresh-failed",
      "Não foi possível atualizar nenhuma cotação; o cache anterior foi preservado.",
      502,
      errors,
    );
  }

  const batch = firestore.batch();
  quoteRows.forEach((row) => {
    batch.set(quoteRef(firestore, row.instrumentId), row, { merge: true });
    const historyDate = row.marketAsOf || automaticDate;
    batch.set(
      firestore.collection(QUOTE_HISTORY_COLLECTION).doc(`${historyDate}_${row.instrumentId}`),
      { ...row, historyDate },
      { merge: true },
    );
  });
  const metaPatch = {
    lastRefreshAt: refreshedAt,
    lastRefreshKind: manual ? "manual_parent" : "automatic",
    lastRefreshByUid: actor.uid || "system",
    lastErrors: errors,
    instrumentsUpdated: quoteRows.map((row) => row.instrumentId),
    fxUsdPerEur: fx.usdPerEur,
    fxAsOf: fx.asOf,
    fxSource: fx.source,
  };
  if (!manual) metaPatch.lastAutomaticDate = automaticDate;
  batch.set(metaReference, metaPatch, { merge: true });
  batch.set(
    auditRef(firestore, `quotes_${manual ? "manual" : "automatic"}_${refreshedAt.getTime()}`),
    auditEvent({
      childId: null,
      event: "quotes.refreshed",
      actor,
      now: refreshedAt,
      details: {
        kind: manual ? "manual_parent" : "automatic",
        updated: quoteRows.map((row) => row.instrumentId),
        errors,
      },
    }),
  );
  await batch.commit();
  return {
    ...(await getQuotesSnapshot(firestore)),
    refreshed: true,
    updated: quoteRows.map((row) => row.instrumentId),
    errors,
  };
}

function serializeForJson(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeForJson);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeForJson(item)]));
  }
  return value;
}

function isRejectedVisibleToChild(request, now) {
  if (request.status !== "rejected") return true;
  const deadline = asDate(request.visibleToChildUntil, null);
  return Boolean(deadline && deadline > now);
}

function buildCharts(ledgerRows) {
  const incomeByCategory = {};
  const expenseByCategory = {};
  const add = (target, key, amount) => {
    if (!(amount > 0)) return;
    target[key] = (target[key] || 0) + amount;
  };
  ledgerRows.forEach((movement) => {
    if (movement.kind === "income") {
      add(incomeByCategory, movement.category || "other", Number(movement.deltaCents) || 0);
    } else if (movement.kind === "expense") {
      add(expenseByCategory, movement.category || "other", Math.abs(Number(movement.deltaCents) || 0));
    } else if (movement.kind === "vault_maturity") {
      add(incomeByCategory, "investment_interest", Number(movement.interestCents) || 0);
    } else if (movement.kind === "market_sell") {
      const realized = Number(movement.realizedPnlCents) || 0;
      if (realized > 0) add(incomeByCategory, "investment_realized_gain", realized);
      if (realized < 0) add(expenseByCategory, "investment_realized_loss", Math.abs(realized));
    }
  });
  return { incomeByCategory, expenseByCategory };
}

function buildMonthlySummary(ledgerRows, now = new Date()) {
  const period = dateKeyInLisbon(now).slice(0, 7);
  const rows = ledgerRows.filter((movement) => String(movement.occurredOn || '').startsWith(period));
  const summary = {
    period,
    receivedCents: 0,
    spentCents: 0,
    goalReservedCents: 0,
    vaultPlacedCents: 0,
    investedCents: 0,
    interestReceivedCents: 0,
    realizedGainsCents: 0,
    realizedLossesCents: 0,
    realizedNetCents: 0,
    wealthChangeCents: 0,
    needSpentCents: 0,
    wantSpentCents: 0,
    cashTakenCents: 0,
    cashReturnedCents: 0,
    expenseByCategory: {},
    insights: [],
  };
  rows.forEach((movement) => {
    const amount = Math.max(0, Number(movement.amountCents) || Math.abs(Number(movement.deltaCents) || 0));
    if (movement.kind === 'income') summary.receivedCents += amount;
    if (movement.kind === 'expense') {
      summary.spentCents += amount;
      if (movement.reflection === 'need') summary.needSpentCents += amount;
      if (movement.reflection === 'want') summary.wantSpentCents += amount;
      const category = movement.category || 'other';
      summary.expenseByCategory[category] = (summary.expenseByCategory[category] || 0) + amount;
    }
    if (movement.kind === 'cash_withdrawal') summary.cashTakenCents += amount;
    if (movement.kind === 'cash_return') summary.cashReturnedCents += amount;
    if (movement.kind === 'goal_reserve') summary.goalReservedCents += amount;
    if (movement.kind === 'goal_release') summary.goalReservedCents -= amount;
    if (movement.kind === 'vault_open') summary.vaultPlacedCents += amount;
    if (movement.kind === 'market_buy') summary.investedCents += amount;
    if (movement.kind === 'vault_maturity') {
      summary.interestReceivedCents += Math.max(0, Number(movement.interestCents) || 0);
    }
    if (movement.kind === 'market_sell') {
      const realized = Number(movement.realizedPnlCents) || 0;
      if (realized >= 0) summary.realizedGainsCents += realized;
      else summary.realizedLossesCents += Math.abs(realized);
    }
  });
  summary.goalReservedCents = Math.max(0, summary.goalReservedCents);
  summary.realizedNetCents = summary.realizedGainsCents - summary.realizedLossesCents;
  summary.wealthChangeCents = summary.receivedCents
    - summary.spentCents
    + summary.interestReceivedCents
    + summary.realizedNetCents;
  if (summary.spentCents > 0 && summary.wantSpentCents > 0) {
    summary.insights.push({
      type: 'wants_share',
      percentage: Math.round((summary.wantSpentCents * 100) / summary.spentCents),
    });
  }
  const topExpense = Object.entries(summary.expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  if (topExpense) summary.insights.push({ type: 'top_expense', category: topExpense[0], amountCents: topExpense[1] });
  if (summary.receivedCents > 0) {
    const learningCents = summary.goalReservedCents + summary.vaultPlacedCents + summary.investedCents;
    summary.insights.push({
      type: 'saved_or_invested_share',
      percentage: Math.round((learningCents * 100) / summary.receivedCents),
    });
  }
  summary.insights = summary.insights.slice(0, 3);
  return summary;
}

function pendingSummary(requests) {
  let pendingIncomingCents = 0;
  let pendingOutgoingCents = 0;
  let pendingCashWithdrawalCents = 0;
  let pendingCashReturnCents = 0;
  requests.filter((request) => request.status === "pending").forEach((request) => {
    const amount = Number(request.amountCents) || 0;
    if (["income", "market_sell", "vault_early_withdraw"].includes(request.kind)) {
      pendingIncomingCents += amount;
    } else if (["expense", "vault_open", "market_buy"].includes(request.kind)) {
      pendingOutgoingCents += amount;
    }
    if (request.kind === "cash_withdrawal") pendingCashWithdrawalCents += amount;
    if (request.kind === "cash_return") pendingCashReturnCents += amount;
  });
  return {
    pendingIncomingCents,
    pendingOutgoingCents,
    pendingNetCents: pendingIncomingCents - pendingOutgoingCents,
    pendingCashWithdrawalCents,
    pendingCashReturnCents,
  };
}

function projectPendingAccount(account, requests = []) {
  let projected = accountCashBreakdown(account);
  const ordered = requests
    .filter((request) => request.status === "pending")
    .sort((left, right) => asDate(left.createdAt, new Date(0)) - asDate(right.createdAt, new Date(0)));
  ordered.forEach((request) => {
    const amount = Math.max(0, Number(request.amountCents) || 0);
    let balanceCents = projected.balanceCents;
    let childCashCents = projected.childCashCents;
    if (request.kind === "income") {
      balanceCents += amount;
      if (request.cashLocation === "child") childCashCents += Math.max(0, amount - Math.min(projected.debtCents, amount));
    } else if (request.kind === "expense") {
      balanceCents -= amount;
      if (request.cashLocation === "child") childCashCents = Math.max(0, childCashCents - amount);
    } else if (["vault_open", "market_buy"].includes(request.kind)) {
      balanceCents -= amount;
    } else if (["market_sell", "vault_early_withdraw"].includes(request.kind)) {
      balanceCents += amount;
    } else if (request.kind === "cash_withdrawal") {
      childCashCents += Math.min(projected.parentHeldCents, amount);
    } else if (request.kind === "cash_return") {
      childCashCents -= Math.min(childCashCents, amount);
    }
    projected = accountCashBreakdown({ balanceCents, childCashCents });
  });
  return projected;
}

function reconstructAccountFromLedger(movements = []) {
  const ordered = [...movements].sort((left, right) => {
    const leftSequence = Number(left?.sequence) || 0;
    const rightSequence = Number(right?.sequence) || 0;
    if (leftSequence !== rightSequence) return leftSequence - rightSequence;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
  return ordered.reduce((account, movement) => {
    const deltaCents = Number(movement?.deltaCents);
    if (!Number.isSafeInteger(deltaCents)) {
      throw new FamilyFinanceError(
        "invalid-ledger",
        "O extrato contém um movimento financeiro inválido.",
        500,
      );
    }
    return {
      balanceCents: account.balanceCents + deltaCents,
      childCashCents: account.childCashCents + (Number(movement?.childCashDeltaCents) || 0),
      ledgerSequence: Math.max(account.ledgerSequence, Number(movement?.sequence) || 0),
    };
  }, { balanceCents: 0, childCashCents: 0, ledgerSequence: 0 });
}

function enrichPositions(positionRows, quotes) {
  const quotesById = new Map(quotes.map((quote) => [quote.instrumentId || quote.id, quote]));
  return positionRows.map((position) => {
    const quote = quotesById.get(position.instrumentId || position.id) || null;
    const quantityMicros = Number(position.quantityMicros) || 0;
    const marketValueCents = quote?.priceCents
      ? Math.round((quantityMicros * quote.priceCents) / MICROS_PER_UNIT)
      : 0;
    const costBasisCents = Number(position.costBasisCents) || 0;
    return {
      ...position,
      quantityMicros,
      costBasisCents,
      marketValueCents,
      unrealizedPnlCents: marketValueCents - costBasisCents,
      quote: quote ? quoteSnapshot(quote) : null,
    };
  });
}

async function getFamilyFinanceSnapshot({ firestore, actor, childId, now = new Date() }) {
  const targetChildId = normalizeChildId(childId);
  assertChildAccess(actor, targetChildId);
  const snapshotAt = nowDate(now);
  const accountDocument = accountRef(firestore, targetChildId);
  let accountSnapshot = await accountDocument.get();
  if (!docExists(accountSnapshot)) {
    await accountDocument.set(defaultAccount(targetChildId, snapshotAt));
    accountSnapshot = await accountDocument.get();
  }

  const [requestsSnapshot, ledgerSnapshot, vaultsSnapshot, positionsSnapshot, goalSnapshot, quoteData, auditSnapshot] = await Promise.all([
    childCollection(firestore, targetChildId, "requests").orderBy("createdAt", "desc").limit(250).get(),
    childCollection(firestore, targetChildId, "ledger").orderBy("sequence", "desc").limit(500).get(),
    childCollection(firestore, targetChildId, "vaults").get(),
    childCollection(firestore, targetChildId, "positions").get(),
    childCollection(firestore, targetChildId, "goals").doc("current").get(),
    getQuotesSnapshot(firestore),
    actor.role === "parent"
      ? firestore.collection(AUDIT_COLLECTION).where("childId", "==", targetChildId).limit(1000).get()
      : Promise.resolve({ docs: [] }),
  ]);

  const accountData = normalizeAccountData(targetChildId, accountSnapshot.data(), snapshotAt);
  const allRequests = requestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const requests = actor.role === "child"
    ? allRequests.filter((request) => isRejectedVisibleToChild(request, snapshotAt))
    : allRequests;
  const movements = ledgerSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const vaults = vaultsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const positions = enrichPositions(
    positionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    quoteData.quotes,
  );
  const activeVaultCents = vaults
    .filter((vault) => vault.status === "active")
    .reduce((sum, vault) => sum + (Number(vault.principalCents) || 0), 0);
  const marketCents = positions.reduce((sum, position) => sum + position.marketValueCents, 0);
  const pending = pendingSummary(requests);
  const cash = accountCashBreakdown(accountData);
  const projectedCash = projectPendingAccount(accountData, requests);
  const goal = goalSnapshot.exists ? { id: goalSnapshot.id, ...goalSnapshot.data() } : null;
  const goalReservedCents = Math.max(0, Number(goal?.reservedCents) || 0);
  const auditEvents = auditSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => asDate(b.occurredAt, new Date(0)) - asDate(a.occurredAt, new Date(0)));
  const balanceCents = cash.balanceCents;
  const debtCents = cash.debtCents;
  const availableCents = cash.availableCents;
  const projectedBalanceCents = projectedCash.balanceCents;
  const account = {
    childId: targetChildId,
    displayName: CHILDREN[targetChildId].name,
    currency: CURRENCY,
    balanceCents,
    rawBalanceCents: balanceCents,
    debtCents,
    availableCents,
    parentHeldCents: cash.parentHeldCents,
    childCashCents: cash.childCashCents,
    parentCustodyNetCents: cash.parentCustodyNetCents,
    projectedBalanceCents,
    projectedAvailableCents: projectedCash.availableCents,
    projectedDebtCents: projectedCash.debtCents,
    projectedParentHeldCents: projectedCash.parentHeldCents,
    projectedChildCashCents: projectedCash.childCashCents,
    pendingCents: pending.pendingIncomingCents
      + pending.pendingOutgoingCents
      + pending.pendingCashWithdrawalCents
      + pending.pendingCashReturnCents,
    ...pending,
    vaultCents: activeVaultCents,
    marketCents,
    goalReservedCents,
    totalCents: balanceCents + goalReservedCents + activeVaultCents + marketCents,
    updatedAt: accountData.updatedAt,
  };
  const products = VAULT_PRODUCTS.map((product) => ({
    ...product,
    annualRatePct: product.annualRateBps / 100,
    interestFormula: "ACT/365, arredondado ao cêntimo no fim",
    earlyWithdrawal: "capital_only",
  }));
  return serializeForJson({
    childId: targetChildId,
    child: { ...CHILDREN[targetChildId], uid: undefined },
    account,
    requests,
    movements,
    vaults,
    termPositions: vaults,
    positions,
    marketPositions: positions,
    products,
    instruments: quoteData.instruments,
    quotes: quoteData.quotes,
    quoteHistory: quoteData.quoteHistory,
    quoteUpdatedAt: quoteData.quoteUpdatedAt,
    goal,
    goals: goal ? [goal] : [],
    charts: buildCharts(movements),
    monthlySummary: buildMonthlySummary(movements, snapshotAt),
    auditEvents,
    permissions: {
      canCreateRequest: true,
      canApprove: actor.role === "parent",
      canRefreshQuotes: actor.role === "parent",
    },
    generatedAt: snapshotAt,
  });
}

function getAuthorizationHeader(req) {
  if (typeof req.get === "function") return String(req.get("Authorization") || "");
  return String(req.headers?.authorization || req.headers?.Authorization || "");
}

async function authenticateFamilyRequest(req, firebaseAuth) {
  const authorization = getAuthorizationHeader(req);
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new FamilyFinanceError("unauthenticated", "Autenticação necessária.", 401);
  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    return resolveFamilyActor(decoded.uid);
  } catch (_) {
    throw new FamilyFinanceError("invalid-token", "Sessão inválida ou expirada.", 401);
  }
}

function applyFamilyCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Origin");
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_) {
    throw new FamilyFinanceError("invalid-json", "Pedido JSON inválido.");
  }
}

function canonicalAction(value) {
  const raw = String(value || "").trim();
  const aliases = {
    create_request: "createRequest",
    approve_request: "approveRequest",
    reject_request: "rejectRequest",
    cancel_request: "cancelRequest",
    early_withdraw: "earlyWithdraw",
    save_goal: "saveGoal",
    refresh_quotes: "refreshQuotes",
    parent_adjustment: "parentAdjustment",
    request_correction: "requestCorrection",
    resubmit_correction: "resubmitCorrection",
    transfer_goal_funds: "transferGoalFunds",
    reverse_movement: "reverseMovement",
    update_expense_reflection: "updateExpenseReflection",
  };
  return aliases[raw] || raw;
}

function sendFamilyError(res, error) {
  const normalized = error instanceof FamilyFinanceError
    ? error
    : new FamilyFinanceError("internal", "Ocorreu um erro nas finanças familiares.", 500);
  if (!(error instanceof FamilyFinanceError)) console.error("familyFinance error", error);
  res.status(normalized.status).json({
    ok: false,
    error: normalized.message,
    code: normalized.code,
    details: normalized.details,
  });
}

async function dispatchFamilyFinanceAction({
  firestore,
  actor,
  body,
  apiKey,
  fetchImpl = global.fetch,
  now = new Date(),
}) {
  const action = canonicalAction(body.action);
  const childId = body.childId || body.child;
  if (action === "createRequest") {
    return createFinanceRequest({
      firestore,
      actor,
      childId,
      payload: body.request || body.payload || body,
      idempotencyKey: body.idempotencyKey || body.clientRequestId,
      now,
    });
  }
  if (["decideRequest", "approveRequest", "rejectRequest"].includes(action)) {
    const decision = action === "approveRequest"
      ? "approved"
      : action === "rejectRequest"
        ? "rejected"
        : body.decision;
    return decideFinanceRequest({
      firestore,
      actor,
      childId,
      requestId: body.requestId,
      decision,
      reason: body.reason,
      now,
    });
  }
  if (action === "requestCorrection") {
    return requestFinanceCorrection({
      firestore,
      actor,
      childId,
      requestId: body.requestId,
      reason: body.reason,
      now,
    });
  }
  if (action === "resubmitCorrection") {
    return resubmitCorrectedRequest({
      firestore,
      actor,
      childId,
      requestId: body.requestId,
      payload: body.request || body.payload || body,
      idempotencyKey: body.idempotencyKey || body.clientRequestId,
      now,
    });
  }
  if (action === "cancelRequest") {
    return cancelFinanceRequest({ firestore, actor, childId, requestId: body.requestId, now });
  }
  if (action === "saveGoal") {
    return saveFinanceGoal({ firestore, actor, childId, goal: body.goal || body, now });
  }
  if (action === "transferGoalFunds") {
    return transferGoalFunds({
      firestore,
      actor,
      childId,
      direction: body.direction,
      amountCents: body.amountCents,
      idempotencyKey: body.idempotencyKey || body.clientRequestId,
      now,
    });
  }
  if (action === "earlyWithdraw") {
    return createEarlyWithdrawalRequest({
      firestore,
      actor,
      childId,
      vaultId: body.vaultId,
      idempotencyKey: body.idempotencyKey || body.clientRequestId,
      now,
    });
  }
  if (action === "parentAdjustment") {
    const adjustment = body.adjustment || body;
    return createParentAdjustment({
      firestore,
      actor,
      childId,
      deltaCents: adjustment.deltaCents,
      amountCents: adjustment.amountCents,
      kind: adjustment.kind,
      category: adjustment.category,
      note: adjustment.note,
      occurredOn: adjustment.occurredOn,
      idempotencyKey: body.idempotencyKey || adjustment.idempotencyKey,
      now,
    });
  }
  if (action === "reverseMovement") {
    return reverseLedgerMovement({
      firestore,
      actor,
      childId,
      ledgerId: body.ledgerId,
      reason: body.reason,
      now,
    });
  }
  if (action === "updateExpenseReflection") {
    return updateExpenseReflection({
      firestore,
      actor,
      childId,
      ledgerId: body.ledgerId,
      reflection: body.reflection,
      now,
    });
  }
  if (action === "refreshQuotes") {
    if (actor.role === "child") {
      return { ...(await getQuotesSnapshot(firestore)), refreshed: false, reason: "children-cache-only" };
    }
    return refreshMarketQuotes({ firestore, apiKey, actor, manual: true, now, fetchImpl });
  }
  throw new FamilyFinanceError("invalid-action", "Ação inválida.");
}

async function handleFamilyFinanceHttp({
  req,
  res,
  firestore,
  firebaseAuth,
  apiKey,
  fetchImpl = global.fetch,
  now = new Date(),
}) {
  try {
    applyFamilyCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (!["GET", "POST"].includes(req.method)) {
      throw new FamilyFinanceError("method-not-allowed", "Método não permitido.", 405);
    }
    const actor = await authenticateFamilyRequest(req, firebaseAuth);
    if (req.method === "GET") {
      const requestedChildId = req.query?.childId || req.query?.child;
      if (requestedChildId) {
        return res.status(200).json(await getFamilyFinanceSnapshot({
          firestore,
          actor,
          childId: requestedChildId,
          now,
        }));
      }
      if (actor.role === "child") {
        return res.status(200).json(await getFamilyFinanceSnapshot({
          firestore,
          actor,
          childId: actor.childId,
          now,
        }));
      }
      const children = [];
      for (const childId of Object.keys(CHILDREN)) {
        children.push(await getFamilyFinanceSnapshot({ firestore, actor, childId, now }));
      }
      return res.status(200).json({ children, generatedAt: nowDate(now).toISOString() });
    }

    const body = parseRequestBody(req);
    const result = await dispatchFamilyFinanceAction({
      firestore,
      actor,
      body,
      apiKey,
      fetchImpl,
      now,
    });
    return res.status(200).json(serializeForJson({ ok: true, ...result }));
  } catch (error) {
    return sendFamilyError(res, error);
  }
}

async function handleFamilyFinanceQuotesHttp({
  req,
  res,
  firestore,
  firebaseAuth,
  apiKey,
  fetchImpl = global.fetch,
  now = new Date(),
}) {
  try {
    applyFamilyCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (!["GET", "POST"].includes(req.method)) {
      throw new FamilyFinanceError("method-not-allowed", "Método não permitido.", 405);
    }
    const actor = await authenticateFamilyRequest(req, firebaseAuth);
    if (req.method === "GET" || actor.role === "child") {
      return res.status(200).json(serializeForJson({
        ...(await getQuotesSnapshot(firestore)),
        refreshed: false,
        reason: actor.role === "child" ? "children-cache-only" : "cache",
      }));
    }
    return res.status(200).json(serializeForJson({
      ok: true,
      ...(await refreshMarketQuotes({
        firestore,
        apiKey,
        actor,
        manual: true,
        now,
        fetchImpl,
      })),
    }));
  } catch (error) {
    return sendFamilyError(res, error);
  }
}

module.exports = {
  REGION,
  TIME_ZONE,
  FILIPA_UID,
  CHILDREN,
  VAULT_PRODUCTS,
  MARKET_INSTRUMENTS,
  FamilyFinanceError,
  resolveFamilyActor,
  normalizeChildId,
  normalizeRequestPayload,
  calculateVaultInterestCents,
  calculateMarketBuy,
  calculateMarketSell,
  buildApprovedMutation,
  buildCharts,
  buildMonthlySummary,
  pendingSummary,
  reconstructAccountFromLedger,
  parseAlphaVantageQuote,
  parseEcbDailyXml,
  createFinanceRequest,
  decideFinanceRequest,
  requestFinanceCorrection,
  resubmitCorrectedRequest,
  cancelFinanceRequest,
  createEarlyWithdrawalRequest,
  createParentAdjustment,
  saveFinanceGoal,
  transferGoalFunds,
  reverseLedgerMovement,
  updateExpenseReflection,
  matureVault,
  matureDueVaults,
  refreshMarketQuotes,
  getQuotesSnapshot,
  getFamilyFinanceSnapshot,
  handleFamilyFinanceHttp,
  handleFamilyFinanceQuotesHttp,
};
