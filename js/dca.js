// js/dca.js  — CORRIGIDO (sem <script> no ficheiro)

// Integração com Firebase conforme restante webapp
import { db } from '../js/script.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

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

// ---------- Parâmetros default ----------
const START_YM = { y: 2025, m: 9 }; // set 2025 fixo
const DEFAULTS  = {
  endYM: { y: 2040, m: 9 },
  pctSWDA: 55,
  pctAGGH: 45,
  ratePes: 3.84,   // % a.a.
  rateReal: 4.64,  // % a.a.
  rateOtim: 7.00,  // % a.a.
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
    return {
      endYM: p.endYM ?? DEFAULTS.endYM,
      pctSWDA: Number(p.pctSWDA ?? DEFAULTS.pctSWDA),
      pctAGGH: Number(p.pctAGGH ?? DEFAULTS.pctAGGH),
      ratePes: Number(p.ratePes ?? DEFAULTS.ratePes),
      rateReal: Number(p.rateReal ?? DEFAULTS.rateReal),
      rateOtim: Number(p.rateOtim ?? DEFAULTS.rateOtim)
    };
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
  const { pctSWDA, pctAGGH, ratePes, rateReal, rateOtim } = params;
  const rows = [];

  let investedCum = 0;
  let investedCumSWDA = 0;
  let investedCumAGGH = 0;

  const months = docs.sort((a,b)=> a.id.localeCompare(b.id));

  for (const d of months){
    investedCum      += 100; // contribuição fixa
    investedCumSWDA  += 100 * (pctSWDA/100);
    investedCumAGGH  += 100 * (pctAGGH/100);

    const swdaNow = asNum(d.swda_value);
    const agghNow = asNum(d.aggh_value);
    const cashNow = asNum(d.cash_interest);

    const hasAny  = (swdaNow != null) || (agghNow != null) || (cashNow != null);

    // Valor atual total = SWDA + AGGH + Juro (quando houver algum input)
    const totalNow = (swdaNow ?? 0) + (agghNow ?? 0) + (cashNow ?? 0);

    // Resultados (€ e %) só quando houver valores
    const resTotal    = hasAny ? (totalNow - investedCum) : null;
    const resTotalPct = hasAny ? (resTotal / investedCum * 100) : null;

    const resSWDA    = swdaNow != null ? (swdaNow - investedCumSWDA) : null;
    const resSWDAPct = swdaNow != null && investedCumSWDA > 0 ? (resSWDA / investedCumSWDA * 100) : null;

    const resAGGH    = agghNow != null ? (agghNow - investedCumAGGH) : null;
    const resAGGHPct = agghNow != null && investedCumAGGH > 0 ? (resAGGH / investedCumAGGH * 100) : null;

    // Cenários sobre acumulado, capitalizado a TIR anual
    const monthsFromStart = ((d.y - START_YM.y) * 12) + (d.m - START_YM.m);
    const yearsFromStart  = monthsFromStart / 12;
    const scen = (rate)=> investedCum * Math.pow(1 + rate/100, yearsFromStart);

    rows.push({
      id: d.id, y:d.y, m:d.m,
      investedCum, investedCumSWDA, investedCumAGGH,
      totalNow, swdaNow, agghNow,
      resTotal, resTotalPct,
      resSWDA,  resSWDAPct,
      resAGGH,  resAGGHPct,
      pes: scen(ratePes), real: scen(rateReal), otim: scen(rateOtim),
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

    // Cabeçalho agrupado — Cenários (€) começa por "Atual" (valor total = SWDA+AGGH+Juro)
const theadHTML = `
  <thead>
    <tr>
      <th rowspan="2">Mês</th>
      <th rowspan="2" class="num">Inv.</th>

      <th colspan="3" class="swda-block cenarios">SWDA</th>
      <th colspan="3" class="aggh-block cenarios">AGGH</th>

      <th rowspan="2" class="num res-total-block">
        Res.<br>Total<br>(€/%) 
      </th>

      <th colspan="4" class="cenarios">Cenários (€)</th>

      <th rowspan="2" class="num">Juro</th>
      <th rowspan="2">Ações</th>
    </tr>
    <tr>
      <th class="num swda-block">Inv.</th>
      <th class="num swda-block">Atual</th>
      <th class="num swda-block">Res.</th>

      <th class="num aggh-block">Inv.</th>
      <th class="num aggh-block">Atual</th>
      <th class="num aggh-block">Res.</th>

      <th class="num">Atual</th>
      <th class="num">Pes.</th>
      <th class="num">Real.</th>
      <th class="num">Ot.</th>
    </tr>
  </thead>
`;



    table.innerHTML = theadHTML + '<tbody></tbody>';
    const tbody = table.querySelector('tbody');

    for (const r of arr){
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;

      const clsTotal = r.resTotal != null ? (r.resTotal >= 0 ? 'pos' : 'neg') : '';
      const clsSWDA  = r.resSWDA  != null ? (r.resSWDA  >= 0 ? 'pos' : 'neg') : '';
      const clsAGGH  = r.resAGGH  != null ? (r.resAGGH  >= 0 ? 'pos' : 'neg') : '';

      tr.innerHTML = `
        <td>${pad(r.m)}/${String(r.y).slice(-2)}</td>
        <td class="num">${toEUR(r.investedCum)}</td>
        <td class="num ${clsTotal}">${r.resTotal == null ? '-' : toEUR(r.resTotal)}${fmtPct(r.resTotalPct)}</td>

        <td class="num swda-block">${toEUR(r.investedCumSWDA)}</td>
        <td class="num swda-block"><input class="cell swda" type="number" step="0.01" value="${r.swdaNow ?? ''}" /></td>
        <td class="num swda-block ${clsSWDA}">${r.resSWDA == null ? '-' : toEUR(r.resSWDA)}${fmtPct(r.resSWDAPct)}</td>

        <td class="num aggh-block">${toEUR(r.investedCumAGGH)}</td>
        <td class="num aggh-block"><input class="cell aggh" type="number" step="0.01" value="${r.agghNow ?? ''}" /></td>
        <td class="num aggh-block ${clsAGGH}">${r.resAGGH == null ? '-' : toEUR(r.resAGGH)}${fmtPct(r.resAGGHPct)}</td>

        <!-- Cenários (€) -->
        <td class="num">${toEUR(r.totalNow)}</td>   <!-- Atual = SWDA + AGGH + Juro -->
        <td class="num">${toEUR(r.pes)}</td>
        <td class="num">${toEUR(r.real)}</td>
        <td class="num">${toEUR(r.otim)}</td>

        <td class="num"><input class="cell cash" type="number" step="0.01" value="${r.cash_interest ?? ''}" /></td>
        <td><button class="btn-save" type="button">Editar/Gravar</button></td>
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
  const pes  = asNum($('#rate-pes')?.value)  ?? DEFAULTS.ratePes;
  const real = asNum($('#rate-real')?.value) ?? DEFAULTS.rateReal;
  const ot   = asNum($('#rate-otim')?.value) ?? DEFAULTS.rateOtim;
  const fix  = (n)=> Math.max(0, Math.min(100, n));
  const pctSumOk = Math.abs((pctS + pctA) - 100) < 0.01;
  return { endYM:{y:ey,m:em}, pctSWDA:fix(pctS), pctAGGH:fix(pctA),
           ratePes:pes, rateReal:real, rateOtim:ot, pctSumOk };
}

function writeParamsToUI(p){
  const ed = $('#end-date'); if (ed) ed.value = `${p.endYM.y}-${pad(p.endYM.m)}`;
  const sw = $('#pct-swda'); if (sw) sw.value = p.pctSWDA;
  const ag = $('#pct-aggh'); if (ag) ag.value = p.pctAGGH;
  const rp = $('#rate-pes'); if (rp) rp.value = p.ratePes;
  const rr = $('#rate-real'); if (rr) rr.value= p.rateReal;
  const ro = $('#rate-otim'); if (ro) ro.value= p.rateOtim;
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
    alert('As percentagens SWDA+AGGH devem somar 100%.');
    return;
  }
  state.params = p;
  await saveParams(p);   // persiste no Firebase
  await boot(true);      // refaz meses/tabela com novos parâmetros
});

// ---------- Estilos mínimos específicos ----------
const style = document.createElement('style');
style.textContent = `
.table-dca th{ white-space:pre-line; }
.table-dca .num{ text-align:center; }
.table-dca .pos{ color:#0a7f2e; font-weight:600; }
.table-dca .neg{ color:#b00020; font-weight:600; }
.table-dca input.cell{ width:9ch; text-align:center; }
.year-group{ margin-bottom: var(--spacing-lg); }
.btn-minor{ padding:.4rem .6rem; border-radius: var(--border-radius-sm); }
`;
document.head.appendChild(style);

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
}

boot();
