const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../js/tmt.js');
const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '');
const tmt = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(source, tmt, { filename: file });

// Comparar os valores das células independentemente dos controlos de cópia.
const textoTabela = html => html.replace(/<button[^>]*class="tmt-value"[^>]*>(.*?)<\/button>/gs, '$1')
  .replace(/<td class="tmt-total">/g, '<td>');
const detalhes = items => textoTabela(tmt.gerarHTMLDetalhesTMT(items));
const relatorio = (items, apt, periodo) => textoTabela(tmt.gerarRelatorioTMTDeApt(items, apt, periodo));

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
  assert.match(detalhes([fatura({ mes: 6 })]), /<td>14<\/td>\s*<td>0<\/td>/);
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
      assert.match(detalhes([registo]), /<td>14<\/td>\s*<td>6<\/td>/);
    }
    assert.match(relatorio(faturas, apartamento, { ano: 2026, trimestre: 0 }), /<td>2026<\/td>\s*<td>3º<\/td>\s*<td>42<\/td>\s*<td>18<\/td>\s*<td>0<\/td>\s*<td>60<\/td>/);
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
  assert.match(detalhes([faturas[0]]), /<td>14<\/td>\s*<td>6<\/td>/);
  assert.match(relatorio(faturas, '123', { ano: 2026, trimestre: 0 }), /<td>3º<\/td>\s*<td>28<\/td>\s*<td>12<\/td>\s*<td>0<\/td>\s*<td>40<\/td>/);
  assert.match(relatorio(faturas, '1248', { ano: 2026, trimestre: 0 }), /<td>3º<\/td>\s*<td>14<\/td>\s*<td>4<\/td>/);
});

test('Crianças TMT conta apenas dormidas de bebés, sem somar crianças nem o campo manual', () => {
  const items = [fatura({ hospedesBebes: 2, hospedesCriancas: 3, noitesCriancas: 30 }),
    fatura({ mes: 8, noites: 4, hospedesBebes: 1, noitesCriancas: 4 })];
  assert.equal(tmt.agruparPorAnoTrimestreApartamento(items)['123']['2026-3'].noitesCriancas, 24);
  assert.match(detalhes([items[0]]), /<td>14<\/td>\s*<td>6<\/td>\s*<td>20<\/td>/);
  assert.match(relatorio(items, '123', { ano: 2026, trimestre: 3 }), /<td>28<\/td>\s*<td>6<\/td>\s*<td>24<\/td>\s*<td>58<\/td>/);
  assert.equal(tmt.agruparPorAnoTrimestreApartamento([fatura({ noitesCriancas: 12 })])['123']['2026-3'].noitesCriancas, 0);
});

test('seleciona o último trimestre concluído, incluindo a passagem de ano', () => {
  for (const [mes, anoEsperado, trimestre] of [[0, 2025, 4], [3, 2026, 1], [6, 2026, 2], [9, 2026, 3]]) {
    const result = tmt.ultimoTrimestreConcluido(new Date(2026, mes, 1));
    assert.equal(result.ano, anoEsperado);
    assert.equal(result.trimestre, trimestre);
  }
});

test('filtra o trimestre, mantém o histórico e distingue um período sem registos', () => {
  const items = [fatura(), fatura({ mes: 10 }), fatura({ ano: 2025 })];
  const html = relatorio(items, '123', { ano: 2026, trimestre: 3 });
  assert.match(html, /<td>3º<\/td>/);
  assert.doesNotMatch(html, /<td>4º<\/td>/);
  assert.match(html, /<td>2025<\/td>/);
  assert.equal((html.match(/<thead>/g) || []).length, 2);
  assert.match(relatorio(items, '123', { ano: 2026, trimestre: 1 }), /Sem registos no 1.º trimestre de 2026/);
  assert.match(relatorio(items, '123', { ano: 2026, trimestre: 0 }), /<td>4º<\/td>/);
});
