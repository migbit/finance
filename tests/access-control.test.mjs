import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILIPA_UID,
  INVESTMENTS_RELEASE_AT_MS,
  filterNavigation,
  getModuleAccess,
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

test('liberta investimentos apenas para leitura em 21/12/2027', () => {
  assert.equal(investmentsReleased(INVESTMENTS_RELEASE_AT_MS - 1), false);
  assert.equal(investmentsReleased(INVESTMENTS_RELEASE_AT_MS), true);
  assert.equal(getModuleAccess(FILIPA_UID, 'crypto', 'investimentos', INVESTMENTS_RELEASE_AT_MS), 'read');
});

test('mantém acesso completo para os restantes utilizadores autenticados', () => {
  assert.equal(getModuleAccess('outro-uid', 'qualquer-modulo', 'qualquer-grupo', 0), 'write');
  assert.equal(getModuleAccess('', 'diversos', 'apartamentos', 0), 'none');
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
