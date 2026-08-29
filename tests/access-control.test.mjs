import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILIPA_UID,
  FRANCISCA_UID,
  INVESTMENTS_RELEASE_AT_MS,
  LEONOR_UID,
  filterNavigation,
  findModuleGroup,
  getChildProfile,
  getModuleAccess,
  isChild,
  investmentsReleased
} from '../js/access-control.js';

test('nega módulos à Filipa por defeito', () => {
  assert.equal(getModuleAccess(FILIPA_UID, 'novo-modulo', 'nova-area', 0), 'none');
});

test('autoriza apenas as áreas base da Filipa antes da data', () => {
  const before = INVESTMENTS_RELEASE_AT_MS - 1;
  assert.equal(getModuleAccess(FILIPA_UID, 'diversos', 'apartamentos', before), 'write');
  assert.equal(getModuleAccess(FILIPA_UID, 'alimentacao', 'miguel', before), 'write');
  assert.equal(getModuleAccess(FILIPA_UID, 'dca', 'investimentos', before), 'none');
});

test('autoriza futuros itens dentro do grupo Filipa', () => {
  assert.equal(getModuleAccess(FILIPA_UID, 'filipa-futuro', 'filipa', 0), 'write');
});

test('a Filipa gere finanças e consulta os dois espaços das filhas', () => {
  assert.equal(getModuleAccess(FILIPA_UID, 'gestao-financas', 'filipa', 0), 'write');
  assert.equal(getModuleAccess(FILIPA_UID, 'francisca-financas', 'francisca', 0), 'write');
  assert.equal(getModuleAccess(FILIPA_UID, 'leonor-financas', 'leonor', 0), 'write');
});

test('liberta investimentos apenas para leitura em 21/12/2027', () => {
  assert.equal(investmentsReleased(INVESTMENTS_RELEASE_AT_MS - 1), false);
  assert.equal(investmentsReleased(INVESTMENTS_RELEASE_AT_MS), true);
  assert.equal(getModuleAccess(FILIPA_UID, 'crypto', 'investimentos', INVESTMENTS_RELEASE_AT_MS), 'read');
});

test('mantém acesso completo para os restantes utilizadores autenticados', () => {
  assert.equal(getModuleAccess('outro-uid', 'qualquer-modulo', 'qualquer-grupo', 0), 'write');
  assert.equal(getModuleAccess('', 'diversos', 'apartamentos', 0), 'none');
});

test('cada filha acede apenas à sua própria página de finanças', () => {
  assert.deepEqual(getChildProfile(FRANCISCA_UID), {
    id: 'francisca',
    groupKey: 'francisca',
    moduleKey: 'francisca-financas'
  });
  assert.equal(isChild(FRANCISCA_UID), true);
  assert.equal(isChild(LEONOR_UID), true);
  assert.equal(getModuleAccess(FRANCISCA_UID, 'francisca-financas', 'francisca'), 'write');
  assert.equal(getModuleAccess(FRANCISCA_UID, 'leonor-financas', 'leonor'), 'none');
  assert.equal(getModuleAccess(FRANCISCA_UID, 'gestao-financas', 'miguel'), 'none');
  assert.equal(getModuleAccess(FRANCISCA_UID, 'faturas', 'apartamentos'), 'none');
  assert.equal(getModuleAccess(LEONOR_UID, 'leonor-financas', 'leonor'), 'write');
  assert.equal(getModuleAccess(LEONOR_UID, 'francisca-financas', 'francisca'), 'none');
});

test('filtra grupos vazios e preserva apenas links autorizados', () => {
  const groups = [
    { key: 'apartamentos', links: [{ key: 'faturas' }, { key: 'diversos' }] },
    { key: 'contabilidade', links: [{ key: 'caixa' }] },
    { key: 'filipa', links: [{ key: 'filipa-futuro' }] }
  ];
  const visible = filterNavigation(groups, FILIPA_UID, INVESTMENTS_RELEASE_AT_MS - 1);
  assert.deepEqual(visible.map(group => group.key), ['apartamentos', 'filipa']);
  assert.deepEqual(visible[0].links.map(link => link.key), ['diversos']);
});

test('filtra toda a navegação infantil para o menu da própria filha', () => {
  const groups = [
    { key: 'apartamentos', links: [{ key: 'faturas' }] },
    { key: 'francisca', links: [{ key: 'francisca-financas' }] },
    { key: 'leonor', links: [{ key: 'leonor-financas' }] },
    { key: 'miguel', links: [{ key: 'gestao-financas' }] }
  ];
  const visible = filterNavigation(groups, FRANCISCA_UID);
  assert.deepEqual(visible.map(group => group.key), ['francisca']);
  assert.deepEqual(visible[0].links.map(link => link.key), ['francisca-financas']);
});

test('a rota de gestão pode aparecer em menus parentais diferentes sem ambiguidade', () => {
  const groups = [
    {
      key: 'filipa',
      links: [{ key: 'gestao-financas', onlyUids: [FILIPA_UID] }]
    },
    {
      key: 'miguel',
      links: [{ key: 'gestao-financas', excludeUids: [FILIPA_UID] }]
    }
  ];

  assert.equal(findModuleGroup(groups, 'gestao-financas', FILIPA_UID), 'filipa');
  assert.equal(findModuleGroup(groups, 'gestao-financas', 'adulto-uid'), 'miguel');
  assert.equal(findModuleGroup(groups, 'gestao-financas', FRANCISCA_UID), '');
});
