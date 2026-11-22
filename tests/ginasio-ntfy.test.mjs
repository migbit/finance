import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NTFY_LEAD_MS,
  NTFY_MIN_DELAY_MS,
  buildNtfyAlertRequest,
  generateNtfyTopic,
  normalizeNtfyTopic,
  ntfySubscribeUrl,
  planNtfyAlertAt
} from '../js/ginasio-ntfy.js';

test('valida tópicos ntfy', () => {
  assert.equal(normalizeNtfyTopic('  descanso-abc_123  '), 'descanso-abc_123');
  assert.equal(normalizeNtfyTopic('com espaço'), '');
  assert.equal(normalizeNtfyTopic('acentuação'), '');
  assert.equal(normalizeNtfyTopic('a'.repeat(65)), '');
  assert.equal(normalizeNtfyTopic(''), '');
});

test('gera tópicos aleatórios e válidos', () => {
  const topic = generateNtfyTopic();
  assert.match(topic, /^descanso-[a-z2-9]{16}$/);
  assert.equal(normalizeNtfyTopic(topic), topic);
  assert.notEqual(generateNtfyTopic(), topic);
});

test('agenda o aviso uns segundos antes para compensar os lotes do ntfy', () => {
  const now = 1_000_000;
  assert.equal(planNtfyAlertAt({ endAt: now + 150_000, now }), now + 150_000 - NTFY_LEAD_MS);
});

test('respeita o atraso mínimo do ntfy perto do fim do descanso', () => {
  const now = 1_000_000;
  assert.equal(planNtfyAlertAt({ endAt: now + 12_000, now }), now + NTFY_MIN_DELAY_MS);
  assert.equal(planNtfyAlertAt({ endAt: now + NTFY_MIN_DELAY_MS, now }), now + NTFY_MIN_DELAY_MS);
  assert.equal(planNtfyAlertAt({ endAt: now + 9_000, now }), null);
  assert.equal(planNtfyAlertAt({ endAt: Number.NaN, now }), null);
});

test('monta um pedido simples, sem cabeçalhos próprios e com keepalive', () => {
  const { url, init } = buildNtfyAlertRequest({
    topic: 'descanso-teste',
    at: 1_795_364_082_400,
    title: 'Descanso terminado',
    message: 'Remada em cabo · próxima série',
    clickUrl: 'https://migbit.github.io/finance/modules/ginasio.html'
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://ntfy.sh/descanso-teste');
  assert.equal(parsed.searchParams.get('at'), '1795364083');
  assert.equal(parsed.searchParams.get('title'), 'Descanso terminado');
  assert.equal(parsed.searchParams.get('priority'), '5');
  assert.equal(parsed.searchParams.get('click'), 'https://migbit.github.io/finance/modules/ginasio.html');
  assert.equal(init.method, 'POST');
  assert.equal(init.body, 'Remada em cabo · próxima série');
  assert.equal(init.keepalive, true);
  assert.equal(init.headers, undefined);
});

test('recusa tópicos inválidos e cria o link de subscrição da app', () => {
  assert.throws(() => buildNtfyAlertRequest({ topic: 'mau tópico', at: 0, title: '', message: '' }));
  assert.equal(ntfySubscribeUrl('descanso-teste'), 'ntfy://ntfy.sh/descanso-teste');
  assert.equal(ntfySubscribeUrl('mau tópico'), '');
});
