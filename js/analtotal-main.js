// analtotal-main.js - Main initialization and UI control
import { carregarFaturas, consolidarFaturas, calculateProgress, obterNomeMes, euroInt } from './analtotal-data.js';
import {
renderFaturacaoCombined,
renderFaturacao123,
renderFaturacao1248,
renderFaturacaoComparison,
renderMediaNoiteCombined,
renderMediaNoite123,
renderMediaNoite1248,
renderMediaNoiteComparison,
renderOcupacaoCombined,
renderOcupacao123,
renderOcupacao1248,
renderOcupacaoComparison,
renderCheckinsCombined,
renderCheckinsComparison
} from './analtotal-charts.js';
import {
renderTabelaFaturacaoCombined,
renderTabelaFaturacao123,
renderTabelaFaturacao1248,
renderTabelaFaturacaoComparison,
renderHeatmapCombined,
renderHeatmap123,
renderHeatmap1248,
renderTabelaLimpezaCombined,
renderTabelaLimpezaComparison,
renderTabelaNoitesCombined,
renderTabelaNoites123,
renderTabelaNoites1248,
renderTabelaHospedesCombined,
renderTabelaHospedes123,
renderTabelaHospedes1248
} from './analtotal-tables.js';
// Global state
let allFaturas = [];
// ========== MOBILE MENU ==========
document.addEventListener('DOMContentLoaded', () => {
const header = document.querySelector('header');
const menuBtn = document.getElementById('menu-icon');
const navMenu = document.getElementById('nav-menu');
if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
        header.classList.toggle('active');
    });
}

if (navMenu && header) {
    navMenu.addEventListener('click', (e) => {
        if (e.target.closest('a')) header.classList.remove('active');
    });
}

});
// ========== COLLAPSIBLE SECTIONS ==========
function initCollapsibleSections() {
const sections = document.querySelectorAll('.collapsible-section');
sections.forEach(section => {
    const header = section.querySelector('.collapsible-header');
    if (!header) return;

    header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
    });
});
}
// ========== VIEW SELECTORS ==========
function initViewSelectors() {
const selectors = document.querySelectorAll('.view-selector');
selectors.forEach(selector => {
    const buttons = selector.querySelectorAll('.view-btn');
    const sectionName = selector.getAttribute('data-for');
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const viewName = button.getAttribute('data-view');
            
            // Update active button
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show/hide content
            const contents = document.querySelectorAll(`.view-content[data-section="${sectionName}"]`);
            contents.forEach(content => {
                if (content.getAttribute('data-view') === viewName) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });
});
}
// ========== DONUT RENDERING ==========
const cssVar = (name, fallback) =>
(getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;
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
canvas.style.width = '160px';
canvas.style.height = '160px';
canvas.width = 160;
canvas.height = 160;

if (canvas._chart) {
    try { canvas._chart.destroy(); } catch {}
}

const val = Math.max(0, Math.min(100, Math.abs(percentSigned)));
const ring = (percentSigned >= 0) ? cssVar('--ok', '#16a34a') : cssVar('--bad', '#e11d48');
const formatted = val.toFixed(2);

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
// ========== RENDER DONUTS ==========
function renderDonutsCombined(faturas) {
const currentYear = new Date().getFullYear();
const anos = Array.from(new Set([2024, currentYear])).sort((a,b)=>a-b);
const ultimoAno = anos[anos.length - 1];
const penultimoAno = anos.length > 1 ? anos[0] : 2024;
const progress = calculateProgress(faturas, ultimoAno, penultimoAno, ['123', '1248']);

// Update title
const titleEl = document.getElementById('progress-title-combined');
if (titleEl) titleEl.textContent = `Progresso vs ${penultimoAno}`;

// Parcial
const lblParcial = document.getElementById('label-parcial-combined');
if (lblParcial) lblParcial.textContent = `Parcial ${obterNomeMes(new Date().getMonth() + 1)}`;

const txtParcial = document.getElementById('donut-parcial-text-combined');
if (txtParcial) {
    const diff = progress.parcial.diff;
    txtParcial.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-parcial-combined'), progress.parcial.pct);

// Até Set
const prevMonth = Math.max(1, new Date().getMonth());
const lblAteset = document.getElementById('label-ateset-combined');
if (lblAteset) lblAteset.textContent = `Até ${obterNomeMes(prevMonth)}`;

const txtAteset = document.getElementById('donut-ateset-text-combined');
if (txtAteset) {
    const diff = progress.ateset.diff;
    txtAteset.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-ateset-combined'), progress.ateset.pct);

// VS
const lblVs = document.getElementById('label-vs-combined');
if (lblVs) lblVs.textContent = `${ultimoAno} vs ${penultimoAno}`;

const txtVs = document.getElementById('donut-vs-text-combined');
if (txtVs) {
    const diff = progress.vs.diff;
    txtVs.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-vs-combined'), progress.vs.pct);
}
function renderDonuts123(faturas) {
const currentYear = new Date().getFullYear();
const anos = Array.from(new Set([2024, currentYear])).sort((a,b)=>a-b);
const ultimoAno = anos[anos.length - 1];
const penultimoAno = anos.length > 1 ? anos[0] : 2024;
const progress = calculateProgress(faturas, ultimoAno, penultimoAno, ['123']);

const titleEl = document.getElementById('progress-title-123');
if (titleEl) titleEl.textContent = `Progresso 123 vs ${penultimoAno}`;

const lblParcial = document.getElementById('label-parcial-123');
if (lblParcial) lblParcial.textContent = `Parcial ${obterNomeMes(new Date().getMonth() + 1)}`;

const txtParcial = document.getElementById('donut-parcial-text-123');
if (txtParcial) {
    const diff = progress.parcial.diff;
    txtParcial.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-parcial-123'), progress.parcial.pct);

const prevMonth = Math.max(1, new Date().getMonth());
const lblAteset = document.getElementById('label-ateset-123');
if (lblAteset) lblAteset.textContent = `Até ${obterNomeMes(prevMonth)}`;

const txtAteset = document.getElementById('donut-ateset-text-123');
if (txtAteset) {
    const diff = progress.ateset.diff;
    txtAteset.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-ateset-123'), progress.ateset.pct);

const lblVs = document.getElementById('label-vs-123');
if (lblVs) lblVs.textContent = `${ultimoAno} vs ${penultimoAno}`;

const txtVs = document.getElementById('donut-vs-text-123');
if (txtVs) {
    const diff = progress.vs.diff;
    txtVs.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-vs-123'), progress.vs.pct);
}
function renderDonuts1248(faturas) {
const currentYear = new Date().getFullYear();
const anos = Array.from(new Set([2024, currentYear])).sort((a,b)=>a-b);
const ultimoAno = anos[anos.length - 1];
const penultimoAno = anos.length > 1 ? anos[0] : 2024;
const progress = calculateProgress(faturas, ultimoAno, penultimoAno, ['1248']);

const titleEl = document.getElementById('progress-title-1248');
if (titleEl) titleEl.textContent = `Progresso 1248 vs ${penultimoAno}`;

const lblParcial = document.getElementById('label-parcial-1248');
if (lblParcial) lblParcial.textContent = `Parcial ${obterNomeMes(new Date().getMonth() + 1)}`;

const txtParcial = document.getElementById('donut-parcial-text-1248');
if (txtParcial) {
    const diff = progress.parcial.diff;
    txtParcial.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-parcial-1248'), progress.parcial.pct);

const prevMonth = Math.max(1, new Date().getMonth());
const lblAteset = document.getElementById('label-ateset-1248');
if (lblAteset) lblAteset.textContent = `Até ${obterNomeMes(prevMonth)}`;

const txtAteset = document.getElementById('donut-ateset-text-1248');
if (txtAteset) {
    const diff = progress.ateset.diff;
    txtAteset.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-ateset-1248'), progress.ateset.pct);

const lblVs = document.getElementById('label-vs-1248');
if (lblVs) lblVs.textContent = `${ultimoAno} vs ${penultimoAno}`;

const txtVs = document.getElementById('donut-vs-text-1248');
if (txtVs) {
    const diff = progress.vs.diff;
    txtVs.textContent = diff >= 0 ? `Excedeu ${euroInt(diff)}` : `Faltam ${euroInt(-diff)}`;
}

makeDonut(document.getElementById('donut-vs-1248'), progress.vs.pct);
}
// ========== RENDER ALL SECTIONS ==========
async function renderAllSections() {
console.log('Loading data...');
const firebaseFaturas = await carregarFaturas();
const currentYear = new Date().getFullYear();
allFaturas = consolidarFaturas(firebaseFaturas)
    .filter(f => Number(f.ano) === 2024 || Number(f.ano) === currentYear);

console.log('Rendering sections...');

// Faturação
renderFaturacaoCombined(allFaturas, 'chart-faturacao-combined');
renderTabelaFaturacaoCombined(allFaturas, 'tabela-faturacao-combined');

renderFaturacao123(allFaturas, 'chart-faturacao-123');
renderTabelaFaturacao123(allFaturas, 'tabela-faturacao-123');

renderFaturacao1248(allFaturas, 'chart-faturacao-1248');
renderTabelaFaturacao1248(allFaturas, 'tabela-faturacao-1248');

renderFaturacaoComparison(allFaturas, 'chart-faturacao-comparison');
renderTabelaFaturacaoComparison(allFaturas, 'tabela-faturacao-comparison');

// Média/Noite
renderMediaNoiteCombined(allFaturas, 'chart-media-combined');
renderMediaNoite123(allFaturas, 'chart-media-123');
renderMediaNoite1248(allFaturas, 'chart-media-1248');
renderMediaNoiteComparison(allFaturas, 'chart-media-comparison');

// Ocupação
renderOcupacaoCombined(allFaturas, 'chart-ocupacao-combined');
renderOcupacao123(allFaturas, 'chart-ocupacao-123');
renderOcupacao1248(allFaturas, 'chart-ocupacao-1248');
renderOcupacaoComparison(allFaturas, 'chart-ocupacao-comparison');

// Progresso (Donuts)
renderDonutsCombined(allFaturas);
renderDonuts123(allFaturas);
renderDonuts1248(allFaturas);

// Heatmap
renderHeatmapCombined(allFaturas, 'heatmap-combined');
renderHeatmap123(allFaturas, 'heatmap-123');
renderHeatmap1248(allFaturas, 'heatmap-1248');

// Limpeza
renderTabelaLimpezaCombined(allFaturas, 'tabela-limpeza-combined');
renderTabelaLimpezaComparison(allFaturas, 'tabela-limpeza-comparison');

// Noites
renderTabelaNoitesCombined(allFaturas, 'tabela-noites-combined');
renderTabelaNoites123(allFaturas, 'tabela-noites-123');
renderTabelaNoites1248(allFaturas, 'tabela-noites-1248');

// Hóspedes
renderTabelaHospedesCombined(allFaturas, 'tabela-hospedes-combined');
renderTabelaHospedes123(allFaturas, 'tabela-hospedes-123');
renderTabelaHospedes1248(allFaturas, 'tabela-hospedes-1248');

// Check-ins
renderCheckinsCombined(allFaturas, 'chart-checkins-combined');
renderCheckinsComparison(allFaturas, 'chart-checkins-comparison');

console.log('All sections rendered!');
}
// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
console.log('Initializing Análise Total...');
// Initialize UI controls
initCollapsibleSections();
initViewSelectors();

// Render all data
await renderAllSections();

console.log('Initialization complete!');
});