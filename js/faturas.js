// Importar as funções necessárias do Firebase
import { db } from './script.js';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// === Mantém: dados manuais do ano anterior ===
const manualFaturasEstatica = [
  { ano: 2024, mes: 1, apartamento: '123', valorTransferencia: 1915.11, taxaAirbnb: 0 },
  { ano: 2024, mes: 1, apartamento: '1248', valorTransferencia: 3851, taxaAirbnb: 0 },
  { ano: 2024, mes: 2, apartamento: '123', valorTransferencia: 426, taxaAirbnb: 0 },
  { ano: 2024, mes: 2, apartamento: '1248', valorTransferencia: 1454, taxaAirbnb: 0 },
  { ano: 2024, mes: 3, apartamento: '123', valorTransferencia: 1310, taxaAirbnb: 0 },
  { ano: 2024, mes: 3, apartamento: '1248', valorTransferencia: 2678, taxaAirbnb: 0 },
  { ano: 2024, mes: 4, apartamento: '123', valorTransferencia: 4858.11, taxaAirbnb: 0 },
  { ano: 2024, mes: 4, apartamento: '1248', valorTransferencia: 6323, taxaAirbnb: 0 },
  { ano: 2024, mes: 5, apartamento: '123', valorTransferencia: 5680, taxaAirbnb: 0 },
  { ano: 2024, mes: 5, apartamento: '1248', valorTransferencia: 4806.61, taxaAirbnb: 0 },
  { ano: 2024, mes: 6, apartamento: '123', valorTransferencia: 4708.73, taxaAirbnb: 0 },
  { ano: 2024, mes: 6, apartamento: '1248', valorTransferencia: 6206, taxaAirbnb: 0 },
  { ano: 2024, mes: 7, apartamento: '123', valorTransferencia: 3659.04, taxaAirbnb: 0 },
  { ano: 2024, mes: 7, apartamento: '1248', valorTransferencia: 6015.30, taxaAirbnb: 0 },
  { ano: 2024, mes: 8, apartamento: '123', valorTransferencia: 5174, taxaAirbnb: 0 },
  { ano: 2024, mes: 8, apartamento: '1248', valorTransferencia: 7777, taxaAirbnb: 0 },
  { ano: 2024, mes: 9, apartamento: '123', valorTransferencia: 4599.41, taxaAirbnb: 0 },
  { ano: 2024, mes: 9, apartamento: '1248', valorTransferencia: 6780.52, taxaAirbnb: 0 },
];

// === DOM ===
const faturaForm        = document.getElementById('fatura-form');
const editarIdInput     = document.getElementById('fatura-id-edicao');
const cancelarEdicaoBtn = document.getElementById('cancelar-edicao');
const submitBtn         = document.getElementById('submit-fatura') || faturaForm?.querySelector('button[type="submit"]');

// === Edição (preenche formulário) ===
function entrarEmModoEdicao(f) {
  const wrap       = document.getElementById('fatura-form-wrap');
  const toggleBtn  = document.getElementById('toggle-fatura-form');
  const cancelarBtn= document.getElementById('cancelar-edicao');
  if (wrap) wrap.classList.remove('hidden');
  if (toggleBtn) toggleBtn.textContent = 'Fechar formulário';
  if (cancelarBtn) cancelarBtn.style.display = 'inline-block';

  if (editarIdInput) editarIdInput.value = f.id || '';

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v ?? ''); };
  const setNum = (id, v) => { const el = document.getElementById(id); if (el) el.value = (typeof v === 'number' ? v : (v ?? '')); };

  // 1ª linha
  setVal('apartamento', f.apartamento);
  setNum('ano', Number(f.ano));
  setVal('mes', String(f.mes));
  setVal('numero-fatura', f.numeroFatura);

  // 2ª linha
  setNum('taxa-airbnb', Number(f.taxaAirbnb));
  setNum('valor-transferencia', Number(f.valorTransferencia));
  setNum('taxa-limpeza', Number(f.taxaLimpeza)); // se não existir, fica vazio

  // 3ª linha
  setNum('valor-operador', Number(f.valorOperador));
  setNum('noites-extra', Number(f.noitesExtra));
  setNum('noites-criancas', Number(f.noitesCriancas));
  setNum('valor-direto', Number(f.valorDireto));
  setNum('valor-tmt', Number(f.valorTmt));

  // 4ª/5ª linhas (estadia & hóspedes)
  setVal('checkin', f.checkIn || '');
  setVal('checkout', f.checkOut || '');
  setNum('noites', (typeof f.noites === 'number' ? f.noites : ''));
  setNum('preco-medio-noite', (typeof f.precoMedioNoite === 'number' ? f.precoMedioNoite : ''));
  setNum('adultos', (typeof f.hospedesAdultos === 'number' ? f.hospedesAdultos : ''));
  setNum('criancas', (typeof f.hospedesCriancas === 'number' ? f.hospedesCriancas : ''));
  setNum('bebes', (typeof f.hospedesBebes === 'number' ? f.hospedesBebes : ''));

  document.getElementById('apartamento')?.focus();
  wrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sairDoModoEdicao() {
  if (editarIdInput) editarIdInput.value = '';
  if (submitBtn) submitBtn.textContent = 'Guardar';
  if (cancelarEdicaoBtn) cancelarEdicaoBtn.style.display = 'none';
  faturaForm?.reset();
  definirValoresPadrao();
}

cancelarEdicaoBtn?.addEventListener('click', sairDoModoEdicao);

// === Inicialização ===
document.addEventListener('DOMContentLoaded', async () => {
  await definirValoresPadrao();

  // Auto-preencher Nº de Noites quando alteras check-in/out
  ['checkin','checkout'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const ci = document.getElementById('checkin')?.value;
      const co = document.getElementById('checkout')?.value;
      const out = document.getElementById('noites');
      if (!out) return;
      if (ci && co) {
        const d1 = new Date(ci);
        const d2 = new Date(co);
        const n = Math.round((d2 - d1) / 86400000);
        out.value = (Number.isFinite(n) && n >= 0) ? n : '';
      } else {
        out.value = '';
      }
    });
  });

  // Toggle abrir/fechar formulário de fatura
  const formBtn  = document.getElementById('toggle-fatura-form');
  const formWrap = document.getElementById('fatura-form-wrap');
  const form     = document.getElementById('fatura-form');
  if (formBtn && formWrap) {
    formBtn.addEventListener('click', () => {
      formWrap.classList.toggle('hidden');
      formBtn.textContent = formWrap.classList.contains('hidden') ? 'Mostrar' : 'Fechar formulário';
    });
  }

  // Cancelar edição → fecha e volta a “Mostrar”
  const cancelarBtn = document.getElementById('cancelar-edicao');
  if (cancelarBtn && formBtn && formWrap && form) {
    cancelarBtn.addEventListener('click', () => {
      form.reset();
      document.getElementById('fatura-id-edicao').value = '';
      formWrap.classList.add('hidden');
      formBtn.textContent = 'Mostrar';
      cancelarBtn.style.display = 'none';
    });
  }
});

// === Guardar / Atualizar fatura (ÚNICO handler) ===
document.getElementById('fatura-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // helpers
  const getVal = (id) => (document.getElementById(id)?.value ?? '');
  const parseIntSafe = (id, def = 0) => {
    const v = getVal(id).trim(); if (v === '') return def;
    const n = parseInt(v, 10); return Number.isNaN(n) ? def : n;
  };
  const parseFloatSafe = (id, def = 0) => {
    const v = getVal(id).trim(); if (v === '') return def;
    const n = parseFloat(v); return Number.isNaN(n) ? def : n;
  };

  // base
  const apartamento        = getVal('apartamento');
  const ano                = parseIntSafe('ano', null);
  const mes                = parseIntSafe('mes', null);
  const numeroFatura       = getVal('numero-fatura');
  const taxaAirbnb         = parseFloatSafe('taxa-airbnb', 0);
  const valorTransferencia = parseFloatSafe('valor-transferencia', 0);
  const valorOperador      = parseFloatSafe('valor-operador', 0);
  const noitesExtra        = parseIntSafe('noites-extra', 0);
  const noitesCriancas     = parseIntSafe('noites-criancas', 0);
  const valorDireto        = parseFloatSafe('valor-direto', 0);
  const valorTmt           = parseFloatSafe('valor-tmt', 0);
  const taxaLimpeza        = parseFloatSafe('taxa-limpeza', 0);

  // estadia & hóspedes
  const checkIn            = getVal('checkin')  || null;
  const checkOut           = getVal('checkout') || null;

  // nº noites
  const noitesInput = getVal('noites');
  let noites = noitesInput !== '' ? parseInt(noitesInput, 10) : null;
  if (noitesInput === '' && checkIn && checkOut) {
    const d1 = new Date(checkIn), d2 = new Date(checkOut);
    const n = Math.round((d2 - d1) / 86400000);
    noites = Number.isFinite(n) && n >= 0 ? n : null;
  }

  const precoMedioNoite    = parseFloatSafe('preco-medio-noite', null);
  const hospedesAdultos    = parseIntSafe('adultos',  0);
  const hospedesCriancas   = parseIntSafe('criancas', 0);
  const hospedesBebes      = parseIntSafe('bebes',    0);

  // payload
  const formData = {
    apartamento,
    ano,
    mes,
    numeroFatura,
    taxaAirbnb,
    valorTransferencia,
    valorOperador,
    noitesExtra,
    noitesCriancas,
    valorDireto,
    valorTmt,
    taxaLimpeza,
    checkIn,
    checkOut,
    noites: noites ?? null,
    precoMedioNoite: precoMedioNoite ?? null,
    hospedesAdultos,
    hospedesCriancas,
    hospedesBebes
  };

  const idEdicao = getVal('fatura-id-edicao');

  try {
    if (idEdicao) {
      // edição → NÃO mexe no timestamp
      await updateDoc(doc(db, 'faturas', idEdicao), formData);
      alert('Fatura atualizada com sucesso!');
    } else {
      // criação → adiciona timestamp de criação
      formData.timestamp = new Date();
      await addDoc(collection(db, 'faturas'), formData);
      alert('Fatura registada com sucesso!');
    }

    // pós-submit
    const form      = document.getElementById('fatura-form');
    const wrap      = document.getElementById('fatura-form-wrap');
    const btnMain   = document.getElementById('toggle-fatura-form');
    const btnCancel = document.getElementById('cancelar-edicao');

    if (form) form.reset();
    const idEditEl = document.getElementById('fatura-id-edicao');
    if (idEditEl) idEditEl.value = '';

    if (wrap) wrap.classList.add('hidden');
    if (btnMain) btnMain.textContent = 'Mostrar';
    if (btnCancel) btnCancel.style.display = 'none';

    definirValoresPadrao();
  } catch (err) {
    console.error('Erro ao gravar fatura:', err);
    alert('Ocorreu um erro ao gravar a fatura.');
  }
});

// === Defaults ===
async function definirValoresPadrao() {
  const hoje = new Date();
  document.getElementById('ano').value = hoje.getFullYear();
  document.getElementById('mes').value = hoje.getMonth() + 1;

  // última fatura (timestamp) → próximo número
  const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  let proximo = "M1";
  if (!snap.empty) {
    const ultima = snap.docs[0].data().numeroFatura;         // ex: "M593"
    const num = parseInt(ultima.replace(/\D/g, ""), 10) + 1; // 593 → 594
    proximo = `M${num}`;
  }
  document.getElementById('numero-fatura').value = proximo;
}

// === Mantém: Ações globais (se tiveres listagem nesta página) ===
window.editarFatura = function (btn) {
  try {
    const raw = btn.dataset.fatura || '{}';
    const f = JSON.parse(raw.replace(/&quot;/g, '"'));
    entrarEmModoEdicao(f);
  } catch (e) {
    console.error('Falha a ler dados da fatura para edição:', e);
    alert('Não foi possível abrir esta fatura para edição.');
  }
};

window.apagarFatura = async function(btn) {
  const id  = btn.dataset.id;
  const num = btn.dataset.num || '';
  if (!id) return;

  const ok = confirm(`Apagar a fatura ${num}? Esta ação não pode ser anulada.`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, 'faturas', id));
    alert('Fatura apagada.');
    sairDoModoEdicao();
  } catch (err) {
    console.error('Erro ao apagar fatura:', err);
    alert('Não foi possível apagar a fatura.');
  }
};

// Manténs o export PDF se usares nesta página
window.exportarPDFFaturacao = function(key, grupoJson) {
  import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.4.0/jspdf.umd.min.js')
    .then(() => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const grupo = JSON.parse(grupoJson);

      const [ano, mes] = key.split('-');
      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

      doc.setFontSize(16);
      doc.text(`Relatório de Faturação - ${meses[mes-1]} ${ano}`, 105, 15, { align: 'center' });

      const headers = ['Fatura Nº','Data','Transferência','Taxa Airbnb','Base','IVA (€)','Total (€)'];
      const xPos = [2,32,62,92,122,152,182];
      const wCol = 30;
      let y = 30;

      doc.setFontSize(12);
      doc.setFont('helvetica','bold');
      headers.forEach((h,i) => {
        const tw = doc.getStringUnitWidth(h)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(h, xPos[i] + (wCol - tw)/2, y);
      });

      const mItems  = grupo.filter(f => f.numeroFatura.startsWith('M'));
      const cxItems = grupo.filter(f => !f.numeroFatura.startsWith('M'));

      let sumT=0, sumTax=0, sumB=0, sumI=0, sumTot=0;
      doc.setFont('helvetica','normal');
      y += 10;
      mItems.forEach(f => {
        const dataStr = f.timestamp?.seconds ? new Date(f.timestamp.seconds*1000).toLocaleDateString() : '';
        const total   = (f.valorTransferencia||0) + (f.taxaAirbnb||0);
        const base    = total / 1.06;
        const iva     = total - base;

        sumT   += (f.valorTransferencia||0);
        sumTax += (f.taxaAirbnb||0);
        sumB   += base;
        sumI   += iva;
        sumTot += total;

        const vals = [
          f.numeroFatura || '',
          dataStr,
          `€${(f.valorTransferencia||0).toFixed(2)}`,
          `€${(f.taxaAirbnb||0).toFixed(2)}`,
          `€${base.toFixed(2)}`,
          `€${iva.toFixed(2)}`,
          `€${total.toFixed(2)}`
        ];
        vals.forEach((txt,i) => {
          const tw = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
          doc.text(txt, xPos[i] + (wCol - tw)/2, y);
        });
        y += 10;
      });

      doc.setFont('helvetica','bold');
      const totalVals = [
        'Totais','',
        `€${sumT.toFixed(2)}`,
        `€${sumTax.toFixed(2)}`,
        `€${sumB.toFixed(2)}`,
        `€${sumI.toFixed(2)}`,
        `€${sumTot.toFixed(2)}`
      ];
      totalVals.forEach((txt,i) => {
        const tw = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(txt, xPos[i] + (wCol - tw)/2, y);
      });

      const pageH = doc.internal.pageSize.getHeight();
      let yCX = pageH - 20;
      doc.setFont('helvetica','normal');
      cxItems.forEach(f => {
        const dataStr = f.timestamp?.seconds ? new Date(f.timestamp.seconds*1000).toLocaleDateString() : '';
        const total   = (f.valorTransferencia||0) + (f.taxaAirbnb||0);

        let txt = f.numeroFatura || '';
        let tw  = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(txt, xPos[0] + (wCol - tw)/2, yCX);

        tw  = doc.getStringUnitWidth(dataStr)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(dataStr, xPos[1] + (wCol - tw)/2, yCX);

        txt = `€${total.toFixed(2)}`;
        tw  = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(txt, xPos[6] + (wCol - tw)/2, yCX);

        yCX += 10;
      });

      doc.save(`relatorio-faturacao-${ano}-${meses[mes-1]}.pdf`);
    })
    .catch(err => console.error('Erro ao exportar PDF:', err));
};
