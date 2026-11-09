import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/ginasio.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const seriesKey = (machine, variant, index) => `${machine}|${variant}|${index}`;
function historyHarness(documents, { filipa = false, date = '2026-11-05' } = {}) {
  const context = vm.createContext({
    IS_FILIPA_GYM: filipa, state: { date }, SHORT_SUFFIX: ' — curto (exceção)',
    normalTraining: name => name.replace(' — curto (exceção)', ''),
    gymCollection: name => name,
    where: (field, op, value) => ({ field, op, value }), query: (...args) => args,
    getDocs: async query => ({ docs: documents.filter(item => item.treino === query[1].value).map(item => ({ data: () => item })) }),
    getSeriesKey: seriesKey
  });
  vm.runInContext(section('async function loadLastReps(', 'function buildSessionFromDom('), context);
  return context;
}
function workout(date, gym = 'Constituição', reps = 10, treino = 'Costas', variantId = 'row') {
  return { date, gym, treino, machines: {
    row: { initialResistance: 5, variantId, series: [{ seriesIndex: 0, baseWeight: 40, reps, rir: '2' }] }
  } };
}

test('compara com o treino anterior à data selecionada, excluindo a própria sessão, datas futuras e outros ginásios', async () => {
  const h = historyHarness([
    workout('2026-11-01'), workout('2026-11-05', 'Constituição', 12),
    workout('2026-11-09', 'Constituição', 15), workout('2026-11-04', 'Dragão', 14),
    workout('2026-11-04', 'Constituição', 13, 'Pernas')
  ]);
  const history = await h.loadLastReps('Constituição', 'Costas');
  const previous = history.previousSeries[seriesKey('row', 'row', 0)];
  assert.equal(previous.date, '2026-11-01');
  assert.equal(previous.reps, 10);
  assert.equal(previous.baseWeight, 40);
  assert.equal(previous.initialResistance, 5);
});

test('conserva o índice de séries omitidas e não apresenta séries por realizar como histórico', async () => {
  const previous = workout('2026-11-01', 'Constituição', 0);
  previous.machines.row.series.push({ seriesIndex: 2, baseWeight: 45, reps: 8, rir: '1-2' });
  const h = historyHarness([previous]);
  const result = await h.loadLastReps('Constituição', 'Costas');
  assert.equal(result.previousSeries[seriesKey('row', 'row', 0)], undefined);
  assert.equal(result.previousSeries[seriesKey('row', 'row', 1)], undefined);
  assert.equal(result.previousSeries[seriesKey('row', 'row', 2)].reps, 8);
});

test('não mistura variantes nem vai buscar uma variante antiga que não foi feita no treino anterior', async () => {
  const h = historyHarness([workout('2026-11-01'), workout('2026-11-04', 'Constituição', 12, 'Costas', 'other-row')]);
  const result = await h.loadLastReps('Constituição', 'Costas');
  assert.equal(result.previousSeries[seriesKey('row', 'row', 0)], undefined);
  assert.equal(result.previousSeries[seriesKey('row', 'other-row', 0)].reps, 12);
});

test('o primeiro treino e um histórico vazio não criam valores anteriores', async () => {
  const h = historyHarness([workout('2026-11-05')]);
  assert.equal(Object.keys((await h.loadLastReps('Constituição', 'Costas')).previousSeries).length, 0);
  assert.equal(Object.keys((await h.loadLastReps('', '')).previousSeries).length, 0);
});

test('um curto sem histórico consulta o normal anterior e mantém a data de referência', async () => {
  const h = historyHarness([workout('2026-11-01'), workout('2026-11-09')]);
  const result = await h.loadLastReps('Constituição', 'Costas — curto (exceção)');
  assert.equal(result.previousSeries[seriesKey('row', 'row', 0)].date, '2026-11-01');
  assert.equal(result.previousSeries[seriesKey('row', 'row', 0)].treino, 'Costas');
});

test('a referência mantém peso base separado do total e não cria campos editáveis', () => {
  const cells = Object.fromEntries([2, 3, 4].map(index => [`td:nth-child(${index})`, { children: [], appendChild(child) { this.children.push(child); } }]));
  const context = vm.createContext({
    document: { createElement: tag => ({ tag }) },
    formatWorkoutDate: date => date, formatWeight: weight => String(weight)
  });
  vm.runInContext(section('function appendPreviousSeriesValues(', 'function createSeriesTable('), context);
  const row = { querySelector: selector => cells[selector] };
  context.appendPreviousSeriesValues(row, { date: '2026-11-01', treino: 'Pernas', baseWeight: 40, initialResistance: 22.7, reps: 12, rir: '2' });
  assert.equal(cells['td:nth-child(2)'].children[0].textContent, 'Ant. 40 kg');
  assert.match(cells['td:nth-child(2)'].children[0].title, /Total: 62.7 kg/);
  assert.equal(cells['td:nth-child(3)'].children[0].textContent, 'Ant. 12 reps');
  assert.equal(cells['td:nth-child(4)'].children[0].textContent, 'Ant. RIR 2');
  assert.ok(Object.values(cells).every(cell => cell.children[0].tag === 'small'));
});

test('o aquecimento iniciado conserva as linhas e deixa de mostrar o parágrafo repetido', () => {
  const guidance = { textContent: 'texto antigo', hidden: false };
  const override = {};
  const row = { dataset: { touched: 'true' }, hidden: false };
  const block = {
    querySelectorAll: () => [row],
    querySelector: selector => selector === '[data-warmup-guidance]' ? guidance : override
  };
  const card = { querySelectorAll: () => [], querySelector: () => block };
  const context = vm.createContext({ IS_FILIPA_GYM: false, workoutWrap: { querySelectorAll: () => [card] } });
  vm.runInContext(section('function refreshAdaptiveWarmups()', 'function updateWarmupStatus('), context);
  context.refreshAdaptiveWarmups();
  assert.equal(guidance.hidden, true);
  assert.equal(guidance.textContent, '');
  assert.equal(row.hidden, false);
});

test('gravar um RIR desconhecido não copia o RIR histórico para o treino atual de Miguel', () => {
  const inputs = { '[data-base-weight]': { value: '40' }, '[data-reps]': { value: '10' }, '[data-rir]': { value: '?' } };
  const row = { dataset: { seriesIndex: '0', targetReps: '10', initialResistance: '5' }, querySelector: selector => inputs[selector] };
  const machine = {
    dataset: { machineId: 'row', machineName: 'Remada', variantId: 'row' },
    querySelectorAll: selector => selector === '[data-series-row]' ? [row] : []
  };
  const context = vm.createContext({
    IS_FILIPA_GYM: false, MIGUEL_PLAN_VERSION: 'current', usesLegacyPlan: () => false,
    syncTimingFromDom() {}, getSeriesKey: seriesKey,
    state: { gym: 'Constituição', treino: 'Costas', date: '2026-11-05', timing: {}, lastRir: { [seriesKey('row', 'row', 0)]: 'falha' } },
    document: { querySelectorAll: () => [machine] }
  });
  vm.runInContext(section('function buildSessionFromDom()', 'function buildSummaryText('), context);
  const session = context.buildSessionFromDom();
  assert.equal(session.machines.row.series[0].rir, '?');
  assert.equal(session.machines.row.series[0].reps, 10);
  assert.equal(session.machines.row.series[0].baseWeight, 40);
});
