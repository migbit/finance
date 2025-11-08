// analtotal-charts.js - All chart rendering functions
import {
obterNomeMes,
euroInt,
diasNoMes,
isoToDate,
isISO,
totalReserva,
sumByYearMonthApt
} from './analtotal-data.js';

// Store chart instances
const charts = {};
// Colors
const COLORS = {
'123': 'rgba(54,162,235,1)',
'1248': 'rgba(245,133,20,1)',
'combined': 'rgb(20, 78, 3)',
'previous': 'rgba(120,120,120,1)'
};
// Mobile responsive helper
const mqMobile = window.matchMedia('(max-width:1024px)');
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const MONTH_LABELS = MONTH_NUMBERS.map(obterNomeMes);
const APTS = ['123', '1248'];

function attachMobileXAxisRotation(chart, { rotateOnMobile = true, tightenBarsOnMobile = true } = {}) {
if (!chart) return;
function apply() {
    if (!chart || !chart.options) return;
    const isMobile = mqMobile.matches;

    const x = chart.options.scales?.x || (chart.options.scales.x = {});
    const xTicks = x.ticks || (x.ticks = {});
    const datasets = chart.options.datasets || (chart.options.datasets = {});
    const bar = datasets.bar || (datasets.bar = {});

    if (rotateOnMobile) {
        xTicks.autoSkip = !isMobile;
        xTicks.maxRotation = isMobile ? 90 : 0;
        xTicks.minRotation = isMobile ? 90 : 0;
        xTicks.padding = 4;
    }

    if (tightenBarsOnMobile) {
        bar.barPercentage = isMobile ? 0.7 : 0.85;
        bar.categoryPercentage = isMobile ? 0.8 : 0.9;
    }

    chart.update('none');
}

apply();
mqMobile.addEventListener?.('change', apply);
mqMobile.addListener?.(apply);
}
// Destroy chart if exists
function destroyChart(id) {
if (charts[id]) {
charts[id].destroy();
charts[id] = null;
}
}

function getSortedYears(faturas, aptFilter = null) {
return Array.from(new Set(
    faturas
        .filter(f => !aptFilter || aptFilter.includes(String(f.apartamento)))
        .map(f => Number(f.ano))
        .filter(Boolean)
)).sort((a, b) => a - b);
}

function mediaNoitePorMes(faturas, ano, aptList) {
return MONTH_NUMBERS.map(m => {
    let receita = 0;
    let noites = 0;
    faturas.forEach(f => {
        if (Number(f.ano) !== ano || Number(f.mes) !== m) return;
        if (!aptList.includes(String(f.apartamento))) return;
        receita += totalReserva(f);
        noites += Number(f.noites || 0);
    });
    return noites > 0 ? Math.round(receita / noites) : null;
});
}

function renderFaturacaoSingle(faturas, canvasId, apt) {
destroyChart(canvasId);

const anos = getSortedYears(faturas, [apt]);
if (!anos.length) return;
const anoAtual = anos[anos.length - 1];
const anoAnterior = anos.length > 1 ? anos[anos.length - 2] : null;

const dataAtual = MONTH_NUMBERS.map(m => sumByYearMonthApt(faturas, anoAtual, m, apt));
const dataAnterior = anoAnterior ? MONTH_NUMBERS.map(m => sumByYearMonthApt(faturas, anoAnterior, m, apt)) : null;

if (dataAtual.every(v => !v) && (!dataAnterior || dataAnterior.every(v => !v))) return;

const ctx = document.getElementById(canvasId);
if (!ctx) return;

const datasets = [{
    type: 'bar',
    label: String(anoAtual),
    data: dataAtual,
    backgroundColor: COLORS[apt] || COLORS.combined,
    borderColor: COLORS[apt] || COLORS.combined,
    borderWidth: 1,
    borderRadius: 4
}];

if (dataAnterior) {
    datasets.push({
        type: 'line',
        label: String(anoAnterior),
        data: dataAnterior,
        borderColor: COLORS.previous,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.25,
        spanGaps: true
    });
}

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels: MONTH_LABELS, datasets },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: (c) => ` ${c.dataset.label}: ${euroInt(c.parsed.y || 0)}`
                }
            }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.06)' },
                border: { display: false },
                ticks: {
                    callback: (value) => `€ ${Number(value || 0).toLocaleString('pt-PT')}`
                }
            }
        }
    }
});

attachMobileXAxisRotation(charts[canvasId], { rotateOnMobile: true, tightenBarsOnMobile: true });
}

export function renderFaturacaoCombined(faturas, canvasId) {
destroyChart(canvasId);

const anos = getSortedYears(faturas, APTS);
if (!anos.length) return;
const anoAtual = anos[anos.length - 1];

const data123 = MONTH_NUMBERS.map(m => sumByYearMonthApt(faturas, anoAtual, m, '123'));
const data1248 = MONTH_NUMBERS.map(m => sumByYearMonthApt(faturas, anoAtual, m, '1248'));

if (data123.every(v => !v) && data1248.every(v => !v)) return;

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: MONTH_LABELS,
        datasets: [
            { label: '123', data: data123, backgroundColor: COLORS['123'], stack: 'total' },
            { label: '1248', data: data1248, backgroundColor: COLORS['1248'], stack: 'total' }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: (c) => ` ${c.dataset.label}: ${euroInt(c.parsed.y || 0)}`,
                    footer: (items) => {
                        const total = items.reduce((sum, item) => sum + (item.parsed.y || 0), 0);
                        return ` Total: ${euroInt(total)}`;
                    }
                }
            }
        },
        scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
                stacked: true,
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.06)' },
                border: { display: false },
                ticks: { callback: (value) => `€ ${Number(value || 0).toLocaleString('pt-PT')}` }
            }
        }
    }
});

attachMobileXAxisRotation(charts[canvasId], { rotateOnMobile: true, tightenBarsOnMobile: true });
}

export function renderFaturacao123(faturas, canvasId) {
renderFaturacaoSingle(faturas, canvasId, '123');
}

export function renderFaturacao1248(faturas, canvasId) {
renderFaturacaoSingle(faturas, canvasId, '1248');
}

export function renderFaturacaoComparison(faturas, canvasId) {
destroyChart(canvasId);

const anos = getSortedYears(faturas, APTS);
if (!anos.length) return;

const today = new Date();
const baseYear = Math.min(...anos);

const lastDataPoint = faturas.reduce((acc, f) => {
    const ano = Number(f.ano);
    const mes = Number(f.mes);
    if (!APTS.includes(String(f.apartamento)) || !ano || !mes) return acc;
    if (ano > acc.year || (ano === acc.year && mes > acc.month)) {
        return { year: ano, month: mes };
    }
    return acc;
}, { year: baseYear, month: 1 });

const endYear = Math.max(lastDataPoint.year, today.getFullYear());

const seq = [];
for (let y = baseYear; y <= endYear; y++) {
    const limit =
        y < endYear
            ? 12
            : Math.max(
                y === lastDataPoint.year ? lastDataPoint.month : 0,
                y === today.getFullYear() ? today.getMonth() + 1 : 0,
                1
            );
    for (let m = 1; m <= limit; m++) {
        seq.push({ year: y, month: m });
    }
}

const labels = seq.map(({ year, month }) => `${obterNomeMes(month)}/${String(year).slice(-2)}`);
const data123 = seq.map(({ year, month }) => sumByYearMonthApt(faturas, year, month, '123'));
const data1248 = seq.map(({ year, month }) => sumByYearMonthApt(faturas, year, month, '1248'));

if (data123.every(v => !v) && data1248.every(v => !v)) return;

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
        labels,
        datasets: [
            {
                label: '123',
                data: data123,
                borderColor: COLORS['123'],
                backgroundColor: 'rgba(54,162,235,0.12)',
                tension: 0.2,
                pointRadius: 1.5,
                spanGaps: true
            },
            {
                label: '1248',
                data: data1248,
                borderColor: COLORS['1248'],
                backgroundColor: 'rgba(245,133,20,0.12)',
                tension: 0.2,
                pointRadius: 1.5,
                spanGaps: true
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${euroInt(c.parsed.y || 0)}` } }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 }
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.06)' },
                border: { display: false },
                ticks: { callback: (value) => `€ ${Number(value || 0).toLocaleString('pt-PT')}` }
            }
        }
    }
});
}

export function renderMediaNoiteCombined(faturas, canvasId) {
destroyChart(canvasId);

const anos = getSortedYears(faturas, APTS);
if (!anos.length) return;
const anoAtual = anos[anos.length - 1];
const anoAnterior = anos.length > 1 ? anos[anos.length - 2] : null;

const dataAtual = mediaNoitePorMes(faturas, anoAtual, APTS);
const dataAnterior = anoAnterior ? mediaNoitePorMes(faturas, anoAnterior, APTS) : null;

if (dataAtual.every(v => v == null) && (!dataAnterior || dataAnterior.every(v => v == null))) return;

const ctx = document.getElementById(canvasId);
if (!ctx) return;

const datasets = [{
    label: String(anoAtual),
    data: dataAtual,
    borderColor: COLORS.combined,
    backgroundColor: 'rgba(20,78,3,0.08)',
    borderWidth: 1.5,
    tension: 0.3,
    pointRadius: 2,
    spanGaps: true
}];

if (dataAnterior) {
    datasets.push({
        label: String(anoAnterior),
        data: dataAnterior,
        borderColor: COLORS.previous,
        backgroundColor: 'rgba(120,120,120,0.08)',
        borderWidth: 1.25,
        tension: 0.25,
        pointRadius: 2,
        spanGaps: true
    });
}

charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels: MONTH_LABELS, datasets },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: € ${c.parsed.y || 0}` } }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                beginAtZero: false,
                min: 0,
                grid: { color: 'rgba(0,0,0,0.06)' },
                border: { display: false },
                ticks: { precision: 0 }
            }
        }
    }
});
}

// Continue renderMediaNoite123
export function renderMediaNoite123(faturas, canvasId) {
destroyChart(canvasId);
const Y = new Date().getFullYear();
const todayISO = new Date().toISOString().slice(0,10);

const regs = faturas
    .filter(f => {
        if (String(f.apartamento) !== '123') return false;
        if (!isISO(f.checkIn)) return false;
        const anoIn  = Number(f.checkIn.slice(0,4));
        const noites = Number(f.noites || 0);
        if (noites <= 0) return false;
        if (f.checkIn > todayISO) return false;
        return anoIn === Y;
    })
    .sort((a,b) => a.checkIn.localeCompare(b.checkIn));

if (!regs.length) return;

const labels = regs.map(r => r.checkIn);
const data   = regs.map(r => Math.round(totalReserva(r) / Number(r.noites)));

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
        labels,
        datasets: [{
            label: `€ por noite (${Y})`,
            data,
            borderColor: COLORS['123'],
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
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
                        const d = new Date(`${s}T00:00:00`);
                        return `${String(d.getDate()).padStart(2,'0')} ${obterNomeMes(d.getMonth() + 1)}`;
                    },
                    label: (ctx) => ` € ${ctx.parsed.y}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: true },
                ticks: {
                    autoSkip: false,
                    callback: (val, idx) => {
                        const s = labels[idx];
                        const m = Number(s.slice(5,7));
                        const prev = labels[idx-1];
                        const pm = idx > 0 ? Number(prev?.slice(5,7)) : null;
                        if (idx === 0 || m !== pm) {
                            return obterNomeMes(m);
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
export function renderMediaNoite1248(faturas, canvasId) {
destroyChart(canvasId);
const Y = new Date().getFullYear();
const todayISO = new Date().toISOString().slice(0,10);

const regs = faturas
    .filter(f => {
        if (String(f.apartamento) !== '1248') return false;
        if (!isISO(f.checkIn)) return false;
        const anoIn  = Number(f.checkIn.slice(0,4));
        const noites = Number(f.noites || 0);
        if (noites <= 0) return false;
        if (f.checkIn > todayISO) return false;
        return anoIn === Y;
    })
    .sort((a,b) => a.checkIn.localeCompare(b.checkIn));

if (!regs.length) return;

const labels = regs.map(r => r.checkIn);
const data   = regs.map(r => Math.round(totalReserva(r) / Number(r.noites)));

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
        labels,
        datasets: [{
            label: `€ por noite (${Y})`,
            data,
            borderColor: COLORS['1248'],
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
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
                        const d = new Date(`${s}T00:00:00`);
                        return `${String(d.getDate()).padStart(2,'0')} ${obterNomeMes(d.getMonth() + 1)}`;
                    },
                    label: (ctx) => ` € ${ctx.parsed.y}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: true },
                ticks: {
                    autoSkip: false,
                    callback: (val, idx) => {
                        const s = labels[idx];
                        const m = Number(s.slice(5,7));
                        const prev = labels[idx-1];
                        const pm = idx > 0 ? Number(prev?.slice(5,7)) : null;
                        if (idx === 0 || m !== pm) {
                            return obterNomeMes(m);
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
export function renderMediaNoiteComparison(faturas, canvasId) {
destroyChart(canvasId);

const Y = new Date().getFullYear();

const receita = (apt, mes1_12) => faturas
    .filter(f => String(f.apartamento)===apt && Number(f.ano)===Y && Number(f.mes)===mes1_12)
    .reduce((s,f)=> s + totalReserva(f), 0);

const noites = (apt, mes1_12) => faturas
    .filter(f => String(f.apartamento)===apt && Number(f.ano)===Y && Number(f.mes)===mes1_12)
    .reduce((s,f)=> s + (Number(f.noites||0)), 0);

const medApt = (apt) => {
    const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return labels.map((_,i)=>{
        const tot = receita(apt, i+1); 
        const n = noites(apt, i+1);
        return n>0 ? Math.round(tot/n) : null;
    });
};

const data123  = medApt('123');
const data1248 = medApt('1248');

const ctx = document.getElementById(canvasId);
if(!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
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
// ========== OCUPAÇÃO CHARTS ==========
// Plugin for in-bar labels
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
            const y = bar.y + (bar.base - bar.y) / 2;

            let fill = '#333';
            const m = String(ds.backgroundColor).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (m) {
                const r = +m[1], g = +m[2], b = +m[3];
                const L = 0.299 * r + 0.587 * g + 0.114 * b;
                fill = (L < 140) ? '#fff' : '#333';
            }
            ctx.fillStyle = fill;

            const isMobile = window.matchMedia('(max-width:1024px)').matches;
            ctx.fillText(isMobile ? `${val}` : `${val}%`, x, y);
        });
    });

    ctx.restore();
}
};
export function renderOcupacaoCombined(faturas, canvasId) {
destroyChart(canvasId);
const BASE_YEAR = 2025;
const hoje = new Date();
const NUM_APTS = 2;

const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const clampCheckoutToToday = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    return d > tomorrow ? tomorrow : d;
};

const anos = Array.from(new Set(
    faturas
        .filter(f => (f.apartamento=='123' || f.apartamento=='1248') &&
                   typeof f.checkIn === 'string' &&
                   /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
        .map(f => Number(f.checkIn.slice(0,4)))
)).filter(y => y >= BASE_YEAR).sort((a,b)=>a-b);

if (!anos.length) return;

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

    co = clampCheckoutToToday(co);

    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        if (!ocup[y]) continue;
        ocup[y][m-1] += 1;
    }
});

const labels = nomesMes;
const palette = [
    'rgba(20, 78, 3, 1)',
    'rgba(36, 110, 8, 1)',
    'rgba(60, 140, 18, 1)',
    'rgba(95, 168, 45, 1)',
    'rgba(140, 190, 85, 1)',
];

const datasets = anos.map((y, idx) => {
    const dataPct = ocup[y].map((noitesMes, i) => {
        const denom = diasNoMes(y, i+1) * NUM_APTS;
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

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    plugins: [inBarLabels],
    data: { labels, datasets },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { display: false },
                border: { display: false },
                grid: { color: 'rgba(0,0,0,0.06)' }
            }
        }
    }
});

attachMobileXAxisRotation(charts[canvasId], { rotateOnMobile: true, tightenBarsOnMobile: true });

}
export function renderOcupacao123(faturas, canvasId) {
destroyChart(canvasId);

const APT = '123';
const BASE_YEAR = 2025;
const hoje = new Date();

const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const clampCheckoutToToday = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    return d > tomorrow ? tomorrow : d;
};

const anos = Array.from(new Set(
    faturas
        .filter(f => String(f.apartamento) === APT && typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
        .map(f => Number(f.checkIn.slice(0,4)))
)).filter(y => y >= BASE_YEAR).sort((a,b)=>a-b);

if (!anos.length) return;

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

    co = clampCheckoutToToday(co);

    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        if (!ocup[y]) continue;
        ocup[y][m-1] += 1;
    }
});

const labels = nomesMes;
const palette = [
    'rgba(90,90,90,1)',
    'rgba(120,120,120,1)',
    'rgba(150,150,150,1)',
    'rgba(180,180,180,1)',
    'rgba(210,210,210,1)',
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

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    plugins: [inBarLabels],
    data: { labels, datasets },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { display: false },
                border: { display: false },
                grid: { color: 'rgba(0,0,0,0.06)' }
            }
        }
    }
});

attachMobileXAxisRotation(charts[canvasId], { rotateOnMobile: true, tightenBarsOnMobile: true });

}
export function renderOcupacao1248(faturas, canvasId) {
destroyChart(canvasId);

const APT = '1248';
const BASE_YEAR = 2025;
const hoje = new Date();

const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const clampCheckoutToToday = (d) => {
    const tomorrow = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    return d > tomorrow ? tomorrow : d;
};

const anos = Array.from(new Set(
    faturas
        .filter(f => String(f.apartamento) === APT && typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
        .map(f => Number(f.checkIn.slice(0,4)))
)).filter(y => y >= BASE_YEAR).sort((a,b)=>a-b);

if (!anos.length) return;

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

    co = clampCheckoutToToday(co);

    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        if (!ocup[y]) continue;
        ocup[y][m-1] += 1;
    }
});

const labels = nomesMes;
const palette = [
    'rgba(90,90,90,1)',
    'rgba(120,120,120,1)',
    'rgba(150,150,150,1)',
    'rgba(180,180,180,1)',
    'rgba(210,210,210,1)',
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

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    plugins: [inBarLabels],
    data: { labels, datasets },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { display: false },
                border: { display: false },
                grid: { color: 'rgba(0,0,0,0.06)' }
            }
        }
    }
});

attachMobileXAxisRotation(charts[canvasId], { rotateOnMobile: true, tightenBarsOnMobile: true });

}
export function renderOcupacaoComparison(faturas, canvasId) {
destroyChart(canvasId);

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

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    plugins: [inBarLabels],
    data: {
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
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
// ========== CHECK-INS CHARTS ==========
export function renderCheckinsCombined(faturas, canvasId) {
destroyChart(canvasId);
const Y = new Date().getFullYear();
const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const toSegIdx = (dow0Sun) => (dow0Sun + 6) % 7;
const BASE_YEAR = 2025;
const todayISO = new Date().toISOString().slice(0,10);

const cont = [0,0,0,0,0,0,0];

faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (apt !== '123' && apt !== '1248') return;
    if (!isISO(f.checkIn)) return;
    if (f.checkIn > todayISO) return;

    const d = isoToDate(f.checkIn);
    const ano = d.getFullYear();
    if (ano !== Y || ano < BASE_YEAR) return;

    const idx = toSegIdx(d.getDay());
    cont[idx] += 1;
});

const ctx = document.getElementById(canvasId);
if (!ctx) return;

charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
        labels,
        datasets: [{
            label: `Check-ins (${Y})`,
            data: cont,
            backgroundColor: COLORS.combined,
            borderColor: COLORS.combined,
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
            x: { grid: { display: false } },
            y: {
                beginAtZero: true,
                ticks: { precision: 0 },
                grid: { color: 'rgba(0,0,0,0.06)' },
                border: { display: false }
            }
        }
    }
});

}
export function renderCheckinsComparison(faturas, canvasId) {
destroyChart(canvasId);

const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const toSegIdx = (dow0Sun) => (dow0Sun + 6) % 7;

const anosDisponiveis = [...new Set(
    faturas
        .filter(f => typeof f.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.checkIn))
        .map(f => Number(f.checkIn.slice(0,4)))
)].sort((a,b)=>a-b);

if (!anosDisponiveis.length) return;

const anoAtual = new Date().getFullYear();
const anoInicial = anosDisponiveis.includes(anoAtual) ? anoAtual : anosDisponiveis[anosDisponiveis.length-1];

const canvas = document.getElementById(canvasId);
if (!canvas) return;

// Navigation controls
let nav = document.getElementById('checkins-dow-nav');
if (!nav) return; // Should exist in HTML

const btnPrev = document.getElementById('btn-checkins-prev');
const btnNext = document.getElementById('btn-checkins-next');
const lblAno = document.getElementById('lbl-checkins-ano');

nav.dataset.min = String(anosDisponiveis[0]);
nav.dataset.max = String(anosDisponiveis[anosDisponiveis.length-1]);
nav.dataset.ano = String(anoInicial);

function draw(anoEscolhido){
    const cont = { '123': Array(7).fill(0), '1248': Array(7).fill(0) };
    faturas.forEach(f => {
        const apt = String(f.apartamento);
        if ((apt!=='123' && apt!=='1248') || !isISO(f.checkIn)) return;
        const d = isoToDate(f.checkIn);
        if (d.getFullYear() !== anoEscolhido) return;
        cont[apt][toSegIdx(d.getDay())] += 1;
    });

    destroyChart(canvasId);

    charts[canvasId] = new Chart(canvas, {
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
            layout: { padding: { bottom: 50, left: 4, right: 4, top: 4 } },
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

draw(Number(nav.dataset.ano));

}
// Export all chart functions
export { destroyChart, charts };
