// Importar as funções necessárias do Firebase
import { db } from './script.js';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ---------- MOBILE MENU TOGGLE ----------
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const menuBtn = document.getElementById('menu-icon');
  const navMenu = document.getElementById('nav-menu');

  if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
      header.classList.toggle('active');
    });
  }

  // Close menu when a nav link is clicked
  if (navMenu && header) {
    navMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) header.classList.remove('active');
    });
  }
});

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
const submitBtn = document.getElementById('submit-fatura') || (faturaForm && faturaForm.querySelector('button[type="submit"]'));
const navWrap = document.getElementById('fatura-nav');
const prevBtn = document.getElementById('fatura-prev');
const nextBtn = document.getElementById('fatura-next');
let currentIndex = -1;
let loadedFaturas = [];
const parseInvoiceNumber = (numero) => {
  if (typeof numero !== 'string' || !numero.trim()) {
    return { prefix: '', number: Number.NEGATIVE_INFINITY };
  }
  const trimmed = numero.trim();
  const match = trimmed.match(/^([A-Za-zÀ-ÿ]+)(\d+)$/i);
  if (match) {
    return { prefix: match[1].toUpperCase(), number: parseInt(match[2], 10) || Number.NEGATIVE_INFINITY };
  }
  const digits = parseInt(trimmed.replace(/\D/g, ''), 10);
  const prefix = trimmed.replace(/\d/g, '').toUpperCase();
  return {
    prefix: prefix || '',
    number: Number.isNaN(digits) ? Number.NEGATIVE_INFINITY : digits
  };
};

const sortInvoicesForNav = (items) => {
  return items.slice().sort((a, b) => {
    const pa = parseInvoiceNumber(a.numeroFatura || '');
    const pb = parseInvoiceNumber(b.numeroFatura || '');
    if (pa.prefix === pb.prefix) {
      if (pa.number === pb.number) {
        const aTs = a.timestamp?.seconds ?? 0;
        const bTs = b.timestamp?.seconds ?? 0;
        return aTs - bTs;
      }
      return pa.number - pb.number;
    }
    return pa.prefix.localeCompare(pb.prefix);
  });
};
const normalizeDateField = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString().slice(0, 10);
    } catch (err) {
      console.warn('Falha a converter data Firestore', err);
      return null;
    }
  }
  return null;
};

const updateNavigator = () => {
  if (!navWrap) return;
  const hasSelection = currentIndex >= 0 && currentIndex < loadedFaturas.length;
  navWrap.style.display = hasSelection ? 'inline-flex' : 'none';
  if (prevBtn) prevBtn.disabled = !hasSelection || currentIndex <= 0;
  if (nextBtn) nextBtn.disabled = !hasSelection || currentIndex >= loadedFaturas.length - 1;
};

const setCurrentIndexById = (id) => {
  if (!id) {
    currentIndex = -1;
  } else {
    currentIndex = loadedFaturas.findIndex((f) => f.id === id);
  }
  updateNavigator();
};

const navigateInvoice = (delta) => {
  if (currentIndex < 0) return;
  const targetIndex = currentIndex + delta;
  if (targetIndex < 0 || targetIndex >= loadedFaturas.length) return;
  const target = loadedFaturas[targetIndex];
  if (target) {
    entrarEmModoEdicao(target, { skipScroll: true });
  }
};

if (prevBtn) prevBtn.addEventListener('click', () => navigateInvoice(-1));
if (nextBtn) nextBtn.addEventListener('click', () => navigateInvoice(1));

// Ativa modo edição e preenche todos os campos
async function entrarEmModoEdicao(f, options = {}) {
  const { skipScroll = false } = options;
  
  // Ensure loadedFaturas is populated for navigation
  if (loadedFaturas.length === 0 && f?.id) {
    const firebaseFaturas = await carregarFaturas();
    loadedFaturas = sortInvoicesForNav(firebaseFaturas);
  }
  
  if (f?.id) setCurrentIndexById(f.id);
  if (submitBtn) submitBtn.textContent = f?.id ? 'Atualizar' : 'Guardar';
  
  // Ensure nav buttons are visible when editing
  if (navWrap) {
    navWrap.style.display = 'inline-flex';
    updateNavigator(); // Update button states
  }
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
  const apt = String(f.apartamento || '');
  const defaultTaxa = apt.includes('1248') ? 65 : apt.includes('123') ? 60 : '';
  setNum('taxa-limpeza', (f.taxaLimpeza != null && f.taxaLimpeza !== '') ? Number(f.taxaLimpeza) : defaultTaxa);


  // 3ª linha
  setNum('valor-operador', Number(f.valorOperador));
  setNum('noites-extra', Number(f.noitesExtra));
  setNum('noites-criancas', Number(f.noitesCriancas));
  setNum('valor-direto', Number(f.valorDireto));
  setNum('valor-tmt', Number(f.valorTmt));

  // 4ª/5ª linhas (estadia & hóspedes)
  setVal('checkin', f.checkIn || '');
  setVal('checkout', f.checkOut || '');
  setVal('data-reserva', f.dataReserva || '');
  setNum('noites', (typeof f.noites === 'number' ? f.noites : ''));
  setNum('preco-medio-noite', (typeof f.precoMedioNoite === 'number' ? f.precoMedioNoite : ''));
  setNum('adultos', (typeof f.hospedesAdultos === 'number' ? f.hospedesAdultos : ''));
  setNum('criancas', (typeof f.hospedesCriancas === 'number' ? f.hospedesCriancas : ''));
  setNum('bebes', (typeof f.hospedesBebes === 'number' ? f.hospedesBebes : ''));

  calcAndSetPrecoMedioNoite();

  // Foco inicial
  const first = document.getElementById('apartamento');
  if (first) first.focus();

  // Scroll suave até ao formulário
  if (!skipScroll && wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sairDoModoEdicao() {
  if (editarIdInput) editarIdInput.value = '';
  if (submitBtn) submitBtn.textContent = 'Guardar';
  if (cancelarEdicaoBtn) cancelarEdicaoBtn.style.display = 'none';
  faturaForm.reset();
  setCurrentIndexById(null);
  definirValoresPadrao(); // mantém o teu comportamento atual do “próximo nº”
}

if (cancelarEdicaoBtn) {
  cancelarEdicaoBtn.addEventListener('click', sairDoModoEdicao);
}

function calcAndSetPrecoMedioNoite() {
  const vTransf = parseFloat(document.getElementById('valor-transferencia')?.value || '0') || 0;
  const vTaxa   = parseFloat(document.getElementById('taxa-airbnb')?.value || '0') || 0;
  const noites  = parseInt(document.getElementById('noites')?.value || '', 10);

  const out = document.getElementById('preco-medio-noite');
  if (!out) return;

  if (Number.isInteger(noites) && noites > 0) {
    const val = (vTransf + vTaxa) / noites;
    out.value = val.toFixed(2);
  } else {
    out.value = ''; // sem noites, limpamos
  }
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
      calcAndSetPrecoMedioNoite();
    });
  });

  // Atualizar Preço Médio/Noite ao escrever valores
  ['valor-transferencia','taxa-airbnb','noites'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', calcAndSetPrecoMedioNoite);
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


  async function definirValoresPadrao() {
    const hoje = new Date();
    document.getElementById('ano').value = hoje.getFullYear();
    document.getElementById('mes').value = hoje.getMonth() + 1;

    // buscar a última fatura (por timestamp) e calcular próximo número
    const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"), limit(1));
    const snap = await getDocs(q);
    let proximo = "M1";

    if (!snap.empty) {
      const ultima = snap.docs[0].data()?.numeroFatura || "";
      if (typeof ultima === "string" && ultima.trim() !== "") {
        const num = parseInt(ultima.replace(/\D/g, ""), 10);
        if (!isNaN(num)) proximo = `M${num + 1}`;
      }
    }

    document.getElementById("numero-fatura").value = proximo;

    // Taxa de limpeza por defeito (KISS)
    const aptSel = document.getElementById("apartamento")?.value || "";
    const taxaDef = aptSel === "1248" ? 65 : aptSel === "123" ? 60 : "";
    const taxaInp = document.getElementById("taxa-limpeza");
    if (taxaInp && (taxaInp.value === "" || taxaInp.value == null)) taxaInp.value = taxaDef;
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

const checkIn      = getVal('checkin')       || null;  // "YYYY-MM-DD" ou null
const checkOut     = getVal('checkout')      || null;
const dataReserva  = getVal('data-reserva')  || null;

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
  dataReserva,
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
  loadedFaturas = sortInvoicesForNav(firebaseFaturas);
  updateNavigator();
  const faturas = firebaseFaturas.concat(manualFaturasEstatica);

  gerarRelatorioFaturacao(faturas);
}

async function carregarFaturas() {
    try {
        const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            checkIn: normalizeDateField(data.checkIn),
            checkOut: normalizeDateField(data.checkOut),
            dataReserva: normalizeDateField(data.dataReserva)
          };
        });
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
          <td>${euroInt(totalTransferencia)}</td>
         <td>${euroInt(totalTaxaAirbnb)}</td>
         <td>${euroInt(totalFatura)}</td>

         <td class="acoes">
             <div class="btn-col">
                <button onclick="mostrarDetalhesFaturacao('${key}', this)" data-detalhes="${grupoJSON}">
                  Ver Detalhes
               </button>
              <button onclick="exportarPDFFaturacao('${key}', '${grupoJSON}')">
                 Exportar PDF
              </button>
             </div>
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

// Formata números em euros com 2 casas decimais e separador de milhares (PT)
function euroInt(v) {
  const num = Number(v) || 0;
  return num.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).replace(/\./g, ' ') + ' €';
}

// garantir que o campo fica preenchido se noites > 0
calcAndSetPrecoMedioNoite();


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
  const rows = (detalhes || []).map(d => {
    // Data curta DD-MM
    const dataStr = (d.timestamp && d.timestamp.seconds)
      ? new Date(d.timestamp.seconds * 1000)
          .toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit' })
          .replace(/\//g,'-')
      : '—';

    // Converter checkIn/checkOut YYYY-MM-DD -> DD-MM
    const toDDMM = s => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s))
      ? `${s.slice(8,10)}-${s.slice(5,7)}`
      : (s || '—');

    // Total = transferência + taxa Airbnb (mantemos)
    const total = Number(d.valorTransferencia || 0) + Number(d.taxaAirbnb || 0);

    // Taxa Limpeza: usa o valor gravado; se faltar, default por apartamento
    const taxaLimpeza = (d.taxaLimpeza != null && d.taxaLimpeza !== '')
    ? Number(d.taxaLimpeza)
    : null;

    // Payload para o botão Editar
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
      taxaLimpeza: taxaLimpeza, // incluímos para pré-preencher no Editar
      // novos campos (para o botão Editar):
      checkIn: d.checkIn || null,
      checkOut: d.checkOut || null,
      dataReserva: d.dataReserva || null,
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
        <td>${d.numeroFatura || '—'}</td>
        <td>${euroInt(d.valorTransferencia || 0)}</td>
        <td>${euroInt(d.taxaAirbnb || 0)}</td>
        <td>${euroInt(total)}</td>
        <td>${toDDMM(d.checkIn)}</td>
        <td>${toDDMM(d.checkOut)}</td>
        <td>${toDDMM(d.dataReserva)}</td>
        <td>${(typeof d.noites === 'number') ? d.noites : '—'}</td>
        <td>${
          (typeof d.noites === 'number' && d.noites > 0)
           ? euroInt((Number(d.valorTransferencia || 0) + Number(d.taxaAirbnb || 0)) / d.noites)
           : '—'
        }</td>
        <td>${taxaLimpeza != null ? euroInt(taxaLimpeza) : '—'}</td>
        <td>${d.hospedesAdultos ?? '—'}</td>   <!-- A -->
        <td>${d.hospedesCriancas ?? '—'}</td>  <!-- C -->
        <td>${d.hospedesBebes ?? '—'}</td>     <!-- B -->
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
          <th>Data Reserva</th>
          <th>Noites</th>
          <th>Preço Médio/Noite</th>
          <th>Limp.</th>
          <th>A</th>
          <th>C</th>
          <th>B</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}





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

      // --- Cabeçalho de 7 colunas (mais compacto) ---
      const headers = [
        'Fatura Nº','Data','Transferência','Taxa Airbnb','Base','IVA (€)','Total (€)'
        ];

        // encolhemos a largura de cada coluna e aumentamos as margens
        const LEFT = 8;                 // margem esquerda maior
        const wCol = 27;                // largura de cada coluna (antes: 30)
        const xPos = Array.from({length:7}, (_,i) => LEFT + i*wCol);

        let y = 28;                     // sobe ligeiramente o cabeçalho
        const ROW_H = 8;                // altura de linha mais compacta

        doc.setFontSize(11);            // cabeçalho ligeiramente menor (antes: 12)
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
       doc.setFontSize(10);     // corpo mais pequeno para caber melhor
       y += ROW_H;

       mItems.forEach((f, idx) => {
       const dataStr = new Date(f.timestamp.seconds*1000).toLocaleDateString();
       const total   = f.valorTransferencia + f.taxaAirbnb;
       const base    = total / 1.06;
       const iva     = total - base;

       sumT   += f.valorTransferencia;
       sumTax += f.taxaAirbnb;
       sumB   += base;
       sumI   += iva;
       sumTot += total;

       // sombreado linha sim/linha não (cinzento muito suave)
       if (idx % 2 === 1) {
         doc.setFillColor(245,245,245);
          // retângulo por trás da linha (toda a largura da tabela)
         doc.rect(xPos[0], y - (ROW_H - 3), wCol * 7, ROW_H, 'F');
       }

       const vals = [
         f.numeroFatura,
         dataStr,
         euroInt(f.valorTransferencia),
         euroInt(f.taxaAirbnb),
         euroInt(base),
         euroInt(iva),
         euroInt(total)
       ];

       vals.forEach((txt,i) => {
          const tw = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
         doc.text(txt, xPos[i] + (wCol - tw)/2, y);
       });

       y += ROW_H;
      });

      // totais linha
      doc.setFont('helvetica','bold');
      doc.setFontSize(10);
      const totalVals = [
        'Totais','',
        euroInt(sumT),
        euroInt(sumTax),
        euroInt(sumB),
        euroInt(sumI),
        euroInt(sumTot)
      ];
      totalVals.forEach((txt,i) => {
        const tw = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
        doc.text(txt, xPos[i] + (wCol - tw)/2, y);
      });
      y += ROW_H;  // dá uma folga antes da secção CX

      

      // --- CX entries at bottom, only Nº / Data / Total ---
      const pageH = doc.internal.pageSize.getHeight();
      let yCX = pageH - 20;
      doc.setFont('helvetica','normal');
      doc.setFontSize(10);
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
         const txt = euroInt(total);
         const tw  = doc.getStringUnitWidth(txt)*doc.internal.getFontSize()/doc.internal.scaleFactor;
         doc.text(txt, xPos[6] + (wCol - tw)/2, yCX);
        }
       yCX += ROW_H;
      });


      // salvar
      doc.save(`relatorio-faturacao-${ano}-${meses[mes-1]}.pdf`);
    })
    .catch(err => console.error('Erro ao exportar PDF:', err));
};

function runAnalysis(auto = false) {
  const start = analysisStartInput?.value;
  const end = analysisEndInput?.value;

  if (!cachedReportRows || !cachedReportRows.length) {
    if (!auto) analysisResultBox.textContent = 'Carregue as faturas antes de executar a análise.';
    return;
  }

  if (!start || !end) {
    if (!auto) analysisResultBox.textContent = 'Selecione meses válidos para analisar.';
    return;
  }

  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  if (!Number.isFinite(startYear) || !Number.isFinite(startMonth) || !Number.isFinite(endYear) || !Number.isFinite(endMonth)) {
    if (!auto) analysisResultBox.textContent = 'Selecione meses válidos.';
    return;
  }

  if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
    analysisResultBox.textContent = 'O mês inicial deve ser anterior ao mês final.';
    return;
  }
  const summary = summarizePeriod(cachedReportRows, start, end);
  const label = `${obterNomeMes(start.month)} ${start.year} – ${obterNomeMes(end.month)} ${end.year}`;
  if (!summary || !summary.entries) {
    analysisResultBox.innerHTML = `<strong>${label}</strong><span>Sem faturas no intervalo selecionado.</span>`;
    return;
  }
  const monthsText = summary.monthCount === 1 ? '1 mês' : `${summary.monthCount} meses`;
  const entriesText = summary.entries === 1 ? '1 fatura' : `${summary.entries} faturas`;
  const nightsText = summary.nights ? `${summary.nights} noites` : 'Noites não registadas';
  analysisResultBox.innerHTML = `
    <strong>${label}</strong>
    <span>Total receita: ${euroInt(summary.revenue)}</span>
    <span>Média/noite: ${summary.avgNightly ? euroInt(summary.avgNightly) : '— (sem noites registadas)'}</span>
    <span>${monthsText} · ${entriesText} · ${nightsText}</span>
  `;
}
