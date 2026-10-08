export const FRANCISCA_SUBJECTS = Object.freeze([
  'Matemática',
  'Português',
  'História e Geografia de Portugal',
  'Educação Visual',
  'Ciências Naturais',
  'Inglês',
  'Cidadania e Desenvolvimento',
  'Técnicas de Dança',
  'Expressão Criativa',
  'Música'
]);

export const SUBJECT_COLORS = Object.freeze([
  '#5667c9',
  '#b0527a',
  '#94702f',
  '#8a55a3',
  '#3b8263',
  '#367b9b',
  '#a65a3a',
  '#7460b6',
  '#b45e87',
  '#4f7793'
]);

export const PALLCO_CALENDAR = Object.freeze([
  { title: '1.º período', start: '2026-09-10', end: '2026-12-15', type: 'term' },
  { title: '2.º período', start: '2027-01-04', end: '2027-03-19', type: 'term' },
  { title: '3.º período — 9.º, 11.º e 12.º anos', start: '2027-04-05', end: '2027-06-04', type: 'term' },
  { title: '3.º período — 5.º, 6.º, 7.º, 8.º e 10.º anos', start: '2027-04-05', end: '2027-06-11', type: 'term' },
  { title: '3.º período — iniciações e cursos livres', start: '2027-04-05', end: '2027-07-16', type: 'term' },
  { title: 'Natal', start: '2026-12-16', end: '2026-12-31', type: 'break' },
  { title: 'Carnaval', start: '2027-02-08', end: '2027-02-12', type: 'break' },
  { title: 'Páscoa', start: '2027-03-22', end: '2027-04-02', type: 'break' }
].map(Object.freeze));

export const AEGO_CALENDAR = Object.freeze([
  { title: '1.º semestre — pré-escolar e ensino básico', start: '2026-09-14', end: '2027-02-02', type: 'term' },
  { title: '1.º semestre — ensino secundário', start: '2026-09-21', end: '2027-02-02', type: 'term' },
  { title: '2.º semestre — 9.º, 11.º e 12.º anos', start: '2027-02-11', end: '2027-06-04', type: 'term' },
  { title: '2.º semestre — 5.º, 6.º, 7.º, 8.º e 10.º anos', start: '2027-02-11', end: '2027-06-11', type: 'term' },
  { title: '2.º semestre — pré-escolar e 1.º ciclo', start: '2027-02-11', end: '2027-06-30', type: 'term' },
  { title: 'Novembro — pré-escolar e 1.º ciclo', start: '2026-11-12', end: '2026-11-13', type: 'break' },
  { title: 'Novembro — 2.º e 3.º ciclos e secundário', start: '2026-11-11', end: '2026-11-13', type: 'break' },
  { title: 'Natal', start: '2026-12-21', end: '2027-01-01', type: 'break' },
  { title: 'Avaliação sumativa', start: '2027-02-03', end: '2027-02-05', type: 'break' },
  { title: 'Carnaval', start: '2027-02-08', end: '2027-02-10', type: 'break' },
  { title: 'Páscoa', start: '2027-03-24', end: '2027-04-02', type: 'break' }
].map(Object.freeze));

export function pallcoEventsOn(dateKey) {
  return calendarEventsOn(PALLCO_CALENDAR, dateKey);
}

export function schoolEventsOn(dateKey) {
  return [
    ...pallcoEventsOn(dateKey).map(title => `PallCo · ${title}`),
    ...calendarEventsOn(AEGO_CALENDAR, dateKey).map(title => `Garcia de Orta · ${title}`)
  ];
}

function calendarEventsOn(calendar, dateKey) {
  const events = [];
  for (const entry of calendar) {
    if (entry.type === 'break' && dateKey >= entry.start && dateKey <= entry.end) {
      events.push(`Interrupção letiva — ${entry.title}`);
    } else if (entry.type === 'term') {
      if (dateKey === entry.start) {
        const name = entry.title.split(' — ')[0];
        const differentStarts = calendar.some(other => other.type === 'term'
          && other.title.split(' — ')[0] === name && other.start !== entry.start);
        const title = `Início do ${differentStarts ? entry.title : name}`;
        if (!events.includes(title)) events.push(title);
      }
      if (dateKey === entry.end) events.push(`Fim do ${entry.title}`);
    }
  }
  return events;
}

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  month: 'long',
  year: 'numeric'
});

export function parseDateOnly(value) {
  const match = DATE_PATTERN.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function dateOnlyToOrdinal(value) {
  const parts = parseDateOnly(value);
  if (!parts) return Number.NaN;
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Data local inválida.');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function daysUntil(testDate, today = new Date()) {
  const testOrdinal = dateOnlyToOrdinal(testDate);
  const todayOrdinal = dateOnlyToOrdinal(typeof today === 'string' ? today : localDateKey(today));
  if (!Number.isFinite(testOrdinal) || !Number.isFinite(todayOrdinal)) {
    throw new TypeError('A contagem precisa de datas válidas no formato YYYY-MM-DD.');
  }
  return testOrdinal - todayOrdinal;
}

export function countdownLabel(days) {
  if (days === 0) return 'É hoje!';
  if (days === 1) return 'Falta 1 dia';
  if (days > 1) return `Faltam ${days} dias`;
  if (days === -1) return 'Foi ontem';
  return `Há ${Math.abs(days)} dias`;
}

export function urgencyForDays(days) {
  if (days <= 0) return { key: 'today', label: 'Hoje', message: 'É hoje — respira fundo, tu consegues 🐱' };
  if (days <= 3) return { key: 'very-close', label: 'Muito próximo', message: 'É já daqui a poucos dias 🐾' };
  if (days <= 7) return { key: 'attention', label: 'Atenção', message: 'Está a aproximar-se 🐾' };
  if (days <= 14) return { key: 'approaching', label: 'Aproxima-se', message: 'Boa altura para começar a rever 📚' };
  return { key: 'calm', label: 'Com tempo', message: 'Ainda tens bastante tempo 🐱' };
}

export function subjectColor(subject) {
  const index = FRANCISCA_SUBJECTS.indexOf(subject);
  return SUBJECT_COLORS[index < 0 ? 0 : index];
}

export function sortTests(tests, direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...tests].sort((left, right) => {
    const byDate = String(left.testDate).localeCompare(String(right.testDate));
    if (byDate) return byDate * factor;
    const bySubject = String(left.subject).localeCompare(String(right.subject), 'pt');
    if (bySubject) return bySubject;
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

export function filterTests(tests, subject = 'all') {
  return subject === 'all' ? [...tests] : tests.filter(test => test.subject === subject);
}

export function upcomingTests(tests, today = new Date(), subject = 'all') {
  return sortTests(filterTests(tests, subject).filter(test => daysUntil(test.testDate, today) >= 0));
}

export function pastTests(tests, today = new Date(), subject = 'all') {
  return sortTests(
    filterTests(tests, subject).filter(test => daysUntil(test.testDate, today) < 0),
    'desc'
  );
}

export function summarizeNext30Days(tests, today = new Date(), subject = 'all') {
  const future = upcomingTests(tests, today, subject);
  const inThirtyDays = future.filter(test => daysUntil(test.testDate, today) <= 30);
  const inTwoWeeks = future.filter(test => daysUntil(test.testDate, today) <= 14);
  return {
    total: inThirtyDays.length,
    nextTwoWeeks: inTwoWeeks.length,
    nextInDays: future.length ? daysUntil(future[0].testDate, today) : null
  };
}

export function shiftMonth(view, amount) {
  const shifted = new Date(Date.UTC(view.year, view.month - 1 + amount, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function monthGrid(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new TypeError('Mês inválido.');
  }
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month - 1, 1 - firstWeekday));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const cellYear = date.getUTCFullYear();
    const cellMonth = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return {
      key: `${cellYear}-${String(cellMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year: cellYear,
      month: cellMonth,
      day,
      inMonth: cellYear === year && cellMonth === month
    };
  });
}

export function monthLabel(view) {
  const value = MONTH_FORMATTER.format(new Date(view.year, view.month - 1, 1, 12));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateLong(dateOnly) {
  const parts = parseDateOnly(dateOnly);
  if (!parts) return 'Data inválida';
  return DATE_FORMATTER.format(new Date(parts.year, parts.month - 1, parts.day, 12));
}

export function normalizeTestInput(input) {
  const subject = String(input.subject || '').trim();
  const testDate = String(input.testDate || '').trim();
  const description = String(input.description || '').trim();
  const notes = String(input.notes || '').trim();
  if (!FRANCISCA_SUBJECTS.includes(subject)) throw new TypeError('Seleciona uma disciplina válida.');
  if (!parseDateOnly(testDate)) throw new TypeError('Seleciona uma data válida.');
  if (description.length > 120) throw new TypeError('A descrição pode ter até 120 caracteres.');
  if (notes.length > 1000) throw new TypeError('As notas podem ter até 1000 caracteres.');
  return { childId: 'francisca', subject, testDate, description, notes };
}

export function addTestRecord(records, record) {
  return sortTests([...records, { ...record }]);
}

export function editTestRecord(records, id, changes) {
  return sortTests(records.map(record => record.id === id ? { ...record, ...changes, id } : record));
}

export function removeTestRecord(records, id) {
  return records.filter(record => record.id !== id);
}
