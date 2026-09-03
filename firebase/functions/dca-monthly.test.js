const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateDailyInterest,
  fetchDailyCloseWithFallback,
  getMonthlyContributions,
  previousMonthRange,
  selectLastClose,
  normalizeAutomation,
  validateSufficientBalance,
} = require("./dca-monthly");

test("usa AGGH.DE como fallback quando EUNA.DE não devolve cotação", async () => {
  const attempts = [];
  const result = await fetchDailyCloseWithFallback(
    "test-key",
    ["EUNA.DE", "AGGH.DE"],
    new Date("2026-09-30T23:59:59Z"),
    async (_key, symbol) => {
      attempts.push(symbol);
      if (symbol === "EUNA.DE") throw new Error("sem dados");
      return { date: "2026-09-30", price: 48.25 };
    }
  );
  assert.deepEqual(attempts, ["EUNA.DE", "AGGH.DE"]);
  assert.deepEqual(result, { date: "2026-09-30", price: 48.25, symbol: "AGGH.DE" });
});

test("identifica o mês anterior antes de abrir o novo mês", () => {
  const range = previousMonthRange(new Date("2026-08-01T00:10:00Z"));
  assert.equal(range.id, "2026-07");
  assert.equal(range.currentId, "2026-08");
  assert.equal(range.end.toISOString(), "2026-07-31T23:59:59.999Z");
});

test("altera as contribuições mensais em outubro de 2026", () => {
  assert.deepEqual(getMonthlyContributions("2026-09"), { vwce: 120, aggh: 30 });
  assert.deepEqual(getMonthlyContributions("2026-10"), { vwce: 150, aggh: 50 });
  assert.deepEqual(getMonthlyContributions("2040-09"), { vwce: 150, aggh: 50 });
});

test("a configuração explícita altera a automação sem alterar o plano histórico", () => {
  const automation = normalizeAutomation({
    enabled: true, effectiveFrom: "2027-01", vwceAmountCents: 17500, agghAmountCents: 7500,
    annualInterestRate: 0.025, timezone: "Europe/Lisbon", day: 1, time: "01:10",
  });
  assert.deepEqual(getMonthlyContributions("2026-12", automation), { vwce: 120, aggh: 30 });
  assert.deepEqual(getMonthlyContributions("2027-01", automation), { vwce: 175, aggh: 75 });
});

test("a automação bloqueia saldo insuficiente sem produzir saldo negativo", () => {
  assert.throws(() => validateSufficientBalance(199.99, { vwce: 150, aggh: 50 }), (error) => {
    assert.equal(error.code, "insufficient_balance");
    assert.equal(error.requiredBalance, 200);
    return true;
  });
  assert.deepEqual(validateSufficientBalance(200, { vwce: 150, aggh: 50 }), { availableBalance: 200, requiredBalance: 200 });
});

test("o juro mensal aceita a taxa configurada", () => {
  const result = calculateDailyInterest(1000, [], new Date("2026-07-01T00:00:00Z"), new Date("2026-07-31T23:59:59Z"), 0.03);
  assert.equal(result.interest, Math.round(31 * 1000 * 0.03 / 365 * 100) / 100);
});

test("calcula juro diário e respeita uma alteração de saldo a meio do mês", () => {
  const result = calculateDailyInterest(1000, [{
    type: "set_balance",
    balance: 2000,
    effectiveAt: new Date("2026-07-16T10:00:00Z"),
  }], new Date("2026-07-01T00:00:00Z"), new Date("2026-07-31T23:59:59Z"));
  const expected = 15 * 1000 * 0.02 / 365 + 16 * 2000 * 0.02 / 365;
  assert.equal(result.interest, Math.round(expected * 100) / 100);
  assert.equal(result.closingBalanceBeforeInterest, 2000);
});

test("usa a última cotação disponível antes do fim do mês", () => {
  const quote = selectLastClose({
    "2026-08-03": { "4. close": "170" },
    "2026-07-31": { "4. close": "168.20" },
    "2026-07-30": { "4. close": "167" },
  }, new Date("2026-07-31T23:59:59Z"));
  assert.deepEqual(quote, { date: "2026-07-31", price: 168.2 });
});
