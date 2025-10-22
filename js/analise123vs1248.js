// analise123vs1248.js — Comparação lado a lado (123 vs 1248)
// 1) Faturação mensal: timeline contínua (Jan 24 … Dez 25 … Jan 26 …)
// 2) Tabela comparativa por ano (123 Média | 1248 Média | 123 Total | 1248 Total)
// 3) Valor médio/noite, Ocupação, Check-ins

import { db } from './script.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Cores pedidas
const COLORS = {
  '123': 'rgba(54,162,235,1)',     // azul
  '1248': 'rgba(245,133,20,1)'     // laranja
};

// Dados manuais base 2024 (iguais aos de analise.js)
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

const euroInt = (v) => {
  const num = Math.round(Number(v) || 0);
  return num.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
    useGrouping: true
  })
  .replace(/\./g, ' ')  // pt-PT uses . for thousands → replace with space
  + ' €';               // Add space + € at the end (standard in Portugal)
};

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
  const all = await carregarFaturas();
  const Y = new Date().getFullYear();
  const lbl = document.getElementById('label-ano'); if (lbl) lbl.textContent = `(${Y})`;

  const faturas = all.concat(manualFaturasEstatica)
    .filter(f => Number(f.ano) === 2024 || Number(f.ano) === Y);

  renderGraficoFaturacaoMensal(faturas, Y);
  renderTabelaFaturacaoMensal(faturas, 'tabela-fat-mensal');
  renderGraficoMediaNoite(faturas, Y);
  renderGraficoOcupacao(faturas);
  renderGraficoCheckinsDOW(faturas);
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

function lockYAxis(chart, gutterEl) {
  if (!chart || !chart.scales || !chart.scales.y || !gutterEl) return;

  const yScale = chart.scales.y;
  const area   = chart.chartArea;
  const ticks  = yScale.ticks || [];
  const toPx   = (v) => yScale.getPixelForValue(v);

  // limpar e redesenhar
  gutterEl.innerHTML = '';
  // offset do chartArea para posicionar corretamente
  const topOffset = area ? area.top : 0;

  ticks.forEach(t => {
    const y = toPx(t.value);
    if (isFinite(y)) {
      const el = document.createElement('div');
      el.className = 'tick';
      el.style.top = `${y + Y_LOCK_OFFSET}px`;
      el.textContent = t.label ?? String(t.value);
      el.style.left = '0';
      el.style.right = '0';
      el.style.textAlign = 'left';
      gutterEl.appendChild(el);
    }
  });
}


// ------------------------ Faturação Mensal (timeline contínua) ------------------------
function renderGraficoFaturacaoMensal(faturas, ano /* compat */) {
  const BASE_YEAR = 2024;

  // último (ano, mês) com dados
  const maxFromData = faturas.reduce((acc, f) => {
    const a = Number(f.ano), m = Number(f.mes);
    if (!a || !m) return acc;
    if (a > acc.year || (a === acc.year && m > acc.month)) {
      return { year: a, month: m };
    }
    return acc;
  }, { year: BASE_YEAR, month: 1 });

  const today = new Date();
  const currYM = { year: today.getFullYear(), month: today.getMonth() + 1 };

  // fim do range = mais recente entre dados e data atual
  const end = (maxFromData.year > currYM.year ||
              (maxFromData.year === currYM.year && maxFromData.month > currYM.month))
              ? maxFromData : currYM;

  const labels = [];          // [['Jan','25'], ['Fev','25'], ...]
  const seq = [];             // [{year, month}, ...]
  for (let y = BASE_YEAR; y <= end.year; y++) {
    const mEnd = (y === end.year) ? end.month : 12;
    for (let m = 1; m <= mEnd; m++) {
      labels.push([mesesPT[m - 1], String(y).slice(-2)]); // mês em cima, ano (2 dígitos) em baixo
      seq.push({ year: y, month: m });
    }
  }

  const sumMesApt = (apt, y, m) => faturas
    .filter(f => String(f.apartamento) === String(apt) && Number(f.ano) === y && Number(f.mes) === m)
    .reduce((s, f) => s + (Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0)), 0);

  const data123  = seq.map(({ year, month }) => sumMesApt('123',  year, month));
  const data1248 = seq.map(({ year, month }) => sumMesApt('1248', year, month));

  // canvas e limpeza
  const canvas = document.getElementById('chart-fat-mensal');
  if (!canvas) return;
  if (gFatMensal) { gFatMensal.destroy(); gFatMensal = null; }

  // helper local para desenhar os valores do eixo-Y no gutter fixo
  function lockYAxisLocal(chart, gutterEl) {
    try {
      if (!chart || !chart.scales || !chart.scales.y || !gutterEl) return;
      const yScale = chart.scales.y;
      const area = chart.chartArea;
      const ticks = yScale.ticks || [];
      const topOffset = area?.top ?? 0; // corrige deslocamento vertical
      gutterEl.innerHTML = '';

      ticks.forEach(t => {
        const y = yScale.getPixelForValue(t.value);
        if (isFinite(y)) {
          const el = document.createElement('div');
          el.className = 'tick';
          el.style.top = `${y + topOffset - area.top + 5}px`; // leve ajuste (+2)
          el.style.left = '0';
          el.style.right = '0';
          el.style.fontSize = '12px';
          el.style.color = '#333';
          el.style.paddingLeft = '6px';
          el.textContent = t.label ?? String(t.value);
          gutterEl.appendChild(el);
        }
      });
    } catch (_) { /* no-op */ }
  }


  // encontrar/forçar wrapper e estrutura do scroller + gutter
  const outer =
    canvas.closest('.chart-wrap') ||
    canvas.closest('.chart-wrap-480') ||
    canvas.closest('.chart-wrapper') ||
    canvas.parentElement;

  let scroller = null;
  let ylock = null;

  if (outer) {
    if (!outer.classList.contains('has-y-lock')) {
      outer.classList.add('has-y-lock');

      ylock = document.createElement('div');
      ylock.className = 'y-lock';
      // fallback mínimo de estilos se o CSS ainda não estiver carregado
      ylock.style.position = 'absolute';
      ylock.style.left = '0';
      ylock.style.top = '0';
      ylock.style.bottom = '0';
      ylock.style.width = '56px';
      ylock.style.borderRight = '1px solid #e7e7e7';
      ylock.style.background = '#fff';
      ylock.style.pointerEvents = 'none';

      scroller = document.createElement('div');
      scroller.className = 'scroller';
      scroller.style.overflowX = 'auto';
      scroller.style.overflowY = 'hidden';
      scroller.style.height = '100%';
      scroller.style.marginLeft = '56px';
      scroller.style.webkitOverflowScrolling = 'touch';

      // inserir estrutura e mover canvas
      outer.insertBefore(ylock, canvas);
      outer.insertBefore(scroller, canvas);
      scroller.appendChild(canvas);
    } else {
      scroller = outer.querySelector('.scroller') || outer;
      ylock = outer.querySelector('.y-lock');
    }

    // garantir scroll no contentor
    outer.style.position = 'relative';
    scroller.style.overflowX = 'auto';
    scroller.style.overflowY = 'hidden';
  }

  // largura mínima por mês, ativando scroll quando necessário
  /* garante que não há largura forçada */
  canvas.style.width = '100%';
  canvas.style.minWidth = '0';

  const pxPerLabel = 48; // afina entre 40–56
  const container = scroller || outer || canvas.parentElement;
  const available = (container && container.clientWidth) ? container.clientWidth : 0;
  const needed = (labels.length * pxPerLabel);

  // não encolhe abaixo da largura do contentor; só cresce quando precisar
  canvas.style.width = '100%';
  canvas.style.minWidth = Math.max(available, needed) + 'px';

  // datasets e options
  const data = {
    labels,
    datasets: [
      { label: '123',  data: data123,  backgroundColor: COLORS['123'],  barPercentage: 0.7, categoryPercentage: 0.8 },
      { label: '1248', data: data1248, backgroundColor: COLORS['1248'], barPercentage: 0.7, categoryPercentage: 0.8 },
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 0,
    layout: { padding: { left: 0, right: 0, top: 12, bottom: 0 } },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${euroInt(c.parsed.y)}` } }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          font: { size: 11 },
        },
      },
      y: {
        beginAtZero: true,
        ticks: { display: false, precision: 0 }, // escondemos os valores aqui (vão no gutter fixo)
        grid: { color: 'rgba(0,0,0,0.06)' },
        border: { display: false },
      }
    },
    animation: {}
  };

  // criar chart e ligar “Y fixo”
  const ctx = canvas.getContext('2d');
  gFatMensal = new Chart(ctx, { type: 'bar', data, options });

  const Y_LOCK_OFFSET = 1; // afina entre 1–4 px para alinhar à vista

  const redrawY = () => {
    if (ylock) lockYAxisLocal(gFatMensal, ylock);
  };

  // redesenha valores Y ao terminar a animação
  gFatMensal.options.animation.onComplete = redrawY;

  // override update para voltar a desenhar o gutter depois de cada update
  const _update = gFatMensal.update.bind(gFatMensal);
  gFatMensal.update = (...args) => { const rv = _update(...args); redrawY(); return rv; };

  // redesenhar no resize
  window.addEventListener('resize', () => { redrawY(); }, { passive: true });

  // primeira renderização + gutter
  gFatMensal.update();
}




// ------------------------ Tabela comparativa (anos x apt) -----------------------------
// Ordem por ano: 123 Média | 1248 Média | 123 Total | 1248 Total

// ------------------------ Tabela comparativa (anos x apt) -----------------------------
// Ordem por ano: 123 Média | 1248 Média | 123 Total | 1248 Total | Dif.
function renderTabelaFaturacaoMensal(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2024;
  const CURR_YEAR = new Date().getFullYear();
  const anos = []; for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);
  const APTS = ['123','1248'];

  const totals = {}; const nights = {};
  anos.forEach(a => {
    totals[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
    nights[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
  });

  faturas.forEach(f => {
    const apt = String(f.apartamento); if (!APTS.includes(apt)) return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;
    const v = Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
    const n = Number(f.noites || 0);
    totals[ano][apt][mes - 1] += v;
    nights[ano][apt][mes - 1] += Number.isFinite(n) ? n : 0;
  });

  const mostraMedia = {};
  anos.forEach(a => {
    mostraMedia[a] = {
      '123': nights[a]['123'].some(x => x > 0),
      '1248': nights[a]['1248'].some(x => x > 0),
    };
  });

  const yearBg = ['#fbfbff', '#e9ffebff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

  // helper para célula de diferença
  const diffCell = (v123, v1248, bg) => {
    const d = Math.abs((Number(v123)||0) - (Number(v1248)||0));
    const who = (v123 > v1248) ? '123' : (v1248 > v123) ? '1248' : 'eq';
    const cls = who === '123' ? 'apt-123' : who === '1248' ? 'apt-1248' : '';
    const title = who === 'eq' ? 'Igual' : `Maior: ${who}`;
    return `<td style="background:${bg}; text-align:center" title="${title}"><strong class="${cls}">${euroInt(d)}</strong></td>`;
  };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${anos.map(a => {
            const cols123  = mostraMedia[a]['123']  ? 2 : 1;
            const cols1248 = mostraMedia[a]['1248'] ? 2 : 1;
            const span = cols123 + cols1248 + 1; // +1 pela coluna Dif.
            return `<th colspan="${span}" style="text-align:center">${a}</th>`;
          }).join('')}
        </tr>
        <tr>
          ${anos.map((a) => {
            const parts = [];
            if (mostraMedia[a]['123'])  parts.push(`<th class="apt-123" style="text-align:center">123 Média</th>`);
            if (mostraMedia[a]['1248']) parts.push(`<th class="apt-1248" style="text-align:center">1248 Média</th>`);
            parts.push(`<th class="apt-123" style="text-align:center">123 Total</th>`);
            parts.push(`<th class="apt-1248" style="text-align:center">1248 Total</th>`);
            parts.push(`<th style="text-align:center">Dif.</th>`); // nova coluna
            return parts.join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // linhas por mês
  mesesPT.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
      const bg = yearBg[idx % yearBg.length];

      const tot123 = totals[a]['123'][i];
      const nts123 = nights[a]['123'][i];
      const med123 = (nts123 > 0) ? Math.round(tot123 / nts123) : null;

      const tot1248 = totals[a]['1248'][i];
      const nts1248 = nights[a]['1248'][i];
      const med1248 = (nts1248 > 0) ? Math.round(tot1248 / nts1248) : null;

      if (mostraMedia[a]['123'])
        html += `<td style="background:${bg}; text-align:center">${med123 != null ? euroInt(med123) : '—'}</td>`;
      if (mostraMedia[a]['1248'])
        html += `<td style="background:${bg}; text-align:center">${med1248 != null ? euroInt(med1248) : '—'}</td>`;

      html += `<td style="background:${bg}; text-align:center">${euroInt(tot123)}</td>`;
      html += `<td style="background:${bg}; text-align:center">${euroInt(tot1248)}</td>`;
      html += diffCell(tot123, tot1248, bg); // nova célula Dif.
    });
    html += `</tr>`;
  });

  // linha Total (com média/noite no espaço de "Média", quando existir) + Dif.
  html += `<tr><td><strong>Total</strong></td>`;
  anos.forEach((a, idx) => {
    const bg = yearBg[idx % yearBg.length];

    const totalAno123  = totals[a]['123'].reduce((s, v) => s + v, 0);
    const totalAno1248 = totals[a]['1248'].reduce((s, v) => s + v, 0);

    const mediasMes123 = totals[a]['123']
      .map((t, k) => (nights[a]['123'][k] > 0 ? t / nights[a]['123'][k] : null))
      .filter(v => v != null);
    const precoMedioAno123 = mediasMes123.length
      ? Math.round(mediasMes123.reduce((s, v) => s + v, 0) / mediasMes123.length)
      : null;

    const mediasMes1248 = totals[a]['1248']
      .map((t, k) => (nights[a]['1248'][k] > 0 ? t / nights[a]['1248'][k] : null))
      .filter(v => v != null);
    const precoMedioAno1248 = mediasMes1248.length
      ? Math.round(mediasMes1248.reduce((s, v) => s + v, 0) / mediasMes1248.length)
      : null;

    if (mostraMedia[a]['123'])
      html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno123 != null ? euroInt(precoMedioAno123) : '—'}</strong></td>`;
    if (mostraMedia[a]['1248'])
      html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno1248 != null ? euroInt(precoMedioAno1248) : '—'}</strong></td>`;

    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno123)}</strong></td>`;
    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno1248)}</strong></td>`;
    html += diffCell(totalAno123, totalAno1248, bg); // Dif. anual
  });
  html += `</tr>`;

  // linha Média mensal (totais/12) + Dif.
  html += `<tr><td><strong>Média mensal</strong></td>`;
  anos.forEach((a, idx) => {
    const bg = yearBg[idx % yearBg.length];

    // colunas "Média" (vazias) para alinhamento
    if (mostraMedia[a]['123'])  html += `<td style="background:${bg}; text-align:center">—</td>`;
    if (mostraMedia[a]['1248']) html += `<td style="background:${bg}; text-align:center">—</td>`;

    const totalAno123  = totals[a]['123'].reduce((s, v) => s + v, 0);
    const totalAno1248 = totals[a]['1248'].reduce((s, v) => s + v, 0);

    const m123  = totalAno123 / 12;
    const m1248 = totalAno1248 / 12;

    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(m123)}</strong></td>`;
    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(m1248)}</strong></td>`;
    html += diffCell(m123, m1248, bg); // Dif. média mensal
  });
  html += `</tr>`;

  html += `</tbody></table>`;
  el.innerHTML = html;
}


// ------------------------ Valor médio/noite (linhas: 123 vs 1248) ----------------------
function renderGraficoMediaNoite(faturas, ano){
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

function renderGraficoOcupacao(faturas) {
  const Y = new Date().getFullYear();
  const hoje = new Date();
  const clampCO = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    return d > tomorrow ? tomorrow : d;
  };

  const noitesMap = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };

  faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (apt !== '123' && apt !== '1248') return;
    if (!isISO(f.checkIn)) return;

    const ci = isoToDate(f.checkIn);
    if (ci.getFullYear() !== Y) return;

    const n = Number(f.noites || 0);
    if (!Number.isFinite(n) || n <= 0) return;

    let co = isISO(f.checkOut)
      ? isoToDate(f.checkOut)
      : new Date(ci.getFullYear(), ci.getMonth(), ci.getDate() + n);
    co = clampCO(co);

    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() !== Y) continue;
      const m = d.getMonth();
      noitesMap[apt][m] += 1;
    }
  });

  const diasDen = (m) => diasNoMes(Y, m + 1);
  const pct = (apt) => noitesMap[apt].map((noites, m) => {
    const den = diasDen(m);
    return den ? Math.round((noites / den) * 100) : 0;
  });

  // Plugin para % dentro das barras
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
          if (!val) return;
          const x = bar.x;
          const y = bar.y + (bar.base - bar.y) / 2;
          let fill = '#333';
          const m = String(ds.backgroundColor).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) {
            const [r, g, b] = [+m[1], +m[2], +m[3]];
            const L = 0.299 * r + 0.587 * g + 0.114 * b;
            fill = L < 140 ? '#fff' : '#333';
          }
          ctx.fillStyle = fill;
          ctx.fillText(`${val}%`, x, y);
        });
      });
      ctx.restore();
    }
  };

  const ctx = document.getElementById('chart-ocupacao');
  if (!ctx) return;
  if (gOcupacao) { gOcupacao.destroy(); gOcupacao = null; }

  gOcupacao = new Chart(ctx, {
    type: 'bar',
    plugins: [inBarLabels],
    data: {
      labels: mesesPT,
      datasets: [
        { label: '123', data: pct('123'), backgroundColor: COLORS['123'], barPercentage: 0.85, categoryPercentage: 0.9 },
        { label: '1248', data: pct('1248'), backgroundColor: COLORS['1248'], barPercentage: 0.85, categoryPercentage: 0.9 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y}%` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        }
      }
    }
  });
}



// ------------------------ Check-ins por dia da semana (barras) -------------------------
function renderGraficoCheckinsDOW(faturas){
  const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const toSegIdx = (dow0Sun) => (dow0Sun + 6) % 7; // 0=Seg .. 6=Dom

  // anos disponíveis (pelo check-in)
  const anosDisponiveis = [...new Set(
    faturas
      .filter(f => typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
      .map(f => Number(f.checkIn.slice(0,4)))
  )].sort((a,b)=>a-b);

  if (!anosDisponiveis.length) return;

  const anoAtual = new Date().getFullYear();
  const anoInicial = anosDisponiveis.includes(anoAtual) ? anoAtual : anosDisponiveis[anosDisponiveis.length-1];

  const canvas = document.getElementById('chart-checkins-dow');
  if (!canvas) return;

  // criar barra de navegação (se não existir)
  let nav = document.getElementById('checkins-dow-nav');
  if (!nav) {
    nav = document.createElement('div');
    nav.id = 'checkins-dow-nav';
    nav.style.cssText = 'display:flex;gap:.5rem;justify-content:flex-end;align-items:center;margin:.25rem 0 .5rem;';
    nav.innerHTML = `
      <button id="btn-checkins-prev" type="button" aria-label="Ano anterior">◀︎</button>
      <span id="lbl-checkins-ano" style="font-weight:600"></span>
      <button id="btn-checkins-next" type="button" aria-label="Ano seguinte">▶︎</button>
    `;
    // inserir antes do canvas
    canvas.parentElement.insertBefore(nav, canvas);
  }

  const btnPrev = document.getElementById('btn-checkins-prev');
  const btnNext = document.getElementById('btn-checkins-next');
  const lblAno = document.getElementById('lbl-checkins-ano');

  // estado no próprio nav
  nav.dataset.min = String(anosDisponiveis[0]);
  nav.dataset.max = String(anosDisponiveis[anosDisponiveis.length-1]);
  nav.dataset.ano = String(anoInicial);

  function draw(anoEscolhido){
    // contagens por DOW e apt
    const cont = { '123': Array(7).fill(0), '1248': Array(7).fill(0) };
    faturas.forEach(f => {
      const apt = String(f.apartamento);
      if ((apt!=='123' && apt!=='1248') || !isISO(f.checkIn)) return;
      const d = isoToDate(f.checkIn);
      if (d.getFullYear() !== anoEscolhido) return;
      cont[apt][toSegIdx(d.getDay())] += 1;
    });

    const ctx = canvas;
    if (gCheckins){ gCheckins.destroy(); gCheckins = null; }

    gCheckins = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'123',  data: cont['123'],  backgroundColor: COLORS['123'],  barPercentage: 0.8, categoryPercentage: 0.9 },
          { label:'1248', data: cont['1248'], backgroundColor: COLORS['1248'], barPercentage: 0.8, categoryPercentage: 0.9 }
        ]
      },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 50, left: 4, right: 4, top: 4 } }, // evita cortar labels
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { color: '#222', boxWidth: 12, font: { size: 12 } }
        },
        tooltip: { callbacks: { title: items => `${items[0].label} ${anoEscolhido}` } }
      },
      scales: {
        x: { 
          grid: { display: false },
          ticks: { color: '#222', font: { size: 12 }, padding: 6, maxRotation: 0, autoSkip: false }
        },
        y: { 
         beginAtZero: true,
          ticks: { color: '#222', precision: 0, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
       }
     }
    }

    });

    // UI
    nav.dataset.ano = String(anoEscolhido);
    lblAno.textContent = anoEscolhido;
    const min = Number(nav.dataset.min), max = Number(nav.dataset.max);
    btnPrev.disabled = (anoEscolhido <= min);
    btnNext.disabled = (anoEscolhido >= max);
  }

  btnPrev.onclick = () => {
    const curr = Number(nav.dataset.ano);
    const min = Number(nav.dataset.min);
    const next = Math.max(min, curr - 1);
    if (next !== curr) draw(next);
  };

  btnNext.onclick = () => {
    const curr = Number(nav.dataset.ano);
    const max = Number(nav.dataset.max);
    const next = Math.min(max, curr + 1);
    if (next !== curr) draw(next);
  };

  // render inicial
  draw(Number(nav.dataset.ano));
}
