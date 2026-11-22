// Aviso de fim de descanso através do ntfy (https://ntfy.sh).
// Com o ecrã bloqueado, o Android congela os temporizadores da página; o ntfy
// recebe o aviso agendado e é a app ntfy do telemóvel que o mostra na hora.

export const NTFY_SERVER = 'https://ntfy.sh';
// O ntfy.sh não aceita agendamentos a menos de 10 s.
export const NTFY_MIN_DELAY_MS = 10_000;
// O ntfy.sh envia os agendamentos em lotes de ~10 s (medido: 0–10 s de atraso).
// Agendar 5 s antes deixa o aviso a ±5 s do fim real do descanso.
export const NTFY_LEAD_MS = 5_000;

const TOPIC_PATTERN = /^[-_A-Za-z0-9]{1,64}$/;
const TOPIC_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function normalizeNtfyTopic(value) {
  const topic = String(value ?? '').trim();
  return TOPIC_PATTERN.test(topic) ? topic : '';
}

// O nome do tópico é a única proteção no ntfy.sh: quem o souber recebe os avisos.
export function generateNtfyTopic(randomValues = crypto.getRandomValues.bind(crypto)) {
  const bytes = randomValues(new Uint8Array(16));
  const suffix = Array.from(bytes, byte => TOPIC_ALPHABET[byte % TOPIC_ALPHABET.length]).join('');
  return `descanso-${suffix}`;
}

// Devolve o instante (ms) em que o ntfy deve enviar o aviso, ou null se o
// descanso já não dá margem para o agendamento mínimo do ntfy.
export function planNtfyAlertAt({ endAt, now }) {
  const end = Number(endAt);
  const current = Number(now);
  if (!Number.isFinite(end) || !Number.isFinite(current)) return null;
  const earliest = current + NTFY_MIN_DELAY_MS;
  if (end < earliest) return null;
  return Math.max(earliest, end - NTFY_LEAD_MS);
}

// Pedido "simples" (POST com texto e opções no URL): não precisa de preflight
// CORS e pode usar keepalive quando a página está a ir para segundo plano.
export function buildNtfyAlertRequest({ topic, at, title, message, clickUrl = '' }) {
  const cleanTopic = normalizeNtfyTopic(topic);
  if (!cleanTopic) throw new Error('Tópico ntfy inválido.');
  const params = new URLSearchParams({
    at: String(Math.ceil(Number(at) / 1000)),
    title,
    priority: '5',
    tags: 'stopwatch'
  });
  if (clickUrl) params.set('click', clickUrl);
  return {
    url: `${NTFY_SERVER}/${cleanTopic}?${params}`,
    init: {
      method: 'POST',
      body: message,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'
    }
  };
}

export function ntfySubscribeUrl(topic) {
  const cleanTopic = normalizeNtfyTopic(topic);
  return cleanTopic ? `ntfy://ntfy.sh/${cleanTopic}` : '';
}
