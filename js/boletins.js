import { db } from './script.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { showToast } from './toast.js';
import { PROPERTIES, COUNTRY_CODES } from './boletim-properties.js';

const COLLECTION = 'alojamento_boletins';
const PUBLIC_FORM_URL = 'https://apartments-a4b17.web.app/modules/boletim.html';
const BOLETINS_COLSPAN = 9;
const SEND_DEADLINE_BUSINESS_DAYS = 3;
const COPIED_CELLS_STORAGE_KEY = 'boletinsCopiedCellsV1';
const SENT_PREVIEW_LIMIT = 5;

const state = {
  boletins: [],
  sentExpanded: false
};

const els = {
  form: document.getElementById('boletim-form'),
  property: document.getElementById('boletim-property'),
  guestName: document.getElementById('guest-name'),
  language: document.getElementById('guest-language'),
  guestCount: document.getElementById('guest-count'),
  checkinDate: document.getElementById('checkin-date'),
  checkoutDate: document.getElementById('checkout-date'),
  generatedBox: document.getElementById('generated-link'),
  generatedUrl: document.getElementById('generated-url'),
  copyGenerated: document.getElementById('copy-generated-link'),
  body: document.getElementById('boletins-body'),
  sentBody: document.getElementById('boletins-sent-body'),
  sentToggle: document.getElementById('boletins-sent-toggle')
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadBoletins();
});

function bindEvents() {
  document.getElementById('departure-form').addEventListener('submit', saveDepartureReport);
  document.getElementById('departure-cancel').addEventListener('click', () => document.getElementById('departure-dialog').close());
  document.getElementById('retention-list').addEventListener('click', handleRetentionClick);
  document.getElementById('guest-edit-form')?.addEventListener('submit', saveAdminGuest);
  document.getElementById('guest-edit-cancel')?.addEventListener('click', () => document.getElementById('guest-edit-dialog').close());
  els.form?.addEventListener('submit', handleCreateBoletim);
  els.copyGenerated?.addEventListener('click', () => copyText(els.generatedUrl.value));
  els.sentToggle?.addEventListener('click', () => {
    state.sentExpanded = !state.sentExpanded;
    renderBoletins();
  });
  [els.body, els.sentBody].forEach((body) => {
    body?.addEventListener('click', handleTableClick);
    body?.addEventListener('keydown', handleTableKeydown);
    body?.addEventListener('change', handleSentChange);
  });
}

async function handleCreateBoletim(event) {
  event.preventDefault();

  const guestName = els.guestName.value.trim();
  const propertyId = els.property.value;
  const language = els.language.value;
  const expectedGuests = Number(els.guestCount.value);
  const checkinDate = els.checkinDate.value;
  const checkoutDate = els.checkoutDate.value;

  if (!PROPERTIES[propertyId] || !guestName || !language || !Number.isInteger(expectedGuests) || expectedGuests < 1 || expectedGuests > 30) {
    showToast('Escolhe o apartamento e preenche o nome, língua e número de hóspedes (1 a 30).', 'warning');
    return;
  }

  if (checkinDate && checkoutDate && checkoutDate <= checkinDate) {
    showToast('A data de check-out tem de ser posterior ao check-in.', 'warning');
    return;
  }

  const token = createToken();
  const ref = doc(db, COLLECTION, token);
  const now = Timestamp.now();

  try {
    await setDoc(ref, {
      propertyId,
      publicAccessClosed: false,
      guestName,
      language,
      expectedGuests,
      checkinDate,
      checkoutDate,
      sentToAuthorities: false,
      createdAt: now,
      updatedAt: now
    });

    const link = buildPublicLink(token);
    els.generatedUrl.value = link;
    els.generatedBox.hidden = false;
    els.form.reset();
    els.language.value = 'en';
    els.guestCount.value = '1';
    await copyText(link, false);
    showToast('Link criado e copiado.', 'success');
    await loadBoletins();
  } catch (err) {
    console.error('Erro ao criar boletim', err);
    showToast('Não foi possível criar o link.', 'error');
  }
}

async function loadBoletins() {
  if (!els.body) return;
  els.body.innerHTML = renderEmptyRow('A carregar boletins...');
  if (els.sentBody) {
    els.sentBody.innerHTML = renderEmptyRow('A carregar boletins...');
  }

  try {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const rows = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const guestsSnap = await getDocs(collection(db, COLLECTION, docSnap.id, 'guests'));
      const guests = guestsSnap.docs
        .map((guestDoc) => ({ id: guestDoc.id, ...guestDoc.data() }))
        .sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
      return {
        id: docSnap.id,
        ...docSnap.data(),
        guests,
        guestSubmissions: guests.length
      };
    }));
    state.boletins = rows;
    renderBoletins();
  } catch (err) {
    console.error('Erro ao carregar boletins', err);
    els.body.innerHTML = renderEmptyRow('Erro ao carregar boletins.');
    if (els.sentBody) {
      els.sentBody.innerHTML = renderEmptyRow('Erro ao carregar boletins.');
    }
    showToast('Não foi possível carregar os boletins.', 'error');
  }
}

function renderBoletins() {
  renderRetention();
  if (!state.boletins.length) {
    els.body.innerHTML = renderEmptyRow('Ainda não existem boletins.');
    if (els.sentBody) {
      els.sentBody.innerHTML = renderEmptyRow('Ainda não existem boletins enviados.');
    }
    updateSentToggle(0);
    return;
  }

  const pending = sortByCheckinDate(state.boletins.filter((item) => !item.sentToAuthorities));
  const sent = sortByCheckinDate(state.boletins.filter((item) => item.sentToAuthorities));

  els.body.innerHTML = pending.length
    ? renderBoletimRows(pending)
    : renderEmptyRow('Não existem boletins por enviar.');

  if (els.sentBody) {
    const visibleSent = state.sentExpanded ? sent : sent.slice(0, SENT_PREVIEW_LIMIT);
    els.sentBody.innerHTML = visibleSent.length
      ? renderBoletimRows(visibleSent)
      : renderEmptyRow('Ainda não existem boletins enviados.');
    updateSentToggle(sent.length);
  }
}

function updateSentToggle(totalSent) {
  if (!els.sentToggle) return;
  const hasMore = totalSent > SENT_PREVIEW_LIMIT;
  els.sentToggle.hidden = !hasMore;
  els.sentToggle.textContent = state.sentExpanded
    ? 'Mostrar menos'
    : `Mostrar mais (${totalSent - SENT_PREVIEW_LIMIT})`;
}

function renderBoletimRows(boletins) {
  return boletins.map((item) => {
    const completed = item.guestSubmissions >= Number(item.expectedGuests || 1);
    const closed = item.publicAccessClosed || item.sentToAuthorities || completed;
    const status = completed ? 'Preenchido' : item.guestSubmissions > 0 ? 'Parcial' : 'Por preencher';
    const statusClass = completed ? 'done' : 'pending';
    const link = buildPublicLink(item.id);
    const checked = item.sentToAuthorities ? 'checked' : '';
    const detailsId = `details-${item.id}`;

    return `
      <tr>
        <td>${escapeHtml(item.guestName || 'Sem nome')}
          <select data-action="property" data-id="${escapeAttr(item.id)}" aria-label="Apartamento de ${escapeAttr(item.guestName || 'reserva')}">
            <option value="">Associar apartamento</option>
            ${Object.entries(PROPERTIES).map(([id, property]) => `<option value="${id}" ${item.propertyId === id ? 'selected' : ''}>${property.names.pt}</option>`).join('')}
          </select>
        </td>
        <td>${escapeHtml(formatStay(item.checkinDate, item.checkoutDate))}${!item.checkinDate || !item.checkoutDate ? '<br><small>Datas individuais em «Ver dados»</small>' : ''}</td>
        <td>${renderSendDeadline(item.checkinDate || item.guests.map(guest => guest.checkinDate).filter(Boolean).sort()[0], item.sentToAuthorities)}</td>
        <td><span class="status-badge ${statusClass}">${status}</span>${item.guests.some(guest => !guest.checkoutDate) ? '<br><span>Saída por confirmar</span>' : ''}</td>
        <td>${item.guestSubmissions || 0}/${Number(item.expectedGuests || 0)}</td>
        <td>
          <label class="sent-toggle">
            <input type="checkbox" data-action="sent" data-id="${item.id}" ${checked}>
            <span>${item.sentToAuthorities ? 'Enviado' : 'Não enviado'}</span>
          </label>
        </td>
        <td>
          <button type="button" data-action="details" data-target="${detailsId}" ${item.guestSubmissions ? '' : 'disabled'}>
            Ver dados
          </button>
        </td>
        <td>
          ${closed ? '<span>Acesso dos hóspedes fechado</span>' : `<button type="button" data-action="copy" data-link="${escapeAttr(link)}">Copiar</button><div class="mono-link">${escapeHtml(link)}</div>`}
        </td>
        <td>
          <button type="button" data-action="delete" data-id="${item.id}" data-name="${escapeAttr(item.guestName || 'Sem nome')}">
            Apagar
          </button>
        </td>
      </tr>
      <tr id="${detailsId}" hidden>
        <td colspan="${BOLETINS_COLSPAN}">${renderGuestDetails(item.guests || [], item.id)}</td>
      </tr>
    `;
  }).join('');
}

function renderEmptyRow(message) {
  return `<tr><td colspan="${BOLETINS_COLSPAN}" class="empty-state">${escapeHtml(message)}</td></tr>`;
}

function sortByCheckinDate(boletins) {
  return [...boletins].sort((a, b) => {
    const dateDiff = toDateOnlyMillis(a.checkinDate) - toDateOnlyMillis(b.checkinDate);
    return dateDiff || toDateOnlyMillis(a.checkoutDate) - toDateOnlyMillis(b.checkoutDate);
  });
}

function renderSendDeadline(checkinDate, sentToAuthorities) {
  const deadline = addBusinessDays(checkinDate, SEND_DEADLINE_BUSINESS_DAYS);
  if (!deadline) return '-';

  const overdueClass = !sentToAuthorities && deadline < startOfToday() ? ' overdue' : '';
  return `<span class="deadline-date${overdueClass}">${escapeHtml(formatDateOnlyFromDate(deadline))}</span>`;
}

async function handleTableClick(event) {
  const edit = event.target.closest('button[data-action="edit-guest"]');
  if (edit) { openAdminGuest(edit.dataset.boletim, edit.dataset.guest); return; }
  const copyableCell = event.target.closest('[data-action="copy-value"]');
  if (copyableCell) {
    const copied = await copyText(
      copyableCell.dataset.copyValue || '',
      true,
      `${copyableCell.dataset.copyLabel || 'Conteúdo'} copiado.`
    );
    if (copied) markCopyableCellCopied(copyableCell);
    return;
  }

  const copyBtn = event.target.closest('button[data-action="copy"]');
  if (copyBtn) {
    copyText(copyBtn.dataset.link || '');
    return;
  }

  const detailsBtn = event.target.closest('button[data-action="details"]');
  if (detailsBtn) {
    const row = document.getElementById(detailsBtn.dataset.target);
    if (!row) return;
    row.hidden = !row.hidden;
    detailsBtn.textContent = row.hidden ? 'Ver dados' : 'Ocultar';
    return;
  }

  const deleteBtn = event.target.closest('button[data-action="delete"]');
  if (deleteBtn) {
    deleteBoletim(deleteBtn.dataset.id, deleteBtn.dataset.name || 'este boletim');
  }
}

async function handleTableKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const copyableCell = event.target.closest('[data-action="copy-value"]');
  if (!copyableCell) return;

  event.preventDefault();
  const copied = await copyText(
    copyableCell.dataset.copyValue || '',
    true,
    `${copyableCell.dataset.copyLabel || 'Conteúdo'} copiado.`
  );
  if (copied) markCopyableCellCopied(copyableCell);
}

async function deleteBoletim(id, name) {
  if (!id) return;
  const confirmed = window.confirm(`Apagar ${name}? Esta ação também remove os dados submetidos pelos hóspedes.`);
  if (!confirmed) return;

  try {
    const guestsSnap = await getDocs(collection(db, COLLECTION, id, 'guests'));
    const summariesSnap = await getDocs(collection(db, COLLECTION, id, 'guest_summaries'));
    await Promise.all(guestsSnap.docs.map((guestDoc) => deleteDoc(guestDoc.ref)));
    await Promise.all(summariesSnap.docs.map((summaryDoc) => deleteDoc(summaryDoc.ref)));
    await deleteDoc(doc(db, COLLECTION, id));
    state.boletins = state.boletins.filter((item) => item.id !== id);
    renderBoletins();
    showToast('Boletim apagado.', 'success');
  } catch (err) {
    console.error('Erro ao apagar boletim', err);
    showToast('Não foi possível apagar o boletim.', 'error');
  }
}

async function handleSentChange(event) {
  const propertySelect = event.target.closest('select[data-action="property"]');
  if (propertySelect) {
    const item = state.boletins.find(row => row.id === propertySelect.dataset.id);
    const propertyId = propertySelect.value;
    if (!item || !PROPERTIES[propertyId]) { if (item) propertySelect.value = item.propertyId || ''; return; }
    propertySelect.disabled = true;
    try {
      await updateDoc(doc(db, COLLECTION, item.id), { propertyId, updatedAt: Timestamp.now() });
      item.propertyId = propertyId;
      showToast('Apartamento associado. O link mantém-se igual.', 'success');
    } catch {
      propertySelect.value = item.propertyId || '';
      showToast('Não foi possível associar o apartamento.', 'error');
    } finally { propertySelect.disabled = false; }
    return;
  }
  const input = event.target.closest('input[data-action="sent"]');
  if (!input) return;

  const id = input.dataset.id;
  const sentToAuthorities = input.checked;
  const previous = state.boletins.find(row => row.id === id);
  const closeAccess = Boolean(sentToAuthorities || previous?.sentToAuthorities || previous?.publicAccessClosed);
  const authoritiesSentAt = previous?.authoritiesSentAt || (sentToAuthorities ? Timestamp.now() : null);
  const label = input.closest('label')?.querySelector('span');
  if (label) label.textContent = sentToAuthorities ? 'Enviado' : 'Não enviado';

  try {
    await updateDoc(doc(db, COLLECTION, id), {
      sentToAuthorities,
      ...(!sentToAuthorities ? { departureReportedDate: null, deleteAfter: null } : {}),
      ...(closeAccess ? { publicAccessClosed: true } : {}),
      ...(sentToAuthorities && authoritiesSentAt ? { authoritiesSentAt } : {})
    });
    const item = state.boletins.find((row) => row.id === id);
    if (item) {
      item.sentToAuthorities = sentToAuthorities;
      if (!sentToAuthorities) { item.departureReportedDate = null; item.deleteAfter = null; }
      if (closeAccess) item.publicAccessClosed = true;
      if (authoritiesSentAt) item.authoritiesSentAt = authoritiesSentAt;
    }
    renderBoletins();
    showToast(sentToAuthorities ? 'Marcado como enviado.' : 'Marcado como não enviado.', 'success');
  } catch (err) {
    console.error('Erro ao atualizar envio', err);
    input.checked = !sentToAuthorities;
    if (label) label.textContent = input.checked ? 'Enviado' : 'Não enviado';
    showToast('Não foi possível atualizar o estado.', 'error');
  }
}

function buildPublicLink(token) {
  const url = new URL(PUBLIC_FORM_URL);
  url.searchParams.set('t', token);
  return url.href;
}

let editingAdminGuest = null;
function openAdminGuest(boletimId, guestId) {
  const boletim = state.boletins.find(item => item.id === boletimId);
  const guest = boletim?.guests.find(item => item.id === guestId);
  if (!guest) return;
  editingAdminGuest = { boletim, guest };
  const labels = {
    firstName: 'Nome', lastName: 'Apelido', birthDate: 'Data de nascimento',
    documentType: 'Tipo de documento', documentNumber: 'Número do documento',
    countryOrigin: 'Nacionalidade', countryResidence: 'País de residência', documentCountry: 'País emissor',
    checkinDate: 'Check-in', checkoutDate: 'Check-out (em branco: saída por confirmar)'
  };
  const display = new Intl.DisplayNames(['pt-PT'], { type: 'region' });
  document.getElementById('guest-edit-fields').innerHTML = Object.entries(labels).map(([key, label]) => {
    const value = guest[key] || '';
    let input;
    if (['countryOrigin', 'countryResidence', 'documentCountry'].includes(key)) {
      const codes = [...new Set([...COUNTRY_CODES, value].filter(Boolean))].sort((a, b) => display.of(a).localeCompare(display.of(b), 'pt'));
      input = `<select name="${key}" required>${codes.map(code => `<option value="${escapeAttr(code)}" ${code === value ? 'selected' : ''}>${escapeHtml(display.of(code))}</option>`).join('')}</select>`;
    } else if (key === 'documentType') {
      input = `<select name="${key}" required>${[['passport','Passaporte'],['id','Documento de identificação'],['other','Outro']].map(([code, text]) => `<option value="${code}" ${value === code ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
    } else input = `<input name="${key}" type="${['birthDate', 'checkinDate', 'checkoutDate'].includes(key) ? 'date' : 'text'}" value="${escapeAttr(value)}" ${key === 'checkoutDate' ? '' : 'required'}>`;
    return `<label class="field">${label}${input}</label>`;
  }).join('');
  document.getElementById('guest-edit-error').hidden = true;
  document.getElementById('guest-edit-dialog').showModal();
}

async function saveAdminGuest(event) {
  event.preventDefault();
  if (!editingAdminGuest) return;
  const form = event.currentTarget;
  const changes = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
  if (Object.entries(changes).some(([key, value]) => key !== 'checkoutDate' && !value)) return;
  if (changes.checkoutDate && changes.checkoutDate <= changes.checkinDate) {
    showToast('A saída tem de ser posterior à entrada.', 'warning'); return;
  }
  const { boletim, guest } = editingAdminGuest;
  changes.updatedAt = Timestamp.now();
  form.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    const batch = writeBatch(db);
    const datesChanged = guest.checkinDate !== changes.checkinDate || guest.checkoutDate !== changes.checkoutDate;
    if (datesChanged) batch.update(doc(db, COLLECTION, boletim.id), { departureReportedDate: null, deleteAfter: null });
    batch.update(doc(db, COLLECTION, boletim.id, 'guests', guest.id), changes);
    batch.set(doc(db, COLLECTION, boletim.id, 'guest_summaries', guest.id), {
      firstName: changes.firstName, lastName: changes.lastName, submittedAt: guest.submittedAt
    });
    await batch.commit();
    if (datesChanged) { boletim.departureReportedDate = null; boletim.deleteAfter = null; }
    Object.assign(guest, changes);
    document.getElementById('guest-edit-dialog').close();
    renderBoletins();
    showToast('Dados corrigidos. O acesso do hóspede mantém-se fechado se já estava encerrado.', 'success');
  } catch {
    const message = document.getElementById('guest-edit-error');
    message.textContent = 'Não foi possível guardar. Tenta novamente.';
    message.hidden = false;
  } finally { form.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}

let reportingBoletimId = '';
function retentionExpiry(reportDate) {
  const date = new Date(`${reportDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date;
}

function renderRetention() {
  const target = document.getElementById('retention-list');
  const scheduled = state.boletins.filter(item => item.departureReportedDate && item.deleteAfter)
    .sort((a, b) => toMillis(a.deleteAfter) - toMillis(b.deleteAfter));
  const pending = state.boletins.filter(item => !item.departureReportedDate || !item.deleteAfter);
  const row = item => `<tr><td>${escapeHtml(item.guestName)}</td><td>${item.deleteAfter ? escapeHtml(formatDateTime(item.deleteAfter)) : 'Sem eliminação programada'}</td><td>${item.departureReportedDate ? `Saídas comunicadas em ${escapeHtml(formatDateOnly(item.departureReportedDate))}` : 'Comunicação das saídas por confirmar'}</td><td><button type="button" data-retention="report" data-id="${escapeAttr(item.id)}">${item.departureReportedDate ? 'Corrigir data' : 'Confirmar saídas comunicadas'}</button>${item.departureReportedDate ? ` <button type="button" data-retention="cancel" data-id="${escapeAttr(item.id)}">Anular confirmação</button>` : ''}</td></tr>`;
  const table = items => `<div class="table-wrap"><table><thead><tr><th>Boletim</th><th>Eliminar a partir de</th><th>Comunicação ao SIBA</th><th>Ações</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></div>`;
  target.innerHTML = (scheduled.length ? table(scheduled) : '<p>Nenhum boletim com eliminação programada.</p>')
    + (pending.length ? `<details><summary>Sem eliminação programada (${pending.length})</summary>${table(pending)}</details>` : '');
}

async function handleRetentionClick(event) {
  const button = event.target.closest('[data-retention]');
  if (!button) return;
  const item = state.boletins.find(row => row.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.retention === 'cancel') {
    button.disabled = true;
    try {
      await updateDoc(doc(db, COLLECTION, item.id), { departureReportedDate: null, deleteAfter: null });
      item.departureReportedDate = null; item.deleteAfter = null;
      renderRetention(); showToast('Confirmação anulada. Eliminação automática suspensa.', 'success');
    } catch { button.disabled = false; showToast('Não foi possível anular.', 'error'); }
    return;
  }
  if (!item.sentToAuthorities || item.guests.length < Number(item.expectedGuests || 1) || item.guests.some(guest => !guest.checkinDate || !guest.checkoutDate)) {
    showToast('Completa as datas de todos os hóspedes e marca o boletim como enviado antes de confirmar as saídas.', 'warning'); return;
  }
  reportingBoletimId = item.id;
  const input = document.getElementById('departure-reported-date');
  input.value = item.departureReportedDate || '';
  input.min = item.guests.map(guest => guest.checkoutDate).sort().at(-1);
  input.max = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
  document.getElementById('departure-error').hidden = true;
  document.getElementById('departure-dialog').showModal();
}

async function saveDepartureReport(event) {
  event.preventDefault();
  const item = state.boletins.find(row => row.id === reportingBoletimId);
  if (!item) return;
  const reportDate = document.getElementById('departure-reported-date').value;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
  const deleteAfter = Timestamp.fromDate(retentionExpiry(reportDate));
  const form = event.currentTarget;
  form.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    await runTransaction(db, async tx => {
      const parentRef = doc(db, COLLECTION, item.id);
      const parent = await tx.get(parentRef);
      const guests = await Promise.all(item.guests.map(guest => tx.get(doc(db, COLLECTION, item.id, 'guests', guest.id))));
      if (!parent.exists() || !parent.data().sentToAuthorities || guests.length < Number(parent.data().expectedGuests || 1)
          || !reportDate || reportDate > today || guests.some(snap => !snap.exists() || !snap.data().checkoutDate || snap.data().checkoutDate > reportDate)) {
        throw new Error('Confirma as datas e a comunicação de todas as saídas antes de programar a eliminação.');
      }
      tx.update(parentRef, { departureReportedDate: reportDate, deleteAfter, publicAccessClosed: true });
    });
    Object.assign(item, { departureReportedDate: reportDate, deleteAfter, publicAccessClosed: true });
    document.getElementById('departure-dialog').close();
    renderBoletins(); showToast('Comunicação registada e eliminação programada.', 'success');
  } catch {
    const error = document.getElementById('departure-error');
    error.textContent = 'Não foi possível guardar. Confirma as datas e atualiza a lista antes de tentar novamente.';
    error.hidden = false;
  } finally { form.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}

function createToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function copyText(text, showSuccess = true, successMessage = 'Link copiado.') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (showSuccess) showToast(successMessage, 'success');
    return true;
  } catch {
    if (els.generatedUrl && els.generatedUrl.value === text) {
      els.generatedUrl.focus();
      els.generatedUrl.select();
    }
    if (showSuccess) showToast('Não consegui copiar automaticamente.', 'warning');
    return false;
  }
}

function markCopyableCellCopied(cell) {
  const copyKey = cell.dataset.copyKey;
  if (copyKey) {
    const copiedKeys = getCopiedCellKeys();
    copiedKeys.add(copyKey);
    saveCopiedCellKeys(copiedKeys);
  }
  cell.classList.add('is-copied');
  cell.title = 'Já copiado';
}

function getCopiedCellKeys() {
  try {
    const raw = localStorage.getItem(COPIED_CELLS_STORAGE_KEY);
    const keys = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(keys) ? keys : []);
  } catch {
    return new Set();
  }
}

function saveCopiedCellKeys(keys) {
  try {
    localStorage.setItem(COPIED_CELLS_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // A marca visual continua a funcionar na sessão mesmo que o browser bloqueie localStorage.
  }
}

function hasCopiedCellKey(copyKey) {
  return copyKey ? getCopiedCellKeys().has(copyKey) : false;
}

function formatDateTime(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatStay(checkinDate, checkoutDate) {
  if (!checkinDate && !checkoutDate) return '-';
  return `${formatDateOnly(checkinDate)} - ${formatDateOnly(checkoutDate)}`;
}

function formatDateOnly(value) {
  if (!value) return '-';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateOnlyFromDate(date);
}

function formatDateOnlyFromDate(date) {
  return date.toLocaleDateString('pt-PT');
}

function toDateOnlyMillis(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

function addBusinessDays(startDate, businessDays) {
  const date = parseDateOnly(startDate);
  if (!date) return null;

  let addedDays = 0;
  while (addedDays < businessDays) {
    date.setDate(date.getDate() + 1);
    if (isBusinessDay(date)) addedDays += 1;
  }
  return date;
}

function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !isPortuguesePublicHoliday(date);
}

function isPortuguesePublicHoliday(date) {
  return getPortuguesePublicHolidayKeys(date.getFullYear()).has(toDateKey(date));
}

function getPortuguesePublicHolidayKeys(year) {
  const easter = getEasterDate(year);
  const goodFriday = addCalendarDays(easter, -2);
  const corpusChristi = addCalendarDays(easter, 60);

  return new Set([
    `${year}-01-01`,
    `${year}-04-25`,
    `${year}-05-01`,
    `${year}-06-10`,
    `${year}-06-24`,
    `${year}-08-15`,
    `${year}-10-05`,
    `${year}-11-01`,
    `${year}-12-01`,
    `${year}-12-08`,
    `${year}-12-25`,
    toDateKey(goodFriday),
    toDateKey(corpusChristi)
  ]);
}

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

function addCalendarDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toMillis(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function renderGuestDetails(guests, boletimId) {
  if (!guests.length) {
    return '<div class="empty-state">Ainda não há dados submetidos.</div>';
  }

  const rows = guests.map((guest, index) => {
    const name = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || '-';
    const birthDate = guest.birthDate || '-';
    const documentNumber = guest.documentNumber || '-';
    const guestKey = `${boletimId || 'boletim'}:${guest.id || index}`;

    return `
      <tr>
        <td><button type="button" data-action="edit-guest" data-boletim="${escapeAttr(boletimId)}" data-guest="${escapeAttr(guest.id)}">Corrigir</button></td>
        ${renderCopyableCell(name, 'Nome', `${guestKey}:name:${name}`)}
        ${renderCopyableCell(birthDate, 'Nascimento', `${guestKey}:birthDate:${birthDate}`)}
        ${renderCopyableCell(documentNumber, 'Número do documento', `${guestKey}:documentNumber:${documentNumber}`)}
        <td>${escapeHtml(formatDocumentType(guest.documentType))}</td>
        <td>${escapeHtml(formatCountry(guest.documentCountry))}</td>
        <td>${escapeHtml(formatCountry(guest.countryResidence))}</td>
        <td>${escapeHtml(formatCountry(guest.countryOrigin))}</td>
        <td>${escapeHtml(formatDateOnly(guest.checkinDate))}</td>
        <td>${guest.checkoutDate ? escapeHtml(formatDateOnly(guest.checkoutDate)) : 'Saída por confirmar'}</td>
        <td>${escapeHtml(formatDateTime(guest.submittedAt))}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="guest-details-table">
        <thead>
          <tr>
            <th>Editar</th>
            <th>Nome</th>
            <th>Nascimento</th>
            <th>Número passaporte ou ID</th>
            <th>Documento</th>
            <th>País doc.</th>
            <th>Residência</th>
            <th>Nacionalidade</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Submetido</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderCopyableCell(value, label, copyKey) {
  const copiedClass = hasCopiedCellKey(copyKey) ? ' is-copied' : '';
  const title = copiedClass ? 'Já copiado' : 'Clique para copiar';

  return `
    <td
      class="copyable-cell${copiedClass}"
      role="button"
      tabindex="0"
      title="${title}"
      data-action="copy-value"
      data-copy-value="${escapeAttr(value)}"
      data-copy-label="${escapeAttr(label)}"
      data-copy-key="${escapeAttr(copyKey)}"
    >${escapeHtml(value)}</td>
  `;
}

function formatDocumentType(type) {
  const labels = {
    passport: 'Passaporte',
    id: 'ID',
    other: 'Outro'
  };
  return labels[type] || type || '-';
}

function formatCountry(code) {
  if (!code) return '-';
  try {
    const displayNames = new Intl.DisplayNames(['pt-PT'], { type: 'region' });
    const name = displayNames.of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
