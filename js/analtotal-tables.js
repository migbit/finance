// analtotal-tables.js - All table rendering functions
import { obterNomeMes, euroInt, bucketNoites, extraValor, totalReserva } from './analtotal-data.js';
// ========== FATURAÇÃO TABLES ==========
export function renderTabelaFaturacaoCombined(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2024;
const CURR_YEAR = new Date().getFullYear();
const anos = []; 
for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const APTS = ['123', '1248'];

const totals = {};
const nights = {};
anos.forEach(a => {
    totals[a] = Array(12).fill(0);
    nights[a] = Array(12).fill(0);
});

faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (!APTS.includes(apt)) return;

    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;

    const v = totalReserva(f);
    const n = Number(f.noites || 0);

    totals[ano][mes - 1] += v;
    nights[ano][mes - 1] += Number.isFinite(n) ? n : 0;
});

const mostraMedia = {};
anos.forEach(a => { mostraMedia[a] = nights[a].some(x => x > 0); });

const yearBg = ['#fbfbff', '#e9ffebff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

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
                    const span = (mostraMedia[a] ? 2 : 1) + (a > BASE_YEAR ? 1 : 0);
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

const currentMonth = new Date().getMonth() + 1;

meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
        const bg = yearBg[idx % yearBg.length];
        const tot = totals[a][i];
        const nts = nights[a][i];
        const media = (nts > 0) ? Math.round(tot / nts) : null;

        if (mostraMedia[a])
            html += `<td style="background:${bg}; text-align:center">${media != null ? euroInt(media) : '—'}</td>`;

        html += `<td style="background:${bg}; text-align:center">${euroInt(tot)}</td>`;

        if (a > BASE_YEAR) {
            if (a === CURR_YEAR && (i + 1) > currentMonth) {
                html += `<td style="background:${bg}; text-align:center; color:#999">€0</td>`;
            } else {
                html += yoyCell(totals[a][i], totals[a - 1]?.[i] ?? 0, bg);
            }
        }
    });
    html += `</tr>`;
});

// Total anual
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

    if (mostraMedia[a])
        html += `<td style="background:${bg}; text-align:center"><strong>${precoMedioAno != null ? euroInt(precoMedioAno) : '—'}</strong></td>`;

    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totalAno)}</strong></td>`;

    if (a > BASE_YEAR) {
        const totalPrev = totals[a - 1]?.reduce?.((s, v) => s + v, 0) ?? 0;
        html += yoyCell(totalAno, totalPrev, bg);
    }
});
html += `</tr>`;

// Média mensal
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
export function renderTabelaFaturacao123(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2024;
const CURR_YEAR = new Date().getFullYear();
const anos = [];
for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const totals = {}, nights = {};
anos.forEach(a => {
    totals[a] = Array(12).fill(0);
    nights[a] = Array(12).fill(0);
});

faturas.forEach(f => {
    if (String(f.apartamento) !== '123') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || mes < 1 || mes > 12) return;
    const v = totalReserva(f);
    const n = Number(f.noites || 0);
    totals[ano][mes - 1] += v;
    nights[ano][mes - 1] += Number.isFinite(n) ? n : 0;
});

const mostraMedia = {};
anos.forEach(a => { mostraMedia[a] = nights[a].some(x => x > 0); });

const yearBg = ['#fbfbff', '#e9ffebff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

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
                    const span = (mostraMedia[a] ? 2 : 1) + (a > BASE_YEAR ? 1 : 0);
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

const currentMonth = new Date().getMonth() + 1;

meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
        const bg = yearBg[idx % yearBg.length];
        const tot = totals[a][i];
        const nts = nights[a][i];
        const media = nts > 0 ? Math.round(tot / nts) : null;

        if (mostraMedia[a]) html += `<td style="background:${bg}; text-align:center">${media != null ? euroInt(media) : '—'}</td>`;
        html += `<td style="background:${bg}; text-align:center">${euroInt(tot)}</td>`;

        if (a > BASE_YEAR) {
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

// Total anual
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

// Média mensal
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
export function renderTabelaFaturacao1248(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2024;
const CURR_YEAR = new Date().getFullYear();
const anos = [];
for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const totals = {}, nights = {};
anos.forEach(a => {
    totals[a] = Array(12).fill(0);
    nights[a] = Array(12).fill(0);
});

faturas.forEach(f => {
    if (String(f.apartamento) !== '1248') return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || mes < 1 || mes > 12) return;
    const v = totalReserva(f);
    const n = Number(f.noites || 0);
    totals[ano][mes - 1] += v;
    nights[ano][mes - 1] += Number.isFinite(n) ? n : 0;
});

const mostraMedia = {};
anos.forEach(a => { mostraMedia[a] = nights[a].some(x => x > 0); });

const yearBg = ['#fbfbff', '#e9ffebff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

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
                    const span = (mostraMedia[a] ? 2 : 1) + (a > BASE_YEAR ? 1 : 0);
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

const currentMonth = new Date().getMonth() + 1;

meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anos.forEach((a, idx) => {
        const bg = yearBg[idx % yearBg.length];
        const tot = totals[a][i];
        const nts = nights[a][i];
        const media = nts > 0 ? Math.round(tot / nts) : null;

        if (mostraMedia[a]) html += `<td style="background:${bg}; text-align:center">${media != null ? euroInt(media) : '—'}</td>`;
        html += `<td style="background:${bg}; text-align:center">${euroInt(tot)}</td>`;

        if (a > BASE_YEAR) {
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

// Total anual
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

// Média mensal
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
export function renderTabelaFaturacaoComparison(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2024;
const CURR_YEAR = new Date().getFullYear();
const anos = [];
for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);
const APTS = ['123','1248'];

const totals = {}; const nights = {};
anos.forEach(a => {
    totals[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
    nights[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
});

faturas.forEach(f => {
    const apt = String(f.apartamento); 
    if (!APTS.includes(apt)) return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;
    const v = totalReserva(f);
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

const diffCell = (v123, v1248, bg) => {
    const d = Math.abs((Number(v123)||0) - (Number(v1248)||0));
    const who = (v123 > v1248) ? '123' : (v1248 > v123) ? '1248' : 'eq';
    const cls = who === '123' ? 'apt-123' : who === '1248' ? 'apt-1248' : '';
    const title = who === 'eq' ? 'Igual' : `

export function renderTabelaFaturacaoComparison(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;
const BASE_YEAR = 2024;
const CURR_YEAR = new Date().getFullYear();
const anos = [];
for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);
const APTS = ['123','1248'];

const totals = {}; const nights = {};
anos.forEach(a => {
    totals[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
    nights[a] = { '123': Array(12).fill(0), '1248': Array(12).fill(0) };
});

faturas.forEach(f => {
    const apt = String(f.apartamento); 
    if (!APTS.includes(apt)) return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if (!anos.includes(ano) || !mes || mes < 1 || mes > 12) return;
    const v = totalReserva(f);
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
                    const span = cols123 + cols1248 + 1;
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
                    parts.push(`<th style="text-align:center">Dif.</th>`);
                    return parts.join('');
                }).join('')}
            </tr>
        </thead>
        <tbody>
`;

const mesesPT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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
        html += diffCell(tot123, tot1248, bg);
    });
    html += `</tr>`;
});

// Total
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
    html += diffCell(totalAno123, totalAno1248, bg);
});
html += `</tr>`;

// Média mensal
html += `<tr><td><strong>Média mensal</strong></td>`;
anos.forEach((a, idx) => {
    const bg = yearBg[idx % yearBg.length];

    if (mostraMedia[a]['123'])  html += `<td style="background:${bg}; text-align:center">—</td>`;
    if (mostraMedia[a]['1248']) html += `<td style="background:${bg}; text-align:center">—</td>`;

    const totalAno123  = totals[a]['123'].reduce((s, v) => s + v, 0);
    const totalAno1248 = totals[a]['1248'].reduce((s, v) => s + v, 0);

    const m123  = totalAno123 / 12;
    const m1248 = totalAno1248 / 12;

    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(m123)}</strong></td>`;
    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(m1248)}</strong></td>`;
    html += diffCell(m123, m1248, bg);
});
html += `</tr>`;

html += `</tbody></table>`;
el.innerHTML = html;
}
// ========== HEATMAP TABLES ==========
function pctToColor(p) {
if (p === null) return '#f5f5f5';
const NEG_MIN = -1.0, POS_MAX = 1.0;
const lerp = (a,b,t)=>a+(b-a)*t;
const hex=(r,g,b)=>#${[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('')};
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
const L=0.299r+0.587g+0.114*b;
return L<160?'#fff':'#111';
}
export function renderHeatmapCombined(faturas, targetId) {
const hoje = new Date();
const CURR_YEAR = hoje.getFullYear();
const CURR_MONTH = hoje.getMonth() + 1;

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const isApt = a => a==='123' || a==='1248';
const totais = {};

faturas.forEach(f=>{
    if(!isApt(String(f.apartamento))) return;
    const ano = Number(f.ano), mes = Number(f.mes);
    if(!ano || !mes || mes<1 || mes>12) return;
    const v = totalReserva(f);
    if(!totais[ano]) totais[ano] = {};
    totais[ano][mes] = (totais[ano][mes] || 0) + v;
});

const anosAll = Object.keys(totais).map(Number).sort((a,b)=>a-b);
const anos = anosAll.filter(a => totais[a-1]);

const wrap = document.getElementById(targetId);
if(!wrap) return;

if(anos.length===0){
    wrap.innerHTML = `<div class="heatmap-wrap"><div class="heatmap-muted">Sem base do ano anterior para calcular variação.</div></div>`;
    return;
}

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
    anos.forEach(a => {
        const prev = totais[a - 1]?.[m] ?? null;
        const cur = totais[a]?.[m] ?? null;

        if (a === CURR_YEAR && m > CURR_MONTH) {
            html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
            return;
        }

        let pct = null;
        if (prev === null) pct = null;
        else if (prev === 0 && cur === 0) pct = 0;
        else if (prev === 0 && cur !== 0) pct = null;
        else pct = (cur - prev) / prev;

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
}

html += `</tbody></table></div>`;
wrap.innerHTML = html;

}
export function renderHeatmap123(faturas, targetId) {
const hoje = new Date();
const CURR_YEAR = hoje.getFullYear();
const CURR_MONTH = hoje.getMonth() + 1;

const totais = {};
faturas
    .filter(f => String(f.apartamento) === '123')
    .forEach(f => {
        const ano = Number(f.ano), mes = Number(f.mes);
        if (!totais[ano]) totais[ano] = {};
        totais[ano][mes] = (totais[ano][mes] || 0) + totalReserva(f);
    });

const anosAll = Object.keys(totais).map(n => Number(n)).sort((a,b)=>a-b);
const anos = anosAll.filter(a => totais[a - 1]);

const wrap = document.getElementById(targetId);
if (!wrap) return;

if (anos.length === 0) {
    wrap.innerHTML = `<div class="heatmap-wrap"><span class="heatmap-muted">Sem base do ano anterior (o heatmap começa quando existir 2025 vs 2024).</span></div>`;
    return;
}

const meses = Array.from({ length: 12 }, (_, i) => i + 1);
const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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

        if (a === CURR_YEAR && m > CURR_MONTH) {
            html += `<td class="heatmap-cell" style="background:#f5f5f5"></td>`;
        } else {
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
        }
    });

    html += `</tr>`;
});

html += `</tbody></table></div>`;
wrap.innerHTML = html;

}
export function renderHeatmap1248(faturas, targetId) {
const hoje = new Date();
const CURR_YEAR = hoje.getFullYear();
const CURR_MONTH = hoje.getMonth() + 1;

const totais = {};
faturas
    .filter(f => String(f.apartamento) === '1248')
    .forEach(f => {
        const ano = Number(f.ano), mes = Number(f.mes);
        if (!totais[ano]) totais[ano] = {};
        totais[ano][mes] = (totais[ano][mes] || 0) + totalReserva(f);
    });

const anosAll = Object.keys(totais).map(n => Number(n)).sort((a,b)=>a-b);
const anos = anosAll.filter(a => totais[a - 1]);

const wrap = document.getElementById(targetId);
if (!wrap) return;

if (anos.length === 0) {
    wrap.innerHTML = `<div class="heatmap-wrap"><span class="heatmap-muted">Sem base do ano anterior (o heatmap começa quando existir base, p.ex. 2025 vs 2024).</span></div>`;
    return;
}

const meses = Array.from({ length: 12 }, (_, i) => i + 1);
const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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
            return;
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

html += `</tbody></table></div>`;
wrap.innerHTML = html;

}
// ========== LIMPEZA TABLES ==========
export function renderTabelaLimpezaCombined(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const APTS = ['123', '1248'];
const BASE_YEAR = 2025;
const CURR_YEAR = new Date().getFullYear();

const anos = [];
for (let y = BASE_YEAR; y <= CURR_YEAR; y++) anos.push(y);

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const mapa = {};
anos.forEach(a => {
    mapa[a] = Array.from({length:12}, () => ({ n:0, v:0 }));
});

faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (!APTS.includes(apt)) return;

    const ano = Number(f.ano), mes = Number(f.mes);
    if (!ano || !mes || mes<1 || mes>12) return;

    const limpeza = Number(f.taxaLimpeza || 0);

    if (!mapa[ano]) return;
    mapa[ano][mes-1].n += (limpeza > 0 ? 1 : 0);
    mapa[ano][mes-1].v += limpeza;
});

const anosComDados = anos.filter(a => mapa[a].some(m => m.n > 0 || m.v > 0));
if (!anosComDados.length) {
    el.innerHTML = `<div class="muted">Sem dados de limpeza.</div>`;
    return;
}

const yearBg = ['#fbfbff', '#d9f4e2ff', '#fffaf5', '#f8f9ff', '#f9f7ff'];

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

meses.forEach((nome, i) => {
    html += `<tr><td>${nome}</td>`;
    anosComDados.forEach((a, idx) => {
        const { n, v } = mapa[a][i];
        const bg = yearBg[idx % yearBg.length];
        html += `<td style="background:${bg}; text-align:center">${n}</td>`;
        html += `<td style="background:${bg}; text-align:center">${euroInt(v)}</td>`;
    });
    html += `</tr>`;
});

html += `<tr><td><strong>Total</strong></td>`;
anosComDados.forEach((a, idx) => {
    const totN = mapa[a].reduce((s,m)=>s+m.n,0);
    const totV = mapa[a].reduce((s,m)=>s+m.v,0);
    const bg = yearBg[idx % yearBg.length];
    html += `<td style="background:${bg}; text-align:center"><strong>${totN}</strong></td>`;
    html += `<td style="background:${bg}; text-align:center"><strong>${euroInt(totV)}</strong></td>`;
});
html += `</tr>`;

html += `</tbody></table>`;
el.innerHTML = html;

}

export function renderTabelaNoitesCombined(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const anoAtual = new Date().getFullYear();
const anoInicial = 2025;
const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const categorias = ['2','3','4','5','6','7','≥8'];
const APTS = new Set(['123','1248']);

const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '≥8' : String(v);
};

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

html += `</tbody></table>`;
el.innerHTML = html;

}
export function renderTabelaNoites123(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const anoAtual = new Date().getFullYear();
const anoInicial = 2025;
const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const categorias = ['2','3','4','5','6','7','≥8'];

const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '≥8' : String(v);
};

const mapa = Array.from({ length: 12 }, () =>
    Object.fromEntries(categorias.map(c => [c, 0]))
);

faturas.forEach(f => {
    if (String(f.apartamento) !== '123') return;
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

const anosAnteriores = Array.from(new Set(
    faturas.filter(f => String(f.apartamento) === '123').map(f => Number(f.ano))
))
.filter(a => a < anoAtual && a >= anoInicial)
.sort((a, b) => b - a);

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

html += `</tbody></table>`;
el.innerHTML = html;

}
export function renderTabelaNoites1248(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const anoAtual = new Date().getFullYear();
const anoInicial = 2025;
const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const categorias = ['2','3','4','5','6','7','≥8'];

const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '≥8' : String(v);
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
// ========== HÓSPEDES TABLES ==========
export function renderTabelaHospedesCombined(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2025;
const Y = new Date().getFullYear();
const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const categorias = [1,2,3,4,5,6,7,8];
const APTS = new Set(['123','1248']);

const mapa = Array.from({length:12}, () =>
    Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }]))
);

faturas.forEach(f => {
    const apt = String(f.apartamento);
    if (!APTS.has(apt)) return;
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
        totaisAnoAtual.porHosp[h].n += n;
        totaisAnoAtual.porHosp[h].v += v;
        nMesTotal += n; vMesTotal += v;
    });

    totaisAnoAtual.total.n += nMesTotal;
    totaisAnoAtual.total.v += vMesTotal;

    html += `<td style="text-align:center"><strong>${nMesTotal}</strong></td><td style="text-align:center"><strong>${euroInt(vMesTotal)}</strong></td>`;
    html += `</tr>`;
});

html += `<tr>
    <td><strong>Total ${Y}</strong></td>
    ${categorias.map(h => {
        const t = totaisAnoAtual.porHosp[h];
        const showV = (h <= 6) ? '' : euroInt(t.v);
        return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:center"><strong>${showV}</strong></td>`;
    }).join('')}
    <td style="text-align:center"><strong>${totaisAnoAtual.total.n}</strong></td>
    <td style="text-align:center"><strong>${euroInt(totaisAnoAtual.total.v)}</strong></td>
</tr>`;

const anosAnteriores = Array.from(new Set(
    faturas
        .filter(f => APTS.has(String(f.apartamento)))
        .map(f => Number(f.ano))
)).filter(a => a >= BASE_YEAR && a < Y).sort((a,b)=> b-a);

anosAnteriores.forEach(ano => {
    const porHosp = Object.fromEntries(categorias.map(h => [h, { n:0, v:0 }]));
    let totN = 0, totV = 0;

    faturas.forEach(f => {
        const apt = String(f.apartamento);
        if (!APTS.has(apt)) return;
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
            return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:center"><strong>${showV}</strong></td>`;
        }).join('')}
        <td style="text-align:center"><strong>${totN}</strong></td>
        <td style="text-align:center"><strong>${euroInt(totV)}</strong></td>
    </tr>`;
});

html += `</tbody></table>`;
el.innerHTML = html;

}
export function renderTabelaHospedes123(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2025;
const Y = new Date().getFullYear();
const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const categorias = [1,2,3,4,5,6,7,8];

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
        totaisAnoAtual.porHosp[h].n += n;
        totaisAnoAtual.porHosp[h].v += v;
        nMesTotal += n; vMesTotal += v;
    });

    totaisAnoAtual.total.n += nMesTotal;
    totaisAnoAtual.total.v += vMesTotal;

    html += `<td style="text-align:center"><strong>${nMesTotal}</strong></td><td style="text-align:center"><strong>${euroInt(vMesTotal)}</strong></td>`;
    html += `</tr>`;
});

html += `<tr>
    <td><strong>Total ${Y}</strong></td>
    ${categorias.map(h => {
        const t = totaisAnoAtual.porHosp[h];
        const showV = (h <= 6) ? '' : euroInt(t.v);
        return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:center"><strong>${showV}</strong></td>`;
    }).join('')}
    <td style="text-align:center"><strong>${totaisAnoAtual.total.n}</strong></td>
    <td style="text-align:center"><strong>${euroInt(totaisAnoAtual.total.v)}</strong></td>
</tr>`;

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
            return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:center"><strong>${showV}</strong></td>`;
        }).join('')}
        <td style="text-align:center"><strong>${totN}</strong></td>
        <td style="text-align:center"><strong>${euroInt(totV)}</strong></td>
    </tr>`;
});

html += `</tbody></table>`;
el.innerHTML = html;

}
export function renderTabelaHospedes1248(faturas, targetId) {
const el = document.getElementById(targetId);
if (!el) return;

const BASE_YEAR = 2025;
const Y = new Date().getFullYear();
const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const categorias = [1,2,3,4,5,6,7,8];

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
        html += `<td style="text-align:center">${n}</td><td style="text-align:center"><strong>${showV}</strong></td>`;
        totaisAnoAtual.porHosp[h].n += n;
        totaisAnoAtual.porHosp[h].v += v;
        nMesTotal += n; vMesTotal += v;
    });

    totaisAnoAtual.total.n += nMesTotal;
    totaisAnoAtual.total.v += vMesTotal;

    html += `<td style="text-align:center"><strong>${nMesTotal}</strong></td><td style="text-align:center"><strong>${euroInt(vMesTotal)}</strong></td>`;
    html += `</tr>`;
});

html += `<tr>
    <td><strong>Total ${Y}</strong></td>
    ${categorias.map(h => {
        const t = totaisAnoAtual.porHosp[h];
        const showV = (h <= 6) ? '' : euroInt(t.v);
        return `<td style="text-align:center"><strong>${t.n}</strong></td><td style="text-align:center"><strong>${showV}</strong></td>`;
    }).join('')}
    <td style="text-align:center"><strong>${totaisAnoAtual.total.n}</strong></td>
    <td style="text-align:center"><strong>${euroInt(totaisAnoAtual.total.v)}</strong></td>
</tr>`;

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

        por

        