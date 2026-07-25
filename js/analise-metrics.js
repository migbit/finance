import { valorFatura, parseLocalDate } from './analisev2-core.js';

export const LEAD_BUCKETS = Object.freeze([
  { key: '0-7', label: '0-7 dias', min: 0, max: 7 },
  { key: '8-30', label: '8-30 dias', min: 8, max: 30 },
  { key: '31-60', label: '31-60 dias', min: 31, max: 60 },
  { key: '61-90', label: '61-90 dias', min: 61, max: 90 },
  { key: '90+', label: '90+ dias', min: 91, max: Infinity }
]);

export function bucketLeadTimes(faturas = []) {
  const map = new Map(LEAD_BUCKETS.map((bucket) => [bucket.key, {
    ...bucket,
    count: 0,
    nights: 0,
    nightlyRevenue: 0,
    fallbackPriceSum: 0,
    fallbackPriceCount: 0
  }]));
  let total = 0;

  faturas.forEach((fatura) => {
    const lead = computeLeadTimeDays(fatura);
    if (lead == null) return;
    const nightly = computeNightlyRate(fatura);
    const bucket = resolveLeadBucket(lead);
    const slot = map.get(bucket.key);
    const nights = Number(fatura?.noites || 0);
    slot.count += 1;
    if (nights > 0) {
      slot.nights += nights;
      slot.nightlyRevenue += Math.max(0, valorFatura(fatura));
    } else if (nightly != null) {
      slot.fallbackPriceSum += nightly;
      slot.fallbackPriceCount += 1;
    }
    total += 1;
  });

  const rows = LEAD_BUCKETS.map((bucket) => {
    const slot = map.get(bucket.key);
    return {
      key: bucket.key,
      label: bucket.label,
      count: slot.count,
      avgPrice: slot.nights
        ? slot.nightlyRevenue / slot.nights
        : slot.fallbackPriceCount
          ? slot.fallbackPriceSum / slot.fallbackPriceCount
          : 0,
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

export function computeOccupancyPercent(occupied, available) {
  const occupiedNights = Math.max(0, Number(occupied) || 0);
  const availableNights = Math.max(0, Number(available) || 0);
  return availableNights
    ? Math.min(100, (occupiedNights / availableNights) * 100)
    : 0;
}

export function computeWeekpartMetrics(entries = [], options = {}) {
  const { apartments = ['123', '1248'], years = [] } = options;
  if (!Array.isArray(entries) || !entries.length) return null;

  const today = new Date();
  const selectedYears = [...new Set((years || [])
    .map(Number)
    .filter((year) => Number.isFinite(year) && year <= today.getFullYear())
  )].sort((a, b) => a - b);
  const filtered = entries.filter((entry) => {
    const year = Number(entry.ano);
    if (!apartments.includes(String(entry.apartamento ?? entry.apartment ?? ''))) return false;
    if (selectedYears.length && !selectedYears.includes(year)) return false;
    const date = new Date(year, Number(entry.mes) - 1, Number(entry.dia));
    return !Number.isNaN(date.getTime()) && date <= today;
  });
  if (!filtered.length) return null;

  const occupancy = {
    weekday: { occupied: 0, available: 0, value: 0 },
    weekend: { occupied: 0, available: 0, value: 0 }
  };

  filtered.forEach((entry) => {
    const weekday = classifyWeekpart(entry.weekday);
    if (entry.weekday == null) return;
    occupancy[weekday].occupied += 1;
    occupancy[weekday].value += Number(entry.valor) || 0;
  });

  const coverageYears = selectedYears.length
    ? selectedYears
    : [...new Set(filtered.map((entry) => Number(entry.ano)))].sort((a, b) => a - b);
  const weekdayDays = countDaysByType(coverageYears, 'weekday', today);
  const weekendDays = countDaysByType(coverageYears, 'weekend', today);
  occupancy.weekday.available = weekdayDays * apartments.length;
  occupancy.weekend.available = weekendDays * apartments.length;

  const weekdayAvg = occupancy.weekday.occupied ? occupancy.weekday.value / occupancy.weekday.occupied : 0;
  const weekendAvg = occupancy.weekend.occupied ? occupancy.weekend.value / occupancy.weekend.occupied : 0;

  const weekdayOcc = computeOccupancyPercent(occupancy.weekday.occupied, occupancy.weekday.available);
  const weekendOcc = computeOccupancyPercent(occupancy.weekend.occupied, occupancy.weekend.available);
  const premium = weekdayAvg ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0;

  return {
    weekdayPrice: weekdayAvg,
    weekendPrice: weekendAvg,
    weekdayOcc,
    weekendOcc,
    premium
  };
}

function countDaysByType(years, type, today) {
  let total = 0;
  years.forEach((year) => {
    const finalMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
    for (let month = 1; month <= finalMonth; month++) {
      const finalDay = year === today.getFullYear() && month === finalMonth
        ? today.getDate()
        : daysInMonth(year, month);
      for (let day = 1; day <= finalDay; day++) {
        const weekday = classifyWeekpart(new Date(year, month - 1, day).getDay());
        if (weekday === type) total += 1;
      }
    }
  });
  return total;
}

function daysInMonth(year, month) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  const date = new Date(year, month, 0);
  return Number.isNaN(date.getTime()) ? 30 : date.getDate();
}
