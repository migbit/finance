import { MONTH_LABELS, formatEuro } from './analisev2-core.js';
import { getMonthlyPerformance, seasonFromMonth } from './analisev3-data.js';

const SEASON_COLORS = {
  summer: '#f97316',
  fall: '#facc15',
  winter: '#38bdf8',
  spring: '#22c55e'
};

const state = {
  points: [],
  chart: null
};

const quadrantPlugin = {
  id: 'pricingQuadrants',
  afterDraw(chart, args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!opts || !scales?.x || !scales?.y) return;
    const { xThreshold, yThreshold } = opts;
    const x = scales.x.getPixelForValue?.(xThreshold);
    const y = scales.y.getPixelForValue?.(yThreshold);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(107,114,128,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.restore();
  }
};

const labelsPlugin = {
  id: 'customScatterLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data, scales, chartArea } = chart;
    if (!scales?.x || !scales?.y) return;
    
    const dataset = data.datasets[0];
    if (!dataset || !dataset.data) return;
    
    ctx.save();
    ctx.font = '600 11px Montserrat, system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    dataset.data.forEach((point, idx) => {
      if (!point || point.x == null || point.y == null) return;
      
      const px = scales.x.getPixelForValue(point.x);
      const py = scales.y.getPixelForValue(point.y);
      
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      if (px < chartArea.left || px > chartArea.right) return;
      if (py < chartArea.top || py > chartArea.bottom) return;
      
      const label = point.label || '';
      if (label) {
        ctx.fillText(label, px, py - 10);
      }
    });
    
    ctx.restore();
  }
};
let pricingPluginsRegistered = false;
function ensurePricingPlugins() {
  if (pricingPluginsRegistered) return;
  if (typeof Chart === 'undefined' || !Chart?.register) return;
  try {
    Chart.register(quadrantPlugin, labelsPlugin);
    pricingPluginsRegistered = true;
  } catch (error) {
    console.error('Failed to register pricing plugins', error);
  }
}
ensurePricingPlugins();

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="pricing-lab"]')) return;
  await loadPricingLab();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'pricing-lab') loadPricingLab();
});

window.addEventListener('beforeunload', () => {
  destroyChart();
});

async function loadPricingLab() {
  window.loadingManager?.show('pricing-lab', { type: 'skeleton' });
  try {
    const { months } = await getMonthlyPerformance();
    const filtered = months.filter((month) => Number(month.year) >= 2025);
    state.points = buildPoints(filtered);
    if (!state.points.length) {
      renderEmpty('Sem dados suficientes (apenas 2025+).');
    } else {
      renderChart();
      renderRecommendations();
    }
  } catch (error) {
    window.errorHandler?.handleError('pricing-lab', error, 'loadPricingLab', loadPricingLab);
    renderEmpty('Erro ao carregar pricing.');
  } finally {
    window.loadingManager?.hide('pricing-lab');
  }
}

function buildPoints(months) {
  const latest = months.slice(-12);
  return latest.map((month) => {
    const occupancy = month.availableTotal ? (month.totalOccupied / month.availableTotal) * 100 : 0;
    const avgPrice = month.totalOccupied ? month.totalRevenue / month.totalOccupied : 0;
    return {
      x: Number.isFinite(occupancy) ? Number(occupancy.toFixed(1)) : null,
      y: Number.isFinite(avgPrice) ? avgPrice : null,
      season: seasonFromMonth(month.month),
      label: `${MONTH_LABELS[month.month - 1]} ${month.year}`,
      month: month.month,
      year: month.year
    };
  }).filter((point) => point.x != null && point.y != null);
}

function renderChart() {
  ensurePricingPlugins();
  destroyChart();
  const canvas = document.getElementById('chart-pricing-lab');
  if (!canvas || typeof Chart === 'undefined') return;
  const priceThreshold = median(state.points.map((p) => p.y));
  const occupancyThreshold = 75;
  const maxPrice = Math.max(...state.points.map((p) => p.y || 0));
  const yMax = maxPrice + 30;

  const plugins = [labelsPlugin, quadrantPlugin];

  state.chart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Meses',
        data: state.points,
        pointBackgroundColor: (ctx) => SEASON_COLORS[ctx.raw.season] || '#6366f1',
        pointBorderColor: '#111827',
        pointRadius: (ctx) => ctx.dataIndex === state.points.length - 1 ? 6 : 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Ocupação %' },
          min: 30,
          max: 105,
          ticks: { callback: (value) => `${value}%` }
        },
        y: {
          title: { display: true, text: 'Preço médio (€/noite)' },
          min: 100,
          max: yMax,
          ticks: { callback: (value) => formatEuro(value) }
        }
      },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw;
              return `${context.parsed.x}% · ${formatEuro(context.parsed.y)}`;
            }
          }
        },
        pricingQuadrants: {
          xThreshold: occupancyThreshold,
          yThreshold: priceThreshold
        }
      }
    },
    plugins
  });
}

function renderRecommendations() {
  const container = document.getElementById('pricing-action-cards');
  if (!container) return;
  if (!state.points.length) {
    container.innerHTML = '<article class="action-card"><h5>Sem dados</h5><p>Adicione meses recentes para gerar recomendações.</p></article>';
    return;
  }

  const cards = buildRecommendations();
  if (!cards.length) {
    container.innerHTML = '<article class="action-card"><h5>Equilíbrio atingido</h5><p>Os últimos meses estão nos quadrantes ideais.</p></article>';
    return;
  }
  container.innerHTML = cards.map((card) => `
    <article class="action-card">
      <h5>${card.title}</h5>
      <p>${card.body}</p>
    </article>
  `).join('');
}

function buildRecommendations() {
  const recommendations = [];
  const priceMedian = median(state.points.map((p) => p.y));
  const latest = state.points[state.points.length - 1];
  if (latest && latest.x >= 90 && latest.y) {
    recommendations.push({
      title: `Subir preços 10-15%`,
      body: `${latest.label} com ${latest.x}% de ocupação – teste um aumento de preço para capturar RevPAN extra.`
    });
  }

  const weakMonth = state.points.find((point) => point.x < 55 && point.y > priceMedian);
  if (weakMonth) {
    recommendations.push({
      title: `Ajustar tarifas`,
      body: `${weakMonth.label}: ${weakMonth.x}% de ocupação e ${formatEuro(weakMonth.y)} indicam preço alto – reduza 15% ou liberte mínimos.`
    });
  }

  const bargain = state.points.find((point) => point.x > 80 && point.y < priceMedian);
  if (bargain) {
    recommendations.push({
      title: `Underpriced`,
      body: `${bargain.label}: ${bargain.x}% de ocupação mas preço médio ${formatEuro(bargain.y)}. Subir 10% mantém taxa e aumenta receita.`
    });
  }

  return recommendations.slice(0, 2);
}

function renderEmpty(message = 'Sem dados para gerar o motor de pricing.') {
  destroyChart();
  const container = document.getElementById('pricing-action-cards');
  if (container) {
    container.innerHTML = `<article class="action-card"><h5>Sem dados</h5><p>${message}</p></article>`;
  }
  const canvas = document.getElementById('chart-pricing-lab');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function destroyChart() {
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
}

function median(values) {
  const arr = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
