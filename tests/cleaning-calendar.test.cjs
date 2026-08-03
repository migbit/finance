const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const implementations = [
  {
    name: 'calendário público',
    file: 'js/cleaning-hours-public.js',
    buildFunction: 'buildSchedule'
  },
  {
    name: 'imagem do calendário',
    file: 'js/cleaning-calendar.js',
    buildFunction: 'buildCleaningSchedule'
  }
];

function loadImplementation({ file, buildFunction }) {
  const filePath = path.resolve(__dirname, '..', file);
  const source = fs.readFileSync(filePath, 'utf8').replace(/^import .*;\r?\n/gm, '');
  const context = {
    console,
    document: {
      addEventListener() {},
      getElementById() { return null; },
      visibilityState: 'visible'
    },
    window: {
      location: { search: '' },
      setInterval() {}
    },
    URL,
    URLSearchParams
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: filePath });

  return {
    buildSchedule: context[buildFunction],
    addDeferredCleaningAlternatives: context.addDeferredCleaningAlternatives
  };
}

for (const implementation of implementations) {
  test(`${implementation.name}: permite adiar para o check-in do dia seguinte`, () => {
    const {
      buildSchedule,
      addDeferredCleaningAlternatives
    } = loadImplementation(implementation);
    const dates = [
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06'
    ];
    const calendars = {
      '123': {
        bookings: [
          { start: '2026-08-02', end: '2026-08-04' },
          { start: '2026-08-05', end: '2026-08-08' }
        ],
        assumeTurnoverToday: false
      },
      '1248': {
        bookings: [
          { start: '2026-08-01', end: '2026-08-04' },
          { start: '2026-08-04', end: '2026-08-09' }
        ],
        assumeTurnoverToday: false
      }
    };
    const schedules = {
      '123': buildSchedule(dates, calendars['123']),
      '1248': buildSchedule(dates, calendars['1248'])
    };

    addDeferredCleaningAlternatives(dates, schedules, calendars);

    assert.equal(schedules['1248']['2026-08-04'], 'required');
    assert.equal(schedules['123']['2026-08-04'], 'optional');
    assert.equal(schedules['123']['2026-08-05'], 'optional');
  });
}
