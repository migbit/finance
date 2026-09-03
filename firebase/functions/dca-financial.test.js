const assert = require('node:assert/strict');
const test = require('node:test');
const finance = require('../../js/dca-financial.js');

const base = {
  date: '2026-09-03',
  totalAmount: 100,
  allocationMode: 'manual_percentage',
  vwcePercentage: 75,
  agghPercentage: 25,
  vwcePrice: 100,
  agghPrice: 50,
  fundingSource: 'external_cash',
  currentShares: { vwce: 1, aggh: 2 },
  currentBalance: 500,
  currentVWCE: 100,
  currentAGGH: 100,
  vwceTarget: 75,
  agghTarget: 25
};

test('reforço manual simples 75/25 mantém cêntimos e calcula unidades', () => {
  const result = finance.buildReinforcementPreview(base);
  assert.equal(result.vwceAmount, 75);
  assert.equal(result.agghAmount, 25);
  assert.equal(result.vwceQuantity, 0.75);
  assert.equal(result.agghQuantity, 0.5);
});

test('reforço inteligente envia tudo para AGGH quando VWCE está overweight', () => {
  const result = finance.calculateReinforcementAllocation({ totalAmount: 200, currentVWCE: 750, currentAGGH: 50, vwceTarget: 75, agghTarget: 25 });
  assert.deepEqual([result.vwceAmount, result.agghAmount], [0, 200]);
});

test('reforço inteligente envia tudo para VWCE quando AGGH está overweight', () => {
  const result = finance.calculateReinforcementAllocation({ totalAmount: 200, currentVWCE: 550, currentAGGH: 250, vwceTarget: 75, agghTarget: 25 });
  assert.deepEqual([result.vwceAmount, result.agghAmount], [200, 0]);
});

test('permite reforço 100% num ETF', () => {
  const result = finance.buildReinforcementPreview({ ...base, vwcePercentage: 100, agghPercentage: 0 });
  assert.equal(result.vwceAmount, 100);
  assert.equal(result.agghAmount, 0);
});

test('reforço pelo saldo reduz a liquidez', () => {
  const result = finance.buildReinforcementPreview({ ...base, fundingSource: 'trade_republic_balance' });
  assert.equal(result.balanceImpact, -100);
  assert.equal(result.afterValues.balance, 400);
});

test('reforço externo não reduz o saldo', () => {
  const result = finance.buildReinforcementPreview(base);
  assert.equal(result.balanceImpact, 0);
  assert.equal(result.afterValues.balance, 500);
});

test('bloqueia saldo insuficiente', () => {
  assert.throws(() => finance.buildReinforcementPreview({ ...base, fundingSource: 'trade_republic_balance', currentBalance: 99 }), /Saldo insuficiente/);
});

test('bloqueia reforço sem preço válido da Alpha Vantage ou manual', () => {
  assert.throws(() => finance.buildReinforcementPreview({ ...base, vwcePrice: null }), /preço válido para VWCE/);
});

test('aceita preço manual e preserva precisão de oito casas nas unidades', () => {
  const result = finance.buildReinforcementPreview({ ...base, vwcePrice: 123.456789, agghPrice: 49.876543 });
  assert.equal(result.vwceQuantity, 0.60750001);
  assert.equal(result.agghQuantity, 0.50123763);
});

test('anulação reverte unidades e apenas restaura saldo quando essa foi a origem', () => {
  const balanceResult = finance.calculateReinforcementReversal({
    shares: { vwce: 2, aggh: 3 }, balance: 400,
    reinforcement: { status: 'active', vwceQuantity: 0.75, agghQuantity: 0.5, totalAmount: 100, fundingSource: 'trade_republic_balance' }
  });
  assert.deepEqual(balanceResult, { shares: { vwce: 1.25, aggh: 2.5 }, balance: 500 });
  const externalResult = finance.calculateReinforcementReversal({
    shares: { vwce: 2, aggh: 3 }, balance: 400,
    reinforcement: { status: 'active', vwceQuantity: 0.75, agghQuantity: 0.5, totalAmount: 100, fundingSource: 'external_cash' }
  });
  assert.equal(externalResult.balance, 400);
});

test('identificador existente bloqueia submissão duplicada', () => {
  assert.throws(() => finance.assertUniqueOperation({ id: 'existing' }), /já foi submetido/);
  assert.equal(finance.assertUniqueOperation(null), true);
});

test('documentos de reforço antigos sem status continuam ativos na reconciliação', () => {
  const result = finance.calculateExpectedShares({
    baselineShares: { vwce: 1, aggh: 2 },
    reinforcements: [{ vwceQuantity: 0.5, agghQuantity: 0.25 }]
  });
  assert.deepEqual(result, { vwce: 1.5, aggh: 2.25 });
});

test('projeção usa valor atual, contribuições futuras e capitalização mensal', () => {
  const result = finance.calculateProjection({ currentValue: 1000, monthlyContributions: [200, 200], annualRate: 0.12 });
  const monthly = Math.pow(1.12, 1 / 12) - 1;
  const expected = Math.round((((1000 + 200) * (1 + monthly) + 200) * (1 + monthly)) * 100) / 100;
  assert.equal(result, expected);
});

test('alocação atual é calculada a partir de posições atuais', () => {
  const result = finance.calculateAllocation({ currentVWCE: 792, currentAGGH: 208, vwceTarget: 75, agghTarget: 25 });
  assert.equal(result.vwcePct, 79.2);
  assert.equal(result.agghPct, 20.8);
});
