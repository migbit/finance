(function(){
  // ---------- Util ----------
  const fmtEUR = new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
  const pct = v => (isFinite(v)?(v*100).toFixed(2)+'%':'');
  const euro = v => isFinite(v) ? fmtEUR.format(v) : '';

  const START_DEFAULT = '2025-09-01';
  const END_DEFAULT   = '2040-09-01';

  const state = {
    start: START_DEFAULT,
    end: END_DEFAULT,
    allocSWDA: 55,
    allocAGGH: 45,
    cashAPR: 2,
    rateBear: 0,
    rateBase: 4,
    rateBull: 7,
    rows: [] // { y,m,key, swdaVal?, agghVal?, totalVal?, cashAPR?, allocSWDA?, allocAGGH? }
  };

  // ---------- Persistência ----------
  const STORAGE_KEY = 'dca_v1';
  const FB_COLLECTION = 'dca_v1';
  const FB_DOCID = 'default';

  function haveFirebase(){
    try{ return !!(window.firebase && window.firebase.firestore); }
    catch(e){ return false; }
  }
  function fb(){ return window.firebase.firestore(); }

  async function savePersistent(){
    // Remover campos derivados antes de guardar
    const rows = state.rows.map(r => {
      const { _view, _computedAt, ...rest } = r;
      return rest;
    });
    const payload = { ...state, rows };
    try{
      if(haveFirebase()){
        await fb().collection(FB_COLLECTION).doc(FB_DOCID).set(payload,{merge:true});
        console.log('[DCA] Guardado em Firestore.');
      }else{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        console.log('[DCA] Guardado em localStorage.');
      }
    }catch(err){
      console.warn('Falha ao guardar, fallback localStorage.', err);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  }

  async function loadPersistent(){
    try{
      if(haveFirebase()){
        const snap = await fb().collection(FB_COLLECTION).doc(FB_DOCID).get();
        if(snap.exists){ Object.assign(state, snap.data()); console.log('[DCA] Carregado de Firestore.'); return; }
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ Object.assign(state, JSON.parse(raw)); console.log('[DCA] Carregado de localStorage.'); }
    }catch(err){ console.warn('Falha ao carregar', err); }
  }

  // ---------- Datas ----------
  const ymKey = (y,m)=>`${y}-${String(m+1).padStart(2,'0')}`; // m:0..11
  function* monthsBetween(startISO, endISO){
    const s = new Date(startISO), e = new Date(endISO);
    s.setDate(1); e.setDate(1);
    while(s <= e){ yield {y:s.getFullYear(), m:s.getMonth(), key:ymKey(s.getFullYear(), s.getMonth())}; s.setMonth(s.getMonth()+1); }
  }
  function ensureRows(){
    const map = new Map(state.rows.map(r=>[r.key,r]));
    const out = [];
    for(const {y,m,key} of monthsBetween(state.start, state.end)){ out.push(map.get(key) || {y,m,key}); }
    state.rows = out;
  }

  // ---------- Cálculo ----------
  function computeAll(){
    // Ler topo e corrigir limites
    let allocSWDAg = clamp(numVal('allocSWDA', state.allocSWDA), 0, 100);
    let allocAGGHg = clamp(numVal('allocAGGH', state.allocAGGH), 0, 100);
    const cashAPRg   = clamp(numVal('cashAPR',   state.cashAPR),   0, 50);
    const rateBear   = numVal('rateBear',  state.rateBear);
    const rateBase   = numVal('rateBase',  state.rateBase);
    const rateBull   = numVal('rateBull',  state.rateBull);

    // Normalizar se somar > 100
    const sumAlloc = allocSWDAg + allocAGGHg;
    if(sumAlloc > 100){
      const k = 100 / sumAlloc;
      allocSWDAg = +(allocSWDAg * k).toFixed(6);
      allocAGGHg = +(allocAGGHg * k).toFixed(6);
    }

    Object.assign(state, {allocSWDA:allocSWDAg, allocAGGH:allocAGGHg, cashAPR:cashAPRg, rateBear, rateBase, rateBull});
    ensureRows();

    let cumInvest=0, cumSWDA=0, cumAGGH=0, cash=0, cumInterest=0;

    state.rows.forEach((row, idx) => {
      // Overrides por linha
      let mAllocSWDA = finiteOr(row.allocSWDA, allocSWDAg);
      let mAllocAGGH = finiteOr(row.allocAGGH, allocAGGHg);
      let mCashAPR   = finiteOr(row.cashAPR,   cashAPRg);

      // Normalizar se >100
      const mSum = mAllocSWDA + mAllocAGGH;
      if(mSum > 100){
        const k = 100 / mSum;
        mAllocSWDA = +(mAllocSWDA * k).toFixed(6);
        mAllocAGGH = +(mAllocAGGH * k).toFixed(6);
      }

      const investThis = 100;
      cumInvest += investThis;

      let swdaIn = investThis * (mAllocSWDA/100);
      let agghIn = investThis * (mAllocAGGH/100);
      // Corrigir se passar por arredondamento
      if(swdaIn + agghIn > investThis){
        const k2 = investThis / (swdaIn + agghIn);
        swdaIn *= k2; agghIn *= k2;
      }
      const leftover = Math.max(0, investThis - swdaIn - agghIn);

      // Juros da caixa (mensal)
      const r_m = (mCashAPR/100)/12;
      const cashBefore = cash;
      cash = (cash + leftover) * (1 + r_m);
      const interestThis = cash - (cashBefore + leftover);
      cumInterest += interestThis;

      cumSWDA += swdaIn;
      cumAGGH += agghIn;

      const swdaVal = finiteOr(row.swdaVal, cumSWDA);
      const agghVal = finiteOr(row.agghVal, cumAGGH);

      const totalDefault = swdaVal + agghVal + cash;
      const totalVal = finiteOr(row.totalVal, totalDefault);

      const realSWDA = swdaVal - cumSWDA;
      const realAGGH = agghVal - cumAGGH;
      const realTot  = totalVal - cumInvest;

      const tMonths = idx + 1;
      const yearsElapsed = tMonths/12;
      const scen = (rate)=> cumInvest * Math.pow(1 + rate/100, yearsElapsed);

      row._view = {
        investCum:cumInvest,
        swdaInvestCum:cumSWDA,
        agghInvestCum:cumAGGH,
        cash, cumInterest,
        interestThis, // juro do mês
        swdaVal, agghVal, totalVal,
        realSWDA, realAGGH, realTot,
        realSWDAPct: realSWDA / Math.max(1, cumSWDA),
        realAGGHPct: realAGGH / Math.max(1, cumAGGH),
        realTotPct : realTot  / Math.max(1, cumInvest),
        scenBear:scen(rateBear), scenBase:scen(rateBase), scenBull:scen(rateBull),
        allocSWDA:mAllocSWDA, allocAGGH:mAllocAGGH, cashAPR:mCashAPR,
      };
    });
  }

  const finiteOr = (v,fallback)=> (isFinite(v)?Number(v):fallback);
  function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }
  function parseNumberish(raw){
    // Aceita "€ 1.234,56" ou "1,234.56" → dot decimal
    const s = String(raw||'').replace(/[^\d,\.\-]/g,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.')){
      const lastComma = s.lastIndexOf(',');
      const int = s.slice(0,lastComma).replace(/[^\d\-]/g,'');
      const dec = s.slice(lastComma+1).replace(/[^\d]/g,'');
      return Number(`${int}.${dec}`);
    }
    return Number(s.replace(',', '.'));
  }
  function numVal(id, fallback){
    const el=document.getElementById(id);
    const v=parseNumberish(el?.value);
    return isFinite(v)?v:fallback;
  }

  // ---------- Render ----------
  function render(){
    const yearsEl = document.getElementById('years');
    yearsEl.innerHTML = '';

    const byYear = new Map();
    for(const r of state.rows){ if(!byYear.has(r.y)) byYear.set(r.y, []); byYear.get(r.y).push(r); }

    const startYear = new Date(state.start).getFullYear();
    const endYear   = new Date(state.end).getFullYear();

    for(const y of Array.from(byYear.keys()).sort((a,b)=>a-b)){
      const rows = byYear.get(y);

      const group = el('section','year-group');
const defaultCollapsed = (y !== startYear && y !== endYear);
const btnText  = defaultCollapsed ? 'Mostrar' : 'Ocultar';
const btnClass = defaultCollapsed ? '' : 'btn-soft';

const head = el('div','year-head');
const lastRowView = rows[rows.length-1]._view;
head.innerHTML = `
  <h3>${y} <span class="pill">${rows.length} meses</span></h3>
  <div class="meta">Investido até ${y}: <strong>${euro(lastRowView.investCum)}</strong></div>
  <button class="year-toggle ${btnClass}" data-y="${y}">${btnText}</button>
`;
group.appendChild(head);


      const tbl = el('table','grid'); tbl.dataset.year = y;
      const thead = el('thead'); thead.innerHTML = `
        <tr>
          <th>Mês</th>
          <th>Investido (sempre +100€/mês)</th>
          <th>Valor Total <span class="muted">(editável)</span></th>
          <th>Realizado</th>
          <th>Investido SWDA</th>
          <th>SWDA <span class="muted">(edit.)</span></th>
          <th>Realizado SWDA</th>
          <th>AGGH <span class="muted">(edit.)</span></th>
          <th>Investido AGGH</th>
          <th>Realizado AGGH</th>
          <th>Cenário Pess.</th>
          <th>Cenário Real.</th>
          <th>Cenário Otim.</th>
          <th>Juro do mês</th>
          <th>Taxa Caixa (%) <span class="muted">(edit.)</span></th>
          <th>Aloc. SWDA (%) <span class="muted">(edit.)</span></th>
          <th>Aloc. AGGH (%) <span class="muted">(edit.)</span></th>
        </tr>`;
      tbl.appendChild(thead);

      const tbody = el('tbody');
      for(const r of rows){
        const v = r._view;
        const mm = new Date(r.y, r.m, 1).toLocaleDateString('pt-PT',{month:'short'});
        const tr = el('tr'); tr.dataset.key = r.key;

        tr.innerHTML = `
          <td>${mm}</td>
          ${tdNum(euro(v.investCum))}
          ${tdEdit('totalVal', isFinite(r.totalVal)? r.totalVal : '')}
          ${tdNum(`${euro(v.realTot)} (${pct(v.realTotPct)})`, posneg(v.realTot))}
          ${tdNum(euro(v.swdaInvestCum))}
          ${tdEdit('swdaVal', isFinite(r.swdaVal)? r.swdaVal : '')}
          ${tdNum(`${euro(v.realSWDA)} (${pct(v.realSWDAPct)})`, posneg(v.realSWDA))}
          ${tdEdit('agghVal', isFinite(r.agghVal)? r.agghVal : '')}
          ${tdNum(euro(v.agghInvestCum))}
          ${tdNum(`${euro(v.realAGGH)} (${pct(v.realAGGHPct)})`, posneg(v.realAGGH))}
          ${tdNum(euro(v.scenBear))}
          ${tdNum(euro(v.scenBase))}
          ${tdNum(euro(v.scenBull))}
          ${tdNum(euro(v.interestThis))}
          ${tdEdit('cashAPR', isFinite(r.cashAPR)? r.cashAPR : '')}
          ${tdEdit('allocSWDA', isFinite(r.allocSWDA)? r.allocSWDA : '')}
          ${tdEdit('allocAGGH', isFinite(r.allocAGGH)? r.allocAGGH : '')}
        `;
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);

      const foot = el('div','foot');
      const last = rows[rows.length-1]._view;
      foot.innerHTML = `
        <span class="muted">Caixa acumulada:</span> <strong>${euro(last.cash)}</strong>
        <span class="muted" style="margin-left:12px">Juro acumulado:</span> <strong>${euro(last.cumInterest)}</strong>
      `;

      group.appendChild(tbl);
      group.appendChild(foot);

      if (defaultCollapsed) {
        tbl.style.display = 'none';
        foot.style.display = 'none';
      }
      yearsEl.appendChild(group);
    }

// ligar edição inline às células data-edit
  yearsEl.querySelectorAll('[contenteditable][data-edit]').forEach(cell=>{
    cell.addEventListener('blur', onCellEdit);
    cell.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){ e.preventDefault(); cell.blur(); }
    });
  });

yearsEl.querySelectorAll('.year-toggle').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const y = btn.dataset.y;
    const tbl  = yearsEl.querySelector(`table.grid[data-year="${y}"]`);
    const foot = tbl.nextElementSibling;
    const willShow = tbl.style.display === 'none';

    tbl.style.display  = willShow ? '' : 'none';
    foot.style.display = willShow ? '' : 'none';

    // atualiza texto e classe
    if (willShow){
      btn.textContent = 'Ocultar';
      btn.classList.add('btn-soft');    // neutro quando aberto
    }else{
      btn.textContent = 'Mostrar';
      btn.classList.remove('btn-soft'); // verde quando fechado
    }
  });
});

  }

  // helpers de render
  const el = (tag, cls)=>{ const n=document.createElement(tag); if(cls) n.className=cls; return n; };
  const tdNum = (v, cls='')=> `<td class="num ${cls}">${v}</td>`;
  const tdEdit= (key, val, cls='')=> `<td class="num editable ${cls}" contenteditable="true" data-edit="${key}">${val??''}</td>`;
  const posneg = (v)=> (!isFinite(v)||Math.abs(v)<1e-8)? '' : (v>=0?'pos':'neg');

  function onCellEdit(e){
    const td = e.currentTarget;
    const field = td.dataset.edit;
    const tr = td.closest('tr');
    const key = tr?.dataset?.key;
    if(!key || !field) return;
    const row = state.rows.find(r=>r.key===key);
    if(!row) return;

    const raw = td.textContent;
    const val = parseNumberish(raw);

    if(field==='cashAPR' || field==='allocSWDA' || field==='allocAGGH'){
      if(isFinite(val)) row[field]=val; else delete row[field];
    }else{
      if(isFinite(val)) row[field]=val; else delete row[field];
    }

    computeAll(); render();
  }

  // ---------- UI topo ----------
  function wireTop(){
    const sd = document.getElementById('startDate');
    const ed = document.getElementById('endDate');
    sd.value = state.start; ed.value = state.end;

    sd.addEventListener('change', ()=>{ state.start = sd.value || START_DEFAULT; ensureRows(); computeAll(); render(); });
    ed.addEventListener('change', ()=>{ state.end   = ed.value || END_DEFAULT;  ensureRows(); computeAll(); render(); });

    ['allocSWDA','allocAGGH','cashAPR','rateBear','rateBase','rateBull'].forEach(id=>{
      const el = document.getElementById(id);
      if(el){
        el.value = state[id];
        el.addEventListener('change', ()=>{ computeAll(); render(); });
      }
    });

    document.getElementById('btnRecalc').addEventListener('click', ()=>{ computeAll(); render(); });
    document.getElementById('btnSave').addEventListener('click', async ()=>{
      await savePersistent();
      const b = document.getElementById('btnSave'); const old=b.textContent;
      b.textContent='Guardado ✓'; b.disabled=true; setTimeout(()=>{ b.textContent=old; b.disabled=false; }, 900);
    });
    document.getElementById('btnToggleYears').addEventListener('click', ()=>{
      document.querySelectorAll('.year-group table.grid').forEach(tbl=>{
        const show = tbl.style.display==='none';
        tbl.style.display = show?'':'none';
        const foot = tbl.nextElementSibling; foot.style.display = show?'':'none';
      });
    });
  }

  // ---------- Boot ----------
  (async function init(){
    await loadPersistent();

    if(!state.start) state.start = START_DEFAULT;
    if(!state.end)   state.end   = END_DEFAULT;

    const sy = new Date(state.start).getFullYear(); if(!sy || sy<2000) state.start = START_DEFAULT;
    const ey = new Date(state.end).getFullYear();   if(!ey || ey<2000) state.end = END_DEFAULT;

    wireTop();
    ensureRows();
    computeAll();
    render();
  })();
})();
