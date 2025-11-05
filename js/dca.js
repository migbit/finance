// js/dca.js — CORRIGIDO (sem <script> no ficheiro)

// Integração com Firebase conforme restante webapp
import { db } from '../js/script.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ---------- MOBILE MENU TOGGLE ----------
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const menuBtn = document.getElementById('menu-icon');
  const navMenu = document.getElementById('nav-menu');

  if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
      header.classList.toggle('active');
    });
  }

  // Close menu when a nav link is clicked
  if (navMenu && header) {
    navMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) header.classList.remove('active');
    });
  }
});

// ---------- Helpers ----------
const $  = (s,ctx=document)=>ctx.querySelector(s);
const $$ = (s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
const pad = (n)=> String(n).padStart(2,'0');
// Formata em euros no estilo PT (sem casas decimais, separador espaço)
const toEUR = (v) => {
  const num = Math.round(Number(v) || 0);
  return num.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
    useGrouping: true
  })
  .replace(/\./g, ' ') + ' €';
};
const asNum = (v)=> {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const roundMoney = (v)=> Math.round((Number(v) || 0) * 100) / 100;

// ==== Juro – módulo (cálculo + persistência) ====
const TAXA_ANUAL_FIXA = 0.02; // 2%

function diasNoMes(refYYYYMM) {
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

function euroFmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Soma a coluna JURO (coluna 11) do "Registo Mensal"
function somaJuroTabelaDCA() {
  const root = document.querySelector('#dca-table-wrap');
  if (!root) return 0;
  let soma = 0;

  // inputs
  root.querySelectorAll('table.table-dca tbody td:nth-child(11) input').forEach(inp => {
    const v = parseFloat((inp.value || '').toString().replace(',', '.'));
    if (!isNaN(v)) soma += v;
  });
  // texto (se não houver input)
  root.querySelectorAll('table.table-dca tbody td:nth-child(11)').forEach(td => {
    if (td.querySelector('input')) return;
    const txt = (td.textContent || '').replace(/[^\d,.\-]/g, '').replace(',', '.');
    const v = parseFloat(txt);
    if (!isNaN(v)) soma += v;
  });

  return soma;
}

async function saveJuroSaldo(saldo) {
  try {
    const docRef = doc(db, "dca_juro", "current");
    await setDoc(docRef, {
      saldo: parseFloat(saldo) || 0,
      taxa: TAXA_ANUAL_FIXA,
      updatedAt: new Date()
    });
  } catch (err) {
    console.error('Erro a gravar saldo:', err);
    alert('Erro ao gravar o saldo de juro.');
  }
}

// Load saved Saldo from Firestore and fill input
async function loadJuroSaldo() {
  try {
    const ref = doc(db, "dca_juro", "current");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const saldoInp = document.getElementById('juro-saldo');
      if (saldoInp && data.saldo != null) {
        saldoInp.value = parseFloat(data.saldo).toFixed(2);
      }
      const taxaInp = document.getElementById('juro-taxa');
      if (taxaInp && data.taxa != null) {
        taxaInp.value = (data.taxa * 100).toFixed(2);
      }
    }
  } catch (err) {
    console.error("Error loading Saldo:", err);
  }
}

// === Destacar o mês atual no Registo Mensal ===
function highlightCurrentMonthRow() {
  const wrap = document.getElementById('dca-table-wrap');
  if (!wrap) return;
  const tbl = wrap.querySelector('table.table-dca');
  if (!tbl) return;

  // limpar anterior
  tbl.querySelectorAll('tbody tr.current-month').forEach(tr => tr.classList.remove('current-month'));

  const now   = new Date();
  const ymNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // 1) tentar via data-ym (mais fiável)
  let row = tbl.querySelector(`tbody tr[data-ym="${ymNow}"]`);

  // 2) fallback: se não tiver data-ym, tenta ler o texto da 1ª célula
  if (!row) {
    const rows = Array.from(tbl.querySelectorAll('tbody tr'));
    for (const tr of rows) {
      const td = tr.querySelector('td'); if (!td) continue;
      const t = (td.textContent || '').trim().toLowerCase();

      // aceita mm/yy (2 dígitos) OU mm/yyyy (4 dígitos)
      const m = now.getMonth()+1, y = now.getFullYear();
      const yy2 = String(y).slice(-2);
      const rx = new RegExp(`^${m}\\/(?:${y}|${yy2})$`); // ex.: 10/2025 ou 10/25
      if (rx.test(t)) { row = tr; break; }
    }
  }

  if (row) row.classList.add('current-month');
}

// correr ao carregar e após mutações (quando a tabela muda)
if (document.readyState !== 'loading') highlightCurrentMonthRow();
else document.addEventListener('DOMContentLoaded', highlightCurrentMonthRow);

(() => {
  const target = document.getElementById('dca-table-wrap');
  if (target && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => highlightCurrentMonthRow());
    mo.observe(target, { childList: true, subtree: true });
  }
})();

// Liga eventos e calcula valores (podes chamar isto em qualquer altura)
async function bindJuroModule() {
  const saldoInp   = document.getElementById('juro-saldo');
  const taxaInp    = document.getElementById('juro-taxa');
  const mensalLbl  = document.getElementById('juro-mensal');
  const acumLbl    = document.getElementById('juro-acumulado');
  const endDateInp = document.getElementById('end-date');

  // se a página não tiver o bloco "Juro", sai
  if (!saldoInp || !taxaInp || !mensalLbl || !acumLbl) return;

  taxaInp.value = '2.00'; // fixa visualmente

  const atualizar = () => {
    const saldo = parseFloat((saldoInp.value || '').toString().replace(',', '.')) || 0;
    const dias  = diasNoMes(endDateInp?.value);
    const mensal = saldo * TAXA_ANUAL_FIXA * (dias / 365);
    mensalLbl.textContent = euroFmt(mensal);

    const soma = somaJuroTabelaDCA();
    acumLbl.textContent = euroFmt(soma);
  };

  ['input','change'].forEach(evt => {
    saldoInp.addEventListener(evt, atualizar);
    endDateInp?.addEventListener(evt, atualizar);
  });

  // observar alterações no Registo Mensal
  const obsRoot = document.getElementById('dca-table-wrap');
  if (obsRoot && 'MutationObserver' in window) {
    const mo = new MutationObserver(atualizar);
    mo.observe(obsRoot, { childList: true, subtree: true, characterData: true });
  }

  // Botões
  document.getElementById('btn-juro-editar')?.addEventListener('click', () => {
    saldoInp.removeAttribute('disabled');
    saldoInp.focus();
  });
  document.getElementById('btn-juro-gravar')?.addEventListener('click', async () => {
    saldoInp.setAttribute('disabled','disabled');
    await saveJuroSaldo(saldoInp.value);
    await loadJuroSaldo(); // refresh displayed value after saving
  });

  await loadJuroSaldo();

  atualizar();
}

// ---------- Auth gating for first KPI (kpi-inv) ----------
let __isAuthed = false;

function setKpiInvVisibility(visible){
  const canvas = document.getElementById('kpi-inv');
  const card = canvas ? canvas.closest('.kpi-item') : null;
  if (card){
    card.style.display = visible ? '' : 'none';
  }
}

function handleAuthChange(user){
  __isAuthed = !!user;
  // Toggle visibility immediately
  setKpiInvVisibility(__isAuthed);
  // If became authed, (re)render KPI; if not, destroy it
  if (__isAuthed){
    // Defer to next tick to ensure module finished initializing (state declared)
    setTimeout(() => { try { renderKpiInv(state.params); } catch(e){} }, 0);
  } else {
    try { destroyChart(kpiInvChart); } catch(e){}
  }
}

// Bind auth listener early
try {
  const auth = getAuth();
  onAuthStateChanged(auth, handleAuthChange);
} catch(e) {
  // If auth is not available for any reason, default to hiding KPI
  handleAuthChange(null);
}

// Ensure hidden by default until auth state resolves
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => setKpiInvVisibility(false), { once: true });
} else {
  setKpiInvVisibility(false);
}

// ---------- Parâmetros default ----------
const START_YM = { y: 2025, m: 9 }; // set 2025 fixo
const DEFAULTS  = {
  endYM: { y: 2040, m: 9 },
  pctSWDA: 79.61,  // equivalente a ~121€ por mês em VWCE
  pctAGGH: 20.39,  // equivalente a ~31€ por mês em AGGH
  monthlyContribution: 152
};

// ---------- Firestore ----------
const COL        = collection(db, 'dca');                // linhas mensais
const SETTINGS_D = doc(collection(db, 'dca_settings'), 'params'); // único doc

async function ensureMonthsExist(endYM){
  const ids = monthsBetween(START_YM, endYM).map(({y,m})=> `${y}-${pad(m)}`);
  await Promise.all(ids.map(async id => {
    const ref = doc(COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()){
      await setDoc(ref, {
        id,
        y: Number(id.slice(0,4)), m: Number(id.slice(5,7)),
        invested_total: 0,
        invested_swda: 0,
        invested_aggh: 0,
        value_total: null,   // manual
        swda_value: null,    // manual
        aggh_value: null,    // manual
        cash_interest: null, // manual (se aplicável)
        created_at: Date.now()
      });
    }
  }));
}

async function loadParams(){
  const snap = await getDoc(SETTINGS_D);
  if (snap.exists()){
    const p = snap.data();
    // validações básicas
    const normalized = {
      endYM: p.endYM ?? DEFAULTS.endYM,
      pctSWDA: Number(p.pctSWDA ?? DEFAULTS.pctSWDA),
      pctAGGH: Number(p.pctAGGH ?? DEFAULTS.pctAGGH),
      monthlyContribution: Number(p.monthlyContribution ?? DEFAULTS.monthlyContribution)
    };
    const near = (a,b)=> Math.abs(a - b) < 0.01;
    const legacy55_45 = near(normalized.pctSWDA, 55) && near(normalized.pctAGGH, 45);
    const legacy75_25 = near(normalized.pctSWDA, 75) && near(normalized.pctAGGH, 25);
    if (legacy55_45 || legacy75_25){
      const upgraded = { ...normalized, pctSWDA: DEFAULTS.pctSWDA, pctAGGH: DEFAULTS.pctAGGH };
      await saveParams(upgraded); // persiste o novo plano mantendo restante configuração
      return upgraded;
    }
    return normalized;
  }
  // se não existir, cria com defaults
  await setDoc(SETTINGS_D, DEFAULTS);
  return { ...DEFAULTS };
}

async function saveParams(p){
  await setDoc(SETTINGS_D, p, { merge: true });
}

async function loadAllDocs(){
  const q = query(COL, orderBy('id','asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d=> ({ id:d.id, ...d.data() }));
}

async function saveRow(id, patch){
  const ref = doc(COL, id);
  await updateDoc(ref, patch);
}

// ---------- Lógica de meses e investimento ----------
function monthsBetween(a, b){
  const out=[]; let y=a.y, m=a.m;
  while (y < b.y || (y===b.y && m<=b.m)){
    out.push({y, m});
    m++; if (m>12){ m=1; y++; }
  }
  return out;
}

function buildModel(docs, params){
  const { pctSWDA, pctAGGH, monthlyContribution } = params;
  const rows = [];

  let investedCum = 0;
  let investedCumSWDA = 0;
  let investedCumAGGH = 0;

  const months = docs.sort((a,b)=> a.id.localeCompare(b.id));

  for (const d of months){
    let monthlySW    = roundMoney(monthlyContribution * (pctSWDA/100));
    let monthlyAG    = roundMoney(monthlyContribution * (pctAGGH/100));
    let monthlyTotal = roundMoney(monthlySW + monthlyAG);
    const adjust = roundMoney(monthlyContribution - monthlyTotal);
    if (adjust !== 0){
      if (Math.abs(monthlySW) >= Math.abs(monthlyAG)){
        monthlySW = roundMoney(monthlySW + adjust);
      } else {
        monthlyAG = roundMoney(monthlyAG + adjust);
      }
      monthlyTotal = roundMoney(monthlySW + monthlyAG);
    }

    investedCum      = roundMoney(investedCum + monthlyTotal);
    investedCumSWDA  = roundMoney(investedCumSWDA + monthlySW);
    investedCumAGGH  = roundMoney(investedCumAGGH + monthlyAG);

    const swdaNow = asNum(d.swda_value);
    const agghNow = asNum(d.aggh_value);
    const cashNow = asNum(d.cash_interest);

    const hasAny  = (swdaNow != null) || (agghNow != null) || (cashNow != null);

    // Valor atual total = VWCE + AGGH + Juro (quando houver algum input)
    const totalNow = (swdaNow ?? 0) + (agghNow ?? 0) + (cashNow ?? 0);

    // Resultados (€ e %) só quando houver valores
    const resTotal    = hasAny ? (totalNow - investedCum) : null;
    const resTotalPct = hasAny ? (resTotal / investedCum * 100) : null;

    const resSWDA    = swdaNow != null ? (swdaNow - investedCumSWDA) : null;
    const resSWDAPct = swdaNow != null && investedCumSWDA > 0 ? (resSWDA / investedCumSWDA * 100) : null;

    const resAGGH    = agghNow != null ? (agghNow - investedCumAGGH) : null;
    const resAGGHPct = agghNow != null && investedCumAGGH > 0 ? (resAGGH / investedCumAGGH * 100) : null;

    rows.push({
      id: d.id, y:d.y, m:d.m,
      investedCum, investedCumSWDA, investedCumAGGH,
      totalNow, swdaNow, agghNow,
      resTotal, resTotalPct,
      resSWDA,  resSWDAPct,
      resAGGH,  resAGGHPct,
      hasCurrent: hasAny,
      cash_interest: asNum(d.cash_interest),
    });
  }
  return rows;
}

// ---------- Render ----------
function yearGroups(rows){
  const map = new Map();
  for (const r of rows){
    if (!map.has(r.y)) map.set(r.y, []);
    map.get(r.y).push(r);
  }
  for (const [y, arr] of map) arr.sort((a,b)=> a.m - b.m);
  return [...map.entries()].sort((a,b)=> a[0]-b[0]);
}

function renderTable(rows){
  const wrap = $('#dca-table-wrap');
  if (!wrap) return;

  const fmtPct = v => (v == null ? '' : ` <small>(${v.toFixed(2)}%)</small>`);

  const groups = yearGroups(rows);
  wrap.innerHTML = '';

  for (const [y, arr] of groups){
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

          <th colspan="3" class="swda-block">VWCE</th>
          <th colspan="3" class="aggh-block">AGGH</th>

          <th rowspan="2" class="num">Juro</th>
          <th rowspan="2">Ações</th>
        </tr>
        <tr>
          <th class="num swda-block">Inv.</th>
          <th class="num swda-block">Atual</th>
          <th class="num swda-block">Delta</th>

          <th class="num aggh-block">Inv.</th>
          <th class="num aggh-block">Atual</th>
          <th class="num aggh-block">Delta</th>
        </tr>
      </thead>
    `;

    table.innerHTML = theadHTML + '<tbody></tbody>';
    const tbody = table.querySelector('tbody');

    for (const r of arr){
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;
      tr.dataset.ym = `${r.y}-${pad(r.m)}`;

      const clsTotal = r.resTotal != null ? (r.resTotal >= 0 ? 'pos' : 'neg') : '';
      const clsSWDA  = r.resSWDA  != null ? (r.resSWDA  >= 0 ? 'pos' : 'neg') : '';
      const clsAGGH  = r.resAGGH  != null ? (r.resAGGH  >= 0 ? 'pos' : 'neg') : '';

      tr.innerHTML = `
        <td>${pad(r.m)}/${String(r.y).slice(-2)}</td>
        <td class="num">${toEUR(r.investedCum)}</td>
        <td class="num total-block">${r.hasCurrent ? toEUR(r.totalNow) : '-'}</td>
        <td class="num ${clsTotal}">${r.resTotal == null ? '-' : toEUR(r.resTotal)}${fmtPct(r.resTotalPct)}</td>

        <td class="num swda-block">${toEUR(r.investedCumSWDA)}</td>
        <td class="num swda-block"><input class="cell swda" type="number" step="0.01" value="${r.swdaNow ?? ''}" /></td>
        <td class="num swda-block ${clsSWDA}">${r.resSWDA == null ? '-' : toEUR(r.resSWDA)}${fmtPct(r.resSWDAPct)}</td>

        <td class="num aggh-block">${toEUR(r.investedCumAGGH)}</td>
        <td class="num aggh-block"><input class="cell aggh" type="number" step="0.01" value="${r.agghNow ?? ''}" /></td>
        <td class="num aggh-block ${clsAGGH}">${r.resAGGH == null ? '-' : toEUR(r.resAGGH)}${fmtPct(r.resAGGHPct)}</td>

        <td class="num"><input class="cell cash" type="number" step="0.01" value="${r.cash_interest ?? ''}" /></td>
        <td><button class="btn-save icon-pencil" type="button" aria-label="Editar">&#9998;</button></td>
      `;
      tbody.appendChild(tr);
    }

    const groupWrap = document.createElement('div');
    groupWrap.className = 'year-group';
    groupWrap.appendChild(h);
    groupWrap.appendChild(table);
    wrap.appendChild(groupWrap);
  }
}

// Listener único para guardar linhas (event delegation)
(() => {
  const wrap = document.getElementById('dca-table-wrap');
  if (!wrap) return;
  if (wrap.__boundSave) return; // evita duplicação se renderTable for chamado várias vezes
  wrap.__boundSave = true;

  wrap.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.btn-save');
    if (!b) return;
    const tr = b.closest('tr');
    const id = tr?.dataset?.id;
    if (!id) return;

    const swda  = asNum(tr.querySelector('.swda')?.value);
    const aggh  = asNum(tr.querySelector('.aggh')?.value);
    const cash  = asNum(tr.querySelector('.cash')?.value);

    await saveRow(id, {
      swda_value:  swda,
      aggh_value:  aggh,
      cash_interest: cash
    });

    await boot(true); // recalcular e re-render após gravar
  });
})();

// ---------- Estado / Boot ----------
const state = {
  params: { ...DEFAULTS },
  showOthers: false   // anos != ano atual visíveis?
};

function readParamsFromUI(){
  const [ey, em] = ($('#end-date')?.value || `${DEFAULTS.endYM.y}-${pad(DEFAULTS.endYM.m)}`).split('-').map(Number);
  const pctS = asNum($('#pct-swda')?.value) ?? DEFAULTS.pctSWDA;
  const pctA = asNum($('#pct-aggh')?.value) ?? DEFAULTS.pctAGGH;
  const monthly = asNum($('#monthly-contribution')?.value) ?? DEFAULTS.monthlyContribution;
  const fix  = (n)=> Math.max(0, Math.min(100, n));
  const pctSumOk = Math.abs((pctS + pctA) - 100) < 0.01;
  return { endYM:{y:ey,m:em}, pctSWDA:fix(pctS), pctAGGH:fix(pctA), monthlyContribution: monthly, pctSumOk };
}

function writeParamsToUI(p){
  const ed = $('#end-date'); if (ed) ed.value = `${p.endYM.y}-${pad(p.endYM.m)}`;
  const sw = $('#pct-swda'); if (sw) sw.value = p.pctSWDA;
  const ag = $('#pct-aggh'); if (ag) ag.value = p.pctAGGH;
  const mc = $('#monthly-contribution'); if (mc) mc.value = p.monthlyContribution;
  updateAutoContributionDisplay(p);
}

function updateAutoContributionDisplay(params) {
  const monthlySW = Math.round(params.monthlyContribution * (params.pctSWDA/100));
  const monthlyAG = Math.round(params.monthlyContribution * (params.pctAGGH/100));
  
  $('#auto-swda').textContent = `${monthlySW} €`;
  $('#auto-aggh').textContent = `${monthlyAG} €`;
  $('#auto-total').textContent = `${params.monthlyContribution} €`;
}

function applyYearVisibility(){
  const currentYear = new Date().getFullYear();
  const groups = Array.from(document.querySelectorAll('#dca-table-wrap .year-group'));

  for (const g of groups){
    const yTxt = g.querySelector('h3')?.textContent || '';
    const y = Number(yTxt.trim());
    if (!Number.isFinite(y)) continue;

    if (y === currentYear) {
      // Ano atual sempre visível
      g.style.display = '';
    } else {
      // Outros anos: mostram-se só quando showOthers = true
      g.style.display = state.showOthers ? '' : 'none';
    }
  }

  const btn = document.getElementById('toggle-others');
  if (btn) btn.textContent = state.showOthers ? 'Ocultar anos' : 'Expandir anos';
}

// Liga o botão global (só uma vez), mesmo que o render corra antes/depois
function bindGlobalButtons(){
  const btn = document.getElementById('toggle-others');
  if (!btn || btn.__bound) return;
  btn.__bound = true;
  btn.addEventListener('click', () => {
    state.showOthers = !state.showOthers;
    applyYearVisibility();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindGlobalButtons, { once: true });
} else {
  bindGlobalButtons();
}

// ---------- Eventos UI ----------
$('#btn-save-params')?.addEventListener('click', async ()=>{
  const p = readParamsFromUI();
  if (!p.pctSumOk){
    alert('As percentagens VWCE+AGGH devem somar 100%.');
    return;
  }
  const { pctSumOk, ...params } = p;
  state.params = params;
  await saveParams(params);   // persiste no Firebase
  await boot(true);      // refaz meses/tabela com novos parâmetros
});

// Update auto contribution when monthly contribution changes
$('#monthly-contribution')?.addEventListener('input', () => {
  const params = readParamsFromUI();
  updateAutoContributionDisplay(params);
});

// ---------- Enhanced KPI Functions ----------

// Enhanced KPI calculations
function calculateEnhancedKPIs(rows) {
  if (!rows || rows.length === 0) return null;
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentRow = rows.find(row => row.id === currentMonth) || rows[rows.length - 1];
  
  if (!currentRow) return null;
  
  const totalInvested = currentRow.investedCum;
  const currentValue = currentRow.totalNow || 0;
  const totalInterest = somaJuroTabelaDCA();
  const result = currentValue - totalInvested;
  const resultPct = totalInvested > 0 ? (result / totalInvested * 100) : 0;
  
  return {
    totalInvested,
    currentValue,
    result,
    resultPct,
    totalInterest
  };
}

// Scenario calculations
function calculateScenarios(totalInvested, months, currentValue) {
  const annualRates = {
    conservative: 0.03,
    moderate: 0.05,
    optimistic: 0.07
  };
  
  const scenarios = {};
  const years = months / 12;
  
  for (const [scenario, rate] of Object.entries(annualRates)) {
    const futureValue = totalInvested * Math.pow(1 + rate, years);
    scenarios[scenario] = {
      futureValue: futureValue,
      difference: futureValue - currentValue
    };
  }
  
  return scenarios;
}

// Benchmark calculations
function calculateBenchmarks(currentValue, totalInvested, months) {
  const benchmarks = {
    'Poupança Bancária (1%)': 0.01,
    'Inflação (2%)': 0.02,
    'S&P 500 (10%)': 0.10
  };
  
  const years = months / 12;
  const results = {};
  
  for (const [name, rate] of Object.entries(benchmarks)) {
    const benchmarkValue = totalInvested * Math.pow(1 + rate, years);
    const difference = currentValue - benchmarkValue;
    const differencePct = (difference / benchmarkValue) * 100;
    
    results[name] = {
      value: benchmarkValue,
      difference: difference,
      differencePct: differencePct,
      outperforming: difference > 0
    };
  }
  
  return results;
}

// Update enhanced KPIs in UI
function updateEnhancedKPIs(rows, params) {
  const kpis = calculateEnhancedKPIs(rows);
  if (!kpis) return;
  
  // Update basic KPIs
  document.getElementById('kpi-total-invested').textContent = toEUR(kpis.totalInvested);
  document.getElementById('kpi-current-value').textContent = toEUR(kpis.currentValue);
  document.getElementById('kpi-result').textContent = toEUR(kpis.result);
  document.getElementById('kpi-result-pct').textContent = `${kpis.resultPct.toFixed(2)}%`;
  document.getElementById('kpi-result-pct').className = `kpi-sub ${kpis.result >= 0 ? 'pos' : 'neg'}`;
  document.getElementById('kpi-total-interest').textContent = toEUR(kpis.totalInterest);
  
  // Calculate and update scenarios
  const totalMonths = monthsBetween(START_YM, params.endYM).length;
  const scenarios = calculateScenarios(kpis.totalInvested, totalMonths, kpis.currentValue);
  
  for (const [scenario, data] of Object.entries(scenarios)) {
    const element = document.getElementById(`scenario-${scenario}`);
    if (element) {
      element.textContent = toEUR(data.futureValue);
    }
  }
  
  // Calculate and update benchmarks
  const benchmarks = calculateBenchmarks(kpis.currentValue, kpis.totalInvested, totalMonths);
  updateBenchmarkDisplay(benchmarks);
}

// Update benchmark comparison in UI
function updateBenchmarkDisplay(benchmarks) {
  let benchmarkHTML = '';
  
  for (const [name, data] of Object.entries(benchmarks)) {
    const cardClass = data.outperforming ? 'benchmark-card outperforming' : 'benchmark-card underperforming';
    const diffClass = data.difference >= 0 ? 'pos' : 'neg';
    const diffSign = data.difference >= 0 ? '+' : '';
    
    benchmarkHTML += `
      <div class="${cardClass}">
        <div class="benchmark-name">${name}</div>
        <div class="benchmark-value">${toEUR(data.value)}</div>
        <div class="benchmark-difference ${diffClass}">
          ${diffSign}${toEUR(data.difference)} (${diffSign}${data.differencePct.toFixed(1)}%)
        </div>
      </div>
    `;
  }
  
  // Create or update benchmark section
  let benchmarkSection = document.querySelector('.benchmark-comparison');
  if (!benchmarkSection) {
    benchmarkSection = document.createElement('div');
    benchmarkSection.className = 'benchmark-comparison';
    benchmarkSection.innerHTML = `
      <h5 style="text-align: center; margin-bottom: 1rem; color: var(--text-dim);">Comparação com Benchmarks</h5>
      <div class="benchmark-grid">
        ${benchmarkHTML}
      </div>
    `;
    document.querySelector('#kpi-cenarios-card').appendChild(benchmarkSection);
  } else {
    benchmarkSection.querySelector('.benchmark-grid').innerHTML = benchmarkHTML;
  }
}

// Arranque
async function boot(skipParamUI){
  if (!skipParamUI){
    state.params = await loadParams();
    writeParamsToUI(state.params);
  }
  await ensureMonthsExist(state.params.endYM);
  const docs = await loadAllDocs();
  window.__lastDocs = docs;

  const limId = `${state.params.endYM.y}-${pad(state.params.endYM.m)}`;
  const subset = docs.filter(d => d.id <= limId);
  const rows = buildModel(subset, state.params);

  renderTable(rows);
  bindGlobalButtons();
  applyYearVisibility(); // aplica regra ao arranque
  
  // Add scroll indicators to table wrappers
  requestAnimationFrame(addScrollIndicators);

  // Update KPI doughnut (INV vs Total) only if authenticated
  if (__isAuthed) renderKpiInv(state.params);
  
  // NEW: Update enhanced KPIs and scenarios
  updateEnhancedKPIs(rows, state.params);
}

// Add visual indicators for scrollable tables
function addScrollIndicators() {
  document.querySelectorAll('.table-wrap').forEach(wrap => {
    const hasScroll = wrap.scrollWidth > wrap.clientWidth;
    if (hasScroll) {
      wrap.classList.add('has-scroll');
    } else {
      wrap.classList.remove('has-scroll');
    }
  });
}

// Update scroll indicators on window resize
window.addEventListener('resize', addScrollIndicators);

boot();

// garante bind mesmo se o DOM já estiver carregado
if (document.readyState !== 'loading') bindJuroModule();
else document.addEventListener('DOMContentLoaded', bindJuroModule);

// ====== KPI: INV (mês atual) vs Total alvo ======
let kpiInvChart;

// Simple plugin to draw center text and label on first arc
const kpiLabelsPlugin = {
  id: 'kpiLabels',
  afterDatasetsDraw(chart, args, pluginOptions){
    const opts = chart?.options?.plugins?.kpiLabels;
    if (!opts) return;
    const { center, arc } = opts;
    const { ctx, chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    ctx.save();
    // Center text
    if (center){
      ctx.font = '600 13px Montserrat, Arial, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      ctx.fillText(center, cx, cy);
    }

    // Arc label for the first slice (Atual/Investido)
    if (arc){
      const a0 = meta.data[0];
      if (a0 && a0.getCenterPoint){
        // Compute midpoint between radii and angles
        const start = a0.startAngle || a0.angle - a0.circumference/2;
        const end   = a0.endAngle   || a0.angle + a0.circumference/2;
        const angle = (start + end) / 2;
        const inner = a0.innerRadius || 0;
        const outer = a0.outerRadius || 0;
        const r = inner + (outer - inner) * 0.7; // push out towards the arc
        const x = a0.x + Math.cos(angle) * r;
        const y = a0.y + Math.sin(angle) * r;

        ctx.font = '700 12px Montserrat, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#27374D'; // deep blue (--p1)
        ctx.fillText(arc, x, y);
      }
    }
    ctx.restore();
  }
};

if (window.Chart && window.Chart.register){
  try { window.Chart.register(kpiLabelsPlugin); } catch(e){}
}

function ymCompare(a, b){
  if (a.y !== b.y) return a.y - b.y;
  return a.m - b.m;
}

function ymMin(a, b){
  return ymCompare(a,b) <= 0 ? a : b;
}

function ymMax(a, b){
  return ymCompare(a,b) >= 0 ? a : b;
}

function renderKpiInv(params){
  const canvas = document.getElementById('kpi-inv');
  if (!__isAuthed) { try { destroyChart(kpiInvChart); } catch(e){} return; }
  if (!canvas || !window.Chart) return;

  // Total alvo = nº de meses de START_YM até endYM (incl.) x contribuição mensal
  const totalMonths = monthsBetween(START_YM, params.endYM).length;
  const totalTarget = totalMonths * params.monthlyContribution;

  // Investido até ao mês atual (incl.), limitado por [START_YM, endYM]
  const now = new Date();
  const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const clampedEnd = ymMin(params.endYM, nowYM);

  let invested = 0;
  if (ymCompare(nowYM, START_YM) >= 0){
    const investedMonths = monthsBetween(START_YM, clampedEnd).length;
    invested = investedMonths * params.monthlyContribution;
  }

  const remaining = Math.max(0, totalTarget - invested);

  // Recreate chart safely
  if (kpiInvChart){
    try { kpiInvChart.destroy(); } catch(e) { /* ignore */ }
    kpiInvChart = null;
  }

  const ctx = canvas.getContext('2d');
  kpiInvChart = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Investido', 'Por investir'],
      datasets: [{
        data: [invested, remaining],
        backgroundColor: ['#1a8f5d', '#e0e0e0'],
        borderWidth: 0,
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        kpiLabels: {
          center: toEUR(totalTarget),
          arc: `${toEUR(invested)} (${totalTarget>0 ? Math.round((invested/totalTarget)*100) : 0}%)`
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.parsed) || 0;
              return `${ctx.label}: ${toEUR(v)}`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function destroyChart(ch){ try { ch && ch.destroy && ch.destroy(); } catch(e){} }

// Try to render KPI once boot has parameters ready
(function(){
  const tryRender = () => { if (__isAuthed) renderKpiInv(state.params); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryRender, { once: true });
  } else {
    tryRender();
  }
})();