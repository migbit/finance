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
  gerarHeatmapVariacao(faturas);
  renderTabelaComparativaAnos123(faturas, 'tabela-comparativa-anos-123');
  renderGraficoValorMedioReservasAno123(faturas);
  renderGraficoOcupacaoMensal123(faturas);
  renderTabelaLimpeza123(faturas, 'tabela-limpeza-123');
  renderTabelaNoites123(faturas, 'tabela-noites-123');
  renderTabelaHospedes123(faturas, 'tabela-hospedes-123');
  renderCheckinsPorDiaSemana123(faturas);
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

// Formata inteiros em € (pt-PT)
const euroInt = (v) => {
  const num = Math.round(Number(v) || 0);
  return num.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
    useGrouping: true
  })
  .replace(/\./g, ' ')  // pt-PT uses . for thousands → replace with space
  + ' €';               // Add space + € at the end (standard in Portugal)
};

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
    label: `${anos[0]}`,                          // ano anterior
    data: labels.map((_, i) => somaPor(penultimoAno, i + 1, '123')),
    borderDash: [4, 4],
    borderWidth: 1.5,
    borderColor: 'rgba(120,120,120,1)',           // 👈 cinza neutro
    backgroundColor: 'rgba(120,120,120,0.1)',
    tension: 0.25
  });
}

datasetsLine.push({
  label: `${ultimoAno}`,                          // ano atual
  data: data123,
  borderColor: 'rgba(54,162,235,1)',              // 👈 azul do apt 123
  backgroundColor: 'rgba(54,162,235,0.15)',
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
          stepSize: 100   // 👈 increments de 1000 em 1000
        },
        suggestedMax: 8500 // ou usa grace: '12%' se preferires automático
      }
    }
  }
});
  

  
 // ----------------------------------------------------------------------------> BARRAS DE PROGRESSO
// helper: soma ano (opcionalmente por apt)
const somaAno = (ano, apt = null) => faturas
  .filter(f => Number(f.ano) === Number(ano) && (!apt || String(f.apartamento) === String(apt)))
  .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);

let htmlProg = '';

// ─── 1) Parcial do mês atual (Apt 123) ───
{
  const mesAtual = new Date().getMonth() + 1;
  const nomeMesAtual = obterNomeMes(mesAtual);
  const temDados = faturas.some(f =>
    Number(f.ano) === ultimoAno &&
    Number(f.mes) === mesAtual &&
    String(f.apartamento) === '123'
  );
  if (temDados) {
    const cur = faturas
      .filter(f => Number(f.ano) === ultimoAno && Number(f.mes) === mesAtual && String(f.apartamento)==='123')
      .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);
    const ant = faturas
      .filter(f => Number(f.ano) === penultimoAno && Number(f.mes) === mesAtual && String(f.apartamento)==='123')
      .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);

    const base  = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
    const diff  = ant - cur;
    const pct   = Math.round(Math.abs(diff) / base * 100);
    const lbl   = diff > 0 ? `-${pct}%` : `+${pct}%`;
    const cor   = diff > 0 ? '#dc3545' : '#28a745';
    const texto = diff > 0 ? `Faltam €${diff.toFixed(2)}` : `Excedeu €${(-diff).toFixed(2)}`;

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

// ─── 2) Até mês anterior (Apt 123) ───
{
  const currentMonth = new Date().getMonth() + 1;
  const prevMonth    = Math.max(1, currentMonth - 1);
  const nomeMes      = obterNomeMes(prevMonth);

  const cur = faturas
    .filter(f => Number(f.ano) === ultimoAno &&
                 String(f.apartamento) === '123' &&
                 Number(f.mes) < currentMonth)
    .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);

  const ant = faturas
    .filter(f => Number(f.ano) === penultimoAno &&
                 String(f.apartamento) === '123' &&
                 Number(f.mes) < currentMonth)
    .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);

  const base  = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
  const diff  = ant - cur;
  const pct   = Math.min(100, Math.round(Math.abs(diff) / base * 100));
  const lbl   = diff > 0 ? `-${pct}%` : `+${pct}%`;
  const cor   = diff > 0 ? '#dc3545' : '#28a745';
  const texto = diff > 0 ? `Faltam €${diff.toFixed(2)}` : `Excedeu €${(-diff).toFixed(2)}`;

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

// ─── 3) ${ultimoAno} vs ${penultimoAno} (Apt 123) ───
{
  const atual = somaAno(ultimoAno, '123');
  const antes = somaAno(penultimoAno, '123');

  const diff    = antes - atual;
  const pct     = Math.round(Math.abs(diff) / (antes || 1) * 100);
  const labelPct= diff > 0 ? `-${pct}%` : `+${pct}%`;
  const cor     = diff > 0 ? '#dc3545' : '#28a745';
  const label   = diff > 0 ? `Faltam €${diff.toFixed(2)}` : `Excedeu €${(-diff).toFixed(2)}`;

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
function gerarHeatmapVariacao(faturas) {
    // 1) Totais por ano/mês (Apenas Apt 123)
    const totais = {};
        faturas
        .filter(f => String(f.apartamento) === '123')  // 🔑 só este apartamento
        .forEach(f => {
        const ano = Number(f.ano), mes = Number(f.mes);
        if (!totais[ano]) totais[ano] = {};
        totais[ano][mes] = (totais[ano][mes] || 0) + Number(f.valorTransferencia || 0);
    });



// 2) Eixo X (anos) e Y (meses) - só anos com base (a-1) disponível
const anosAll = Object.keys(totais).map(n => Number(n)).sort((a,b)=>a-b);
const anos    = anosAll.filter(a => totais[a - 1]); // ex.: em 2025 mostra 2025 (porque há 2024)

if (anos.length === 0) {
  const wrap = document.getElementById('heatmap-variacao');
  if (wrap) {
    wrap.innerHTML = `
      <div class="heatmap-wrap">
        <span class="heatmap-muted">
          Sem base do ano anterior (o heatmap começa quando existir 2025 vs 2024).
        </span>
      </div>`;
  }
  return;
}

const meses = Array.from({ length: 12 }, (_, i) => i + 1);
const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];



  // 3) Função cor: mapeia -50% (vermelho) a +50% (verde), 0% = branco
  // clamp para [-0.5, +0.5] para a escala visual
  // color scale: -50% red → 0% light grey → +50% green
// color scale: -100% deep red → 0% light grey → +50% green
function pctToColor(p) {
  if (p === null) return '#f5f5f5'; // N/A
  const NEG_MIN = -1.0; // -100%
  const POS_MAX = 1.0;  // +100%

  function lerp(a,b,t){ return a + (b-a)*t; }
  function hex(r,g,b){ return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`; }

  const deepRed = [139, 0, 0];     // #8b0000 (mais escuro para -100%)
  const mid     = [236, 236, 236]; // cinza claro para 0%
  const green   = [40, 167, 69];   // #28a745

  let c;

  if (p <= 0) {
    // mapear NEG_MIN..0 → 0..1 e dar mais contraste perto de -100%
    const clamped = Math.max(NEG_MIN, Math.min(0, Number(p)));
    let k = (clamped - NEG_MIN) / (0 - NEG_MIN); // 0..1
    k = Math.pow(k, 0.65); // separa melhor -48% de -100%
    c = [ lerp(deepRed[0], mid[0], k), lerp(deepRed[1], mid[1], k), lerp(deepRed[2], mid[2], k) ];
  } else {
    const clamped = Math.max(0, Math.min(POS_MAX, Number(p)));
    let k = clamped / POS_MAX;     // 0..1
    k = Math.pow(k, 0.9);          // curva suave no lado positivo
    c = [ lerp(mid[0], green[0], k), lerp(mid[1], green[1], k), lerp(mid[2], green[2], k) ];
  }

  return hex(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]));
}


// Decide white vs black text depending on background brightness
function idealTextOn(bgHex) {
  const r = parseInt(bgHex.slice(1,3),16);
  const g = parseInt(bgHex.slice(3,5),16);
  const b = parseInt(bgHex.slice(5,7),16);
  // relative luminance
  const L = (0.299*r + 0.587*g + 0.114*b);
  return L < 160 ? '#fff' : '#111'; // threshold bumped to 160 for better contrast
}

// 4) Construir tabela
const wrap = document.getElementById('heatmap-variacao');
if (!wrap) return;

let html = `
  <div class="heatmap-wrap">
    <table class="heatmap-table">
      <thead>
        <tr>
          <th>Mês \\ Ano</th>
          ${anos.map(a => `<th>${a}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
`;

meses.forEach(m => {
  html += `<tr><th>${nomesMes[m - 1]}</th>`;

  anos.forEach(a => {
    const prev = totais[a - 1]?.[m] ?? null;
    const cur  = totais[a]?.[m] ?? null;

    let pct = null;
    if (prev === null) {
      pct = null;                 // sem ano anterior → N/A (vazio)
    } else if (prev === 0 && cur === 0) {
      pct = 0;                    // 0 → 0% (cinza claro)
    } else if (prev === 0 && cur !== 0) {
      pct = null;                 // sem base → N/A (vazio)
    } else {
      pct = (cur - prev) / prev;  // variação %
    }

if (pct === null) {
  html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
} else {
  const bg = pctToColor(pct);
  const fg = idealTextOn(bg);   // ✅ ensure contrast
  const label = `${(pct * 100).toFixed(0)}%`;
  html += `<td class="heatmap-cell" style="background:${bg};color:${fg};font-weight:600">${label}</td>`;
}

  });

  html += `</tr>`;
});

html += `
      </tbody>
    </table>
  </div>
`;
wrap.innerHTML = html;
}

//  ---------------------------------------------------------------------> Tabela Faturação Mensal
  
function renderTabelaComparativaAnos123(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2024;
  const CURR_YEAR = new Date().getFullYear();
  const anos = [];
  for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const totals = {};
  const nights = {};
  anos.forEach(a => {
    totals[a] = Array.from({ length: 12 }, () => 0);
    nights[a] = Array.from({ length: 12 }, () => 0);
  });

  // agrega só Apt 123
  faturas.forEach(f => {
    if (String(f.apartamento) !== '123') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;

    const v = Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
    const n = Number(f.noites || 0);

    totals[ano][mes - 1] += v;
    nights[ano][mes - 1] += Number.isFinite(n) ? n : 0;
  });

  // mostra "Média" se houver pelo menos um mês com noites > 0 nesse ano
  const mostraMedia = {};
  anos.forEach(a => { mostraMedia[a] = nights[a].some(x => x > 0); });

  // paleta de cores clarinhas por ano
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

    // linha final única: Total (e Preço médio/noite na coluna "Média" quando existir)
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

  // nova linha: Média mensal (Total / 12)
  html += `<tr><td><strong>Média mensal</strong></td>`;
  anos.forEach((a, idx) => {
    const bg = yearBg[idx % yearBg.length];
    const totalAno = totals[a].reduce((s, v) => s + v, 0);
    const mediaMensal = totalAno / 12;

    if (mostraMedia[a])
      html += `<td style="background:${bg}; text-align:center">—</td>`;

    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(mediaMensal)}</strong></td>`;
  });
  html += `</tr>`;

  html += `</tbody></table><hr class="divider">`;
  el.innerHTML = html;
}


// ---------------------------------------------------------------> Gráfico valor noite

let chartVmReservas123 = null;

const _vm_totalReserva = f => Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);

function renderGraficoValorMedioReservasAno123(faturas) {
  const APT = '123';
  const Y = new Date().getFullYear();
  const todayISO = new Date().toISOString().slice(0,10); // YYYY-MM-DD

  const regs = faturas
    .filter(f => {
      if (String(f.apartamento) !== APT) return false;
      if (typeof f.checkIn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) return false;

      const anoIn  = Number(f.checkIn.slice(0,4));
      const noites = Number(f.noites || 0);

      if (noites <= 0) return false;
      if (f.checkIn > todayISO) return false; // exclui futuro
      return anoIn === Y;                      // conta pelo ano do check-in
    })
    .sort((a,b) => a.checkIn.localeCompare(b.checkIn));

  if (!regs.length) {
    if (chartVmReservas123) { chartVmReservas123.destroy(); chartVmReservas123 = null; }
    return;
  }

  const labels = regs.map(r => r.checkIn);
  const data   = regs.map(r => Math.round(_vm_totalReserva(r) / Number(r.noites)));

  const ctx = document.getElementById('chart-vm-reservas-123');
  if (!ctx) return;
  if (chartVmReservas123) { chartVmReservas123.destroy(); chartVmReservas123 = null; }

  chartVmReservas123 = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `€ por noite (${Y})`,
        data,
        borderColor: 'rgba(54,162,235,1)',   // azul do 123
        backgroundColor: 'rgba(54,162,235,1)',
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
          min: 100,
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

let chartOcupacao123 = null;

function renderGraficoOcupacaoMensal123(faturas) {
  const APT = '123';
  const BASE_YEAR = 2025;
  const hoje = new Date();

  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const diasNoMes = (y, m1_12) => new Date(y, m1_12, 0).getDate();
  const isoToDate = s => new Date(`${s}T00:00:00`);
  const clampCheckoutToToday = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    return d > tomorrow ? tomorrow : d;
  };

  // anos desde 2025 presentes nas reservas
  const anos = Array.from(new Set(
    faturas
      .filter(f => String(f.apartamento) === APT && typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
      .map(f => Number(f.checkIn.slice(0,4)))
  )).filter(y => y >= BASE_YEAR).sort((a,b)=>a-b);

  if (!anos.length) return;

  // Plugin local p/ escrever "%"" no centro das barras (sem dependências)
const inBarLabels = {
  id: 'inbar-labels',
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, data } = chart;
    ctx.save();
    ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((ds, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex);
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val == null || val === 0) return;
        // centro vertical da barra
        const y = bar.y + (bar.base - bar.y) / 2;
        const x = bar.x;
        // cor do texto — escuro em tons claros, branco em cinzas mais escuros
        const isDark = ds.backgroundColor && /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.test(ds.backgroundColor) ? (()=>{
          const m = ds.backgroundColor.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
          const r=+m[1], g=+m[2], b=+m[3];
          const L = 0.299*r + 0.587*g + 0.114*b;
          return L < 140;
        })() : false;
        ctx.fillStyle = isDark ? '#fff' : '#333';
        ctx.fillText(`${val}%`, x, y);
      });
    });

    ctx.restore();
  }
  };

  // noites ocupadas por ano/mês
  const ocup = {};
  anos.forEach(y => ocup[y] = Array.from({length:12}, ()=>0));

  faturas.forEach(f => {
    if (String(f.apartamento) !== APT) return;
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

    // distribui as noites por mês (intervalo [ci, co))
    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      if (!ocup[y]) continue; // só anos >= BASE_YEAR
      ocup[y][m-1] += 1;
    }
  });

  // datasets: percentagem por mês = noites / dias do mês * 100
  const labels = nomesMes;
  const palette = [
    'rgba(90,90,90,1)',     // 2025
    'rgba(120,120,120,1)',  // 2026
    'rgba(150,150,150,1)',  // 2027
    'rgba(180,180,180,1)',  // 2028
    'rgba(210,210,210,1)',  // 2029
  ];

  const datasets = anos.map((y, idx) => {
    const dataPct = ocup[y].map((noitesMes, i) => {
      const denom = diasNoMes(y, i+1);
      return Math.round( denom ? (noitesMes / denom) * 100 : 0 );
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

  const ctx = document.getElementById('chart-ocupacao-123');
  if (!ctx) return;
  if (chartOcupacao123) { chartOcupacao123.destroy(); chartOcupacao123 = null; }

  chartOcupacao123 = new Chart(ctx, {
  type: 'bar',
  plugins: [inBarLabels],          // 👈 ativa labels dentro das barras
  data: { labels, datasets },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } },
      // Se TIVERES chartjs-plugin-datalabels carregado, podes usar isto em alternativa:
      // datalabels: { anchor:'center', align:'center', formatter:(v)=> v?`${v}%`:'', color:'#fff', font:{weight:600, size:11} }
    },
    scales: {
    x: { grid: { display: false } },
    y: {
    beginAtZero: true,
    max: 100,
    ticks: {
    display: false   // 👈 oculta os valores no eixo Y
    },
    border: { display: false },
    grid: { color: 'rgba(0,0,0,0.06)' }
    }
    }
    }
  });

}


// ---------------------------------------------------------------> TX LIMPEZA

function renderTabelaLimpeza123(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2025;
  const CURR_YEAR = new Date().getFullYear();
  const anos = [];
  for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // limpeza[ano][mes] = { count, total }
  const limpeza = {};
  anos.forEach(ano => {
    limpeza[ano] = Array.from({ length: 12 }, () => ({ count: 0, total: 0 }));
  });

  faturas.forEach(f => {
    if (String(f.apartamento) !== '123') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes) return;
    const v = Number(f.taxaLimpeza || 0);
    limpeza[ano][mes - 1].count += 1;
    limpeza[ano][mes - 1].total += v;
  });

  // Só a TABELA (sem <h3> e sem <hr>)
  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${anos.map(a => `<th colspan="2">${a}</th>`).join('')}
        </tr>
        <tr>
          ${anos.map(() => `<th style="text-align:center">N.</th><th>Total</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach(ano => {
      const item = limpeza[ano][i];
      html += `<td>${item.count}</td><td>${Math.round(item.total)}€</td>`;
    });
    html += `</tr>`;
  });

  html += `<tr><td><strong>Total</strong></td>`;
  anos.forEach(ano => {
    const totCount = limpeza[ano].reduce((s, m) => s + m.count, 0);
    const totVal   = limpeza[ano].reduce((s, m) => s + m.total, 0);
    html += `<td><strong>${totCount}</strong></td><td><strong>${Math.round(totVal)}€</strong></td>`;
  });
  html += `</tr>`;

  html += `</tbody></table>`;
  el.innerHTML = html;
}



//              -------------------->>>     Número de noites por Reserva

function renderTabelaNoites123(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const anoAtual = new Date().getFullYear();
  const anoInicial = 2025; // 👈 começamos sempre em 2025
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = ['2','3','4','5','6','7','≥8'];

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
    if (String(f.apartamento) !== '123') return;
    if (Number(f.ano) !== anoAtual) return;
    if (Number(f.ano) < anoInicial) return; // ignora dados antes de 2025
    const m = Number(f.mes);
    const cat = bucket(f.noites);
    if (!m || m < 1 || m > 12 || !cat) return;
    mapa[m - 1][cat] += 1;
  });

  let html = `
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
      categorias.forEach(c => totaisAnoAtual[c] += linha[c]);

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
    faturas.filter(f => String(f.apartamento) === '123').map(f => Number(f.ano))
  ))
  .filter(a => a < anoAtual && a >= anoInicial)
  .sort((a, b) => b - a); // ordem decrescente

  anosAnteriores.forEach(ano => {
    const totaisAno = Object.fromEntries(categorias.map(c => [c, 0]));
    let totalAno = 0;

    faturas.forEach(f => {
      if (String(f.apartamento) !== '123') return;
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

function renderTabelaHospedes123(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2025;
  const Y = new Date().getFullYear();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = [1,2,3,4,5,6,7,8]; // 1..8 hosp

  const euroInt = v => `${Math.round(Number(v)||0)}€`;

  // regra do valor extra (20€ por hóspede acima de 6, por noite) a partir de Jun/2025
  const extraValor = (ano, mes, hosp, noites) => {
    if (ano < 2025) return 0;
    if (ano === 2025 && mes < 6) return 0; // antes de junho/2025 não conta
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
    if (String(f.apartamento) !== '123') return;
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

  // Linhas mensais
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
      // acumula totais do ano atual
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
      .filter(f => String(f.apartamento) === '123')
      .map(f => Number(f.ano))
  )).filter(a => a >= BASE_YEAR && a < Y).sort((a,b)=> b-a);

  anosAnteriores.forEach(ano => {
    const porHosp = Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }]));
    let totN = 0, totV = 0;

    faturas.forEach(f => {
      if (String(f.apartamento) !== '123') return;
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

let chartCheckinsDiasSemana123 = null;

function renderCheckinsPorDiaSemana123(faturas) {
  // Apt 123, ano atual
  const Y = new Date().getFullYear();
  const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const cont = [0,0,0,0,0,0,0]; // Mon..Sun

  faturas.forEach(f => {
    if (String(f.apartamento) !== '123') return;
    const s = f.checkIn; // esperado 'YYYY-MM-DD'
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return;
    const ano = Number(s.slice(0,4));
    if (ano !== Y) return;

    // weekday: Date.getDay() => 0(Dom)..6(Sáb). Converte para 0=Seg..6=Dom
    const d = new Date(`${s}T00:00:00`);
    if (isNaN(d)) return;
    const idx = (d.getDay() + 6) % 7;
    cont[idx] += 1;
  });

  const ctx = document.getElementById('chart-checkins-dia-semana');
  if (!ctx) return;

  if (chartCheckinsDiasSemana123) {
    chartCheckinsDiasSemana123.destroy();
    chartCheckinsDiasSemana123 = null;
  }

 chartCheckinsDiasSemana123 = new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
    datasets: [{
      label: `Check-ins por dia (${Y})`,
      data: cont,
      backgroundColor: '#24466F',
      borderColor: '#24466F',
      borderWidth: 1,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false, axis: 'x' },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 }
      }
    }
  }
});
}