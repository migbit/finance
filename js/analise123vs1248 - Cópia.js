// analise123vs1248.js — Comparação lado a lado (123 vs 1248)
// Mantém o estilo e padrões de analise.js, mas separa os apartamentos em todas as visualizações.

import { db } from './script.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Paleta fixa pedida
const COLORS = {
  '123': 'rgba(54,162,235,1)',     // azul
  '1248': 'rgba(245,133,20,1)'     // laranja
};

// Dados manuais (iguais aos usados em analise.js, para completar meses de 2024)
const manualFaturasEstatica = [
  { ano: 2024, mes: 1, apartamento: '123', valorTransferencia: 1915.11, taxaAirbnb: 0 },
  { ano: 2024, mes: 1, apartamento: '1248', valorTransferencia: 3851, taxaAirbnb: 0 },
  { ano: 2024, mes: 2, apartamento: '123', valorTransferencia: 426, taxaAirbnb: 0 },
  { ano: 2024, mes: 2, apartamento: '1248', valorTransferencia: 1454, taxaAirbnb: 0 },
  { ano: 2024, mes: 3, apartamento: '123', valorTransferencia: 1310, taxaAirbnb: 0 },
  { ano: 2024, mes: 3, apartamento: '1248', valorTransferencia: 2678, taxaAirbnb: 0 },
  { ano: 2024, mes: 4, apartamento: '123', valorTransferencia: 4858.11, taxaAirbnb: 0 },
  { ano: 2024, mes: 4, apartamento: '1248', valorTransferencia: 6323, taxaAirbnb: 0 },
  { ano: 2024, mes: 5, apartamento: '123', valorTransferencia: 5680, taxaAirbnb: 0 },
  { ano: 2024, mes: 5, apartamento: '1248', valorTransferencia: 4806.61, taxaAirbnb: 0 },
  { ano: 2024, mes: 6, apartamento: '123', valorTransferencia: 4708.73, taxaAirbnb: 0 },
  { ano: 2024, mes: 6, apartamento: '1248', valorTransferencia: 6206, taxaAirbnb: 0 },
  { ano: 2024, mes: 7, apartamento: '123', valorTransferencia: 3659.04, taxaAirbnb: 0 },
  { ano: 2024, mes: 7, apartamento: '1248', valorTransferencia: 6015.30, taxaAirbnb: 0 },
  { ano: 2024, mes: 8, apartamento: '123', valorTransferencia: 5174, taxaAirbnb: 0 },
  { ano: 2024, mes: 8, apartamento: '1248', valorTransferencia: 7777, taxaAirbnb: 0 },
  { ano: 2024, mes: 9, apartamento: '123', valorTransferencia: 4599.41, taxaAirbnb: 0 },
  { ano: 2024, mes: 9, apartamento: '1248', valorTransferencia: 6780.52, taxaAirbnb: 0 },
];

// Estado dos gráficos
let gFatMensal, gMediaNoite, gOcupacao, gCheckins;

// Helpers
const mesesPT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isoToDate = (s) => new Date(`${s}T00:00:00`);
const diasNoMes = (y, m1_12) => new Date(y, m1_12, 0).getDate();
const euroInt = (v) => '€' + Math.round(Number(v)||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
  const all = await carregarFaturas();
  const Y = new Date().getFullYear();
  const lbl = document.getElementById('label-ano'); if (lbl) lbl.textContent = `(${Y})`;

  // Filtra 2024 (para base) e ano corrente
  const faturas = all.concat(manualFaturasEstatica)
    .filter(f => Number(f.ano) === 2024 || Number(f.ano) === Y);

  renderGraficoFaturacaoMensal(faturas, Y);
  renderTabelaFaturacaoMensal(faturas, 'tabela-fat-mensal');

//  renderGraficoMediaNoite(faturas, Y);
//  renderGraficoOcupacao(faturas);
//  renderGraficoCheckinsDOW(faturas);
});

async function carregarFaturas(){
  try{
    const q = query(collection(db, 'faturas'), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }catch(err){
    console.error('Erro ao carregar faturas:', err);
    return [];
  }
}

// ------------------------ Faturação Mensal (barras lado a lado) ------------------------
function sumMesApt(faturas, ano, mes1_12, apt){
  return faturas
    .filter(f => Number(f.ano)===ano && Number(f.mes)===mes1_12 && String(f.apartamento)===String(apt))
    .reduce((s,f) => s + (Number(f.valorTransferencia||0) + Number(f.taxaAirbnb||0)), 0);
}

function renderGraficoFaturacaoMensal(faturas, ano){
  const labels = mesesPT;
  const data123  = labels.map((_,i)=> sumMesApt(faturas, ano, i+1, '123'));
  const data1248 = labels.map((_,i)=> sumMesApt(faturas, ano, i+1, '1248'));

  const ctx = document.getElementById('chart-fat-mensal');
  if(!ctx) return;
  if(gFatMensal){ gFatMensal.destroy(); gFatMensal = null; }

  gFatMensal = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '123',  data: data123,  backgroundColor: COLORS['123'] },
        { label: '1248', data: data1248, backgroundColor: COLORS['1248'] },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${euroInt(c.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display:false } },
        y: { beginAtZero:true, ticks:{ precision:0 }, grid:{ color:'rgba(0,0,0,0.06)' }, border:{ display:false } }
      }
    }
  });
}

// --------------------------------------------------------------------->faturação mensal

function renderTabelaFaturacaoMensal(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2024;
  const CURR_YEAR = new Date().getFullYear();
  const anos = [];
  for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const APTS = ['123','1248'];

  // estruturas: totals[ano][apt][mes], nights[ano][apt][mes]
  const totals = {};
  const nights = {};
  anos.forEach(a => {
    totals[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
    nights[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
  });

  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (!APTS.includes(apt)) return;

    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;

    const v = Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
    const n = Number(f.noites || 0);

    totals[ano][apt][mes - 1] += v;
    nights[ano][apt][mes - 1] += Number.isFinite(n) ? n : 0;
  });

  // mostra “Média” por apt/ano se houver pelo menos um mês com noites > 0
  const mostraMedia = {};
  anos.forEach(a => {
    mostraMedia[a] = {
      '123': nights[a]['123'].some(x => x > 0),
      '1248': nights[a]['1248'].some(x => x > 0),
    };
  });

  const yearBg = ['#fbfbff', '#f9fffb', '#fffaf5', '#f8f9ff', '#f9f7ff'];
  const euroInt = (v) => '€' + Math.round(Number(v)||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Cabeçalho
  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${anos.map(a => {
            // Por ano, somar colunas necessárias: cada apt traz 1 (Total) ou 2 (Média+Total)
            const cols123  = mostraMedia[a]['123']  ? 2 : 1;
            const cols1248 = mostraMedia[a]['1248'] ? 2 : 1;
            const span = cols123 + cols1248;
            return `<th colspan="${span}" style="text-align:center">${a}</th>`;
          }).join('')}
        </tr>
        <tr>
          ${anos.map((a) => {
            const parts = [];
            // 123
            parts.push(mostraMedia[a]['123']
              ? `<th style="text-align:center" class="apt-123">123 Média</th><th style="text-align:center" class="apt-123">123 Total</th>`
              : `<th style="text-align:center" class="apt-123">123 Total</th>`
            );
            // 1248
            parts.push(mostraMedia[a]['1248']
              ? `<th style="text-align:center" class="apt-1248">1248 Média</th><th style="text-align:center" class="apt-1248">1248 Total</th>`
              : `<th style="text-align:center" class="apt-1248">1248 Total</th>`
            );
            return parts.join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // Linhas por mês
  meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
      const bg = yearBg[idx % yearBg.length];

      // 123
      const tot123 = totals[a]['123'][i];
      const nts123 = nights[a]['123'][i];
      const med123 = (nts123 > 0) ? Math.round(tot123 / nts123) : null;
      if (mostraMedia[a]['123']) {
        html += `<td style="background:${bg}; text-align:center">${med123 != null ? `€${med123}` : '—'}</td>`;
        html += `<td style="background:${bg}; text-align:center">${euroInt(tot123)}</td>`;
      } else {
        html += `<td style="background:${bg}; text-align:center">${euroInt(tot123)}</td>`;
      }

      // 1248
      const tot1248 = totals[a]['1248'][i];
      const nts1248 = nights[a]['1248'][i];
      const med1248 = (nts1248 > 0) ? Math.round(tot1248 / nts1248) : null;
      if (mostraMedia[a]['1248']) {
        html += `<td style="background:${bg}; text-align:center">${med1248 != null ? `€${med1248}` : '—'}</td>`;
        html += `<td style="background:${bg}; text-align:center">${euroInt(tot1248)}</td>`;
      } else {
        html += `<td style="background:${bg}; text-align:center">${euroInt(tot1248)}</td>`;
      }
    });
    html += `</tr>`;
  });

  // Linha final: preço médio anual + total anual por apt/ano
  html += `<tr><td><strong>Total</strong></td>`;
  anos.forEach((a, idx) => {
    const bg = yearBg[idx % yearBg.length];

    // 123
    const totalAno123 = totals[a]['123'].reduce((s, v) => s + v, 0);
    const mediasMes123 = totals[a]['123']
      .map((t, k) => (nights[a]['123'][k] > 0 ? t / nights[a]['123'][k] : null))
      .filter(v => v != null);
    const precoMedioAno123 = mediasMes123.length
      ? Math.round(mediasMes123.reduce((s, v) => s + v, 0) / mediasMes123.length)
      : null;
    if (mostraMedia[a]['123']) {
      html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno123 != null ? `€${precoMedioAno123}` : '—'}</strong></td>`;
      html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno123)}</strong></td>`;
    } else {
      html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno123)}</strong></td>`;
    }

    // 1248
    const totalAno1248 = totals[a]['1248'].reduce((s, v) => s + v, 0);
    const mediasMes1248 = totals[a]['1248']
      .map((t, k) => (nights[a]['1248'][k] > 0 ? t / nights[a]['1248'][k] : null))
      .filter(v => v != null);
    const precoMedioAno1248 = mediasMes1248.length
      ? Math.round(mediasMes1248.reduce((s, v) => s + v, 0) / mediasMes1248.length)
      : null;
    if (mostraMedia[a]['1248']) {
      html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno1248 != null ? `€${precoMedioAno1248}` : '—'}</strong></td>`;
      html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno1248)}</strong></td>`;
    } else {
      html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno1248)}</strong></td>`;
    }
  });
  html += `</tr>`;

  html += `</tbody></table><hr class="divider">`;
  el.innerHTML = html;
}

// ------------------------ Valor médio/noite (linhas: 123 vs 1248) ----------------------
function renderGraficoMediaNoite(faturas, ano){
  // média mensal = (receita do mês do apt) / (noites do mês do apt)
  const receita = (apt, mes1_12) => faturas
    .filter(f => String(f.apartamento)===apt && Number(f.ano)===ano && Number(f.mes)===mes1_12)
    .reduce((s,f)=> s + (Number(f.valorTransferencia||0) + Number(f.taxaAirbnb||0)), 0);

  const noites = (apt, mes1_12) => faturas
    .filter(f => String(f.apartamento)===apt && Number(f.ano)===ano && Number(f.mes)===mes1_12)
    .reduce((s,f)=> s + (Number(f.noites||0)), 0);

  const medApt = (apt) => mesesPT.map((_,i)=>{
    const tot = receita(apt, i+1); const n = noites(apt, i+1);
    return n>0 ? Math.round(tot/n) : null;
  });

  const data123  = medApt('123');
  const data1248 = medApt('1248');

  const ctx = document.getElementById('chart-media-noite');
  if(!ctx) return;
  if(gMediaNoite){ gMediaNoite.destroy(); gMediaNoite = null; }

  gMediaNoite = new Chart(ctx, {
    type: 'line',
    data: {
      labels: mesesPT,
      datasets: [
        { label: '123',  data: data123,  borderColor: COLORS['123'],  backgroundColor: 'rgba(54,162,235,0.12)', tension:.25, spanGaps:true, pointRadius:2 },
        { label: '1248', data: data1248, borderColor: COLORS['1248'], backgroundColor: 'rgba(245,133,20,0.12)', tension:.25, spanGaps:true, pointRadius:2 },
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins: {
        legend: { position:'bottom' },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: € ${c.parsed.y||0}` } }
      },
      scales:{
        x:{ grid:{ display:false } },
        y:{ beginAtZero:false, ticks:{ precision:0, stepSize:10 }, grid:{ color:'rgba(0,0,0,0.06)' }, border:{ display:false } }
      }
    }
  });
}

// ------------------------ Ocupação (%) (linhas: 123 vs 1248) ---------------------------
function renderGraficoOcupacao(faturas){
  const Y = new Date().getFullYear();
  const hoje = new Date();
  const clampCO = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()+1);
    return d>tomorrow ? tomorrow : d;
  };

  // acumula noites ocupadas por mês e apt para o ano atual
  const noitesMap = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };

  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if(apt!=='123' && apt!=='1248') return;
    if(!isISO(f.checkIn)) return;

    const ci = isoToDate(f.checkIn);
    if(ci.getFullYear()!==Y) return; // ano do check-in

    const n  = Number(f.noites||0);
    if(!Number.isFinite(n) || n<=0) return;

    let co = isISO(f.checkOut) ? isoToDate(f.checkOut) : new Date(ci.getFullYear(), ci.getMonth(), ci.getDate()+n);
    co = clampCO(co);

    for(let d=new Date(ci); d<co; d.setDate(d.getDate()+1)){
      if(d.getFullYear()!==Y) continue;
      const m = d.getMonth();
      noitesMap[apt][m] += 1;
    }
  });

  const diasDen = (m) => diasNoMes(Y, m+1);
  const pct = (apt) => noitesMap[apt].map((noites, m) => {
    const den = diasDen(m);
    return den ? Math.round((noites/den)*100) : 0;
  });

  const ctx = document.getElementById('chart-ocupacao');
  if(!ctx) return;
  if(gOcupacao){ gOcupacao.destroy(); gOcupacao = null; }

  gOcupacao = new Chart(ctx, {
    type: 'line',
    data: {
      labels: mesesPT,
      datasets: [
        { label:'123',  data: pct('123'),  borderColor: COLORS['123'],  backgroundColor:'rgba(54,162,235,0.12)',  tension:.25, pointRadius:2 },
        { label:'1248', data: pct('1248'), borderColor: COLORS['1248'], backgroundColor:'rgba(245,133,20,0.12)', tension:.25, pointRadius:2 }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom' } },
      scales:{
        x:{ grid:{ display:false } },
        y:{ beginAtZero:true, max:100, ticks:{ precision:0 }, grid:{ color:'rgba(0,0,0,0.06)' }, border:{ display:false } }
      }
    }
  });
}

// ------------------------ Check-ins por dia da semana (barras) -------------------------
function renderGraficoCheckinsDOW(faturas){
  const Y = new Date().getFullYear();
  const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const toSegIdx = (dow0Sun) => (dow0Sun + 6) % 7; // 0=Seg .. 6=Dom

  const cont = { '123': Array(7).fill(0), '1248': Array(7).fill(0) };

  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if(apt!=='123' && apt!=='1248') return;
    if(!isISO(f.checkIn)) return;
    const d = isoToDate(f.checkIn);
    if(d.getFullYear()!==Y) return;
    const idx = toSegIdx(d.getDay());
    cont[apt][idx] += 1;
  });

  const ctx = document.getElementById('chart-checkins-dow');
  if(!ctx) return;
  if(gCheckins){ gCheckins.destroy(); gCheckins = null; }

  gCheckins = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'123',  data: cont['123'],  backgroundColor: COLORS['123'] },
        { label:'1248', data: cont['1248'], backgroundColor: COLORS['1248'] }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom' } },
      scales:{
        x:{ grid:{ display:false } },
        y:{ beginAtZero:true, ticks:{ precision:0 }, grid:{ color:'rgba(0,0,0,0.06)' }, border:{ display:false } }
      }
    }
  });
}
