import { db } from './script.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { showToast } from './toast.js';

const COLLECTION = 'alojamento_boletins';
const PUBLIC_FORM_URL = 'https://apartments-a4b17.web.app/modules/boletim.html';
const BOLETINS_COLSPAN = 9;
const SEND_DEADLINE_BUSINESS_DAYS = 3;

const state = {
  boletins: []
};

const els = {
  form: document.getElementById('boletim-form'),
  guestName: document.getElementById('guest-name'),
  language: document.getElementById('guest-language'),
  guestCount: document.getElementById('guest-count'),
  checkinDate: document.getElementById('checkin-date'),
  checkoutDate: document.getElementById('checkout-date'),
  generatedBox: document.getElementById('generated-link'),
  generatedUrl: document.getElementById('generated-url'),
  copyGenerated: document.getElementById('copy-generated-link'),
  body: document.getElementById('boletins-body'),
  sentBody: document.getElementById('boletins-sent-body')
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadBoletins();
});

function bindEvents() {
  els.form?.addEventListener('submit', handleCreateBoletim);
  els.copyGenerated?.addEventListener('click', () => copyText(els.generatedUrl.value));
  [els.body, els.sentBody].forEach((body) => {
    body?.addEventListener('click', handleTableClick);
    body?.addEventListener('change', handleSentChange);
  });
}

async function handleCreateBoletim(event) {
  event.preventDefault();

  const guestName = els.guestName.value.trim();
  const language = els.language.value;
  const expectedGuests = Number(els.guestCount.value);
  const checkinDate = els.checkinDate.value;
  const checkoutDate = els.checkoutDate.value;

  if (!guestName || !language || !Number.isFinite(expectedGuests) || expectedGuests < 1 || !checkinDate || !checkoutDate) {
    showToast('Preenche o nome, língua, número de hóspedes e datas.', 'warning');
    return;
  }

  if (checkoutDate <= checkinDate) {
    showToast('A data de check-out tem de ser posterior ao check-in.', 'warning');
    return;
  }

  const token = createToken();
  const ref = doc(db, COLLECTION, token);
  const now = Timestamp.now();

  try {
    await setDoc(ref, {
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
  if (!state.boletins.length) {
    els.body.innerHTML = renderEmptyRow('Ainda não existem boletins.');
    if (els.sentBody) {
      els.sentBody.innerHTML = renderEmptyRow('Ainda não existem boletins enviados.');
    }
    return;
  }

  const pending = sortByCheckinDate(state.boletins.filter((item) => !item.sentToAuthorities));
  const sent = sortByCheckinDate(state.boletins.filter((item) => item.sentToAuthorities));

  els.body.innerHTML = pending.length
    ? renderBoletimRows(pending)
    : renderEmptyRow('Não existem boletins por enviar.');

  if (els.sentBody) {
    els.sentBody.innerHTML = sent.length
      ? renderBoletimRows(sent)
      : renderEmptyRow('Ainda não existem boletins enviados.');
  }
}

function renderBoletimRows(boletins) {
  return boletins.map((item) => {
    const status = item.guestSubmissions > 0 ? 'Preenchido' : 'Por preencher';
    const statusClass = item.guestSubmissions > 0 ? 'done' : 'pending';
    const link = buildPublicLink(item.id);
    const checked = item.sentToAuthorities ? 'checked' : '';
    const detailsId = `details-${item.id}`;

    return `
      <tr>
        <td>${escapeHtml(item.guestName || 'Sem nome')}</td>
        <td>${escapeHtml(formatStay(item.checkinDate, item.checkoutDate))}</td>
        <td>${renderSendDeadline(item.checkinDate, item.sentToAuthorities)}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
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
          <button type="button" data-action="copy" data-link="${escapeAttr(link)}">Copiar</button>
          <div class="mono-link">${escapeHtml(link)}</div>
        </td>
        <td>
          <button type="button" data-action="delete" data-id="${item.id}" data-name="${escapeAttr(item.guestName || 'Sem nome')}">
            Apagar
          </button>
        </td>
      </tr>
      <tr id="${detailsId}" hidden>
        <td colspan="${BOLETINS_COLSPAN}">${renderGuestDetails(item.guests || [])}</td>
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

function handleTableClick(event) {
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
  const input = event.target.closest('input[data-action="sent"]');
  if (!input) return;

  const id = input.dataset.id;
  const sentToAuthorities = input.checked;
  const label = input.closest('label')?.querySelector('span');
  if (label) label.textContent = sentToAuthorities ? 'Enviado' : 'Não enviado';

  try {
    await updateDoc(doc(db, COLLECTION, id), {
      sentToAuthorities,
      sentAt: sentToAuthorities ? Timestamp.now() : null,
      updatedAt: Timestamp.now()
    });
    const item = state.boletins.find((row) => row.id === id);
    if (item) item.sentToAuthorities = sentToAuthorities;
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

function createToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function copyText(text, showSuccess = true) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (showSuccess) showToast('Link copiado.', 'success');
  } catch {
    if (els.generatedUrl) {
      els.generatedUrl.focus();
      els.generatedUrl.select();
    }
    if (showSuccess) showToast('Não consegui copiar automaticamente.', 'warning');
  }
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

function renderGuestDetails(guests) {
  if (!guests.length) {
    return '<div class="empty-state">Ainda não há dados submetidos.</div>';
  }

  const rows = guests.map((guest) => `
    <tr>
      <td>${escapeHtml(formatDateTime(guest.submittedAt))}</td>
      <td>${escapeHtml(`${guest.firstName || ''} ${guest.lastName || ''}`.trim())}</td>
      <td>${escapeHtml(guest.birthDate || '-')}</td>
      <td>${escapeHtml(formatDateOnly(guest.checkinDate))}</td>
      <td>${escapeHtml(formatDateOnly(guest.checkoutDate))}</td>
      <td>${escapeHtml(formatDocumentType(guest.documentType))}</td>
      <td>${escapeHtml(guest.documentNumber || '-')}</td>
      <td>${escapeHtml(formatCountry(guest.countryOrigin))}</td>
      <td>${escapeHtml(formatCountry(guest.countryResidence))}</td>
      <td>${escapeHtml(formatCountry(guest.documentCountry))}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Submetido</th>
            <th>Nome</th>
            <th>Nascimento</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Documento</th>
            <th>Número</th>
            <th>Origem</th>
            <th>Residência</th>
            <th>País doc.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
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
