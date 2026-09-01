const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CHILDREN,
  FamilyFinanceError,
  VAULT_PRODUCTS,
  buildApprovedMutation,
  buildCharts,
  buildMonthlySummary,
  calculateMarketBuy,
  calculateMarketSell,
  calculateVaultInterestCents,
  createFinanceRequest,
  createParentAdjustment,
  decideFinanceRequest,
  normalizeRequestPayload,
  parseAlphaVantageQuote,
  parseEcbDailyXml,
  pendingSummary,
  reconstructAccountFromLedger,
  requestFinanceCorrection,
  resubmitCorrectedRequest,
  resolveFamilyActor,
  reverseLedgerMovement,
  transferGoalFunds,
  updateExpenseReflection,
} = require("./family-finance");

const now = new Date("2026-08-29T12:00:00.000Z");
const childActor = resolveFamilyActor(CHILDREN.francisca.uid);
const parentActor = resolveFamilyActor("parent-test-uid");

function account(balanceCents = 0, childCashCents = 0) {
  return {
    childId: "francisca",
    balanceCents,
    childCashCents,
    ledgerSequence: 4,
  };
}

function request(kind, amountCents, extra = {}) {
  return {
    id: `request-${kind}`,
    childId: "francisca",
    kind,
    amountCents,
    category: kind === "expense" ? "books" : "gift",
    note: "Teste",
    occurredOn: "2026-08-29",
    createdByUid: childActor.uid,
    ...extra,
  };
}

class MemoryDocumentReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
    this.id = path.split("/").at(-1);
  }

  collection(name) {
    return new MemoryCollectionReference(this.firestore, `${this.path}/${name}`);
  }

  async get() {
    return this.firestore.snapshot(this);
  }

  async set(value, options = {}) {
    this.firestore.write(this, value, options);
  }
}

class MemoryCollectionReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
  }

  doc(id = `auto_${++this.firestore.autoId}`) {
    return new MemoryDocumentReference(this.firestore, `${this.path}/${id}`);
  }
}

class MemoryFirestore {
  constructor() {
    this.autoId = 0;
    this.documents = new Map();
  }

  collection(name) {
    return new MemoryCollectionReference(this, name);
  }

  snapshot(reference) {
    const value = this.documents.get(reference.path);
    return {
      id: reference.id,
      exists: value !== undefined,
      data: () => value,
    };
  }

  write(reference, value, options = {}) {
    const previous = this.documents.get(reference.path) || {};
    this.documents.set(reference.path, options.merge ? { ...previous, ...value } : { ...value });
  }

  async runTransaction(callback) {
    const transaction = {
      get: async reference => this.snapshot(reference),
      set: (reference, value, options) => this.write(reference, value, options),
    };
    return callback(transaction);
  }

  data(path) {
    return this.documents.get(path);
  }
}

async function seed(firestore, path, value) {
  const pieces = path.split("/");
  let collection = firestore.collection(pieces.shift());
  let reference = collection.doc(pieces.shift());
  while (pieces.length) {
    collection = reference.collection(pieces.shift());
    reference = collection.doc(pieces.shift());
  }
  await reference.set(value);
  return reference;
}

test("reconhece as duas crianças e mantém outros utilizadores no papel parental", () => {
  assert.deepEqual(childActor, {
    uid: CHILDREN.francisca.uid,
    role: "child",
    childId: "francisca",
    isFilipa: false,
  });
  assert.equal(resolveFamilyActor(CHILDREN.leonor.uid).childId, "leonor");
  assert.equal(parentActor.role, "parent");
});

test("cada filha é bloqueada antes de ler ou alterar a conta da irmã", async () => {
  const firestore = new MemoryFirestore();
  for (const [actor, childId] of [
    [childActor, "leonor"],
    [resolveFamilyActor(CHILDREN.leonor.uid), "francisca"],
  ]) {
    await assert.rejects(createFinanceRequest({
      firestore,
      actor,
      childId,
      payload: { kind: "income", amountCents: 100, category: "gift", occurredOn: "2026-08-29" },
      now,
    }), error => error instanceof FamilyFinanceError && error.code === "forbidden");
  }
  assert.equal(firestore.documents.size, 0);
});

test("disponibiliza o cofre educativo de um dia", () => {
  assert.equal(VAULT_PRODUCTS.some(product => product.days === 1), true);
  const normalized = normalizeRequestPayload({
    kind: "vault_open",
    amountCents: 1000,
    category: "vault",
    termDays: 1,
    occurredOn: "2026-08-29",
  }, now);
  assert.equal(normalized.termDays, 1);
});

test("preserva a reflexão necessidade/desejo apenas em despesas", () => {
  const expense = normalizeRequestPayload({
    kind: "expense",
    amountCents: 850,
    category: "books",
    reflection: "want",
    occurredOn: "2026-08-29",
  }, now);
  assert.equal(expense.reflection, "want");

  const income = normalizeRequestPayload({
    kind: "income",
    amountCents: 850,
    category: "gift",
    reflection: "want",
    occurredOn: "2026-08-29",
  }, now);
  assert.equal("reflection" in income, false);
});

test("aprova uma despesa que cria saldo negativo e regista quanto fica a dever", () => {
  const mutation = buildApprovedMutation({
    request: request("expense", 2500),
    account: account(1000),
    now,
    actor: parentActor,
  });
  assert.equal(mutation.accountPatch.balanceCents, -1500);
  assert.equal(mutation.ledger.deltaCents, -2500);
  assert.equal(mutation.ledger.balanceAfterCents, -1500);
});

test("uma entrada amortiza primeiro um saldo negativo", () => {
  const mutation = buildApprovedMutation({
    request: request("income", 900),
    account: account(-1500),
    now,
    actor: parentActor,
  });
  assert.equal(mutation.accountPatch.balanceCents, -600);
});

test("não permite abrir um cofre nem comprar mercado sem saldo suficiente", () => {
  assert.throws(() => buildApprovedMutation({
    request: request("vault_open", 100, { termDays: 30, category: "vault" }),
    account: account(-1),
    now,
    actor: parentActor,
  }), error => error instanceof FamilyFinanceError && error.code === "insufficient-balance");

  assert.throws(() => buildApprovedMutation({
    request: request("market_buy", 100, { instrumentId: "VWCE", category: "market" }),
    account: account(50),
    quote: { instrumentId: "VWCE", symbol: "VWCE", priceCents: 10000 },
    now,
    actor: parentActor,
  }), error => error instanceof FamilyFinanceError && error.code === "insufficient-balance");
});

test("resume pendentes sem misturar entradas e saídas", () => {
  assert.deepEqual(pendingSummary([
    { status: "pending", kind: "income", amountCents: 1000 },
    { status: "pending", kind: "expense", amountCents: 250 },
    { status: "pending", kind: "market_buy", amountCents: 500 },
    { status: "approved", kind: "expense", amountCents: 999 },
  ]), {
    pendingIncomingCents: 1000,
    pendingOutgoingCents: 750,
    pendingNetCents: 250,
    pendingCashWithdrawalCents: 0,
    pendingCashReturnCents: 0,
  });
});

test("reconstrói o saldo cacheado a partir do ledger, incluindo estornos", () => {
  assert.deepEqual(reconstructAccountFromLedger([
    { id: "income", sequence: 1, deltaCents: 2000 },
    { id: "expense", sequence: 2, deltaCents: -1500 },
    { id: "reversal", sequence: 3, deltaCents: 1500, reversalOfLedgerId: "expense" },
    { id: "goal", sequence: 4, deltaCents: -400 },
  ]), {
    balanceCents: 1600,
    childCashCents: 0,
    ledgerSequence: 4,
  });
});

test("levantar e devolver dinheiro físico muda apenas o local onde está guardado", () => {
  const withdrawal = buildApprovedMutation({
    request: request("cash_withdrawal", 1000, { category: "cash_transfer" }),
    account: account(5000),
    now,
    actor: parentActor,
  });
  assert.equal(withdrawal.accountPatch.balanceCents, 5000);
  assert.equal(withdrawal.accountPatch.childCashCents, 1000);
  assert.equal(withdrawal.ledger.deltaCents, 0);
  assert.equal(withdrawal.ledger.parentHeldAfterCents, 4000);

  const returned = buildApprovedMutation({
    request: request("cash_return", 400, { category: "cash_transfer" }),
    account: account(5000, 1000),
    now,
    actor: parentActor,
  });
  assert.equal(returned.accountPatch.balanceCents, 5000);
  assert.equal(returned.accountPatch.childCashCents, 600);
  assert.equal(returned.ledger.parentHeldAfterCents, 4400);
});

test("uma compra paga pela filha reduz o dinheiro físico e não pode excedê-lo", () => {
  const spent = buildApprovedMutation({
    request: request("expense", 600, { cashLocation: "child" }),
    account: account(5000, 1000),
    now,
    actor: parentActor,
  });
  assert.equal(spent.accountPatch.balanceCents, 4400);
  assert.equal(spent.accountPatch.childCashCents, 400);
  assert.equal(spent.ledger.childCashDeltaCents, -600);

  assert.throws(() => buildApprovedMutation({
    request: request("expense", 1001, { cashLocation: "child" }),
    account: account(5000, 1000),
    now,
    actor: parentActor,
  }), error => error instanceof FamilyFinanceError && error.code === "insufficient-child-cash");
});

test("dinheiro com a filha não pode ser investido antes de voltar aos pais", () => {
  assert.throws(() => buildApprovedMutation({
    request: request("vault_open", 4500, { termDays: 30, category: "vault" }),
    account: account(5000, 1000),
    now,
    actor: parentActor,
  }), error => error instanceof FamilyFinanceError && error.code === "insufficient-balance");
});

test("dívida aos pais pode coexistir com dinheiro físico nas mãos da filha", () => {
  const spent = buildApprovedMutation({
    request: request("expense", 2000, { cashLocation: "parents" }),
    account: account(1000, 500),
    now,
    actor: parentActor,
  });
  assert.equal(spent.accountPatch.balanceCents, -1000);
  assert.equal(spent.accountPatch.childCashCents, 500);
  assert.equal(spent.ledger.debtAfterCents, 1500);
});

test("os gráficos contam consumo e juros, mas não transferências de investimento", () => {
  assert.deepEqual(buildCharts([
    { kind: "income", category: "gift", deltaCents: 1000 },
    { kind: "expense", category: "books", deltaCents: -400 },
    { kind: "market_buy", category: "market", deltaCents: -500 },
    { kind: "market_sell", category: "market", deltaCents: 650, realizedPnlCents: 150 },
    { kind: "market_sell", category: "market", deltaCents: 400, realizedPnlCents: -50 },
    { kind: "vault_maturity", interestCents: 7, deltaCents: 1007 },
  ]), {
    incomeByCategory: { gift: 1000, investment_realized_gain: 150, investment_interest: 7 },
    expenseByCategory: { books: 400, investment_realized_loss: 50 },
  });
});

test("cálculos de prazo e frações de mercado usam cêntimos e micros", () => {
  assert.equal(calculateVaultInterestCents(10000, 500, 365), 500);
  assert.deepEqual(calculateMarketBuy(2500, 10000), {
    quantityMicros: 250000,
    executedAmountCents: 2500,
  });
  assert.deepEqual(calculateMarketSell({
    amountCents: 2500,
    priceCents: 10000,
    heldQuantityMicros: 500000,
  }), {
    quantityMicros: 250000,
    proceedsCents: 2500,
  });
});

test("interpreta respostas dos fornecedores de cotação e câmbio", () => {
  assert.deepEqual(parseAlphaVantageQuote({
    "Global Quote": {
      "05. price": "123.45",
      "07. latest trading day": "2026-08-28",
    },
  }, "AAPL"), {
    apiSymbol: "AAPL",
    nativePrice: 123.45,
    marketAsOf: "2026-08-28",
  });
  assert.deepEqual(parseEcbDailyXml(
    "<Cube><Cube time='2026-08-28'><Cube currency='USD' rate='1.1672'/></Cube></Cube>",
  ), {
    usdPerEur: 1.1672,
    asOf: "2026-08-28",
    source: "ECB euro foreign exchange reference rates",
  });
});

test("uma entrada percorre pendente, correção, reenvio e validação sem alterar o saldo antes do fim", async () => {
  const firestore = new MemoryFirestore();
  const created = await createFinanceRequest({
    firestore,
    actor: childActor,
    childId: "francisca",
    payload: { kind: "income", amountCents: 1000, category: "gift", occurredOn: "2026-08-29" },
    idempotencyKey: "income-correction-flow",
    now,
  });
  const requestId = created.request.id;
  assert.equal(created.request.status, "pending");
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 0);

  const correction = await requestFinanceCorrection({
    firestore,
    actor: parentActor,
    childId: "francisca",
    requestId,
    reason: "O valor deve ser confirmado.",
    now: new Date("2026-08-29T12:01:00Z"),
  });
  assert.equal(correction.request.status, "correction_required");
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 0);

  const resubmitted = await resubmitCorrectedRequest({
    firestore,
    actor: childActor,
    childId: "francisca",
    requestId,
    payload: { kind: "income", amountCents: 1200, category: "gift", occurredOn: "2026-08-29" },
    idempotencyKey: "income-correction-resubmitted",
    now: new Date("2026-08-29T12:02:00Z"),
  });
  assert.equal(resubmitted.request.status, "pending");
  assert.equal(resubmitted.request.revision, 1);
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 0);

  const validated = await decideFinanceRequest({
    firestore,
    actor: parentActor,
    childId: "francisca",
    requestId,
    decision: "approved",
    now: new Date("2026-08-29T12:03:00Z"),
  });
  assert.equal(validated.request.status, "approved");
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 1200);
  assert.equal(firestore.data(`family_finance_accounts/francisca/ledger/${requestId}`).deltaCents, 1200);
});

test("uma reprovação exige motivo e não altera saldo nem cria ledger", async () => {
  const firestore = new MemoryFirestore();
  const created = await createFinanceRequest({
    firestore,
    actor: childActor,
    childId: "francisca",
    payload: { kind: "expense", amountCents: 350, category: "books", occurredOn: "2026-08-29" },
    idempotencyKey: "reject-flow",
    now,
  });
  await assert.rejects(decideFinanceRequest({
    firestore,
    actor: parentActor,
    childId: "francisca",
    requestId: created.request.id,
    decision: "rejected",
    reason: "",
    now,
  }), error => error instanceof FamilyFinanceError && error.code === "reason-required");

  const rejected = await decideFinanceRequest({
    firestore,
    actor: parentActor,
    childId: "francisca",
    requestId: created.request.id,
    decision: "rejected",
    reason: "Registo duplicado.",
    now,
  });
  assert.equal(rejected.request.status, "rejected");
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 0);
  assert.equal(firestore.data(`family_finance_accounts/francisca/ledger/${created.request.id}`), undefined);
});

test("uma nova entrada separa o valor que paga dívida do valor disponível", () => {
  const mutation = buildApprovedMutation({
    request: request("income", 2000),
    account: account(-1500),
    now,
    actor: parentActor,
  });
  assert.equal(mutation.ledger.debtPaidCents, 1500);
  assert.equal(mutation.ledger.availableAddedCents, 500);
  assert.equal(mutation.accountPatch.balanceCents, 500);
});

test("reservar e libertar um objetivo muda o disponível mas não o património", async () => {
  const firestore = new MemoryFirestore();
  await seed(firestore, "family_finance_accounts/francisca", account(5000));
  await seed(firestore, "family_finance_accounts/francisca/goals/current", {
    childId: "francisca",
    title: "Bicicleta",
    targetCents: 10000,
    reservedCents: 0,
  });

  await transferGoalFunds({
    firestore,
    actor: childActor,
    childId: "francisca",
    direction: "reserve",
    amountCents: 1800,
    idempotencyKey: "goal-reserve",
    now,
  });
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 3200);
  assert.equal(firestore.data("family_finance_accounts/francisca/goals/current").reservedCents, 1800);
  assert.equal(3200 + 1800, 5000);

  await transferGoalFunds({
    firestore,
    actor: childActor,
    childId: "francisca",
    direction: "release",
    amountCents: 300,
    idempotencyKey: "goal-release",
    now: new Date("2026-08-29T12:01:00Z"),
  });
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 3500);
  assert.equal(firestore.data("family_finance_accounts/francisca/goals/current").reservedCents, 1500);
  assert.equal(3500 + 1500, 5000);
});

test("cofre aprovado bloqueia capital e o levantamento antecipado devolve apenas o capital", () => {
  const opened = buildApprovedMutation({
    request: request("vault_open", 3000, { termDays: 30, category: "vault" }),
    account: account(10000),
    now,
    actor: parentActor,
  });
  assert.equal(opened.accountPatch.balanceCents, 7000);
  assert.equal(opened.vaultPatch.principalCents, 3000);
  assert.equal(opened.vaultPatch.expectedInterestCents >= 0, true);

  const withdrawn = buildApprovedMutation({
    request: request("vault_early_withdraw", 3000, {
      id: "withdraw-vault",
      category: "vault",
      vaultId: opened.vaultPatch.id,
    }),
    account: account(7000),
    vault: opened.vaultPatch,
    now,
    actor: parentActor,
  });
  assert.equal(withdrawn.accountPatch.balanceCents, 10000);
  assert.equal(withdrawn.ledger.interestPaidCents, 0);
  assert.equal(withdrawn.vaultPatch.status, "withdrawn_early");
});

test("compra e venda de mercado preservam custo médio e registam ganhos e perdas realizados", () => {
  const bought = buildApprovedMutation({
    request: request("market_buy", 10000, { id: "buy", instrumentId: "VWCE", category: "market" }),
    account: account(20000),
    quote: { instrumentId: "VWCE", symbol: "VWCE", priceCents: 10000 },
    now,
    actor: parentActor,
  });
  assert.equal(bought.positionPatch.quantityMicros, 1000000);
  assert.equal(bought.positionPatch.costBasisCents, 10000);

  const gain = buildApprovedMutation({
    request: request("market_sell", 6000, { id: "sell-gain", instrumentId: "VWCE", category: "market" }),
    account: account(10000),
    position: bought.positionPatch,
    quote: { instrumentId: "VWCE", symbol: "VWCE", priceCents: 12000 },
    now,
    actor: parentActor,
  });
  assert.equal(gain.ledger.realizedPnlCents, 1000);
  assert.equal(gain.positionPatch.quantityMicros, 500000);
  assert.equal(gain.positionPatch.costBasisCents, 5000);

  const loss = buildApprovedMutation({
    request: request("market_sell", 4000, { id: "sell-loss", instrumentId: "VWCE", category: "market" }),
    account: account(16000),
    position: gain.positionPatch,
    quote: { instrumentId: "VWCE", symbol: "VWCE", priceCents: 8000 },
    now,
    actor: parentActor,
  });
  assert.equal(loss.ledger.realizedPnlCents, -1000);
  assert.equal(loss.positionPatch.quantityMicros, 0);
  assert.equal(loss.positionPatch.costBasisCents, 0);
  assert.equal(loss.positionPatch.realizedPnlCents, 0);
});

test("um movimento criado pelos pais fica validado imediatamente", async () => {
  const firestore = new MemoryFirestore();
  const result = await createParentAdjustment({
    firestore,
    actor: parentActor,
    childId: "francisca",
    deltaCents: 2500,
    category: "gift",
    note: "Prenda",
    occurredOn: "2026-08-29",
    idempotencyKey: "parent-adjustment",
    now,
  });
  assert.equal(result.request.status, "approved");
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 2500);
  assert.equal(firestore.data(`family_finance_accounts/francisca/ledger/${result.request.id}`).deltaCents, 2500);
});

test("um estorno mantém o original, cria o inverso e deixa auditoria", async () => {
  const firestore = new MemoryFirestore();
  const original = await createParentAdjustment({
    firestore,
    actor: parentActor,
    childId: "francisca",
    deltaCents: 900,
    category: "gift",
    note: "Duplicado",
    occurredOn: "2026-08-29",
    idempotencyKey: "reversal-original",
    now,
  });
  const ledgerId = original.ledger.id;
  const reversed = await reverseLedgerMovement({
    firestore,
    actor: parentActor,
    childId: "francisca",
    ledgerId,
    reason: "Movimento duplicado.",
    now: new Date("2026-08-29T12:05:00Z"),
  });
  assert.equal(firestore.data(`family_finance_accounts/francisca/ledger/${ledgerId}`).deltaCents, 900);
  assert.equal(reversed.ledger.deltaCents, -900);
  assert.equal(reversed.ledger.reversalOfLedgerId, ledgerId);
  assert.equal(firestore.data("family_finance_accounts/francisca").balanceCents, 0);
  assert.equal(firestore.data(`family_finance_audit/ledger_${ledgerId}_reversed`).event, "ledger.reversed");
});

test("alterar necessidade/desejo não muda valores e fica auditado", async () => {
  const firestore = new MemoryFirestore();
  await seed(firestore, "family_finance_accounts/francisca/ledger/expense-reflection", {
    id: "expense-reflection",
    requestId: "expense-reflection",
    childId: "francisca",
    kind: "expense",
    amountCents: 500,
    deltaCents: -500,
    reflection: "need",
  });
  const changed = await updateExpenseReflection({
    firestore,
    actor: childActor,
    childId: "francisca",
    ledgerId: "expense-reflection",
    reflection: "want",
    now,
  });
  assert.equal(changed.movement.reflection, "want");
  assert.equal(changed.movement.deltaCents, -500);
  assert.equal(changed.movement.reflectionHistory[0].from, "need");
  assert.equal(changed.movement.reflectionHistory[0].to, "want");
  const audit = [...firestore.documents.values()].find(item => item.event === "expense.reflection_changed");
  assert.equal(audit.details.ledgerId, "expense-reflection");
});

test("o resumo mensal separa consumo, transferências, juros e resultado realizado", () => {
  const summary = buildMonthlySummary([
    { kind: "income", category: "gift", deltaCents: 5000, occurredOn: "2026-08-02" },
    { kind: "expense", category: "books", reflection: "need", deltaCents: -1000, occurredOn: "2026-08-03" },
    { kind: "expense", category: "toys", reflection: "want", deltaCents: -500, occurredOn: "2026-08-04" },
    { kind: "goal_reserve", deltaCents: -1200, occurredOn: "2026-08-05" },
    { kind: "vault_open", deltaCents: -1000, occurredOn: "2026-08-06" },
    { kind: "market_buy", deltaCents: -800, occurredOn: "2026-08-07" },
    { kind: "vault_maturity", interestCents: 10, deltaCents: 1010, occurredOn: "2026-08-20" },
    { kind: "market_sell", realizedPnlCents: 150, deltaCents: 950, occurredOn: "2026-08-21" },
    { kind: "cash_withdrawal", amountCents: 1000, deltaCents: 0, occurredOn: "2026-08-22" },
    { kind: "cash_return", amountCents: 300, deltaCents: 0, occurredOn: "2026-08-23" },
  ], now);
  assert.equal(summary.receivedCents, 5000);
  assert.equal(summary.spentCents, 1500);
  assert.equal(summary.goalReservedCents, 1200);
  assert.equal(summary.vaultPlacedCents, 1000);
  assert.equal(summary.investedCents, 800);
  assert.equal(summary.interestReceivedCents, 10);
  assert.equal(summary.realizedNetCents, 150);
  assert.equal(summary.needSpentCents, 1000);
  assert.equal(summary.wantSpentCents, 500);
  assert.equal(summary.cashTakenCents, 1000);
  assert.equal(summary.cashReturnedCents, 300);
});
