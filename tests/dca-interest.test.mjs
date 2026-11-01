import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const firebaseMock = moduleURL(`
  export const db = {};
  export const getAuth = () => ({}), onAuthStateChanged = () => {};
  export const collection = (_, name) => name;
  export const doc = (...parts) => parts.filter(part => typeof part === 'string').join('/') + (parts.length === 1 ? '/audit' : '');
  export const getDoc = () => {}, getDocs = () => {}, setDoc = () => {}, updateDoc = () => {};
  export const query = () => {}, orderBy = () => {}, limit = () => {};
  export const serverTimestamp = () => 'server-time';
  export const runTransaction = async (_, callback) => {
    const records = globalThis.interestTestRecords;
    const writes = [];
    const result = await callback({
      get: async path => {
        assertNoWrites();
        return { exists: () => records.has(path), data: () => structuredClone(records.get(path)) };
      },
      set: (path, patch) => writes.push([path, patch]),
      update: (path, patch) => {
        if (!records.has(path)) throw new Error('Missing document');
        writes.push([path, patch]);
      }
    });
    for (const [path, patch] of writes) records.set(path, { ...records.get(path), ...patch });
    return result;
    function assertNoWrites() { if (writes.length) throw new Error('Transaction read after write'); }
  };
`);
const coreSource = (await readFile(new URL('../js/dca-core.js', import.meta.url), 'utf8'))
  .replace('../js/script.js', firebaseMock)
  .replace('https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js', firebaseMock)
  .replace('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js', firebaseMock);
const coreURL = moduleURL(coreSource);
const { correctMonthlyInterest, DEFAULTS } = await import(coreURL);
const calculationSource = (await readFile(new URL('../js/dca-calculations.js', import.meta.url), 'utf8'))
  .replace('./dca-core.js', coreURL);
const calculationsURL = moduleURL(calculationSource);
const { buildModel, calculateKPIs, somaJuroTabelaDCA } = await import(calculationsURL);
const uiSource = (await readFile(new URL('../js/dca-ui.js', import.meta.url), 'utf8'))
  .replace('./dca-calculations.js', calculationsURL);
const { renderTable } = await import(moduleURL(uiSource));

function seed({ automatic = true } = {}) {
  const records = new Map([
    ['dca/2026-10', { id: '2026-10', y: 2026, m: 10, cash_interest: 2.10, snapshot_status: 'closed', snapshot_source: automatic ? 'automatic' : 'manual', swda_value: 1700, aggh_value: 430 }],
    ['dca_juro/current', { saldo: 802.10, periodOpeningBalance: 802.10, lastClosedMonth: '2026-10', lastMonthlyInterest: 2.10 }],
    ['dca_settings/shares', { vwce: 10, aggh: 20 }]
  ]);
  if (automatic) {
    records.set('dca_monthly_closures/2026-10', { status: 'complete', interest: 2.10, balanceAfterInterest: 1002.10, balanceAfterPurchase: 802.10, purchase: { vwce: 150, aggh: 50 } });
    records.set('dca_juro_movements/interest_2026-10', { amount: 2.10, balanceAfter: 1002.10, includedInOpeningBalance: true });
  }
  globalThis.interestTestRecords = records;
  return records;
}

test('corrige outubro para 1,54 € e aplica a diferença uma só vez no saldo', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') });
  const records = seed();
  await correctMonthlyInterest('2026-10', '1,54', 2.10);
  const month = records.get('dca/2026-10');
  assert.equal(month.cash_interest, 1.54);
  assert.equal(month.interest_original, 2.10);
  assert.equal(month.snapshot_status, 'closed');
  assert.equal(month.swda_value, 1700);
  assert.equal(month.aggh_value, 430);
  assert.deepEqual(records.get('dca_settings/shares'), { vwce: 10, aggh: 20 });
  assert.equal(records.get('dca_monthly_closures/2026-10').interest, 1.54);
  assert.equal(records.get('dca_monthly_closures/2026-10').balanceAfterInterest, 1001.54);
  assert.equal(records.get('dca_monthly_closures/2026-10').balanceAfterPurchase, 801.54);
  assert.equal(records.get('dca_juro_movements/interest_2026-10').amount, 1.54);
  assert.equal(records.get('dca_juro/current').saldo, 801.54);
  assert.equal(records.get('dca_juro/current').lastMonthlyInterest, 1.54);
  assert.equal(records.get('dca_juro/current').periodOpeningBalance, 802.10);
  const audit = records.get('dca_juro_movements/audit');
  assert.equal(audit.amount, -0.56);
  assert.equal(audit.type, 'interest_correction');
  assert.equal(audit.effectiveAt.toISOString(), '2026-11-01T12:00:00.000Z');
  assert.notEqual(audit.includedInOpeningBalance, true);
  const rows = buildModel([month], DEFAULTS);
  assert.equal(rows[0].cash_interest, 1.54);
  assert.equal(calculateKPIs(rows, { saldo: 801.54 }).balance, 801.54);
  const snapshot = structuredClone(records);
  await correctMonthlyInterest('2026-10', '1.54', 1.54);
  assert.deepEqual(records, snapshot);
  await assert.rejects(correctMonthlyInterest('2026-10', '1.54', 2.10), /alterado entretanto/);
  assert.deepEqual(records, snapshot);
});

test('aceita zero e preserva a taxa e o saldo de abertura', async () => {
  const records = seed();
  await correctMonthlyInterest('2026-10', '0', 2.10);
  assert.equal(records.get('dca/2026-10').cash_interest, 0);
  assert.equal(records.get('dca_juro/current').saldo, 800);
});

test('corrigir um fecho manual não capitaliza novamente o juro', async () => {
  const records = seed({ automatic: false });
  const balance = structuredClone(records.get('dca_juro/current'));
  await correctMonthlyInterest('2026-10', '1.54', 2.10);
  assert.equal(records.get('dca/2026-10').cash_interest, 1.54);
  assert.deepEqual(records.get('dca_juro/current'), balance);
});

test('corrigir um mês antigo preserva o último juro e os fechos posteriores', async () => {
  const records = seed();
  records.get('dca_juro/current').lastClosedMonth = '2026-11';
  records.get('dca_juro/current').lastMonthlyInterest = 1.20;
  records.set('dca_monthly_closures/2026-11', { status: 'complete', interest: 1.20 });
  await correctMonthlyInterest('2026-10', '1.54', 2.10);
  assert.equal(records.get('dca_juro/current').lastMonthlyInterest, 1.20);
  assert.deepEqual(records.get('dca_monthly_closures/2026-11'), { status: 'complete', interest: 1.20 });
});

test('valores inválidos, meses abertos e saldo insuficiente não deixam escritas parciais', async () => {
  const records = seed();
  const snapshot = structuredClone(records);
  for (const value of ['', ' ', '-1', 'NaN', 'Infinity', '1,2,3']) {
    await assert.rejects(correctMonthlyInterest('2026-10', value, 2.10), /juro válido/);
    assert.deepEqual(records, snapshot);
  }
  await assert.rejects(correctMonthlyInterest('2026-13', 1.54, 2.10), /juro válido/);
  records.get('dca/2026-10').snapshot_status = 'open';
  await assert.rejects(correctMonthlyInterest('2026-10', 1.54, 2.10), /já não está fechado/);
  records.get('dca/2026-10').snapshot_status = 'closed';
  records.get('dca_juro/current').saldo = 0;
  const noBalance = structuredClone(records);
  await assert.rejects(correctMonthlyInterest('2026-10', 1.54, 2.10), /saldo negativo/);
  assert.deepEqual(records, noBalance);
});

test('o juro fechado mostra cêntimos num botão acessível e continua incluído no total', () => {
  const created = [];
  globalThis.document = {
    createElement: tag => {
      const element = { tag, dataset: {}, classList: { add() {} }, appendChild() {}, querySelector: () => ({ appendChild() {} }) };
      created.push(element);
      return element;
    }
  };
  renderTable([{ id: '2026-10', y: 2026, m: 10, isClosed: true, cash_interest: 1.54 }], { appendChild() {}, querySelector() {} });
  const html = created.find(element => element.tag === 'tr').innerHTML;
  assert.match(html, /class="btn-correct-interest"/);
  assert.match(html, /aria-label="Corrigir juro de 10\/2026"/);
  assert.match(html, /1,54/);
  assert.match(html, /class="cash" type="hidden" value="1.54"/);
  const total = somaJuroTabelaDCA({ querySelectorAll: () => [{ dataset: { ym: '2026-10' }, classList: { contains: () => false }, querySelector: () => ({ value: '1.54', closest: () => ({}) }) }] });
  assert.equal(total, 1.54);
  delete globalThis.document;
});

test('clicar no juro abre o editor, aceita 1,54 e respeita o acesso de leitura', async () => {
  const source = await readFile(new URL('../js/dca-main.js', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('function bindTableSaveHandler()'), source.indexOf('// ---------- Toggle Years Button'));
  const elements = new Map();
  for (const id of ['dca-table-wrap', 'interest-correction-dialog', 'interest-correction-form', 'interest-correction-amount', 'interest-correction-title', 'interest-correction-feedback', 'btn-save-interest-correction']) {
    elements.set(id, { listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; }, querySelectorAll: () => [], showModal() { this.open = true; }, close() { this.open = false; }, focus() {}, select() {} });
  }
  const calls = [];
  const state = { accessMode: 'write', rows: [{ id: '2026-10', y: 2026, m: 10, isClosed: true, cash_interest: 2.10 }] };
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id) }, state,
    correctMonthlyInterest: async (...args) => calls.push(args), boot: async () => {},
    showToast: () => {}, showFeedback: () => {}
  });
  vm.runInContext(`${handler}\nbindTableSaveHandler();`, context);
  const dialog = elements.get('interest-correction-dialog');
  const input = elements.get('interest-correction-amount');
  const click = () => elements.get('dca-table-wrap').listeners.click({ target: { closest: () => ({ closest: () => ({ dataset: { id: '2026-10' } }) }) } });
  await click();
  assert.equal(dialog.open, true);
  assert.equal(input.value, '2,10');
  input.value = '1,54';
  await elements.get('interest-correction-form').listeners.submit({ preventDefault() {} });
  assert.deepEqual(calls, [['2026-10', '1,54', 2.10]]);
  assert.equal(dialog.open, false);
  state.accessMode = 'read';
  await click();
  assert.equal(dialog.open, false);
  await elements.get('interest-correction-form').listeners.submit({ preventDefault() {} });
  assert.equal(calls.length, 1);
});
