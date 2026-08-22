const assert = require('node:assert/strict');
const test = require('node:test');
const {
  FILIPA_UID,
  INVESTMENTS_RELEASE_AT_MS,
  authorizeInvestmentRequest,
  getInvestmentAccess
} = require('./investment-access');

test('a Filipa não acede a investimentos antes da data', () => {
  assert.equal(getInvestmentAccess(FILIPA_UID, INVESTMENTS_RELEASE_AT_MS - 1), 'none');
});

test('a Filipa recebe acesso de leitura na data definida', () => {
  assert.equal(getInvestmentAccess(FILIPA_UID, INVESTMENTS_RELEASE_AT_MS), 'read');
});

test('os restantes utilizadores autenticados mantêm acesso', () => {
  assert.equal(getInvestmentAccess('outro-uid', 0), 'write');
});

test('o endpoint rejeita pedidos sem token', async () => {
  const request = { get: () => '' };
  const result = await authorizeInvestmentRequest(request, { verifyIdToken: async () => ({ uid: 'x' }) });
  assert.deepEqual(result, { allowed: false, status: 401, access: 'none' });
});

test('o endpoint aplica a data depois de validar o token', async () => {
  const request = { get: () => 'Bearer token-valido' };
  const firebaseAuth = { verifyIdToken: async () => ({ uid: FILIPA_UID }) };
  const before = await authorizeInvestmentRequest(request, firebaseAuth, INVESTMENTS_RELEASE_AT_MS - 1);
  const released = await authorizeInvestmentRequest(request, firebaseAuth, INVESTMENTS_RELEASE_AT_MS);
  assert.equal(before.status, 403);
  assert.equal(released.access, 'read');
  assert.equal(released.allowed, true);
});
