// js/diversos.js
import { db } from '../js/script.js';
import { collection, addDoc, getDocs } 
  from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// DOM
const invoiceForm  = document.getElementById('carlos-invoice-form');
const invoicesBody = document.getElementById('carlos-invoices-body');

// Guardas simples (evita erros se elementos não existirem)
if (!invoiceForm || !invoicesBody) {
  console.error('Elementos da secção Carlos – Faturas Pendentes não encontrados.');
}

// Inicialização específica desta página
document.addEventListener('DOMContentLoaded', () => {
  if (invoiceForm) invoiceForm.addEventListener('submit', addInvoice);
  loadInvoices();
});

// 1) Adicionar nova fatura
async function addInvoice(e) {
  e.preventDefault();
  const numero = document.getElementById('invoice-number').value.trim();
  const data   = document.getElementById('invoice-date').value;
  const total  = parseFloat(document.getElementById('invoice-total').value);
  if (!numero || !data || isNaN(total)) {
    alert('Preencha todos os campos da fatura');
    return;
  }
  try {
    await addDoc(collection(db, 'carlosInvoices'), { numero, data, total });
    invoiceForm.reset();
    await loadInvoices();
  } catch (err) {
    console.error(err);
    alert('Erro ao adicionar fatura');
  }
}

// 2) Carregar e renderizar todas as faturas + pagamentos
async function loadInvoices() {
  if (!invoicesBody) return;
  invoicesBody.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';
  try {
    const snapInv = await getDocs(collection(db, 'carlosInvoices'));
    const invoices = snapInv.docs.map(d => ({ id: d.id, ...d.data() }));
    invoicesBody.innerHTML = '';
    if (invoices.length === 0) {
      invoicesBody.innerHTML = '<tr><td colspan="6">Nenhuma fatura cadastrada</td></tr>';
      return;
    }
    await Promise.all(invoices.map(inv => renderInvoiceRow(inv)));
  } catch (err) {
    console.error(err);
    invoicesBody.innerHTML = '<tr><td colspan="6">Erro ao carregar faturas</td></tr>';
  }
}

// 3) Renderizar cada fatura + sub-tabela de pagamentos
async function renderInvoiceRow(inv) {
  // Puxa pagamentos da subcoleção
  const snapPay  = await getDocs(collection(db, 'carlosInvoices', inv.id, 'payments'));
  const payments = snapPay.docs.map(p => p.data());
  const paidSum  = payments.reduce((s,p) => s + p.valorPago, 0);
  const balance  = inv.total - paidSum;

  // Linha principal da fatura
  const trInv = document.createElement('tr');
  if (paidSum >= inv.total) trInv.classList.add('text-muted');
  trInv.innerHTML = `
    <td>${inv.numero}</td>
    <td>${inv.data}</td>
    <td>€${Number(inv.total).toFixed(2)}</td>
    <td>€${paidSum.toFixed(2)}</td>
    <td>€${balance.toFixed(2)}</td>
    <td>
      <button class="btn btn-sm btn-primary btn-add-payment">Adicionar Pag.</button>
    </td>
  `;
  invoicesBody.appendChild(trInv);

  // Linhas dos pagamentos
  payments.forEach(pay => {
    const trPay = document.createElement('tr');
    trPay.classList.add('text-secondary');
    trPay.innerHTML = `
      <td></td>
      <td>${pay.dataPagamento}</td>
      <td></td>
      <td>€${Number(pay.valorPago).toFixed(2)}</td>
      <td></td>
      <td></td>
    `;
    invoicesBody.appendChild(trPay);
  });

  // Linha com o formulário (toggle)
  const trForm = document.createElement('tr');
  trForm.innerHTML = `
    <td colspan="6" style="display:none;">
      <form class="form-inline">
        <input type="date"   name="dataPagamento" required>
        <input type="number" name="valorPago" placeholder="Valor (€)" step="0.01" max="${balance.toFixed(2)}" required>
        <button type="submit" class="btn btn-success btn-sm ml-2">Registar</button>
      </form>
    </td>
  `;
  invoicesBody.appendChild(trForm);

  // Toggle do form
  trInv.querySelector('.btn-add-payment').addEventListener('click', () => {
    const cell = trForm.firstElementChild;
    cell.style.display = cell.style.display === 'none' ? 'block' : 'none';
  });

  // Submissão do pagamento
  trForm.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const dataPagamento = f.dataPagamento.value;
    const valorPago     = parseFloat(f.valorPago.value);
    try {
      await addDoc(collection(db, 'carlosInvoices', inv.id, 'payments'), { dataPagamento, valorPago });
      await loadInvoices();
    } catch (err) {
      console.error(err);
      alert('Erro ao registar pagamento');
    }
  });
}
