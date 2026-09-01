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
