import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { consolidarFaturas, splitFaturaPorDia, valorFatura } from './analisev2-core.js';

const APARTMENTS = ['123', '1248'];
const SEASONS = Object.freeze({
  winter: { key: 'winter', label: 'Inverno', months: [12, 1, 2] },
  spring: { key: 'spring', label: 'Primavera', months: [3, 4, 5] },
  summer: { key: 'summer', label: 'Verão', months: [6, 7, 8] },
  fall:   { key: 'fall',   label: 'Outono', months: [9, 10, 11] }
});

let faturasPromise = null;
let cachedFaturas = null;
let nightlyPromise = null;
let nightlyCache = null;
let monthlyCache = null;

export async function getFaturas() {
  if (cachedFaturas) return cachedFaturas;
  if (!faturasPromise) faturasPromise = loadFaturas();
  cachedFaturas = await faturasPromise;
  return cachedFaturas;
}

async function loadFaturas() {
  const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return consolidarFaturas(rows).filter((row) => APARTMENTS.includes(String(row.apartamento)));
}

export async function getNightlyEntries(options = {}) {
  const { preciseOnly = false } = options;
  if (nightlyCache) {
    return preciseOnly ? nightlyCache.filter((entry) => entry.preciseDate) : nightlyCache;
  }
  if (!nightlyPromise) nightlyPromise = buildNightlyEntries();
  nightlyCache = await nightlyPromise;
  return preciseOnly ? nightlyCache.filter((entry) => entry.preciseDate) : nightlyCache;
}

async function buildNightlyEntries() {
  const faturas = await getFaturas();
  const entries = [];
  faturas.forEach((fatura) => {
    const apt = String(fatura.apartamento);
    const slices = splitFaturaPorDia(fatura);
    if (Array.isArray(slices) && slices.length) {
      slices.forEach((slice) => {
        entries.push(createEntry(apt, slice.ano, slice.mes, slice.dia, slice.valorDistribuido, true));
      });
      return;
    }

    const ano = Number(fatura.ano);
    const mes = Number(fatura.mes);
    const noites = Number(fatura.noites || 0);
    if (!ano || !mes || !noites) return;
    const nightly = valorFatura(fatura) / noites;
    const diasMes = daysInMonth(ano, mes);
    const nightsToAllocate = Math.min(diasMes, noites);
    for (let i = 0; i < nightsToAllocate; i++) {
      entries.push(createEntry(apt, ano, mes, i + 1, nightly, false));
    }
  });
  return entries;
}

function createEntry(apartamento, ano, mes, dia, valor, preciseDate) {
  const safeDia = clampDia(ano, mes, dia);
  const date = new Date(ano, mes - 1, safeDia);
  return {
    apartamento,
    ano,
    mes,
    dia: safeDia,
    valor: Number(valor) || 0,
    weekday: Number.isNaN(date.getTime()) ? null : date.getDay(),
    preciseDate
  };
}

function clampDia(ano, mes, dia) {
  const days = daysInMonth(ano, mes);
  if (!Number.isFinite(dia) || dia < 1) return 1;
  if (dia > days) return days;
  return dia;
}

export async function getMonthlyPerformance() {
  if (monthlyCache) return monthlyCache;
  const nightlyEntries = await getNightlyEntries();
  monthlyCache = buildMonthlyPerformance(nightlyEntries);
  return monthlyCache;
}

function buildMonthlyPerformance(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = `${entry.ano}-${String(entry.mes).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        year: entry.ano,
        month: entry.mes,
        revenueByApt: { '123': 0, '1248': 0 },
        occupiedByApt: { '123': 0, '1248': 0 }
      });
    }
    const bucket = map.get(key);
    if (!APARTMENTS.includes(entry.apartamento)) return;
    bucket.revenueByApt[entry.apartamento] += entry.valor;
    bucket.occupiedByApt[entry.apartamento] += 1;
  });

  map.forEach((bucket) => {
    const days = daysInMonth(bucket.year, bucket.month);
    bucket.availableByApt = {
      '123': days,
      '1248': days
    };
    bucket.totalRevenue = bucket.revenueByApt['123'] + bucket.revenueByApt['1248'];
    bucket.totalOccupied = bucket.occupiedByApt['123'] + bucket.occupiedByApt['1248'];
    bucket.availableTotal = days * APARTMENTS.length;
    bucket.avgPriceByApt = {
      '123': bucket.occupiedByApt['123'] ? bucket.revenueByApt['123'] / bucket.occupiedByApt['123'] : 0,
      '1248': bucket.occupiedByApt['1248'] ? bucket.revenueByApt['1248'] / bucket.occupiedByApt['1248'] : 0
    };
    bucket.avgPriceTotal = bucket.totalOccupied ? bucket.totalRevenue / bucket.totalOccupied : 0;
    bucket.season = seasonFromMonth(bucket.month);
  });

  const months = Array.from(map.values()).sort((a, b) => {
    if (a.year === b.year) return a.month - b.month;
    return a.year - b.year;
  });

  return { map, months };
}

export function seasonFromMonth(month) {
  const m = Number(month);
  if ([12, 1, 2].includes(m)) return 'winter';
  if ([3, 4, 5].includes(m)) return 'spring';
  if ([6, 7, 8].includes(m)) return 'summer';
  return 'fall';
}

export function getSeasonConfig(key) {
  return SEASONS[key] || SEASONS.summer;
}

function daysInMonth(year, month) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 30;
  const date = new Date(year, month, 0);
  return Number.isNaN(date.getTime()) ? 30 : date.getDate();
}

export function resetAnaliseCache() {
  cachedFaturas = null;
  nightlyCache = null;
  monthlyCache = null;
  faturasPromise = null;
  nightlyPromise = null;
}
