import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('as duas páginas infantis têm saldo, dívida, ações, extrato, investimentos e gráficos', async () => {
  for (const child of ['francisca', 'leonor']) {
    const html = await source(`modules/${child}-financas.html`);
    for (const marker of [
      'balance-available',
      'balance-parents',
      'balance-child-cash',
      'balance-debt',
      'balance-goals',
      'balance-projected',
      'data-open-finance-dialog="income"',
      'data-open-finance-dialog="expense"',
      'data-open-finance-dialog="invest"',
      'data-open-finance-dialog="cash"',
      'movements-list',
      'vaults-list',
      'positions-list',
      'income-chart',
      'expense-chart',
      'investment-chart',
      'monthly-summary',
      '../js/financas-filha.js'
    ]) {
      assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});

test('a gestão parental inclui validação, correção, reprovação, estorno, resumo e dívida', async () => {
  const [html, js] = await Promise.all([
    source('modules/gestao-financas.html'),
    source('js/gestao-financas.js')
  ]);
  for (const marker of [
    'finance-panel-pending',
    'finance-panel-movements',
    'finance-panel-investments',
    'finance-panel-monthly',
    'finance-panel-audit',
    'finance-reject-dialog',
    'finance-correction-dialog',
    'finance-reversal-dialog',
    'finance-adjustment-dialog'
  ]) assert.match(html, new RegExp(marker));
  assert.match(js, /summaryMetric\('Dívida aos pais'/);
  assert.match(js, /summaryMetric\('Com os pais'/);
  assert.match(js, /summaryMetric\('Com ela'/);
  assert.match(html, /cash_withdrawal/);
  assert.match(html, /cash_return/);
  assert.match(js, /data-approve-request/);
  assert.match(js, /data-correct-request/);
  assert.match(js, /data-reverse-movement/);
  assert.match(js, /rejectionReason/);
  assert.doesNotMatch(js, /result\.value\.payload/);
});

test('hosting, cache e regras incluem o sistema de finanças familiares', async () => {
  const [firebaseConfig, worker, rules, script] = await Promise.all([
    source('firebase.json'),
    source('sw.js'),
    source('firebase/firestore.rules'),
    source('js/script.js')
  ]);
  assert.match(firebaseConfig, /\/api\/family-finance/);
  assert.match(worker, /francisca-financas\.html/);
  assert.match(worker, /leonor-financas\.html/);
  assert.match(worker, /gestao-financas\.html/);
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /CLEAR_PRIVATE_FINANCE_DATA/);
  assert.match(script, /clearPrivateFinanceBrowserState\(\)/);
  assert.match(script, /finance:clear-private-data/);
  assert.match(rules, /Fg8GKPt6fNb1vXIZf3Eg0xsHQID3/);
  assert.match(rules, /9d2FHATsREVrX2t5gJDBviNWibv1/);
  assert.match(rules, /match \/family_finance_accounts\/\{childId\}/);
  assert.match(rules, /allow create, update, delete: if false/);
});
