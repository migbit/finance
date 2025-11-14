import { db } from './script.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { VIEW_APTS, MONTH_LABELS, formatEuro, valorFatura } from './analisev2-core.js';
const NIGHT_BUCKETS = ['2','3','4','5','6','7','≥8'];
const HOSP_BUCKETS = [1,2,3,4,5,6,7,8];
const NIGHT_BASE_YEAR = 2025;
const HOSP_BASE_YEAR = 2025;
const STAY_BUCKETS = [
  { key: '1-2', label: '1-2 noites', min: 1, max: 2 },
  { key: '3-4', label: '3-4 noites', min: 3, max: 4 },
  { key: '5-6', label: '5-6 noites', min: 5, max: 6 },
  { key: '7+', label: '7+ noites', min: 7, max: Infinity }
];

function clampGuestsCount(row) {
  const adults = Number(row.hospedesAdultos || 0);
  const kids = Number(row.hospedesCriancas || 0);
  const sum = Math.max(1, Math.min(8, adults + kids));
  return sum;
}

function calcExtraGuestsValue(row) {
  const year = Number(row.ano);
  const month = Number(row.mes);
  const guests = clampGuestsCount(row);
  const nights = Number(row.noites || 0);
  if (year < 2025) return 0;
  if (year === 2025 && month < 6) return 0;
  if (guests <= 6 || nights <= 0) return 0;
  return (guests - 6) * 20 * nights;
}

const state = {
  view: 'total',
  rows: [],
  table: 'noites'
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('[data-module="noites-hospedes"]')) return;
  bindButtons();
  await loadRows();
});

window.addEventListener('analisev2:retry', (event) => {
  if (event.detail?.module === 'noites-hospedes') loadRows();
});

function bindButtons() {
  document.querySelectorAll('[data-nohosp-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.nohospView;
      if (!next || next === state.view) return;
      state.view = next;
      updateButtons();
      render();
    });
  });
  updateButtons();

  document.querySelectorAll('[data-table-select]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const table = btn.dataset.tableSelect;
      if (!table || table === state.table) return;
      state.table = table;
      updateTableSelector();
      toggleTables();
    });
  });
  updateTableSelector();
}

function updateButtons() {
  document.querySelectorAll('[data-nohosp-view]').forEach((btn) => {
    const isActive = btn.dataset.nohospView === state.view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateTableSelector() {
  document.querySelectorAll('[data-table-select]').forEach((btn) => {
    const active = btn.dataset.tableSelect === state.table;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

async function loadRows() {
  window.loadingManager?.show('noites-hospedes', { type: 'skeleton' });
  try {
    const q = query(collection(db, 'faturas'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    state.rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!state.rows.length) {
      const msg = '<div class="heatmap-muted">Sem dados disponíveis.</div>';
      renderNoites(msg);
      renderHospedes(msg);
      renderStayLength(msg);
      renderStayRecommendations(null);
      renderNoitesTip([]);
      renderHospedesTip([]);
    } else {
      render();
    }
  } catch (error) {
    window.errorHandler?.handleError('noites-hospedes', error, 'loadRows', loadRows);
    state.rows = [];
    const msg = '<div class="heatmap-muted">Sem dados disponíveis.</div>';
    renderNoites(msg);
    renderHospedes(msg);
    renderStayLength(msg);
    renderStayRecommendations(null);
    renderNoitesTip([]);
    renderHospedesTip([]);
  } finally {
    window.loadingManager?.hide('noites-hospedes');
  }
}

function render() {
  const rows = filterRows(VIEW_APTS[state.view]);
  if (!rows.length) {
    const msg = '<div class="heatmap-muted">Sem dados para esta vista.</div>';
    renderNoites(msg);
    renderHospedes(msg);
    renderStayLength(msg);
    renderStayRecommendations(null);
    renderNoitesTip([]);
    renderHospedesTip([]);
    return;
  }

  renderNoites(buildNoitesTable(rows));
  renderHospedes(buildHospedesTable(rows));
  renderStayLengthSection(rows);
  renderNoitesTip(rows);
  renderHospedesTip(rows);
  toggleTables();
}

function toggleTables() {
  const noites = document.getElementById('tabela-noites-combo');
  const hospedes = document.getElementById('tabela-hospedes-combo');
  const length = document.getElementById('tabela-length-stay');
  const noitesTip = document.getElementById('noites-tip');
  const hospedesTip = document.getElementById('hospedes-tip');
  const lengthTip = document.getElementById('stay-recommendations');
  if (noites) noites.style.display = state.table === 'noites' ? 'block' : 'none';
  if (hospedes) hospedes.style.display = state.table === 'hospedes' ? 'block' : 'none';
  if (length) length.style.display = state.table === 'length' ? 'block' : 'none';
  if (noitesTip) noitesTip.style.display = state.table === 'noites' ? 'block' : 'none';
  if (hospedesTip) hospedesTip.style.display = state.table === 'hospedes' ? 'block' : 'none';
  if (lengthTip) lengthTip.style.display = state.table === 'length' ? 'block' : 'none';
}

function filterRows(apartments) {
  if (!apartments || !apartments.length) return [];
  const allow = new Set(apartments.map(String));
  return state.rows.filter((row) => allow.has(String(row.apartamento)));
}

function renderNoites(html) {
  const target = document.getElementById('tabela-noites-combo');
  if (target) target.innerHTML = html;
}

function renderHospedes(html) {
  const target = document.getElementById('tabela-hospedes-combo');
  if (target) target.innerHTML = html;
}

function buildNoitesTable(rows) {
  const currentYear = new Date().getFullYear();
  if (currentYear < NIGHT_BASE_YEAR) return '<div class="heatmap-muted">Sem dados suficientes.</div>';

  const bucket = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 2) return null;
    return v >= 8 ? '≥8' : String(v);
  };

  const mapCurrent = Array.from({ length: 12 }, () =>
    Object.fromEntries(NIGHT_BUCKETS.map((b) => [b, 0]))
  );

  rows.forEach((row) => {
    const year = Number(row.ano);
    const month = Number(row.mes);
    if (year !== currentYear || year < NIGHT_BASE_YEAR) return;
    if (!month || month < 1 || month > 12) return;
    const cat = bucket(row.noites);
    if (!cat) return;
    mapCurrent[month - 1][cat] += 1;
  });

  const totalsCurrent = Object.fromEntries(NIGHT_BUCKETS.map((b) => [b, 0]));
  let sumCurrent = 0;
  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th>Mês</th>
          ${NIGHT_BUCKETS.map((b) => `<th>${b} noites</th>`).join('')}
          <th>Total mês</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (currentYear >= NIGHT_BASE_YEAR) {
    MONTH_LABELS.forEach((label, idx) => {
      const rowData = mapCurrent[idx];
      const rowTotal = NIGHT_BUCKETS.reduce((sum, key) => sum + rowData[key], 0);
      sumCurrent += rowTotal;
      NIGHT_BUCKETS.forEach((key) => (totalsCurrent[key] += rowData[key]));

      html += `
        <tr>
          <td>${label}</td>
          ${NIGHT_BUCKETS.map((key) => `<td>${rowData[key]}</td>`).join('')}
          <td><strong>${rowTotal}</strong></td>
        </tr>
      `;
    });

    html += `
      <tr>
        <td><strong>Total ${currentYear}</strong></td>
        ${NIGHT_BUCKETS.map((key) => `<td><strong>${totalsCurrent[key]}</strong></td>`).join('')}
        <td><strong>${sumCurrent}</strong></td>
      </tr>
    `;

    if (sumCurrent > 0) {
      const pctValues = NIGHT_BUCKETS.map((key) => ((totalsCurrent[key] || 0) / sumCurrent) * 100);
      const maxPct = Math.max(...pctValues);
      const minPct = Math.min(...pctValues);
      html += '<tr><td><strong>%</strong></td>';
      pctValues.forEach((pct) => {
        const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
        const color = pctGradient(pct, minPct, maxPct);
        html += `<td class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
      });
      html += '<td class="pct-cell"><strong>100%</strong></td></tr>';
    }
  }

  const previousYears = Array.from(new Set(
    rows.map((row) => Number(row.ano))
  ))
    .filter((year) => year >= NIGHT_BASE_YEAR && year < currentYear)
    .sort((a, b) => b - a);

  previousYears.forEach((year) => {
    const totals = Object.fromEntries(NIGHT_BUCKETS.map((b) => [b, 0]));
    let totalYear = 0;

    rows.forEach((row) => {
      if (Number(row.ano) !== year) return;
      const cat = bucket(row.noites);
      if (!cat) return;
      totals[cat] += 1;
      totalYear += 1;
    });

    html += `
      <tr style="background-color:#f2f2f2;">
        <td><strong>Total ${year}</strong></td>
        ${NIGHT_BUCKETS.map((key) => `<td><strong>${totals[key]}</strong></td>`).join('')}
        <td><strong>${totalYear}</strong></td>
      </tr>
    `;

    if (totalYear > 0) {
      const pctValues = NIGHT_BUCKETS.map((key) => ((totals[key] || 0) / totalYear) * 100);
      const maxPct = Math.max(...pctValues);
      const minPct = Math.min(...pctValues);
      html += '<tr style="background-color:#f2f2f2;"><td><strong>%</strong></td>';
      pctValues.forEach((pct) => {
        const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
        const color = pctGradient(pct, minPct, maxPct);
        html += `<td class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
      });
      html += '<td class="pct-cell"><strong>100%</strong></td></tr>';
    }
  });

  html += '</tbody></table>';
  return html;
}

function buildHospedesTable(rows) {
  const currentYear = new Date().getFullYear();
  if (currentYear < HOSP_BASE_YEAR) return '<div class="heatmap-muted">Sem dados suficientes.</div>';

  const mapCurrent = Array.from({ length: 12 }, () =>
    Object.fromEntries(HOSP_BUCKETS.map((h) => [h, { n: 0, v: 0 }]))
  );

  rows.forEach((row) => {
    const year = Number(row.ano);
    const month = Number(row.mes);
    if (year !== currentYear || year < HOSP_BASE_YEAR) return;
    if (!month || month < 1 || month > 12) return;

    const guests = clampGuestsCount(row);
    const value = calcExtraGuestsValue(row);
    mapCurrent[month - 1][guests].n += 1;
    mapCurrent[month - 1][guests].v += value;
  });

  const totalsByGuests = Object.fromEntries(HOSP_BUCKETS.map((h) => [h, { n: 0, v: 0 }]));
  const totalsOverall = { n: 0, v: 0 };

  let html = `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th rowspan="2">Mês</th>
          ${HOSP_BUCKETS.map((h) => `<th colspan="2">${h} Hósp.</th>`).join('')}
          <th colspan="2">Total</th>
        </tr>
        <tr>
          ${HOSP_BUCKETS.map(() => '<th>N.</th><th>V</th>').join('')}
          <th>N.</th><th>V</th>
        </tr>
      </thead>
      <tbody>
  `;

  MONTH_LABELS.forEach((label, idx) => {
    let rowTotalN = 0;
    let rowTotalV = 0;
    html += `<tr><td>${label}</td>`;
    HOSP_BUCKETS.forEach((bucket) => {
      const entry = mapCurrent[idx][bucket];
      const showValue = bucket <= 6 ? '' : formatEuro(entry.v);
      html += `<td style="text-align:center">${entry.n}</td><td style="text-align:center">${showValue}</td>`;
      totalsByGuests[bucket].n += entry.n;
      totalsByGuests[bucket].v += entry.v;
      rowTotalN += entry.n;
      rowTotalV += entry.v;
    });
    totalsOverall.n += rowTotalN;
    totalsOverall.v += rowTotalV;
    html += `<td style="text-align:center"><strong>${rowTotalN}</strong></td><td style="text-align:center"><strong>${formatEuro(rowTotalV)}</strong></td></tr>`;
  });

  html += `
    <tr>
      <td><strong>Total ${currentYear}</strong></td>
      ${HOSP_BUCKETS.map((bucket) => {
        const entry = totalsByGuests[bucket];
        const showValue = bucket <= 6 ? '' : formatEuro(entry.v);
        return `<td style="text-align:center"><strong>${entry.n}</strong></td><td style="text-align:center"><strong>${showValue}</strong></td>`;
      }).join('')}
      <td style="text-align:center"><strong>${totalsOverall.n}</strong></td>
      <td style="text-align:center"><strong>${formatEuro(totalsOverall.v)}</strong></td>
    </tr>
  `;

  if (totalsOverall.n > 0) {
    const pctValues = HOSP_BUCKETS.map((bucket) => (totalsByGuests[bucket].n / totalsOverall.n) * 100);
    const maxPct = Math.max(...pctValues);
    const minPct = Math.min(...pctValues);
    html += '<tr><td><strong>%</strong></td>';
    pctValues.forEach((pct) => {
      const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
      const color = pctGradient(pct, minPct, maxPct);
      html += `<td colspan="2" class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
    });
    html += '<td colspan="2" class="pct-cell"><strong>100%</strong></td></tr>';
  }

  const previousYears = Array.from(new Set(
    rows.map((row) => Number(row.ano))
  ))
    .filter((year) => year >= HOSP_BASE_YEAR && year < currentYear)
    .sort((a, b) => b - a);

  previousYears.forEach((year) => {
    const totals = Object.fromEntries(HOSP_BUCKETS.map((h) => [h, { n: 0, v: 0 }]));
    let sumN = 0;
    let sumV = 0;

    rows.forEach((row) => {
      if (Number(row.ano) !== year) return;
      const month = Number(row.mes);
      if (!month || month < 1 || month > 12) return;
      const guests = clampGuestsCount(row);
      const value = calcExtraGuestsValue(row);
      totals[guests].n += 1;
      totals[guests].v += value;
      sumN += 1;
      sumV += value;
    });

    html += `<tr style="background-color:#f2f2f2;">
      <td><strong>Total ${year}</strong></td>
      ${HOSP_BUCKETS.map((bucket) => {
        const entry = totals[bucket];
        const showValue = bucket <= 6 ? '' : formatEuro(entry.v);
        return `<td style="text-align:center"><strong>${entry.n}</strong></td><td style="text-align:center"><strong>${showValue}</strong></td>`;
      }).join('')}
      <td style="text-align:center"><strong>${sumN}</strong></td>
      <td style="text-align:center"><strong>${formatEuro(sumV)}</strong></td>
    </tr>`;

    if (sumN > 0) {
      const pctValues = HOSP_BUCKETS.map((bucket) => (totals[bucket].n / sumN) * 100);
      const maxPct = Math.max(...pctValues);
      const minPct = Math.min(...pctValues);
      html += `<tr style="background-color:#f2f2f2;">
        <td><strong>%</strong></td>
        ${pctValues.map((pct) => {
          const highlight = pct === maxPct && maxPct > 0 ? ' pct-highlight' : '';
          const color = pctGradient(pct, minPct, maxPct);
          return `<td colspan="2" class="pct-cell${highlight}" style="background:${color}"><strong>${pct.toFixed(1)}%</strong></td>`;
        }).join('')}
        <td colspan="2" class="pct-cell"><strong>100%</strong></td>
      </tr>`;
    }
  });

  html += '</tbody></table>';
  return html;
}

function renderStayLengthSection(rows) {
  const stats = computeStayLengthStats(rows);
  const html = buildStayLengthTable(stats);
  renderStayLength(html);
  renderStayRecommendations(stats);
}

function computeStayLengthStats(rows) {
  const stats = STAY_BUCKETS.map((bucket) => ({ ...bucket, count: 0, nights: 0, revenue: 0 }));
  const totals = { revenue: 0, nights: 0 };

  rows.forEach((row) => {
    const nights = Number(row.noites || 0);
    if (!nights || nights < 1) return;
    const bucket = findStayBucket(nights);
    if (!bucket) return;
    const slot = stats.find((item) => item.key === bucket.key);
    const revenue = valorFatura(row);
    slot.count += 1;
    slot.nights += nights;
    slot.revenue += revenue;
    totals.revenue += revenue;
    totals.nights += nights;
  });

  stats.forEach((bucket) => {
    bucket.avgNightly = bucket.nights ? bucket.revenue / bucket.nights : 0;
    bucket.revenueShare = totals.revenue ? (bucket.revenue / totals.revenue) * 100 : 0;
  });

  return { buckets: stats, totals };
}

function buildStayLengthTable(stats) {
  if (!stats?.buckets?.length) return '<div class="heatmap-muted">Sem reservas com noites registadas.</div>';
  const rows = stats.buckets.map((bucket) => `
    <tr>
      <td>${bucket.label}</td>
      <td>${bucket.count}</td>
      <td>${bucket.nights}</td>
      <td>${bucket.avgNightly ? formatEuro(bucket.avgNightly) : '—'}</td>
      <td>${bucket.revenueShare ? bucket.revenueShare.toFixed(1) : '0.0'}%</td>
    </tr>
  `).join('');

  return `
    <table class="media-faturacao">
      <thead>
        <tr>
          <th>Duração</th>
          <th>Reservas</th>
          <th>Noites</th>
          <th>Preço médio</th>
          <th>% receita</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderStayLength(html) {
  const target = document.getElementById('tabela-length-stay');
  if (target) target.innerHTML = html;
}

function renderStayRecommendations(stats) {
  const target = document.getElementById('stay-recommendations');
  if (!target) return;
  if (!stats?.buckets?.length) {
    target.innerHTML = '<p>Sem dados de estadias para recomendar ajustes.</p>';
    target.style.display = state.table === 'length' ? 'block' : 'none';
    return;
  }
  const dominant = stats.buckets.reduce((best, bucket) => bucket.revenueShare > best.revenueShare ? bucket : best, stats.buckets[0]);
  const longStay = stats.buckets[stats.buckets.length - 1];
  const shortStay = stats.buckets[0];
  const dominantText = `${dominant.label} representam ${dominant.revenueShare.toFixed(1)}% da receita a ${formatEuro(dominant.avgNightly)} /noite.`;
  let hint = 'Equilíbrio saudável entre estadias curtas e longas.';
  if (longStay.avgNightly && shortStay.avgNightly && longStay.avgNightly + 10 < shortStay.avgNightly) {
    hint = `7+ noites rendem ${formatEuro(longStay.avgNightly)} vs ${formatEuro(shortStay.avgNightly)} nas curtas – use mínimos flexíveis e adiciona fee quando preencher semanas críticas.`;
  } else if (shortStay.count > longStay.count * 1.5) {
    hint = 'Curta duração domina – considere exigir 3 noites em fins-de-semana para elevar ticket médio.';
  }
  target.innerHTML = `<p>${dominantText} ${hint}</p>`;
  target.style.display = state.table === 'length' ? 'block' : 'none';
}

function findStayBucket(nights) {
  return STAY_BUCKETS.find((bucket) => nights >= bucket.min && nights <= bucket.max) || STAY_BUCKETS[STAY_BUCKETS.length - 1];
}

function renderNoitesTip(rows) {
  const target = document.getElementById('noites-tip');
  if (!target) return;
  if (!rows?.length) {
    target.innerHTML = '<p>Sem dados suficientes sobre duração das estadias.</p>';
    return;
  }
  const stats = computeStayLengthStats(rows);
  if (!stats?.buckets?.length) {
    target.innerHTML = '<p>Sem dados suficientes sobre duração das estadias.</p>';
    return;
  }
  const dominant = stats.buckets.reduce((best, bucket) =>
    bucket.revenueShare > best.revenueShare ? bucket : best, stats.buckets[0]);
  const longStay = stats.buckets[stats.buckets.length - 1];
  const shortStay = stats.buckets[0];
  const baseText = `${dominant.label} representam ${dominant.revenueShare.toFixed(1)}% da receita a ${formatEuro(dominant.avgNightly)} /noite.`;
  let hint = '';
  if (longStay.avgNightly && shortStay.avgNightly && longStay.avgNightly + 10 < shortStay.avgNightly) {
    hint = ` 7+ noites rendem ${formatEuro(longStay.avgNightly)} vs ${formatEuro(shortStay.avgNightly)} nas curtas – use mínimos flexíveis e adiciona fee quando preencher semanas críticas.`;
  } else if (shortStay.count > longStay.count * 1.5) {
    hint = ' Curta duração domina – considere exigir 3 noites ao fim de semana para elevar ticket médio.';
  }
  const compare = buildNoitesCompareSummary();
  const seasonal = buildSeasonalStayPattern(rows);
  target.innerHTML = `<p>${baseText}${hint}</p>${compare ? `<p class="tip-compare">${compare}</p>` : ''}${seasonal ? `<p class="tip-seasonal">${seasonal}</p>` : ''}`;
}

function renderHospedesTip(rows) {
  const target = document.getElementById('hospedes-tip');
  if (!target) return;
  if (!rows?.length) {
    target.innerHTML = '<p>Sem dados suficientes sobre hóspedes por reserva.</p>';
    return;
  }
  const insights = computeGuestInsights(rows);
  if (!insights.total) {
    target.innerHTML = '<p>Sem dados suficientes sobre hóspedes por reserva.</p>';
    return;
  }
  const dominant = insights.stats.reduce((best, entry) =>
    entry.share > best.share ? entry : best, insights.stats[0]);
  const baseText = `${dominant.bucket} hóspedes representam ${dominant.share.toFixed(1)}% das reservas.`;
  const extraText = insights.extraTotal
    ? `Hóspedes extra (>6) já renderam ${formatEuro(insights.extraTotal)} em taxas este ano.`
    : 'Ainda não foram cobradas taxas de hóspedes extra.';
  let hint = '';
  if (dominant.bucket >= 7) {
    hint = ' A maioria das reservas leva grupos grandes – garanta que a taxa adicional está ativa em todas as OTAs.';
  } else if (dominant.bucket <= 4) {
    hint = ' Perfil familiar baixo – pode promover upgrades com hóspedes extra para aumentar receita.';
  }
  const compare = buildHospedesCompareSummary();
  target.innerHTML = `<p>${hint || extraText}</p>${hint ? `<p>${extraText}</p>` : ''}${compare ? `<p class="tip-compare">${compare}</p>` : ''}`;
}

function computeGuestInsights(rows) {
  const stats = HOSP_BUCKETS.map((bucket) => ({ bucket, count: 0, extraTotal: 0, share: 0 }));
  let total = 0;
  let extraTotal = 0;
  rows.forEach((row) => {
    const guests = clampGuestsCount(row);
    const idx = HOSP_BUCKETS.indexOf(guests);
    if (idx === -1) return;
    stats[idx].count += 1;
    total += 1;
    const extra = calcExtraGuestsValue(row);
    stats[idx].extraTotal += extra;
    extraTotal += extra;
  });
  stats.forEach((entry) => {
    entry.share = total ? (entry.count / total) * 100 : 0;
  });
  return { stats, total, extraTotal };
}

function buildNoitesCompareSummary() {
  const rows1248 = filterRows(VIEW_APTS['1248']);
  const rows123 = filterRows(VIEW_APTS['123']);
  if (!rows1248.length || !rows123.length) return '';
  const stats1248 = computeStayLengthStats(rows1248);
  const stats123 = computeStayLengthStats(rows123);
  const shortKey = STAY_BUCKETS[0].key;
  const short1248 = stats1248.buckets.find((b) => b.key === shortKey)?.avgNightly || 0;
  const short123 = stats123.buckets.find((b) => b.key === shortKey)?.avgNightly || 0;
  if (!short1248 || !short123) return '';
  const leader = short1248 >= short123 ? '1248' : '123';
  const diff = Math.abs(short1248 - short123);
  if (diff < 1) return '';
  return `Comparação 1248 vs 123: Apt ${leader} cobra ${formatEuro(diff)} a mais em estadias 1-2 noites.`;
}

function buildSeasonalStayPattern(rows) {
  const summerMonths = new Set([6, 7, 8]);
  const winterMonths = new Set([12, 1, 2]);
  const summer = rows.filter((row) => summerMonths.has(Number(row.mes)));
  const winter = rows.filter((row) => winterMonths.has(Number(row.mes)));
  if (!summer.length || !winter.length) return '';
  const averageNights = (list) => list.reduce((sum, row) => sum + (Number(row.noites) || 0), 0) / list.length;
  const summerAvg = averageNights(summer);
  const winterAvg = averageNights(winter);
  const diff = Math.abs(summerAvg - winterAvg);
  if (!Number.isFinite(diff) || diff < 0.5) return '';
  return `Sazonalidade: Verão ${summerAvg.toFixed(1)} noites vs Inverno ${winterAvg.toFixed(1)} noites.`;
}

function buildHospedesCompareSummary() {
  const rows1248 = filterRows(VIEW_APTS['1248']);
  const rows123 = filterRows(VIEW_APTS['123']);
  if (!rows1248.length || !rows123.length) return '';
  const insights1248 = computeGuestInsights(rows1248);
  const insights123 = computeGuestInsights(rows123);
  const diff = (insights1248.extraTotal || 0) - (insights123.extraTotal || 0);
  if (Math.abs(diff) < 1) return '';
  const leader = diff >= 0 ? '1248' : '123';
  return `Comparação 1248 vs 123: Apt ${leader} gera ${formatEuro(Math.abs(diff))} a mais em taxas de hóspedes extra.`;
}

function pctGradient(value, min, max) {
  if (!Number.isFinite(value)) return '#e2e8f0';
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-6) {
    return '#d1fae5';
  }
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const t = (clamp(value) - min) / (max - min);
  const lerp = (a, b, k) => Math.round(a + (b - a) * k);
  const green = [22, 163, 74];
  const red = [220, 38, 38];
  const r = lerp(green[0], red[0], t);
  const g = lerp(green[1], red[1], t);
  const b = lerp(green[2], red[2], t);
  return `rgb(${r}, ${g}, ${b})`;
}
