import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateCategories,
  getVisibleMovements,
  normalizeSnapshot
} from '../js/financas-core.js';

test('normaliza saldo negativo como dívida sem criar dinheiro disponível', () => {
  const snapshot = normalizeSnapshot({
    childId: 'leonor',
    account: {
      balanceCents: -1750,
      availableCents: 0,
      debtCents: 1750,
      pendingIncomingCents: 500,
      pendingOutgoingCents: 200,
      pendingCents: 700,
      vaultCents: 0,
      marketCents: 0,
      totalCents: -1750
    }
  }, 'leonor');

  assert.deepEqual(snapshot.account, {
    balanceCents: -1750,
    rawBalanceCents: -1750,
    debtCents: 1750,
    availableCents: 0,
    pendingCents: 700,
    pendingIncomingCents: 500,
    pendingOutgoingCents: 200,
    projectedBalanceCents: -1450,
    projectedAvailableCents: 0,
    projectedDebtCents: 1450,
    goalReservedCents: 0,
    vaultCents: 0,
    marketCents: 0,
    totalCents: -1750
  });
});

test('movimentos pendentes projetam o saldo sem esconder dinheiro disponível', () => {
  const snapshot = normalizeSnapshot({
    account: {
      balanceCents: 2000,
      pendingOutgoingCents: 750
    }
  });
  assert.equal(snapshot.account.availableCents, 2000);
  assert.equal(snapshot.account.projectedAvailableCents, 1250);
  assert.equal(snapshot.account.debtCents, 0);
});

test('combina metadados de instrumentos, cotações e posições em micros', () => {
  const snapshot = normalizeSnapshot({
    instruments: [{ id: 'VWCE', symbol: 'VWCE', name: 'ETF Global', type: 'etf', riskLevel: 3 }],
    quotes: [{ instrumentId: 'VWCE', symbol: 'VWCE', priceCents: 12750, marketAsOf: '2026-08-28' }],
    marketPositions: [{ instrumentId: 'VWCE', symbol: 'VWCE', quantityMicros: 250000, costBasisCents: 3000, marketValueCents: 3188 }]
  });

  assert.equal(snapshot.instruments[0].name, 'ETF Global');
  assert.equal(snapshot.instruments[0].priceCents, 12750);
  assert.equal(snapshot.positions[0].quantity, 0.25);
  assert.equal(snapshot.positions[0].instrumentType, 'etf');
  assert.equal(snapshot.positions[0].resultCents, 188);
});

test('lê mapas de gráficos do servidor como valores em cêntimos', () => {
  const snapshot = normalizeSnapshot({
    charts: {
      incomeByCategory: { gift: 1250 },
      expenseByCategory: { books: 499 }
    }
  });
  assert.equal(snapshot.breakdown.incomeByCategory[0].amountCents, 1250);
  assert.equal(snapshot.breakdown.expenseByCategory[0].amountCents, 499);
});

test('o progresso do objetivo usa apenas o dinheiro realmente reservado', () => {
  const positive = normalizeSnapshot({
    account: { balanceCents: 2400, availableCents: 1800 },
    goal: { title: 'Bicicleta', targetCents: 10000, reservedCents: 650 }
  });
  const debt = normalizeSnapshot({
    account: { balanceCents: -500, availableCents: 0 },
    goal: { title: 'Bicicleta', targetCents: 10000 }
  });
  assert.equal(positive.goal.savedCents, 650);
  assert.equal(debt.goal.savedCents, 0);
});

test('uma reprovação desaparece quando termina o prazo explícito de 24 horas', () => {
  const now = Date.parse('2026-08-29T12:00:00Z');
  const snapshot = normalizeSnapshot({
    requests: [
      { id: 'visible', kind: 'expense', amountCents: 100, status: 'rejected', visibleToChildUntil: '2026-08-29T13:00:00Z' },
      { id: 'expired', kind: 'expense', amountCents: 200, status: 'rejected', visibleToChildUntil: '2026-08-29T11:00:00Z' }
    ]
  });
  assert.deepEqual(getVisibleMovements(snapshot.movements, now).map(item => item.id), ['visible']);
});

test('gráficos locais não classificam compras de mercado como consumo', () => {
  const income = aggregateCategories([
    { kind: 'income', status: 'approved', category: 'gift', categoryLabel: 'Prenda', amountCents: 1000 },
    { kind: 'market_sell', status: 'approved', category: 'market', amountCents: 800 }
  ], 'income');
  const expense = aggregateCategories([
    { kind: 'expense', status: 'approved', category: 'books', categoryLabel: 'Livros', amountCents: 500 },
    { kind: 'market_buy', status: 'approved', category: 'market', amountCents: 800 }
  ], 'expense');
  assert.deepEqual(income.map(item => item.key), ['gift']);
  assert.deepEqual(expense.map(item => item.key), ['books']);
});

test('mantém o fim de um cofre no extrato sem o confundir com o pedido inicial', () => {
  const snapshot = normalizeSnapshot({
    movements: [
      {
        id: 'maturity-vault-1',
        requestId: 'request-vault-1',
        kind: 'vault_maturity',
        amountCents: 1010,
        deltaCents: 1010,
        sequence: 2,
        createdAt: '2026-08-29T12:00:00Z'
      },
      {
        id: 'request-vault-1',
        requestId: 'request-vault-1',
        kind: 'vault_open',
        amountCents: 1000,
        deltaCents: -1000,
        sequence: 1,
        createdAt: '2026-08-28T12:00:00Z'
      }
    ],
    requests: [
      {
        id: 'request-vault-1',
        kind: 'vault_open',
        amountCents: 1000,
        status: 'approved',
        createdAt: '2026-08-28T11:59:00Z'
      }
    ]
  });

  assert.deepEqual(snapshot.movements.map(item => item.kind), ['vault_maturity', 'vault_open']);
  assert.equal(snapshot.movements[0].status, 'approved');
});
