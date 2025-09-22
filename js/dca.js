<script type="module">
// js/dca.js
// Integração com Firebase conforme restante webapp
import { db } from '../js/script.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ---------- Helpers ----------
const $  = (s,ctx=document)=>ctx.querySelector(s);
const $$ = (s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
const pad = (n)=> String(n).padStart(2,'0');
const toEUR = (v)=> new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v||0);
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
  cashRate: 2.00   // % a.a.
};

// ---------- Firestore ----------
const COL = collection(db, 'dca'); // docs com id 'YYYY-MM'

async function ensureMonthsExist(endYM){
  const ids = monthsBetween(START_YM, endYM).map(({y,m})=> `${y}-${pad(m)}`);
  // Cria docs vazios se não existirem
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
  const { pctSWDA, pctAGGH, ratePes, rateReal, rateOtim, cashRate } = params;
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
    const totalNow = asNum(d.value_total) ?? (
      (swdaNow ?? 0) + (agghNow ?? 0)
    );

    // Resultados (€ e %)
    const resTotal = (totalNow!=null) ? (totalNow - investedCum) : null;
    const resTotalPct = (resTotal!=null && investedCum>0) ? (resTotal/investedCum*100) : null;

    const resSWDA = (swdaNow!=null) ? (swdaNow - investedCumSWDA) : null;
    const resSWDAPct = (resSWDA!=null && investedCumSWDA>0) ? (resSWDA/investedCumSWDA*100) : null;

    const resAGGH = (agghNow!=null) ? (agghNow - investedCumAGGH) : null;
    const resAGGHPct = (resAGGH!=null && investedCumAGGH>0) ? (resAGGH/investedCumAGGH*100) : null;

    // Cenários (acumulado até 2040+) – aplica TIR anual ao INVESTIDO acumulado
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
      cashRate, cash_interest: asNum(d.cash_interest)
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
  if (!wrap){ return; }

  const groups = yearGroups(rows);
  wrap.innerHTML = '';

  for (const [y, arr] of groups){
    const sec = document.createElement('section');
    sec.className = 'report-section';

    const h = document.createElement('h3');
    h.textContent = y;

    const btn = document.createElement('button');
    btn.textContent = 'Ocultar ano (manter Dez)';
    btn.className = 'btn-minor';

    const table = document.createElement('table');
    table.className = 'table-dca';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Mês</th>
          <th class="num">Investido</th>
          <th class="num">Valor\nTotal</th>
          <th class="num">Resultado\nTotal (€ / %)</th>
          <th class="num">Inv.\nSWDA</th>
          <th class="num">SWDA\nAtual</th>
          <th class="num">Res.\nSWDA (€ / %)</th>
          <th class="num">Inv.\nAGGH</th>
          <th class="num">AGGH\nAtual</th>
          <th class="num">Res.\nAGGH (€ / %)</th>
          <th class="num">Cen.\nPes.</th>
          <th class="num">Cen.\nReal.</th>
          <th class="num">Cen.\nOt.</th>
          <th class="num">Juro\nCash</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    for (let i=0;i<arr.length;i++){
      const r = arr[i];
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;

      // Classes de positivo/negativo
      const clsTotal = r.resTotal!=null ? (r.resTotal>=0?'pos':'neg') : '';
      const clsSWDA  = r.resSWDA !=null ? (r.resSWDA >=0?'pos':'neg')  : '';
      const clsAGGH  = r.resAGGH !=null ? (r.resAGGH >=0?'pos':'neg')  : '';

      tr.innerHTML = `
        <td>${pad(r.m)}/${String(r.y).slice(-2)}</td>
        <td class="num">${toEUR(r.investedCum)}</td>
        <td class="num"><input class="cell val-total" type="number" step="0.01" value="${r.totalNow??''}" /></td>
        <td class="num ${clsTotal}">${r.resTotal==null?'-':toEUR(r.resTotal)}${r.resTotalPct==null?'':` <small>(${r.resTotalPct.toFixed(2)}%)</small>`}</td>
        <td class="num">${toEUR(r.investedCumSWDA)}</td>
        <td class="num"><input class="cell swda" type="number" step="0.01" value="${r.swdaNow??''}" /></td>
        <td class="num ${clsSWDA}">${r.resSWDA==null?'-':toEUR(r.resSWDA)}${r.resSWDAPct==null?'':` <small>(${r.resSWDAPct.toFixed(2)}%)</small>`}</td>
        <td class="num">${toEUR(r.investedCumAGGH)}</td>
        <td class="num"><input class="cell aggh" type="number" step="0.01" value="${r.agghNow??''}" /></td>
        <td class="num ${clsAGGH}">${r.resAGGH==null?'-':toEUR(r.resAGGH)}${r.resAGGHPct==null?'':` <small>(${r.resAGGHPct.toFixed(2)}%)</small>`}</td>
        <td class="num">${toEUR(r.pes)}</td>
        <td class="num">${toEUR(r.real)}</td>
        <td class="num">${toEUR(r.otim)}</td>
        <td class="num"><input class="cell cash" type="number" step="0.01" value="${r.cash_interest??''}" /></td>
        <td><button class="btn-save" type="button">Editar/Gravar</button></td>
      `;

      tbody.appendChild(tr);
    }

    const groupWrap = document.createElement('div');
    groupWrap.className = 'year-group';
    groupWrap.appendChild(h);
    const tools = document.createElement('div');
    tools.className = 'form-actions';
    tools.appendChild(btn);

    groupWrap.appendChild(tools);
    groupWrap.appendChild(table);
    wrap.appendChild(groupWrap);

    // Botão colapsar por ano (mantém Dezembro)
    btn.addEventListener('click', () => toggleYear(table));
  }

  // Ações de guardar por linha
  wrap.addEventListener('click', async (ev)=>{
    const b = ev.target.closest('.btn-save');
    if (!b) return;
    const tr = b.closest('tr');
    const id = tr?.dataset?.id;
    if (!id) return;
    const total = asNum(tr.querySelector('.val-total')?.value);
    const swda  = asNum(tr.querySelector('.swda')?.value);
    const aggh  = asNum(tr.querySelector('.aggh')?.value);
    const cash  = asNum(tr.querySelector('.cash')?.value);

    await saveRow(id, {
      value_total: total,
      swda_value:  swda,
      aggh_value:  aggh,
      cash_interest: cash
    });

    // Após guardar, recarrega modelo para refletir cálculos
    await boot(true);
  });
}

function toggleYear(table){
  const rows = Array.from(table.tBodies[0].rows);
  // manter a última linha (assumimos dezembro)
  rows.slice(0,-1).forEach(r => r.classList.toggle('hidden'));
}

// ---------- Estado / Boot ----------
const state = {
  params: { ...DEFAULTS }
};

function readParamsFromUI(){
  const [ey, em] = ($('#end-date').value || `${DEFAULTS.endYM.y}-${pad(DEFAULTS.endYM.m)}`).split('-').map(Number);
  const pctS = asNum($('#pct-swda').value) ?? DEFAULTS.pctSWDA;
  const pctA = asNum($('#pct-aggh').value) ?? DEFAULTS.pctAGGH;
  const pes  = asNum($('#rate-pes').value)  ?? DEFAULTS.ratePes;
  const real = asNum($('#rate-real').value) ?? DEFAULTS.rateReal;
  const ot   = asNum($('#rate-otim').value) ?? DEFAULTS.rateOtim;
  const cash = asNum($('#cash-rate').value) ?? DEFAULTS.cashRate;
  const fix  = (n)=> Math.max(0, Math.min(100, n));
  const pctSumOk = Math.abs((pctS + pctA) - 100) < 0.01;
  return {
    endYM: { y: ey, m: em },
    pctSWDA: fix(pctS),
    pctAGGH: fix(pctA),
    ratePes: pes,
    rateReal: real,
    rateOtim: ot,
    cashRate: cash,
    pctSumOk
  };
}

function writeParamsToUI(p){
  $('#end-date').value = `${p.endYM.y}-${pad(p.endYM.m)}`;
  $('#pct-swda').value = p.pctSWDA;
  $('#pct-aggh').value = p.pctAGGH;
  $('#rate-pes').value = p.ratePes;
  $('#rate-real').value= p.rateReal;
  $('#rate-otim').value= p.rateOtim;
  $('#cash-rate').value= p.cashRate;
}

async function boot(skipParamUI){
  if (!skipParamUI){
    // Inicializa UI com defaults
    writeParamsToUI(state.params);
  }
  // Garante meses
  await ensureMonthsExist(state.params.endYM);
  // Carrega
  const docs = await loadAllDocs();
  // Filtra apenas até endYM
  const limId = `${state.params.endYM.y}-${pad(state.params.endYM.m)}`;
  const subset = docs.filter(d => d.id <= limId);
  const rows = buildModel(subset, state.params);
  renderTable(rows);
}

// ---------- Eventos UI ----------
$('#btn-aplicar')?.addEventListener('click', async ()=>{
  const p = readParamsFromUI();
  if (!p.pctSumOk){
    alert('As percentagens SWDA+AGGH devem somar 100%.');
    return;
  }
  state.params = p;
  await boot(true);
});

$('#btn-colapsar')?.addEventListener('click', ()=>{
  $$('#dca-table-wrap table').forEach(t => toggleYear(t));
});
$('#btn-expandir')?.addEventListener('click', ()=>{
  $$('#dca-table-wrap table').forEach(t => {
    // garantir todas as linhas visíveis exceto nenhuma
    Array.from(t.tBodies[0].rows).forEach(r => r.classList.remove('hidden'));
  });
});