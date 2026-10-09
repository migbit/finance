const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the actual aggregators with a fixed calendar and synthetic invoices.
// No Firebase access or production data is needed for these regression checks.
function analysisAt(date) {
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [date])); }
    static now() { return new Date(date).getTime(); }
  }
  const context = vm.createContext({
    Date: Clock,
    document: { addEventListener() {} },
    window: { addEventListener() {} }
  });
  const core = fs.readFileSync('js/analisev2-core.js', 'utf8')
    .replace(/export \{[^}]+\};/g, '').replace(/export /g, '');
  const metrics = fs.readFileSync('js/analise-metrics.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const page = fs.readFileSync('js/analisev4-faturacao.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '');
  const values = fs.readFileSync('js/analisev4-values.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  // The metrics module and page both have a private daysInMonth helper.
  vm.runInContext(core + '\n' + metrics + '\n' + values + '\n' + page, context);
  return expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
}

test('chart year window rolls forward on January 1 without pinning 2024', () => {
  assert.deepEqual(analysisAt('2026-12-31T12:00:00')('getDefaultChartYears([2024,2025,2026,2027])'), [2024,2025,2026]);
  assert.deepEqual(analysisAt('2027-01-01T12:00:00')('getDefaultChartYears([2024,2025,2026,2027])'), [2025,2026,2027]);
  assert.deepEqual(analysisAt('2028-01-01T12:00:00')('getDefaultChartYears([2024,2025,2026,2027,2028])'), [2026,2027,2028]);
});

test('occupancy excludes 2024 even with all years selected, retaining 2025', () => {
  const run = analysisAt('2027-10-08T12:00:00');
  run(`state.dailyEntries = [2024,2025,2026,2027].map(year => ({year, month:1, day:1, apartamento:'123', amount:100})); state.metric = 'occupancy'; state.showAllYears = true`);
  assert.deepEqual(run('getTableYears()'), [2025,2026,2027]);
  assert.deepEqual(run("getChartYears(aggregateOccupancyByYear(['123']), {all:true})"), [2025,2026,2027]);
  assert.deepEqual(run("getOccupancyCompareYears(aggregateOccupancyByYear(['123']), aggregateOccupancyByYear(['1248']))"), [2025,2026,2027]);
  run("state.metric = 'revenue'");
  assert.deepEqual(run('getTableYears()'), [2024,2025,2026,2027]);
});

test('comparison timeline uses the rolling window and expands the older history', () => {
  const run = analysisAt('2027-10-08T12:00:00');
  assert.equal(run('buildCompareTimeline([])[0].year'), 2025);
  run('state.showAllChartYears = true');
  assert.equal(run('buildCompareTimeline([])[0].year'), 2024);
});

test('KPIs keep same-day comparisons while monthly analysis retains the full homologous month', () => {
  const run = analysisAt('2026-10-08T12:00:00');
  run(`state.dailyEntries = [
    {year:2025,month:10,day:3,apartamento:'123',amount:100},
    {year:2025,month:10,day:20,apartamento:'123',amount:200},
    {year:2026,month:10,day:3,apartamento:'123',amount:150},
    {year:2026,month:10,day:20,apartamento:'123',amount:250}
  ]`);
  assert.equal(run("summarizeEntries({apartments:['123'],year:2025,month:10,maxDay:8}).revenue"), 100);
  assert.equal(run("summarizeEntries({apartments:['123'],year:2026,month:10,maxDay:8}).revenue"), 150);
  assert.equal(run("aggregateMonthlyForChart(['123'])[2025][9]"), 300);
  assert.equal(run("aggregateMonthlyForChart(['123'])[2026][9]"), 150);
});

test('one-night invoice continues to contribute its revenue and occupied night', () => {
  const run = analysisAt('2026-10-08T12:00:00');
  run(`state.dailyEntries = buildDailyEntries([{apartamento:'123',checkIn:'2026-10-02',noites:1,valorTransferencia:120,taxaAirbnb:0}])`);
  assert.equal(run("aggregateMonthlyForChart(['123'])[2026][9]"), 120);
  assert.equal(run("aggregateOccupiedByYear(['123'])[2026][9]"), 1);
});

test('comparison KPIs use each apartment’s own homologous baseline and annual target', () => {
  const run = analysisAt('2026-10-08T12:00:00');
  run(`state.dailyEntries = [
    {year:2025,month:10,day:3,apartamento:'123',amount:100},
    {year:2025,month:11,day:3,apartamento:'123',amount:200},
    {year:2026,month:10,day:3,apartamento:'123',amount:150},
    {year:2025,month:10,day:3,apartamento:'1248',amount:200},
    {year:2026,month:10,day:3,apartamento:'1248',amount:100},
    {year:2026,month:10,day:20,apartamento:'1248',amount:500}
  ]`);
  const first = run("getProgressMetrics(['123'], 2026, 10, 8)");
  const second = run("getProgressMetrics(['1248'], 2026, 10, 8)");
  const total = run("getProgressMetrics(['123','1248'], 2026, 10, 8)");
  assert.equal(first.ytd.diff, 50);
  assert.equal(first.ytd.base, 100);
  assert.equal(second.ytd.diff, -100);
  assert.equal(second.ytd.base, 200);
  assert.equal(total.ytd.diff, -50);
  assert.equal(total.avg.value, '125 €');
  assert.equal(first.target.base, 300);
  assert.equal(first.target.diff, -150);
  assert.equal(second.target.base, 200);
  assert.equal(second.target.diff, -100);
  assert.equal(first.nights.value, '1');
  assert.equal(second.nights.value, '1');
});

test('excluding the recorded fees removes apparent growth caused only by a fee increase', () => {
  const run = analysisAt('2026-10-08T12:00:00');
  run(`state.sourceFaturas = [
    {apartamento:'123', checkIn:'2025-05-01', noites:2, valorTransferencia:100, taxaAirbnb:10, taxaLimpeza:30},
    {apartamento:'123', checkIn:'2026-05-01', noites:2, valorTransferencia:100, taxaAirbnb:30, taxaLimpeza:30}
  ]; rebuildAnalysisValues(); true`);
  assert.equal(run("getProgressMetrics(['123'],2026,10,8).ytd.diff"), 20);
  const nights = run("aggregateOccupiedByYear(['123'])");
  const cleaning = run("aggregateCleaningByYear(['123'])");
  run('state.includeAirbnbFee = false; rebuildAnalysisValues(); true');
  assert.equal(run("getProgressMetrics(['123'],2026,10,8).ytd.diff"), 0);
  assert.equal(run("getProgressMetrics(['123'],2026,10,8).avg.diff"), 0);
  assert.equal(run("getProgressMetrics(['123'],2026,10,8).target.base"), 100);
  assert.equal(run("aggregateMonthlyForChart(['123'])[2026][4]"), 100);
  assert.equal(run("aggregateAverageNightByYear(['123'])[2026][4]"), 50);
  assert.equal(run("aggregateRevpanByYear(['123'], 'mes')[2026][4]"), 100 / 31);
  assert.deepEqual(run("aggregateOccupiedByYear(['123'])"), nights);
  assert.deepEqual(run("aggregateCleaningByYear(['123'])"), cleaning);
  assert.equal(run('state.sourceFaturas[1].taxaAirbnb'), 30);
  run('state.includeAirbnbFee = true; rebuildAnalysisValues(); true');
  assert.equal(run("getProgressMetrics(['123'],2026,10,8).ytd.diff"), 20);
});

test('net revenue is distributed across year boundaries and monthly legacy invoices', () => {
  const run = analysisAt('2026-10-08T12:00:00');
  run(`state.sourceFaturas = [
    {apartamento:'123', checkIn:'2025-12-31', noites:3, valorTransferencia:300, taxaAirbnb:60},
    {apartamento:'1248', ano:2024, mes:6, valorTransferencia:1000, taxaAirbnb:200},
    {apartamento:'1248', checkIn:'2026-01-03', noites:1, valorTransferencia:80}
  ]; state.includeAirbnbFee = false; rebuildAnalysisValues(); true`);
  assert.equal(run("aggregateMonthlyForChart(['123'])[2025][11]"), 100);
  assert.equal(run("aggregateMonthlyForChart(['123'])[2026][0]"), 200);
  assert.ok(Math.abs(run("aggregateMonthlyForChart(['1248'])[2024][5]") - 1000) < 1e-8);
  assert.equal(run("aggregateMonthlyForChart(['1248'])[2026][0]"), 80);
  assert.deepEqual(run('preciseAnalysisNights(state.faturas).slice(0,3).map(e => [e.ano,e.mes,e.dia,e.valor])'),
    [[2025,12,31,100],[2026,1,1,100],[2026,1,2,100]]);
});

test('reservation detail prices use the fee mode while counts and occupancy stay unchanged', () => {
  const run = analysisAt('2026-10-08T12:00:00');
  run(`state.sourceFaturas = [{apartamento:'123', checkIn:'2026-01-02', dataReserva:'2025-12-30', noites:3, valorTransferencia:300, taxaAirbnb:60}]`);
  const grossLead = run('bucketLeadTimes(state.sourceFaturas)');
  const netLead = run('bucketLeadTimes(applyAirbnbFeeMode(state.sourceFaturas, false))');
  assert.equal(grossLead.rows[0].avgPrice, 120);
  assert.equal(netLead.rows[0].avgPrice, 100);
  assert.equal(netLead.total, grossLead.total);
  const grossWeek = run("computeWeekpartMetrics(preciseAnalysisNights(state.sourceFaturas), {apartments:['123'],years:[2026]})");
  const netWeek = run("computeWeekpartMetrics(preciseAnalysisNights(applyAirbnbFeeMode(state.sourceFaturas,false)), {apartments:['123'],years:[2026]})");
  assert.equal(grossWeek.weekendPrice, 120);
  assert.equal(netWeek.weekendPrice, 100);
  assert.equal(netWeek.weekdayPrice, 100);
  assert.equal(grossWeek.weekendOcc, netWeek.weekendOcc);
  assert.equal(grossWeek.weekdayOcc, netWeek.weekdayOcc);
});
