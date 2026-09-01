import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { db, whenAccessResolved } from './script.js';
import {
  FRANCISCA_SUBJECTS,
  countdownLabel,
  daysUntil,
  filterTests,
  formatDateLong,
  localDateKey,
  monthGrid,
  monthLabel,
  normalizeTestInput,
  pastTests,
  shiftMonth,
  sortTests,
  subjectColor,
  summarizeNext30Days,
  upcomingTests,
  urgencyForDays
} from './francisca-calendar-core.js';

const CHILD_ID = 'francisca';
const testsCollection = collection(db, 'family_school_calendars', CHILD_ID, 'tests');
const todayKey = () => localDateKey(new Date());

const state = {
  user: null,
  tests: [],
  filter: 'all',
  view: (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })(),
  selectedId: null,
  unsubscribe: null
};

const elements = {
  main: document.querySelector('.school-page'),
  add: document.getElementById('school-add'),
  status: document.getElementById('school-status'),
  statusText: document.getElementById('school-status-text'),
  retry: document.getElementById('school-retry'),
  filter: document.getElementById('school-subject-filter'),
  upcoming: document.getElementById('school-upcoming'),
  summaryTotal: document.getElementById('summary-total'),
  summaryFortnight: document.getElementById('summary-fortnight'),
  summaryNext: document.getElementById('summary-next'),
  prevMonth: document.getElementById('school-month-prev'),
  nextMonth: document.getElementById('school-month-next'),
  currentMonth: document.getElementById('school-month-today'),
  monthTitle: document.getElementById('school-calendar-title'),
  calendar: document.getElementById('school-calendar'),
  legend: document.getElementById('school-legend'),
  pastCount: document.getElementById('school-past-count'),
  past: document.getElementById('school-past'),
  formDialog: document.getElementById('school-form-dialog'),
  form: document.getElementById('school-form'),
  formTitle: document.getElementById('school-form-title'),
  testId: document.getElementById('school-test-id'),
  subject: document.getElementById('school-subject'),
  testDate: document.getElementById('school-test-date'),
  description: document.getElementById('school-description'),
  notes: document.getElementById('school-notes'),
  pastWarning: document.getElementById('school-past-warning'),
  formError: document.getElementById('school-form-error'),
  save: document.getElementById('school-save'),
  detailDialog: document.getElementById('school-detail-dialog'),
  detailSubject: document.getElementById('school-detail-subject'),
  detailTitle: document.getElementById('school-detail-title'),
  detailDate: document.getElementById('school-detail-date'),
  detailCountdown: document.getElementById('school-detail-countdown'),
  detailNotes: document.getElementById('school-detail-notes'),
  detailMeta: document.getElementById('school-detail-meta'),
  edit: document.getElementById('school-edit'),
  delete: document.getElementById('school-delete'),
  dayDialog: document.getElementById('school-day-dialog'),
  dayTitle: document.getElementById('school-day-title'),
  dayTests: document.getElementById('school-day-tests')
};

function setStatus(message = '', { error = false, retry = false } = {}) {
  elements.status.hidden = !message;
  elements.statusText.textContent = message;
  elements.retry.hidden = !retry;
  elements.status.dataset.kind = error ? 'error' : 'info';
}

function option(value, label = value) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function setupSubjects() {
  FRANCISCA_SUBJECTS.forEach(subject => {
    elements.filter.append(option(subject));
    elements.subject.append(option(subject));
  });
}

function selectedTest() {
  return state.tests.find(test => test.id === state.selectedId) || null;
}

function createEmptyState({ noFuture = false } = {}) {
  const empty = document.createElement('div');
  empty.className = 'school-empty';
  const cat = document.createElement('span');
  cat.className = 'school-empty-cat';
  cat.setAttribute('aria-hidden', 'true');
  cat.textContent = '🐱';
  const title = document.createElement('h3');
  title.textContent = noFuture ? 'Nenhum teste à vista!' : 'A agenda ainda está vazia';
  const message = document.createElement('p');
  message.textContent = noFuture
    ? 'Parece que podes descansar os bigodes por agora.'
    : 'Adiciona o primeiro teste para começar a organizar o estudo.';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'school-primary';
  add.textContent = noFuture ? '＋ Adicionar teste' : 'Adicionar o primeiro teste';
  add.addEventListener('click', () => openForm());
  empty.append(cat, title, message, add);
  return empty;
}

function renderUpcoming() {
  const future = upcomingTests(state.tests, new Date(), state.filter);
  elements.upcoming.replaceChildren();
  if (!future.length) {
    elements.upcoming.append(createEmptyState({ noFuture: state.tests.length > 0 }));
    return;
  }

  future.forEach((test, index) => {
    const days = daysUntil(test.testDate);
    const urgency = urgencyForDays(days);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'school-test-card';
    card.classList.toggle('school-test-card--next', index === 0);
    card.dataset.urgency = urgency.key;
    card.style.setProperty('--subject-color', subjectColor(test.subject));
    card.setAttribute('aria-label', `${test.subject}, ${test.description || 'Teste'}, ${countdownLabel(days)}`);

    if (index === 0) {
      const position = document.createElement('span');
      position.className = 'school-card-position';
      position.textContent = 'Próximo teste';
      card.append(position);
    }
    const subject = document.createElement('span');
    subject.className = 'school-card-subject';
    subject.textContent = test.subject;
    const title = document.createElement('h3');
    title.textContent = test.description || 'Teste';
    const date = document.createElement('time');
    date.className = 'school-card-date';
    date.dateTime = test.testDate;
    date.textContent = formatDateLong(test.testDate);
    const countdown = document.createElement('strong');
    countdown.className = 'school-card-countdown';
    countdown.textContent = countdownLabel(days);
    const message = document.createElement('span');
    message.className = 'school-card-message';
    message.textContent = urgency.message;
    card.append(subject, title, date, countdown, message);
    card.addEventListener('click', () => openDetails(test.id));
    elements.upcoming.append(card);
  });
}

function summaryTimeLabel(days) {
  if (days === null) return '—';
  if (days === 0) return 'hoje';
  return days === 1 ? '1 dia' : `${days} dias`;
}

function renderSummary() {
  const summary = summarizeNext30Days(state.tests, new Date(), state.filter);
  elements.summaryTotal.textContent = String(summary.total);
  elements.summaryFortnight.textContent = String(summary.nextTwoWeeks);
  elements.summaryNext.textContent = summaryTimeLabel(summary.nextInDays);
}

function dayAriaLabel(cell, tests) {
  const date = formatDateLong(cell.key);
  if (!tests.length) return date;
  return `${date}: ${tests.length} ${tests.length === 1 ? 'teste' : 'testes'}`;
}

function openDay(dateKey) {
  const dayTests = sortTests(filterTests(state.tests, state.filter).filter(test => test.testDate === dateKey));
  if (!dayTests.length) return;
  elements.dayTitle.textContent = formatDateLong(dateKey);
  elements.dayTests.replaceChildren();
  dayTests.forEach(test => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'school-day-test';
    button.style.setProperty('--subject-color', subjectColor(test.subject));
    const subject = document.createElement('strong');
    subject.textContent = test.subject;
    const description = document.createElement('span');
    description.textContent = test.description || 'Teste';
    button.append(subject, description);
    button.addEventListener('click', () => {
      elements.dayDialog.close();
      openDetails(test.id);
    });
    elements.dayTests.append(button);
  });
  elements.dayDialog.showModal();
}

function renderCalendar() {
  elements.monthTitle.textContent = monthLabel(state.view);
  elements.calendar.replaceChildren();
  const visibleTests = filterTests(state.tests, state.filter);
  const byDate = new Map();
  visibleTests.forEach(test => {
    if (!byDate.has(test.testDate)) byDate.set(test.testDate, []);
    byDate.get(test.testDate).push(test);
  });

  monthGrid(state.view.year, state.view.month).forEach(cell => {
    const cellTests = sortTests(byDate.get(cell.key) || []);
    const day = document.createElement('div');
    day.className = 'school-day';
    day.classList.toggle('is-current-month', cell.inMonth);
    day.classList.toggle('is-today', cell.key === todayKey());
    day.classList.toggle('has-tests', cellTests.length > 0);
    day.setAttribute('role', 'gridcell');
    day.setAttribute('aria-label', dayAriaLabel(cell, cellTests));

    const number = document.createElement('span');
    number.className = 'school-day-number';
    number.textContent = String(cell.day);
    day.append(number);

    if (cellTests.length) {
      day.tabIndex = 0;
      day.addEventListener('click', () => openDay(cell.key));
      day.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDay(cell.key);
        }
      });

      const events = document.createElement('div');
      events.className = 'school-day-events';
      cellTests.slice(0, 2).forEach(test => {
        const event = document.createElement('button');
        event.type = 'button';
        event.className = 'school-calendar-event';
        event.style.setProperty('--subject-color', subjectColor(test.subject));
        event.title = `${test.subject}: ${test.description || 'Teste'}`;
        const label = document.createElement('span');
        label.textContent = test.description || test.subject;
        event.append(label);
        event.addEventListener('click', clickEvent => {
          clickEvent.stopPropagation();
          openDetails(test.id);
        });
        events.append(event);
      });
      if (cellTests.length > 2) {
        const more = document.createElement('span');
        more.className = 'school-more-events';
        more.textContent = `+ ${cellTests.length - 2} ${cellTests.length - 2 === 1 ? 'teste' : 'testes'}`;
        events.append(more);
      }
      day.append(events);

      const dots = document.createElement('span');
      dots.className = 'school-mobile-dots';
      dots.setAttribute('aria-hidden', 'true');
      cellTests.slice(0, 5).forEach(test => {
        const dot = document.createElement('i');
        dot.style.setProperty('--subject-color', subjectColor(test.subject));
        dots.append(dot);
      });
      if (cellTests.length > 1) {
        const count = document.createElement('small');
        count.className = 'school-mobile-count';
        count.textContent = String(cellTests.length);
        dots.append(count);
      }
      day.append(dots);
    }
    elements.calendar.append(day);
  });
}

function renderLegend() {
  elements.legend.replaceChildren();
  const visibleSubjects = new Set(filterTests(state.tests, state.filter).map(test => test.subject));
  FRANCISCA_SUBJECTS.filter(subject => visibleSubjects.has(subject)).forEach(subject => {
    const item = document.createElement('span');
    item.style.setProperty('--subject-color', subjectColor(subject));
    const dot = document.createElement('i');
    const label = document.createElement('b');
    label.textContent = subject;
    item.append(dot, label);
    elements.legend.append(item);
  });
}

function renderPast() {
  const previous = pastTests(state.tests, new Date(), state.filter);
  elements.pastCount.textContent = String(previous.length);
  elements.past.replaceChildren();
  if (!previous.length) {
    const message = document.createElement('p');
    message.className = 'school-card-date';
    message.textContent = 'Ainda não há testes anteriores neste filtro.';
    elements.past.append(message);
    return;
  }
  previous.forEach(test => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'school-past-item';
    item.style.setProperty('--subject-color', subjectColor(test.subject));
    const marker = document.createElement('i');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = test.description || 'Teste';
    const subject = document.createElement('small');
    subject.textContent = test.subject;
    copy.append(title, subject);
    const date = document.createElement('time');
    date.dateTime = test.testDate;
    date.textContent = formatDateLong(test.testDate);
    item.append(marker, copy, date);
    item.addEventListener('click', () => openDetails(test.id));
    elements.past.append(item);
  });
}

function renderAll() {
  renderUpcoming();
  renderSummary();
  renderCalendar();
  renderLegend();
  renderPast();
}

function timestampLabel(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function openDetails(id) {
  state.selectedId = id;
  const test = selectedTest();
  if (!test) return;
  const days = daysUntil(test.testDate);
  elements.detailSubject.textContent = test.subject;
  elements.detailSubject.style.color = subjectColor(test.subject);
  elements.detailTitle.textContent = test.description || 'Teste';
  elements.detailDate.textContent = formatDateLong(test.testDate);
  elements.detailCountdown.textContent = countdownLabel(days);
  elements.detailNotes.textContent = test.notes || '';
  const created = timestampLabel(test.createdAt);
  const updated = timestampLabel(test.updatedAt);
  elements.detailMeta.textContent = [created && `Criado em ${created}`, updated && `Alterado em ${updated}`].filter(Boolean).join(' · ');
  elements.detailDialog.showModal();
}

function updatePastWarning() {
  elements.pastWarning.hidden = !elements.testDate.value || elements.testDate.value >= todayKey();
}

function openForm(test = null) {
  elements.form.reset();
  elements.formError.hidden = true;
  elements.testId.value = test?.id || '';
  elements.formTitle.textContent = test ? 'Editar teste' : 'Adicionar teste';
  elements.save.textContent = test ? 'Guardar alterações' : 'Guardar teste';
  elements.subject.value = test?.subject || FRANCISCA_SUBJECTS[0];
  elements.testDate.value = test?.testDate || todayKey();
  elements.description.value = test?.description || '';
  elements.notes.value = test?.notes || '';
  updatePastWarning();
  elements.formDialog.showModal();
  elements.subject.focus();
}

async function saveTest(event) {
  event.preventDefault();
  elements.formError.hidden = true;
  let payload;
  try {
    payload = normalizeTestInput(Object.fromEntries(new FormData(elements.form)));
  } catch (error) {
    elements.formError.textContent = error.message;
    elements.formError.hidden = false;
    return;
  }

  elements.save.disabled = true;
  elements.save.textContent = 'A guardar…';
  try {
    const id = elements.testId.value;
    if (id) {
      await updateDoc(doc(testsCollection, id), {
        ...payload,
        updatedAt: serverTimestamp(),
        updatedBy: state.user.uid
      });
    } else {
      await addDoc(testsCollection, {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: state.user.uid
      });
    }
    elements.formDialog.close();
    setStatus(id ? 'Teste alterado com sucesso.' : 'Teste adicionado com sucesso.');
    window.setTimeout(() => setStatus(), 2500);
  } catch (error) {
    console.error('Erro ao guardar teste escolar:', error);
    elements.formError.textContent = 'Não foi possível guardar. Confirma a ligação e tenta novamente.';
    elements.formError.hidden = false;
  } finally {
    elements.save.disabled = false;
    elements.save.textContent = elements.testId.value ? 'Guardar alterações' : 'Guardar teste';
  }
}

async function deleteSelectedTest() {
  const test = selectedTest();
  if (!test) return;
  const label = test.description || `teste de ${test.subject}`;
  if (!window.confirm(`Apagar “${label}”? Esta ação não pode ser anulada.`)) return;
  elements.delete.disabled = true;
  try {
    await deleteDoc(doc(testsCollection, test.id));
    elements.detailDialog.close();
    state.selectedId = null;
    setStatus('Teste apagado.');
    window.setTimeout(() => setStatus(), 2500);
  } catch (error) {
    console.error('Erro ao apagar teste escolar:', error);
    setStatus('Não foi possível apagar o teste. Tenta novamente.', { error: true });
  } finally {
    elements.delete.disabled = false;
  }
}

function subscribeToTests() {
  state.unsubscribe?.();
  setStatus('A carregar os testes…');
  const ordered = query(testsCollection, orderBy('testDate', 'asc'));
  state.unsubscribe = onSnapshot(ordered, snapshot => {
    state.tests = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderAll();
    elements.main.setAttribute('aria-busy', 'false');
    setStatus();
  }, error => {
    console.error('Erro ao carregar calendário escolar:', error);
    elements.main.setAttribute('aria-busy', 'false');
    setStatus('Não foi possível carregar os testes. Confirma a ligação e tenta novamente.', { error: true, retry: true });
  });
}

function bindEvents() {
  elements.add.addEventListener('click', () => openForm());
  elements.retry.addEventListener('click', subscribeToTests);
  elements.filter.addEventListener('change', () => {
    state.filter = elements.filter.value;
    renderAll();
  });
  elements.prevMonth.addEventListener('click', () => {
    state.view = shiftMonth(state.view, -1);
    renderCalendar();
  });
  elements.nextMonth.addEventListener('click', () => {
    state.view = shiftMonth(state.view, 1);
    renderCalendar();
  });
  elements.currentMonth.addEventListener('click', () => {
    const now = new Date();
    state.view = { year: now.getFullYear(), month: now.getMonth() + 1 };
    renderCalendar();
  });
  elements.testDate.addEventListener('change', updatePastWarning);
  elements.form.addEventListener('submit', saveTest);
  elements.edit.addEventListener('click', () => {
    const test = selectedTest();
    if (!test) return;
    elements.detailDialog.close();
    openForm(test);
  });
  elements.delete.addEventListener('click', deleteSelectedTest);
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close());
  });
  [elements.formDialog, elements.detailDialog, elements.dayDialog].forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });
}

async function init() {
  setupSubjects();
  bindEvents();
  const access = await whenAccessResolved();
  if (access.mode !== 'write' || !access.user) {
    elements.main.setAttribute('aria-busy', 'false');
    return;
  }
  state.user = access.user;
  subscribeToTests();
}

init();
