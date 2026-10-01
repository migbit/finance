const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../js/tmt.js');
const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '');
const tmt = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(source, tmt, { filename: file });

function fatura(overrides = {}) {
  return {
    ano: 2026, mes: 7, apartamento: '123', noites: 10,
    hospedesAdultos: 2, valorOperador: 42, valorTmt: 3,
    noitesExtra: 0, ...overrides
  };
}

test('mantém os valores manuais dos trimestres anteriores a julho de 2026', () => {
  const grupos = tmt.agruparPorAnoTrimestreApartamento([
    fatura({ ano: 2025, mes: 9, noitesExtra: 4 }),
    fatura({ mes: 3, noitesExtra: 2 }),
    fatura({ mes: 6, noitesExtra: 0 })
  ]);
  assert.equal(grupos['123']['2025-3'].noitesExtra, 4);
  assert.equal(grupos['123']['2026-1'].noitesExtra, 2);
  assert.equal(grupos['123']['2026-2'].noitesExtra, 0);
  assert.match(tmt.gerarHTMLDetalhesTMT([fatura({ mes: 6 })]), /<td>14<\/td>\s*<td>0<\/td>/);
});

test('conta apenas as dormidas dos adultos acima de sete noites desde julho de 2026', () => {
  assert.equal(tmt.calcularNoitesExtra(fatura()), 6);
  assert.equal(tmt.calcularNoitesExtra(fatura({ noites: 7 })), 0);
  assert.equal(tmt.calcularNoitesExtra(fatura({ noites: 4 })), 0);
  assert.equal(tmt.calcularNoitesExtra(fatura({ hospedesAdultos: 0 })), 0);
  assert.equal(tmt.calcularNoitesExtra(fatura({ hospedesCriancas: 3, hospedesBebes: 1 })), 6);
  assert.equal(tmt.calcularNoitesExtra(fatura({ ano: '2027', mes: '1', noites: '8', hospedesAdultos: '3' })), 3);
  assert.equal(tmt.calcularNoitesExtra(fatura({ noitesExtra: 6 })), 6);
});

test('preserva o valor manual quando faltam dados válidos da estadia', () => {
  for (const valor of [undefined, null, '', 'inválido', -1]) {
    assert.equal(tmt.calcularNoitesExtra(fatura({ noites: valor, noitesExtra: 5 })), 5);
    assert.equal(tmt.calcularNoitesExtra(fatura({ hospedesAdultos: valor, noitesExtra: 5 })), 5);
  }
});

test('corrige julho, agosto e setembro de 2026 nos dois apartamentos', () => {
  for (const apartamento of ['123', '1248']) {
    const faturas = [7, 8, 9].map(mes => fatura({ apartamento, mes }));
    const grupos = tmt.agruparPorAnoTrimestreApartamento(faturas);
    assert.equal(grupos[apartamento]['2026-3'].noitesExtra, 18);
    for (const registo of faturas) {
      assert.match(tmt.gerarHTMLDetalhesTMT([registo]), /<td>14<\/td>\s*<td>6<\/td>/);
    }
    assert.match(tmt.gerarRelatorioTMTDeApt(faturas, apartamento), /<td>2026<\/td>\s*<td>3º<\/td>\s*<td>42<\/td>\s*<td>18<\/td>\s*<td>0<\/td>\s*<td>60<\/td>/);
  }
});

test('soma por reserva, trimestre e apartamento e apresenta o mesmo valor nos detalhes', () => {
  const faturas = [
    fatura(),
    fatura({ mes: 8, noites: 9, hospedesAdultos: 3 }),
    fatura({ apartamento: 1248, noites: 8, hospedesAdultos: 4 }),
    fatura({ mes: 10, noites: 12 })
  ];
  const grupos = tmt.agruparPorAnoTrimestreApartamento(faturas);
  assert.equal(grupos['123']['2026-3'].noitesExtra, 12);
  assert.equal(grupos['1248']['2026-3'].noitesExtra, 4);
  assert.equal(grupos['123']['2026-4'].noitesExtra, 10);
  assert.match(tmt.gerarHTMLDetalhesTMT([faturas[0]]), /<td>14<\/td>\s*<td>6<\/td>/);
  assert.match(tmt.gerarRelatorioTMTDeApt(faturas, '123'), /<td>3º<\/td>\s*<td>28<\/td>\s*<td>12<\/td>\s*<td>0<\/td>\s*<td>40<\/td>/);
  assert.match(tmt.gerarRelatorioTMTDeApt(faturas, '1248'), /<td>3º<\/td>\s*<td>14<\/td>\s*<td>4<\/td>/);
});
