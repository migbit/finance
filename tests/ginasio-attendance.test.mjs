import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/ginasio-attendance.js', import.meta.url), 'utf8');
const { attendanceDays, attendanceColors, renderAttendance } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const gymSource = await readFile(new URL('../js/ginasio.js', import.meta.url), 'utf8');
const rpmSource = gymSource.slice(gymSource.indexOf('const pendingRpmDates ='), gymSource.indexOf('async function loadAttendance()'));

function rpmHarness({ filipa = false, exists = false, fail = false } = {}) {
  const legend = {};
  const writes = [];
  const confirmations = [];
  const toasts = [];
  let commits = 0;
  const context = vm.createContext({
    IS_FILIPA_GYM: filipa,
    document: { getElementById: () => legend },
    formatWorkoutDate: date => date,
    showConfirm: (...args) => confirmations.push(args),
    showToast: (...args) => toasts.push(args),
    getSessionId: (gym, treino, date) => `${date}-${gym}-${treino}`,
    gymCollection: name => name,
    doc: (collection, id) => ({ collection, id }),
    getDoc: async () => ({ exists: () => exists }),
    Timestamp: { now: () => 123 },
    serverTimestamp: () => 456,
    db: {},
    writeBatch: () => ({
      set: (ref, data) => writes.push({ ref, data }),
      commit: async () => { if (fail) throw new Error('offline'); commits++; }
    }),
    buildSummaryText: session => `${session.date}: ${session.treino}`,
    loadSummaries: async () => {},
    console: { error: () => {} }
  });
  vm.runInContext(rpmSource, context);
  return { context, legend, writes, confirmations, toasts, get commits() { return commits; } };
}

test('RPM pede confirmação apenas num dia vazio de Miguel; cancelar não grava', async () => {
  const h = rpmHarness();
  const selection = { day: { date: '2026-10-28' }, sessions: [], label: '28 de outubro: Sem treino' };
  const cell = {};
  h.context.selectAttendanceDay(selection, cell);
  assert.equal(h.legend.textContent, selection.label);
  assert.equal(h.confirmations.length, 1);
  assert.equal(h.writes.length, 0);
  h.confirmations[0][2]();
  assert.equal(h.writes.length, 0);
  h.context.selectAttendanceDay(selection, cell);
  assert.equal(h.confirmations.length, 2);
  // The confirmation callback invokes the same persistence function tested below.
  let confirmedDate;
  h.context.saveRpmAttendance = async date => { confirmedDate = date; };
  h.confirmations[1][1]();
  assert.equal(confirmedDate, selection.day.date);
  h.context.selectAttendanceDay({ ...selection, sessions: [{ treino: 'Pernas' }] }, cell);
  assert.equal(h.confirmations.length, 2);
  const filipa = rpmHarness({ filipa: true });
  filipa.context.selectAttendanceDay(selection, cell);
  assert.equal(filipa.confirmations.length, 0);
  assert.equal(filipa.legend.textContent, selection.label);
  await filipa.context.saveRpmAttendance(selection.day.date, cell);
  assert.equal(filipa.writes.length, 0);
});

test('RPM grava treino e resumo no mesmo lote, sem duplicar um registo existente', async () => {
  const h = rpmHarness();
  const cell = {};
  await h.context.saveRpmAttendance('2026-10-28', cell);
  assert.equal(h.commits, 1);
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[0].ref.collection, 'ginasio_treinos');
  assert.equal(h.writes[1].ref.collection, 'ginasio_resumos');
  assert.equal(h.writes[0].data.treino, 'RPM');
  assert.equal(h.writes[0].data.date, '2026-10-28');
  assert.equal(cell.disabled, false);
  const existing = rpmHarness({ exists: true });
  await existing.context.saveRpmAttendance('2026-10-28', {});
  assert.equal(existing.writes.length, 0);
  const failed = rpmHarness({ fail: true });
  await failed.context.saveRpmAttendance('2026-10-28', cell);
  assert.equal(failed.commits, 0);
  assert.equal(failed.toasts.at(-1)[1], 'error');
  assert.equal(cell.disabled, false);
});

test('mostra quatro semanas de segunda a domingo, incluindo a mudança de hora', () => {
  const days = attendanceDays(new Date(2026, 9, 27, 0, 15));
  assert.equal(days.length, 28);
  assert.equal(days[0].date, '2026-10-05');
  assert.equal(days.at(-1).date, '2026-11-01');
  assert.equal(new Set(days.map(day => day.date)).size, 28);
  assert.deepEqual(days.filter(day => day.today).map(day => day.date), ['2026-10-27']);
  assert.equal(days.filter(day => day.future).length, 5);
});

test('mantém as semanas certas na passagem do ano e aos domingos', () => {
  const days = attendanceDays(new Date(2027, 0, 3));
  assert.equal(days[0].date, '2026-12-07');
  assert.equal(days.at(-1).date, '2027-01-03');
  assert.equal(days.filter(day => day.future).length, 0);
});

test('marca treinos guardados, combina dois treinos no mesmo dia e limpa uma presença removida', () => {
  const cells = [];
  const container = {
    replaceChildren() { cells.length = 0; },
    appendChild(cell) { cells.push(cell); }
  };
  globalThis.document = {
    createElement(tag) { return { tag, dataset: {}, style: {}, setAttribute(key, value) { this[key] = value; }, addEventListener(name, callback) { this[name] = callback; } }; }
  };
  try {
    const days = attendanceDays(new Date(2026, 9, 27));
    const colors = attendanceColors(['Pernas', 'Costas', 'Pernas']);
    assert.equal(colors.size, 2);
    assert.notEqual(colors.get('Pernas'), colors.get('Costas'));
    const workouts = [
      { date: '2026-10-26', treino: 'Pernas' },
      { date: '2026-10-27', treino: 'Pernas' },
      { date: '2026-10-27', treino: 'Costas' }
    ];
    const selected = [];
    renderAttendance(container, days, workouts, colors, selection => selected.push(selection));
    assert.equal(cells.length, 28);
    assert.equal(cells[21].style.background, colors.get('Pernas'));
    assert.match(cells[22].style.background, /linear-gradient/);
    assert.match(cells[22]['aria-label'], /Pernas, Costas/);
    assert.equal(cells[22]['aria-current'], 'date');
    assert.equal(cells[22].tag, 'button');
    cells[22].click();
    cells[23].click();
    assert.match(selected[0].label, /Pernas, Costas/);
    assert.equal(selected[0].sessions.length, 2);
    assert.equal(selected[1].sessions.length, 0);
    renderAttendance(container, days, [], colors);
    assert.equal(cells[21].dataset.present, 'false');
    assert.equal(cells[21].style.background, undefined);
  } finally {
    delete globalThis.document;
  }
});
