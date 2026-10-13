// Run with PLAYWRIGHT_MODULE and, optionally, BROWSER_EXECUTABLE.
// Local synthetic records only; no Firebase access or writes to the system clipboard.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const shared = await readFile(join(root, 'js/script.js'), 'utf8');
const fixtureScript = shared.slice(0, shared.indexOf('initNavWhenReady();')) +
  shared.slice(shared.indexOf('function atualizarInterface('), shared.indexOf('export function isCurrentUserFilipa')) + `
  export const db = {};
  currentUser = { uid: 'tmt-test', displayName: 'Teste' };
  buildGlobalNav(currentUser);
  document.documentElement.classList.remove('app-access-pending');
  resolveAccessReady({ user: currentUser });`;
const records = [
  { ano: 2026, mes: 7, apartamento: '123', canal: 'AIRBNB', valorOperador: 42, valorTmt: 3, noites: 10, hospedesAdultos: 2, hospedesCriancas: 3, hospedesBebes: 1, noitesCriancas: 30 },
  { ano: 2026, mes: 8, apartamento: '1248', canal: 'AIRBNB', valorOperador: 21, valorTmt: 3, noites: 7, hospedesAdultos: 1, hospedesBebes: 2 },
  { ano: 2026, mes: 10, apartamento: '123', canal: 'AIRBNB', valorOperador: 12, valorTmt: 3, noites: 2, hospedesAdultos: 2 },
  { ano: 2025, mes: 7, apartamento: '123', valorOperador: 6, valorTmt: 3, noites: 2, hospedesBebes: 1 },
  { ano: 2026, mes: 7, apartamento: '123', canal: 'DIRETO', valorOperador: 999, valorTmt: 3 },
  { ano: 2026, mes: 7, apartamento: '123', numeroFatura: 'V123', valorOperador: 999, valorTmt: 3 }
];
const firebase = `
  export const collection = () => ({}), query = () => ({}), orderBy = () => ({});
  export const doc = (_db, collection, id) => ({ collection, id });
  export const serverTimestamp = () => 'server-time-fixture';
  const stored = () => JSON.parse(localStorage.getItem('tmt-test-entregas') || '{}');
  export async function getDocsFromServer() {
    if (sessionStorage.getItem('failEntregas')) throw new Error('Falha de leitura das entregas');
    return { docs: Object.entries(stored()).map(([id, data]) => ({ id, data: () => data })) };
  }
  export async function setDoc(ref, data) {
    if (window.failSave) throw new Error('Falha de gravação');
    if (ref.collection !== 'tmt_entregas') throw new Error('Coleção inesperada');
    const items = stored(); items[ref.id] = data;
    localStorage.setItem('tmt-test-entregas', JSON.stringify(items));
  }
  export async function deleteDoc(ref) {
    if (window.failSave) throw new Error('Falha de gravação');
    if (ref.collection !== 'tmt_entregas') throw new Error('Coleção inesperada');
    const items = stored(); delete items[ref.id];
    localStorage.setItem('tmt-test-entregas', JSON.stringify(items));
  }
  export async function getDocs() {
    if (window.failLoad) throw new Error('Falha de teste');
    return { docs: ${JSON.stringify(records)}.map((record, i) => ({ id: String(i), data: () => record })) };
  }`;
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html; charset=utf-8' })[extname(pathname)] || 'application/octet-stream');
  if (pathname === '/js/script.js') { res.end(fixtureScript); return; }
  if (pathname === '/firebase-fixture.js') { res.end(firebase); return; }
  const file = resolve(root, '.' + pathname);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    let content = await readFile(file);
    if (pathname === '/js/tmt.js') content = content.toString().replace('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js', '/firebase-fixture.js');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
  await page.addInitScript(() => {
    window.copies = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => {
      if (window.failCopy) throw new Error('Cópia recusada');
      window.copies.push(value);
    } } });
  });
  const url = `http://127.0.0.1:${server.address().port}/modules/tmt.html`;
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#tmt-ano').disabled);
  assert.equal(await page.locator('#tmt-ano').inputValue(), '2026');
  assert.equal(await page.locator('#tmt-trimestre').inputValue(), '3');
  const values = apt => page.locator(`#tmt-${apt} > .table-wrap:first-child > .tmt-table > tbody > tr:first-child > td > .tmt-value`).allTextContents();
  assert.deepEqual(await values('123'), ['14', '6', '10', '30']);
  assert.deepEqual(await values('1248'), ['7', '0', '14', '21']);
  const delivery = key => page.locator(`[data-entrega="${key}"]`);
  const delivered123 = delivery('123-2026-3');
  const delivered1248 = delivery('1248-2026-3');
  assert.equal(await page.evaluate(() => localStorage.getItem('tmt-test-entregas')), null);
  await delivered123.getByRole('button', { name: 'Marcar como entregue' }).click();
  await page.waitForFunction(() => document.querySelector('[data-entrega="123-2026-3"] .is-entregue'));
  assert.match(await delivered123.textContent(), /Entregue · 12\/10\/2026/);
  assert.match(await delivered1248.textContent(), /Por entregar/);
  await page.locator('#tmt-trimestre').selectOption('4');
  assert.match(await delivery('123-2026-4').textContent(), /Por entregar/);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-entrega="123-2026-3"] .is-entregue'));
  assert.match(await delivered123.textContent(), /12\/10\/2026/);
  await page.evaluate(() => { window.failSave = true; });
  await delivered123.getByRole('button', { name: 'Desfazer entrega' }).click();
  assert.match(await delivered123.textContent(), /Não foi possível guardar/);
  assert.equal(await delivered123.locator('.is-entregue').count(), 1);
  await delivered1248.getByRole('button', { name: 'Marcar como entregue' }).click();
  assert.match(await delivered1248.textContent(), /Por entregar/);
  assert.match(await delivered1248.textContent(), /Não foi possível guardar/);
  await page.evaluate(() => { window.failSave = false; });
  await delivered123.getByRole('button', { name: 'Desfazer entrega' }).click();
  assert.match(await delivered123.textContent(), /Por entregar/);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#tmt-ano').disabled);
  assert.match(await delivered123.textContent(), /Por entregar/);
  await delivered123.getByRole('button', { name: 'Marcar como entregue' }).click();
  await page.evaluate(() => sessionStorage.setItem('failEntregas', '1'));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#tmt-ano').disabled);
  assert.deepEqual(await values('123'), ['14', '6', '10', '30']);
  assert.match(await delivered123.textContent(), /Estado indisponível/);
  assert.equal(await delivered123.locator('.btn-entrega').count(), 0);
  await page.evaluate(() => sessionStorage.removeItem('failEntregas'));
  await delivered123.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.waitForFunction(() => document.querySelector('[data-entrega="123-2026-3"] .is-entregue'));
  const details = page.locator('#tmt-123 > .table-wrap .btn-detalhes').first();
  await details.click();
  assert.equal(await details.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#tmt-123 .tmt-details-row > td').getAttribute('colspan'), '7');
  assert.equal(await page.locator('#tmt-123 .detalhes-table th').count(), 7);
  assert.deepEqual(await page.locator('#tmt-123 .detalhes-table .tmt-value').allTextContents(), ['14', '6', '10', '42,00 €', '3,00 €']);
  await page.locator('#tmt-123 .tmt-total .tmt-value').first().click();
  await page.waitForFunction(() => window.copies.length === 1);
  assert.deepEqual(await page.evaluate(() => window.copies), ['30']);
  assert.equal(await page.locator('#tmt-copy-status').textContent(), '30 copiado');
  const money = page.locator('#tmt-123 .detalhes-table .tmt-value').nth(3);
  await money.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.copies.length === 2);
  assert.deepEqual(await page.evaluate(() => window.copies), ['30', '42,00']);
  await details.click();
  assert.equal(await page.locator('#tmt-123 .tmt-details-row').isVisible(), false);
  // Changing filters must not duplicate event handlers.
  for (const tri of ['4', '3', '4', '3']) await page.locator('#tmt-trimestre').selectOption(tri);
  await details.click();
  assert.equal(await details.getAttribute('aria-expanded'), 'true');
  await page.locator('#tmt-123 .toggle-antigos').click();
  assert.equal(await page.locator('#historico-123').isVisible(), true);
  assert.equal(await page.locator('#historico-123 th').count(), 7);
  await page.locator('#historico-123 .btn-detalhes').click();
  assert.equal(await page.locator('#historico-123 .detalhes-table').isVisible(), true);
  await page.locator('#tmt-123 .toggle-antigos').click();
  await page.locator('#tmt-trimestre').selectOption('1');
  assert.match(await page.locator('#tmt-123').textContent(), /Sem registos no 1.º trimestre de 2026/);
  await page.locator('#tmt-trimestre').selectOption('0');
  assert.equal(await page.locator('#tmt-123 > .table-wrap:first-child .btn-detalhes').count(), 2);
  await page.locator('#tmt-ano').selectOption('2025');
  assert.deepEqual(await values('123'), ['2', '0', '2', '4']);
  await page.locator('#tmt-ano').selectOption('2026');
  await page.locator('#tmt-trimestre').selectOption('3');
  await details.click();
  const shots = join(tmpdir(), 'finance-tmt-preview');
  await mkdir(shots, { recursive: true });
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.querySelector('main > h2').getBoundingClientRect().top >= document.querySelector('header').getBoundingClientRect().bottom), true, `Title under navigation at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    const geometry = await page.locator('#tmt-123').evaluate(el => ({
      table: el.querySelector('.tmt-table').getBoundingClientRect().width,
      details: el.querySelector('.tmt-details-row > td').getBoundingClientRect().width
    }));
    assert.ok(Math.abs(geometry.table - geometry.details) < 3);
    await page.screenshot({ path: join(shots, `tmt-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => { window.failCopy = true; });
  await page.locator('#tmt-123 .tmt-total .tmt-value').first().click();
  await page.waitForFunction(() => document.querySelector('#tmt-copy-status').textContent.includes('indisponível'));
  assert.equal(await page.evaluate(() => window.getSelection().toString()), '30');
  await page.addInitScript(() => { window.failLoad = true; });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#tmt-retry').hidden);
  assert.match(await page.locator('#tmt-status').textContent(), /Não foi possível carregar/);
  await page.evaluate(() => { window.failLoad = false; });
  await page.locator('#tmt-retry').click();
  await page.waitForFunction(() => !document.querySelector('#tmt-ano').disabled);
  assert.deepEqual(await values('123'), ['14', '6', '10', '30']);
  assert.deepEqual(errors, []);
  console.log(`TMT browser checks passed. Screenshots: ${shots}`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
