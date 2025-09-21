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

let chartComparacaoApt = null;
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
  gerarMediaFaturacao(faturas);
  gerarHeatmapVariacao(faturas); // ⬅️ NOVO
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



function gerarAnaliseFaturacao(faturas) {

    // destruir gráficos antigos antes de recriar
  if (chartComparacaoApt) {
    chartComparacaoApt.destroy();
    chartComparacaoApt = null;
  }
  if (chartTotal) {
    chartTotal.destroy();
    chartTotal = null;
  }

    // 1) Prepara dados: meses 1–12, anos disponíveis (até ano atual)
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
    { label: `Apt 123 ${anos[0]}`,  data: data123Prev,  backgroundColor: 'rgba(54,162,235,0.4)' },
    { label: `Apt 1248 ${anos[0]}`, data: data1248Prev, backgroundColor: 'rgba(245, 133, 20, 0.4)' }
  );
}
datasetsBar.push(
  { label: `Apt 123 ${ultimoAno}`,  data: data123,  backgroundColor: 'rgba(54,162,235,1)' },
  { label: `Apt 1248 ${ultimoAno}`, data: data1248, backgroundColor: 'rgba(245, 133, 20,1)' }
);

chartComparacaoApt = new Chart(document.getElementById('chart-comparacao-apt'), {
  type: 'bar',
  data: { labels, datasets: datasetsBar },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});


const datasetsLine = [];
if (temAnterior) {
  datasetsLine.push({
    label: `Total ${anos[0]}`,
    data: labels.map((_, i) => somaPor(anos[0], i + 1, '123') + somaPor(anos[0], i + 1, '1248')),
    borderDash: [5, 5]
  });
}
datasetsLine.push({ label: `Total ${ultimoAno}`, data: dataTotal });

chartTotal = new Chart(document.getElementById('chart-total'), {
  type: 'line',
  data: { labels, datasets: datasetsLine },
  options: { responsive: true }
});

  
    
  // 4) Barras de progresso: acumulado ano vs ano anterior
  const somaAno = (ano, apt = null) => faturas
    .filter(f => Number(f.ano) === Number(ano) && (!apt || String(f.apartamento) === String(apt)))
    .reduce((s,f) => s + Number(f.valorTransferencia || 0), 0);

  // 4) Barras de progresso: totais gerais e por apartamento
  const apartamentos = Array.from(new Set(faturas.map(f => f.apartamento))).sort();

  // ─── totais acumulados em tabela ───
  const sumCurr123   = somaAno(ultimoAno, '123');
  const sumCurr1248  = somaAno(ultimoAno, '1248');
  const totalAcumAtual = sumCurr123 + sumCurr1248;

  const sumPrev123   = somaAno(penultimoAno, '123');
  const sumPrev1248   = somaAno(penultimoAno, '1248');
  const totalPrevAno  = sumPrev123 + sumPrev1248;

  let htmlProg = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th>Ano</th>
          <th class="apt-123">123</th>
          <th class="apt-1248">1248</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${ultimoAno}</td>
          <td class="apt-123">€${sumCurr123.toFixed(2)}</td>
          <td class="apt-1248">€${sumCurr1248.toFixed(2)}</td>
          <td>€${totalAcumAtual.toFixed(2)}</td>
        </tr>
        <tr>
          <td>${penultimoAno}</td>
          <td class="apt-123">€${sumPrev123.toFixed(2)}</td>
          <td class="apt-1248">€${sumPrev1248.toFixed(2)}</td>
          <td>€${totalPrevAno.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    <hr class="divider">
  `;

  // 1) comparação por apartamento vs todos os anos anteriores
  apartamentos.forEach(apt => {
    const atual = somaAno(ultimoAno, apt);
    const antes = faturas
      .filter(f => String(f.apartamento) === String(apt) && Number(f.ano) < Number(ultimoAno))
      .reduce((s,f) => s + f.valorTransferencia, 0) || 1;

    const diff    = antes - atual;
    const pct     = Math.round(Math.abs(diff) / antes * 100);
    const labelPct= diff > 0 ? `-${pct}%` : `+${pct}%`;
    const barCol  = diff > 0 ? '#dc3545' : '#28a745';
    const label   = diff > 0
                      ? `Faltam €${diff.toFixed(2)}`
                      : `Excedeu €${(-diff).toFixed(2)}`;

    htmlProg += `
      <div class="comparacao-item">
        <strong>Apt ${apt} ${ultimoAno} vs ${penultimoAno}:</strong>
        <span style="color:${barCol}; margin-left:0.5rem;">${label}</span>
        <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
          <div class="progress-bar"
               style="width:${pct}%; background:${barCol}; display:flex;align-items:center;justify-content:center;">
            ${labelPct}
          </div>
        </div>
      </div>`;
  });

  // 2) total combinado vs todos os anos anteriores
  (() => {
    const diffT     = totalPrevAno - totalAcumAtual;
    const pctT      = Math.round(Math.abs(diffT) / totalPrevAno * 100);
    const labelPctT = diffT > 0 ? `-${pctT}%` : `+${pctT}%`;
    const barColT   = diffT > 0 ? '#dc3545' : '#28a745';
    const labelT    = diffT > 0
                        ? `Faltam €${diffT.toFixed(2)}`
                        : `Excedeu €${(-diffT).toFixed(2)}`;

    htmlProg += `
      <hr class="divider">
      <div class="comparacao-item">
        <strong>Total ${ultimoAno} vs ${penultimoAno}:</strong>
        <span style="color:${barColT}; margin-left:0.5rem;">${labelT}</span>
        <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
          <div class="progress-bar"
               style="width:${pctT}%; background:${barColT}; display:flex;align-items:center;justify-content:center;">
            ${labelPctT}
          </div>
        </div>
      </div>`;
  })();

  // 3) comparativo até mês anterior por apt + total
  const currentMonth = new Date().getMonth() + 1;
  const prevMonth = Math.max(1, currentMonth - 1);
  const nomeMes   = obterNomeMes(prevMonth);
  htmlProg += `<hr class="divider"><strong>Comparativo até ${nomeMes}:</strong>`;

  apartamentos.forEach(apt => {
    const curA = faturas
      .filter(f => Number(f.ano) === Number(ultimoAno) &&
                   String(f.apartamento) === String(apt) &&
                   Number(f.mes) < Number(currentMonth))
      .reduce((s,f) => s + f.valorTransferencia, 0);
    const antA = faturas
      .filter(f => String(f.apartamento) === String(apt) &&
                   Number(f.ano) < Number(ultimoAno) &&
                   Number(f.mes) < Number(currentMonth))
      .reduce((s,f) => s + f.valorTransferencia, 0) || 1;

    const diffA    = antA - curA;
    const pctA     = Math.round(Math.abs(diffA) / antA * 100);
    const labelPctA= diffA > 0 ? `-${pctA}%` : `+${pctA}%`;
    const barColA  = diffA > 0 ? '#dc3545' : '#28a745';
    const labelA   = diffA > 0
                       ? `Faltam €${diffA.toFixed(2)}`
                       : `Excedeu €${(-diffA).toFixed(2)}`;

    htmlProg += `
      <div class="comparacao-item">
        <strong>Apt ${apt} até ${nomeMes}:</strong>
        <span style="color:${barColA}; margin-left:0.5rem;">${labelA}</span>
        <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
          <div class="progress-bar"
               style="width:${pctA}%; background:${barColA}; display:flex;align-items:center;justify-content:center;">
            ${labelPctA}
          </div>
        </div>
      </div>`;
  });

  (() => {
    const curT2 = faturas
      .filter(f => Number(f.ano) === Number(ultimoAno) &&
                   Number(f.mes) < Number(currentMonth))
      .reduce((s,f) => s + f.valorTransferencia, 0);
    const antT2 = faturas
      .filter(f => Number(f.ano) < Number(ultimoAno) &&
                   Number(f.mes) < Number(currentMonth))
      .reduce((s,f) => s + f.valorTransferencia, 0) || 1;

    const diffT2    = antT2 - curT2;
    const pctT2     = Math.round(Math.abs(diffT2) / antT2 * 100);
    const labelPctT2= diffT2 > 0 ? `-${pctT2}%` : `+${pctT2}%`;
    const barColT2  = diffT2 > 0 ? '#dc3545' : '#28a745';
    const labelT2   = diffT2 > 0
                       ? `Faltam €${diffT2.toFixed(2)}`
                       : `Excedeu €${(-diffT2).toFixed(2)}`;

    htmlProg += `
      <hr class="divider">
      <div class="comparacao-item">
        <strong>Total até ${nomeMes}:</strong>
        <span style="color:${barColT2}; margin-left:0.5rem;">${labelT2}</span>
        <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
          <div class="progress-bar"
               style="width:${pctT2}%; background:${barColT2}; display:flex;align-items:center;justify-content:center;">
            ${labelPctT2}
          </div>
        </div>
      </div>`;
  })();

(() => {
  const mesAtual = new Date().getMonth() + 1;
  const temDados = faturas.some(f => Number(f.ano) === Number(ultimoAno) && Number(f.mes) === Number(mesAtual));
  if (!temDados) return;

  const nomeMesAtual = obterNomeMes(mesAtual);
  htmlProg += `<hr class="divider"><strong>Comparativo de ${nomeMesAtual} (parcial):</strong>`;

  // por apartamento
  apartamentos.forEach(apt => {
    const cur = faturas
      .filter(f => Number(f.ano) === Number(ultimoAno) &&
                   String(f.apartamento) === String(apt) &&
                   Number(f.mes) === Number(mesAtual))
      .reduce((s,f) => s + f.valorTransferencia, 0);
    const ant = faturas
      .filter(f => String(f.apartamento) === String(apt) &&
                   Number(f.ano) < Number(ultimoAno) &&
                   Number(f.mes) === Number(mesAtual))
      .reduce((s,f) => s + f.valorTransferencia, 0);

    const base = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
    const diff = ant - cur;
    const pct  = Math.round(Math.abs(diff) / base * 100);
    const cor  = diff > 0 ? '#dc3545' : '#28a745';
    const rot  = diff > 0 ? `Faltam €${diff.toFixed(2)}` : `Excedeu €${(-diff).toFixed(2)}`;
    const lbl  = diff > 0 ? `-${pct}%` : `+${pct}%`;

    htmlProg += `
      <div class="comparacao-item">
        <strong>Apt ${apt} em ${nomeMesAtual}:</strong>
        <span style="color:${cor}; margin-left:0.5rem;">${rot}</span>
        <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
          <div class="progress-bar"
               style="width:${pct}%; background:${cor}; display:flex; align-items:center; justify-content:center;">
            ${lbl}
          </div>
        </div>
      </div>`;
  });

  // total
  const curT = faturas
    .filter(f => Number(f.ano) === Number(ultimoAno) && Number(f.mes) === Number(mesAtual))
    .reduce((s,f) => s + f.valorTransferencia, 0);
  const antT = faturas
    .filter(f => Number(f.ano) < Number(ultimoAno) && Number(f.mes) === Number(mesAtual))
    .reduce((s,f) => s + f.valorTransferencia, 0);

  const baseT = antT === 0 ? (curT === 0 ? 1 : curT) : antT;
  const diffT = antT - curT;
  const pctT  = Math.round(Math.abs(diffT) / baseT * 100);
  const corT  = diffT > 0 ? '#dc3545' : '#28a745';
  const rotT  = diffT > 0 ? `Faltam €${diffT.toFixed(2)}` : `Excedeu €${(-diffT).toFixed(2)}`;
  const lblT  = diffT > 0 ? `-${pctT}%` : `+${pctT}%`;

  htmlProg += `
    <div class="comparacao-item">
      <strong>Total em ${nomeMesAtual}:</strong>
      <span style="color:${corT}; margin-left:0.5rem;">${rotT}</span>
      <div class="progress" style="background:#e9ecef; height:1.5rem; margin-top:0.5rem;">
        <div class="progress-bar"
             style="width:${pctT}%; background:${corT}; display:flex; align-items:center; justify-content:center;">
          ${lblT}
        </div>
      </div>
    </div>`;
})();

document.getElementById('progresso-anos').innerHTML = htmlProg;
}

  // Função: gerar média mensal por ano e apartamento
  function gerarMediaFaturacao(faturas) {
  const currentYear = new Date().getFullYear();
  const anos = [2024, currentYear].sort((a,b)=>a-b);
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);


  const apartamentos = Array.from(new Set(faturas.map(f => f.apartamento))).sort();

  let html = '<table class="media-faturacao"><thead><tr><th>ANO</th>';
  apartamentos.forEach(apt => {
  html += `<th class="apt-${apt}">APT ${apt}</th>`;
  });
  html += '<th>TOTAL</th></tr></thead><tbody>';

  anos.forEach(ano => {
    const faturasAno = faturas.filter(f => Number(f.ano) === Number(ano));
    const numMeses = 12;

    let somaTotal = 0;
    html += `<tr><td>${ano}</td>`;
    apartamentos.forEach(apt => {
      const somaApt = faturasAno
        .filter(f => String(f.apartamento) === String(apt))
        .reduce((sum, f) => sum + Number(f.valorTransferencia || 0), 0);
      const mediaApt = somaApt / numMeses;
      somaTotal += somaApt;
      html += `<td class="apt-${apt}">€${mediaApt.toFixed(2)}</td>`;
    });
    const mediaTotal = somaTotal / numMeses;
    html += `<td>€${mediaTotal.toFixed(2)}</td></tr>`;
  });

  html += '</tbody></table>';

  let container = document.getElementById('media-faturacao');
  if (!container) {
    container = document.createElement('div');
    container.id = 'media-faturacao';
    document.getElementById('analise-faturacao-container').appendChild(container);
  }
  container.innerHTML = html;
}

function gerarHeatmapVariacao(faturas) {
  // 1) Totais por ano/mês (somando os apartamentos)
  const totais = {}; // ex: totais[ano][mes] = soma
  faturas.forEach(f => {
    if (!totais[f.ano]) totais[f.ano] = {};
    totais[f.ano][f.mes] = (totais[f.ano][f.mes] || 0) + Number(f.valorTransferencia || 0);
  });

  // 2) Eixo X (anos) e Y (meses)
  const anosAll = Object.keys(totais).map(n => Number(n)).sort((a,b)=>a-b);
  // Only keep years that have a previous year present in data
  const anos = anosAll.filter(a => totais[a - 1]);
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // 3) Função cor: mapeia -50% (vermelho) a +50% (verde), 0% = branco
  // clamp para [-0.5, +0.5] para a escala visual
  // color scale: -50% red → 0% light grey → +50% green
// color scale: -100% deep red → 0% light grey → +50% green
function pctToColor(p) {
  if (p === null) return '#f5f5f5'; // N/A
  const NEG_MIN = -1.0; // -100%
  const POS_MAX = 0.5;  // +50%

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
    <div class="heatmap-gradient"
     style="background: linear-gradient(90deg, #8b0000 0%, #ececec 50%, #28a745 100%);"></div>
      <span>-100%</span>
      <div class="heatmap-gradient"></div>
      <span>+50%</span>
      <span class="heatmap-muted" style="margin-left:12px;">(0% = cinza claro, N/A = vazio)</span>
    </div>
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