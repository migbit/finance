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
  const rateDefaults = params?.scenarioRates ?? { conservative: 3, moderate: 5, optimistic: 7 };
  
  const scenarios = {
    conservative: { rate: (rateDefaults.conservative ?? 0) / 100, ratePct: rateDefaults.conservative ?? 0, value: 0, diff: 0 },
    moderate: { rate: (rateDefaults.moderate ?? 0) / 100, ratePct: rateDefaults.moderate ?? 0, value: 0, diff: 0 },
    optimistic: { rate: (rateDefaults.optimistic ?? 0) / 100, ratePct: rateDefaults.optimistic ?? 0, value: 0, diff: 0 }
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
  
  // Use the actual result percentage from KPIs (same as Resultado KPI)
  const diffPct = kpis.resultPct;
  
  if (diffPct >= 5) {
    return { 
      icon: '🚀', 
      text: `Acima da meta! +${diffPct.toFixed(2)}%`, 
      color: 'var(--ok)' 
    };
  } else if (diffPct >= -5) {
    return { 
      icon: '✅', 
      text: `No caminho certo! ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%`, 
      color: '#1565c0' 
    };
  } else {
    return { 
      icon: '⚠️', 
      text: `Abaixo da meta ${diffPct.toFixed(2)}%`, 
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

// ---------- Chart Data Preparation ----------
export function prepareChartData(rows, params) {
  if (!rows || rows.length === 0) return null;
  
  const labels = [];
  const portfolioValue = [];
  const contributions = [];
  const swdaValues = [];
  const agghValues = [];
  const monthlyReturns = [];
  const scenarioConservative = [];
  const scenarioModerate = [];
  const scenarioOptimistic = [];
  
  const scenarioRates = params?.scenarioRates ?? { conservative: 3, moderate: 5, optimistic: 7 };
  const scenarioStates = {
    conservative: { value: 0, rate: (scenarioRates.conservative ?? 0) / 100 / 12 },
    moderate: { value: 0, rate: (scenarioRates.moderate ?? 0) / 100 / 12 },
    optimistic: { value: 0, rate: (scenarioRates.optimistic ?? 0) / 100 / 12 }
  };
  
  const lastActualIndex = rows.reduce((acc, row, idx) => {
    if (row.hasCurrent && row.totalNow != null && row.totalNow > 0) {
      return idx;
    }
    return acc;
  }, -1);

  let previousInvested = 0;
  let previousActualValue = null;
  let previousActualInvested = null;
  
  rows.forEach((row, index) => {
    // Label: Month/Year
    labels.push(`${pad(row.m)}/${String(row.y).slice(-2)}`);
    
    const hasActual = row.hasCurrent && row.totalNow != null && row.totalNow > 0;
    const currentValue = hasActual ? row.totalNow : null;
    const showActualValue = hasActual && lastActualIndex >= 0 && index <= lastActualIndex;
    portfolioValue.push(showActualValue ? currentValue : null);
    
    // Contributions (cumulative)
    contributions.push(row.investedCum);
    
    // Individual asset values
    swdaValues.push(row.swdaNow || 0);
    agghValues.push(row.agghNow || 0);
    
    // Monthly returns calculation
    if (showActualValue && previousActualValue != null && previousActualInvested != null && previousActualValue > 0) {
      const contributionDiff = row.investedCum - previousActualInvested;
      const marketReturn = (currentValue - previousActualValue - contributionDiff) / previousActualValue;
      monthlyReturns.push(marketReturn * 100);
    } else {
      monthlyReturns.push(null);
    }
    
    if (hasActual) {
      previousActualValue = currentValue;
      previousActualInvested = row.investedCum;
    }

    const monthlyContribution = row.investedCum - previousInvested;
    previousInvested = row.investedCum;

    Object.entries(scenarioStates).forEach(([key, state]) => {
      const rate = Number.isFinite(state.rate) ? state.rate : 0;
      const contributionApplied = state.value + monthlyContribution;
      const nextValue = contributionApplied * (1 + rate);
      state.value = nextValue;
      if (key === 'conservative') scenarioConservative.push(nextValue);
      if (key === 'moderate') scenarioModerate.push(nextValue);
      if (key === 'optimistic') scenarioOptimistic.push(nextValue);
    });
  });
  
  return {
    labels,
    datasets: {
      portfolioValue,
      contributions,
      swdaValues,
      agghValues,
      monthlyReturns,
      scenarioConservative,
      scenarioModerate,
      scenarioOptimistic
    },
    scenarioRates,
    summary: {
      totalReturn: (() => {
        if (lastActualIndex < 0) return 0;
        const value = portfolioValue[lastActualIndex];
        const contrib = contributions[lastActualIndex] || 0;
        if (value == null || contrib <= 0) return 0;
        return ((value - contrib) / contrib) * 100;
      })(),
      bestMonth: (() => {
        const valid = monthlyReturns.filter(v => typeof v === 'number' && isFinite(v));
        return valid.length ? Math.max(...valid) : 0;
      })(),
      worstMonth: (() => {
        const valid = monthlyReturns.filter(v => typeof v === 'number' && isFinite(v));
        return valid.length ? Math.min(...valid) : 0;
      })()
    }
  };
}

// ---------- Performance Trend Line ----------
export function calculateTrendLine(data) {
  if (!data || data.length < 2) return null;
  
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  data.forEach((value, index) => {
    sumX += index;
    sumY += value;
    sumXY += index * value;
    sumX2 += index * index;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return data.map((_, index) => intercept + slope * index);
}

// ---------- Asset Allocation Data ----------
export function calculateAssetAllocation(rows) {
  const lastRow = rows[rows.length - 1];
  if (!lastRow || !lastRow.hasCurrent) return null;
  
  const total = lastRow.totalNow || 0;
  const swdaPercent = total > 0 ? ((lastRow.swdaNow || 0) / total * 100) : 0;
  const agghPercent = total > 0 ? ((lastRow.agghNow || 0) / total * 100) : 0;
  const cashPercent = total > 0 ? ((lastRow.cash_interest || 0) / total * 100) : 0;
  
  return {
    labels: ['VWCE', 'AGGH', 'Cash'],
    values: [swdaPercent, agghPercent, cashPercent],
    colors: ['rgba(54, 162, 235, 0.8)', 'rgba(255, 159, 64, 0.8)', 'rgba(75, 192, 192, 0.8)']
  };
}

// ---------- Advanced Performance Metrics ----------
export function calculateAdvancedMetrics(rows, params) {
  if (!rows || rows.length === 0) return null;
  
  const filledRows = rows.filter(row => row.hasCurrent && row.totalNow > 0);
  if (filledRows.length < 2) return null;
  
  // Time-Weighted Return (TWR)
  const twr = calculateTimeWeightedReturn(filledRows, params);
  
  // Money-Weighted Return (MWR) - Internal Rate of Return
  const mwr = calculateMoneyWeightedReturn(filledRows, params);
  
  // Annualized Return
  const annualized = calculateAnnualizedReturn(filledRows);
  
  return {
    timeWeightedReturn: twr,
    moneyWeightedReturn: mwr,
    annualizedReturn: annualized
  };
}

function calculateTimeWeightedReturn(rows, params) {
  if (rows.length < 2) return 0;
  
  let cumulativeReturn = 1;
  
  for (let i = 1; i < rows.length; i++) {
    const prevRow = rows[i - 1];
    const currentRow = rows[i];
    
    // Only calculate if we have valid data for both periods
    if (prevRow.totalNow > 0 && currentRow.totalNow > 0) {
      // Calculate the actual market return (excluding new contributions)
      // This assumes contributions happen at the END of the period
      const marketValueChange = currentRow.totalNow - (currentRow.investedCum - prevRow.investedCum);
      const periodReturn = (marketValueChange - prevRow.totalNow) / prevRow.totalNow;
      
      // Sanity check: reasonable returns between -50% and +100% per month
      if (periodReturn >= -0.5 && periodReturn <= 1.0) {
        cumulativeReturn *= (1 + periodReturn);
      }
    }
  }
  
  return (cumulativeReturn - 1) * 100;
}

function calculateMoneyWeightedReturn(rows, params) {
  // Simplified XIRR calculation
  if (rows.length < 2) return 0;
  
  const cashFlows = [];
  const dates = [];
  
  // Initial investment (negative cash flow)
  const firstRow = rows[0];
  if (firstRow.investedCum > 0) {
    cashFlows.push(-firstRow.investedCum);
    dates.push(new Date(firstRow.y, firstRow.m - 1, 1)); // First day of month
  }
  
  // Monthly contributions (negative cash flows)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Only add contribution if this month had investment activity
    if (row.investedCum > rows[i-1].investedCum) {
      const contribution = -(row.investedCum - rows[i-1].investedCum);
      cashFlows.push(contribution);
      dates.push(new Date(row.y, row.m - 1, 15)); // Middle of month
    }
  }
  
  // Final value (positive cash flow)
  const lastRow = rows[rows.length - 1];
  if (lastRow.totalNow > 0) {
    cashFlows.push(lastRow.totalNow);
    dates.push(new Date(lastRow.y, lastRow.m - 1, 28)); // End of month
  }
  
  // Calculate IRR only if we have enough cash flows
  if (cashFlows.length >= 3) {
    const irr = calculateXIRR(cashFlows, dates);
    return irr * 100; // Convert to percentage
  }
  
  return 0;
}

function calculateXIRR(cashFlows, dates, guess = 0.1) {
  // Newton-Raphson method for XIRR calculation
  const maxIter = 50;
  const tolerance = 1e-6;
  
  // Safety check: if all cash flows are negative or positive, return 0
  const allNegative = cashFlows.every(cf => cf <= 0);
  const allPositive = cashFlows.every(cf => cf >= 0);
  if (allNegative || allPositive) return 0;
  
  let x = guess;
  
  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let derivative = 0;
    const startDate = dates[0];
    
    for (let i = 0; i < cashFlows.length; i++) {
      const years = (dates[i] - startDate) / (1000 * 60 * 60 * 24 * 365.25);
      const factor = Math.pow(1 + x, years);
      
      npv += cashFlows[i] / factor;
      if (factor !== 0) {
        derivative -= years * cashFlows[i] / (factor * (1 + x));
      }
    }
    
    if (Math.abs(npv) < tolerance) {
      return Math.min(Math.max(x, -0.99), 10); // Bound between -99% and 1000%
    }
    
    // Avoid division by zero
    if (Math.abs(derivative) < 1e-10) break;
    
    const newX = x - npv / derivative;
    
    // Prevent unreasonable values
    if (newX < -0.99 || newX > 10 || !isFinite(newX)) {
      break;
    }
    
    if (Math.abs(newX - x) < tolerance) {
      return newX;
    }
    
    x = newX;
  }
  
  return Math.min(Math.max(x, -0.99), 10); // Bound the result
}

function calculateAnnualizedReturn(rows) {
  if (rows.length < 2) return 0;
  
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  
  // Basic sanity checks
  if (firstRow.totalNow <= 0 || lastRow.totalNow <= 0 || firstRow.investedCum <= 0) {
    return 0;
  }
  
  const totalReturn = (lastRow.totalNow - firstRow.investedCum) / firstRow.investedCum;
  
  // Calculate time in years (more accurate)
  const firstDate = new Date(firstRow.y, firstRow.m - 1, 1);
  const lastDate = new Date(lastRow.y, lastRow.m - 1, 1);
  const years = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);
  
  // Avoid mathematical errors
  if (years <= 0 || totalReturn <= -1) return 0;
  
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
  
  // Sanity check: realistic returns
  if (annualizedReturn < -0.9 || annualizedReturn > 5 || !isFinite(annualizedReturn)) {
    return 0;
  }
  
  return annualizedReturn * 100;
}


// ---------- Rebalancing Calculations ----------
export function calculateRebalancingSuggestions(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }
  
  const tolerance = 5;
  const targets = { VWCE: 80, AGGH: 20 };
  
  const lastFilled = [...rows].reverse().find(row => row.hasCurrent && (row.totalNow || 0) > 0);
  if (!lastFilled || !lastFilled.totalNow) {
    return null;
  }
  
  const swdaValue = Number(lastFilled.swdaNow ?? 0);
  const agghValue = Number(lastFilled.agghNow ?? 0);
  const assetTotal = swdaValue + agghValue;
  
  if (assetTotal <= 0) {
    return null;
  }
  
  const currentSWDA = assetTotal > 0 ? (swdaValue / assetTotal) * 100 : 0;
  const currentAGGH = assetTotal > 0 ? (agghValue / assetTotal) * 100 : 0;
  
  const allocations = [
    {
      asset: 'VWCE',
      current: currentSWDA,
      target: targets.VWCE,
      difference: currentSWDA - targets.VWCE
    },
    {
      asset: 'AGGH',
      current: currentAGGH,
      target: targets.AGGH,
      difference: currentAGGH - targets.AGGH
    }
  ];
  
  const enhancedAllocations = allocations.map(item => {
    const absDiff = Math.abs(item.difference);
    const action = absDiff > tolerance
      ? (item.difference > 0 ? 'Vender' : 'Comprar')
      : 'Manter';
    const amount = absDiff > tolerance ? Math.abs((item.difference / 100) * assetTotal) : 0;
    
    return {
      ...item,
      action,
      amount,
      tolerance
    };
  });
  
  const needsRebalancing = enhancedAllocations.some(item => item.action !== 'Manter');
  
  return {
    needsRebalancing,
    allocations: enhancedAllocations,
    tolerance,
    totalValue: assetTotal
  };
}

// ---------- Export Data Functions ----------
export function generateCSVData(rows) {
  const headers = ['Date', 'Invested Total', 'Current Value', 'VWCE Value', 'AGGH Value', 'Cash Interest', 'Result', 'Result %'];
  
  const csvRows = rows.map(row => [
    `${row.y}-${String(row.m).padStart(2, '0')}`,
    row.investedCum,
    row.totalNow || '',
    row.swdaNow || '',
    row.agghNow || '',
    row.cash_interest || '',
    row.resTotal || '',
    row.resTotalPct || ''
  ]);
  
  return [headers, ...csvRows];
}

