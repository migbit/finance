import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/ginasio.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness({ filipa = false, failWeights = false, commit = async () => {} } = {}) {
  const state = { gym: 'Dragão', treino: 'Pernas', date: '2026-11-10', lastRir: {}, timing: {} };
  const controls = { gymSelect: { value: 'Dragão' }, trainingSelect: {}, dateInput: {}, saveBtn: {}, workoutWrap: { setAttribute() {} } };
  const reads = [];
  const writes = [];
  const toasts = [];
  let copied = 0;
  let summaries = 0;
  const context = vm.createContext({
    state, ...controls, IS_FILIPA_GYM: filipa,
    usesLegacyPlan: session => Boolean(session && (!session.planVersion || session.planVersion === 'legacy')),
    setStateFromInputs() {},
    resetWorkoutTiming() {}, renderWorkout() {}, resetAddMachineForm() {},
    loadBaseWeights: async () => { if (failWeights) throw new Error('offline'); return {}; },
    loadRecommendedReps: async () => ({}), loadWarmupDefaults: async () => ({}), loadCustomMachines: async () => [],
    loadLastReps: async () => ({ lastReps: {}, lastRir: {}, lastWeights: {} }),
    readLocalDraft: () => null,
    getSessionId: (gym, training, date) => `${date}-${gym}-${training}`,
    doc: (collection, id) => ({ collection, id }), gymCollection: name => name,
    getDoc: ref => { const read = deferred(); reads.push({ ...read, ref }); return read.promise; },
    showToast: (...args) => toasts.push(args), console: { error() {}, log() {} },
    finishActiveWarmups() {},
    buildSessionFromDom: () => ({ gym: state.gym, treino: state.treino, date: state.date, machines: { press: { series: [{ reps: 10, baseWeight: 20, rir: '2' }] } } }),
    document: { getElementById: () => null }, window: {}, db: {},
    persistRecordedWarmupDefaults: async () => {},
    buildSummaryText: session => `${session.date}: ${session.treino}`,
    Timestamp: { now: () => 1 }, serverTimestamp: () => 2,
    writeBatch: () => ({ set: (ref, data) => writes.push({ ref, data }), commit }),
    clearLocalDraft() {}, stopTotalTimer() {}, totalTimerEl: null,
    saveCurrentSelection() {},
    copySavedWorkoutSummary: async () => { copied++; },
    loadSummaries: async () => { summaries++; }
  });
  vm.runInContext(`let loadSessionRequestId = 0; let sessionLoadState = 'idle'; let isSavingSession = false; let localDraftDirty = false;\n`
    + section('function updateSessionAvailability()', 'function formatWeight(')
    + section('function getInitialSeriesRir(', 'function getSavedWarmup(')
    + section('async function loadSession()', 'async function loadBaseWeights(')
    + section('async function saveSession()', 'async function deleteSessionById('), context);
  return { context, state, ...controls, reads, writes, toasts,
    get copied() { return copied; }, get summaries() { return summaries; } };
}

const noSession = () => ({ exists: () => false });

test('um treino novo usa o RIR do plano em vez de repetir falha ou RIR 1 da sessão anterior', () => {
  const h = harness();
  h.state.lastRir.set = 'falha';
  assert.equal(h.context.getInitialSeriesRir({ rir: '2' }, {}, 'set'), '2');
  h.state.lastRir.set = '1';
  assert.equal(h.context.getInitialSeriesRir({ rir: '3+' }, {}, 'set'), '3+');
  assert.equal(h.context.getInitialSeriesRir({}, {}, 'set'), '?');
});

test('recuperar um treino ou rascunho conserva o RIR que foi registado', () => {
  const h = harness();
  for (const rir of ['falha', '1', '1-2', '?']) {
    assert.equal(h.context.getInitialSeriesRir({ rir: '2' }, { rir }, 'set'), rir);
  }
  h.state.session = { planVersion: 'legacy' };
  h.state.lastRir.set = '1';
  assert.equal(h.context.getInitialSeriesRir({ rir: '2' }, {}, 'set'), '1');
  const filipa = harness({ filipa: true });
  filipa.state.lastRir.set = '1';
  assert.equal(filipa.context.getInitialSeriesRir({ rir: '2' }, {}, 'set'), '1');
});

test('carregar outra sessão bloqueia a edição e gravação até receber os dados', async () => {
  const h = harness();
  const loading = h.context.loadSession();
  assert.equal(h.saveBtn.disabled, true);
  assert.equal(h.workoutWrap.inert, true);
  assert.equal(h.saveBtn.textContent, 'A carregar…');
  await h.context.saveSession();
  assert.equal(h.writes.length, 0);
  h.reads[0].resolve(noSession());
  await loading;
  assert.equal(h.saveBtn.disabled, false);
  assert.equal(h.workoutWrap.inert, false);
});

test('uma falha de leitura não permite substituir um treino existente por dados incompletos', async () => {
  const h = harness();
  const loading = h.context.loadSession();
  h.reads[0].reject(new Error('offline'));
  await loading;
  assert.equal(h.saveBtn.disabled, true);
  assert.equal(h.workoutWrap.inert, true);
  await h.context.saveSession();
  assert.equal(h.writes.length, 0);
  assert.match(h.toasts.at(-1)[0], /Atualiza a página antes de guardar/);
  const retry = h.context.loadSession();
  h.reads[1].resolve(noSession());
  await retry;
  assert.equal(h.saveBtn.disabled, false);
});

test('uma falha nas cargas reutilizáveis também bloqueia a gravação incompleta', async () => {
  const h = harness({ failWeights: true });
  const loading = h.context.loadSession();
  h.reads[0].resolve(noSession());
  await loading;
  await h.context.saveSession();
  assert.equal(h.writes.length, 0);
  assert.equal(h.saveBtn.disabled, true);
});

test('uma resposta antiga não desbloqueia nem substitui a sessão escolhida mais recentemente', async () => {
  const h = harness();
  const first = h.context.loadSession();
  h.state.date = '2026-11-11';
  const second = h.context.loadSession();
  h.reads[0].resolve({ exists: () => true, data: () => ({ date: '2026-11-10' }) });
  await first;
  assert.equal(h.saveBtn.disabled, true);
  h.reads[1].resolve({ exists: () => true, data: () => ({ date: '2026-11-11', planVersion: '2026-10-12' }) });
  await second;
  assert.equal(h.state.session.date, '2026-11-11');
  assert.equal(h.saveBtn.disabled, false);
});

test('gravar mantém a seleção fixa, impede duplo envio e grava treino e resumo juntos', async () => {
  const pendingCommit = deferred();
  const h = harness({ commit: () => pendingCommit.promise });
  const loading = h.context.loadSession();
  h.reads[0].resolve(noSession());
  await loading;
  const saving = h.context.saveSession();
  assert.equal(h.gymSelect.disabled, true);
  assert.equal(h.trainingSelect.disabled, true);
  assert.equal(h.dateInput.disabled, true);
  assert.equal(h.saveBtn.textContent, 'A guardar…');
  await h.context.saveSession();
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[0].ref.collection, 'ginasio_treinos');
  assert.equal(h.writes[1].ref.collection, 'ginasio_resumos');
  assert.equal(h.copied, 0);
  pendingCommit.resolve();
  await saving;
  assert.equal(h.copied, 1);
  assert.equal(h.summaries, 1);
  assert.equal(h.saveBtn.disabled, false);
  assert.equal(h.gymSelect.disabled, false);
  assert.equal(h.dateInput.disabled, false);
});

test('falhar a gravação não copia um resumo de sucesso nem deixa os controlos bloqueados', async () => {
  const h = harness({ commit: async () => { throw new Error('offline'); } });
  const loading = h.context.loadSession();
  h.reads[0].resolve(noSession());
  await loading;
  await h.context.saveSession();
  assert.equal(h.copied, 0);
  assert.equal(h.summaries, 0);
  assert.equal(h.saveBtn.disabled, false);
  assert.equal(h.gymSelect.disabled, false);
  assert.equal(h.toasts.at(-1)[1], 'error');
});
