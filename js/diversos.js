import { db } from '../js/script.js';
import { collection, addDoc, getDocs } 
  from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const invoiceForm   = document.getElementById('carlos-invoice-form');
const invoicesBody  = document.getElementById('carlos-invoices-body');

document.addEventListener('DOMContentLoaded', () => {
  invoiceForm.addEventListener('submit', addInvoice);
  loadInvoices();
});

async function addInvoice(e) {
  e.preventDefault();
  const numero = document.getElementById('invoice-number').value.trim();
  const data   = document.getElementById('invoice-date').value;
  const total  = parseFloat(document.getElementById('invoice-total').value);
  if (!numero || !data || isNaN(total)) {
    alert('Preencha todos os campos da fatura');
    return;
  }
  await addDoc(collection(db, 'carlosInvoices'), { numero, data, total });
  invoiceForm.reset();
  loadInvoices();
}

async function loadInvoices() {
  invoicesBody.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';
  const snapInv = await getDocs(collection(db, 'carlosInvoices'));
  const invoices = snapInv.docs.map(d => ({ id: d.id, ...d.data() }));
  invoicesBody.innerHTML = '';
  if (invoices.length === 0) {
    invoicesBody.innerHTML = '<tr><td colspan="6">Nenhuma fatura cadastrada</td></tr>';
  }
  invoices.forEach(inv => renderInvoiceRow(inv));
}

async function renderInvoiceRow(inv) {
  // Lógica de renderização tal como tens no cenas.js
}
