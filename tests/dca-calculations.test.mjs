import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Load the browser modules with Firebase isolated; exercise the real plan helpers.
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const firebaseMock = moduleURL(`
  export const db = {};
  export const getAuth = () => ({});
  export const onAuthStateChanged = () => {};
  export const collection = () => ({}), doc = () => ({});
  export const getDoc = () => {}, getDocs = () => {}, setDoc = () => {}, updateDoc = () => {};
  export const query = () => {}, orderBy = () => {}, limit = () => {};
  export const runTransaction = () => {}, serverTimestamp = () => {};
`);
const coreSource = (await readFile(new URL('../js/dca-core.js', import.meta.url), 'utf8'))
  .replace('../js/script.js', firebaseMock)
  .replace('https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js', firebaseMock)
  .replace('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js', firebaseMock);
const coreURL = moduleURL(coreSource);
const { DEFAULTS, monthsBetween, START_YM } = await import(coreURL);
const calculationsSource = (await readFile(new URL('../js/dca-calculations.js', import.meta.url), 'utf8'))
  .replace('./dca-core.js', coreURL);
const { buildModel, calculateKPIs, calculateProgress, prepareChartData } = await import(moduleURL(calculationsSource));

const docs = () => monthsBetween(START_YM, { y: 2026, m: 12 })
  .map(({ y, m }) => ({ id: `${y}-${String(m).padStart(2, '0')}`, y, m }));

function octoberClock(t) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T12:00:00Z') });
}

function assertOctoberTotals(rows) {
  const september = rows.find(row => row.id === '2026-09');
  const october = rows.find(row => row.id === '2026-10');
  assert.equal(september.regularContributionUsed, 150);
  assert.equal(september.investedCum, 1950);
  assert.equal(october.regularContributionUsed, 200);
  assert.equal(october.monthlySWUsed, 150);
  assert.equal(october.monthlyAGUsed, 50);
  assert.equal(october.investedCum, 2150);
  assert.equal(calculateKPIs(rows).totalInvested, 2150);
  assert.equal(calculateProgress(DEFAULTS, rows).invested, 2150);
  const chart = prepareChartData(rows, DEFAULTS);
  const index = chart.labels.indexOf('10/26');
  assert.equal(chart.datasets.regularMonthlyContributions[index], 200);
  assert.equal(chart.datasets.contributions[index], 2150);
}

test('outubro soma logo os 200 euros, mesmo sem valorização mensal', t => {
  octoberClock(t);
  assertOctoberTotals(buildModel(docs(), DEFAULTS));
});

for (const failureCode of ['quote_unavailable', 'insufficient_balance', 'invalid_automation_configuration']) {
  test(`a falha automática ${failureCode} não anula a contribuição mensal`, t => {
    octoberClock(t);
    const closures = [{ month: '2026-09', currentMonth: '2026-10', status: 'failed', failureCode }];
    assertOctoberTotals(buildModel(docs(), DEFAULTS, null, [], closures));
  });
}

test('a compra automática concluída é contada uma única vez', t => {
  octoberClock(t);
  const closures = [{ month: '2026-09', currentMonth: '2026-10', status: 'complete', purchase: { vwce: 150, aggh: 50 } }];
  assertOctoberTotals(buildModel(docs(), DEFAULTS, null, [], closures));
});

test('preserva os valores executados e soma os reforços separadamente', t => {
  octoberClock(t);
  const closures = [{ currentMonth: '2026-10', status: 'complete', purchase: { vwce: 180, aggh: 60 } }];
  const reinforcements = [{ month: '2026-10', status: 'active', vwceAmount: 30, agghAmount: 10 }];
  const october = buildModel(docs(), DEFAULTS, null, reinforcements, closures).find(row => row.isCurrent);
  assert.equal(october.regularContributionUsed, 240);
  assert.equal(october.reinforcementTotal, 40);
  assert.equal(october.investedCum, 2230);
});

test('preserva uma contribuição mensal explicitamente anulada pelo utilizador', t => {
  octoberClock(t);
  const months = docs();
  months.find(row => row.id === '2026-10').manual_monthly_contribution = 0;
  const october = buildModel(months, DEFAULTS).find(row => row.isCurrent);
  assert.equal(october.regularContributionUsed, 0);
  assert.equal(october.investedCum, 1950);
});
