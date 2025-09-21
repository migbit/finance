// Importar as funções necessárias do Firebase
import { db } from './script.js';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Dados manuais de faturação (substitua X e Y pelos valores reais que me fornecer)
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

    let showPrevFaturaYears = false;

// DOM Elements
const faturaForm = document.getElementById('fatura-form');
const relatorioFaturacaoDiv = document.getElementById('relatorio-faturacao');

const editarIdInput      = document.getElementById('fatura-id-edicao');
const cancelarEdicaoBtn  = document.getElementById('cancelar-edicao');
const submitBtn          = document.getElementById('submit-fatura') || faturaForm.querySelector('button[type="submit"]');

// Ativa modo edição e preenche todos os campos
function entrarEmModoEdicao(f) {
  // Mostrar o form e ajustar botões
  const wrap = document.getElementById('fatura-form-wrap');
  const toggleBtn = document.getElementById('toggle-fatura-form');
  const cancelarBtn = document.getElementById('cancelar-edicao');
  if (wrap) wrap.classList.remove('hidden');
  if (toggleBtn) toggleBtn.textContent = 'Fechar formulário';
  if (cancelarBtn) cancelarBtn.style.display = 'inline-block';

  // Guardar o id em edição
  const idEdit = document.getElementById('fatura-id-edicao');
  if (idEdit) idEdit.value = f.id || '';

  // Helpers
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v ?? ''); };
  const setNum = (id, v) => { const el = document.getElementById(id); if (el) el.value = (typeof v === 'number' ? v : (v ?? '')); };

  // 1ª linha
  setVal('apartamento', f.apartamento);
  setNum('ano', Number(f.ano));
  setVal('mes', String(f.mes));
  setVal('numero-fatura', f.numeroFatura);

  // 2ª linha (inclui Taxa Limpeza — NOVO)
  setNum('taxa-airbnb', Number(f.taxaAirbnb));
  setNum('valor-transferencia', Number(f.valorTransferencia));
  setNum('taxa-limpeza', Number(f.taxaLimpeza)); // NOVO

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

  // Foco inicial
  const first = document.getElementById('apartamento');
  if (first) first.focus();

  // Scroll suave até ao formulário
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sairDoModoEdicao() {
  if (editarIdInput) editarIdInput.value = '';
  if (submitBtn) submitBtn.textContent = 'Guardar';
  if (cancelarEdicaoBtn) cancelarEdicaoBtn.style.display = 'none';
  faturaForm.reset();
  definirValoresPadrao(); // mantém o teu comportamento atual do “próximo nº”
}

if (cancelarEdicaoBtn) {
  cancelarEdicaoBtn.addEventListener('click', sairDoModoEdicao);
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await definirValoresPadrao();
  carregarTodosRelatorios();

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
        const n = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        out.value = (Number.isFinite(n) && n >= 0) ? n : '';
      } else {
        out.value = '';
      }
    });
  });

  // Toggle anos anteriores no relatório
  const togglePrevBtn = document.getElementById('toggle-prev-faturas');
  if (togglePrevBtn) {
    togglePrevBtn.addEventListener('click', () => {
      showPrevFaturaYears = !showPrevFaturaYears;
      togglePrevBtn.textContent = showPrevFaturaYears
        ? 'Ocultar anos anteriores'
        : 'Mostrar anos anteriores';
      carregarTodosRelatorios();
    });
  }

  // Toggle abrir/fechar formulário de fatura
  const formBtn  = document.getElementById('toggle-fatura-form');
  const formWrap = document.getElementById('fatura-form-wrap');
  const form     = document.getElementById('fatura-form');
  if (formBtn && formWrap) {
    formBtn.addEventListener('click', () => {
      formWrap.classList.toggle('hidden');
      formBtn.textContent = formWrap.classList.contains('hidden')
        ? 'Mostrar'
        : 'Fechar formulário';
    });
  }

  // Fechar formulário ao cancelar edição (limpa e repõe texto do botão)
  const cancelarBtn = document.getElementById('cancelar-edicao');
  if (cancelarBtn && formBtn && formWrap && form) {
    cancelarBtn.addEventListener('click', () => {
      form.reset(); // limpa todos os inputs
      document.getElementById('fatura-id-edicao').value = ''; // limpa id de edição
      formWrap.classList.add('hidden');
      formBtn.textContent = 'Mostrar';
      cancelarBtn.style.display = 'none'; // esconde o botão de cancelar
    });
  }
});

// Guardar / Atualizar fatura
document.getElementById('fatura-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  // helpers de leitura
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
  const taxaLimpeza        = parseFloatSafe('taxa-limpeza', 0); // ⬅️ novo campo

  // estadia & hóspedes
  const checkIn            = getVal('checkin')  || null;
  const checkOut           = getVal('checkout') || null;

  // nº noites: usa o input se existir; caso contrário calcula de check-in/out
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

  // construir payload (sem timestamp por agora)
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
    } else {
      // criação → adiciona timestamp de criação
      formData.timestamp = new Date();
      await addDoc(collection(db, 'faturas'), formData);
    }

    // pós-submit: limpar/fechar formulário e recarregar relatórios
    const form      = document.getElementById('fatura-form');
    const wrap      = document.getElementById('fatura-form-wrap');
    const btnMain   = document.getElementById('toggle-fatura-form');
    const btnCancel = document.getElementById('cancelar-edicao');

    if (form) form.reset();
    const idEditEl = document.getElementById('fatura-id-edicao');
    if (idEditEl) idEditEl.value = '';

    if (wrap) wrap.classList.add('hidden');
    if (btnMain) btnMain.textContent = 'Registar Nova Fatura';
    if (btnCancel) btnCancel.style.display = 'none';

    carregarTodosRelatorios();
  } catch (err) {
    console.error('Erro ao gravar fatura:', err);
    alert('Ocorreu um erro ao gravar a fatura.');
  }
});

    
async function definirValoresPadrao() {
         const hoje = new Date();
         document.getElementById('ano').value = hoje.getFullYear();
         document.getElementById('mes').value = hoje.getMonth() + 1;
    
         // buscar a última fatura (por timestamp) e calcular próximo número
         const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"), limit(1));
         const snap = await getDocs(q);
         let proximo = "M1";
         if (!snap.empty) {
             const ultima = snap.docs[0].data().numeroFatura;           // ex: "M593"
             const num = parseInt(ultima.replace(/\D/g, ""), 10) + 1;   // 593 → 594
             proximo = `M${num}`;
         }
         document.getElementById('numero-fatura').value = proximo;
     }

// Event Listeners
faturaForm.addEventListener('submit', async (e) => {
  e.preventDefault();

// --- NOVO: ler datas / noites / preço / hóspedes ---
const getVal = (id) => (document.getElementById(id)?.value ?? '');
const parseIntSafe = (id, def = null) => {
  const v = getVal(id).trim(); if (v === '') return def; const n = parseInt(v, 10); return Number.isNaN(n) ? def : n;
};
const parseFloatSafe = (id, def = null) => {
  const v = getVal(id).trim(); if (v === '') return def; const n = parseFloat(v);  return Number.isNaN(n) ? def : n;
};

const checkIn  = getVal('checkin')  || null;  // "YYYY-MM-DD" ou null
const checkOut = getVal('checkout') || null;

// calcular nº de noites se input estiver vazio
function diffNoites(ci, co) {
  if (!ci || !co) return null;
  const d1 = new Date(ci); const d2 = new Date(co);
  const ms = d2 - d1; if (Number.isNaN(ms) || ms < 0) return null;
  return Math.round(ms / (1000*60*60*24));
}
let noitesInp = parseIntSafe('noites', null);
if (noitesInp === null) noitesInp = diffNoites(checkIn, checkOut);

const precoMedioNoite = parseFloatSafe('preco-medio-noite', null);

const hospedesAdultos  = parseIntSafe('adultos',  0);
const hospedesCriancas = parseIntSafe('criancas', 0);
const hospedesBebes    = parseIntSafe('bebes',    0);

const formData = {
  apartamento: document.getElementById('apartamento').value,
  ano: parseInt(document.getElementById('ano').value),
  mes: parseInt(document.getElementById('mes').value),
  numeroFatura: document.getElementById('numero-fatura').value,
  taxaAirbnb: parseFloat(document.getElementById('taxa-airbnb').value),
  valorTransferencia: parseFloat(document.getElementById('valor-transferencia').value),
  valorOperador: parseFloat(document.getElementById('valor-operador').value),
  noitesExtra: parseInt(document.getElementById('noites-extra').value) || 0,
  noitesCriancas: parseInt(document.getElementById('noites-criancas').value) || 0,
  valorDireto: parseFloat(document.getElementById('valor-direto').value) || 0,
  valorTmt: parseFloat(document.getElementById('valor-tmt').value),
  timestamp: new Date(), // só usado na criação  ✅ vírgula aqui
  taxaLimpeza: parseFloat(document.getElementById('taxa-limpeza').value) || 0,
  // 🔽 NOVOS CAMPOS (seguros p/ docs antigos)
  checkIn,
  checkOut,
  noites: (typeof noitesInp === 'number' ? noitesInp : null),
  precoMedioNoite,
  hospedesAdultos,
  hospedesCriancas,
  hospedesBebes
};


  const editId = editarIdInput ? editarIdInput.value : '';

  try {
    if (editId) {
      // não atualizar o timestamp numa edição
      const { timestamp, ...dataSemTimestamp } = formData;
      await updateDoc(doc(db, "faturas", editId), dataSemTimestamp);
      alert('Fatura atualizada com sucesso!');
      sairDoModoEdicao();
    } else {
      await addDoc(collection(db, "faturas"), formData);
      alert('Fatura registrada com sucesso!');
      faturaForm.reset();
      definirValoresPadrao();
    }

    carregarTodosRelatorios();
  } catch (error) {
    console.error("Erro ao gravar fatura:", error);
    alert('Ocorreu um erro ao gravar a fatura.');
  }
});

async function carregarTodosRelatorios() {
  const firebaseFaturas = await carregarFaturas();
  const faturas = firebaseFaturas.concat(manualFaturasEstatica);

  gerarRelatorioFaturacao(faturas);
}

async function carregarFaturas() {
    try {
        const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar faturas:", error);
        return [];
    }
}

function gerarRelatorioFaturacao(faturas) {
    const currentYear = new Date().getFullYear();
    const arr = showPrevFaturaYears
      ? faturas
      : faturas.filter(f => f.ano === currentYear);
    const faturasAgrupadas = agruparPorAnoMes(arr);
    let html = '<table><thead><tr><th>Ano</th><th>Mês</th><th>Fatura Nº</th><th>Valor Transferência</th><th>Taxa AirBnB</th><th>Total Fatura</th><th>Ações</th></tr></thead><tbody>';

    Object.entries(faturasAgrupadas).forEach(([key, grupo]) => {
        const [ano, mes] = key.split('-');
        const totalTransferencia = grupo.reduce((sum, f) => sum + f.valorTransferencia, 0);
        const totalTaxaAirbnb = grupo.reduce((sum, f) => sum + f.taxaAirbnb, 0);
        const totalFatura = totalTransferencia + totalTaxaAirbnb;

        const grupoJSON = JSON.stringify(grupo).replace(/"/g, '&quot;');

        html += `
            <tr>
                <td>${ano}</td>
                <td>${obterNomeMes(parseInt(mes))}</td>
                <td>${grupo.map(f => f.numeroFatura).join(', ')}</td>
                <td>€${totalTransferencia.toFixed(2)}</td>
                <td>€${totalTaxaAirbnb.toFixed(2)}</td>
                <td>€${totalFatura.toFixed(2)}</td>
                <td>
                    <button onclick="mostrarDetalhesFaturacao('${key}', this)" data-detalhes="${grupoJSON}">Ver Detalhes</button>
                    <button onclick="exportarPDFFaturacao('${key}', '${grupoJSON}')">Exportar PDF</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    relatorioFaturacaoDiv.innerHTML = html;
}

// Funções Auxiliares
function agruparPorAnoMes(faturas) {
    return faturas.reduce((grupos, fatura) => {
        const key = `${fatura.ano}-${fatura.mes}`;
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(fatura);
        return grupos;
    }, {});
}

function agruparPorAnoTrimestreApartamento(faturas) {
    return faturas.reduce((grupos, fatura) => {
        const trimestre = Math.ceil(fatura.mes / 3);
        const key = `${fatura.ano}-${trimestre}`;
        if (!grupos[fatura.apartamento]) grupos[fatura.apartamento] = {};
        if (!grupos[fatura.apartamento][key]) {
            grupos[fatura.apartamento][key] = {
                valorOperador: 0,
                valorDireto: 0,
                noitesExtra: 0,
                noitesCriancas: 0,
                valorTmt: fatura.valorTmt,
                detalhes: []
            };
        }
        grupos[fatura.apartamento][key].valorOperador += fatura.valorOperador;
        grupos[fatura.apartamento][key].valorDireto += fatura.valorDireto;
        grupos[fatura.apartamento][key].noitesExtra += fatura.noitesExtra;
        grupos[fatura.apartamento][key].noitesCriancas += fatura.noitesCriancas;
        grupos[fatura.apartamento][key].detalhes.push(fatura);
        return grupos;
    }, {});
}

function obterNomeMes(numeroMes) {
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[numeroMes - 1] || 'Mês Inválido';
}

// Funções de Detalhes e Exportação
window.mostrarDetalhesFaturacao = function(key, button) {
    const detalhes = JSON.parse(button.dataset.detalhes.replace(/&quot;/g, '"'));
    toggleDetalhes(button, gerarHTMLDetalhesFaturacao(detalhes));
}

// Editar: preenche o formulário e ativa modo edição
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

// Apagar: remove doc do Firestore e recarrega relatórios
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
    carregarTodosRelatorios();
  } catch (err) {
    console.error('Erro ao apagar fatura:', err);
    alert('Não foi possível apagar a fatura.');
  }
};

function toggleDetalhes(button, htmlContent) {
  const tr = button.closest('tr');
  const tbody = tr.parentElement;
  const colSpan = tr.children.length; // usa o nº real de colunas do cabeçalho

  // se já existe a linha de detalhes logo a seguir, só faz toggle
  let next = tr.nextElementSibling;
  if (next && next.classList.contains('detalhes-grupo')) {
    const isHidden = next.style.display === 'none';
    next.style.display = isHidden ? 'table-row' : 'none';
    button.textContent = isHidden ? 'Ocultar Detalhes' : 'Ver Detalhes';
    return;
  }

  // criar a linha de detalhes
  const detTr = document.createElement('tr');
  detTr.className = 'detalhes-grupo';
  const detTd = document.createElement('td');
  detTd.colSpan = colSpan;
  detTd.innerHTML = htmlContent;
  detTr.appendChild(detTd);

  tbody.insertBefore(detTr, tr.nextSibling);
  button.textContent = 'Ocultar Detalhes';
}


function gerarHTMLDetalhesFaturacao(detalhes) {
  const rows = detalhes.map(d => {
    const dataStr = (d.timestamp && d.timestamp.seconds)
      ? new Date(d.timestamp.seconds * 1000).toLocaleDateString()
      : '—';
    const total = Number(d.valorTransferencia || 0) + Number(d.taxaAirbnb || 0);

    const payload = {
      id: d.id,
      apartamento: d.apartamento,
      ano: d.ano,
      mes: d.mes,
      numeroFatura: d.numeroFatura,
      taxaAirbnb: d.taxaAirbnb,
      valorTransferencia: d.valorTransferencia,
      valorOperador: d.valorOperador,
      noitesExtra: d.noitesExtra || 0,
      noitesCriancas: d.noitesCriancas || 0,
      valorDireto: d.valorDireto || 0,
      valorTmt: d.valorTmt,
      // novos campos (para o botão Editar):
      checkIn: d.checkIn || null,
      checkOut: d.checkOut || null,
      noites: (typeof d.noites === 'number' ? d.noites : null),
      precoMedioNoite: (d.precoMedioNoite ?? null),
      hospedesAdultos: (d.hospedesAdultos ?? null),
      hospedesCriancas: (d.hospedesCriancas ?? null),
      hospedesBebes: (d.hospedesBebes ?? null)
    };

    const jsonAttr = d.id ? JSON.stringify(payload).replace(/"/g, '&quot;') : '';
    const acoes = d.id
      ? `<button onclick="editarFatura(this)" data-fatura="${jsonAttr}">Editar</button>
         <button onclick="apagarFatura(this)" data-id="${d.id}" data-num="${d.numeroFatura}">Apagar</button>`
      : '—';

    return `
      <tr>
        <td>${dataStr}</td>
        <td>${d.numeroFatura}</td>
        <td>€${Number(d.valorTransferencia).toFixed(2)}</td>
        <td>€${Number(d.taxaAirbnb).toFixed(2)}</td>
        <td>€${total.toFixed(2)}</td>
        <td>${d.checkIn || '—'}</td>
        <td>${d.checkOut || '—'}</td>
        <td>${(typeof d.noites === 'number') ? d.noites : '—'}</td>
        <td>${(d.precoMedioNoite != null) ? d.precoMedioNoite.toFixed(2) + ' €' : '—'}</td>
        <td>${d.hospedesAdultos ?? '—'}</td>
        <td>${d.hospedesCriancas ?? '—'}</td>
        <td>${d.hospedesBebes ?? '—'}</td>
        <td>${acoes}</td>
      </tr>`;
  }).join('');

  return `
    <table class="detalhes-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Fatura Nº</th>
          <th>Valor Transferência</th>
          <th>Taxa AirBnB</th>
          <th>Total</th>
          <th>Check-in</th>
          <th>Check-out</th>
          <th>Noites</th>
          <th>Preço Médio/Noite</th>
          <th>Adultos</th>
          <th>Crianças</th>
          <th>Bebés</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


window.toggleDetalhes = function(btn) {
  const id = btn.getAttribute('data-target');
  const row = document.getElementById(id);
  if (!row) return;
  const isHidden = row.style.display === 'none' || row.style.display === '';
  row.style.display = isHidden ? 'table-row' : 'none';
  btn.textContent = isHidden ? 'Ocultar Detalhes' : 'Mostrar Detalhes';
};


window.exportarPDFFaturacao = function(key, grupoJson) {
  import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.4.0/jspdf.umd.min.js')
    .then(jsPDFModule => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const grupo = JSON.parse(grupoJson);

      // --- Título ---
      const [ano, mes] = key.split('-');
      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      doc.setFontSize(16);
      doc.text(`Relatório de Faturação - ${meses[mes-1]} ${ano}`, 105, 15, { align: 'center' });

      // --- Cabeçalho de 7 colunas ---
      const headers = [
        'Fatura Nº','Data','Transferência','Taxa Airbnb','Base','IVA (€)','Total (€)'
      ];
      const xPos = [2,32,62,92,122,152,182];
      const wCol = 30;
      let y = 30;

      doc.setFontSize(12);
      doc.setFont('helvetica','bold');
      headers.forEach((h,i) => {
        const tw = doc.getStringUnitWidth(h)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(h, xPos[i] + (wCol - tw)/2, y);
      });

      // --- separar M… vs CX… ---
      const mItems  = grupo.filter(f => f.numeroFatura.startsWith('M'));
      const cxItems = grupo.filter(f => !f.numeroFatura.startsWith('M'));

      // --- linhas M… + totais ---
      let sumT=0, sumTax=0, sumB=0, sumI=0, sumTot=0;
      doc.setFont('helvetica','normal');
      y += 10;
      mItems.forEach(f => {
        const dataStr = new Date(f.timestamp.seconds*1000).toLocaleDateString();
        const total     = f.valorTransferencia + f.taxaAirbnb;
        const base      = total / 1.06;
        const iva       = total - base;

        sumT   += f.valorTransferencia;
        sumTax += f.taxaAirbnb;
        sumB   += base;
        sumI   += iva;
        sumTot += total;

        const vals = [
          f.numeroFatura,
          dataStr,
          `€${f.valorTransferencia.toFixed(2)}`,
          `€${f.taxaAirbnb.toFixed(2)}`,
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

      // totais linha
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

      // --- CX entries at bottom, only Nº / Data / Total ---
      const pageH = doc.internal.pageSize.getHeight();
      let yCX = pageH - 20;
      doc.setFont('helvetica','normal');
      cxItems.forEach(f => {
        const dataStr = new Date(f.timestamp.seconds*1000).toLocaleDateString();
        const total   = f.valorTransferencia + f.taxaAirbnb;
        // Nº
        {
          const txt = f.numeroFatura;
          const tw  = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
          doc.text(txt, xPos[0] + (wCol - tw)/2, yCX);
        }
        // Data
        {
          const tw  = doc.getStringUnitWidth(dataStr)*doc.internal.getFontSize()/doc.internal.scaleFactor;
          doc.text(dataStr, xPos[1] + (wCol - tw)/2, yCX);
        }
        // Total
        {
          const txt = `€${total.toFixed(2)}`;
          const tw  = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
          doc.text(txt, xPos[6] + (wCol - tw)/2, yCX);
        }
        yCX += 10;
      });

      // salvar
      doc.save(`relatorio-faturacao-${ano}-${meses[mes-1]}.pdf`);
    })
    .catch(err => console.error('Erro ao exportar PDF:', err));
};
