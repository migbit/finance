// Importar as funções necessárias do Firebase
import { db } from './script.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Dados manuais de faturação (substitua X e Y pelos valores reais que me fornecer)
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

let chartTotal = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  carregarTodosRelatorios();
});

async function carregarTodosRelatorios() {
  const firebaseFaturas = await carregarFaturas();
  const currentYear = new Date().getFullYear();
  const faturas = firebaseFaturas
  .concat(manualFaturasEstatica)
  .filter(f => Number(f.ano) === 2024 || Number(f.ano) === currentYear);

  gerarAnaliseFaturacao(faturas);
  gerarHeatmapVariacao1231248(faturas);
  renderTabelaComparativaAnos1231248(faturas, 'tabela-comparativa-anos-1231248');
  renderGraficoValorMedioReservasAno1231248(faturas);
  renderGraficoOcupacaoMensal1231248(faturas);
  renderTabelaLimpeza1231248(faturas, 'tabela-limpeza-1231248');
  renderTabelaNoites1231248(faturas, 'tabela-noites-1231248');
  renderTabelaHospedes1231248(faturas, 'tabela-hospedes-1231248');
  renderCheckinsPorDiaSemana1231248(faturas);
}

async function carregarFaturas() {
    try {
        const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar faturas:", error);
        return [];
    }
}

function obterNomeMes(numeroMes) {
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const n = Math.max(1, Math.min(12, Number(numeroMes)));
  return nomes[n - 1];
}

function formatEuro(num) {
  return '€' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function gerarAnaliseFaturacao(faturas) {

    // destruir gráficos antigos antes de recriar
  if (chartTotal) {
    chartTotal.destroy();
    chartTotal = null;
  }

    // 1) Prepara dados: meses 1-12, anos disponíveis (até ano atual)
    const currentYear = new Date().getFullYear();
    const anos = Array.from(new Set([2024, currentYear])).sort((a,b)=>a-b);
    const ultimoAno = anos[anos.length - 1];
    const temAnterior = anos.length > 1;
    const penultimoAno = temAnterior ? anos[0] : 2024; // nunca 2023

  
    // função auxiliar para somar valores por (ano, mes, apt)
    function somaPor(ano, mes, apt) {
      return faturas
        .filter(f => Number(f.ano) === Number(ano) &&
                      Number(f.mes) === Number(mes) &&
                      String(f.apartamento) === String(apt))
        .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);
    }
  
    // 2) construir arrays mensais
    const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const data123   = labels.map((_, i) => somaPor(ultimoAno, i+1, '123'));
    const data1248  = labels.map((_, i) => somaPor(ultimoAno, i+1, '1248'));
    const dataTotal = labels.map((_, i) => data123[i] + data1248[i]);
    // ── Novo: calculamos também o ano anterior ──
    const data123Prev  = labels.map((_, i) => somaPor(penultimoAno, i+1, '123'));
    const data1248Prev = labels.map((_, i) => somaPor(penultimoAno, i+1, '1248'));
    const dataTotalPrev = labels.map((_, i) => data123Prev[i] + data1248Prev[i]);

   // comparativo Apt 123 e 1248: ano anterior (transparente) vs ano atual (sólido)
 const datasetsBar = [];
if (temAnterior) {
  datasetsBar.push(
    { label: `${anos[0]}`,  data: data123Prev,  backgroundColor: 'rgba(54,162,235,0.4)' },
  );
}
datasetsBar.push(
  { label: `${ultimoAno}`,  data: data123,  backgroundColor: 'rgba(54,162,235,1)' },
);

const datasetsLine = [];

if (temAnterior) {
  datasetsLine.push({
    label: `${anos[0]}`,           // ano anterior
    data: dataTotalPrev,           // total 123+1248 (ano anterior)
    borderDash: [4, 4],
    borderWidth: 1.5,
    borderColor: 'rgba(90,90,90,1)',      // 👈 cinza mais escuro
    backgroundColor: 'rgba(90,90,90,0.1)',
    tension: 0.25
  });
}

datasetsLine.push({
  label: `${ultimoAno}`,           // ano atual
  data: dataTotal,                 // total 123+1248 (ano atual)
  borderColor: 'rgb(20, 78, 3)',          // 👈 verde escuro combinado
  backgroundColor: 'rgba(20, 78, 3, 0.15)',
  borderWidth: 2,
  tension: 0.25,
  pointRadius: 2,
  pointHoverRadius: 4
});



chartTotal = new Chart(document.getElementById('chart-total'), {
  type: 'line',
  data: { labels, datasets: datasetsLine },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          stepSize: 100   
        },
        suggestedMax: 15000 // ou usa grace: '12%' se preferires automático
      }
    }
  }
});
  
 // ----------------------------------------------------------------------------> BARRAS DE PROGRESSO

 // --- helpers ---
const APTS = ['123', '1248'];

// soma por ano para vários apartamentos (valorTransferencia + taxaAirbnb)
const somaAnoApts = (ano, apts = APTS) => faturas
  .filter(f => Number(f.ano) === Number(ano) && apts.includes(String(f.apartamento)))
  .reduce((s, f) => s + (Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0)), 0);

let htmlProg = '';

// ─── 1) Parcial do mês atual (123 + 1248) ───
{
  const mesAtual = new Date().getMonth() + 1;
  const nomeMesAtual = obterNomeMes(mesAtual);

  const temDados = faturas.some(f =>
    Number(f.ano) === ultimoAno &&
    Number(f.mes) === mesAtual &&
    APTS.includes(String(f.apartamento))
  );

  if (temDados) {
    const cur = faturas
      .filter(f =>
        Number(f.ano) === ultimoAno &&
        Number(f.mes) === mesAtual &&
        APTS.includes(String(f.apartamento))
      )
      .reduce((s, f) => s + (Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0)), 0);

    const ant = faturas
      .filter(f =>
        Number(f.ano) === penultimoAno &&
        Number(f.mes) === mesAtual &&
        APTS.includes(String(f.apartamento))
      )
      .reduce((s, f) => s + (Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0)), 0);

    const base  = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
    const diff  = ant - cur;
    const pct   = Math.round(Math.abs(diff) / base * 100);
    const lbl   = diff > 0 ? `-${pct}%` : `+${pct}%`;
    const cor   = diff > 0 ? '#dc3545' : '#28a745';
    const texto = diff > 0 ? `Faltam ${formatEuro(diff)}` : `Excedeu ${formatEuro(-diff)}`;


    htmlProg += `
      <div class="comparacao-item">
        <strong>Parcial ${nomeMesAtual}:</strong>
        <span style="color:${cor}; margin-left:0.5rem;">${texto}</span>
        <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
          <div class="progress-bar"
              style="width:${pct}%; background:${cor}; display:flex; align-items:center; justify-content:center;">
            ${lbl}
          </div>
        </div>
      </div>`;
  }
}

// ─── 2) Até mês anterior (123 + 1248) ───
{
  const currentMonth = new Date().getMonth() + 1;
  const prevMonth    = Math.max(1, currentMonth - 1);
  const nomeMes      = obterNomeMes(prevMonth);

  const cur = faturas
    .filter(f =>
      Number(f.ano) === ultimoAno &&
      APTS.includes(String(f.apartamento)) &&
      Number(f.mes) < currentMonth
    )
    .reduce((s, f) => s + (Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0)), 0);

  const ant = faturas
    .filter(f =>
      Number(f.ano) === penultimoAno &&
      APTS.includes(String(f.apartamento)) &&
      Number(f.mes) < currentMonth
    )
    .reduce((s, f) => s + (Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0)), 0);

  const base  = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
  const diff  = ant - cur;
  const pct   = Math.min(100, Math.round(Math.abs(diff) / base * 100));
  const lbl   = diff > 0 ? `-${pct}%` : `+${pct}%`;
  const cor   = diff > 0 ? '#dc3545' : '#28a745';
  const texto = diff > 0 ? `Faltam ${formatEuro(diff)}` : `Excedeu ${formatEuro(-diff)}`;

  htmlProg += `
    <div class="comparacao-item">
      <strong>Até ${nomeMes}:</strong>
      <span style="color:${cor}; margin-left:0.5rem;">${texto}</span>
      <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
        <div class="progress-bar"
            style="width:${pct}%; background:${cor}; display:flex; align-items:center; justify-content:center;">
          ${lbl}
        </div>
      </div>
    </div>`;
}

// ─── 3) ${ultimoAno} vs ${penultimoAno} (123 + 1248) ───
{
  const atual = somaAnoApts(ultimoAno, APTS);
  const antes = somaAnoApts(penultimoAno, APTS);

  const diff     = antes - atual;
  const pct      = Math.round(Math.abs(diff) / (antes || 1) * 100);
  const labelPct = diff > 0 ? `-${pct}%` : `+${pct}%`;
  const cor      = diff > 0 ? '#dc3545' : '#28a745';
  const label = diff > 0 ? `Faltam ${formatEuro(diff)}` : `Excedeu ${formatEuro(-diff)}`;


  htmlProg += `
    <div class="comparacao-item">
      <strong>${ultimoAno} vs ${penultimoAno}:</strong>
      <span style="color:${cor}; margin-left:0.5rem;">${label}</span>
      <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
        <div class="progress-bar"
            style="width:${pct}%; background:${cor}; display:flex; align-items:center; justify-content:center;">
          ${labelPct}
        </div>
      </div>
    </div>`;
}

// envolve as barras num wrapper que dá espaçamento vertical
document.getElementById('progresso-anos').innerHTML =
  `<div class="progress-list">${htmlProg}</div>`;
}

// --------------------------------------------------------------> HeatMap
function gerarHeatmapVariacao1231248(faturas) {
  // --- 0) helpers visuais (mesma escala que já usámos)
  function pctToColor(p) {
    if (p === null) return '#f5f5f5';
    const NEG_MIN = -1.0, POS_MAX = 1.0; // -100% .. +100%
    const lerp = (a,b,t)=>a+(b-a)*t, hex=(r,g,b)=>`#${[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('')}`;
    const deepRed=[139,0,0], mid=[236,236,236], green=[40,167,69];
    let c, v = Number(p);
    if (v <= 0){
      const k = Math.pow((Math.max(NEG_MIN,Math.min(0,v)) - NEG_MIN)/(0-NEG_MIN), 0.65);
      c = [lerp(deepRed[0],mid[0],k), lerp(deepRed[1],mid[1],k), lerp(deepRed[2],mid[2],k)];
    } else {
      const k = Math.pow(Math.max(0,Math.min(POS_MAX,v))/POS_MAX, 0.9);
      c = [lerp(mid[0],green[0],k), lerp(mid[1],green[1],k), lerp(mid[2],green[2],k)];
    }
    return hex(c[0],c[1],c[2]);
  }
  function idealTextOn(bgHex){
    const r=parseInt(bgHex.slice(1,3),16), g=parseInt(bgHex.slice(3,5),16), b=parseInt(bgHex.slice(5,7),16);
    const L=0.299*r+0.587*g+0.114*b;
    return L<160?'#fff':'#111';
  }

  // --- 1) agregação 123+1248 por ano/mês
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const isApt = a => a==='123' || a==='1248';
  const totais = {};
  faturas.forEach(f=>{
    if(!isApt(String(f.apartamento))) return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if(!ano || !mes || mes<1 || mes>12) return;
    const v = Number(f.valorTransferencia||0) + Number(f.taxaAirbnb||0);
    if(!totais[ano]) totais[ano] = {};
    totais[ano][mes] = (totais[ano][mes] || 0) + v;
  });

  // --- 2) anos com base (mostramos Y se existe Y-1)
  const anosAll = Object.keys(totais).map(Number).sort((a,b)=>a-b);
  const anos = anosAll.filter(a => totais[a-1]);
  const wrap = document.getElementById('heatmap-variacao-1231248');
  if(!wrap) return;

  if(anos.length===0){
    wrap.innerHTML = `<div class="heatmap-wrap"><div class="heatmap-muted">Sem base do ano anterior para calcular variação.</div></div>`;
    return;
  }

  // --- 3) construir tabela (sem legenda)
  let html = `
    <div class="heatmap-wrap">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th>Mês \\ Ano</th>
            ${anos.map(a=>`<th>${a}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (let m=1; m<=12; m++){
    html += `<tr><th>${meses[m-1]}</th>`;
    anos.forEach(a=>{
      const prev = totais[a-1]?.[m] ?? null;
      const cur  = totais[a]?.[m] ?? null;
      let pct = null;
      if (prev === null) pct = null;
      else if (prev === 0 && cur === 0) pct = 0;
      else if (prev === 0 && cur !== 0) pct = null; // sem base
      else pct = (cur - prev) / prev;

      if (pct === null){
        html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
      } else {
        const bg = pctToColor(pct);
        const fg = idealTextOn(bg);
        const label = `${(pct*100).toFixed(0)}%`;
        html += `<td class="heatmap-cell" style="background:${bg};color:${fg};font-weight:600">${label}</td>`;
      }
    });
    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  wrap.innerHTML = html;
}


//  ---------------------------------------------------------------------> Tabela Faturação Mensal
  
function renderTabelaComparativaAnos1231248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2024;
  const CURR_YEAR = new Date().getFullYear();
  const anos = [];
  for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // somatórios combinados 123 + 1248
  const totals = {};
  const nights = {};
  anos.forEach(a => {
    totals[a] = Array.from({ length: 12 }, () => 0);
    nights[a] = Array.from({ length: 12 }, () => 0);
  });

  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (apt !== '123' && apt !== '1248') return;

    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;

    const v = Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
    const n = Number(f.noites || 0);

    totals[ano][mes - 1] += v;
    nights[ano][mes - 1] += Number.isFinite(n) ? n : 0;
  });

  // mostra “Média” se houver pelo menos um mês com noites > 0
  const mostraMedia = {};
  anos.forEach(a => { mostraMedia[a] = nights[a].some(x => x > 0); });

  const yearBg = ['#fbfbff', '#f9fffb', '#fffaf5', '#f8f9ff', '#f9f7ff'];

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${anos.map(a => `<th colspan="${mostraMedia[a] ? 2 : 1}" style="text-align:center">${a}</th>`).join('')}
        </tr>
        <tr>
          ${anos.map(a => mostraMedia[a]
            ? `<th style="text-align:center">Média</th><th style="text-align:center">Total</th>`
            : `<th style="text-align:center">Total</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // linhas por mês
  meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
      const tot = totals[a][i];
      const nts = nights[a][i];
      const media = (nts > 0) ? Math.round(tot / nts) : null;
      const bg = yearBg[idx % yearBg.length];

      if (mostraMedia[a]) {
        html += `<td style="background:${bg}; text-align:center">${media != null ? `€${media}` : '—'}</td>`;
        html += `<td style="background:${bg}; text-align:center">€${Math.round(tot)}</td>`;
      } else {
        html += `<td style="background:${bg}; text-align:center">€${Math.round(tot)}</td>`;
      }
    });
    html += `</tr>`;
  });

  // linha final única (Total e Preço médio/noite anual)
  html += `<tr><td><strong>Total</strong></td>`;
  anos.forEach((a, idx) => {
    const totalAno = totals[a].reduce((s, v) => s + v, 0);
    const mediasMes = totals[a]
      .map((t, k) => (nights[a][k] > 0 ? t / nights[a][k] : null))
      .filter(v => v != null);
    const precoMedioAno = mediasMes.length
      ? Math.round(mediasMes.reduce((s, v) => s + v, 0) / mediasMes.length)
      : null;

    const bg = yearBg[idx % yearBg.length];
    if (mostraMedia[a]) {
      html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno != null ? `€${precoMedioAno}` : '—'}</strong></td>`;
      html += `<td style="background:${bg}; text-align:center"><strong>€${Math.round(totalAno)}</strong></td>`;
    } else {
      html += `<td style="background:${bg}; text-align:center"><strong>€${Math.round(totalAno)}</strong></td>`;
    }
  });
  html += `</tr>`;

  html += `</tbody></table><hr class="divider">`;
  el.innerHTML = html;
}


// ---------------------------------------------------------------> Gráfico valor noite

let chartVmReservas1231248 = null;

function renderGraficoValorMedioReservasAno1231248(faturas) {
  const Y = new Date().getFullYear();
  const todayISO = new Date().toISOString().slice(0,10); // 'YYYY-MM-DD'

  // filtra reservas do ano atual, dos apts 123 ou 1248, com noites > 0 e sem futuro
  const regs = faturas
    .filter(f => {
      const apt = String(f.apartamento);
      if (apt !== '123' && apt !== '1248') return false;
      if (typeof f.checkIn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) return false;

      const anoIn  = Number(f.checkIn.slice(0,4));
      const noites = Number(f.noites || 0);

      if (noites <= 0) return false;
      if (f.checkIn > todayISO) return false; // exclui futuro
      return anoIn === Y;                      // conta pelo ano do check-in
    })
    .sort((a,b) => a.checkIn.localeCompare(b.checkIn));

  if (!regs.length) {
    if (chartVmReservas1231248) { chartVmReservas1231248.destroy(); chartVmReservas1231248 = null; }
    return;
  }

  const labels = regs.map(r => r.checkIn);
  const data   = regs.map(r => {
    const total = Number(r.valorTransferencia || 0) + Number(r.taxaAirbnb || 0);
    return Math.round(total / Number(r.noites));
  });

  const ctx = document.getElementById('chart-vm-reservas-1231248');
  if (!ctx) return;
  if (chartVmReservas1231248) { chartVmReservas1231248.destroy(); chartVmReservas1231248 = null; }

  chartVmReservas1231248 = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `€ por noite (${Y})`,
        data,
        borderColor: 'rgb(20, 78, 3)',          // cor combinada 123+1248
        backgroundColor: 'rgba(20, 78, 3, 0.15)',
        borderWidth: 1.25,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 4,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: (items) => {
              const s = items?.[0]?.label ?? '';
              const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
              const d = new Date(`${s}T00:00:00`);
              return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]}`;
            },
            label: (ctx) => ` € ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: true }, // linha só em baixo
          ticks: {
            autoSkip: false,
            callback: (val, idx) => {
              // mostra o nome do mês quando mudamos de mês
              const s = labels[idx];
              const m = Number(s.slice(5,7));
              const prev = labels[idx-1];
              const pm = idx > 0 ? Number(prev?.slice(5,7)) : null;
              if (idx === 0 || m !== pm) {
                return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1];
              }
              return '';
            }
          }
        },
        y: {
          beginAtZero: false,
          min: 100,                       // começa nos 100 €
          ticks: { precision: 0, stepSize: 10 },
          grace: '10%',
          border: { display: false },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}


// ---------------------------------------------------------------> Taxa ocupação

let chartOcupacao1231248 = null;

function renderGraficoOcupacaoMensal1231248(faturas) {
  const BASE_YEAR = 2025;
  const hoje = new Date();
  const NUM_APTS = 2; // 123 + 1248

  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const diasNoMes = (y, m1_12) => new Date(y, m1_12, 0).getDate(); // m1_12 = 1..12
  const isoToDate = s => new Date(`${s}T00:00:00`);
  const clampCheckoutToToday = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    return d > tomorrow ? tomorrow : d;
  };

  // Anos presentes (desde 2025) em reservas de 123 ou 1248 (usamos ano do check-in)
  const anos = Array.from(new Set(
    faturas
      .filter(f => (f.apartamento=='123' || f.apartamento=='1248') &&
                   typeof f.checkIn === 'string' &&
                   /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
      .map(f => Number(f.checkIn.slice(0,4)))
  )).filter(y => y >= BASE_YEAR).sort((a,b)=>a-b);

  if (!anos.length) return;

  // Noites ocupadas por ano/mês (combina 123 + 1248)
  const ocup = {};
  anos.forEach(y => ocup[y] = Array.from({length:12}, ()=>0));

  faturas.forEach(f => {
    const aptStr = String(f.apartamento);
    if (aptStr !== '123' && aptStr !== '1248') return;

    const ciStr = f.checkIn, coStr = f.checkOut;
    if (typeof ciStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ciStr)) return;

    const noites = Number(f.noites || 0);
    if (!Number.isFinite(noites) || noites <= 0) return;

    const ci = isoToDate(ciStr);
    let co = (typeof coStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(coStr))
      ? isoToDate(coStr)
      : new Date(ci.getFullYear(), ci.getMonth(), ci.getDate() + noites);

    // não contar noites futuras
    co = clampCheckoutToToday(co);

    // distribuir noites pelo intervalo [check-in, check-out)
    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      if (!ocup[y]) continue; // só anos >= BASE_YEAR
      ocup[y][m-1] += 1;
    }
  });

  // Percentagem por mês = noites / dias do mês * 100 (arredondado)
  const labels = nomesMes;

  // Paleta verde (combinado 123+1248), um tom por ano
  const palette = [
    'rgba(20, 78, 3, 1)',     // 2025
    'rgba(36, 110, 8, 1)',    // 2026
    'rgba(60, 140, 18, 1)',   // 2027
    'rgba(95, 168, 45, 1)',   // 2028
    'rgba(140, 190, 85, 1)',  // 2029
  ];

    const datasets = anos.map((y, idx) => {
    const dataPct = ocup[y].map((noitesMes, i) => {
     const denom = diasNoMes(y, i+1) * NUM_APTS;   // 👈 antes era só diasNoMes(...)
     const pct = denom ? (noitesMes / denom) * 100 : 0;
      return Math.round(pct);
      });

    const cor = palette[idx % palette.length];
    return {
      label: String(y),
      data: dataPct,
      backgroundColor: cor,
      borderColor: cor,
      borderWidth: 1
    };
  });

  // Plugin local para escrever % dentro das barras
  const inBarLabels = {
    id: 'inbar-labels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      chart.data.datasets.forEach((ds, dsIndex) => {
        const meta = chart.getDatasetMeta(dsIndex);
        meta.data.forEach((bar, i) => {
          const val = ds.data[i];
          if (val == null || val === 0) return;
          const x = bar.x;
          const y = bar.y + (bar.base - bar.y) / 2; // centro vertical
          // cor do texto (branco se a barra for escura)
          let fill = '#333';
          const m = String(ds.backgroundColor).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) {
            const r = +m[1], g = +m[2], b = +m[3];
            const L = 0.299*r + 0.587*g + 0.114*b;
            fill = (L < 140) ? '#fff' : '#333';
          }
          ctx.fillStyle = fill;
          ctx.fillText(`${val}%`, x, y);
        });
      });
      ctx.restore();
    }
  };

  const ctx = document.getElementById('chart-ocupacao-1231248');
  if (!ctx) return;
  if (chartOcupacao1231248) { chartOcupacao1231248.destroy(); chartOcupacao1231248 = null; }

  chartOcupacao1231248 = new Chart(ctx, {
    type: 'bar',
    plugins: [inBarLabels],
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false },              // sem % no eixo
          border: { display: false },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}



// ---------------------------------------------------------------> TX LIMPEZA

function renderTabelaLimpeza1231248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const APTS = ['123', '1248'];
  const BASE_YEAR = 2024;
  const CURR_YEAR = new Date().getFullYear();

  const anos = [];
  for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // mapas [ano][mes] => { n, v }
  const mapa = {};
  anos.forEach(a => {
    mapa[a] = Array.from({length:12}, () => ({ n:0, v:0 }));
  });

  // agrega 123 + 1248
  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (!APTS.includes(apt)) return;

    const ano = Number(f.ano), mes = Number(f.mes);
    if (!ano || !mes || mes<1 || mes>12) return;

    // nome do campo da limpeza: ajusta aqui se for diferente
    const limpeza = Number(f.taxaLimpeza || 0);

    if (!mapa[ano]) return;
    mapa[ano][mes-1].n += (limpeza > 0 ? 1 : 0);
    mapa[ano][mes-1].v += limpeza;
  });

  // detectar anos sem qualquer limpeza p/ ocultar a coluna (raro, mas possível)
  const anosComDados = anos.filter(a => mapa[a].some(m => m.n > 0 || m.v > 0));
  if (!anosComDados.length) {
    el.innerHTML = `<div class="muted">Sem dados de limpeza.</div>`;
    return;
  }

  // fundos suaves por ano
  const yearBg = ['#fbfbff', '#f9fffb', '#fffaf5', '#f8f9ff', '#f9f7ff'];

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${anosComDados.map(a => `<th colspan="2" style="text-align:center">${a}</th>`).join('')}
        </tr>
        <tr>
          ${anosComDados.map(() => `<th style="text-align:center">N.</th><th style="text-align:center">Total</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // linhas por mês
  meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anosComDados.forEach((a, idx) => {
      const { n, v } = mapa[a][i];
      const bg = yearBg[idx % yearBg.length];
      html += `<td style="background:${bg}; text-align:center">${n}</td>`;
      html += `<td style="background:${bg}; text-align:center">${formatEuro(v)}</td>`;
    });
    html += `</tr>`;
  });

  // totais por ano
  html += `<tr><td><strong>Total</strong></td>`;
  anosComDados.forEach((a, idx) => {
    const totN = mapa[a].reduce((s,m)=>s+m.n,0);
    const totV = mapa[a].reduce((s,m)=>s+m.v,0);
    const bg = yearBg[idx % yearBg.length];
    html += `<td style="background:${bg}; text-align:center"><strong>${totN}</strong></td>`;
    html += `<td style="background:${bg}; text-align:center"><strong>${formatEuro(totV)}</strong></td>`;
  });
  html += `</tr>`;

  html += `</tbody></table><hr class="divider">`;
  el.innerHTML = html;
}



//              -------------------->>>     Número de noites por Reserva

function renderTabelaNoites1231248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const anoAtual   = new Date().getFullYear();
  const anoInicial = 2025; // começa sempre em 2025
  const meses      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = ['2','3','4','5','6','7','≥8'];
  const APTS       = new Set(['123','1248']);

  const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '≥8' : String(v);
  };

  // ── 1) tabela detalhada do ano atual (se >= 2025) ──
  const mapa = Array.from({ length: 12 }, () =>
    Object.fromEntries(categorias.map(c => [c, 0]))
  );

  faturas.forEach(f => {
    if (!APTS.has(String(f.apartamento))) return;
    const ano = Number(f.ano);
    if (ano !== anoAtual) return;
    if (ano < anoInicial) return;
    const m = Number(f.mes);
    const cat = bucket(f.noites);
    if (!m || m < 1 || m > 12 || !cat) return;
    mapa[m - 1][cat] += 1;
  });

  let html = `
    <h3 class="center">Noites por Reserva</h3>
    <table class="media-faturacao">
      <thead>
        <tr>
          <th>Mês</th>
          ${categorias.map(c => `<th>${c} noites</th>`).join('')}
          <th>Total mês</th>
        </tr>
      </thead>
      <tbody>
  `;

  const totaisAnoAtual = Object.fromEntries(categorias.map(c => [c, 0]));
  let totalAnoAtual = 0;

  if (anoAtual >= anoInicial) {
    meses.forEach((nome, i) => {
      const linha = mapa[i];
      const somaMes = categorias.reduce((s, c) => s + linha[c], 0);
      totalAnoAtual += somaMes;
      categorias.forEach(c => (totaisAnoAtual[c] += linha[c]));

      html += `
        <tr>
          <td>${nome}</td>
          ${categorias.map(c => `<td>${linha[c]}</td>`).join('')}
          <td><strong>${somaMes}</strong></td>
        </tr>
      `;
    });

    html += `
      <tr>
        <td><strong>Total ${anoAtual}</strong></td>
        ${categorias.map(c => `<td><strong>${totaisAnoAtual[c]}</strong></td>`).join('')}
        <td><strong>${totalAnoAtual}</strong></td>
      </tr>
    `;
  }

  // ── 2) Totais dos anos anteriores (>=2025) ──
  const anosAnteriores = Array.from(new Set(
    faturas
      .filter(f => APTS.has(String(f.apartamento)))
      .map(f => Number(f.ano))
  ))
    .filter(a => a < anoAtual && a >= anoInicial)
    .sort((a, b) => b - a);

  anosAnteriores.forEach(ano => {
    const totaisAno = Object.fromEntries(categorias.map(c => [c, 0]));
    let totalAno = 0;

    faturas.forEach(f => {
      if (!APTS.has(String(f.apartamento))) return;
      if (Number(f.ano) !== ano) return;
      const cat = bucket(f.noites);
      if (!cat) return;
      totaisAno[cat] += 1;
      totalAno += 1;
    });

    html += `
      <tr style="background-color:#f2f2f2;">
        <td><strong>Total ${ano}</strong></td>
        ${categorias.map(c => `<td><strong>${totaisAno[c]}</strong></td>`).join('')}
        <td><strong>${totalAno}</strong></td>
      </tr>
    `;
  });

  html += `</tbody></table><hr class="divider">`;
  el.innerHTML = html;
}


// ------------------------------------------------------------------------> Número de hóspedes

function renderTabelaHospedes1231248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2025;
  const Y = new Date().getFullYear();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = [1,2,3,4,5,6,7,8]; // 1..8 hóspedes
  const euroInt = v => (typeof formatEuro === 'function'
    ? formatEuro(v)
    : `€${Math.round(Number(v)||0).toLocaleString('pt-PT')}`);

  // 20 € por hóspede acima de 6, por noite, a partir de Jun/2025
  const extraValor = (ano, mes, hosp, noites) => {
    if (ano < 2025) return 0;
    if (ano === 2025 && mes < 6) return 0;
    const h = Number(hosp)||0;
    const n = Number(noites)||0;
    if (h <= 6 || n <= 0) return 0;
    return (h - 6) * 20 * n;
  };

  // ---------- 1) Tabela detalhada do ANO ATUAL ----------
  const mapa = Array.from({length:12}, () =>
    Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }]))
  );

  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (apt !== '123' && apt !== '1248') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (ano !== Y || ano < BASE_YEAR) return;

    const adultos  = Number(f.hospedesAdultos || 0);
    const criancas = Number(f.hospedesCriancas || 0);
    const hosp = Math.max(1, Math.min(8, adultos + criancas));
    const vExtra = extraValor(ano, mes, hosp, Number(f.noites || 0));

    if (!mes || mes < 1 || mes > 12) return;
    mapa[mes-1][hosp].n += 1;
    mapa[mes-1][hosp].v += vExtra;
  });

  let html = `
    <h3 class="center">Número de Hóspedes</h3>
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${categorias.map(h => `<th colspan="2">${h} Hosp</th>`).join('')}
          <th colspan="2">Total</th>
        </tr>
        <tr>
          ${categorias.map(() => `<th style="text-align:center">N.</th><th>V</th>`).join('')}
          <th style="text-align:center">N.</th><th>V</th>
        </tr>
      </thead>
      <tbody>
  `;

  // Linhas mensais + totais do ano atual
  const totaisAnoAtual = {
    porHosp: Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }])),
    total: { n:0, v:0 }
  };

  meses.forEach((nome, i) => {
    let nMesTotal = 0, vMesTotal = 0;
    html += `<tr><td>${nome}</td>`;

    categorias.forEach(h => {
      const { n, v } = mapa[i][h];
      const showV = (h <= 6) ? '' : euroInt(v);
      html += `<td style="text-align:center">${n}</td><td style="text-align:right">${showV}</td>`;
      totaisAnoAtual.porHosp[h].n += n;
      totaisAnoAtual.porHosp[h].v += v;
      nMesTotal += n; vMesTotal += v;
    });

    totaisAnoAtual.total.n += nMesTotal;
    totaisAnoAtual.total.v += vMesTotal;

    html += `<td style="text-align:center"><strong>${nMesTotal}</strong></td><td style="text-align:right"><strong>${euroInt(vMesTotal)}</strong></td>`;
    html += `</tr>`;
  });

  // Total do ano atual
  html += `<tr>
    <td><strong>Total ${Y}</strong></td>
    ${categorias.map(h => {
      const t = totaisAnoAtual.porHosp[h];
      const showV = (h <= 6) ? '' : euroInt(t.v);
      return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:right"><strong>${showV}</strong></td>`;
    }).join('')}
    <td style="text-align:center"><strong>${totaisAnoAtual.total.n}</strong></td>
    <td style="text-align:right"><strong>${euroInt(totaisAnoAtual.total.v)}</strong></td>
  </tr>`;

  // ---------- 2) Totais de ANOS ANTERIORES (≥ 2025) ----------
  const anosAnteriores = Array.from(new Set(
    faturas
      .filter(f => (String(f.apartamento) === '123' || String(f.apartamento) === '1248'))
      .map(f => Number(f.ano))
  )).filter(a => a >= BASE_YEAR && a < Y).sort((a,b)=> b-a);

  anosAnteriores.forEach(ano => {
    const porHosp = Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }]));
    let totN = 0, totV = 0;

    faturas.forEach(f => {
      const apt = String(f.apartamento);
      if (apt !== '123' && apt !== '1248') return;
      if (Number(f.ano) !== ano) return;

      const mes = Number(f.mes);
      const adultos  = Number(f.hospedesAdultos || 0);
      const criancas = Number(f.hospedesCriancas || 0);
      const hosp = Math.max(1, Math.min(8, adultos + criancas));
      const vExtra = extraValor(ano, mes, hosp, Number(f.noites || 0));

      porHosp[hosp].n += 1;
      porHosp[hosp].v += vExtra;
      totN += 1;
      totV += vExtra;
    });

    html += `<tr style="background:#f2f2f2">
      <td><strong>Total ${ano}</strong></td>
      ${categorias.map(h => {
        const t = porHosp[h];
        const showV = (h <= 6) ? '' : euroInt(t.v);
        return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:right"><strong>${showV}</strong></td>`;
      }).join('')}
      <td style="text-align:center"><strong>${totN}</strong></td>
      <td style="text-align:right"><strong>${euroInt(totV)}</strong></td>
    </tr>`;
  });

  html += `</tbody></table><hr class="divider">`;
  el.innerHTML = html;
}


//  ----------------------------------------------------------------------------> Dias da semana

let chartCheckinsDiasSemana1231248 = null;

function renderCheckinsPorDiaSemana1231248(faturas) {
  const APTS = new Set(['123','1248']);
  const BASE_YEAR = 2025;
  const Y  = new Date().getFullYear();
  const LY = Y - 1;
  const todayISO = new Date().toISOString().slice(0,10);

  // Labels Seg..Dom; transformar getDay() (0=Dom) para 0=Seg
  const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const toSegIndex = (dow0Sun) => (dow0Sun + 6) % 7;

  const contY  = [0,0,0,0,0,0,0];
  const contLY = [0,0,0,0,0,0,0];

  const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  faturas.forEach(f => {
    if (!APTS.has(String(f.apartamento))) return;
    if (!isISO(f.checkIn)) return;
    if (f.checkIn > todayISO) return; // sem futuro

    const d = new Date(`${f.checkIn}T00:00:00`);
    const ano = d.getFullYear();
    if (ano < BASE_YEAR) return;      // 👈 só a partir de 2025

    const idx = toSegIndex(d.getDay()); // 0..6 (Seg..Dom)

    if (ano === Y)  contY[idx]  += 1;
    if (ano === LY && LY >= BASE_YEAR) contLY[idx] += 1;
  });

  const datasets = [];
  const hasLY = (LY >= BASE_YEAR) && contLY.some(v => v > 0);
  if (hasLY) {
    datasets.push({
      label: String(LY),
      data: contLY,
      type: 'bar',
      backgroundColor: 'rgba(120,120,120,1)',
      borderColor: 'rgba(120,120,120,1)',
      borderWidth: 1,
      categoryPercentage: 0.7,
      barPercentage: 0.8
    });
  }
  datasets.push({
    label: String(Y),
    data: contY,
    type: 'bar',
    backgroundColor: 'rgb(20, 78, 3)',
    borderColor: 'rgb(20, 78, 3)',
    borderWidth: 1,
    categoryPercentage: 0.7,
    barPercentage: 0.8
  });

  const ctx = document.getElementById('chart-checkins-dias-1231248');
  if (!ctx) return;
  if (chartCheckinsDiasSemana1231248) { chartCheckinsDiasSemana1231248.destroy(); chartCheckinsDiasSemana1231248 = null; }

  chartCheckinsDiasSemana1231248 = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(0,0,0,0.06)' }, border: { display: false } }
      }
    }
  });
}
