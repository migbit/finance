import { db } from './script.js';
import { showToast } from './toast.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

const COLLECTION = 'faturasEmFalta';

const form = document.getElementById('missing-invoice-form');
const dateInput = document.getElementById('missing-invoice-date');
const locationInput = document.getElementById('missing-invoice-location');
const valueInput = document.getElementById('missing-invoice-value');
const tableBody = document.getElementById('missing-invoices-body');
const submitButton = form?.querySelector('button[type="submit"]');

let currentUser = null;
let isSaving = false;

const formatEuro = (value) => {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });
};

const formatDate = (value) => {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

function setToday() {
  if (!dateInput || dateInput.value) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  dateInput.value = `${year}-${month}-${day}`;
}

function renderStatus(message) {
  tableBody.innerHTML = '';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.textContent = message;
  row.appendChild(cell);
  tableBody.appendChild(row);
}

function renderRows(items) {
  tableBody.innerHTML = '';

  if (!items.length) {
    renderStatus('Sem faturas em falta.');
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(item.data);

    const locationCell = document.createElement('td');
    locationCell.textContent = item.local || '-';

    const valueCell = document.createElement('td');
    valueCell.textContent = formatEuro(item.valor);

    const actionsCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'missing-invoice-delete';
    deleteButton.textContent = 'Apagar';
    deleteButton.addEventListener('click', () => deleteMissingInvoice(item));
    actionsCell.appendChild(deleteButton);

    row.append(dateCell, locationCell, valueCell, actionsCell);
    tableBody.appendChild(row);
  });
}

async function loadMissingInvoices() {
  if (!currentUser) {
    renderStatus('Inicie sessão para ver as faturas em falta.');
    return;
  }

  renderStatus('A carregar...');

  try {
    const q = query(collection(db, COLLECTION), orderBy('data', 'asc'));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    renderRows(items);
  } catch (error) {
    console.error('Erro ao carregar faturas em falta:', error);
    renderStatus('Erro ao carregar faturas em falta.');
    showToast('Não foi possível carregar as faturas em falta.', 'error');
  }
}

async function addMissingInvoice(event) {
  event.preventDefault();

  const data = dateInput.value;
  const local = locationInput.value.trim();
  const valor = Number(valueInput.value);

  if (!currentUser) {
    showToast('Inicie sessão antes de adicionar faturas em falta.', 'warning');
    return;
  }

  if (!data || !local || !Number.isFinite(valor) || valor < 0) {
    showToast('Preencha data, local e valor.', 'warning');
    return;
  }

  try {
    if (isSaving) return;
    isSaving = true;
    if (submitButton) submitButton.disabled = true;

    await addDoc(collection(db, COLLECTION), {
      data,
      local,
      valor,
      createdAt: serverTimestamp()
    });

    form.reset();
    setToday();
    await loadMissingInvoices();
    showToast('Fatura em falta adicionada.', 'success');
  } catch (error) {
    console.error('Erro ao adicionar fatura em falta:', error);
    showToast('Não foi possível adicionar a fatura em falta.', 'error');
  } finally {
    isSaving = false;
    if (submitButton) submitButton.disabled = !currentUser;
  }
}

async function deleteMissingInvoice(item) {
  const ok = confirm(`Apagar a fatura em falta de ${item.local || 'sem local'}?`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, COLLECTION, item.id));
    await loadMissingInvoices();
    showToast('Fatura em falta apagada.', 'success');
  } catch (error) {
    console.error('Erro ao apagar fatura em falta:', error);
    showToast('Não foi possível apagar a fatura em falta.', 'error');
  }
}

if (form && tableBody) {
  setToday();
  form.addEventListener('submit', addMissingInvoice);

  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (submitButton) submitButton.disabled = !user;
    loadMissingInvoices();
  });
}
