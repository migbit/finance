import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../js/ginasio-attendance.js', import.meta.url), 'utf8');
const { attendanceDays, attendanceColors, renderAttendance } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

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
    createElement() { return { dataset: {}, style: {}, setAttribute(key, value) { this[key] = value; } }; }
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
    renderAttendance(container, days, workouts, colors);
    assert.equal(cells.length, 28);
    assert.equal(cells[21].style.background, colors.get('Pernas'));
    assert.match(cells[22].style.background, /linear-gradient/);
    assert.match(cells[22]['aria-label'], /Pernas, Costas/);
    assert.equal(cells[22]['aria-current'], 'date');
    renderAttendance(container, days, [], colors);
    assert.equal(cells[21].dataset.present, 'false');
    assert.equal(cells[21].style.background, undefined);
  } finally {
    delete globalThis.document;
  }
});
