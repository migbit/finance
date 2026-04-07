const form = document.getElementById('public-hours-form');
const dateInput = document.getElementById('work-date');
const apartmentToggle = document.getElementById('apartment-toggle');
const hoursSelect = document.getElementById('hours');
const submitBtn = document.getElementById('submit-entry');
const reloadBtn = document.getElementById('reload-entry');
const deleteBtn = document.getElementById('delete-entry');
const statusBox = document.getElementById('public-status');
const historyList = document.getElementById('history-list');
const recentList = document.getElementById('recent-list');
const employeeChip = document.getElementById('employee-chip');
const summaryYearSelect = document.getElementById('summary-year-select');

const token = new URLSearchParams(window.location.search).get('token') || '';
let currentMeta = null;
let currentSummaryYears = [];
let expandedMonths = new Set();
let selectedApartment = '';
let allowedApartments = [];
let currentEntry = null;

document.addEventListener('DOMContentLoaded', () => {
  dateInput.value = todayLocal();
  fillHoursSelect();

  form?.addEventListener('submit', handleSubmit);
  reloadBtn?.addEventListener('click', () => loadData(dateInput.value));
  deleteBtn?.addEventListener('click', handleDelete);
  dateInput?.addEventListener('change', () => loadData(dateInput.value));
  summaryYearSelect?.addEventListener('change', renderSummary);
  apartmentToggle?.addEventListener('click', handleApartmentToggle);

  if (!token) {
    showStatus('Link inválido. Falta o token de acesso.', 'warning');
    setHtml(historyList, '<div class="empty-state">Não foi possível abrir este formulário.</div>');
    setHtml(recentList, '<div class="empty-state">Não foi possível abrir este formulário.</div>');
    form?.querySelectorAll('input, select, button').forEach((field) => {
      field.disabled = true;
    });
    return;
  }

  loadData(dateInput.value);
});

async function loadData(date) {
  try {
    showStatus('A carregar dados...', 'warning');
    const url = new URL('/api/cleaning-hours', getApiOrigin());
    url.searchParams.set('token', token);
    if (date) url.searchParams.set('date', date);

    const response = await fetch(url.toString());
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Falha ao carregar dados.');

    currentMeta = payload;
    syncMeta(payload);
    hydrateForm(payload.entry || null, date || payload.today);
    currentSummaryYears = payload.yearlySummary || [];
    renderYearOptions(payload.availableYears || []);
    renderSummary();
    renderRecent(payload.recentEntries || []);
    showStatus('Dados carregados.', 'success');
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Erro ao carregar dados.', 'warning');
    setHtml(historyList, '<div class="empty-state">Não foi possível carregar os registos.</div>');
    setHtml(recentList, '<div class="empty-state">Não foi possível carregar os registos.</div>');
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    const body = {
      token,
      date: dateInput.value,
      worked: true,
      apartment: selectedApartment,
      hours: Number(hoursSelect.value)
    };

    if (!selectedApartment) {
      showStatus('Seleciona um apartamento antes de gravar.', 'warning');
      return;
    }

    const response = await fetch(new URL('/api/cleaning-hours', getApiOrigin()).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Falha ao gravar.');

    showStatus('Registo gravado com sucesso.', 'success');
    await loadData(body.date);
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Erro ao gravar.', 'warning');
  }
}

function syncMeta(payload) {
  const employeeName = payload.employeeName || 'Funcionária';
  employeeChip.hidden = false;
  employeeChip.textContent = employeeName;

  allowedApartments = Array.isArray(payload.allowedApartments) && payload.allowedApartments.length
    ? payload.allowedApartments
    : ['123', '1248'];
  syncApartmentButtons();
}

function hydrateForm(entry, fallbackDate) {
  currentEntry = entry || null;
  dateInput.value = entry?.date || fallbackDate || todayLocal();
  selectedApartment = entry?.apartment || '';
  syncApartmentButtons();
  hoursSelect.value = String(entry?.hours ?? 1);
  syncEditingState();
}

function handleApartmentToggle(event) {
  const button = event.target.closest('[data-apartment]');
  if (!button || button.disabled) return;
  selectedApartment = button.getAttribute('data-apartment') || '';
  syncApartmentButtons();
}

function syncApartmentButtons() {
  apartmentToggle?.querySelectorAll('[data-apartment]').forEach((button) => {
    const value = button.getAttribute('data-apartment') || '';
    const isAllowed = value === 'Ambos'
      ? allowedApartments.includes('123') && allowedApartments.includes('1248')
      : allowedApartments.includes(value);

    button.disabled = !isAllowed;
    button.classList.toggle('is-active', value === selectedApartment);
  });

  if (selectedApartment === 'Ambos' && !(allowedApartments.includes('123') && allowedApartments.includes('1248'))) {
    selectedApartment = '';
  }
  if ((selectedApartment === '123' || selectedApartment === '1248') && !allowedApartments.includes(selectedApartment)) {
    selectedApartment = '';
  }
}

function renderRecent(rows) {
  if (!recentList) return;

  if (!rows.length) {
    recentList.innerHTML = '<div class="empty-state">Ainda não existem registos.</div>';
    return;
  }

  recentList.innerHTML = rows.map((row) => `
    <article class="history-item">
      <strong>${escapeHtml(formatPtDate(row.date))}</strong>
      <div>${escapeHtml(row.apartment || '-')}, ${Number(row.hours || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} horas</div>
      <button type="button" data-edit-entry data-date="${escapeHtml(row.date)}" data-apartment="${escapeHtml(row.apartment || '')}" data-hours="${escapeHtml(String(Number(row.hours || 0)))}">Editar</button>
    </article>
  `).join('');

  recentList.querySelectorAll('[data-edit-entry]').forEach((button) => {
    button.addEventListener('click', () => {
      startEditingEntry({
        date: button.getAttribute('data-date') || '',
        apartment: button.getAttribute('data-apartment') || '',
        hours: Number(button.getAttribute('data-hours') || 1),
      });
    });
  });
}

function renderYearOptions(availableYears) {
  if (!summaryYearSelect) return;

  const years = Array.isArray(availableYears) && availableYears.length
    ? availableYears
    : [new Date().getFullYear()];

  const currentValue = summaryYearSelect.value || String(years[0]);
  summaryYearSelect.innerHTML = years.map((year) =>
    `<option value="${escapeHtml(String(year))}">${escapeHtml(String(year))}</option>`
  ).join('');

  if (years.includes(Number(currentValue)) || years.includes(currentValue)) {
    summaryYearSelect.value = String(currentValue);
  } else {
    summaryYearSelect.value = String(years[0]);
  }
}

function renderSummary() {
  if (!historyList || !summaryYearSelect) return;

  const selectedYear = Number(summaryYearSelect.value || new Date().getFullYear());
  const yearData = currentSummaryYears.find((item) => Number(item.year) === selectedYear);

  if (!yearData || !Array.isArray(yearData.months) || !yearData.months.length) {
    historyList.innerHTML = '<div class="empty-state">Sem registos para o ano selecionado.</div>';
    return;
  }

  const currentMonthKey = todayLocal().slice(0, 7);
  historyList.innerHTML = `
    <div class="summary-grid">
      ${yearData.months.map((month) => renderMonthCard(month, month.monthKey === currentMonthKey)).join('')}
    </div>
  `;

  historyList.querySelectorAll('[data-toggle-month]').forEach((button) => {
    button.addEventListener('click', () => {
      const monthKey = button.getAttribute('data-toggle-month');
      if (expandedMonths.has(monthKey)) expandedMonths.delete(monthKey);
      else expandedMonths.add(monthKey);
      renderSummary();
    });
  });

  historyList.querySelectorAll('[data-edit-entry]').forEach((button) => {
    button.addEventListener('click', () => {
      startEditingEntry({
        date: button.getAttribute('data-date') || '',
        apartment: button.getAttribute('data-apartment') || '',
        hours: Number(button.getAttribute('data-hours') || 1),
      });
    });
  });
}

function renderMonthCard(month, isCurrentMonth) {
  const isExpanded = isCurrentMonth || expandedMonths.has(month.monthKey);
  const detailsLabel = isExpanded && !isCurrentMonth ? 'Esconder detalhes' : 'Detalhes';
  const daysHtml = isExpanded
    ? `
      <div class="month-days">
        ${month.days.map((day) => `
          <div class="day-row">
            <span>${escapeHtml(formatPtDate(day.date))}</span>
            <span>${escapeHtml(day.apartment || '-')}, ${Number(day.hours || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} h</span>
            <button type="button" data-edit-entry data-date="${escapeHtml(day.date)}" data-apartment="${escapeHtml(day.apartment || '')}" data-hours="${escapeHtml(String(Number(day.hours || 0)))}">Editar</button>
          </div>
        `).join('')}
      </div>
    `
    : '';

  return `
    <article class="month-card">
      <div class="month-card-header">
        <div>
          <strong>${escapeHtml(month.label)}</strong>
          <div class="month-total">Total: ${Number(month.totalHours || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} horas</div>
        </div>
        ${isCurrentMonth ? '<span class="employee-chip">Mês atual</span>' : `<button type="button" data-toggle-month="${escapeHtml(month.monthKey)}">${detailsLabel}</button>`}
      </div>
      ${daysHtml}
    </article>
  `;
}

function fillHoursSelect() {
  if (!hoursSelect) return;

  const values = [];
  for (let value = 1; value <= 8; value += 0.5) {
    values.push(Number(value.toFixed(1)));
  }

  hoursSelect.innerHTML = values.map((value) =>
    `<option value="${value}">${value.toLocaleString('pt-PT', { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })}</option>`
  ).join('');

  hoursSelect.value = '1';
}

async function handleDelete() {
  if (!currentEntry?.date) {
    showStatus('Não existe nenhum registo carregado para apagar.', 'warning');
    return;
  }

  const confirmed = window.confirm(`Apagar o registo de ${formatPtDate(currentEntry.date)}?`);
  if (!confirmed) return;

  try {
    const response = await fetch(new URL('/api/cleaning-hours', getApiOrigin()).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'delete',
        date: currentEntry.date
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Falha ao apagar.');

    currentEntry = null;
    selectedApartment = '';
    syncApartmentButtons();
    hoursSelect.value = '1';
    syncEditingState();
    showStatus('Registo apagado com sucesso.', 'success');
    await loadData(dateInput.value);
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Erro ao apagar.', 'warning');
  }
}

function startEditingEntry(entry) {
  if (!entry?.date) return;
  hydrateForm({
    date: entry.date,
    apartment: entry.apartment || '',
    hours: Number(entry.hours || 1),
  }, entry.date);
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function syncEditingState() {
  if (deleteBtn) deleteBtn.hidden = !currentEntry?.date;
  if (submitBtn) submitBtn.textContent = currentEntry?.date ? 'Guardar alterações' : 'Gravar';
  if (currentEntry?.date) {
    showStatus(`A editar o registo de ${formatPtDate(currentEntry.date)}.`, 'success');
  }
}

function showStatus(message, type) {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `status-box is-visible ${type === 'success' ? 'is-success' : 'is-warning'}`;
}

function setHtml(element, html) {
  if (!element) return;
  element.innerHTML = html;
}

function getApiOrigin() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'https://apartments-a4b17.web.app';
  }
  return window.location.origin;
}

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
