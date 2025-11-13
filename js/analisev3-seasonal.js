import { formatEuro } from './analisev2-core.js';
import { getMonthlyPerformance, seasonFromMonth } from './analisev3-data.js';

const SEASONS = ['summer', 'fall', 'winter', 'spring'];
const charts = new Map();
let isRendering = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="seasonal"]')) return;
  await renderSeasonal();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'seasonal') renderSeasonal();
});

window.addEventListener('beforeunload', () => {
  charts.forEach((chart) => chart?.destroy());
  charts.clear();
});

async function renderSeasonal() {
  if (isRendering) return;
  isRendering = true;
  window.loadingManager?.show('seasonal', { type: 'skeleton' });
  try {
    const { months } = await getMonthlyPerformance();
    if (!months.length) {
      setSeasonalMessage('Sem dados disponíveis.');
      return;
    }
    const summary = addSeasonRankings(buildSeasonSummary(months));
    SEASONS.forEach((seasonKey) => renderSeasonTile(seasonKey, summary[seasonKey]));
  } catch (error) {
    window.errorHandler?.handleError('seasonal', error, 'renderSeasonal', renderSeasonal);
    setSeasonalMessage('Erro ao carregar dados.');
  } finally {
    window.loadingManager?.hide('seasonal');
    isRendering = false;
  }
}

function setSeasonalMessage(message) {
  SEASONS.forEach((seasonKey) => {
    const card = document.querySelector(`[data-season="${seasonKey}"]`);
    if (!card) return;
    const canvas = card.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const list = card.querySelector('ul');
    if (list) {
      list.innerHTML = `<li>${message}</li>`;
    }
  });
}

function buildSeasonSummary(months) {
  const buckets = SEASONS.reduce((acc, key) => {
    acc[key] = { byYear: new Map(), average: { revenue: 0, occupied: 0, available: 0 }, samples: 0 };
    return acc;
  }, {});

  months.forEach((month) => {
    const season = seasonFromMonth(month.month);
    const seasonYear = resolveSeasonYear(month.year, month.month, season);
    const target = buckets[season];
    if (!target.byYear.has(seasonYear)) {
      target.byYear.set(seasonYear, { revenue: 0, occupied: 0, available: 0 });
    }
    const slot = target.byYear.get(seasonYear);
    slot.revenue += month.totalRevenue;
    slot.occupied += month.totalOccupied;
    slot.available += month.availableTotal;
  });

  const result = {};
  SEASONS.forEach((season) => {
    const data = buckets[season];
    const years = Array.from(data.byYear.keys()).sort((a, b) => a - b);
    const latestYear = years[years.length - 1];
    const previousYears = years.slice(0, -1);
    const prevYear = previousYears.length ? previousYears[previousYears.length - 1] : null;
    const current = latestYear ? data.byYear.get(latestYear) : null;
    const prev = prevYear ? data.byYear.get(prevYear) : null;

    let avgRevenue = null;
    if (previousYears.length) {
      const totalRevenue = previousYears.reduce((sum, year) => sum + data.byYear.get(year).revenue, 0);
      avgRevenue = totalRevenue / previousYears.length;
    }

    const revpan = current?.available ? current.revenue / current.available : 0;
    result[season] = {
      current,
      prev,
      latestYear,
      avgRevenue,
      baselineReady: previousYears.length > 0,
      revpan,
      nights: current?.occupied || 0
    };
  });

  return result;
}

function resolveSeasonYear(year, month, season) {
  if (season === 'winter' && month === 12) return year + 1;
  return year;
}

function renderSeasonTile(season, summary) {
  const card = document.querySelector(`[data-season="${season}"]`);
  if (!card) return;
  const revenueEl = card.querySelector(`#seasonal-${season}-revenue`);
  const occEl = card.querySelector(`#seasonal-${season}-occ`);
  const avgEl = card.querySelector(`#seasonal-${season}-avg`);
  const yoyEl = card.querySelector(`#seasonal-${season}-yoy`);
  const nightsEl = card.querySelector(`#seasonal-${season}-nights`);
  const revpanEl = card.querySelector(`#seasonal-${season}-revpan`);
  const rankEl = card.querySelector(`#seasonal-${season}-rank`);
  const insightsWrap = card.querySelector(`#seasonal-${season}-insights`);

  if (!summary?.current) {
    if (revenueEl) revenueEl.textContent = '—';
    if (occEl) occEl.textContent = '—';
    if (avgEl) avgEl.textContent = '—';
    if (yoyEl) yoyEl.textContent = '—';
    if (nightsEl) nightsEl.textContent = '—';
    if (revpanEl) revpanEl.textContent = '—';
    if (rankEl) rankEl.textContent = '—';
    if (insightsWrap) insightsWrap.innerHTML = '';
    destroyChart(`seasonal-${season}`);
    return;
  }

  const current = summary.current;
  const prev = summary.prev;
  const occupancy = current.available ? (current.occupied / current.available) * 100 : 0;
  const avgPrice = current.occupied ? current.revenue / current.occupied : 0;
  if (revenueEl) revenueEl.textContent = formatEuro(current.revenue);
  if (occEl) occEl.textContent = `${occupancy.toFixed(1)}%`;
  if (avgEl) avgEl.textContent = formatEuro(avgPrice);

  const yoy = prev && prev.revenue ? ((current.revenue - prev.revenue) / prev.revenue) * 100 : 0;
  if (yoyEl) {
    if (prev) {
      const sign = yoy >= 0 ? '+' : '';
      yoyEl.textContent = `${sign}${yoy.toFixed(1)}%`;
    } else {
      yoyEl.textContent = '—';
    }
  }

  if (nightsEl) nightsEl.textContent = `${summary.nights ?? 0}`;
  if (revpanEl) revpanEl.textContent = formatEuro(summary.revpan ?? 0);
  if (rankEl) rankEl.textContent = summary.revenueRank ? `#${summary.revenueRank}` : '—';

  if (insightsWrap) {
    const insights = getSeasonInsights(season, summary);
    if (!insights.length) {
      insightsWrap.innerHTML = '<span class="insight-chip">Sem insights adicionais</span>';
    } else {
      insightsWrap.innerHTML = insights
        .map(insight => `<span class="insight-chip ${insight.type}">${insight.message}</span>`)
        .join('');
    }
  }

  const currentRevenue = current?.revenue || 0;
  renderSeasonDonut(`seasonal-${season}`, currentRevenue, summary?.avgRevenue ?? null, summary?.baselineReady);
}

function renderSeasonDonut(canvasId, currentRevenue, avgRevenue, baselineReady) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  destroyChart(canvasId);

  if (!baselineReady) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px var(--font-sans, sans-serif)';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('Ano base — aguarde próximo ciclo', canvas.width / 2, canvas.height / 2);
    return;
  }

  const hasAverage = Number.isFinite(avgRevenue) && avgRevenue > 0;
  const hasCurrent = Number.isFinite(currentRevenue) && currentRevenue > 0;
  if (!hasAverage || !hasCurrent) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px var(--font-sans, sans-serif)';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', canvas.width / 2, canvas.height / 2);
    return;
  }

  const delta = currentRevenue - avgRevenue;
  let data;
  let labels;
  let colors;

  if (delta >= 0) {
    data = [avgRevenue, delta];
    labels = ['Média histórica', 'Acima da média'];
    colors = ['#d1d5db', '#16a34a'];
  } else {
    data = [currentRevenue, Math.abs(delta)];
    labels = ['Atual', 'Gap para média'];
    colors = ['#f97316', '#d1d5db'];
  }

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      cutout: '70%',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw ?? 0;
              return `${context.label}: ${formatEuro(value)}`;
            }
          }
        }
      }
    }
  });
  charts.set(canvasId, chart);
}

function destroyChart(key) {
  const chart = charts.get(key) || charts.get(key instanceof HTMLElement ? key.id : key);
  if (chart) {
    chart.destroy();
    charts.delete(key);
  }
}

function addSeasonRankings(summary) {
  const ranking = SEASONS
    .map((season) => ({
      season,
      revenue: summary[season]?.current?.revenue || 0
    }))
    .sort((a, b) => b.revenue - a.revenue);

  ranking.forEach((entry, idx) => {
    if (summary[entry.season]) {
      summary[entry.season].revenueRank = entry.revenue > 0 ? idx + 1 : null;
    }
  });
  return summary;
}

function getSeasonInsights(season, summary) {
  const insights = [];
  const current = summary?.current;
  if (!current) return insights;
  if (!summary.baselineReady) {
    insights.push({ type: 'info', message: 'Ano base em construção – comparar após próximo ciclo' });
  }
  const occupancy = current.available ? (current.occupied / current.available) * 100 : 0;
  const avgRevenue = summary.avgRevenue || 0;
  const prev = summary.prev;

  if (occupancy >= 85) {
    insights.push({ type: 'success', message: 'Alta ocupação – considere aumentar preços' });
  } else if (occupancy > 0 && occupancy < 55) {
    insights.push({ type: 'warning', message: 'Ocupação fraca – ajuste promoções' });
  }

  if (prev?.revenue) {
    const yoy = ((current.revenue - prev.revenue) / prev.revenue) * 100;
    if (yoy <= -10) {
      insights.push({ type: 'alert', message: `Receita -${Math.abs(yoy).toFixed(0)}% vs ano anterior` });
    } else if (yoy >= 10) {
      insights.push({ type: 'success', message: `Receita +${yoy.toFixed(0)}% vs ano anterior` });
    }
  }

  if (avgRevenue > 0) {
    const gap = current.revenue - avgRevenue;
    if (gap <= -(avgRevenue * 0.1)) {
      insights.push({ type: 'info', message: `Abaixo da média por ${formatEuro(Math.abs(gap))}` });
    } else if (gap >= avgRevenue * 0.1) {
      insights.push({ type: 'success', message: `Acima da média por ${formatEuro(gap)}` });
    }
  }

  return insights.slice(0, 3);
}
