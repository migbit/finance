const MONTH_LABELS = Object.freeze(['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']);

const VIEW_APTS = Object.freeze({
  total: Object.freeze(['123', '1248']),
  '123': Object.freeze(['123']),
  '1248': Object.freeze(['1248'])
});

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function parseLocalDate(dateString) {
  if (typeof dateString !== 'string') return null;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return isValidDate(date) ? date : null;
}

export function valorFatura(fatura) {
  if (!fatura) return 0;
  if (typeof fatura.valorDistribuido === 'number') return fatura.valorDistribuido;
  return Number(fatura.valorTransferencia || 0) + Number(fatura.taxaAirbnb || 0);
}

export function formatEuro(value) {
  const num = Math.round(Number(value) || 0);
  return `${num
    .toLocaleString('pt-PT', { maximumFractionDigits: 0, useGrouping: true })
    .replace(/\./g, ' ')} €`;
}

export function consolidarFaturas(arr = []) {
  const buckets = new Map();
  for (const f of arr) {
    const key = `${f.ano}-${f.mes}-${String(f.apartamento)}`;
    const isDetailed =
      (typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) ||
      Number(f.noites || 0) > 0 ||
      f.tipo === 'reserva';

    if (!buckets.has(key)) buckets.set(key, { detailed: [], manual: [] });
    const bucket = buckets.get(key);
    (isDetailed ? bucket.detailed : bucket.manual).push(f);
  }

  const flattened = [];
  for (const { detailed, manual } of buckets.values()) {
    if (detailed.length) flattened.push(...detailed);
    else flattened.push(...manual);
  }

  return flattened;
}

export function splitFaturaPorDia(fatura) {
  const noites = Number(fatura?.noites || 0);
  if (!noites || noites <= 0) return null;
  if (typeof fatura.checkIn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fatura.checkIn)) return null;

  const inicio = parseLocalDate(fatura.checkIn);
  if (!isValidDate(inicio)) return null;

  const nightlyValue = valorFatura(fatura) / noites;
  const slices = [];

  for (let i = 0; i < noites; i++) {
    const dia = new Date(inicio);
    dia.setDate(dia.getDate() + i);
    slices.push({
      ...fatura,
      ano: dia.getFullYear(),
      mes: dia.getMonth() + 1,
      dia: dia.getDate(),
      valorDistribuido: nightlyValue
    });
  }

  return slices;
}

export { MONTH_LABELS, VIEW_APTS };
