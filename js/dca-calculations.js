// js/dca-calculations.js - Calculation logic for DCA

import { START_YM, TAXA_ANUAL_FIXA, monthsBetween, ymMin } from './dca-core.js';

// ---------- Helpers ----------
const pad = (n) => String(n).padStart(2,'0');

export const toEUR = (v) => {
  const num = Math.round(Number(v) || 0);
  return num.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
    useGrouping: true
  }).replace(/\./g, ' ') + ' €';
};

export const asNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function euroFmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-PT', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + ' €';
}

// ---------- Date Helpers ----------
export function diasNoMes(refYYYYMM) {
  let ano, mes;
  if (refYYYYMM && /^\d{4}-\d{2}$/.test(refYYYYMM)) {
    const [y, m] = refYYYYMM.split('-').map(Number);
    ano = y; mes = m;
  } else {
    const d = new Date();
    ano = d.getFullYear(); mes = d.getMonth() + 1;
  }
  return new Date(ano, mes, 0).getDate();
}

// ---------- Model Building ----------
export function buildModel(docs, params) {
  const { pctSWDA, pctAGGH, monthlyContribution } = params;
  const rows = [];

  let investedCum = 0;
  let investedCumSWDA = 0;
  let investedCumAGGH = 0;

  const months = docs.sort((a,b) => a.id.localeCompare(b.id));

  for (const d of months) {
    let monthlySW = roundMoney(monthlyContribution * (pctSWDA/100));
    let monthlyAG = roundMoney(monthlyContribution * (pctAGGH/100));
    let monthlyTotal = roundMoney(monthlySW + monthlyAG);
    
    const adjust = roundMoney(monthlyContribution - monthlyTotal);
    if (adjust !== 0) {
      if (Math.abs(monthlySW) >= Math.abs(monthlyAG)) {
        monthlySW = roundMoney(monthlySW + adjust);
      } else {
        monthlyAG = roundMoney(monthlyAG + adjust);
      }
      monthlyTotal = roundMoney(monthlySW + monthlyAG);
    }

    investedCum = roundMoney(investedCum + monthlyTotal);
    investedCumSWDA = roundMoney(investedCumSWDA + monthlySW);
    investedCumAGGH = roundMoney(investedCumAGGH + monthlyAG);

    const swdaNow = asNum(d.swda_value);
    const agghNow = asNum(d.aggh_value);
    const cashNow = asNum(d.cash_interest);

    const hasAny = (swdaNow != null) || (agghNow != null) || (cashNow != null);
    const totalNow = (swdaNow ?? 0) + (agghNow ?? 0) + (cashNow ?? 0);

    const resTotal = hasAny ? (totalNow - investedCum) : null;
    const resTotalPct = hasAny ? (resTotal / investedCum * 100) : null;

    const resSWDA = swdaNow != null ? (swdaNow - investedCumSWDA) : null;
    const resSWDAPct = swdaNow != null && investedCumSWDA > 0 ? (resSWDA / investedCumSWDA * 100) : null;

    const resAGGH = agghNow != null ? (agghNow - investedCumAGGH) : null;
    const resAGGHPct = agghNow != null && investedCumAGGH > 0 ? (resAGGH / investedCumAGGH * 100) : null;

    rows.push({
      id: d.id, y: d.y, m: d.m,
      investedCum, investedCumSWDA, investedCumAGGH,
      totalNow, swdaNow, agghNow,
      resTotal, resTotalPct,
      resSWDA, resSWDAPct,
      resAGGH, resAGGHPct,
      hasCurrent: hasAny,
      cash_interest: asNum(d.cash_interest),
    });
  }
  return rows;
}

// ---------- KPI Calculations ----------
export function calculateKPIs(rows) {
  if (!rows || rows.length === 0) return null;
  
  // Find last row with filled data
  let lastFilledRow = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].hasCurrent && rows[i].totalNow > 0) {
      lastFilledRow = rows[i];
      break;
    }
  }
  
  if (!lastFilledRow) return null;
  
  const totalInvested = lastFilledRow.investedCum;
  const currentValue = lastFilledRow.totalNow || 0;
  const result = currentValue - totalInvested;
  const resultPct = totalInvested > 0 ? (result / totalInvested * 100) : 0;
  
  return {
    totalInvested,
    currentValue,
    result,
    resultPct,
    lastFilledRow
  };
}

// ---------- Scenario Calculations ----------
export function calculateScenarios(lastFilledRow, params) {
  if (!lastFilledRow || !lastFilledRow.totalNow || lastFilledRow.totalNow <= 0) return null;
  
  const currentTotal = lastFilledRow.totalNow;
  const currentInvested = lastFilledRow.investedCum;
  
  const scenarios = {
    conservative: { rate: 0.03, value: 0, diff: 0 },
    moderate: { rate: 0.05, value: 0, diff: 0 },
    optimistic: { rate: 0.07, value: 0, diff: 0 }
  };
  
  for (const [key, scenario] of Object.entries(scenarios)) {
    // Calculate expected value: invested × (1 + rate)
    scenario.value = currentInvested * (1 + scenario.rate);
    // Difference: actual value - expected value
    scenario.diff = currentTotal - scenario.value;
  }
  
  return scenarios;
}

// ---------- Progress Calculations ----------
export function calculateProgress(params) {
  const now = new Date();
  const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const clampedEnd = ymMin(params.endYM, nowYM);
  
  const totalMonths = monthsBetween(START_YM, params.endYM).length;
  const totalTarget = totalMonths * params.monthlyContribution;
  
  let invested = 0;
  const investedMonths = monthsBetween(START_YM, clampedEnd).length;
  invested = investedMonths * params.monthlyContribution;
  
  const percentage = totalTarget > 0 ? (invested / totalTarget * 100) : 0;
  
  return {
    invested,
    totalTarget,
    percentage: Math.min(percentage, 100),
    remaining: Math.max(0, totalTarget - invested)
  };
}

// ---------- Goal Status ----------
export function calculateGoalStatus(kpis, progress) {
  if (!kpis || !progress) {
    return { icon: '⏳', text: 'A calcular...', color: 'var(--text-dim)' };
  }
  
  const expectedValue = progress.invested;
  const actualValue = kpis.currentValue;
  const difference = actualValue - expectedValue;
  const diffPct = expectedValue > 0 ? (difference / expectedValue * 100) : 0;
  
  if (diffPct >= 5) {
    return { 
      icon: '🚀', 
      text: `Acima da meta! +${diffPct.toFixed(1)}%`, 
      color: 'var(--ok)' 
    };
  } else if (diffPct >= -5) {
    return { 
      icon: '✅', 
      text: `No caminho certo! ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`, 
      color: '#1565c0' 
    };
  } else {
    return { 
      icon: '⚠️', 
      text: `Abaixo da meta ${diffPct.toFixed(1)}%`, 
      color: 'var(--bad)' 
    };
  }
}

// ---------- Interest (Juro) Calculations ----------
export function calculateJuroMensal(saldo, refYYYYMM) {
  const dias = diasNoMes(refYYYYMM);
  return saldo * TAXA_ANUAL_FIXA * (dias / 365);
}

export function somaJuroTabelaDCA(rootElement) {
  if (!rootElement) return 0;
  let soma = 0;

  // Sum from inputs
  rootElement.querySelectorAll('table.table-dca tbody td:nth-child(11) input').forEach(inp => {
    const v = parseFloat((inp.value || '').toString().replace(',', '.'));
    if (!isNaN(v)) soma += v;
  });
  
  // Sum from text (if no input)
  rootElement.querySelectorAll('table.table-dca tbody td:nth-child(11)').forEach(td => {
    if (td.querySelector('input')) return;
    const txt = (td.textContent || '').replace(/[^\d,.\-]/g, '').replace(',', '.');
    const v = parseFloat(txt);
    if (!isNaN(v)) soma += v;
  });

  return soma;
}