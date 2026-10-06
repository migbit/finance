const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function setup(initial = []) {
  const data = new Map(initial.map(row => [row.id, { ...row }]));
  const elements = new Map();
  for (const id of ['manual-hours-form', 'manual-entry-date', 'manual-entry-hours', 'manual-entry-apartment', 'hours-filter-year', 'hours-filter-month', 'hours-filter-apartment']) {
    elements.set(id, { value: '', focus() {}, querySelector() { return this.button ||= { disabled: false }; } });
  }
  const prompts = [];
  const toasts = [];
  let count = 0;
  const context = {
    console, URL, db: {},
    document: { getElementById: id => elements.get(id) || null, addEventListener() {} },
    window: { prompt: () => prompts.shift() },
    showToast: (...args) => toasts.push(args),
    collection: (_, name) => name,
    doc: (_, name, id) => ({ name, id }),
    serverTimestamp: () => 123,
    addDoc: async (_, row) => { data.set(`auto-${++count}`, row); },
    updateDoc: async ({ id }, patch) => { assert.ok(data.has(id)); data.set(id, { ...data.get(id), ...patch }); },
    deleteDoc: async ({ id }) => data.delete(id)
  };
  vm.createContext(context);
  const source = fs.readFileSync('js/cleaning-hours-admin.js', 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '');
  vm.runInContext(source, context);
  vm.runInContext("accessRows = [{ employeeId: 'natally-limpeza', employeeName: 'Natally', hourlyRate: 8 }];", context);
  context.seed = initial;
  vm.runInContext('entryRows = seed;', context);
  async function add(hours, apartment) {
    elements.get('manual-entry-date').value = '2026-10-03';
    elements.get('manual-entry-hours').value = String(hours);
    elements.get('manual-entry-apartment').value = apartment;
    await context.handleManualEntry({ preventDefault() {} });
  }
  return { context, data, elements, prompts, toasts, add };
}

test('adding 2h in 123 and 3h in 1248 on the same day preserves both entries', async () => {
  const { add, data, toasts, elements } = setup();
  await add(2, '123');
  await add(3, '1248');
  assert.equal(data.size, 2);
  assert.deepEqual([...data.values()].map(r => [r.date, r.hours, r.apartment]), [
    ['2026-10-03', 2, '123'], ['2026-10-03', 3, '1248']
  ]);
  assert.equal([...data.values()].reduce((sum, r) => sum + r.hours, 0), 5);
  assert.ok(toasts.every(t => t[1] === 'success'));
  assert.equal(elements.get('manual-entry-date').value, '2026-10-03');
});

test('editing a legacy entry into an occupied date preserves the other entry', async () => {
  const first = { id: 'natally-limpeza__2026-10-02', employeeId: 'natally-limpeza', date: '2026-10-02', hours: 2, apartment: '123' };
  const other = { id: 'natally-limpeza__2026-10-03', employeeId: 'natally-limpeza', date: '2026-10-03', hours: 3, apartment: '1248' };
  const { context, prompts, data } = setup([first, other]);
  prompts.push('2026-10-03', '2.5', '123');
  await context.editEntry(first.id);
  assert.equal(data.size, 2);
  assert.deepEqual(data.get(other.id), other);
  assert.equal(data.get(first.id).date, '2026-10-03');
  assert.equal(data.get(first.id).hours, 2.5);
});

test('new entries preserve existing legacy records and allow repeated work in the same apartment', async () => {
  const old = { id: 'natally-limpeza__2026-10-03', employeeId: 'natally-limpeza', date: '2026-10-03', hours: 2, apartment: '123' };
  const { add, data } = setup([old]);
  await add(3, '1248');
  await add(1, '1248');
  assert.equal(data.size, 3);
  assert.deepEqual(data.get(old.id), old);
});

test('double submission while saving creates only one entry', async () => {
  const { context, add, data } = setup();
  await Promise.all([add(2, '123'), context.handleManualEntry({ preventDefault() {} })]);
  assert.equal(data.size, 1);
});

test('monthly filters and amounts use Natally configuration', () => {
  const { context, elements } = setup();
  elements.get('hours-filter-year').value = '2026';
  elements.get('hours-filter-month').value = '10';
  const rows = [
    { employeeId: 'natally-limpeza', date: '2026-10-03', hours: 2, apartment: '123' },
    { employeeId: 'other', date: '2026-10-03', hours: 10, apartment: '123' },
    { employeeId: 'natally-limpeza', date: '2026-09-03', hours: 3, apartment: '1248' }
  ];
  assert.equal(context.applyFilters(rows).length, 1);
  assert.equal(context.getEntryAmount(rows[0]), 16);
});
