// analtotal-data.js - Data loading and processing
import { db } from './script.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
export async function carregarFaturas() {
try {
const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
const querySnapshot = await getDocs(q);
return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
} catch (error) {
console.error("Erro ao carregar faturas:", error);
return [];
}
}
export function consolidarFaturas(arr) {
const buckets = new Map();
for (const f of arr) {
const key = `${f.ano}-${f.mes}-${String(f.apartamento)}`;
const isDetailed =
(typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) ||
Number(f.noites || 0) > 0 ||
f.tipo === 'reserva';
if (!buckets.has(key)) buckets.set(key, { detailed: [], manual: [] });
    const b = buckets.get(key);
    (isDetailed ? b.detailed : b.manual).push(f);
}

const out = [];
for (const { detailed, manual } of buckets.values()) {
    if (detailed.length) out.push(...detailed);
    else out.push(...manual);
}
return out;
}
// Helper functions
export const obterNomeMes = (numeroMes) => {
const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const n = Math.max(1, Math.min(12, Number(numeroMes)));
return nomes[n - 1];
};
export const euroInt = (v) => {
const num = Math.round(Number(v) || 0);
return num.toLocaleString('pt-PT', {
maximumFractionDigits: 0,
useGrouping: true
}).replace(/\./g, ' ') + ' €';
};
export const diasNoMes = (y, m1_12) => new Date(y, m1_12, 0).getDate();
export const isoToDate = (s) => new Date(`${s}T00:00:00`);
export const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const totalReserva = (f) => Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
// Filter helpers
export function filterByApartment(faturas, apt) {
return faturas.filter(f => String(f.apartamento) === String(apt));
}
export function filterByYear(faturas, year) {
return faturas.filter(f => Number(f.ano) === Number(year));
}
export function filterByYearMonth(faturas, year, month) {
return faturas.filter(f => Number(f.ano) === Number(year) && Number(f.mes) === Number(month));
}
export function filterByApartments(faturas, apts) {
return faturas.filter(f => apts.includes(String(f.apartamento)));
}
// Aggregation helpers
export function sumByYearMonthApt(faturas, year, month, apt) {
return faturas
.filter(f =>
Number(f.ano) === Number(year) &&
Number(f.mes) === Number(month) &&
String(f.apartamento) === String(apt)
)
.reduce((s, f) => s + totalReserva(f), 0);
}
export function sumByYearMonth(faturas, year, month, apts = ['123', '1248']) {
return faturas
.filter(f =>
Number(f.ano) === Number(year) &&
Number(f.mes) === Number(month) &&
apts.includes(String(f.apartamento))
)
.reduce((s, f) => s + totalReserva(f), 0);
}
// Donut calculation helpers
export function calculateProgress(faturas, currentYear, previousYear, apts = ['123', '1248']) {
const currentMonth = new Date().getMonth() + 1;
// Parcial do mês atual
const parcialCurrent = faturas
    .filter(f => Number(f.ano) === currentYear && Number(f.mes) === currentMonth && apts.includes(String(f.apartamento)))
    .reduce((s, f) => s + totalReserva(f), 0);

const parcialPrevious = faturas
    .filter(f => Number(f.ano) === previousYear && Number(f.mes) === currentMonth && apts.includes(String(f.apartamento)))
    .reduce((s, f) => s + totalReserva(f), 0);

const parcialBase = parcialPrevious === 0 ? (parcialCurrent === 0 ? 1 : parcialCurrent) : parcialPrevious;
const parcialDiff = parcialCurrent - parcialPrevious;
const parcialPct = (parcialDiff / parcialBase) * 100;

// Até mês anterior (acumulado)
const atesetCurrent = faturas
    .filter(f => Number(f.ano) === currentYear && apts.includes(String(f.apartamento)) && Number(f.mes) < currentMonth)
    .reduce((s, f) => s + totalReserva(f), 0);

const atesetPrevious = faturas
    .filter(f => Number(f.ano) === previousYear && apts.includes(String(f.apartamento)) && Number(f.mes) < currentMonth)
    .reduce((s, f) => s + totalReserva(f), 0);

const atesetBase = atesetPrevious === 0 ? (atesetCurrent === 0 ? 1 : atesetCurrent) : atesetPrevious;
const atesetDiff = atesetCurrent - atesetPrevious;
const atesetPct = (atesetDiff / atesetBase) * 100;

// Ano atual vs anterior (total)
const vsCurrent = faturas
    .filter(f => Number(f.ano) === currentYear && apts.includes(String(f.apartamento)))
    .reduce((s, f) => s + totalReserva(f), 0);

const vsPrevious = faturas
    .filter(f => Number(f.ano) === previousYear && apts.includes(String(f.apartamento)))
    .reduce((s, f) => s + totalReserva(f), 0);

const vsBase = vsPrevious === 0 ? (vsCurrent === 0 ? 1 : vsCurrent) : vsPrevious;
const vsDiff = vsCurrent - vsPrevious;
const vsPct = (vsDiff / vsBase) * 100;

return {
    parcial: { current: parcialCurrent, previous: parcialPrevious, diff: parcialDiff, pct: parcialPct },
    ateset: { current: atesetCurrent, previous: atesetPrevious, diff: atesetDiff, pct: atesetPct },
    vs: { current: vsCurrent, previous: vsPrevious, diff: vsDiff, pct: vsPct }
};
}
// Bucket nights for tables
export function bucketNoites(n) {
const v = Number(n);
if (!Number.isFinite(v) || v < 2) return null;
return v >= 8 ? '≥8' : String(v);
}
// Calculate extra guest value (20€ per guest above 6, per night, from Jun/2025)
export function extraValor(ano, mes, hosp, noites) {
if (ano < 2025) return 0;
if (ano === 2025 && mes < 6) return 0;
const h = Number(hosp) || 0;
const n = Number(noites) || 0;
if (h <= 6 || n <= 0) return 0;
return (h - 6) * 20 * n;
}

