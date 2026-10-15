import test from 'node:test';
import assert from 'node:assert/strict';
import { FILIPA_UID, FRANCISCA_UID, LEONOR_UID } from '../js/access-control.js';

// Integration tests only against a local emulator, never production.
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw new Error('Set FIRESTORE_EMULATOR_HOST to a local emulator.');
const project = 'demo-ginasio-access';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const collections = ['ginasio_treinos', 'ginasio_resumos', 'ginasio_pesos',
  'ginasio_reps_recomendadas', 'ginasio_aquecimentos', 'ginasio_maquinas_custom'];
function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid,
    aud: project, iss: `https://securetoken.google.com/${project}`, iat: now, exp: now + 3600,
    auth_time: now, firebase: { sign_in_provider: 'custom' } })}.`;
}
function request(path, uid, method = 'GET', value = 1) {
  return fetch(`${base}/${path}`, { method, headers: { 'Content-Type': 'application/json',
    ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { test: { integerValue: String(value) } } }) } : {}) });
}

test('Filipa pode listar, ler, criar, atualizar e apagar em todas as coleções do ginásio de Miguel', async () => {
  for (const name of collections) {
    const path = `${name}/access-test`;
    assert.equal((await request(path, FILIPA_UID, 'PATCH')).status, 200, name);
    assert.equal((await request(path, FILIPA_UID)).status, 200, name);
    assert.equal((await request(name, FILIPA_UID)).status, 200, name);
    const update = await request(path, FILIPA_UID, 'PATCH', 2);
    assert.equal(update.status, 200, name);
    assert.equal((await update.json()).fields.test.integerValue, '2');
    assert.equal((await request(path, FILIPA_UID, 'DELETE')).status, 200, name);
  }
});

test('crianças e visitantes não ganham acesso; Miguel conserva acesso', async () => {
  for (const name of collections) {
    const path = `${name}/boundary-test`;
    assert.equal((await request(path, 'miguel-test', 'PATCH')).status, 200);
    for (const uid of [null, FRANCISCA_UID, LEONOR_UID]) {
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        assert.equal((await request(path, uid, method)).status, 403, `${name}: ${uid} ${method}`);
      }
    }
    assert.equal((await request(path, 'miguel-test', 'DELETE')).status, 200);
  }
});

test('a autorização não se estende a coleções novas, subcoleções ou dados privados alheios', async () => {
  for (const path of ['ginasio_futuro/test', 'ginasio_treinos/test/private/test', 'faturas/test',
    'users/miguel-test/ginasio_treinos/test']) {
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      assert.equal((await request(path, FILIPA_UID, method)).status, 403, `${path}: ${method}`);
    }
  }
  const own = `users/${FILIPA_UID}/ginasio_treinos/test`;
  assert.equal((await request(own, FILIPA_UID, 'PATCH')).status, 200);
  assert.equal((await request(own, FILIPA_UID)).status, 200);
  assert.equal((await request(own, FILIPA_UID, 'DELETE')).status, 200);
});
