import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FRANCISCA_SUBJECTS,
  addTestRecord,
  countdownLabel,
  dateOnlyToOrdinal,
  daysUntil,
  editTestRecord,
  filterTests,
  localDateKey,
  monthGrid,
  normalizeTestInput,
  pastTests,
  removeTestRecord,
  shiftMonth,
  sortTests,
  summarizeNext30Days,
  upcomingTests
} from '../js/francisca-calendar-core.js';

const root = new URL('../', import.meta.url);
const today = '2026-09-15';
const sample = [
  { id: 'math-2', subject: 'Matemática', testDate: '2026-10-03', description: 'Teste 2' },
  { id: 'port-1', subject: 'Português', testDate: '2026-09-15', description: 'Apresentação oral' },
  { id: 'math-1', subject: 'Matemática', testDate: '2026-09-20', description: 'Frações' },
  { id: 'music-1', subject: 'Música', testDate: '2026-09-20', description: '' },
  { id: 'history-old', subject: 'História e Geografia de Portugal', testDate: '2026-09-10', description: 'Ficha' }
];

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('calcula corretamente hoje, amanhã e restantes dias de calendário', () => {
  assert.equal(daysUntil('2026-09-15', today), 0);
  assert.equal(daysUntil('2026-09-16', today), 1);
  assert.equal(daysUntil('2026-10-01', today), 16);
  assert.equal(countdownLabel(0), 'É hoje!');
  assert.equal(countdownLabel(1), 'Falta 1 dia');
  assert.equal(countdownLabel(14), 'Faltam 14 dias');
});

test('trata datas como date-only sem conversões UTC que mudem o dia', () => {
  assert.equal(dateOnlyToOrdinal('2026-09-16') - dateOnlyToOrdinal('2026-09-15'), 1);
  assert.equal(dateOnlyToOrdinal('2026-03-29') - dateOnlyToOrdinal('2026-03-28'), 1);
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ['Pacific/Honolulu', 'Europe/Lisbon', 'Pacific/Kiritimati']) {
      process.env.TZ = timezone;
      const localMidnight = new Date(2026, 8, 15, 0, 5);
      assert.equal(localDateKey(localMidnight), '2026-09-15');
      assert.equal(daysUntil('2026-09-15', localMidnight), 0);
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('muda de mês e de ano e cria uma grelha mensal completa', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  const february = monthGrid(2028, 2);
  assert.equal(february.length, 42);
  assert.equal(february.filter(cell => cell.inMonth).length, 29);
  assert.equal(february.find(cell => cell.key === '2028-02-01')?.day, 1);
});

test('preserva vários testes da mesma disciplina e vários no mesmo dia', () => {
  assert.equal(filterTests(sample, 'Matemática').length, 2);
  assert.equal(sample.filter(item => item.testDate === '2026-09-20').length, 2);
  const ordered = sortTests(sample);
  assert.deepEqual(ordered.map(item => item.testDate), [
    '2026-09-10',
    '2026-09-15',
    '2026-09-20',
    '2026-09-20',
    '2026-10-03'
  ]);
});

test('ordena próximos testes e exclui datas passadas', () => {
  const future = upcomingTests(sample, today);
  assert.deepEqual(future.map(item => item.id), ['port-1', 'math-1', 'music-1', 'math-2']);
  assert.deepEqual(pastTests(sample, today).map(item => item.id), ['history-old']);
});

test('o filtro afeta próximos testes, histórico e resumo', () => {
  assert.deepEqual(upcomingTests(sample, today, 'Matemática').map(item => item.id), ['math-1', 'math-2']);
  assert.equal(pastTests(sample, today, 'Matemática').length, 0);
  assert.deepEqual(summarizeNext30Days(sample, today, 'Matemática'), {
    total: 2,
    nextTwoWeeks: 1,
    nextInDays: 5
  });
});

test('normaliza dados e suporta criação, edição e remoção independentes', () => {
  const record = {
    id: 'new-test',
    ...normalizeTestInput({
      subject: FRANCISCA_SUBJECTS[0],
      testDate: '2026-11-05',
      description: '  Teste 3  ',
      notes: '  Rever capítulo 4  '
    })
  };
  assert.equal(record.childId, 'francisca');
  assert.equal(record.description, 'Teste 3');
  const created = addTestRecord(sample, record);
  assert.equal(created.length, sample.length + 1);
  const edited = editTestRecord(created, record.id, { testDate: '2026-11-06', notes: 'Nova nota' });
  assert.equal(edited.find(item => item.id === record.id)?.testDate, '2026-11-06');
  assert.equal(edited.find(item => item.id === record.id)?.notes, 'Nova nota');
  const removed = removeTestRecord(edited, record.id);
  assert.equal(removed.length, sample.length);
  assert.equal(removed.some(item => item.id === record.id), false);
});

test('rejeita datas impossíveis e disciplinas fora da lista', () => {
  assert.throws(() => normalizeTestInput({ subject: 'Física', testDate: '2026-09-15' }), /disciplina válida/);
  assert.throws(() => normalizeTestInput({ subject: 'Música', testDate: '2026-02-31' }), /data válida/);
});

test('a página contém formulário, calendário acessível, resumo, histórico e SVG local', async () => {
  const [html, css, browser, worker] = await Promise.all([
    source('modules/francisca-calendario.html'),
    source('css/francisca-calendar.css'),
    source('js/francisca-calendar.js'),
    source('sw.js')
  ]);
  for (const marker of [
    'school-upcoming',
    'school-subject-filter',
    'school-calendar',
    'school-form-dialog',
    'school-detail-dialog',
    'school-past',
    'role="grid"',
    '<svg class="school-cat"',
    '../js/francisca-calendar.js'
  ]) assert.match(html, new RegExp(marker));
  assert.doesNotMatch(html, /<img[^>]+https?:/i);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 370px\)/);
  assert.match(css, /overflow-x: clip/);
  assert.doesNotMatch(css, /overflow-x:\s*auto/);
  assert.match(css, /school-test-card--next/);
  assert.match(css, /school-mobile-count/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(browser, /family_school_calendars/);
  assert.match(browser, /serverTimestamp\(\)/);
  assert.match(browser, /window\.confirm/);
  assert.match(worker, /francisca-calendario\.html/);
});

test('as regras Firestore validam campos e restringem a agenda familiar', async () => {
  const rules = await source('firebase/firestore.rules');
  assert.match(rules, /function canManageSchoolCalendar\(childId\)/);
  assert.match(rules, /signedIn\(\) && childId == 'francisca'/);
  assert.match(rules, /match \/family_school_calendars\/\{childId\}/);
  assert.match(rules, /request\.resource\.data\.createdBy == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.updatedBy == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.testDate\.matches/);
  assert.match(rules, /'family_school_calendars'/);
});
