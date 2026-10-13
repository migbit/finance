const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync('js/faturas.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
const html = fs.readFileSync('modules/faturas.html', 'utf8');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(initial = []) {
  const elements = new Map();
  class Element {
    constructor(tag = 'div', id = '', value = '') {
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.value = value;
      this.defaultValue = value;
      this.disabled = false;
      this.dataset = {};
      this.style = {};
      this.children = [];
      this.events = {};
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name),
        toggle: name => this.classes.has(name) ? this.classes.delete(name) : this.classes.add(name)
      };
      this.textContent = '';
    }
    set value(value) { this.inputValue = String(value); }
    get value() { return this.inputValue; }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text; }
    addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
    async emit(name, event = {}) {
      for (const fn of this.events[name] || []) await fn({ preventDefault() {}, ...event });
    }
    appendChild(child) { this.children.push(child); if (child.id) elements.set(child.id, child); }
    before(child) { if (child.id) elements.set(child.id, child); }
    setAttribute(name, value) { this[name] = value; }
    querySelector() { return null; }
    focus() {}
    scrollIntoView() {}
    remove() {}
  }
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || '';
    elements.set(match[2], new Element(match[1], match[2], value));
  }
  const fields = [...elements.values()].filter(el => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
  const form = elements.get('fatura-form');
  const buttons = ['submit-fatura', 'cancelar-edicao', 'fatura-prev', 'fatura-next'].map(id => elements.get(id));
  elements.get('canal').value = elements.get('canal').defaultValue = 'AIRBNB';
  elements.get('fatura-form-wrap').classList.add('hidden');
  form.querySelectorAll = selector => selector === 'button' ? buttons : fields;
  form.reset = () => fields.forEach(field => { field.value = field.defaultValue; });
  const body = new Element();
  body.contains = el => body.children.includes(el);
  const document = new Element();
  document.body = body;
  document.getElementById = id => elements.get(id) || null;
  document.querySelector = () => null;
  document.createElement = tag => new Element(tag);
  document.createTextNode = text => ({ textContent: text });
  const window = new Element();
  window.location = { search: '' };
  const state = { rows: initial.map(row => ({ ...row })), reads: 0, writes: [], confirmations: [], answer: false };
  const context = vm.createContext({
    document, window, console: { error() {}, warn() {} }, URLSearchParams,
    requestAnimationFrame: fn => fn(), setTimeout: () => 0,
    confirm: text => { state.confirmations.push(text); return state.answer; },
    db: {}, collection: (_, name) => name, query: (...args) => args,
    orderBy: (...args) => args, doc: (_, name, id) => ({ name, id }),
    getDocs: async () => {
      state.reads++;
      if (state.read) return state.read();
      return { docs: state.rows.map(row => ({ id: row.id, data: () => ({ ...row }) })) };
    },
    addDoc: async (_, row) => {
      if (state.save) await state.save();
      state.writes.push({ type: 'add', row: { ...row } });
      const saved = { ...row, id: `new-${state.writes.length}` };
      state.rows.push(saved);
      return { id: saved.id };
    },
    updateDoc: async ({ id }, row) => {
      if (state.save) await state.save();
      state.writes.push({ type: 'update', row: { ...row } });
      Object.assign(state.rows.find(item => item.id === id), row);
    },
    deleteDoc: async () => { throw new Error('These tests must never delete invoices'); }
  });
  vm.runInContext(source, context);
  const set = (id, value) => { elements.get(id).value = String(value); };
  const get = id => elements.get(id);
  const fill = () => {
    for (const [id, value] of Object.entries({ apartamento: '123', ano: '2026', mes: '10',
      'numero-fatura': 'M100', 'taxa-airbnb': '30', 'valor-transferencia': '270',
      'valor-operador': '18', noites: '3', adultos: '2', criancas: '1', bebes: '0' })) set(id, value);
  };
  return { context, state, document, window, form, set, get, fill,
    submit: () => form.emit('submit'), init: () => document.emit('DOMContentLoaded'),
    toasts: () => body.children.flatMap(stack => stack.children.map(toast => toast.textContent)) };
}

function invoice(overrides = {}) {
  return { id: 'a', numeroFatura: 'M100', canal: 'AIRBNB', apartamento: '123',
    ano: new Date().getFullYear(), mes: 10, taxaAirbnb: 30, valorTransferencia: 270,
    valorOperador: 18, noites: 3, noitesExtra: 0, noitesCriancas: 0, valorDireto: 0,
    valorTmt: 3, hospedesAdultos: 2, hospedesCriancas: 1, hospedesBebes: 0,
    timestamp: { seconds: 100 }, ...overrides };
}

test('numbering uses the maximum in each series, even when an old invoice was added last', async () => {
  const { context } = setup([
    invoice({ numeroFatura: 'M2' }), invoice({ numeroFatura: 'M100', timestamp: null }),
    invoice({ numeroFatura: 'V009' }), invoice({ numeroFatura: 'D012' })
  ]);
  assert.equal(await context.getNextInvoiceNumber('AIRBNB'), 'M101');
  assert.equal(await context.getNextInvoiceNumber('VRBO'), 'V010');
  assert.equal(await context.getNextInvoiceNumber('DIRETO'), 'D013');
  assert.equal(await setup().context.getNextInvoiceNumber('VRBO'), 'V001');
});

test('a delayed number suggestion cannot overwrite a number typed by the user', async () => {
  const app = setup();
  const pending = deferred();
  app.state.read = () => pending.promise;
  const request = app.context.definirValoresPadrao();
  app.set('numero-fatura', 'M999');
  pending.resolve({ docs: [] });
  await request;
  assert.equal(app.get('numero-fatura').value, 'M999');
  assert.equal(app.context.hasUnsavedChanges(), true);
});

test('double submission writes once and preserves all invoice data and the automatic average', async () => {
  const app = setup();
  app.fill();
  app.set('preco-medio-noite', '999');
  const pending = deferred();
  app.state.save = () => pending.promise;
  const saving = app.submit();
  await app.submit();
  assert.equal(app.get('submit-fatura').disabled, true);
  assert.equal(app.form.inert, true);
  pending.resolve();
  await saving;
  assert.equal(app.state.writes.length, 1);
  assert.equal(app.state.writes[0].row.precoMedioNoite, 100);
  assert.equal(app.state.writes[0].row.hospedesCriancas, 1);
  assert.equal(app.state.writes[0].row.valorOperador, 18);
  assert.equal(app.get('submit-fatura').disabled, false);
  assert.equal(app.form.inert, false);
  assert.equal(app.context.hasUnsavedChanges(), false);
});

test('duplicate numbers are refused without clearing the form or modifying existing invoices', async () => {
  const old = invoice({ numeroFatura: 'M0100' });
  const app = setup([old]);
  app.fill();
  await app.submit();
  assert.equal(app.state.writes.length, 0);
  assert.equal(app.get('numero-fatura').value, 'M100');
  assert.deepEqual(app.state.rows, [old]);
  assert.ok(app.toasts().some(text => text.includes('Já existe')));
});

test('editing the same invoice keeps its number, timestamp and other records', async () => {
  const original = invoice();
  const other = invoice({ id: 'b', numeroFatura: 'M101' });
  const app = setup([original, other]);
  await app.context.carregarTodosRelatorios();
  await app.context.entrarEmModoEdicao(original);
  app.set('valor-transferencia', '300');
  await app.submit();
  assert.equal(app.state.writes.length, 1);
  assert.equal(app.state.writes[0].type, 'update');
  assert.equal(app.state.rows[0].precoMedioNoite, 110);
  assert.deepEqual(app.state.rows[0].timestamp, original.timestamp);
  assert.deepEqual(app.state.rows[1], other);
  assert.equal(app.get('fatura-id-edicao').value, 'a');
  assert.equal(app.context.hasUnsavedChanges(), false);
});

test('failed saves preserve inputs and allow a retry', async () => {
  const app = setup();
  app.fill();
  app.state.save = async () => { throw new Error('offline'); };
  await app.submit();
  assert.equal(app.state.writes.length, 0);
  assert.equal(app.get('valor-transferencia').value, '270');
  assert.equal(app.get('submit-fatura').disabled, false);
  assert.equal(app.context.hasUnsavedChanges(), true);
  app.state.save = null;
  await app.submit();
  assert.equal(app.state.writes.length, 1);
});

test('previous/next and explicit editing ask before discarding changes, but clean navigation does not', async () => {
  const first = invoice(), second = invoice({ id: 'b', numeroFatura: 'M101' });
  const app = setup([first, second]);
  await app.context.carregarTodosRelatorios();
  await app.context.entrarEmModoEdicao(first);
  app.set('adultos', '4');
  await app.get('fatura-next').emit('click');
  assert.equal(app.get('fatura-id-edicao').value, 'a');
  assert.equal(app.get('adultos').value, '4');
  assert.equal(app.state.confirmations.length, 1);
  app.state.answer = true;
  await app.context.entrarEmModoEdicao(second);
  assert.equal(app.get('fatura-id-edicao').value, 'b');
  assert.equal(app.context.hasUnsavedChanges(), false);
  await app.context.entrarEmModoEdicao(first);
  assert.equal(app.state.confirmations.length, 2);
});

test('leaving the page warns only when there are unsaved changes', async () => {
  const app = setup();
  let warned = 0;
  await app.window.emit('beforeunload', { preventDefault() { warned++; } });
  assert.equal(warned, 0);
  app.set('adultos', '4');
  await app.window.emit('beforeunload', { preventDefault() { warned++; } });
  assert.equal(warned, 1);
});

test('cancel runs once, closes the form, and restores year, month and next invoice number', async () => {
  const app = setup([invoice()]);
  await app.init();
  await app.context.entrarEmModoEdicao(invoice());
  const reads = app.state.reads;
  await app.get('cancelar-edicao').emit('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.state.reads - reads, 1);
  assert.equal(Number(app.get('ano').value), new Date().getFullYear());
  assert.equal(Number(app.get('mes').value), new Date().getMonth() + 1);
  assert.equal(app.get('numero-fatura').value, 'M101');
  assert.equal(app.get('fatura-id-edicao').value, '');
  assert.equal(app.get('fatura-form-wrap').classList.contains('hidden'), true);
  assert.equal(app.context.hasUnsavedChanges(), false);
});

test('average is consistent in form, saved data and details, including date-based nights', async () => {
  const app = setup();
  app.fill();
  app.set('valor-transferencia', '100');
  app.set('taxa-airbnb', '0');
  app.context.calcAndSetPrecoMedioNoite();
  assert.equal(app.get('preco-medio-noite').value, '33.33');
  app.set('noites', '');
  app.set('checkin', '2026-10-01');
  app.set('checkout', '2026-10-04');
  await app.submit();
  const saved = app.state.writes[0].row;
  assert.equal(saved.noites, 3);
  assert.equal(saved.precoMedioNoite, 33.33);
  assert.match(app.context.gerarHTMLDetalhesFaturacao([saved]), /33,33 €/);
  assert.equal(app.context.calcularPrecoMedioNoite(100, 0, 0), null);
  assert.equal(app.context.calcularPrecoMedioNoite(100, 0, null), null);
});

test('VRBO and direct bookings keep zero Airbnb/TMT amounts and their fields remain available for Airbnb', async () => {
  for (const channel of ['VRBO', 'DIRETO']) {
    const app = setup();
    app.fill();
    app.set('canal', channel);
    await app.context.applyChannelSelection();
    await app.submit();
    const saved = app.state.writes[0].row;
    assert.equal(saved.canal, channel);
    assert.equal(saved.taxaAirbnb, 0);
    assert.equal(saved.valorTmt, 0);
    assert.equal(saved.precoMedioNoite, 90);
    assert.equal(app.get('taxa-airbnb').disabled, false);
    assert.equal(app.get('valor-tmt').disabled, false);
  }
});

test('initial read failures leave buttons active and show an error with a working retry', async () => {
  const app = setup();
  app.state.read = async () => { throw new Error('offline'); };
  await app.init();
  await app.get('toggle-fatura-form').emit('click');
  assert.equal(app.get('fatura-form-wrap').classList.contains('hidden'), false);
  const status = app.get('faturas-report-status');
  assert.match(status.textContent, /Não foi possível carregar/);
  assert.ok(app.toasts().some(text => text.includes('Preencha o número')));
  app.state.read = null;
  await status.children.find(child => child.tagName === 'BUTTON').emit('click');
  assert.equal(status.hidden, true);
  assert.match(app.get('relatorio-faturacao').textContent, /Não existem faturas/);
});

test('failed refresh preserves the previously loaded report and navigation data', async () => {
  const app = setup([invoice()]);
  await app.context.carregarTodosRelatorios();
  const previousHTML = app.get('relatorio-faturacao').innerHTML;
  app.state.read = async () => { throw new Error('offline'); };
  assert.equal(await app.context.carregarTodosRelatorios(), false);
  assert.equal(app.get('relatorio-faturacao').innerHTML, previousHTML);
  assert.equal(vm.runInContext('loadedFaturas.length', app.context), 1);
  assert.match(app.get('faturas-report-status').textContent, /desatualizados/);
});

test('a successful save followed by a failed refresh is still reported as saved', async () => {
  const app = setup();
  app.fill();
  app.state.save = async () => {
    app.state.read = async () => { throw new Error('offline after write'); };
  };
  await app.submit();
  assert.equal(app.state.writes.length, 1);
  assert.equal(app.context.hasUnsavedChanges(), false);
  assert.ok(app.toasts().some(text => text.includes('registada com sucesso')));
  assert.ok(app.toasts().every(text => !text.includes('erro ao gravar')));
  assert.match(app.get('faturas-report-status').textContent, /Não foi possível carregar/);
});

test('checkout before checkin blocks saving before any database access and keeps entered values', async () => {
  const app = setup();
  app.fill();
  app.set('checkin', '2026-10-15');
  app.set('checkout', '2026-10-12');
  await app.submit();
  assert.equal(app.state.reads, 0);
  assert.equal(app.state.writes.length, 0);
  assert.equal(app.get('checkin').value, '2026-10-15');
  assert.equal(app.get('checkout').value, '2026-10-12');
  assert.equal(app.get('noites').value, '3');
  assert.ok(app.toasts().some(text => text.includes('check-out não pode ser anterior')));
  app.set('checkout', '2026-10-18');
  await app.submit();
  assert.equal(app.state.writes.length, 1);
});

test('night mismatch warns and allows either correcting the input or keeping a deliberate adjustment', async () => {
  const app = setup();
  app.fill();
  app.set('checkin', '2026-10-01');
  app.set('checkout', '2026-10-05');
  await app.submit();
  assert.equal(app.state.reads, 0);
  assert.equal(app.state.writes.length, 0);
  assert.equal(app.get('noites').value, '3');
  assert.match(app.state.confirmations[0], /4 noite\(s\).*indicou 3/);
  app.state.answer = true;
  await app.submit();
  assert.equal(app.state.writes[0].row.noites, 3);
  assert.equal(app.state.writes[0].row.precoMedioNoite, 100);
});

test('automatic nights use calendar days across daylight saving changes and year boundaries', async () => {
  const app = setup();
  await app.init();
  for (const [checkIn, checkOut, expected] of [
    ['2026-03-28', '2026-03-30', 2],
    ['2026-10-24', '2026-10-26', 2],
    ['2026-12-30', '2027-01-02', 3],
    ['2026-10-12', '2026-10-12', 0]
  ]) {
    app.set('checkin', checkIn);
    app.set('checkout', checkOut);
    await app.get('checkout').emit('change');
    assert.equal(Number(app.get('noites').value), expected);
  }
  app.set('checkout', '');
  await app.get('checkout').emit('change');
  assert.equal(app.get('noites').value, '');
});

test('optional missing dates still allow invoices with manually entered nights', async () => {
  const app = setup();
  app.fill();
  app.set('checkin', '2026-10-01');
  await app.submit();
  assert.equal(app.state.writes[0].row.noites, 3);
  assert.equal(app.state.writes[0].row.checkOut, null);
  assert.equal(app.state.confirmations.length, 0);
});

test('new invoices suggest 70 or 80 euros while preserving manual cleaning fees including zero', async () => {
  const app = setup();
  await app.init();
  assert.equal(app.get('taxa-limpeza').value, '');
  for (const [apartment, expected] of [['123', '70'], ['1248', '80']]) {
    app.set('apartamento', apartment);
    app.set('taxa-limpeza', '');
    await app.get('apartamento').emit('change');
    assert.equal(app.get('taxa-limpeza').value, expected);
    for (const manual of ['65', '95', '0']) {
      app.set('taxa-limpeza', manual);
      await app.get('apartamento').emit('change');
      assert.equal(app.get('taxa-limpeza').value, manual);
    }
  }
});

test('editing historical and future invoices never applies current cleaning defaults', async () => {
  for (const fee of [60, 65, 70, 80, 95, 0, null]) {
    const original = invoice({ taxaLimpeza: fee, checkIn: '2027-10-01', checkOut: '2027-10-04' });
    const app = setup([original]);
    await app.init();
    await app.context.entrarEmModoEdicao(original);
    assert.equal(app.get('taxa-limpeza').value, fee === null ? '' : String(fee));
    await app.get('apartamento').emit('change');
    assert.equal(app.get('taxa-limpeza').value, fee === null ? '' : String(fee));
    assert.deepEqual(app.state.rows, [original]);
    assert.equal(app.state.writes.length, 0);
    if (fee !== null) {
      await app.submit();
      assert.equal(app.state.writes[0].row.taxaLimpeza, fee);
    }
  }
});

test('two consecutive invoices in the same apartment and month retain different cleaning fees', async () => {
  const app = setup();
  await app.init();
  for (const [number, fee] of [['M100', '70'], ['M101', '90']]) {
    app.fill();
    app.set('numero-fatura', number);
    await app.get('apartamento').emit('change');
    assert.equal(app.get('taxa-limpeza').value, '70');
    app.set('taxa-limpeza', fee);
    app.set('checkin', '2027-10-01');
    app.set('checkout', '2027-10-04');
    await app.submit();
  }
  assert.deepEqual(app.state.rows.map(row => row.taxaLimpeza), [70, 90]);
  assert.ok(app.state.rows.every(row => row.apartamento === '123' && row.mes === 10));
});
