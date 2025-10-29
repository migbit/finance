// Análise 1248 — JS final
// Charts globais (acessíveis em todo o ficheiro)
window.chartTotal1248 = null;
window.chartOcupacao1248 = null;
window.chartVmReservas1248 = null;
window.chartCheckinsDiasSemana1248 = null;

// Importações Firebase
import { db } from './script.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', async () => {
  carregarTodosRelatorios1248();
});

async function carregarTodosRelatorios1248() {
  const firebaseFaturas = await carregarFaturas1248();
  const currentYear = new Date().getFullYear();

  const faturas = consolidarFaturas(firebaseFaturas)
    .filter(f => Number(f.ano) === 2024 || Number(f.ano) === currentYear);

  // define anos antes dos renders
  const anos = Array.from(new Set([2024, currentYear])).sort((a, b) => a - b);
  const ultimoAno = anos[anos.length - 1];
  const penultimoAno = anos.length > 1 ? anos[0] : 2024;

  // ✅ atualiza o título "Progresso vs ..."
  updateProgressTitle1248(penultimoAno);

  // ---- render em ordem ----
  gerarAnaliseFaturacao1248(faturas);         // gráfico + barras (só 1248)
  gerarHeatmapVariacao1248(faturas);          // heatmap sem legenda (só 1248)
  renderGraficoValorMedioReservasAno1248(faturas);
  renderTabelaComparativaAnos1248(faturas, 'tabela-comparativa-anos-1248');
  renderGraficoOcupacaoMensal1248(faturas);
  renderTabelaLimpeza1248(faturas, 'tabela-limpeza-1248');
  renderTabelaNoites1248(faturas, 'tabela-noites-1248');
  renderTabelaHospedes1248(faturas, 'tabela-hospedes-1248');
  renderCheckinsPorDiaSemana1248(faturas);
  updateDonuts1248(faturas, ultimoAno, penultimoAno);
}


function updateProgressTitle1248(penultimoAno) {
  const titleEl = document.getElementById('progress-title');
  if (titleEl) titleEl.textContent = `Progresso vs ${penultimoAno}`;
}


// Evita duplos: se houver reservas detalhadas (checkIn/noites/tipo='reserva')
// para (ano,mes,apartamento), ignora o registo mensal desse mês/apt.
function consolidarFaturas(arr) {
  const buckets = new Map();
  for (const f of arr) {
    const key = `${f.ano}-${f.mes}-${String(f.apartamento)}`;
    const isDetailed =
      (typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn)) ||
      Number(f.noites || 0) > 0 ||
      f.tipo === 'reserva';

    if (!buckets.has(key)) buckets.set(key, { detailed: [], manual: [] });
    const b = buckets.get(key);
    (isDetailed ? b.detailed : b.manual).push(f);
  }

  const out = [];
  for (const { detailed, manual } of buckets.values()) {
    if (detailed.length) out.push(...detailed);
    else out.push(...manual);
  }
  return out;
}


async function carregarFaturas1248() {
  try {
    const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Erro ao carregar faturas:", error);
    return [];
  }
}

function obterNomeMes(num) {
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const n = Math.max(1, Math.min(12, Number(num)));
  return nomes[n - 1];
}

// Formata inteiros em € (pt-PT)
const euroInt = (v) => {
  const num = Math.round(Number(v) || 0);
  return num.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
    useGrouping: true
  })
  .replace(/\./g, ' ') + ' €';
};


// total € de uma reserva (transferência + taxa Airbnb)
const _vm_totalReserva = f =>
  Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);


// --------------------------- Gráfico (Apt 1248)
function gerarAnaliseFaturacao1248(faturas) {
  if (chartTotal1248) {
    chartTotal1248.destroy();
    chartTotal1248 = null;
  }

  const currentYear = new Date().getFullYear();
  const anos = Array.from(new Set([2024, currentYear])).sort((a, b) => a - b);
  const ultimoAno = anos[anos.length - 1];
  const temAnterior = anos.length > 1;
  const penultimoAno = temAnterior ? anos[0] : 2024;

  function somaPor(ano, mes, apt) {
    return faturas
      .filter(f =>
        Number(f.ano) === Number(ano) &&
        Number(f.mes) === Number(mes) &&
        String(f.apartamento) === String(apt)
      )
      .reduce((s, f) => s + _vm_totalReserva(f), 0);
  }

  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const datasetsLine = [];
  if (temAnterior) {
    datasetsLine.push({
      label: `${anos[0]}`, // ano anterior
      data: labels.map((_, i) => somaPor(penultimoAno, i + 1, '1248')),
      borderDash: [4, 4],
      borderWidth: 1.5,
      borderColor: 'rgba(120,120,120,1)',
      backgroundColor: 'rgba(120,120,120,0.1)',
      pointRadius: 2,
      pointHoverRadius: 4
    });
  }

  datasetsLine.push({
    label: `${ultimoAno}`, // ano atual
    data: labels.map((_, i) => somaPor(ultimoAno, i + 1, '1248')),
    borderColor: '#EF8725',
    backgroundColor: 'rgba(239,135,37,0.15)',
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4
  });

  // Estilo igual ao 123: curva sem overshoot e segmentos a 0 sem curva
  datasetsLine.forEach(ds => Object.assign(ds, {
    cubicInterpolationMode: 'monotone',
    tension: 0.25,
    segment: {
      tension: ctx => (ctx.p0.parsed.y === 0 || ctx.p1.parsed.y === 0) ? 0 : 0.25
    }
  }));

  chartTotal1248 = new Chart(document.getElementById('chart-total'), {
    type: 'line',
    data: { labels, datasets: datasetsLine },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          beginAtZero: true,
          min: 0,
          max: 9000,
          ticks: { precision: 0, stepSize: 500 },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: true }
        }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });
 
  updateProgressTitle1248(penultimoAno);
}



// --------------- Donuts de Progresso (Apt 1248)

// css var
const cssVar = (name, fallback) =>
  (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;

// plugin center text (robusto)
const centerText = {
  id: 'centerText',
  afterDraw(chart, args, opts) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;
    const txt = opts.text || '';
    if (!txt) return;
    ctx.save();
    ctx.fillStyle = opts.color || '#0f172a';
    ctx.font = '600 14px Montserrat, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
    ctx.restore();
  }
};

function makeDonut(canvas, percentSigned) {
  if (!canvas) return null;

  // Evita canvases gigantes
  canvas.style.width = '160px';
  canvas.style.height = '160px';
  canvas.width = 160;
  canvas.height = 160;

  // destroy anterior se existir
  if (canvas._chart) { try { canvas._chart.destroy(); } catch {} }

  const val = Math.max(0, Math.min(100, Math.abs(percentSigned)));
  const ring = (percentSigned >= 0) ? cssVar('--ok', '#16a34a') : cssVar('--bad', '#e11d48');
  const formatted = val.toFixed(2); // 2 casas decimais no centro

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { datasets: [{ data: [val, 100 - val], backgroundColor: [ring, '#eef2f7'], borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      devicePixelRatio: 1,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        centerText: { text: `${percentSigned > 0 ? '+' : ''}${formatted}%`, color: ring }
      },
      animation: false
    },
    plugins: [centerText]
  });

  canvas._chart = chart;
  return chart;
}

function updateDonuts1248(faturas, ultimoAno, penultimoAno) {
  const APT = '1248';
  const somaAno = (ano, apt = APT) => faturas
    .filter(f => Number(f.ano) === Number(ano) && String(f.apartamento) === String(apt))
    .reduce((s, f) => s + _vm_totalReserva(f), 0);
// 1) Parcial do mês atual (Apt 1248)
{
  const mesAtual = new Date().getMonth() + 1;

  const cur = faturas
    .filter(f => Number(f.ano) === ultimoAno && Number(f.mes) === mesAtual && String(f.apartamento) === APT)
    .reduce((s,f) => s + _vm_totalReserva(f), 0);

  const ant = faturas
    .filter(f => Number(f.ano) === penultimoAno && Number(f.mes) === mesAtual && String(f.apartamento) === APT)
    .reduce((s,f) => s + _vm_totalReserva(f), 0);

  const base = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
  const diff = cur - ant;              // + = melhor que ano anterior
  const pct  = (diff / base) * 100;    // float, sem arredondar para evitar 0%

  const lblEl = document.getElementById('label-parcial');
  if (lblEl) lblEl.textContent = `Parcial ${obterNomeMes(mesAtual)}`;

  const txtEl = document.getElementById('donut-parcial-text');
  if (txtEl) txtEl.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;

  makeDonut(document.getElementById('donut-parcial'), pct);
}

// 2) Até mês anterior (acumulado, Apt 1248)
{
  const currentMonth = new Date().getMonth() + 1;

  const cur = faturas
    .filter(f => Number(f.ano) === ultimoAno && String(f.apartamento) === APT && Number(f.mes) < currentMonth)
    .reduce((s,f) => s + _vm_totalReserva(f), 0);

  const ant = faturas
    .filter(f => Number(f.ano) === penultimoAno && String(f.apartamento) === APT && Number(f.mes) < currentMonth)
    .reduce((s,f) => s + _vm_totalReserva(f), 0);

  const base = ant === 0 ? (cur === 0 ? 1 : cur) : ant;
  const diff = cur - ant;
  const pct  = (diff / base) * 100;

  const prevMonth = Math.max(1, currentMonth - 1);
  const lblEl = document.getElementById('label-ateset');
  if (lblEl) lblEl.textContent = `Até ${obterNomeMes(prevMonth)}`;

  const txtEl = document.getElementById('donut-ateset-text');
  if (txtEl) txtEl.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;

  makeDonut(document.getElementById('donut-ateset'), pct);
}

// 3) Ano atual vs anterior (total, Apt 1248)
{
  const atual = somaAno(ultimoAno, APT);
  const antes = somaAno(penultimoAno, APT);
  const base  = antes === 0 ? (atual === 0 ? 1 : atual) : antes;
  const diff  = atual - antes;
  const pct   = (diff / base) * 100;

  const lblEl = document.getElementById('label-vs');
  if (lblEl) lblEl.textContent = `${ultimoAno} vs ${penultimoAno}`;

  const txtEl = document.getElementById('donut-vs-text');
  if (txtEl) txtEl.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;

  makeDonut(document.getElementById('donut-vs'), pct);
}
}

// ---------------------------------------------------------> Gráfico ocupação

function renderGraficoOcupacaoMensal1248(faturas) {
  const APT = '1248';
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
    } ;


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
  'rgba(90,90,90,1)',     // 2025 (cinza escuro principal)
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

  const ctx = document.getElementById('chart-ocupacao-1248');
  if (!ctx) return;
  if (chartOcupacao1248) { chartOcupacao1248.destroy(); chartOcupacao1248 = null; }

chartOcupacao1248 = new Chart(ctx, {
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


// --------------------------- Heatmap (Apt 1248) — sem legenda
function gerarHeatmapVariacao1248(faturas) {
  const hoje = new Date();
  const CURR_YEAR = hoje.getFullYear();
  const CURR_MONTH = hoje.getMonth() + 1;

  const totais = {};
  faturas
    .filter(f => String(f.apartamento) === '1248')
    .forEach(f => {
      const ano = Number(f.ano), mes = Number(f.mes);
      if (!totais[ano]) totais[ano] = {};
      totais[ano][mes] = (totais[ano][mes] || 0) + _vm_totalReserva(f);
    });

  const anosAll = Object.keys(totais).map(n => Number(n)).sort((a,b)=>a-b);
  const anos    = anosAll.filter(a => totais[a - 1]);

  const wrap = document.getElementById('heatmap-variacao');
  if (!wrap) return;

  if (anos.length === 0) {
    wrap.innerHTML = `
      <div class="heatmap-wrap">
        <span class="heatmap-muted">
          Sem base do ano anterior (o heatmap começa quando existir base, p.ex. 2025 vs 2024).
        </span>
      </div>`;
    return;
  }

  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function pctToColor(p) {
    if (p === null) return '#f5f5f5';
    const NEG_MIN = -1.0, POS_MAX = 1.0;
    function lerp(a,b,t){ return a + (b-a)*t; }
    function hex(r,g,b){ return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`; }
    const deepRed = [139,0,0], mid = [236,236,236], green = [40,167,69];
    let c;
    if (p <= 0) {
      const clamped = Math.max(NEG_MIN, Math.min(0, Number(p)));
      let k = (clamped - NEG_MIN) / (0 - NEG_MIN);
      k = Math.pow(k, 0.65);
      c = [ lerp(deepRed[0], mid[0], k), lerp(deepRed[1], mid[1], k), lerp(deepRed[2], mid[2], k) ];
    } else {
      const clamped = Math.max(0, Math.min(POS_MAX, Number(p)));
      let k = clamped / POS_MAX;
      k = Math.pow(k, 0.9);
      c = [ lerp(mid[0], green[0], k), lerp(mid[1], green[1], k), lerp(mid[2], green[2], k) ];
    }
    return hex(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]));
  }
  function idealTextOn(bgHex) {
    const r = parseInt(bgHex.slice(1,3),16);
    const g = parseInt(bgHex.slice(3,5),16);
    const b = parseInt(bgHex.slice(5,7),16);
    const L = (0.299*r + 0.587*g + 0.114*b);
    return L < 160 ? '#fff' : '#111';
  }

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
      const prev = (totais[a - 1] && totais[a - 1][m] !== undefined) ? totais[a - 1][m] : null;
      const cur  = (totais[a]     && totais[a][m]     !== undefined) ? totais[a][m]     : null;

      if (a === CURR_YEAR && m > CURR_MONTH) {
      html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
      return; // ou "continue" num for normal
      }


      let pct = null;
      if (prev === null) {
        pct = null;
      } else if (prev === 0 && cur === 0) {
        pct = 0;
      } else if (prev === 0 && cur !== 0) {
        pct = null;
      } else {
        pct = (cur - prev) / prev;
      }
      if (pct === null) {
        html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
      } else {
        const bg = pctToColor(pct);
        const fg = idealTextOn(bg);
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

// --------------------------- Faturação Mensal por Ano (Apt 1248) — com Δ vs ano anterior
function renderTabelaComparativaAnos1248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2024;
  const CURR_YEAR = new Date().getFullYear();
  const anos = []; for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const totals = {}, nights = {};
  anos.forEach(a => {
    totals[a] = Array(12).fill(0);
    nights[a] = Array(12).fill(0);
  });

  // agrega só Apt 1248 (transferência + taxa Airbnb)
  faturas.forEach(f => {
    if (String(f.apartamento) !== '1248') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || mes < 1 || mes > 12) return;
    const v = Number(f.valorTransferencia || 0) + Number(f.taxaAirbnb || 0);
    const n = Number(f.noites || 0);
    totals[ano][mes - 1] += v;
    nights[ano][mes - 1] += Number.isFinite(n) ? n : 0;
  });

  const mostraMedia = {};
  anos.forEach(a => { mostraMedia[a] = nights[a].some(x => x > 0); });

  const yearBg = ['#fbfbff', '#e9ffebff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

  // célula Δ (verde +, vermelho −)
  const yoyCell = (cur, prev, bg) => {
    const diff = Math.round((Number(cur)||0) - (Number(prev)||0));
    if (diff === 0) return `<td style="background:${bg}; text-align:center; color:#555">€0</td>`;
    const color = diff > 0 ? '#28a745' : '#dc3545';
    const sign  = diff > 0 ? '+' : '−';
    return `<td style="background:${bg}; text-align:center; color:${color}"><strong>${sign} ${euroInt(Math.abs(diff))}</strong></td>`;
  };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${anos.map(a => {
            const span = (mostraMedia[a] ? 2 : 1) + (a > BASE_YEAR ? 1 : 0); // Δ só de 2025+
            return `<th colspan="${span}" style="text-align:center">${a}</th>`;
          }).join('')}
        </tr>
        <tr>
          ${anos.map(a => {
            const cols = [];
            if (mostraMedia[a]) cols.push(`<th style="text-align:center">Média</th>`);
            cols.push(`<th style="text-align:center">Total</th>`);
            if (a > BASE_YEAR) cols.push(`<th style="text-align:center">Δ</th>`);
            return cols.join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // linhas por mês
  meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
      const bg = yearBg[idx % yearBg.length];
      const tot = totals[a][i];
      const nts = nights[a][i];
      const media = nts > 0 ? Math.round(tot / nts) : null;

      if (mostraMedia[a]) html += `<td style="background:${bg}; text-align:center">${media != null ? euroInt(media) : '—'}</td>`;
      html += `<td style="background:${bg}; text-align:center">${euroInt(tot)}</td>`;

      // Δ vs ano anterior (só 2025+), ocultando meses futuros do ano atual
      if (a > BASE_YEAR) {
        const currentMonth = new Date().getMonth() + 1;
        if (a === CURR_YEAR && (i + 1) > currentMonth) {
          html += `<td style="background:${bg}; text-align:center; color:#999">€0</td>`;
        } else {
          const prevTot = totals[a - 1]?.[i] ?? 0;
          html += yoyCell(tot, prevTot, bg);
        }
      }

    });
    html += `</tr>`;
  });

  // Total anual + Δ
  html += `<tr><td><strong>Total</strong></td>`;
  anos.forEach((a, idx) => {
    const bg = yearBg[idx % yearBg.length];
    const totalAno = totals[a].reduce((s, v) => s + v, 0);

    const mediasMes = totals[a]
      .map((t, k) => (nights[a][k] > 0 ? t / nights[a][k] : null))
      .filter(v => v != null);
    const precoMedioAno = mediasMes.length
      ? Math.round(mediasMes.reduce((s, v) => s + v, 0) / mediasMes.length)
      : null;

    if (mostraMedia[a]) html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno != null ? euroInt(precoMedioAno) : '—'}</strong></td>`;
    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno)}</strong></td>`;

    if (a > BASE_YEAR) {
      const totalPrev = totals[a - 1]?.reduce?.((s, v) => s + v, 0) ?? 0;
      html += yoyCell(totalAno, totalPrev, bg);
    }
  });
  html += `</tr>`;

      // Média mensal (Total/12) + Δ
    html += `<tr><td><strong>Média mensal</strong></td>`;
    anos.forEach((a, idx) => {
      const bg = yearBg[idx % yearBg.length];
      const totalAno = totals[a].reduce((s, v) => s + v, 0);
      const mediaMensal = totalAno / 12;

      if (mostraMedia[a]) html += `<td style="background:${bg}; text-align:center">—</td>`;
      html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(mediaMensal)}</strong></td>`;

      if (a > BASE_YEAR) {
        const totalPrev = totals[a - 1]?.reduce?.((s, v) => s + v, 0) ?? 0;
        const mediaMensalPrev = totalPrev / 12;
        html += yoyCell(mediaMensal, mediaMensalPrev, bg);
      }
    });
    html += `</tr>`;


  html += `</tbody></table>`;
  el.innerHTML = html;
}


// ------------------------------------------------> Gráfico valor médio noite.

function renderGraficoValorMedioReservasAno1248(faturas) {
  const APT = '1248';
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
    if (chartVmReservas1248) { chartVmReservas1248.destroy(); chartVmReservas1248 = null; }
    return;
  }

  const labels = regs.map(r => r.checkIn);
  const data   = regs.map(r => Math.round(_vm_totalReserva(r) / Number(r.noites)));

  const ctx = document.getElementById('chart-vm-reservas-1248');
  if (!ctx) return;
  if (chartVmReservas1248) { chartVmReservas1248.destroy(); chartVmReservas1248 = null; }

  chartVmReservas1248 = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `€ por noite (${Y})`,
        data,
        borderColor: 'rgba(245,133,20,1)',   // laranja do 1248
        backgroundColor: 'rgba(245,133,20,1)',
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



// --------------------------- Taxa de Limpeza (Apt 1248) — só tabela
function renderTabelaLimpeza1248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2025;
  const CURR_YEAR = new Date().getFullYear();
  const anos = [];
  for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const limpeza = {};
  anos.forEach(ano => {
    limpeza[ano] = Array.from({ length: 12 }, () => ({ count: 0, total: 0 }));
  });

  faturas.forEach(f => {
    if (String(f.apartamento) !== '1248') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes) return;
    const v = Number(f.taxaLimpeza || 0);
    limpeza[ano][mes - 1].count += 1;
    limpeza[ano][mes - 1].total += v;
  });

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
      html += `<td style="text-align:center">${item.count}</td><td style="text-align:center">${euroInt(item.total)}</td>`;
    });
    html += `</tr>`;
  });

  html += `<tr><td><strong>Total</strong></td>`;
  anos.forEach(ano => {
    const totCount = limpeza[ano].reduce((s, m) => s + m.count, 0);
    const totVal   = limpeza[ano].reduce((s, m) => s + m.total, 0);
    html += `<td style="text-align:center"><strong>${totCount}</strong></td><td style="text-align:center"><strong>${euroInt(totVal)}</strong></td>`;
  });
  html += `</tr>`;

  html += `</tbody></table>`; // sem <hr> para evitar linha dupla
  el.innerHTML = html;
}

// --------------------------- Noites por Reserva (Apt 1248)
function renderTabelaNoites1248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const anoAtual = new Date().getFullYear();
  const anoInicial = 2025;
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = ['2','3','4','5','6','7','&ge;8'];

  const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '&ge;8' : String(v);
  };

  const mapa = Array.from({ length: 12 }, () =>
    Object.fromEntries(categorias.map(c => [c, 0]))
  );

  faturas.forEach(f => {
    if (String(f.apartamento) !== '1248') return;
    if (Number(f.ano) !== anoAtual) return;
    if (Number(f.ano) < anoInicial) return;
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
      const somaMes = categorias.reduce((s, c) => s + (linha[c] || 0), 0);
      totalAnoAtual += somaMes;
      categorias.forEach(c => { totaisAnoAtual[c] += (linha[c] || 0); });

      html += `
        <tr>
          <td>${nome}</td>
          ${categorias.map(c => `<td>${linha[c] || 0}</td>`).join('')}
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

  const anosAnteriores = Array.from(new Set(
    faturas.filter(f => String(f.apartamento) === '1248').map(f => Number(f.ano))
  ))
  .filter(a => a < anoAtual && a >= anoInicial)
  .sort((a, b) => b - a);

  anosAnteriores.forEach(ano => {
    const totaisAno = Object.fromEntries(categorias.map(c => [c, 0]));
    let totalAno = 0;

    faturas.forEach(f => {
      if (String(f.apartamento) !== '1248') return;
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

  html += `</tbody></table>`;
  el.innerHTML = html;
}

// --------------------------- Número de Hóspedes (Apt 1248) — título centrado
function renderTabelaHospedes1248(faturas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const BASE_YEAR = 2025;
  const Y = new Date().getFullYear();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = [1,2,3,4,5,6,7,8]; // 1..8 hosp

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
    if (String(f.apartamento) !== '1248') return;
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
      html += `<td style="text-align:center">${n}</td><td style="text-align:center">${showV}</td>`;
      // acumula totais do ano atual
      totaisAnoAtual.porHosp[h].n += n;
      totaisAnoAtual.porHosp[h].v += v;
      nMesTotal += n; vMesTotal += v;
    });

    totaisAnoAtual.total.n += nMesTotal;
    totaisAnoAtual.total.v += vMesTotal;

    html += `<td style="text-align:center"><strong>${nMesTotal}</strong></td><td style="text-align:center"><strong>${euroInt(vMesTotal)}</strong></td>`;
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
      .filter(f => String(f.apartamento) === '1248')
      .map(f => Number(f.ano))
  )).filter(a => a >= BASE_YEAR && a < Y).sort((a,b)=> b-a);

  anosAnteriores.forEach(ano => {
    const porHosp = Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }]));
    let totN = 0, totV = 0;

    faturas.forEach(f => {
      if (String(f.apartamento) !== '1248') return;
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

  html += `</tbody></table>`;
  el.innerHTML = html;
}



// --------------------------- Check-ins por dia da semana (Apt 1248)

function renderCheckinsPorDiaSemana1248(faturas) {
  const Y = new Date().getFullYear();
  const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const cont = [0,0,0,0,0,0,0];

  faturas.forEach(f => {
    if (String(f.apartamento) !== '1248') return;
    const s = f.checkIn; // 'YYYY-MM-DD'
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return;
    const ano = Number(s.slice(0,4));
    if (ano !== Y) return;

    const d = new Date(`${s}T00:00:00`);
    if (isNaN(d)) return;
    const idx = (d.getDay() + 6) % 7;
    cont[idx] += 1;
  });

  const ctx = document.getElementById('chart-checkins-dia-semana');
  if (!ctx) return;

  if (chartCheckinsDiasSemana1248) {
    chartCheckinsDiasSemana1248.destroy();
    chartCheckinsDiasSemana1248 = null;
  }

  chartCheckinsDiasSemana1248 = new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
    datasets: [{
      label: `Check-ins por dia (${Y})`,
      data: cont,
      backgroundColor: '#EF8725',
      borderColor: '#EF8725',
      borderWidth: 1,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
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
