// js/diversos.js
import { db } from '../js/script.js';
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ---- Formatação € (padrão PT) ----
function euroInt(v) {
  const num = Math.round(Number(v) || 0);
  return num.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
    useGrouping: true
  }).replace(/\./g, ' ') + ' €';
}


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
    <td>${euroInt(inv.total)}</td>
    <td>${euroInt(paidSum)}</td>
    <td>${euroInt(balance)}</td>
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


// ===========================
// IVA Estrangeiro
// ===========================

// DOM refs
const ivaForm     = document.getElementById('iva-estrangeiro-form');
const ivaBody     = document.getElementById('iva-estrangeiro-body');
const triBody     = document.getElementById('iva-estrangeiro-tri-body');
const btnIvaMore  = document.getElementById('iva-more-btn');

// Guardas simples
if (!ivaForm || !ivaBody || !triBody) {
  console.warn('Secção "IVA Estrangeiro" não encontrada no DOM (ok se estiveres noutra página).');
}

// Estado local para paginar/expandir
let _ivaRowsAll = [];     // linhas já ordenadas (mais recentes primeiro)
let _ivaVisible = 0;      // quantas linhas estão visíveis
const IVA_PAGE = 6;       // mostra 5-6 linhas como pediste

document.addEventListener('DOMContentLoaded', () => {
  if (ivaForm) {
    ivaForm.addEventListener('submit', onAddIva);
    loadIvaEstrangeiro();
  }
});

// Adicionar registo
async function onAddIva(e){
  e.preventDefault();
  const dataStr = document.getElementById('iva-data').value;
  const valor   = parseFloat(document.getElementById('iva-valor').value);

  if (!dataStr || isNaN(valor)) {
    alert('Preenche a Data e o Valor (sem IVA).');
    return;
  }

  // Cálculos corretos: IVA = 23% do valor; Total = valor + IVA
  const iva   = +(valor * 0.23).toFixed(2);
  const total = +(valor * 1.23).toFixed(2);

  try {
    await _addDoc(_collection(db, 'ivaEstrangeiro'), {
      data: dataStr,
      valor: +valor.toFixed(2),
      iva,
      total,
      ts: Date.now()
    });
    ivaForm.reset();
    await loadIvaEstrangeiro();
  } catch (err) {
    console.error(err);
    alert('Erro ao adicionar registo de IVA Estrangeiro.');
  }
}

// Carregar todos os registos e renderizar tabela + trimestre
async function loadIvaEstrangeiro(){
  if (!ivaBody) return;

  ivaBody.innerHTML = '<tr><td colspan="4">Carregando…</td></tr>';

  try {
    const snap = await _getDocs(_collection(db, 'ivaEstrangeiro'));
    const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ordena por data (desc) usando data (YYYY-MM-DD) ou ts
    itens.sort((a,b) => {
      const ad = (a.data || '').replaceAll('-','');
      const bd = (b.data || '').replaceAll('-','');
      // fallback com ts se faltar data
      const aa = ad ? parseInt(ad,10) : (a.ts || 0);
      const bb = bd ? parseInt(bd,10) : (b.ts || 0);
      return bb - aa;
    });

    _ivaRowsAll = itens;
    _ivaVisible = 0;
    ivaBody.innerHTML = '';
    renderNextPage();           // primeira página
    renderResumoTrimestres(itens);

    // Mostrar/ocultar botão "Mostrar mais"
    btnIvaMore.style.display = (_ivaVisible < _ivaRowsAll.length) ? 'inline-block' : 'none';
    if (!btnIvaMore.dataset.bound) {
      btnIvaMore.addEventListener('click', () => {
        renderNextPage();
        btnIvaMore.style.display = (_ivaVisible < _ivaRowsAll.length) ? 'inline-block' : 'none';
      });
      btnIvaMore.dataset.bound = '1';
    }

  } catch (err) {
    console.error(err);
    ivaBody.innerHTML = '<tr><td colspan="4">Erro ao carregar registos</td></tr>';
  }
}

// Renderiza próxima “página” de linhas (5-6 de cada vez)
function renderNextPage(){
  const slice = _ivaRowsAll.slice(_ivaVisible, _ivaVisible + IVA_PAGE);
  slice.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.data || '')}</td>
      <td>${euroInt(r.valor)}</td>
      <td>${euroInt(r.iva ?? (r.valor*0.23))}</td>
      <td>${euroInt(r.total ?? (r.valor*1.23))}</td>
      `;
    ivaBody.appendChild(tr);
  });
  _ivaVisible += slice.length;

  if (_ivaVisible === 0) {
    ivaBody.innerHTML = '<tr><td colspan="4">Sem registos</td></tr>';
  }
}

// Resumo por trimestre (Ano, T, Valor, IVA, Total)
function renderResumoTrimestres(items){
  triBody.innerHTML = '';

  // Agrupar por ano-tri
  const acc = {};
  items.forEach(r => {
    const d = r.data ? new Date(r.data) : (r.ts ? new Date(r.ts) : null);
    if (!d || isNaN(d)) return;

    const y = d.getFullYear();
    const q = Math.floor(d.getMonth() / 3) + 1; // 0..11 -> 1..4
    const key = `${y}-Q${q}`;

    if (!acc[key]) acc[key] = { ano: y, tri: q, valor: 0, iva: 0, total: 0 };
    const valor = +(+r.valor || 0);
    const iva   = +(r.iva ?? (valor * 0.23));
    const total = +(r.total ?? (valor * 1.23));

    acc[key].valor += valor;
    acc[key].iva   += iva;
    acc[key].total += total;
  });

  // Ordenar por ano desc, trimestre asc
  const rows = Object.values(acc).sort((a,b) => b.ano - a.ano || a.tri - b.tri);

  if (rows.length === 0) {
    triBody.innerHTML = '<tr><td colspan="5">Sem dados</td></tr>';
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.ano}</td>
      <td>Q${r.tri}</td>
      <td>${euroInt(r.valor)}</td>
      <td>${euroInt(r.iva)}</td>
      <td>${euroInt(r.total)}</td>
      `;
    triBody.appendChild(tr);
  });
}

// Helpers
function toMoney(n){
  const v = Number(n || 0);
  return v.toFixed(2);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
