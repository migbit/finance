import { db } from './script.js';
import { showToast } from './toast.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const ACCESS_COLLECTION = 'cleaning_hours_access';
const ENTRIES_COLLECTION = 'cleaning_hours_entries';

const accessForm = document.getElementById('cleaning-access-form');
const accessList = document.getElementById('access-list');
const generatedLinkBox = document.getElementById('generated-link-box');
const generatedLinkAnchor = document.getElementById('generated-link');
const copyGeneratedLinkBtn = document.getElementById('copy-generated-link');
const manualEntryForm = document.getElementById('manual-hours-form');
const manualEntryEmployee = document.getElementById('manual-entry-employee');
const manualEntryDate = document.getElementById('manual-entry-date');
const manualEntryHours = document.getElementById('manual-entry-hours');
const manualEntryApartment = document.getElementById('manual-entry-apartment');

const filterEmployee = document.getElementById('hours-filter-employee');
const filterYear = document.getElementById('hours-filter-year');
const filterMonth = document.getElementById('hours-filter-month');
const filterApartment = document.getElementById('hours-filter-apartment');
const summaryWrap = document.getElementById('hours-summary');
const entriesBody = document.getElementById('hours-entries-body');
const syncPill = document.getElementById('hours-sync-pill');
const syncMeta = document.getElementById('hours-sync-meta');

let accessRows = [];
let entryRows = [];
let lastGeneratedLink = '';
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
  if (manualEntryDate) manualEntryDate.value = now.toISOString().slice(0, 10);

  accessForm?.addEventListener('submit', handleCreateOrRenewAccess);
  copyGeneratedLinkBtn?.addEventListener('click', copyGeneratedLink);
  manualEntryForm?.addEventListener('submit', handleManualEntry);
  filterEmployee?.addEventListener('change', renderEntries);
  filterYear?.addEventListener('change', renderEntries);
  filterMonth?.addEventListener('change', renderEntries);
  filterApartment?.addEventListener('change', renderEntries);

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
      if (accessList) accessList.innerHTML = '<div class="empty-state">Inicia sessão para ver os links.</div>';
      if (entriesBody) entriesBody.innerHTML = '<tr><td colspan="8" class="empty-state">Inicia sessão para ver os registos.</td></tr>';
      if (summaryWrap) summaryWrap.innerHTML = '';
      return;
    }

    try {
      await loadAccessRows();
      renderAccessList();
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

async function handleCreateOrRenewAccess(event) {
  event.preventDefault();

  const employeeName = document.getElementById('employee-name').value.trim();
  const employeeIdRaw = document.getElementById('employee-id').value.trim();
  const hourlyRate = Number(document.getElementById('employee-hourly-rate').value || 0);

  if (!employeeName || !employeeIdRaw) {
    showToast('Preencha o nome e o ID interno.', 'warning');
    return;
  }

  const employeeId = slugify(employeeIdRaw);
  const shareToken = generateToken();
  const shareUrl = buildShareUrl(shareToken);
  const tokenHash = await sha256Hex(shareToken);

  await setDoc(doc(db, ACCESS_COLLECTION, employeeId), {
    employeeId,
    employeeName,
    hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 0,
    allowedApartments: ['123', '1248'],
    shareToken,
    tokenHash,
    active: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });

  lastGeneratedLink = shareUrl;
  generatedLinkAnchor.href = shareUrl;
  generatedLinkAnchor.textContent = shareUrl;
  generatedLinkBox.hidden = false;

  showToast('Link criado/renovado com sucesso.', 'success');
  await loadAccessRows();
  renderAccessList();
  renderEntries();
}

function renderAccessList() {
  if (!accessList) return;

  populateEmployeeFilter();
  populateManualEmployeeSelect();
  populateApartmentFilter();

  if (!accessRows.length) {
    accessList.innerHTML = '<div class="empty-state">Ainda não existem funcionárias configuradas.</div>';
    return;
  }

  accessList.innerHTML = accessRows.map((row) => {
    const shareUrl = buildShareUrl(row.shareToken || '');

    return `
      <article class="link-item">
        <div class="link-item-head">
          <div>
            <strong>${escapeHtml(row.employeeName || row.employeeId || 'Sem nome')}</strong>
            <div>ID: ${escapeHtml(row.employeeId || row.id || '-')}</div>
          </div>
          <span class="pill ${row.active === false ? 'is-off' : ''}">${row.active === false ? 'Inativo' : 'Ativo'}</span>
        </div>
        <div><strong>Apartamentos:</strong> 123 e 1248</div>
        <div><strong>Valor/hora:</strong> ${formatEuroNumber(row.hourlyRate || 0)} €</div>
        <div><strong>Link:</strong> <a href="${escapeAttr(shareUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shareUrl)}</a></div>
        <div class="form-actions">
          <button type="button" class="btn" data-edit-access-id="${escapeAttr(row.employeeId || row.id || '')}">Alterar</button>
        </div>
      </article>
    `;
  }).join('');

  accessList.querySelectorAll('[data-edit-access-id]').forEach((button) => {
    button.addEventListener('click', () => editAccess(button.getAttribute('data-edit-access-id')));
  });
}

function renderEntries() {
  if (!entriesBody) return;

  const filtered = applyFilters(entryRows);
  renderedEntrySignature = createEntrySignature(filtered);
  renderSummary(filtered);
  updateSyncStatus();

  if (!filtered.length) {
    entriesBody.innerHTML = '<tr><td colspan="8" class="empty-state">Sem registos para os filtros selecionados.</td></tr>';
    return;
  }

  entriesBody.innerHTML = filtered.map((row) => `
    <tr>
      <td>${escapeHtml(formatPtDate(row.date))}</td>
      <td>${escapeHtml(row.employeeName || row.employeeId || '-')}</td>
      <td>${Number(row.hours || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
      <td>${escapeHtml(row.apartment || '-')}</td>
      <td>${formatEuroNumber(getEntryAmount(row))} €</td>
      <td>${renderApprovalCell(row)}</td>
      <td>${escapeHtml(row.source || 'manual')}</td>
      <td>${renderActionsCell(row)}</td>
    </tr>
  `).join('');

  entriesBody.querySelectorAll('[data-approve-id]').forEach((button) => {
    button.addEventListener('click', () => approveEntry(button.getAttribute('data-approve-id')));
  });
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
  const employees = new Set(rows.map((row) => row.employeeId).filter(Boolean)).size;

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
    <div class="kpi-card">
      <span>Funcionárias</span>
      <strong>${employees}</strong>
    </div>
  `;
}

function applyFilters(rows) {
  const employee = filterEmployee?.value || '';
  const year = filterYear?.value || '';
  const month = filterMonth?.value || '';
  const apartment = filterApartment?.value || '';

  return rows.filter((row) => {
    if (employee && row.employeeId !== employee) return false;
    const rowDate = String(row.date || '');
    if (year && !rowDate.startsWith(`${year}-`)) return false;
    if (month && rowDate.slice(5, 7) !== month) return false;
    if (apartment && row.apartment !== apartment) return false;
    return true;
  });
}

function populateEmployeeFilter() {
  if (!filterEmployee) return;

  const current = filterEmployee.value;
  const options = accessRows
    .map((row) => `<option value="${escapeAttr(row.employeeId)}">${escapeHtml(row.employeeName || row.employeeId)}</option>`)
    .join('');

  filterEmployee.innerHTML = `<option value="">Todas</option>${options}`;
  filterEmployee.value = current;
}

function populateApartmentFilter() {
  if (!filterApartment) return;

  const current = filterApartment.value;
  const values = new Set();

  values.add('123');
  values.add('1248');
  values.add('Ambos');
  entryRows.forEach((row) => {
    if (row.apartment) values.add(row.apartment);
  });

  const options = Array.from(values).sort((a, b) => a.localeCompare(b, 'pt')).map((value) =>
    `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`
  ).join('');

  filterApartment.innerHTML = `<option value="">Todos</option>${options}`;
  filterApartment.value = current;
}

function populateManualEmployeeSelect() {
  if (!manualEntryEmployee) return;

  const current = manualEntryEmployee.value;
  const options = accessRows
    .map((row) => `<option value="${escapeAttr(row.employeeId)}">${escapeHtml(row.employeeName || row.employeeId)}</option>`)
    .join('');

  manualEntryEmployee.innerHTML = options;
  if (current && accessRows.some((row) => row.employeeId === current)) {
    manualEntryEmployee.value = current;
  }
}

async function copyGeneratedLink() {
  if (!lastGeneratedLink) return;
  await navigator.clipboard.writeText(lastGeneratedLink);
  showToast('Link copiado.', 'success');
}

async function handleManualEntry(event) {
  event.preventDefault();

  const employeeId = manualEntryEmployee?.value || '';
  const date = manualEntryDate?.value || '';
  const hours = Number(String(manualEntryHours?.value || '').replace(',', '.'));
  const apartment = manualEntryApartment?.value || '';

  if (!employeeId || !date || !Number.isFinite(hours) || hours < 0 || !['123', '1248', 'Ambos'].includes(apartment)) {
    showToast('Preenche os dados da entrada manual.', 'warning');
    return;
  }

  const employee = accessRows.find((row) => row.employeeId === employeeId);
  if (!employee) {
    showToast('Funcionária inválida.', 'warning');
    return;
  }

  try {
    await setDoc(doc(db, ENTRIES_COLLECTION, `${employeeId}__${date}`), {
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
    }, { merge: true });

    manualEntryForm?.reset();
    if (manualEntryDate) manualEntryDate.value = new Date().toISOString().slice(0, 10);
    if (manualEntryEmployee) manualEntryEmployee.value = employeeId;
    showToast('Entrada manual adicionada e aprovada.', 'success');
  } catch (error) {
    console.error(error);
    showToast('Erro ao adicionar entrada manual.', 'error');
  }
}

function buildShareUrl(shareToken) {
  const root = new URL('/horas-limpeza.html', getPublicAppOrigin());
  if (shareToken) root.searchParams.set('token', shareToken);
  return root.toString();
}

function getPublicAppOrigin() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'https://apartments-a4b17.web.app';
  }
  return window.location.origin;
}

function parseApartments(value) {
  const parts = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length ? parts : ['123', '1248'];
}

function renderApprovalCell(row) {
  if (row.approved) {
    return '<span class="pill">Aprovado</span>';
  }
  return `<button type="button" class="btn" data-approve-id="${escapeAttr(row.id)}">Aprovar</button>`;
}

function getSplitHours(row, apartment) {
  const hours = Number(row.hours) || 0;
  if (row.apartment === apartment) return hours;
  if (row.apartment === 'Ambos') return hours / 2;
  return 0;
}

async function approveEntry(entryId) {
  if (!entryId) return;
  try {
    await updateDoc(doc(db, ENTRIES_COLLECTION, entryId), {
      approved: true,
      approvedAt: serverTimestamp()
    });
    showToast('Registo aprovado.', 'success');
  } catch (error) {
    console.error(error);
    showToast('Erro ao aprovar registo.', 'error');
  }
}

async function editAccess(employeeId) {
  const row = accessRows.find((item) => item.employeeId === employeeId || item.id === employeeId);
  if (!row) return;

  const employeeName = window.prompt('Nome da funcionária:', row.employeeName || '');
  if (employeeName === null) return;
  const trimmedName = String(employeeName).trim();
  if (!trimmedName) {
    showToast('Nome inválido.', 'warning');
    return;
  }

  const hourlyRateRaw = window.prompt('Valor por hora (€):', String(Number(row.hourlyRate || 0)));
  if (hourlyRateRaw === null) return;
  const hourlyRate = Number(String(hourlyRateRaw).replace(',', '.'));
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    showToast('Valor por hora inválido.', 'warning');
    return;
  }

  try {
    await updateDoc(doc(db, ACCESS_COLLECTION, row.employeeId || row.id), {
      employeeName: trimmedName,
      hourlyRate,
      updatedAt: serverTimestamp()
    });
    showToast('Funcionária atualizada.', 'success');
    await loadAccessRows();
    renderAccessList();
    renderEntries();
  } catch (error) {
    console.error(error);
    showToast('Erro ao atualizar funcionária.', 'error');
  }
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
  if (liveEntryCount) meta.push(`${liveEntryCount} registos no Firebase`);
  if (liveLastUpdatedAt) meta.push(`Última alteração: ${formatDateTime(liveLastUpdatedAt)}`);

  if (!renderedEntrySignature && !liveEntrySignature) {
    setSyncState('neutral', 'Sem dados', meta.join(' • '));
    return;
  }

  if (renderedEntrySignature === liveEntrySignature) {
    setSyncState('ok', 'Sincronizado com Firebase', meta.join(' • '));
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

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
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
  const employee = accessRows.find((row) => row.employeeId === employeeId);
  return Number(employee?.hourlyRate || 0);
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

  const newApartment = window.prompt('Apartamento (123, 1248 ou Ambos):', row.apartment || '');
  if (newApartment === null) return;
  const apartment = String(newApartment).trim();
  if (!['123', '1248', 'Ambos'].includes(apartment)) {
    showToast('Apartamento inválido.', 'warning');
    return;
  }

  try {
    const targetId = `${row.employeeId}__${trimmedDate}`;
    if (targetId !== entryId) {
      const { id, ...rowData } = row;
      await setDoc(doc(db, ENTRIES_COLLECTION, targetId), {
        ...rowData,
        date: trimmedDate,
        hours: newHours,
        apartment,
        approved: false,
        updatedAt: serverTimestamp()
      });
      await deleteDoc(doc(db, ENTRIES_COLLECTION, entryId));
    } else {
      await updateDoc(doc(db, ENTRIES_COLLECTION, entryId), {
        date: trimmedDate,
        hours: newHours,
        apartment,
        approved: false,
        updatedAt: serverTimestamp()
      });
    }
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

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'funcionaria';
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
