import { db } from './script.js';
import { createChart, destroyChartSafe } from './analisev2-charts.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { parseLocalDate, consolidarFaturas, MONTH_LABELS, VIEW_APTS } from './analisev2-core.js';

const COLORS = {
  total: 'rgb(20, 78, 3)',
  '123': 'rgba(54,162,235,1)',
  '1248': 'rgba(245,133,20,1)'
};

const monthLabels = MONTH_LABELS;
const MIN_OCCUPANCY_YEAR = 2025;

const fallbackOccLabels = {
  id: 'ocupacaoPercentLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta?.data) return;
      meta.data.forEach((element, index) => {
        const value = dataset.data?.[index];
        if (!Number.isFinite(value)) return;
        const pct = Math.round(value);
        const text = `${pct}%`;
        ctx.save();
        ctx.font = 'bold 12px Montserrat, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.lineWidth = 3;
        ctx.fillStyle = '#ffffff';
        const { x, y } = element.getCenterPoint();
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
      });
    });
  }
};

const state = {
  view: 'total',
  reservas: [],
  chart: null
};
let ocupacaoButtonsController = null;
const ocupacaoScriptCache = new Map();

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="ocupacao"]')) return;
  bindOcupacaoButtons();
  bindOcupacaoExportButton();
  await loadReservas();
  notifyGapView();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'ocupacao') loadReservas();
});

window.addEventListener('beforeunload', cleanupOcupacaoResources);

function bindOcupacaoButtons() {
  if (ocupacaoButtonsController) ocupacaoButtonsController.abort();
  ocupacaoButtonsController = new AbortController();
  const { signal } = ocupacaoButtonsController;

  document.querySelectorAll('[data-ocupacao-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.ocupacaoView;
      if (!view || view === state.view) return;
      state.view = view;
      document.querySelectorAll('[data-ocupacao-view]').forEach(b => {
        const active = b.dataset.ocupacaoView === view;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderOcupacao();
      notifyGapView();
    }, { signal });
  });
}

async function loadReservas() {
  window.loadingManager?.show('ocupacao', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.reservas = consolidarFaturas(raw);
    if (!state.reservas.length) {
      renderEmpty('Sem dados disponíveis.');
    } else {
      renderOcupacao();
    }
  } catch (error) {
    window.errorHandler?.handleError('ocupacao', error, 'loadReservas', loadReservas);
    state.reservas = [];
    renderEmpty('Sem dados disponíveis.');
  } finally {
    window.loadingManager?.hide('ocupacao');
  }
}

function renderOcupacao() {
  const rows = filterByApartments(state.reservas, VIEW_APTS[state.view]);
  if (!rows.length) {
    renderEmpty('Sem dados para esta vista.');
    return;
  }

  const ocupacao = aggregateOcupacao(rows, VIEW_APTS[state.view].length);
  const years = ocupacao.years;
  if (!years.length) {
    renderEmpty('Sem dados suficientes.');
    return;
  }
  const latestYear = years[years.length - 1];
  const prevYear = years.length > 1 ? years[years.length - 2] : null;
  renderOcupacaoChart(ocupacao, latestYear, prevYear);
}

function renderOcupacaoChart(agg, latestYear, prevYear) {
  resetChart();
  const canvas = document.getElementById('chart-ocupacao');
  if (!canvas) return;
  canvas.parentElement?.querySelector('.ocupacao-empty')?.remove();

  const datasets = [];
  if (prevYear) {
    datasets.push({
      label: `${prevYear}`,
      data: agg.percent[prevYear],
      borderColor: 'rgba(148,163,184,1)',
      backgroundColor: withAlpha('rgba(148,163,184,1)', 0.2),
      borderDash: [4,4],
      borderWidth: 1.5,
      tension: 0.25,
      pointRadius: 2,
      pointHoverRadius: 4
    });
  }
  datasets.push({
    label: `${latestYear}`,
    data: agg.percent[latestYear],
    borderColor: COLORS[state.view] || COLORS.total,
    backgroundColor: withAlpha(COLORS[state.view] || COLORS.total, 0.35),
    borderWidth: 1,
  tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5
  });

  const plugins = [];
  const hasDataLabels = typeof ChartDataLabels !== 'undefined';
  if (hasDataLabels) plugins.push(ChartDataLabels);
  else plugins.push(fallbackOccLabels);

  state.chart = createChart(canvas, {
    type: 'bar',
    data: { labels: monthLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: {
        padding: {
          top: 20,
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (value) => `${Math.round(value)}%` },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: false }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              const rounded = Number.isFinite(val) ? Math.round(val) : 0;
              return `${ctx.dataset.label}: ${rounded}%`;
            }
          }
        },
        legend: { position: 'top' },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          display: true,
          color: '#ffffff',
          anchor: 'center',
          align: 'center',
          formatter: (value) => `${Math.round(value ?? 0)}%`,
          font: {
            weight: 'bold',
            size: 12
          },
          clamp: false,
          clip: false,
          textStrokeColor: 'rgba(15, 23, 42, 0.6)',
          textStrokeWidth: 3
        } : undefined
      }
    },
    plugins
  }, { previousChart: state.chart });
}

function aggregateOcupacao(rows, apartmentsCount) {
  const occupancy = {};
  const yearsSet = new Set();

  rows.forEach((row) => {
    const noites = Number(row.noites || 0);
    if (!noites) return;

    const slices = splitReserva(row);
    slices.forEach(({ year, month }) => {
      if (!year || year < MIN_OCCUPANCY_YEAR) return;
      if (!occupancy[year]) occupancy[year] = Array(12).fill(0);
      occupancy[year][month - 1] += 1;
      yearsSet.add(year);
    });
  });

  const percent = {};
  Array.from(yearsSet).sort((a, b) => a - b).forEach((year) => {
    percent[year] = occupancy[year].map((occupied, idx) => {
      const days = diasNoMes(year, idx + 1) * apartmentsCount;
      if (!days) return 0;
      return Math.min(100, (occupied * 100) / days);
    });
  });

  return { percent, years: Array.from(yearsSet).sort((a, b) => a - b) };
}

function splitReserva(reserva) {
  const noites = Number(reserva.noites || 0);
  const slices = [];
  if (typeof reserva.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reserva.checkIn)) {
    const start = parseLocalDate(reserva.checkIn);
    if (start instanceof Date && !Number.isNaN(start.getTime())) {
      for (let i = 0; i < noites; i++) {
        const day = new Date(start);
        day.setDate(day.getDate() + i);
        if (day.getFullYear() >= MIN_OCCUPANCY_YEAR) {
          slices.push({ year: day.getFullYear(), month: day.getMonth() + 1 });
        }
      }
      return slices;
    }
  }
  const ano = Number(reserva.ano);
  const mes = Number(reserva.mes);
  if (!ano || !mes || ano < MIN_OCCUPANCY_YEAR) return slices;
  const cap = diasNoMes(ano, mes);
  const nightsInMonth = Math.min(cap, noites);
  for (let i = 0; i < nightsInMonth; i++) {
    slices.push({ year: ano, month: mes });
  }
  return slices;
}

function filterByApartments(rows, apartments) {
  if (!apartments || !apartments.length) return [];
  const allow = new Set(apartments.map(String));
  return rows.filter(r => allow.has(String(r.apartamento)));
}

function diasNoMes(ano, mes) {
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return 30;
  const date = new Date(ano, mes, 0);
  if (Number.isNaN(date.getTime())) return 30;
  return date.getDate();
}

function withAlpha(color, alpha) {
  if (color.startsWith('rgba')) {
    return color.replace(/rgba\(([^)]+),\s*[^,]+\)/, `rgba($1, ${alpha})`);
  }
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  return color;
}

function resetChart() {
  if (!state.chart) return;
  destroyChartSafe(state.chart);
  state.chart = null;
}

function renderEmpty(message) {
  resetChart();
  const canvas = document.getElementById('chart-ocupacao');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const wrap = document.createElement('div');
  if (canvas && canvas.parentElement) {
    canvas.parentElement.querySelector('.ocupacao-empty')?.remove();
    wrap.className = 'ocupacao-empty';
    wrap.style.textAlign = 'center';
    wrap.style.color = 'var(--text-dim)';
    wrap.textContent = message;
    canvas.parentElement.appendChild(wrap);
  }
}

function cleanupOcupacaoResources() {
  if (ocupacaoButtonsController) {
    ocupacaoButtonsController.abort();
    ocupacaoButtonsController = null;
  }
  resetChart();
}

function bindOcupacaoExportButton() {
  const button = document.querySelector('[data-export-target="ocupacao"]');
  if (!button) return;
  button.addEventListener('click', () => exportOcupacaoReport(button));
}

async function exportOcupacaoReport(button) {
  const chartCanvas = document.getElementById('chart-ocupacao');
  const gapTable = document.querySelector('#gap-table table');
  const gapSummary = document.getElementById('gap-summary')?.textContent?.trim() || '';
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'A gerar…';
    }
    await ensureOcupacaoExportLibs();
    const doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;
    const generatedLabel = new Date().toLocaleDateString('pt-PT');
    const viewLabels = {
      total: 'Total (123 + 1248)',
      '123': 'Apartamento 123',
      '1248': 'Apartamento 1248'
    };
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Taxa de ocupação - ${viewLabels[state.view] || viewLabels.total}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 9;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('Cobertura mensal e lacunas identificadas.', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    if (chartCanvas && chartCanvas.offsetHeight > 0) {
      const chartImage = chartCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = (chartWidth / chartCanvas.width) * chartCanvas.height;
      if (yPos + chartHeight + 20 > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.addImage(chartImage, 'PNG', margin, yPos, chartWidth, chartHeight);
      yPos += chartHeight + 10;
    }

    if (gapSummary) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(80, 80, 80);
      const wrapped = doc.splitTextToSize(gapSummary, pageWidth - 2 * margin);
      doc.text(wrapped, margin, yPos);
      yPos += wrapped.length * 4 + 4;
    }

    if (gapTable) {
      const tableClone = gapTable.cloneNode(true);
      doc.autoTable({
        html: tableClone,
        startY: yPos,
        margin: { top: margin, right: margin, bottom: margin, left: margin },
        styles: {
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          lineColor: [148, 163, 184],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [226, 232, 240],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
          lineColor: [148, 163, 184],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });
    } else {
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('Sem gaps relevantes para exportar.', margin, yPos);
    }

    const lastPage = doc.internal.getNumberOfPages();
    doc.setPage(lastPage);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado a ${generatedLabel}`, margin, doc.internal.pageSize.getHeight() - margin / 2);

    const stamp = new Date().toISOString().slice(0, 10);
    const viewName = state.view === 'total' ? 'total' : state.view;
    doc.save(`export-ocupacao-${viewName}-${stamp}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar ocupação', error);
    if (button) button.textContent = 'Erro';
    setTimeout(() => {
      if (button) button.textContent = 'Exportar';
    }, 2000);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Exportar';
    }
  }
}

async function ensureOcupacaoExportLibs() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    await loadOcupacaoScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    if (window.jspdf?.jsPDF && typeof window.jspdf.jsPDF === 'function') {
      window.jsPDF = window.jspdf.jsPDF;
    }
  }
  if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
    await loadOcupacaoScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js');
  }
}

function loadOcupacaoScript(src) {
  if (ocupacaoScriptCache.has(src)) return ocupacaoScriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => {
      ocupacaoScriptCache.delete(src);
      reject(new Error(`Falha ao carregar ${src}`));
    };
    document.head.appendChild(script);
  });
  ocupacaoScriptCache.set(src, promise);
  return promise;
}

function notifyGapView() {
  window.dispatchEvent(new CustomEvent('gap-analysis:set-view', {
    detail: { view: state.view }
  }));
}
