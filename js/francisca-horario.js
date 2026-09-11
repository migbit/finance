import { whenAccessResolved } from './script.js';
import { DAYS, SCHEDULE } from './francisca-horario-data.js';

const SUBJECTS = {
  MAT: ['Matemática', 'blue'],
  PORT: ['Português', 'rose'],
  ING: ['Inglês', 'sand'],
  HGP: ['História e Geografia de Portugal', 'peach'],
  CNA: ['Ciências Naturais', 'green'],
  CD: ['Cidadania e Desenvolvimento', 'lilac'],
  EDV: ['Educação Visual', 'aqua'],
  'EDV P2': ['Educação Visual · P2', 'aqua'],
  'TDClass 3': ['TDClass 3', 'classical-3'],
  'TDClass 2': ['TDClass 2', 'classical-2'],
  Calma: ['Calma', 'calm'],
  'EC 3': ['EC 3', 'creative'],
  PF: ['PF', 'physical'],
  TDCont: ['TDCont', 'contemporary'],
  Técnica: ['Técnica', 'technique'],
  Música: ['Música', 'music']
};

// Uma única grelha, preservando os tempos e as durações do ficheiro original.
const schedule = SCHEDULE.reduce((combined, section) => {
  const offset = combined.slots.length;
  combined.lessons.push(...section.lessons.map(lesson => ({ ...lesson, slot: lesson.slot + offset })));
  combined.slots.push(...section.slots);
  return combined;
}, { slots: [], lessons: [] });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function lessonBlock(section, lesson) {
  const [name, color] = SUBJECTS[lesson.subject] || [lesson.subject, 'lilac'];
  const block = element('div', `schedule-lesson schedule-${color}`);
  const label = element('strong');
  if (name === lesson.subject) {
    label.textContent = name;
  } else {
    label.append(element('span', 'schedule-label-full', name));
    const abbreviation = element('abbr', 'schedule-label-short', lesson.subject);
    abbreviation.title = name;
    abbreviation.setAttribute('aria-label', name);
    label.append(abbreviation);
  }
  block.append(label);
  block.append(element('span', 'schedule-time', `${section.slots[lesson.slot][0]} – ${section.slots[lesson.slot + lesson.span - 1][1]}`));
  return block;
}

function renderWeek() {
  const container = document.getElementById('schedule-week');
  const section = schedule;
  const wrap = element('div', 'schedule-table-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', 'Horário semanal completo');
  const table = element('table', 'schedule-table');
  table.setAttribute('aria-labelledby', 'schedule-week-title');
  const head = table.createTHead().insertRow();
  ['Horas', ...DAYS].forEach((label, index) => {
    const th = element('th');
    th.append(element('span', 'schedule-label-full', label));
    const short = element('span', 'schedule-label-short', ['Horas', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex'][index]);
    short.setAttribute('aria-label', label);
    th.append(short);
    th.scope = 'col';
    head.append(th);
  });
  const body = table.createTBody();
  section.slots.forEach((slot, index) => {
    const row = body.insertRow();
    const time = element('th', 'schedule-slot');
    time.append(element('span', '', slot[0]), element('span', 'schedule-time-separator', ' – '), element('span', '', slot[1]));
    time.setAttribute('aria-label', `${slot[0]} às ${slot[1]}`);
    time.scope = 'row';
    row.append(time);
    DAYS.forEach((_, day) => {
      const lesson = section.lessons.find(item => item.day === day && item.slot === index);
      const covered = section.lessons.some(item => item.day === day && item.slot < index && item.slot + item.span > index);
      if (covered) return;
      const cell = row.insertCell();
      if (lesson) {
        cell.rowSpan = lesson.span;
        cell.append(lessonBlock(section, lesson));
      } else {
        cell.className = 'schedule-empty';
        cell.textContent = '—';
        cell.setAttribute('aria-label', 'Sem atividade indicada');
      }
    });
  });
  wrap.append(table);
  container.append(wrap);
}

function renderDay(day) {
  document.getElementById('schedule-day-title').textContent = DAYS[day];
  const container = document.getElementById('schedule-day-content');
  container.replaceChildren();
  const section = schedule;
  const card = element('article', 'schedule-day-card');
  const lessons = section.lessons.filter(lesson => lesson.day === day);
  if (lessons.length) {
    const list = element('ol', 'schedule-day-list');
    lessons.forEach(lesson => {
      const item = element('li');
      item.append(lessonBlock(section, lesson));
      list.append(item);
    });
    card.append(list);
  } else {
    card.append(element('p', 'schedule-muted', 'Sem atividades indicadas.'));
  }
  container.append(card);
}

const access = await whenAccessResolved();
if (access.user && access.mode !== 'none') {
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(new Date());
  const today = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(weekday);
  const select = document.getElementById('schedule-day');
  select.value = String(Math.max(0, today));
  renderWeek();
  renderDay(Number(select.value));
  select.addEventListener('change', () => renderDay(Number(select.value)));
  document.getElementById('schedule-print').addEventListener('click', () => window.print());
  document.getElementById('schedule-content').setAttribute('aria-busy', 'false');
}
