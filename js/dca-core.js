// js/dca-core.js - Firebase integration and data management

import { db } from '../js/script.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, orderBy, limit, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ---------- Constants ----------
export const START_YM = { y: 2025, m: 9 };
export const CONTRIBUTION_CHANGE_YM = { y: 2026, m: 10 };
export const HISTORICAL_MONTHLY_CONTRIBUTIONS = {
  swda: 120,
  aggh: 30
};
export const DEFAULTS = {
  endYM: { y: 2040, m: 9 },
  pctSWDA: 75,
  pctAGGH: 25,
  monthlyContribution: 200,
  scenarioRates: {
    conservative: 3,
    moderate: 5,
    optimistic: 7
  }
};

export const TAXA_ANUAL_FIXA = 0.02; // 2%
export const DEFAULT_AUTOMATION = Object.freeze({
  enabled: true,
  effectiveFrom: '2026-10',
  vwceAmount: 150,
  agghAmount: 50,
  annualInterestRate: TAXA_ANUAL_FIXA,
  timezone: 'Europe/Lisbon',
  day: 1,
  time: '01:10'
});

// ---------- Firestore Collections ----------
const COL = collection(db, 'dca');
const SETTINGS_D = doc(collection(db, 'dca_settings'), 'params');
const JURO_DOC = doc(db, "dca_juro", "current");
const SHARES_DOC = doc(collection(db, 'dca_settings'), 'shares');
const AUTOMATION_DOC = doc(collection(db, 'dca_settings'), 'automation');
const REINFORCEMENTS_COL = collection(db, 'dca_reinforcements');
const JURO_MOVEMENTS_COL = collection(db, 'dca_juro_movements');
const CLOSURES_COL = collection(db, 'dca_monthly_closures');
const RECONCILIATIONS_COL = collection(db, 'dca_reconciliations');

// ---------- Auth State ----------
let __isAuthed = false;
const authCallbacks = [];

export function isAuthenticated() {
  return __isAuthed;
}

export function onAuthChange(callback) {
  authCallbacks.push(callback);
  // Immediately call with current state
  callback(__isAuthed);
}

// Initialize auth listener
try {
  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    __isAuthed = !!user;
    authCallbacks.forEach(cb => cb(__isAuthed));
  });
} catch(e) {
  console.error('Auth initialization error:', e);
}

// ---------- Data Loading ----------
export async function ensureMonthsExist(endYM) {
  const now = new Date();
  const currentYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const ids = monthsBetween(START_YM, endYM).map(({y,m}) => `${y}-${String(m).padStart(2,'0')}`);

  await Promise.all(ids.map(async id => {
    const ref = doc(COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const ym = parseYMString(id);
      await setDoc(ref, {
        id,
        y: ym.y,
        m: ym.m,
        invested_total: 0,
        invested_swda: 0,
        invested_aggh: 0,
        value_total: null,
        swda_value: null,
        aggh_value: null,
        cash_interest: null,
        created_at: Date.now()
      });
    }
  }));
}

export async function loadParams({ readOnly = false } = {}) {
  try {
    const snap = await getDoc(SETTINGS_D);
    if (snap.exists()) {
      const p = snap.data();
      const normalized = {
        endYM: p.endYM ?? DEFAULTS.endYM,
        pctSWDA: Number(p.pctSWDA ?? DEFAULTS.pctSWDA),
        pctAGGH: Number(p.pctAGGH ?? DEFAULTS.pctAGGH),
        monthlyContribution: Number(p.monthlyContribution ?? DEFAULTS.monthlyContribution),
        scenarioRates: {
          conservative: Number(p?.scenarioRates?.conservative ?? DEFAULTS.scenarioRates.conservative),
          moderate: Number(p?.scenarioRates?.moderate ?? DEFAULTS.scenarioRates.moderate),
          optimistic: Number(p?.scenarioRates?.optimistic ?? DEFAULTS.scenarioRates.optimistic)
        }
      };
      
      // Check for legacy percentages and upgrade
      const near = (a,b) => Math.abs(a - b) < 0.01;
      const legacy55_45 = near(normalized.pctSWDA, 55) && near(normalized.pctAGGH, 45);
      const legacy75_25 = near(normalized.pctSWDA, 75) && near(normalized.pctAGGH, 25) && Math.abs(normalized.monthlyContribution - 150) < 0.01;
      const previousPlan = near(normalized.pctSWDA, 80) && near(normalized.pctAGGH, 20) && Math.abs(normalized.monthlyContribution - 150) < 0.01;
      const outdatedPlan = near(normalized.pctSWDA, 79.61) && near(normalized.pctAGGH, 20.39) && Math.abs(normalized.monthlyContribution - 152) < 0.01;
      const old152WithNewPct = near(normalized.pctSWDA, 80) && near(normalized.pctAGGH, 20) && Math.abs(normalized.monthlyContribution - 152) < 0.01;
      
      if (legacy55_45 || legacy75_25 || previousPlan || outdatedPlan || old152WithNewPct) {
        const upgraded = { ...normalized, pctSWDA: DEFAULTS.pctSWDA, pctAGGH: DEFAULTS.pctAGGH, monthlyContribution: DEFAULTS.monthlyContribution };
        if (!readOnly) await saveParams(upgraded);
        return upgraded;
      }
      return normalized;
    }
    
    if (!readOnly) await setDoc(SETTINGS_D, DEFAULTS);
    return { ...DEFAULTS };
  } catch (err) {
    console.error('Error loading params:', err);
    throw new Error('Erro ao carregar parâmetros. Por favor, recarregue a página.');
  }
}

export async function saveParams(p) {
  try {
    await setDoc(SETTINGS_D, p, { merge: true });
  } catch (err) {
    console.error('Error saving params:', err);
    throw new Error('Erro ao gravar parâmetros. Tente novamente.');
  }
}

export async function loadAllDocs() {
  try {
    const q = query(COL, orderBy('id','asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error loading documents:', err);
    throw new Error('Erro ao carregar dados. Por favor, recarregue a página.');
  }
}

export async function saveRow(id, patch) {
  try {
    const ref = doc(COL, id);
    await updateDoc(ref, patch);
  } catch (err) {
    console.error('Error saving row:', err);
    throw new Error('Erro ao gravar linha. Tente novamente.');
  }
}

// ---------- Juro (Interest) Management ----------
export async function loadJuroSaldo() {
  try {
    const snap = await getDoc(JURO_DOC);
    return snap.exists() ? snap.data() : { saldo: 0, taxa: TAXA_ANUAL_FIXA };
  } catch (err) {
    console.error('Error loading juro saldo:', err);
    return { saldo: 0, taxa: TAXA_ANUAL_FIXA };
  }
}

export async function saveJuroSaldo(saldo, description = '') {
  try {
    const nextBalance = Number(saldo);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      throw new Error('O saldo deve ser um valor válido e não negativo.');
    }
    const effectiveAt = new Date();
    const movementRef = doc(JURO_MOVEMENTS_COL);
    await runTransaction(db, async transaction => {
      const currentSnap = await transaction.get(JURO_DOC);
      const previousBalance = Number(currentSnap.data()?.saldo) || 0;
      transaction.set(JURO_DOC, {
        saldo: Math.round(nextBalance * 100) / 100,
        taxa: Number(currentSnap.data()?.taxa) || TAXA_ANUAL_FIXA,
        updatedAt: serverTimestamp()
      }, { merge: true });
      transaction.set(movementRef, {
        type: 'manual_correction',
        amount: Math.round((nextBalance - previousBalance) * 100) / 100,
        balance: Math.round(nextBalance * 100) / 100,
        balanceAfter: Math.round(nextBalance * 100) / 100,
        effectiveAt,
        source: 'manual',
        description: String(description || '').trim(),
        createdAt: serverTimestamp()
      });
    });
  } catch (err) {
    console.error('Error saving juro saldo:', err);
    throw new Error('Erro ao gravar saldo de juro. Tente novamente.');
  }
}

// ---------- Helper Functions ----------
export function monthsBetween(a, b) {
  const out = [];
  let y = a.y, m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    out.push({y, m});
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function ymCompare(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  return a.m - b.m;
}

export function getPlannedContributions(ym, params = DEFAULTS) {
  if (ymCompare(ym, CONTRIBUTION_CHANGE_YM) < 0) {
    return {
      swda: HISTORICAL_MONTHLY_CONTRIBUTIONS.swda,
      aggh: HISTORICAL_MONTHLY_CONTRIBUTIONS.aggh,
      total: HISTORICAL_MONTHLY_CONTRIBUTIONS.swda + HISTORICAL_MONTHLY_CONTRIBUTIONS.aggh
    };
  }

  const total = Number(params.monthlyContribution) || 0;
  const swda = Math.round(total * (Number(params.pctSWDA) || 0)) / 100;
  const aggh = Math.round(total * (Number(params.pctAGGH) || 0)) / 100;
  return { swda, aggh, total: Math.round((swda + aggh) * 100) / 100 };
}

export function ymMin(a, b) {
  return ymCompare(a, b) <= 0 ? a : b;
}

export function ymMax(a, b) {
  return ymCompare(a, b) >= 0 ? a : b;
}

// ---------- New Helper Functions ----------
export function ymToId(ym) {
  return `${ym.y}-${String(ym.m).padStart(2, '0')}`;
}

export function parseYMString(str) {
  const match = str?.match(/^(\d{4})-(\d{2})$/);
  return match ? { y: Number(match[1]), m: Number(match[2]) } : null;
}

export function getPreviousMonth(ym) {
  let { y, m } = ym;
  m--;
  if (m < 1) { m = 12; y--; }
  return { y, m };
}

export function getNextMonth(ym) {
  let { y, m } = ym;
  m++;
  if (m > 12) { m = 1; y++; }
  return { y, m };
}

export function isCurrentMonth(ym) {
  const now = new Date();
  return ym.y === now.getFullYear() && ym.m === (now.getMonth() + 1);
}

// ---------- Month Closure Functions ----------
// ---------- Share Quantity Storage ----------
function normalizeTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const asDate = new Date(value);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

export async function loadShareQuantities({ readOnly = false } = {}) {
  try {
    const snap = await getDoc(SHARES_DOC);
    if (snap.exists()) {
      const data = snap.data();
      return {
        vwce: Number(data.vwce) || 0,
        aggh: Number(data.aggh) || 0,
        updatedAt: normalizeTimestamp(data.updatedAt),
        vwceUpdatedAt: normalizeTimestamp(data.vwceUpdatedAt),
        agghUpdatedAt: normalizeTimestamp(data.agghUpdatedAt)
      };
    }

    // Migration: check localStorage
    const vwceLS = localStorage.getItem('dca_etf_qty_vwce');
    const agghLS = localStorage.getItem('dca_etf_qty_aggh');

    if (vwceLS || agghLS) {
      const shares = {
        vwce: Number(vwceLS) || 0,
        aggh: Number(agghLS) || 0
      };
      if (!readOnly) {
        await saveShareQuantities(shares);
        localStorage.removeItem('dca_etf_qty_vwce');
        localStorage.removeItem('dca_etf_qty_aggh');
        console.log('Migrated shares from localStorage to Firebase');
      }
      return shares;
    }

    return { vwce: 0, aggh: 0, updatedAt: null, vwceUpdatedAt: null, agghUpdatedAt: null };
  } catch (err) {
    console.error('Error loading shares:', err);
    return { vwce: 0, aggh: 0, updatedAt: null, vwceUpdatedAt: null, agghUpdatedAt: null };
  }
}

export async function saveShareQuantities(shares, options = {}) {
  try {
    const now = new Date();
    const payload = {
      vwce: Number(shares.vwce) || 0,
      aggh: Number(shares.aggh) || 0,
      updatedAt: now
    };
    if (options.updatedKey === 'vwce') {
      payload.vwceUpdatedAt = now;
    }
    if (options.updatedKey === 'aggh') {
      payload.agghUpdatedAt = now;
    }
    await setDoc(SHARES_DOC, payload, { merge: true });
  } catch (err) {
    console.error('Error saving shares:', err);
    throw new Error('Erro ao guardar quantidades.');
  }
}

function normalizedAutomation(data = {}) {
  const vwceAmount = Number(data.vwceAmount ?? (Number(data.vwceAmountCents) / 100));
  const agghAmount = Number(data.agghAmount ?? (Number(data.agghAmountCents) / 100));
  const annualInterestRate = Number(data.annualInterestRate ?? data.interestRate ?? TAXA_ANUAL_FIXA);
  return {
    enabled: data.enabled !== false,
    effectiveFrom: /^\d{4}-\d{2}$/.test(data.effectiveFrom || '') ? data.effectiveFrom : DEFAULT_AUTOMATION.effectiveFrom,
    vwceAmount: Number.isFinite(vwceAmount) && vwceAmount >= 0 ? vwceAmount : DEFAULT_AUTOMATION.vwceAmount,
    agghAmount: Number.isFinite(agghAmount) && agghAmount >= 0 ? agghAmount : DEFAULT_AUTOMATION.agghAmount,
    annualInterestRate: Number.isFinite(annualInterestRate) && annualInterestRate >= 0 && annualInterestRate <= 1
      ? annualInterestRate
      : TAXA_ANUAL_FIXA,
    timezone: data.timezone || DEFAULT_AUTOMATION.timezone,
    day: Number(data.day) || DEFAULT_AUTOMATION.day,
    time: data.time || DEFAULT_AUTOMATION.time,
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

export async function loadAutomationSettings({ readOnly = false } = {}) {
  const snap = await getDoc(AUTOMATION_DOC);
  if (!snap.exists()) {
    if (!readOnly) {
      await setDoc(AUTOMATION_DOC, {
        ...DEFAULT_AUTOMATION,
        vwceAmountCents: 15000,
        agghAmountCents: 5000,
        updatedAt: serverTimestamp()
      });
    }
    return { ...DEFAULT_AUTOMATION, updatedAt: null };
  }
  return normalizedAutomation(snap.data());
}

export async function saveAutomationSettings(settings) {
  const rawVWCE = Number(settings.vwceAmount);
  const rawAGGH = Number(settings.agghAmount);
  const rawRate = Number(settings.annualInterestRate);
  if (!/^\d{4}-\d{2}$/.test(settings.effectiveFrom || '')) throw new Error('Indique o mês de entrada em vigor.');
  if (!Number.isFinite(rawVWCE) || !Number.isFinite(rawAGGH) || rawVWCE < 0 || rawAGGH < 0) {
    throw new Error('Os montantes do plano automático devem ser números não negativos.');
  }
  if (!Number.isFinite(rawRate) || rawRate < 0 || rawRate > 1) {
    throw new Error('A taxa anual deve ficar entre 0% e 100%.');
  }
  const normalized = normalizedAutomation(settings);
  if (normalized.day !== 1 || normalized.time !== '01:10' || normalized.timezone !== 'Europe/Lisbon') {
    throw new Error('O agendamento suportado é dia 1 às 01:10 em Europe/Lisbon.');
  }
  const vwceAmountCents = Math.round(normalized.vwceAmount * 100);
  const agghAmountCents = Math.round(normalized.agghAmount * 100);
  if (!Number.isSafeInteger(vwceAmountCents) || !Number.isSafeInteger(agghAmountCents)
      || vwceAmountCents < 0 || agghAmountCents < 0 || vwceAmountCents + agghAmountCents <= 0) {
    throw new Error('Os montantes do plano automático são inválidos.');
  }
  await setDoc(AUTOMATION_DOC, {
    ...normalized,
    vwceAmount: vwceAmountCents / 100,
    agghAmount: agghAmountCents / 100,
    vwceAmountCents,
    agghAmountCents,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return normalized;
}

export async function loadReinforcements() {
  const snap = await getDocs(query(REINFORCEMENTS_COL, orderBy('date', 'desc')));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function loadRecentJuroMovements(maxItems = 8) {
  const snap = await getDocs(query(JURO_MOVEMENTS_COL, orderBy('effectiveAt', 'desc'), limit(maxItems)));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function loadMonthlyClosures() {
  const snap = await getDocs(CLOSURES_COL);
  return snap.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(a.month || a.id).localeCompare(String(b.month || b.id)));
}

function financialApi() {
  if (!window.DcaFinancial) throw new Error('O módulo de cálculos financeiros não está disponível.');
  return window.DcaFinancial;
}

function operationDate(dateString) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateString === today ? new Date() : new Date(`${dateString}T12:00:00`);
}

export async function createReinforcement(input) {
  const operationId = String(input.operationId || '').trim();
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(operationId)) throw new Error('Identificador da operação inválido.');
  const reinforcementRef = doc(REINFORCEMENTS_COL, operationId);
  const month = String(input.date || '').slice(0, 7);
  const monthRef = doc(COL, month);
  const closureRef = doc(CLOSURES_COL, month);
  const movementRef = doc(JURO_MOVEMENTS_COL, `reinforcement_${operationId}`);
  const effectiveAt = operationDate(input.date);

  return runTransaction(db, async transaction => {
    const [existingSnap, sharesSnap, balanceSnap, monthSnap, closureSnap] = await Promise.all([
      transaction.get(reinforcementRef),
      transaction.get(SHARES_DOC),
      transaction.get(JURO_DOC),
      transaction.get(monthRef),
      transaction.get(closureRef)
    ]);
    financialApi().assertUniqueOperation(existingSnap.exists());
    if (monthSnap.data()?.snapshot_status === 'closed' || closureSnap.data()?.status === 'complete') {
      throw new Error('Este mês já se encontra fechado. Utilize uma correção histórica específica.');
    }

    const shares = {
      vwce: Number(sharesSnap.data()?.vwce) || 0,
      aggh: Number(sharesSnap.data()?.aggh) || 0
    };
    const currentBalance = Number(balanceSnap.data()?.saldo) || 0;
    const preview = financialApi().buildReinforcementPreview({
      ...input,
      currentShares: shares,
      currentBalance,
      currentVWCE: shares.vwce * Number(input.vwcePrice),
      currentAGGH: shares.aggh * Number(input.agghPrice)
    });
    if (input.fundingSource === 'trade_republic_balance' && preview.totalAmount > currentBalance) {
      throw new Error(`Saldo insuficiente. Disponível: ${currentBalance.toFixed(2)} €.`);
    }

    const nowStamp = serverTimestamp();
    const nextShares = preview.afterShares;
    const nextBalance = financialApi().roundMoney(currentBalance + preview.balanceImpact);
    const record = {
      id: operationId,
      date: input.date,
      month,
      effectiveAt,
      createdAt: nowStamp,
      updatedAt: nowStamp,
      totalAmount: preview.totalAmount,
      totalAmountCents: preview.totalCents,
      vwceAmount: preview.vwceAmount,
      vwceAmountCents: preview.vwceCents,
      vwcePrice: preview.vwcePrice,
      vwcePriceMicros: preview.vwcePriceMicros,
      vwceQuantity: preview.vwceQuantity,
      agghAmount: preview.agghAmount,
      agghAmountCents: preview.agghCents,
      agghPrice: preview.agghPrice,
      agghPriceMicros: preview.agghPriceMicros,
      agghQuantity: preview.agghQuantity,
      allocationMode: input.allocationMode,
      fundingSource: input.fundingSource,
      quoteSource: input.quoteSource || 'manual',
      quoteTimestamp: input.quoteTimestamp || null,
      notes: String(input.notes || '').trim().slice(0, 500),
      status: 'active',
      sharesBefore: shares,
      sharesAfter: nextShares,
      balanceBefore: currentBalance,
      balanceAfter: nextBalance
    };

    transaction.set(reinforcementRef, record);
    transaction.set(SHARES_DOC, {
      ...nextShares,
      updatedAt: nowStamp,
      vwceUpdatedAt: preview.vwceQuantity ? nowStamp : (sharesSnap.data()?.vwceUpdatedAt || null),
      agghUpdatedAt: preview.agghQuantity ? nowStamp : (sharesSnap.data()?.agghUpdatedAt || null)
    }, { merge: true });

    if (input.fundingSource === 'trade_republic_balance') {
      transaction.set(JURO_DOC, { saldo: nextBalance, updatedAt: nowStamp }, { merge: true });
      transaction.set(movementRef, {
        type: 'reinforcement',
        amount: -preview.totalAmount,
        balanceAfter: nextBalance,
        effectiveAt,
        description: String(input.notes || 'Reforço extraordinário').trim().slice(0, 500),
        reinforcementId: operationId,
        createdAt: nowStamp
      });
    }
    return record;
  });
}

export async function voidReinforcement(id, reason = '') {
  const reinforcementRef = doc(REINFORCEMENTS_COL, id);
  const movementRef = doc(JURO_MOVEMENTS_COL, `reinforcement_void_${id}`);
  return runTransaction(db, async transaction => {
    const reinforcementSnap = await transaction.get(reinforcementRef);
    if (!reinforcementSnap.exists()) throw new Error('Reforço não encontrado.');
    const reinforcement = reinforcementSnap.data();
    if ((reinforcement.status || 'active') !== 'active') throw new Error('Este reforço já está anulado.');
    const month = reinforcement.month || String(reinforcement.date || '').slice(0, 7);
    const [monthSnap, closureSnap, sharesSnap, balanceSnap] = await Promise.all([
      transaction.get(doc(COL, month)),
      transaction.get(doc(CLOSURES_COL, month)),
      transaction.get(SHARES_DOC),
      transaction.get(JURO_DOC)
    ]);
    if (monthSnap.data()?.snapshot_status === 'closed' || closureSnap.data()?.status === 'complete') {
      throw new Error('Este reforço pertence a um mês fechado e não pode ser anulado automaticamente.');
    }
    const currentShares = sharesSnap.data() || {};
    const reversal = financialApi().calculateReinforcementReversal({
      shares: currentShares,
      balance: Number(balanceSnap.data()?.saldo) || 0,
      reinforcement
    });
    const nextShares = reversal.shares;
    const nowStamp = serverTimestamp();
    transaction.update(reinforcementRef, {
      status: 'void',
      voidReason: String(reason || '').trim().slice(0, 500),
      voidedAt: nowStamp,
      updatedAt: nowStamp
    });
    transaction.set(SHARES_DOC, { ...nextShares, updatedAt: nowStamp }, { merge: true });
    if (reinforcement.fundingSource === 'trade_republic_balance') {
      const restoredBalance = reversal.balance;
      transaction.set(JURO_DOC, { saldo: restoredBalance, updatedAt: nowStamp }, { merge: true });
      transaction.set(movementRef, {
        type: 'reinforcement_void',
        amount: Number(reinforcement.totalAmount) || 0,
        balanceAfter: restoredBalance,
        effectiveAt: new Date(),
        description: String(reason || 'Anulação de reforço').trim().slice(0, 500),
        reinforcementId: id,
        createdAt: nowStamp
      });
    }
    return { id, status: 'void', shares: nextShares };
  });
}

export async function reconcileShareQuantities(expectedShares, note = '') {
  const auditRef = doc(RECONCILIATIONS_COL);
  return runTransaction(db, async transaction => {
    const sharesSnap = await transaction.get(SHARES_DOC);
    const previous = {
      vwce: Number(sharesSnap.data()?.vwce) || 0,
      aggh: Number(sharesSnap.data()?.aggh) || 0
    };
    const next = {
      vwce: financialApi().roundUnits(expectedShares.vwce),
      aggh: financialApi().roundUnits(expectedShares.aggh)
    };
    if (next.vwce < 0 || next.aggh < 0) throw new Error('Quantidades esperadas inválidas.');
    const nowStamp = serverTimestamp();
    transaction.set(SHARES_DOC, { ...next, updatedAt: nowStamp, vwceUpdatedAt: nowStamp, agghUpdatedAt: nowStamp }, { merge: true });
    transaction.set(auditRef, {
      previousShares: previous,
      reconciledShares: next,
      note: String(note || '').trim().slice(0, 500),
      createdAt: nowStamp
    });
    return { previous, next };
  });
}
