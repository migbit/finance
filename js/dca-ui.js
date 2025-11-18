// js/dca-ui.js - UI rendering functions

import { toEUR, asNum, euroFmt, generateCSVData } from './dca-calculations.js';

const pad = (n) => String(n).padStart(2,'0');

// ---------- Table Rendering ----------
export function yearGroups(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.y)) map.set(r.y, []);
    map.get(r.y).push(r);
  }
  for (const [y, arr] of map) arr.sort((a,b) => a.m - b.m);
  return [...map.entries()].sort((a,b) => a[0] - b[0]);
}

export function renderTable(rows, wrapElement) {
  if (!wrapElement) return;

  const fmtPct = v => (v == null ? '' : ` <small>(${v.toFixed(2)}%)</small>`);
  const groups = yearGroups(rows);
  wrapElement.innerHTML = '';

  for (const [y, arr] of groups) {
    const h = document.createElement('h3');
    h.textContent = y;

    const table = document.createElement('table');
    table.className = 'table-dca';

    const theadHTML = `
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          <th rowspan="2" class="num">Inv.</th>
          <th rowspan="2" class="num total-block">Total</th>
          <th rowspan="2" class="num res-total-block">Res. Total</th>

          <th colspan="3" class="swda-block" style="background: rgba(54,162,235,0.15); border-left: 3px solid rgba(54,162,235,0.8); border-right: 3px solid rgba(54,162,235,0.8);">VWCE</th>
          <th colspan="3" class="aggh-block" style="background: rgba(245,133,20,0.15); border-left: 3px solid rgba(245,133,20,0.8); border-right: 3px solid rgba(245,133,20,0.8);">AGGH</th>

          <th rowspan="2" class="num">Juro</th>
          <th rowspan="2">Ações</th>
        </tr>
        <tr>
          <th class="num swda-block" style="background: rgba(54,162,235,0.1); border-left: 3px solid rgba(54,162,235,0.8);">Inv.</th>
          <th class="num swda-block" style="background: rgba(54,162,235,0.1);">Atual</th>
          <th class="num swda-block" style="background: rgba(54,162,235,0.1); border-right: 3px solid rgba(54,162,235,0.8);">Delta</th>

          <th class="num aggh-block" style="background: rgba(245,133,20,0.1); border-left: 3px solid rgba(245,133,20,0.8);">Inv.</th>
          <th class="num aggh-block" style="background: rgba(245,133,20,0.1);">Atual</th>
          <th class="num aggh-block" style="background: rgba(245,133,20,0.1); border-right: 3px solid rgba(245,133,20,0.8);">Delta</th>
        </tr>
      </thead>
    `;

    table.innerHTML = theadHTML + '<tbody></tbody>';
    const tbody = table.querySelector('tbody');

    for (const r of arr) {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;
      tr.dataset.ym = `${r.y}-${pad(r.m)}`;

      const clsTotal = r.resTotal != null ? (r.resTotal >= 0 ? 'pos' : 'neg') : '';
      const clsSWDA = r.resSWDA != null ? (r.resSWDA >= 0 ? 'pos' : 'neg') : '';
      const clsAGGH = r.resAGGH != null ? (r.resAGGH >= 0 ? 'pos' : 'neg') : '';

      tr.innerHTML = `
        <td>${pad(r.m)}/${String(r.y).slice(-2)}</td>
        <td class="num">${toEUR(r.investedCum)}</td>
        <td class="num total-block">${r.hasCurrent ? toEUR(r.totalNow) : '-'}</td>
        <td class="num ${clsTotal}">${r.resTotal == null ? '-' : toEUR(r.resTotal)}${fmtPct(r.resTotalPct)}</td>

        <td class="num swda-block" style="background: rgba(54,162,235,0.05); border-left: 3px solid rgba(54,162,235,0.8);">${toEUR(r.investedCumSWDA)}</td>
        <td class="num swda-block" style="background: rgba(54,162,235,0.05);"><input class="cell swda" type="number" step="0.01" value="${r.swdaNow ?? ''}" /></td>
        <td class="num swda-block ${clsSWDA}" style="background: rgba(54,162,235,0.05); border-right: 3px solid rgba(54,162,235,0.8);">${r.resSWDA == null ? '-' : toEUR(r.resSWDA)}${fmtPct(r.resSWDAPct)}</td>

        <td class="num aggh-block" style="background: rgba(245,133,20,0.05); border-left: 3px solid rgba(245,133,20,0.8);">${toEUR(r.investedCumAGGH)}</td>
        <td class="num aggh-block" style="background: rgba(245,133,20,0.05);"><input class="cell aggh" type="number" step="0.01" value="${r.agghNow ?? ''}" /></td>
        <td class="num aggh-block ${clsAGGH}" style="background: rgba(245,133,20,0.05); border-right: 3px solid rgba(245,133,20,0.8);">${r.resAGGH == null ? '-' : toEUR(r.resAGGH)}${fmtPct(r.resAGGHPct)}</td>

        <td class="num"><input class="cell cash" type="number" step="0.01" value="${r.cash_interest ?? ''}" /></td>
        <td>
          <button class="btn btn-edit btn-save" type="button" title="Guardar registo" aria-label="Guardar registo">
            ✓
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    const groupWrap = document.createElement('div');
    groupWrap.className = 'year-group';
    groupWrap.appendChild(h);
    groupWrap.appendChild(table);
    wrapElement.appendChild(groupWrap);
  }
  
  highlightCurrentMonthRow(wrapElement);
}

// ---------- Current Month Highlighting ----------
export function highlightCurrentMonthRow(wrapElement) {
  if (!wrapElement) return;
  const tbl = wrapElement.querySelector('table.table-dca');
  if (!tbl) return;

  tbl.querySelectorAll('tbody tr.current-month').forEach(tr => tr.classList.remove('current-month'));

  const now = new Date();
  const ymNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  let row = tbl.querySelector(`tbody tr[data-ym="${ymNow}"]`);

  if (!row) {
    const rows = Array.from(tbl.querySelectorAll('tbody tr'));
    for (const tr of rows) {
      const td = tr.querySelector('td');
      if (!td) continue;
      const t = (td.textContent || '').trim().toLowerCase();

      const m = now.getMonth()+1, y = now.getFullYear();
      const yy2 = String(y).slice(-2);
      const rx = new RegExp(`^${m}\\/(?:${y}|${yy2})$`);
      if (rx.test(t)) { row = tr; break; }
    }
  }

  if (row) row.classList.add('current-month');
}

// ---------- Year Visibility Toggle ----------
export function applyYearVisibility(showOthers) {
  const currentYear = new Date().getFullYear();
  const groups = Array.from(document.querySelectorAll('#dca-table-wrap .year-group'));

  for (const g of groups) {
    const yTxt = g.querySelector('h3')?.textContent || '';
    const y = Number(yTxt.trim());
    if (!Number.isFinite(y)) continue;

    if (y === currentYear) {
      g.style.display = '';
    } else {
      g.style.display = showOthers ? '' : 'none';
    }
  }

  const btn = document.getElementById('toggle-others');
  if (btn) btn.textContent = showOthers ? 'Ocultar anos' : 'Expandir anos';
}

// ---------- KPI Updates ----------
export function updateKPIs(kpis, totalInterest) {
  if (!kpis) {
    document.getElementById('kpi-total-invested').textContent = '-';
    document.getElementById('kpi-current-value').textContent = '-';
    document.getElementById('kpi-result').textContent = '-';
    document.getElementById('kpi-result-pct').textContent = '';
    document.getElementById('kpi-total-interest').textContent = toEUR(totalInterest || 0);
    return;
  }
  
  document.getElementById('kpi-total-invested').textContent = toEUR(kpis.totalInvested);
  document.getElementById('kpi-current-value').textContent = toEUR(kpis.currentValue);
  document.getElementById('kpi-result').textContent = toEUR(kpis.result);
  
  const pctEl = document.getElementById('kpi-result-pct');
  pctEl.textContent = `(${kpis.resultPct >= 0 ? '+' : ''}${kpis.resultPct.toFixed(2)}%)`;
  pctEl.className = `kpi-sub ${kpis.result >= 0 ? 'pos' : 'neg'}`;
  
  document.getElementById('kpi-total-interest').textContent = toEUR(totalInterest || 0);
}

// ---------- Progress Bar ----------
export function updateProgressBar(progress) {
  if (!progress) return;
  
  const fillEl = document.getElementById('progress-bar-fill');
  const textEl = document.getElementById('progress-bar-text');
  const pctEl = document.getElementById('progress-percentage');
  const investedEl = document.getElementById('progress-invested');
  const targetEl = document.getElementById('progress-target');
  
  if (fillEl) fillEl.style.width = `${progress.percentage}%`;
  if (textEl) textEl.textContent = progress.percentage >= 20 ? `${toEUR(progress.invested)}` : '';
  if (pctEl) pctEl.textContent = `${progress.percentage.toFixed(1)}%`;
  if (investedEl) investedEl.textContent = toEUR(progress.invested);
  if (targetEl) targetEl.textContent = toEUR(progress.totalTarget);
}

// ---------- Goal Status ----------
export function updateGoalStatus(goalStatus) {
  if (!goalStatus) return;
  
  const iconEl = document.querySelector('.goal-icon');
  const textEl = document.getElementById('goal-text');
  
  if (iconEl) {
    iconEl.textContent = '';
    iconEl.style.display = 'none';
  }
  if (textEl) {
    textEl.textContent = '';
    textEl.style.display = 'none';
  }
}

// ---------- Scenarios ----------
export function updateScenarios(scenarios, params) {
  const rates = params?.scenarioRates ?? {};
  const rateEls = {
    conservative: document.getElementById('scenario-conservative-rate'),
    moderate: document.getElementById('scenario-moderate-rate'),
    optimistic: document.getElementById('scenario-optimistic-rate')
  };
  Object.entries(rateEls).forEach(([key, el]) => {
    if (!el) return;
    const value = Number(rates[key] ?? 0);
    const prefix = value >= 0 ? '+' : '';
    el.textContent = `${prefix}${value.toFixed(1)}%`;
  });
  
  if (!scenarios) {
    ['conservative', 'moderate', 'optimistic'].forEach(s => {
      const el = document.getElementById(`scenario-${s}`);
      const diffEl = document.getElementById(`scenario-${s}-diff`);
      if (el) el.textContent = '-';
      if (diffEl) diffEl.textContent = '';
    });
    return;
  }
  
  for (const [key, data] of Object.entries(scenarios)) {
    const el = document.getElementById(`scenario-${key}`);
    const diffEl = document.getElementById(`scenario-${key}-diff`);
    
    if (el) el.textContent = toEUR(data.value);
    if (diffEl) {
      const cls = data.diff >= 0 ? 'pos' : 'neg';
      const sign = data.diff > 0 ? '+' : (data.diff < 0 ? '-' : '');
      const absValue = toEUR(Math.abs(data.diff));
      const diffText = sign ? `${sign}${absValue}` : absValue;
      diffEl.textContent = `(${diffText})`;
      diffEl.className = `scenario-diff ${cls}`;
    }
  }
}

// ---------- Params UI ----------
export function writeParamsToUI(p) {
  const ed = document.getElementById('end-date');
  if (ed) ed.value = `${p.endYM.y}-${pad(p.endYM.m)}`;
  
  const sw = document.getElementById('pct-swda');
  if (sw) sw.value = p.pctSWDA;
  
  const ag = document.getElementById('pct-aggh');
  if (ag) ag.value = p.pctAGGH;
  
  const mc = document.getElementById('monthly-contribution');
  if (mc) mc.value = p.monthlyContribution;

  const scen = p.scenarioRates || {};
  const cons = document.getElementById('scenario-rate-conservative');
  if (cons) cons.value = scen.conservative ?? 0;
  const mod = document.getElementById('scenario-rate-moderate');
  if (mod) mod.value = scen.moderate ?? 0;
  const opt = document.getElementById('scenario-rate-optimistic');
  if (opt) opt.value = scen.optimistic ?? 0;
}

export function readParamsFromUI(defaults) {
  const endDateVal = document.getElementById('end-date')?.value || `${defaults.endYM.y}-${pad(defaults.endYM.m)}`;
  const [ey, em] = endDateVal.split('-').map(Number);
  
  const pctS = asNum(document.getElementById('pct-swda')?.value) ?? defaults.pctSWDA;
  const pctA = asNum(document.getElementById('pct-aggh')?.value) ?? defaults.pctAGGH;
  const monthly = asNum(document.getElementById('monthly-contribution')?.value) ?? defaults.monthlyContribution;
  const scenCons = asNum(document.getElementById('scenario-rate-conservative')?.value) ?? defaults.scenarioRates.conservative;
  const scenMod = asNum(document.getElementById('scenario-rate-moderate')?.value) ?? defaults.scenarioRates.moderate;
  const scenOpt = asNum(document.getElementById('scenario-rate-optimistic')?.value) ?? defaults.scenarioRates.optimistic;
  
  const fix = (n) => Math.max(0, Math.min(100, n));
  const pctSumOk = Math.abs((pctS + pctA) - 100) < 0.01;
  
  return { 
    endYM: {y:ey, m:em}, 
    pctSWDA: fix(pctS), 
    pctAGGH: fix(pctA), 
    monthlyContribution: monthly, 
    scenarioRates: {
      conservative: scenCons,
      moderate: scenMod,
      optimistic: scenOpt
    },
    pctSumOk
  };
}

// ---------- Juro UI ----------
export function updateJuroUI(saldo, taxa, mensal, acumulado) {
  const saldoInp = document.getElementById('juro-saldo');
  if (saldoInp && saldo != null) {
    saldoInp.value = parseFloat(saldo).toFixed(2);
  }
  
  const taxaInp = document.getElementById('juro-taxa');
  if (taxaInp && taxa != null) {
    taxaInp.value = (taxa * 100).toFixed(2);
  }
  
  const mensalLbl = document.getElementById('juro-mensal');
  if (mensalLbl) mensalLbl.textContent = euroFmt(mensal || 0);
  
  const acumLbl = document.getElementById('juro-acumulado');
  if (acumLbl) acumLbl.textContent = euroFmt(acumulado || 0);
}

// ---------- Scroll Indicators ----------
export function addScrollIndicators() {
  document.querySelectorAll('.table-wrap').forEach(wrap => {
    const hasScroll = wrap.scrollWidth > wrap.clientWidth;
    if (hasScroll) {
      wrap.classList.add('has-scroll');
    } else {
      wrap.classList.remove('has-scroll');
    }
  });
}

// ---------- Loading State ----------
export function showLoading(element, message = 'A carregar...') {
  if (!element) return;
  element.innerHTML = `
    <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
      <div class="skeleton" style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 1rem;"></div>
      <p style="font-style: italic;">${message}</p>
    </div>
  `;
}

export function showError(element, message = 'Ocorreu um erro.') {
  if (!element) return;
  element.innerHTML = `
    <div style="text-align: center; padding: 2rem; color: var(--bad);">
      <p style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</p>
      <p style="font-weight: 600;">${message}</p>
    </div>
  `;
}

// Add to dca-ui.js

// ---------- Chart Initialization ----------
let performanceChart = null;
const DEFAULT_LINE_WIDTH = 2;

export function initializeCharts() {
  const chartCtx = document.getElementById('performance-chart')?.getContext('2d');
  
  if (chartCtx && !performanceChart) {
    performanceChart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Desempenho do Portefólio'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          },
          legend: {
            position: 'bottom'
          }
        },
        elements: {
          line: {
            borderWidth: DEFAULT_LINE_WIDTH
          },
          point: {
            radius: 0
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return toEUR(value);
              }
            }
          }
        }
      }
    });
  }
}

// ---------- Update Performance Chart ----------
export function updatePerformanceChart(chartData, chartType = 'portfolio-growth', rangeEnd = null) {
  if (!performanceChart || !chartData) return;
  
  const { labels, datasets } = chartData;
  const totalPoints = labels.length;
  if (totalPoints === 0) return;
  
  const effectiveEnd = rangeEnd
    ? Math.min(Math.max(Math.round(rangeEnd), 1), totalPoints)
    : totalPoints;
  
  const sliceData = (dataArray = []) => dataArray.slice(0, effectiveEnd);
  const activeLabels = labels.slice(0, effectiveEnd);
  
  performanceChart.data.labels = activeLabels;
  
  switch (chartType) {
    case 'portfolio-growth': {
      const growthDatasets = [
        {
          label: 'Valor do Portefólio',
          data: sliceData(datasets.portfolioValue),
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH,
          spanGaps: false
        },
        {
          label: 'Contribuições',
          data: sliceData(datasets.contributions),
          borderColor: 'rgb(107, 114, 128)',
          borderDash: [6, 6],
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        }
      ];
      
      if (datasets.scenarioConservative?.length) {
        growthDatasets.push({
          label: 'Cenário Conservador',
          data: sliceData(datasets.scenarioConservative),
          borderColor: 'rgba(22, 163, 74, 0.9)',
          borderDash: [4, 4],
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        });
      }
      
      if (datasets.scenarioModerate?.length) {
        growthDatasets.push({
          label: 'Cenário Moderado',
          data: sliceData(datasets.scenarioModerate),
          borderColor: 'rgba(14, 165, 233, 0.9)',
          borderDash: [4, 4],
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        });
      }
      
      if (datasets.scenarioOptimistic?.length) {
        growthDatasets.push({
          label: 'Cenário Otimista',
          data: sliceData(datasets.scenarioOptimistic),
          borderColor: 'rgba(249, 115, 22, 0.9)',
          borderDash: [4, 4],
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        });
      }
      
      performanceChart.data.datasets = growthDatasets;
      performanceChart.options.plugins.title.text = 'Crescimento vs Cenários';
      break;
    }
      
    case 'contributions-vs-growth': {
      const growth = datasets.portfolioValue.map((value, index) => {
        const contrib = datasets.contributions[index] ?? 0;
        return value == null ? null : value - contrib;
      });
      performanceChart.data.datasets = [
        {
          label: 'Crescimento do Investimento',
          data: sliceData(growth),
          borderColor: 'rgb(22, 163, 74)',
          backgroundColor: 'rgba(22, 163, 74, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH,
          spanGaps: false
        },
        {
          label: 'Contribuições',
          data: sliceData(datasets.contributions),
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        }
      ];
      performanceChart.options.plugins.title.text = 'Contribuições vs Crescimento';
      break;
    }
      
    case 'asset-allocation':
      performanceChart.data.datasets = [
        {
          label: 'Valor VWCE',
          data: sliceData(datasets.swdaValues),
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        },
        {
          label: 'Valor AGGH',
          data: sliceData(datasets.agghValues),
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.1)',
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: DEFAULT_LINE_WIDTH
        }
      ];
      performanceChart.options.plugins.title.text = 'Distribuição de Ativos';
      break;
      
    case 'returns-comparison':
      performanceChart.type = 'bar';
      const slicedReturnsRaw = sliceData(datasets.monthlyReturns);
      const slicedReturns = slicedReturnsRaw.map(v => (typeof v === 'number' && isFinite(v)) ? v : null);
      performanceChart.data.datasets = [
        {
          label: 'Retorno Mensal (%)',
          data: slicedReturns,
          backgroundColor: slicedReturns.map(value => 
            value == null ? 'rgba(107, 114, 128, 0.3)' :
            value >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
          ),
          borderColor: slicedReturns.map(value => 
            value == null ? 'rgba(107, 114, 128, 0.4)' :
            value >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)'
          ),
          borderWidth: 1
        }
      ];
      performanceChart.options.scales.y.ticks.callback = function(value) {
        return `${value}%`;
      };
      performanceChart.options.plugins.title.text = 'Retornos Mensais';
      break;
  }
  
  // Reset to line chart if not returns comparison
  if (chartType !== 'returns-comparison') {
    performanceChart.type = 'line';
    performanceChart.options.scales.y.ticks.callback = function(value) {
      return toEUR(value);
    };
  }
  
  performanceChart.update();
}

// ---------- Export Chart as Image ----------
export function exportChartAsImage() {
  if (!performanceChart) return;
  
  const link = document.createElement('a');
  link.download = 'portfolio-chart.png';
  link.href = performanceChart.toBase64Image();
  link.click();
}

// ---------- Advanced Metrics Display ----------
export function updateAdvancedMetrics(metrics) {
  if (!metrics) {
    document.getElementById('twr-value').textContent = '-';
    document.getElementById('mwr-value').textContent = '-';
    document.getElementById('annualized-return').textContent = '-';
    return;
  }
  
  document.getElementById('twr-value').textContent = `${metrics.timeWeightedReturn.toFixed(2)}%`;
  document.getElementById('mwr-value').textContent = `${metrics.moneyWeightedReturn.toFixed(2)}%`;
  document.getElementById('annualized-return').textContent = `${metrics.annualizedReturn.toFixed(2)}%`;
}

// ---------- Rebalancing Display ----------
export function updateRebalancingSuggestions(rebalancingData) {
  const statusEl = document.getElementById('rebalancing-status');
  const suggestionsEl = document.getElementById('rebalancing-suggestions');
  const tableEl = document.getElementById('rebalancing-table');
  
  if (!rebalancingData || !rebalancingData.allocations) {
    statusEl.innerHTML = '<p>Não há dados suficientes para análise.</p>';
    if (suggestionsEl) suggestionsEl.style.display = 'none';
    if (tableEl) tableEl.innerHTML = '';
    return;
  }
  
  const { allocations, needsRebalancing, tolerance } = rebalancingData;
  
  if (statusEl) {
    statusEl.innerHTML = needsRebalancing
      ? `<p style="color: var(--bad);">⚠️ A alocação ultrapassou a margem de ${tolerance.toFixed(1)}%.</p>`
      : `<p style="color: var(--ok);">✅ A alocação está dentro da margem de ${tolerance.toFixed(1)}%.</p>`;
  }
  
  if (suggestionsEl) suggestionsEl.style.display = 'block';
  if (tableEl) tableEl.innerHTML = '';
  
  allocations.forEach(item => {
    const diffSign = item.difference > 0 ? '+' : '';
    const rowClass = item.action !== 'Manter' ? 'rebalance-alert' : '';
    const diffClass = item.action === 'Manter'
      ? ''
      : item.difference >= 0
        ? 'pos'
        : 'neg';
    const row = document.createElement('tr');
    if (rowClass) row.classList.add(rowClass);
    
    const actionText = item.action !== 'Manter'
      ? `${item.action} ${toEUR(item.amount)}`
      : 'Manter';
    
    row.innerHTML = `
      <td><strong>${item.asset}</strong></td>
      <td class="num">${item.current.toFixed(1)}%</td>
      <td class="num">${item.target.toFixed(1)}%</td>
      <td class="num ${diffClass}">${diffSign}${item.difference.toFixed(1)}%</td>
      <td style="font-weight: 700; color: ${item.action === 'Manter' ? 'var(--text-dim)' : item.action === 'Comprar' ? 'var(--ok)' : 'var(--bad)'};">${actionText}</td>
    `;
    
    tableEl.appendChild(row);
  });
}

// ---------- Export Functions ----------
export function exportToCSV(rows) {
  const csvData = generateCSVData(rows);
  const csvContent = csvData.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `dca-portfolio-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

