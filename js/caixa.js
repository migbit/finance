// js/caixa.js

// Importar Firestore
import { db } from './script.js';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Elementos do DOM
const caixaForm   = document.getElementById('caixa-form');
const btnEntrada  = document.getElementById('btn-entrada');
const btnSaida    = document.getElementById('btn-saida');
const tipoInput   = document.getElementById('tipo');
const selectCaixa = document.getElementById('caixa'); // banco | direita | esquerda

// Botões Entrada/Saída (exclusivos)
btnEntrada.addEventListener('click', () => setTipoTransacao('Entrada'));
btnSaida.addEventListener('click',   () => setTipoTransacao('Saída'));

function setTipoTransacao(tipo) {
  tipoInput.value = tipo;
  btnEntrada.classList.toggle('btn-active', tipo === 'Entrada');
  btnSaida.classList.toggle('btn-active',   tipo === 'Saída');
}

// Formatação numérica
function formatNumber(number) {
  return number.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'decimal' });
}

// Submeter transação
caixaForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const tipo  = tipoInput.value;
  const valor = parseFloat(document.getElementById('valor').value);
  const caixa = selectCaixa.value; // banco | direita | esquerda

  if (!tipo || isNaN(valor) || valor <= 0) {
    alert('Por favor, selecione um tipo de transação e insira um valor válido.');
    return;
  }

  try {
    const docData = {
      tipo,
      valor: tipo === 'Entrada' ? valor : -valor,
      caixa,
      timestamp: new Date()
    };

    await addDoc(collection(db, 'caixa'), docData);
    alert('Transação registada com sucesso!');
    caixaForm.reset();
    setTipoTransacao('');
    carregarRelatorio();
  } catch (e) {
    console.error('Erro ao registar transação: ', e);
    alert('Ocorreu um erro ao registar a transação.');
  }
});

// Carregar relatório para as três caixas
async function carregarRelatorio() {
  const elBanco    = document.getElementById('caixa-banco');
  const elDireita  = document.getElementById('caixa-direita');
  const elEsquerda = document.getElementById('caixa-esquerda');

  [elBanco, elDireita, elEsquerda].forEach(el => { if (el) el.innerHTML = '<p>A carregar…</p>'; });

  try {
    const q  = query(collection(db, 'caixa'), orderBy('timestamp', 'desc'));
    const qs = await getDocs(q);

    const caixas = {
      banco:   { transacoes: [], total: 0 },
      direita: { transacoes: [], total: 0 },
      esquerda:{ transacoes: [], total: 0 }
    };

    qs.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;
      const cx = d.caixa || 'banco'; // docs antigos sem "caixa" → banco (apenas em memória)
      const v  = Number(d.valor) || 0;
      const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
      const row = { ...d, id, _valor: v, _date: ts };

      if (!caixas[cx]) return;
      caixas[cx].transacoes.push(row);
      caixas[cx].total += v;
    });

    const rowActions = (id) =>
      `<div style="display:flex; gap:.4rem; justify-content:center;">
         <button type="button" data-action="edit" data-id="${id}">Editar</button>
       </div>`;

    const trRow = (t) => {
      const date = t._date.toLocaleDateString('pt-PT');
      const v = t._valor;
      const valorClass = v >= 0 ? 'valor-positivo' : 'valor-negativo';
      const formattedValor = formatNumber(Math.abs(v));
      return `
        <tr data-id="${t.id}">
          <td>${date}</td>
          <td>${t.tipo}</td>
          <td class="${valorClass} formatted-number">${v >= 0 ? '+' : '-'}€${formattedValor}</td>
          <td>${rowActions(t.id)}</td>
        </tr>`;
    };

    const tableWrap = (rowsHtml) =>
      `<table>
         <tr><th>Data</th><th>Tipo</th><th>Valor (€)</th><th>Ações</th></tr>
         ${rowsHtml || '<tr><td colspan="4" style="text-align:center;">Sem registos</td></tr>'}
       </table>`;

    const totalDiv = (label, total) => {
      const totalClass = total >= 0 ? 'valor-positivo' : 'valor-negativo';
      const formatted = formatNumber(Math.abs(total));
      return `<div class="total-caixa centered">${label}: <span class="${totalClass} formatted-number">${total >= 0 ? '+' : '-'}€${formatted}</span></div>`;
    };

    const renderCaixa = (cont, dados, label = 'Total') => {
  const maxRows = 5; // quantas mostrar por defeito
  const allRows = dados.transacoes.map(t => trRow(t));
  const hiddenRows = allRows.slice(maxRows).join('');
  const visibleRows = allRows.slice(0, maxRows).join('');

  const tableHtml = `
    <table>
      <tr><th>Data</th><th>Tipo</th><th>Valor (€)</th><th>Ações</th></tr>
      ${visibleRows || '<tr><td colspan="4" style="text-align:center;">Sem registos</td></tr>'}
      ${hiddenRows ? `<tbody class="hidden-rows" style="display:none;">${hiddenRows}</tbody>` : ''}
    </table>
    ${hiddenRows ? `<button type="button" class="mostrar-mais">Mostra Mais</button>` : ''}
  `;

  cont.innerHTML = tableHtml + totalDiv(label, dados.total);
};


    if (elBanco)    renderCaixa(elBanco,    caixas.banco);
    if (elDireita)  renderCaixa(elDireita,  caixas.direita);
    if (elEsquerda) renderCaixa(elEsquerda, caixas.esquerda);

    // Calcular e renderizar o Total Banco + Esquerda
    const elTotalBE = document.getElementById('total-banco-esquerda');
    if (elTotalBE) {
      const totalBE = (caixas.banco.total || 0) + (caixas.esquerda.total || 0);
      elTotalBE.innerHTML = totalDiv('Total Banco + Esquerda', totalBE);
    }

  } catch (e) {
    console.error('Erro ao carregar relatório: ', e);
    [elBanco, elDireita, elEsquerda].forEach(el => { if (el) el.innerHTML = '<p>Ocorreu um erro ao carregar.</p>'; });
  }
}

// Click handler único: Editar / Guardar / Cancelar
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'edit') {
    const tr = btn.closest('tr');
    if (!tr) return;

    const tds = Array.from(tr.children);
    const currentDate = tds[0].textContent.trim();
    const currentTipo = tds[1].textContent.trim();
    const currentValorTxt = tds[2].textContent.trim().replace(/[+€.\s]/g,'').replace(',', '.');
    const negative = tds[2].textContent.includes('-');
    const currentValor = (negative ? -1 : 1) * parseFloat(currentValorTxt || '0');

    const tipoSel = `
      <select class="edit-tipo">
        <option value="Entrada" ${currentTipo==='Entrada'?'selected':''}>Entrada</option>
        <option value="Saída"   ${currentTipo==='Saída'  ?'selected':''}>Saída</option>
      </select>`;

    const valorInput = `<input type="number" class="edit-valor" step="0.01" value="${Math.abs(currentValor)}" style="width:110px;">`;

    const caixaSel = `
      <select class="edit-caixa">
        <option value="banco">Caixa Banco</option>
        <option value="direita">Caixa Direita</option>
        <option value="esquerda">Caixa Esquerda</option>
      </select>`;

    tr.setAttribute('data-old-html', tr.innerHTML);
    tr.innerHTML = `
      <td>${currentDate}</td>
      <td>${tipoSel}</td>
      <td>${valorInput}</td>
      <td>
        <div style="display:flex; gap:.4rem; align-items:center; flex-wrap:wrap;">
          ${caixaSel}
          <button type="button" data-action="save" data-id="${id}">Guardar</button>
          <button type="button" data-action="cancel" data-id="${id}">Cancelar</button>
        </div>
      </td>`;

    // Selecionar caixa correta
    const container = tr.closest('#caixa-banco, #caixa-direita, #caixa-esquerda');
    const sel = tr.querySelector('.edit-caixa');
    if (container?.id === 'caixa-banco') sel.value = 'banco';
    if (container?.id === 'caixa-direita') sel.value = 'direita';
    if (container?.id === 'caixa-esquerda') sel.value = 'esquerda';

    return;
  }

  if (action === 'cancel') {
    const tr = e.target.closest('tr');
    tr.innerHTML = tr.getAttribute('data-old-html') || tr.innerHTML;
    tr.removeAttribute('data-old-html');
    return;
  }

  if (action === 'save') {
    const tr = e.target.closest('tr');
    const newTipo  = tr.querySelector('.edit-tipo').value;
    const newValor = parseFloat(tr.querySelector('.edit-valor').value || '0');
    const newCaixa = tr.querySelector('.edit-caixa').value;

    if (!newValor || newValor <= 0) { alert('Valor inválido'); return; }

    const docRef = doc(db, 'caixa', btn.dataset.id);
    const update = {
      tipo: newTipo,
      valor: newTipo === 'Entrada' ? Math.abs(newValor) : -Math.abs(newValor),
      caixa: newCaixa
    };

    await updateDoc(docRef, update);
    await carregarRelatorio();
    return;
  }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  carregarRelatorio();
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('mostrar-mais')) {
    const btn = e.target;
    const tbody = btn.previousElementSibling.querySelector('.hidden-rows');
    if (tbody) {
      tbody.style.display = tbody.style.display === 'none' ? 'table-row-group' : 'none';
      btn.textContent = tbody.style.display === 'none' ? 'Mostra Mais' : 'Mostrar Menos';
    }
  }
});