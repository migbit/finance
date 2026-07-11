const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateDailyInterest, previousMonthRange, selectLastClose } = require("./dca-monthly");

test("identifica o mês anterior antes de abrir o novo mês", () => {
  const range = previousMonthRange(new Date("2026-08-01T00:10:00Z"));
  assert.equal(range.id, "2026-07");
  assert.equal(range.currentId, "2026-08");
  assert.equal(range.end.toISOString(), "2026-07-31T23:59:59.999Z");
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
