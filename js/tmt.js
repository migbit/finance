import { db, whenAccessResolved, getCurrentPageAccess } from './script.js';
import { collection, getDocs, getDocsFromServer, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const entregasTMT = new Map();
const entregasPendentes = new Set();
const errosEntrega = new Map();
let entregasCarregadas = false;
let erroCarregarEntregas = false;
let podeMarcarEntrega = false;

// ---------- MOBILE MENU TOGGLE ----------
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const menuBtn = document.getElementById('menu-icon');
  const navMenu = document.getElementById('nav-menu');

  if (menuBtn && header && !header.classList.contains('app-navigation')) {
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

document.addEventListener('DOMContentLoaded', async () => {
  const el123 = document.getElementById('tmt-123');
  const el1248 = document.getElementById('tmt-1248');
  const fallback = document.getElementById('relatorio-tmt'); // optional

  const anoSelect = document.getElementById('tmt-ano');
  const triSelect = document.getElementById('tmt-trimestre');
  const status = document.getElementById('tmt-status');
  const retry = document.getElementById('tmt-retry');
  let faturas = [];

  const render = () => {
    const periodo = anoSelect && triSelect
      ? { ano: Number(anoSelect.value), trimestre: Number(triSelect.value) } : undefined;
    const label = document.getElementById('tmt-periodo');
    if (label && periodo) label.textContent = descreverPeriodo(periodo);
    if (el123 || el1248) {
      if (el123) renderRelatorioApt(faturas, '123', el123, periodo);
      if (el1248) renderRelatorioApt(faturas, '1248', el1248, periodo);
    } else if (fallback) {
      fallback.innerHTML = gerarRelatorioTMT(faturas);
      attachDelegation(fallback);
    }
  };
  const carregar = async () => {
    if (retry) retry.hidden = true;
    if (status) status.textContent = 'A carregar registos…';
    for (const el of [el123, el1248, fallback]) el?.setAttribute('aria-busy', 'true');
    try {
      await whenAccessResolved();
      podeMarcarEntrega = getCurrentPageAccess().mode === 'write';
      faturas = await carregarFaturas();
      await carregarEntregasTMT();
      if (anoSelect && triSelect) {
        const inicial = ultimoTrimestreConcluido();
        const anos = [...new Set([inicial.ano, new Date().getFullYear(),
          ...faturas.map(f => Number(f.ano)).filter(ano => Number.isInteger(ano) && ano > 0)])];
        anoSelect.innerHTML = anos.sort((a, b) => b - a)
          .map(ano => `<option value="${ano}">${ano}</option>`).join('');
        anoSelect.value = String(inicial.ano);
        triSelect.value = String(inicial.trimestre);
        anoSelect.disabled = triSelect.disabled = false;
      }
      render();
      if (status) status.textContent = '';
    } catch (error) {
      console.error('Não foi possível carregar o relatório TMT.', error);
      if (status) status.textContent = 'Não foi possível carregar os registos. Tente novamente.';
      if (retry) retry.hidden = false;
    } finally {
      for (const el of [el123, el1248, fallback]) el?.setAttribute('aria-busy', 'false');
    }
  };
  anoSelect?.addEventListener('change', render);
  triSelect?.addEventListener('change', render);
  retry?.addEventListener('click', carregar);
  await carregar();
});

function ultimoTrimestreConcluido(data = new Date()) {
  const trimestreAtual = Math.floor(data.getMonth() / 3) + 1;
  return trimestreAtual === 1
    ? { ano: data.getFullYear() - 1, trimestre: 4 }
    : { ano: data.getFullYear(), trimestre: trimestreAtual - 1 };
}

function descreverPeriodo({ ano, trimestre }) {
  const intervalos = ['janeiro a março', 'abril a junho', 'julho a setembro', 'outubro a dezembro'];
  return trimestre ? `${trimestre}.º trimestre de ${ano} · ${intervalos[trimestre - 1]}` : `${ano} · Todos os trimestres`;
}

function valorCopiavel(valor, label, monetario = false) {
  const numero = Number(valor);
  const texto = monetario ? numero.toFixed(2).replace('.', ',') : String(numero);
  return `<button type="button" class="tmt-value" data-copy="${texto}" aria-label="Copiar ${label}: ${texto}" title="Copiar ${texto}">${monetario ? `${texto} €` : texto}</button>`;
}

function cabecalhoTMT() {
  return '<thead><tr><th scope="col">Ano</th><th scope="col">Trimestre</th><th scope="col">Estadias</th><th scope="col">Extra 7 Noites</th><th scope="col">Crianças</th><th scope="col">Total</th><th scope="col">Ações</th></tr></thead>';
}

async function carregarEntregasTMT() {
  entregasCarregadas = false;
  erroCarregarEntregas = false;
  atualizarEntregasVisiveis();
  try {
    // Uma falha de rede não deve apresentar uma entrega desconhecida como pendente.
    const snap = await getDocsFromServer(collection(db, 'tmt_entregas'));
    entregasTMT.clear();
    snap.docs.forEach(registo => entregasTMT.set(registo.id, registo.data()));
    entregasCarregadas = true;
  } catch (error) {
    erroCarregarEntregas = true;
    console.error('Não foi possível consultar as entregas TMT.', error);
  }
  atualizarEntregasVisiveis();
}

function conteudoEntregaTMT(chave) {
  if (!entregasCarregadas) {
    return erroCarregarEntregas
      ? '<span class="tmt-entrega-erro" role="status">Estado indisponível</span><button type="button" class="tmt-entrega-retry">Tentar novamente</button>'
      : '<span role="status">A consultar entrega…</span>';
  }
  const entrega = entregasTMT.get(chave);
  const entregue = entrega?.entregue === true;
  const data = entregue ? new Date(entrega.dataEntrega) : null;
  const dataTexto = data && Number.isFinite(data.getTime())
    ? data.toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '';
  const ocupado = entregasPendentes.has(chave);
  return `<span class="tmt-entrega-estado ${entregue ? 'is-entregue' : ''}" role="status">${entregue ? `✓ Entregue${dataTexto ? ` · ${dataTexto}` : ''}` : 'Por entregar'}</span>
    ${podeMarcarEntrega ? `<button type="button" class="btn-entrega" ${ocupado ? 'disabled' : ''}>${ocupado ? 'A guardar…' : entregue ? 'Desfazer entrega' : 'Marcar como entregue'}</button>` : ''}
    ${errosEntrega.has(chave) ? '<span class="tmt-entrega-erro" role="alert">Não foi possível guardar. Tente novamente.</span>' : ''}`;
}

function atualizarEntregasVisiveis() {
  document.querySelectorAll('.tmt-entrega').forEach(el => {
    const tinhaFoco = el.contains(document.activeElement);
    el.innerHTML = conteudoEntregaTMT(el.dataset.entrega);
    if (tinhaFoco) el.querySelector('button:not(:disabled)')?.focus();
  });
}

async function alterarEntregaTMT(chave) {
  if (!entregasCarregadas || !podeMarcarEntrega || entregasPendentes.has(chave)) return;
  const partes = /^(123|1248)-(\d{4})-([1-4])$/.exec(chave);
  if (!partes) return;
  const [, apartamento, ano, trimestre] = partes;
  const desfazer = entregasTMT.get(chave)?.entregue === true;
  entregasPendentes.add(chave);
  errosEntrega.delete(chave);
  atualizarEntregasVisiveis();
  try {
    const ref = doc(db, 'tmt_entregas', chave);
    if (desfazer) {
      await deleteDoc(ref);
      entregasTMT.delete(chave);
    } else {
      const entrega = { apartamento, ano: Number(ano), trimestre: Number(trimestre), entregue: true, dataEntrega: new Date().toISOString() };
      await setDoc(ref, { ...entrega, atualizadoEm: serverTimestamp() });
      entregasTMT.set(chave, entrega);
    }
  } catch (error) {
    errosEntrega.set(chave, true);
    console.error('Não foi possível guardar a entrega TMT.', error);
  } finally {
    entregasPendentes.delete(chave);
    atualizarEntregasVisiveis();
  }
}

async function carregarFaturas() {
  const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((fatura) => {
      const canal = String(fatura.canal || '').trim().toUpperCase();
      if (canal) return canal === 'AIRBNB';

      // Compatibilidade: todos os registos antigos são Airbnb.
      return !/^[VD]\d+$/i.test(String(fatura.numeroFatura || '').trim());
    });
}

/* ========== Single-apt renderer ========== */
function renderRelatorioApt(faturas, apt, mountEl, periodo) {
  const html = gerarRelatorioTMTDeApt(faturas, String(apt), periodo);
  mountEl.innerHTML = html;
  attachDelegation(mountEl);
}

function gerarRelatorioTMTDeApt(faturas, apt, periodo) {
  const anoAtual = periodo?.ano ?? new Date().getFullYear();
  const grupos = agruparPorAnoTrimestreApartamento(
    faturas.filter(f => String(f.apartamento) === String(apt))
  );

  const trimestres = grupos[String(apt)] || {};
  const linhasAtuais = [];
  const linhasAntigas = [];

  Object.entries(trimestres).sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true })).forEach(([triKey, dados]) => {
    const [ano, tri] = triKey.split('-').map(Number);
    if (ano === anoAtual && periodo?.trimestre && tri !== periodo.trimestre) return;
    const valorBase = Number(dados.valorOperador || 0) + Number(dados.valorDireto || 0);
    const valorTmt  = Number(dados.valorTmt || 0);
    const estadias  = valorTmt > 0 ? Math.round(valorBase / valorTmt) : 0;
    const totalEst  = estadias + Number(dados.noitesExtra || 0) + Number(dados.noitesCriancas || 0);

    const detalhesJSON = encodeURIComponent(JSON.stringify(dados.detalhes));
    const linha = `
      <tr>
        <td>${ano}</td>
        <td>${tri}º</td>
        <td>${valorCopiavel(estadias, 'Estadias')}</td>
        <td>${valorCopiavel(dados.noitesExtra || 0, 'Extra 7 Noites')}</td>
        <td>${valorCopiavel(dados.noitesCriancas || 0, 'Crianças')}</td>
        <td class="tmt-total">${valorCopiavel(totalEst, 'Total')}</td>
        <td><div class="tmt-acoes">
          <button type="button" class="btn-detalhes" aria-expanded="false" aria-controls="detalhes-${apt}-${ano}-${tri}" data-det="${detalhesJSON}">Ver Detalhes</button>
          <div class="tmt-entrega" data-entrega="${apt}-${ano}-${tri}" aria-label="Entrega do apartamento ${apt}, ${tri}.º trimestre de ${ano}">${conteudoEntregaTMT(`${apt}-${ano}-${tri}`)}</div>
        </div></td>
      </tr>
    `;
    (ano === anoAtual ? linhasAtuais : linhasAntigas).push(linha);
  });

  return `
    <div class="table-wrap"><table class="tmt-table" aria-label="Resumo do apartamento ${apt}">
      ${cabecalhoTMT()}
      <tbody>
        ${linhasAtuais.join('') || `<tr><td colspan="7" class="tmt-empty">Sem registos ${periodo?.trimestre ? `no ${periodo.trimestre}.º trimestre de` : 'em'} ${anoAtual}</td></tr>`}
      </tbody>
    </table></div>

    ${linhasAntigas.length ? `
      <button type="button" class="toggle-antigos" aria-expanded="false" aria-controls="historico-${apt}">Mostrar outros anos</button>
      <div id="historico-${apt}" class="bloco-antigos table-wrap" hidden>
        <table class="tmt-table tmt-antigos" aria-label="Histórico do apartamento ${apt}">
          ${cabecalhoTMT()}
          <tbody>${linhasAntigas.join('')}</tbody>
        </table>
      </div>
    ` : ``}
  `;
}

/* ========== Shared bits ========== */
function calcularNoitesExtra(fatura) {
  const ano = Number(fatura.ano);
  const mes = Number(fatura.mes);
  const valorGuardado = Number(fatura.noitesExtra || 0);
  // Preservar os relatórios anteriores ao 3.º trimestre de 2026.
  if (!(ano > 2026 || (ano === 2026 && mes >= 7))) return valorGuardado;

  const noites = Number(fatura.noites);
  const adultos = Number(fatura.hospedesAdultos);
  // Registos sem os dados da estadia continuam a usar o valor manual.
  if (fatura.noites == null || fatura.noites === '' ||
      fatura.hospedesAdultos == null || fatura.hospedesAdultos === '' ||
      !Number.isFinite(noites) || !Number.isFinite(adultos) ||
      noites <= 0 || adultos < 0) return valorGuardado;

  return Math.max(0, noites - 7) * adultos;
}

function calcularNoitesBebes(fatura) {
  const bebes = Number(fatura.hospedesBebes || 0);
  const noites = Number(fatura.noites || 0);

  if (!Number.isFinite(bebes) || !Number.isFinite(noites) || bebes <= 0 || noites <= 0) {
    return 0;
  }

  return bebes * noites;
}

function agruparPorAnoTrimestreApartamento(faturas) {
  return faturas.reduce((acc, f) => {
    const tri = Math.ceil((Number(f.mes) || 0) / 3);
    if (!tri) return acc;
    const key = `${f.ano}-${tri}`;
    const apt = String(f.apartamento);
    acc[apt] ??= {};
    acc[apt][key] ??= { valorOperador:0, valorDireto:0, noitesExtra:0, noitesCriancas:0, valorTmt:f.valorTmt, detalhes:[] };
    acc[apt][key].valorOperador  += Number(f.valorOperador || 0);
    acc[apt][key].valorDireto   += Number(f.valorDireto  || 0);
    acc[apt][key].noitesExtra   += calcularNoitesExtra(f);
    // Na TMT, a coluna Crianças corresponde apenas aos bebés das faturas Airbnb.
    acc[apt][key].noitesCriancas+= calcularNoitesBebes(f);
    acc[apt][key].detalhes.push(f);
    return acc;
  }, {});
}

const delegationRoots = new WeakSet();
function attachDelegation(root) {
  if (delegationRoots.has(root)) return;
  delegationRoots.add(root);
  root.addEventListener('click', async ev => {
    const entregaButton = ev.target.closest('.btn-entrega');
    if (entregaButton) {
      await alterarEntregaTMT(entregaButton.closest('.tmt-entrega').dataset.entrega);
      return;
    }
    if (ev.target.closest('.tmt-entrega-retry')) {
      await carregarEntregasTMT();
      return;
    }
    const copyButton = ev.target.closest('.tmt-value');
    if (copyButton) {
      await copiarValorTMT(copyButton);
      return;
    }
    const btnDetalhes = ev.target.closest('.btn-detalhes');
    const btnToggle   = ev.target.closest('.toggle-antigos');
    if (btnDetalhes) {
      const detalhes = JSON.parse(decodeURIComponent(btnDetalhes.dataset.det || '[]'));
      toggleDetalhes(btnDetalhes, gerarHTMLDetalhesTMT(detalhes));
    } else if (btnToggle) {
      const bloco = btnToggle.nextElementSibling;
      const open = !bloco.hidden;
      bloco.hidden = open;
      btnToggle.setAttribute('aria-expanded', String(!open));
      btnToggle.textContent = open ? 'Mostrar outros anos' : 'Ocultar outros anos';
    }
  });
}

function toggleDetalhes(anchorBtn, html) {
  const row = anchorBtn.closest('tr');
  let box = row.nextElementSibling;
  if (!box?.classList.contains('tmt-details-row')) box = null;
  if (box) {
    const open = !box.hidden;
    box.hidden = open;
    anchorBtn.setAttribute('aria-expanded', String(!open));
    anchorBtn.textContent = open ? 'Ver Detalhes' : 'Ocultar Detalhes';
    return;
  }
  box = document.createElement('tr');
  box.className = 'tmt-details-row';
  box.id = anchorBtn.getAttribute('aria-controls');
  box.innerHTML = `<td colspan="7"><div class="detalhes table-wrap">${html}</div></td>`;
  row.after(box);
  anchorBtn.setAttribute('aria-expanded', 'true');
  anchorBtn.textContent = 'Ocultar Detalhes';
}

let copyFeedbackTimer;
async function copiarValorTMT(button) {
  const status = document.getElementById('tmt-copy-status');
  clearTimeout(copyFeedbackTimer);
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    document.querySelectorAll('.tmt-value.is-copied').forEach(el => el.classList.remove('is-copied'));
    button.classList.add('is-copied');
    if (status) status.textContent = `${button.dataset.copy} copiado`;
    copyFeedbackTimer = setTimeout(() => {
      button.classList.remove('is-copied');
      if (status) status.textContent = '';
    }, 2500);
  } catch {
    // Selecionar o texto permite copiá-lo manualmente quando o browser recusa acesso.
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(button);
    selection.removeAllRanges();
    selection.addRange(range);
    if (status) status.textContent = 'Cópia automática indisponível. Copie o valor selecionado manualmente.';
  }
}

function gerarHTMLDetalhesTMT(items) {
  if (!items || !items.length) return '<p>Sem registos neste trimestre.</p>';
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const rows = [...items].sort((a,b)=>(a.ano-b.ano)||(a.mes-b.mes)).map(d => {
    const valOp = Number(d.valorOperador || 0);
    const valDir = Number(d.valorDireto  || 0);
    const valTmt = Number(d.valorTmt || 0);
    const base = valOp + valDir;
    const est  = valTmt > 0 ? Math.round(base / valTmt) : 0;
    const noitesCriancas = calcularNoitesBebes(d);
    return `
      <tr>
        <td>${d.ano}</td>
        <td>${meses[(d.mes|0)-1] || ''}</td>
        <td>${valorCopiavel(est, 'Estadias')}</td>
        <td>${valorCopiavel(calcularNoitesExtra(d), 'Extra 7 Noites')}</td>
        <td>${valorCopiavel(noitesCriancas, 'Crianças')}</td>
        <td>${valorCopiavel(base, 'Base', true)}</td>
        <td>${valorCopiavel(valTmt, 'TMT por noite', true)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="detalhes-table">
      <thead>
        <tr>
          <th>Ano</th><th>Mês</th><th>Estadias</th><th>Extra 7 Noites</th><th>Crianças</th><th>Base (€)</th><th>TMT/noite (€)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* Optional: combined renderer if you still use #relatorio-tmt somewhere */
function gerarRelatorioTMT(faturas) {
  const byApt = ['123','1248'];
  return byApt.map(apt => `
    <section class="report-section">
      <div class="viz-card">
        <h3 class="center">Apartamento ${apt} — TMT</h3>
        ${gerarRelatorioTMTDeApt(faturas, apt)}
      </div>
    </section>
  `).join('');
}
