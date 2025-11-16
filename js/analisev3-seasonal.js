import { formatEuro } from './analisev2-core.js';
import { getMonthlyPerformance, seasonFromMonth } from './analisev3-data.js';

const SEASONS = ['summer', 'fall', 'winter', 'spring'];
const charts = new Map();
let isRendering = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="seasonal"]')) return;
  bindSeasonalExport();
  await renderSeasonal();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'seasonal') renderSeasonal();
});

window.addEventListener('beforeunload', () => {
  charts.forEach((chart) => chart?.destroy());
  charts.clear();
});

function bindSeasonalExport() {
  const button = document.querySelector('[data-export-target="seasonal"]');
  if (!button) return;
  button.addEventListener('click', () => exportSeasonalCard(button));
}

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

async function exportSeasonalCard(button) {
  const target = document.querySelector('#mod-seasonal .seasonal-card');
  if (!target) return;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'A gerar…';
    }
    await ensureSeasonalExportLibs();
    const doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Performance sazonal', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Receita, ocupação e preço médio vs média histórica por estação', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    const generatedLabel = new Date().toLocaleDateString('pt-PT');
    yPos += 2;

    const contentWidth = pageWidth - 2 * margin;
    const colWidth = contentWidth / 2;
    let currentCol = 0;

    SEASONS.forEach((season, idx) => {
      const card = document.querySelector(`[data-season="${season}"]`);
      if (!card) return;

      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
        currentCol = 0;
      }

      const xPos = margin + currentCol * colWidth;
      const seasonName = { summer: 'Verão', fall: 'Outono', winter: 'Inverno', spring: 'Primavera' }[season];
      const seasonMonths = { summer: 'Jun – Ago', fall: 'Set – Nov', winter: 'Dez – Fev', spring: 'Mar – Mai' }[season];

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(seasonName, xPos + 5, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(seasonMonths, xPos + 5, yPos);
      yPos += 8;

      const revenue = card.querySelector(`#seasonal-${season}-revenue`)?.textContent || '—';
      const occ = card.querySelector(`#seasonal-${season}-occ`)?.textContent || '—';
      const avg = card.querySelector(`#seasonal-${season}-avg`)?.textContent || '—';
      const yoy = card.querySelector(`#seasonal-${season}-yoy`)?.textContent || '—';
      const nights = card.querySelector(`#seasonal-${season}-nights`)?.textContent || '—';
      const revpan = card.querySelector(`#seasonal-${season}-revpan`)?.textContent || '—';
      const rank = card.querySelector(`#seasonal-${season}-rank`)?.textContent || '—';

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const lineHeight = 5.5;
      const labelWidth = 30;
      const data = [
        ['Receita:', revenue],
        ['Ocupação:', occ],
        ['Preço médio:', avg],
        ['YoY:', yoy],
        ['Noites:', nights],
        ['RevPAN:', revpan],
        ['Ranking:', rank]
      ];

      data.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, xPos + 5, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(value, xPos + labelWidth, yPos);
        yPos += lineHeight;
      });

      const insightsEl = card.querySelector(`#seasonal-${season}-insights`);
      if (insightsEl && insightsEl.innerHTML) {
        yPos += 2;
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(80, 80, 80);
        const insightText = Array.from(insightsEl.querySelectorAll('.insight-chip'))
          .map(chip => chip.textContent.trim())
          .join(' • ');
        if (insightText) {
          const wrappedText = doc.splitTextToSize(insightText, colWidth - 10);
          doc.text(wrappedText, xPos + 5, yPos);
          yPos += wrappedText.length * 3.5;
        }
      }

      yPos += 3;
      currentCol++;
      if (currentCol >= 2) {
        currentCol = 0;
        yPos += 5;
      }
    });

    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);
    const footerHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado a ${generatedLabel}`, margin, footerHeight - margin / 2);

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`export-sazonal-${stamp}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar sazonal', error);
    if (button) button.textContent = 'Erro';
    setTimeout(() => {
      if (button) button.textContent = 'Exportar';
    }, 2000);
    return;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Exportar';
    }
  }
}

async function ensureSeasonalExportLibs() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    const module = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (module?.jspdf) window.jspdf = module.jspdf;
  }
}
