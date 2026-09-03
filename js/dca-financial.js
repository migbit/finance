(function initDcaFinancial(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DcaFinancial = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createDcaFinancial() {
  'use strict';

  const MONEY_FACTOR = 100;
  const UNIT_FACTOR = 100000000;
  const PRICE_FACTOR = 1000000;

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const round = (value, factor) => Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  const moneyToCents = value => Math.round((Number(value) + Number.EPSILON) * MONEY_FACTOR);
  const centsToMoney = value => Number(value || 0) / MONEY_FACTOR;
  const roundMoney = value => centsToMoney(moneyToCents(value));
  const roundUnits = value => round(value, UNIT_FACTOR);
  const priceToMicros = value => Math.round((Number(value) + Number.EPSILON) * PRICE_FACTOR);

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeTargets(vwceTarget, agghTarget) {
    const vwce = Number(vwceTarget);
    const aggh = Number(agghTarget);
    if (!finite(vwce) || !finite(aggh) || vwce < 0 || aggh < 0 || Math.abs(vwce + aggh - 100) >= 0.01) {
      throw new Error('As percentagens alvo de VWCE e AGGH devem somar 100%.');
    }
    return { vwce: vwce / 100, aggh: aggh / 100 };
  }

  function calculateAllocation({ currentVWCE = 0, currentAGGH = 0, vwceTarget = 75, agghTarget = 25 } = {}) {
    const targets = normalizeTargets(vwceTarget, agghTarget);
    const vwce = Math.max(0, Number(currentVWCE) || 0);
    const aggh = Math.max(0, Number(currentAGGH) || 0);
    const total = vwce + aggh;
    return {
      total,
      vwceValue: vwce,
      agghValue: aggh,
      vwcePct: total > 0 ? vwce / total * 100 : 0,
      agghPct: total > 0 ? aggh / total * 100 : 0,
      vwceTarget: targets.vwce * 100,
      agghTarget: targets.aggh * 100
    };
  }

  function calculateReinforcementAllocation({
    totalAmount,
    currentVWCE = 0,
    currentAGGH = 0,
    vwceTarget = 75,
    agghTarget = 25
  } = {}) {
    const totalCents = moneyToCents(totalAmount);
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      throw new Error('O montante do reforço deve ser superior a zero.');
    }
    const targets = normalizeTargets(vwceTarget, agghTarget);
    const vwce = Math.max(0, Number(currentVWCE) || 0);
    const aggh = Math.max(0, Number(currentAGGH) || 0);
    const afterTotal = vwce + aggh + centsToMoney(totalCents);
    const idealVWCEAddition = afterTotal * targets.vwce - vwce;
    const vwceCents = clamp(moneyToCents(idealVWCEAddition), 0, totalCents);
    const agghCents = totalCents - vwceCents;
    return {
      totalCents,
      vwceCents,
      agghCents,
      totalAmount: centsToMoney(totalCents),
      vwceAmount: centsToMoney(vwceCents),
      agghAmount: centsToMoney(agghCents)
    };
  }

  function calculatePortfolioValue({ shares = {}, quotes = {}, balance = 0 } = {}) {
    const vwceShares = Number(shares.vwce) || 0;
    const agghShares = Number(shares.aggh) || 0;
    const vwcePrice = Number(quotes.vwce?.price ?? quotes.vwce);
    const agghPrice = Number(quotes.aggh?.price ?? quotes.aggh);
    const vwceValue = vwceShares > 0 && !finite(vwcePrice) ? null : vwceShares * (vwcePrice || 0);
    const agghValue = agghShares > 0 && !finite(agghPrice) ? null : agghShares * (agghPrice || 0);
    const hasCompleteQuotes = vwceValue != null && agghValue != null;
    const etfValue = hasCompleteQuotes ? vwceValue + agghValue : null;
    return {
      vwceValue,
      agghValue,
      etfValue,
      balance: Math.max(0, Number(balance) || 0),
      totalWealth: etfValue == null ? null : etfValue + Math.max(0, Number(balance) || 0),
      hasCompleteQuotes
    };
  }

  function amountsForMode(input, totalCents) {
    const mode = input.allocationMode || 'automatic';
    if (mode === 'automatic') {
      return calculateReinforcementAllocation(input);
    }
    if (mode === 'manual_percentage') {
      const targets = normalizeTargets(input.vwcePercentage, input.agghPercentage);
      const vwceCents = Math.round(totalCents * targets.vwce);
      return { totalCents, vwceCents, agghCents: totalCents - vwceCents };
    }
    if (mode === 'manual_amounts') {
      const vwceCents = moneyToCents(input.vwceAmount);
      const agghCents = moneyToCents(input.agghAmount);
      if (vwceCents < 0 || agghCents < 0 || vwceCents + agghCents !== totalCents) {
        throw new Error('Os montantes de VWCE e AGGH devem ser positivos e somar o total do reforço.');
      }
      return { totalCents, vwceCents, agghCents };
    }
    throw new Error('Forma de distribuição inválida.');
  }

  function validateExecutionPrice(amountCents, price, label) {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Indique um preço válido para ${label}.`);
    return value;
  }

  function buildReinforcementPreview(input = {}) {
    if (!validDate(input.date)) throw new Error('Indique uma data de compra válida.');
    if (input.date < '2025-09-01') throw new Error('O plano DCA começou em setembro de 2025.');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (new Date(`${input.date}T12:00:00`) > today) throw new Error('A data do reforço não pode estar no futuro.');
    const totalCents = moneyToCents(input.totalAmount);
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new Error('O montante do reforço deve ser superior a zero.');
    if (!['trade_republic_balance', 'external_cash'].includes(input.fundingSource)) {
      throw new Error('Selecione uma origem do dinheiro válida.');
    }
    if (input.fundingSource === 'trade_republic_balance'
        && centsToMoney(totalCents) > (Number(input.currentBalance) || 0)) {
      throw new Error(`Saldo insuficiente. Disponível: ${(Number(input.currentBalance) || 0).toFixed(2)} €.`);
    }
    const amounts = amountsForMode(input, totalCents);
    const vwcePrice = validateExecutionPrice(amounts.vwceCents, input.vwcePrice, 'VWCE');
    const agghPrice = validateExecutionPrice(amounts.agghCents, input.agghPrice, 'AGGH');
    const vwceQuantity = amounts.vwceCents ? roundUnits(centsToMoney(amounts.vwceCents) / vwcePrice) : 0;
    const agghQuantity = amounts.agghCents ? roundUnits(centsToMoney(amounts.agghCents) / agghPrice) : 0;
    const currentShares = {
      vwce: Math.max(0, Number(input.currentShares?.vwce) || 0),
      aggh: Math.max(0, Number(input.currentShares?.aggh) || 0)
    };
    const beforeValues = calculatePortfolioValue({
      shares: currentShares,
      quotes: { vwce: vwcePrice || 0, aggh: agghPrice || 0 },
      balance: input.currentBalance
    });
    const afterShares = {
      vwce: roundUnits(currentShares.vwce + vwceQuantity),
      aggh: roundUnits(currentShares.aggh + agghQuantity)
    };
    const afterValues = calculatePortfolioValue({
      shares: afterShares,
      quotes: { vwce: vwcePrice || 0, aggh: agghPrice || 0 },
      balance: input.fundingSource === 'trade_republic_balance'
        ? roundMoney((Number(input.currentBalance) || 0) - centsToMoney(totalCents))
        : input.currentBalance
    });
    return {
      ...amounts,
      totalAmount: centsToMoney(totalCents),
      vwceAmount: centsToMoney(amounts.vwceCents),
      agghAmount: centsToMoney(amounts.agghCents),
      vwcePrice,
      agghPrice,
      vwcePriceMicros: priceToMicros(vwcePrice),
      agghPriceMicros: priceToMicros(agghPrice),
      vwceQuantity,
      agghQuantity,
      currentShares,
      afterShares,
      beforeValues,
      afterValues,
      balanceImpact: input.fundingSource === 'trade_republic_balance' ? -centsToMoney(totalCents) : 0
    };
  }

  function calculateReinforcementReversal({ shares = {}, balance = 0, reinforcement = {} } = {}) {
    if ((reinforcement.status || 'active') !== 'active') throw new Error('Este reforço já está anulado.');
    const nextShares = {
      vwce: roundUnits((Number(shares.vwce) || 0) - (Number(reinforcement.vwceQuantity) || 0)),
      aggh: roundUnits((Number(shares.aggh) || 0) - (Number(reinforcement.agghQuantity) || 0))
    };
    if (nextShares.vwce < 0 || nextShares.aggh < 0) throw new Error('Unidades insuficientes para anular o reforço.');
    return {
      shares: nextShares,
      balance: roundMoney((Number(balance) || 0) + (reinforcement.fundingSource === 'trade_republic_balance'
        ? Number(reinforcement.totalAmount || 0)
        : 0))
    };
  }

  function assertUniqueOperation(existingOperation) {
    if (existingOperation) throw new Error('Este reforço já foi submetido.');
    return true;
  }

  function calculateProjection({ currentValue = 0, monthlyContributions = [], annualRate = 0 } = {}) {
    let value = Math.max(0, Number(currentValue) || 0);
    const rate = Number(annualRate);
    if (!Number.isFinite(rate) || rate <= -1 || rate > 10) throw new Error('Taxa anual de cenário inválida.');
    const monthlyRate = Math.pow(1 + rate, 1 / 12) - 1;
    monthlyContributions.forEach(contribution => {
      const amount = Math.max(0, Number(contribution) || 0);
      value = (value + amount) * (1 + monthlyRate);
    });
    return roundMoney(value);
  }

  function calculateExpectedShares({ baselineShares, reinforcements = [] } = {}) {
    return reinforcements
      .filter(item => (item.status || 'active') === 'active')
      .reduce((shares, item) => ({
        vwce: roundUnits(shares.vwce + (Number(item.vwceQuantity) || 0)),
        aggh: roundUnits(shares.aggh + (Number(item.agghQuantity) || 0))
      }), {
        vwce: Math.max(0, Number(baselineShares?.vwce) || 0),
        aggh: Math.max(0, Number(baselineShares?.aggh) || 0)
      });
  }

  return Object.freeze({
    MONEY_FACTOR,
    UNIT_FACTOR,
    PRICE_FACTOR,
    moneyToCents,
    centsToMoney,
    roundMoney,
    roundUnits,
    priceToMicros,
    validDate,
    calculateAllocation,
    calculateReinforcementAllocation,
    calculatePortfolioValue,
    buildReinforcementPreview,
    calculateReinforcementReversal,
    assertUniqueOperation,
    calculateProjection,
    calculateExpectedShares
  });
}));
