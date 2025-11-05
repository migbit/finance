// js/dca-ui.js - UI rendering functions

import { toEUR, asNum, euroFmt } from './dca-calculations.js';

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

          <th colspan="3" class="swda-block" style="background: rgba(54,162,235,0.15); border-left: 3px solid rgba(54,162,235,0.8);">VWCE</th>
          <th colspan="3" class="aggh-block" style="background: rgba(245,133,20,0.15); border-left: 3px solid rgba(245,133,20,0.8);">AGGH</th>

          <th rowspan="2" class="num">Juro</th>
          <th rowspan="2">Ações</th>
        </tr>
        <tr>
          <th class="num swda-block" style="background: rgba(54,162,235,0.1);">Inv.</th>
          <th class="num swda-block" style="background: rgba(54,162,235,0.1);">Atual</th>
          <th class="num swda-block" style="background: rgba(54,162,235,0.1);">Delta</th>

          <th class="num aggh-block" style="background: rgba(245,133,20,0.1);">Inv.</th>
          <th class="num aggh-block" style="background: rgba(245,133,20,0.1);">Atual</th>
          <th class="num aggh-block" style="background: rgba(245,133,20,0.1);">Delta</th>
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

        <td class="num swda-block" style="background: rgba(54,162,235,0.05);">${toEUR(r.investedCumSWDA)}</td>
        <td class="num swda-block" style="background: rgba(54,162,235,0.05);"><input class="cell swda" type="number" step="0.01" value="${r.swdaNow ?? ''}" /></td>
        <td class="num swda-block ${clsSWDA}" style="background: rgba(54,162,235,0.05);">${r.resSWDA == null ? '-' : toEUR(r.resSWDA)}${fmtPct(r.resSWDAPct)}</td>

        <td class="num aggh-block" style="background: rgba(245,133,20,0.05);">${toEUR(r.investedCumAGGH)}</td>
        <td class="num aggh-block" style="background: rgba(245,133,20,0.05);"><input class="cell aggh" type="number" step="0.01" value="${r.agghNow ?? ''}" /></td>
        <td class="num aggh-block ${clsAGGH}" style="background: rgba(245,133,20,0.05);">${r.resAGGH == null ? '-' : toEUR(r.resAGGH)}${fmtPct(r.resAGGHPct)}</td>

        <td class="num"><input class="cell cash" type="number" step="0.01" value="${r.cash_interest ?? ''}" /></td>
        <td><button class="btn-save icon-pencil" type="button" aria-label="Guardar">💾</button></td>
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
    document.getElementById('kpi-result-pct').textContent = '-';
    document.getElementById('kpi-total-interest').textContent = toEUR(totalInterest || 0);
    return;
  }
  
  document.getElementById('kpi-total-invested').textContent = toEUR(kpis.totalInvested);
  document.getElementById('kpi-current-value').textContent = toEUR(kpis.currentValue);
  document.getElementById('kpi-result').textContent = toEUR(kpis.result);
  
  const pctEl = document.getElementById('kpi-result-pct');
  pctEl.textContent = `${kpis.resultPct.toFixed(2)}%`;
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
  
  if (iconEl) iconEl.textContent = goalStatus.icon;
  if (textEl) {
    textEl.textContent = goalStatus.text;
    textEl.style.color = goalStatus.color;
  }
}

// ---------- Scenarios ----------
export function updateScenarios(scenarios) {
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
      const sign = data.diff >= 0 ? '+' : '';
      const cls = data.diff >= 0 ? 'pos' : 'neg';
      diffEl.textContent = `${sign}${toEUR(data.diff)}`;
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
}

export function readParamsFromUI(defaults) {
  const endDateVal = document.getElementById('end-date')?.value || `${defaults.endYM.y}-${pad(defaults.endYM.m)}`;
  const [ey, em] = endDateVal.split('-').map(Number);
  
  const pctS = asNum(document.getElementById('pct-swda')?.value) ?? defaults.pctSWDA;
  const pctA = asNum(document.getElementById('pct-aggh')?.value) ?? defaults.pctAGGH;
  const monthly = asNum(document.getElementById('monthly-contribution')?.value) ?? defaults.monthlyContribution;
  
  const fix = (n) => Math.max(0, Math.min(100, n));
  const pctSumOk = Math.abs((pctS + pctA) - 100) < 0.01;
  
  return { 
    endYM: {y:ey, m:em}, 
    pctSWDA: fix(pctS), 
    pctAGGH: fix(pctA), 
    monthlyContribution: monthly, 
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