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

const state = {
  boletins: []
};

const els = {
  form: document.getElementById('boletim-form'),
  guestName: document.getElementById('guest-name'),
  language: document.getElementById('guest-language'),
  guestCount: document.getElementById('guest-count'),
  generatedBox: document.getElementById('generated-link'),
  generatedUrl: document.getElementById('generated-url'),
  copyGenerated: document.getElementById('copy-generated-link'),
  body: document.getElementById('boletins-body')
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadBoletins();
});

function bindEvents() {
  els.form?.addEventListener('submit', handleCreateBoletim);
  els.copyGenerated?.addEventListener('click', () => copyText(els.generatedUrl.value));
  els.body?.addEventListener('click', handleTableClick);
  els.body?.addEventListener('change', handleSentChange);
}

async function handleCreateBoletim(event) {
  event.preventDefault();

  const guestName = els.guestName.value.trim();
  const language = els.language.value;
  const expectedGuests = Number(els.guestCount.value);

  if (!guestName || !language || !Number.isFinite(expectedGuests) || expectedGuests < 1) {
    showToast('Preenche o nome, língua e número de hóspedes.', 'warning');
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
  els.body.innerHTML = '<tr><td colspan="8" class="empty-state">A carregar boletins...</td></tr>';

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
    els.body.innerHTML = '<tr><td colspan="8" class="empty-state">Erro ao carregar boletins.</td></tr>';
    showToast('Não foi possível carregar os boletins.', 'error');
  }
}

function renderBoletins() {
  if (!state.boletins.length) {
    els.body.innerHTML = '<tr><td colspan="8" class="empty-state">Ainda não existem boletins.</td></tr>';
    return;
  }

  els.body.innerHTML = state.boletins.map((item) => {
    const date = formatDateTime(item.createdAt);
    const status = item.guestSubmissions > 0 ? 'Preenchido' : 'Por preencher';
    const statusClass = item.guestSubmissions > 0 ? 'done' : 'pending';
    const link = buildPublicLink(item.id);
    const checked = item.sentToAuthorities ? 'checked' : '';
    const detailsId = `details-${item.id}`;

    return `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(item.guestName || 'Sem nome')}</td>
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
        <td colspan="8">${renderGuestDetails(item.guests || [])}</td>
      </tr>
    `;
  }).join('');
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
    await Promise.all(guestsSnap.docs.map((guestDoc) => deleteDoc(guestDoc.ref)));
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
    showToast(sentToAuthorities ? 'Marcado como enviado.' : 'Marcado como não enviado.', 'success');
  } catch (err) {
    console.error('Erro ao atualizar envio', err);
    input.checked = !sentToAuthorities;
    if (label) label.textContent = input.checked ? 'Enviado' : 'Não enviado';
    showToast('Não foi possível atualizar o estado.', 'error');
  }
}

function buildPublicLink(token) {
  return new URL(`boletim.html?t=${encodeURIComponent(token)}`, window.location.href).href;
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
