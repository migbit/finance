import { formatEuro } from './analisev2-core.js';
import { getFaturas } from './analisev3-data.js';
import { bucketLeadTimes } from './analisev3-metrics.js';

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="leadtime"]')) return;
  await renderLeadtime();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'leadtime') renderLeadtime();
});

async function renderLeadtime() {
  window.loadingManager?.show('leadtime', { type: 'skeleton' });
  try {
    const faturas = await getFaturas();
    const { rows, total } = bucketLeadTimes(faturas);
    if (!total) {
      setTable('<div class="heatmap-muted">Sem reservas com datas de reserva/check-in.</div>');
      setSummary('Ainda sem dados para lead time.');
      return;
    }
    renderTable(rows);
    renderSummary(rows);
  } catch (error) {
    window.errorHandler?.handleError('leadtime', error, 'renderLeadtime', renderLeadtime);
    setTable('<div class="heatmap-muted">Erro ao calcular lead time.</div>');
    setSummary('Sem dados.');
  } finally {
    window.loadingManager?.hide('leadtime');
  }
}

function renderTable(rows) {
  const html = [`<table class="media-faturacao"><thead><tr><th>Lead time</th><th>Reservas</th><th>Preço médio</th><th>% do total</th></tr></thead><tbody>`];
  rows.forEach((row) => {
    html.push(`<tr>
      <td>${row.label}</td>
      <td>${row.count}</td>
      <td>${row.avgPrice ? formatEuro(row.avgPrice) : '—'}</td>
      <td>${row.pct.toFixed(1)}%</td>
    </tr>`);
  });
  html.push('</tbody></table>');
  setTable(html.join(''));
}

function renderSummary(rows) {
  const hottest = rows.reduce((best, row) => (row.pct > best.pct ? row : best), rows[0]);
  const lastMinute = rows.find((row) => row.key === '0-7');
  const summaryParts = [];
  if (hottest) {
    summaryParts.push(`${hottest.label} representa ${hottest.pct.toFixed(1)}% das reservas (${formatEuro(hottest.avgPrice)} médio).`);
  }
  if (lastMinute && lastMinute.pct >= 20) {
    summaryParts.push('Última hora acima de 20% → ajuste mínimos e reforçe preços dinâmicos.');
  }
  setSummary(summaryParts.join(' '));
}

function setTable(html) {
  const el = document.getElementById('leadtime-table');
  if (el) el.innerHTML = html;
}

function setSummary(text) {
  const el = document.getElementById('leadtime-summary');
  if (el) el.textContent = text;
}
