import { db } from './script.js';
import { showToast } from './toast.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const ACCESS_COLLECTION = 'cleaning_hours_access';
const ENTRIES_COLLECTION = 'cleaning_hours_entries';
const PUBLIC_APP_ORIGIN = 'https://apartments-a4b17.web.app';

const manualEntryForm = document.getElementById('manual-hours-form');
const manualEntryDate = document.getElementById('manual-entry-date');
const manualEntryHours = document.getElementById('manual-entry-hours');
const manualEntryApartment = document.getElementById('manual-entry-apartment');
const calendarShareLinks = document.getElementById('calendar-share-links');

const filterYear = document.getElementById('hours-filter-year');
const filterMonth = document.getElementById('hours-filter-month');
const filterApartment = document.getElementById('hours-filter-apartment');
const summaryWrap = document.getElementById('hours-summary');
const entriesBody = document.getElementById('hours-entries-body');
const syncPill = document.getElementById('hours-sync-pill');
const syncMeta = document.getElementById('hours-sync-meta');

let savingEntry = false;

function getNatally() {
  return accessRows.find((row) => String(row.employeeName || '').trim().toLowerCase().split(/\s+/)[0] === 'natally')
    || accessRows.find((row) => /(^|-)natally($|-)/i.test(row.employeeId || row.id || ''));
}

let accessRows = [];
let entryRows = [];
let liveEntrySignature = '';
let renderedEntrySignature = '';
let liveEntryCount = 0;
let liveLastUpdatedAt = '';
let unsubscribeEntries = null;

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  populateMonthSelect();
  filterYear.value = String(now.getFullYear());
  filterMonth.value = String(now.getMonth() + 1).padStart(2, '0');
  if (manualEntryDate) manualEntryDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  manualEntryForm?.addEventListener('submit', handleManualEntry);
  document.querySelectorAll('[data-hours]').forEach((button) => {
    button.addEventListener('click', () => {
      manualEntryHours.value = button.dataset.hours;
      manualEntryHours.focus();
    });
  });
  filterYear?.addEventListener('change', renderEntries);
  filterMonth?.addEventListener('change', renderEntries);
  filterApartment?.addEventListener('change', renderEntries);
  document.getElementById('copy-monthly-summary')?.addEventListener('click', copyMonthlySummary);

  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (unsubscribeEntries) {
        unsubscribeEntries();
        unsubscribeEntries = null;
      }
      accessRows = [];
      entryRows = [];
      setSyncState('warning', 'Login necessário', 'Inicia sessão para carregar os dados do Firebase.');
      renderCalendarShareLinks();
      if (entriesBody) entriesBody.innerHTML = '<tr><td colspan="5" class="empty-state">Inicia sessão para ver os registos.</td></tr>';
      if (summaryWrap) summaryWrap.innerHTML = '';
      return;
    }

    try {
      await loadAccessRows();
      populateApartmentFilter();
      renderCalendarShareLinks();
      renderEntries();
      if (!unsubscribeEntries) {
        setupLiveEntriesListener();
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar horas de limpeza.', 'error');
    }
  });
});

async function loadAccessRows() {
  const snap = await getDocs(query(collection(db, ACCESS_COLLECTION), orderBy('employeeName')));
  accessRows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function renderCalendarShareLinks() {
  if (!calendarShareLinks) return;

  const employee = getNatally();
  const activeRows = employee?.active !== false && employee?.shareToken ? [employee] : [];
  if (!activeRows.length) {
    calendarShareLinks.innerHTML = '<span class="sync-meta">Ainda não existe um link ativo.</span>';
    return;
  }

  calendarShareLinks.innerHTML = activeRows.map((row) => {
    const shareUrl = buildShareUrl(row.shareToken);
    return `
      <div class="calendar-share-link">
        <a href="${escapeAttr(shareUrl)}" target="_blank" rel="noopener noreferrer">Abrir calendário da Natally ↗</a>
        <button type="button" class="btn" data-copy-calendar-link="${escapeAttr(shareUrl)}">Copiar link</button>
      </div>
    `;
  }).join('');

  calendarShareLinks.querySelectorAll('[data-copy-calendar-link]').forEach((button) => {
    button.addEventListener('click', async () => {
      const shareUrl = button.getAttribute('data-copy-calendar-link') || '';
      if (!shareUrl) return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link da funcionária copiado.', 'success');
      } catch (error) {
        console.error(error);
        showToast('Não foi possível copiar o link.', 'error');
      }
    });
  });
}

function renderEntries() {
  if (!entriesBody) return;

  const filtered = applyFilters(entryRows);
  liveEntrySignature = createEntrySignature(filtered);
  renderedEntrySignature = createEntrySignature(filtered);
  renderSummary(filtered);
  updateSyncStatus();

  if (!filtered.length) {
    entriesBody.innerHTML = '<tr><td colspan="5" class="empty-state">Sem registos para os filtros selecionados.</td></tr>';
    return;
  }

  entriesBody.innerHTML = filtered.map((row) => `
    <tr>
      <td>${escapeHtml(formatPtDate(row.date))}</td>
      <td>${Number(row.hours || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
      <td>${escapeHtml(row.apartment || '-')}</td>
      <td>${formatEuroNumber(getEntryAmount(row))} €</td>
      <td>${renderActionsCell(row)}</td>
    </tr>
  `).join('');

  entriesBody.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => editEntry(button.getAttribute('data-edit-id')));
  });
  entriesBody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => deleteEntry(button.getAttribute('data-delete-id')));
  });
}

function renderSummary(rows) {
  if (!summaryWrap) return;

  const totalHours = rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
  const total123 = rows.reduce((sum, row) => sum + getSplitHours(row, '123'), 0);
  const total1248 = rows.reduce((sum, row) => sum + getSplitHours(row, '1248'), 0);
  const totalAmount = rows.reduce((sum, row) => sum + getEntryAmount(row), 0);

  summaryWrap.innerHTML = `
    <div class="kpi-card">
      <span>Total de horas</span>
      <strong>${totalHours.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
    </div>
    <div class="kpi-card">
      <span>Apartamento 123</span>
      <strong>${total123.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
    </div>
    <div class="kpi-card">
      <span>Apartamento 1248</span>
      <strong>${total1248.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
    </div>
    <div class="kpi-card">
      <span>Total a transferir</span>
      <strong>${formatEuroNumber(totalAmount)} €</strong>
    </div>
  `;
}

function applyFilters(rows) {
  const employee = getNatally();
  const year = filterYear?.value || '';
  const month = filterMonth?.value || '';
  const apartment = filterApartment?.value || '';

  return rows.filter((row) => {
    if (!employee || row.employeeId !== (employee.employeeId || employee.id)) return false;
    const rowDate = String(row.date || '');
    if (year && !rowDate.startsWith(`${year}-`)) return false;
    if (month && rowDate.slice(5, 7) !== month) return false;
    if (apartment && row.apartment !== apartment) return false;
    return true;
  });
}

function populateApartmentFilter() {
  if (!filterApartment) return;

  const current = filterApartment.value;
  const values = new Set();

  values.add('123');
  values.add('1248');
  values.add('Ambos');
  values.add('Ferro 123');
  values.add('Ferro 1248');
  values.add('Ferro Ambos');
  entryRows.forEach((row) => {
    if (row.apartment) values.add(row.apartment);
  });

  const options = Array.from(values).sort((a, b) => a.localeCompare(b, 'pt')).map((value) =>
    `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`
  ).join('');

  filterApartment.innerHTML = `<option value="">Todos</option>${options}`;
  filterApartment.value = current;
}

async function handleManualEntry(event) {
  event.preventDefault();

  if (savingEntry) return;
  const employee = getNatally();
  const employeeId = employee?.employeeId || employee?.id || '';
  const date = manualEntryDate?.value || '';
  const hours = Number(String(manualEntryHours?.value || '').replace(',', '.'));
  const apartment = manualEntryApartment?.value || '';

  if (!employeeId || !date || !Number.isFinite(hours) || hours <= 0 || !['123', '1248', 'Ambos', 'Ferro 123', 'Ferro 1248', 'Ferro Ambos'].includes(apartment)) {
    showToast(employeeId ? 'Preenche os dados da entrada manual.' : 'Não foi possível encontrar a configuração da Natally. Recarrega a página.', 'warning');
    return;
  }

  savingEntry = true;
  const submitButton = manualEntryForm?.querySelector('[type=submit]');
  if (submitButton) submitButton.disabled = true;
  try {
    await addDoc(collection(db, ENTRIES_COLLECTION), {
      employeeId,
      employeeName: employee.employeeName || employeeId,
      date,
      hours,
      apartment,
      approved: true,
      approvedAt: serverTimestamp(),
      source: 'admin_manual',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    if (manualEntryHours) manualEntryHours.value = '';
    filterYear.value = date.slice(0, 4);
    if (!filterYear.value) {
      filterYear.add(new Option(date.slice(0, 4), date.slice(0, 4)));
      filterYear.value = date.slice(0, 4);
    }
    filterMonth.value = date.slice(5, 7);
    filterApartment.value = '';
    renderEntries();
    manualEntryHours?.focus();
    const feedback = document.getElementById('entry-feedback');
    if (feedback) feedback.textContent = `${hours.toLocaleString('pt-PT')} h · ${apartment} · ${formatPtDate(date)} — guardado`;
    showToast('Horas guardadas.', 'success');
  } catch (error) {
    console.error(error);
    showToast('Erro ao adicionar entrada manual.', 'error');
  } finally {
    savingEntry = false;
    if (submitButton) submitButton.disabled = false;
  }
}

function buildShareUrl(shareToken) {
  const root = new URL('/horas-limpeza.html', getPublicAppOrigin());
  if (shareToken) root.searchParams.set('token', shareToken);
  return root.toString();
}

function getPublicAppOrigin() {
  return PUBLIC_APP_ORIGIN;
}

function getSplitHours(row, apartment) {
  const hours = Number(row.hours) || 0;
  if (row.apartment === apartment) return hours;
  if (row.apartment === 'Ambos') return hours / 2;
  if (row.apartment === `Ferro ${apartment}`) return hours;
  if (row.apartment === 'Ferro Ambos') return hours / 2;
  return 0;
}

function setupLiveEntriesListener() {
  const entriesQuery = query(collection(db, ENTRIES_COLLECTION), orderBy('date', 'desc'));
  unsubscribeEntries = onSnapshot(entriesQuery, (snap) => {
    entryRows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    liveEntryCount = entryRows.length;
    liveLastUpdatedAt = getLatestTimestamp(entryRows);
    populateYearSelect();
    liveEntrySignature = createEntrySignature(applyFilters(entryRows));
    renderEntries();
  }, (error) => {
    console.error(error);
    showToast('Erro ao sincronizar com o Firebase.', 'error');
    setSyncState('warning', 'Erro de sincronização', 'Não foi possível confirmar os dados mais recentes.');
  });
}

function createEntrySignature(rows) {
  return rows.map((row) => {
    const updatedAt = toMillis(row.updatedAt);
    return [
      row.id || '',
      row.date || '',
      row.apartment || '',
      Number(row.hours || 0),
      row.approved ? 1 : 0,
      updatedAt
    ].join('|');
  }).join('||');
}

function getLatestTimestamp(rows) {
  let latest = 0;
  rows.forEach((row) => {
    latest = Math.max(latest, toMillis(row.updatedAt), toMillis(row.approvedAt));
  });
  return latest;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateSyncStatus() {
  const meta = [];

  if (liveLastUpdatedAt) meta.push(`Última alteração: ${formatDateTime(liveLastUpdatedAt)}`);

  if (!renderedEntrySignature && !liveEntrySignature) {
    setSyncState('neutral', 'Sem dados', meta.join(' • '));
    return;
  }

  if (renderedEntrySignature === liveEntrySignature) {
    setSyncState('ok', '✓ Atualizado', meta.join(' • '));
    return;
  }

  setSyncState('warning', 'Vista desatualizada', `${meta.join(' • ')} • Reaplica os filtros ou recarrega.`);
}

function setSyncState(type, label, meta) {
  if (syncPill) {
    syncPill.textContent = label;
    syncPill.className = `sync-pill${type === 'warning' ? ' is-warning' : type === 'neutral' ? ' is-neutral' : ''}`;
  }
  if (syncMeta) {
    syncMeta.textContent = meta || '';
  }
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-PT');
}

function populateYearSelect() {
  if (!filterYear) return;
  const current = filterYear.value;
  const years = new Set([String(new Date().getFullYear())]);
  entryRows.forEach((row) => {
    const year = String(row.date || '').slice(0, 4);
    if (year) years.add(year);
  });
  const sorted = Array.from(years).sort((a, b) => Number(b) - Number(a));
  filterYear.innerHTML = sorted.map((year) => `<option value="${escapeAttr(year)}">${escapeHtml(year)}</option>`).join('');
  filterYear.value = sorted.includes(current) ? current : sorted[0];
}

function populateMonthSelect() {
  if (!filterMonth) return;
  const months = [
    ['01', 'Janeiro'],
    ['02', 'Fevereiro'],
    ['03', 'Março'],
    ['04', 'Abril'],
    ['05', 'Maio'],
    ['06', 'Junho'],
    ['07', 'Julho'],
    ['08', 'Agosto'],
    ['09', 'Setembro'],
    ['10', 'Outubro'],
    ['11', 'Novembro'],
    ['12', 'Dezembro'],
  ];
  filterMonth.innerHTML = months.map(([value, label]) =>
    `<option value="${value}">${label}</option>`
  ).join('');
}

function getHourlyRate(employeeId) {
  const employee = accessRows.find((row) => (row.employeeId || row.id) === employeeId);
  return Number(employee?.hourlyRate || 0);
}

async function copyMonthlySummary() {
  const rows = applyFilters(entryRows).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) {
    showToast('Sem horas para copiar neste período.', 'warning');
    return;
  }
  const lines = [
    `Horas da Natally · ${filterMonth.selectedOptions[0].textContent} ${filterYear.value}`,
    ...(filterApartment.value ? [`Filtro: ${filterApartment.value}`] : []),
    ...rows.map((row) => `${formatPtDate(row.date)} · ${row.apartment} · ${Number(row.hours).toLocaleString('pt-PT')} h`),
    '',
    `Total: ${rows.reduce((sum, row) => sum + Number(row.hours || 0), 0).toLocaleString('pt-PT')} h`,
    `Total a transferir: ${formatEuroNumber(rows.reduce((sum, row) => sum + getEntryAmount(row), 0))} €`
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast('Resumo copiado para enviares à Natally.', 'success');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível copiar o resumo.', 'error');
  }
}

function getEntryAmount(row) {
  return (Number(row.hours) || 0) * getHourlyRate(row.employeeId);
}

function formatEuroNumber(value) {
  return Number(value || 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderActionsCell(row) {
  return `
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="btn" data-edit-id="${escapeAttr(row.id)}">Editar</button>
      <button type="button" class="btn" data-delete-id="${escapeAttr(row.id)}">Apagar</button>
    </div>
  `;
}

async function editEntry(entryId) {
  const row = entryRows.find((item) => item.id === entryId);
  if (!row) return;

  const newDate = window.prompt('Data (YYYY-MM-DD):', row.date || '');
  if (newDate === null) return;
  const trimmedDate = String(newDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    showToast('Data inválida.', 'warning');
    return;
  }

  const newHoursRaw = window.prompt('Horas:', String(row.hours ?? ''));
  if (newHoursRaw === null) return;
  const newHours = Number(String(newHoursRaw).replace(',', '.'));
  if (!Number.isFinite(newHours) || newHours < 0) {
    showToast('Horas inválidas.', 'warning');
    return;
  }

  const newApartment = window.prompt('Apartamento (123, 1248, Ambos, Ferro 123, Ferro 1248 ou Ferro Ambos):', row.apartment || '');
  if (newApartment === null) return;
  const apartment = String(newApartment).trim();
  if (!['123', '1248', 'Ambos', 'Ferro 123', 'Ferro 1248', 'Ferro Ambos'].includes(apartment)) {
    showToast('Apartamento inválido.', 'warning');
    return;
  }

  try {
    await updateDoc(doc(db, ENTRIES_COLLECTION, entryId), {
      date: trimmedDate,
      hours: newHours,
      apartment,
      approved: true,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    showToast('Registo editado.', 'success');
  } catch (error) {
    console.error(error);
    showToast('Erro ao editar registo.', 'error');
  }
}

async function deleteEntry(entryId) {
  const row = entryRows.find((item) => item.id === entryId);
  if (!row) return;
  const confirmed = window.confirm(`Apagar o registo de ${formatPtDate(row.date)}?`);
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, ENTRIES_COLLECTION, entryId));
    showToast('Registo apagado.', 'success');
  } catch (error) {
    console.error(error);
    showToast('Erro ao apagar registo.', 'error');
  }
}

function formatPtDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
