// js/dca-core.js - Firebase integration and data management

import { db } from '../js/script.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ---------- Constants ----------
export const START_YM = { y: 2025, m: 9 };
export const DEFAULTS = {
  endYM: { y: 2040, m: 9 },
  pctSWDA: 80,
  pctAGGH: 20,
  monthlyContribution: 150,
  scenarioRates: {
    conservative: 3,
    moderate: 5,
    optimistic: 7
  }
};

export const TAXA_ANUAL_FIXA = 0.02; // 2%

// ---------- Firestore Collections ----------
const COL = collection(db, 'dca');
const SETTINGS_D = doc(collection(db, 'dca_settings'), 'params');
const JURO_DOC = doc(db, "dca_juro", "current");
const SHARES_DOC = doc(collection(db, 'dca_settings'), 'shares');

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

export async function loadParams() {
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
      const legacy75_25 = near(normalized.pctSWDA, 75) && near(normalized.pctAGGH, 25);
      const outdatedPlan = near(normalized.pctSWDA, 79.61) && near(normalized.pctAGGH, 20.39) && Math.abs(normalized.monthlyContribution - 152) < 0.01;
      const old152WithNewPct = near(normalized.pctSWDA, 80) && near(normalized.pctAGGH, 20) && Math.abs(normalized.monthlyContribution - 152) < 0.01;
      
      if (legacy55_45 || legacy75_25 || outdatedPlan || old152WithNewPct) {
        const upgraded = { ...normalized, pctSWDA: DEFAULTS.pctSWDA, pctAGGH: DEFAULTS.pctAGGH, monthlyContribution: DEFAULTS.monthlyContribution };
        await saveParams(upgraded);
        return upgraded;
      }
      return normalized;
    }
    
    await setDoc(SETTINGS_D, DEFAULTS);
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

export async function saveJuroSaldo(saldo) {
  try {
    await setDoc(JURO_DOC, {
      saldo: parseFloat(saldo) || 0,
      taxa: TAXA_ANUAL_FIXA,
      updatedAt: new Date()
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
export async function loadShareQuantities() {
  try {
    const snap = await getDoc(SHARES_DOC);
    if (snap.exists()) {
      const data = snap.data();
      return {
        vwce: Number(data.vwce) || 0,
        aggh: Number(data.aggh) || 0
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
      await saveShareQuantities(shares);
      console.log('Migrated shares from localStorage to Firebase');
      return shares;
    }

    return { vwce: 0, aggh: 0 };
  } catch (err) {
    console.error('Error loading shares:', err);
    return { vwce: 0, aggh: 0 };
  }
}

export async function saveShareQuantities(shares) {
  try {
    await setDoc(SHARES_DOC, {
      vwce: Number(shares.vwce) || 0,
      aggh: Number(shares.aggh) || 0,
      updatedAt: new Date()
    });
  } catch (err) {
    console.error('Error saving shares:', err);
    throw new Error('Erro ao guardar quantidades.');
  }
}
