import { valorFatura, parseLocalDate } from './analisev2-core.js';

export const LEAD_BUCKETS = Object.freeze([
  { key: '0-7', label: '0-7 dias', min: 0, max: 7 },
  { key: '8-30', label: '8-30 dias', min: 8, max: 30 },
  { key: '31-60', label: '31-60 dias', min: 31, max: 60 },
  { key: '61-90', label: '61-90 dias', min: 61, max: 90 },
  { key: '90+', label: '90+ dias', min: 91, max: Infinity }
]);

export function bucketLeadTimes(faturas = []) {
  const map = new Map(LEAD_BUCKETS.map((bucket) => [bucket.key, { ...bucket, count: 0, priceSum: 0, revenueSum: 0 }]));
  let total = 0;

  faturas.forEach((fatura) => {
    const lead = computeLeadTimeDays(fatura);
    if (lead == null) return;
    const nightly = computeNightlyRate(fatura);
    const bucket = resolveLeadBucket(lead);
    const slot = map.get(bucket.key);
    slot.count += 1;
    slot.priceSum += nightly || 0;
    slot.revenueSum += Math.max(0, valorFatura(fatura));
    total += 1;
  });

  const rows = LEAD_BUCKETS.map((bucket) => {
    const slot = map.get(bucket.key);
    return {
      key: bucket.key,
      label: bucket.label,
      count: slot.count,
      avgPrice: slot.count ? slot.priceSum / slot.count : 0,
      pct: total ? (slot.count / total) * 100 : 0
    };
  });

  return { rows, total };
}

function computeNightlyRate(fatura) {
  const noites = Number(fatura?.noites || 0);
  if (noites > 0) return valorFatura(fatura) / noites;
  if (typeof fatura?.precoMedioNoite === 'number') return fatura.precoMedioNoite;
  return null;
}

function resolveLeadBucket(days) {
  return LEAD_BUCKETS.find((bucket) => days >= bucket.min && days <= bucket.max) || LEAD_BUCKETS[LEAD_BUCKETS.length - 1];
}

export function computeLeadTimeDays(fatura) {
  if (!fatura) return null;
  const checkIn = parseLocalDate(fatura.checkIn);
  const booking = parseLocalDate(fatura.dataReserva);
  if (!(checkIn instanceof Date) || !(booking instanceof Date)) return null;
  const diff = (checkIn - booking) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff);
}

const WEEKEND_DAYS = new Set([5, 6]); // Fri & Sat

export function classifyWeekpart(weekday) {
  if (!Number.isInteger(weekday)) return 'weekday';
  return WEEKEND_DAYS.has(weekday) ? 'weekend' : 'weekday';
}

export function computeWeekpartMetrics(entries = [], options = {}) {
  const { apartments = ['123', '1248'] } = options;
  if (!Array.isArray(entries) || !entries.length) return null;

  const filtered = entries.filter((entry) => apartments.includes(String(entry.apartamento ?? entry.apartment ?? '')));
  if (!filtered.length) return null;

  const occupancy = {
    weekday: { occupied: 0, available: 0, value: 0 },
    weekend: { occupied: 0, available: 0, value: 0 }
  };

  const monthsSeen = new Map();
  filtered.forEach((entry) => {
    const weekday = classifyWeekpart(entry.weekday);
    if (entry.weekday == null) return;
    occupancy[weekday].occupied += 1;
    occupancy[weekday].value += Number(entry.valor) || 0;
    const key = `${entry.ano}-${entry.mes}`;
    if (!monthsSeen.has(key)) {
      monthsSeen.set(key, { year: entry.ano, month: entry.mes });
    }
  });

  if (!monthsSeen.size) return null;

  const weekdayDays = countDaysByType(monthsSeen, 'weekday');
  const weekendDays = countDaysByType(monthsSeen, 'weekend');
  occupancy.weekday.available = weekdayDays * apartments.length;
  occupancy.weekend.available = weekendDays * apartments.length;

  const weekdayAvg = occupancy.weekday.occupied ? occupancy.weekday.value / occupancy.weekday.occupied : 0;
  const weekendAvg = occupancy.weekend.occupied ? occupancy.weekend.value / occupancy.weekend.occupied : 0;

  const weekdayOcc = occupancy.weekday.available ? (occupancy.weekday.occupied / occupancy.weekday.available) * 100 : 0;
  const weekendOcc = occupancy.weekend.available ? (occupancy.weekend.occupied / occupancy.weekend.available) * 100 : 0;
  const premium = weekdayAvg ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0;

  return {
    weekdayPrice: weekdayAvg,
    weekendPrice: weekendAvg,
    weekdayOcc,
    weekendOcc,
    premium
  };
}

function countDaysByType(monthsSeen, type) {
  let total = 0;
  monthsSeen.forEach(({ year, month }) => {
    const days = daysInMonth(year, month);
    for (let day = 1; day <= days; day++) {
      const weekday = classifyWeekpart(new Date(year, month - 1, day).getDay());
      if (weekday === type) total += 1;
    }
  });
  return total;
}

function daysInMonth(year, month) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  const date = new Date(year, month, 0);
  return Number.isNaN(date.getTime()) ? 30 : date.getDate();
}
