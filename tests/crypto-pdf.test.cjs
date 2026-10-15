const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '');
const browserSource = name => read(name).replace(/^import .*;\r?\n/gm, '').replace(/^export \{.*\};?\s*$/gm, '').replace(/^export /gm, '');

function setup() {
  const logs = [];
  const documents = [];
  const buttons = new Map(['#btn-pdf', '#btn-pdf-save-as'].map(selector => [selector, {
    disabled: false,
    events: {},
    addEventListener(name, handler) { this.events[name] = handler; }
  }]));
  class Pdf {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 842, getHeight: () => 595 } };
      this.texts = [];
      this.saved = [];
      documents.push(this);
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    text(text) { this.texts.push(text); }
    getTextWidth(text) { return text.length; }
    autoTable(options) { this.table = options; this.lastAutoTable = { finalY: 200 }; }
    async save(...args) { this.saved.push(args); }
    output(type) { assert.equal(type, 'blob'); return new Blob(['%PDF-1.3'], { type: 'application/pdf' }); }
  }
  const window = { jspdf: { jsPDF: Pdf } };
  const context = vm.createContext({
    window, document: { querySelector: selector => buttons.get(selector) || null },
    Intl, Map, Set, Blob, CONFIG: { SMALL_USD_THRESHOLD: 5 },
    console: { error: (...args) => logs.push(['console', ...args]) },
    capture: (type, text) => logs.push([type, text])
  });
  vm.runInContext(browserSource('js/state.js') + '\n' + browserSource('js/formatters.js') + '\n' + browserSource('js/crypto-ui.js') + `
    ToastService.success = text => capture('success', text);
    ToastService.error = text => capture('error', text);
    ToastService.info = text => capture('info', text);
    globalThis.app = new CryptoPortfolioApp();
  `, context);
  const app = context.app;
  app.initialized = true;
  app.state.currentRows = [
    { asset: 'BTC', quantity: 1, valueEUR: 10, valueUSDT: 11, location: 'Kraken Spot' },
    { asset: 'DUST', quantity: 0.1, valueEUR: 1, valueUSDT: 1, location: 'Ledger' },
    { asset: 'ZERO', quantity: 0, valueEUR: 0, valueUSDT: 0, location: 'Ledger' }
  ];
  app.getAssetInvestedAmounts = () => ({ eur: 0, usd: 0 });
  app.getTotalInvestedAmounts = () => ({ eur: 0, usd: 0 });
  app.getDeallocateValue = () => '';
  app.getApyValue = () => null;
  app.formatApy = () => '--';
  app.canonicalizeLocation = value => value;
  return { app, window, logs, documents, buttons, Pdf };
}

test('o PDF inclui posições pequenas e de saldo zero mesmo com o filtro ativo', () => {
  const { app } = setup();
  assert.equal(app.state.visibleRows.length, 1);
  const { doc, filename } = app.createPortfolioPdf();
  assert.deepEqual(Array.from(doc.table.body, row => row[0]), ['BTC', 'DUST', 'ZERO']);
  assert.equal(doc.table.body.length, app.state.currentRows.length);
  assert.equal(app.state.hideSmall, true);
  assert.match(doc.texts.find(text => text.startsWith('Total:')), /11/);
  assert.match(filename, /^Crypto_Portfolio_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.pdf$/);
});

test('o download habitual aguarda a biblioteca e não afirma que gravou um ficheiro', async () => {
  const { app, documents, logs } = setup();
  await app.exportToPdf();
  assert.equal(documents[0].saved.length, 1);
  assert.equal(documents[0].saved[0][1].returnPromise, true);
  assert.equal(logs.some(([type]) => type === 'success'), false);
  assert.ok(logs.some(([type, text]) => type === 'info' && /iniciado/.test(text)));
});

test('guardar em pasta escreve o PDF e só confirma após fechar o ficheiro', async () => {
  const { app, window, logs, buttons, documents } = setup();
  const writes = [];
  let finish;
  let pickerOptions;
  window.showSaveFilePicker = async options => {
    pickerOptions = options;
    return { createWritable: async () => ({
      write: async blob => writes.push(blob),
      close: () => new Promise(resolve => { finish = resolve; })
    }) };
  };
  const pending = app.exportToPdf({ chooseLocation: true });
  await new Promise(setImmediate);
  assert.equal(writes[0].type, 'application/pdf');
  assert.equal(pickerOptions.id, 'crypto-portfolio-pdf');
  assert.match(pickerOptions.suggestedName, /\.pdf$/);
  assert.equal(logs.some(([type]) => type === 'success'), false);
  assert.equal(buttons.get('#btn-pdf').disabled, true);
  await app.exportToPdf(); // A second click cannot start another export.
  assert.equal(documents.length, 1);
  finish();
  await pending;
  assert.ok(logs.some(([type]) => type === 'success'));
  assert.equal(buttons.get('#btn-pdf').disabled, false);
  assert.equal(documents[0].saved.length, 0);
});

test('cancelar a escolha não inicia um download alternativo', async () => {
  const { app, window, documents, logs, buttons } = setup();
  window.showSaveFilePicker = async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); };
  await app.exportToPdf({ chooseLocation: true });
  assert.equal(documents[0].saved.length, 0);
  assert.equal(logs.some(([type]) => type === 'success' || type === 'error'), false);
  assert.ok(logs.some(([type, text]) => type === 'info' && /cancelada/.test(text)));
  assert.equal(buttons.get('#btn-pdf-save-as').disabled, false);
});

test('falhar a escrita aborta o ficheiro e permite repetir sem anunciar sucesso', async () => {
  const { app, window, logs, documents } = setup();
  let aborted = false;
  window.showSaveFilePicker = async () => ({ createWritable: async () => ({
    write: async () => { throw new Error('disk full'); },
    close: async () => assert.fail('cannot close a failed write'),
    abort: async () => { aborted = true; }
  }) });
  await app.exportToPdf({ chooseLocation: true });
  assert.equal(aborted, true);
  assert.ok(logs.some(([type]) => type === 'error'));
  assert.equal(logs.some(([type]) => type === 'success'), false);
  assert.equal(documents[0].saved.length, 0);
  await app.exportToPdf();
  assert.equal(documents[1].saved.length, 1);
});

test('sem suporte para escolher pasta usa o download habitual', async () => {
  const { app, documents, logs } = setup();
  await app.exportToPdf({ chooseLocation: true });
  assert.equal(documents[0].saved.length, 1);
  assert.ok(logs.some(([type, text]) => type === 'info' && /download habitual/.test(text)));
});

test('um bloqueio do seletor é comunicado sem iniciar outro download', async () => {
  const { app, window, documents, logs } = setup();
  window.showSaveFilePicker = async () => { throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); };
  await app.exportToPdf({ chooseLocation: true });
  assert.equal(documents[0].saved.length, 0);
  assert.ok(logs.some(([type]) => type === 'error'));
});

test('não exporta enquanto a sessão não está carregada nem quando não há posições', async () => {
  const { app, documents } = setup();
  app.initialized = false;
  await app.exportToPdf();
  assert.equal(documents.length, 0);
  app.initialized = true;
  app.state.currentRows = [];
  await app.exportToPdf();
  assert.equal(documents.flatMap(doc => doc.saved).length, 0);
});

test('os botões encaminham a exportação para o destino escolhido', () => {
  const { app, buttons } = setup();
  const choices = [];
  app.exportToPdf = ({ chooseLocation }) => choices.push(chooseLocation);
  app.setupPdf();
  buttons.get('#btn-pdf').events.click({ preventDefault() {} });
  buttons.get('#btn-pdf-save-as').events.click({ preventDefault() {} });
  assert.deepEqual(choices, [false, true]);
});
