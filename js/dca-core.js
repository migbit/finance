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
  pctSWDA: 79.61,
  pctAGGH: 20.39,
  monthlyContribution: 152
};

export const TAXA_ANUAL_FIXA = 0.02; // 2%

// ---------- Firestore Collections ----------
const COL = collection(db, 'dca');
const SETTINGS_D = doc(collection(db, 'dca_settings'), 'params');
const JURO_DOC = doc(db, "dca_juro", "current");

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
  const ids = monthsBetween(START_YM, endYM).map(({y,m}) => `${y}-${String(m).padStart(2,'0')}`);
  
  await Promise.all(ids.map(async id => {
    const ref = doc(COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id,
        y: Number(id.slice(0,4)),
        m: Number(id.slice(5,7)),
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
        monthlyContribution: Number(p.monthlyContribution ?? DEFAULTS.monthlyContribution)
      };
      
      // Check for legacy percentages and upgrade
      const near = (a,b) => Math.abs(a - b) < 0.01;
      const legacy55_45 = near(normalized.pctSWDA, 55) && near(normalized.pctAGGH, 45);
      const legacy75_25 = near(normalized.pctSWDA, 75) && near(normalized.pctAGGH, 25);
      
      if (legacy55_45 || legacy75_25) {
        const upgraded = { ...normalized, pctSWDA: DEFAULTS.pctSWDA, pctAGGH: DEFAULTS.pctAGGH };
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