import { db } from './script.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', async () => {
  const el123 = document.getElementById('tmt-123');
  const el1248 = document.getElementById('tmt-1248');
  const fallback = document.getElementById('relatorio-tmt'); // optional

  const faturas = await carregarFaturas();

  if (el123 || el1248) {
    // Render per apartment into its own section
    if (el123)  renderRelatorioApt(faturas, '123', el123);
    if (el1248) renderRelatorioApt(faturas, '1248', el1248);
  } else if (fallback) {
    // Old behavior: render both inside one block
    fallback.innerHTML = gerarRelatorioTMT(faturas);
    attachDelegation(fallback);
  }
});

async function carregarFaturas() {
  const q = query(collection(db, "faturas"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ========== Single-apt renderer ========== */
function renderRelatorioApt(faturas, apt, mountEl) {
  const html = gerarRelatorioTMTDeApt(faturas, String(apt));
  mountEl.innerHTML = html;
  attachDelegation(mountEl);
}

function gerarRelatorioTMTDeApt(faturas, apt) {
  const anoAtual = new Date().getFullYear();
  const grupos = agruparPorAnoTrimestreApartamento(
    faturas.filter(f => String(f.apartamento) === String(apt))
  );

  const trimestres = grupos[String(apt)] || {};
  const linhasAtuais = [];
  const linhasAntigas = [];

  Object.entries(trimestres).forEach(([triKey, dados]) => {
    const [ano, tri] = triKey.split('-').map(Number);
    const valorBase = Number(dados.valorOperador || 0) + Number(dados.valorDireto || 0);
    const valorTmt  = Number(dados.valorTmt || 0);
    const estadias  = valorTmt > 0 ? Math.round(valorBase / valorTmt) : 0;
    const totalEst  = estadias + Number(dados.noitesExtra || 0) + Number(dados.noitesCriancas || 0);

    const detalhesJSON = encodeURIComponent(JSON.stringify(dados.detalhes));
    const linha = `
      <tr>
        <td>${ano}</td>
        <td>${tri}º</td>
        <td>${estadias}</td>
        <td>${dados.noitesExtra || 0}</td>
        <td>${dados.noitesCriancas || 0}</td>
        <td>${totalEst}</td>
        <td><button type="button" class="btn-detalhes" data-det="${detalhesJSON}">Ver Detalhes</button></td>
      </tr>
    `;
    (ano === anoAtual ? linhasAtuais : linhasAntigas).push(linha);
  });

  return `
    <table class="tmt-table">
      <thead>
        <tr>
          <th>Ano</th>
          <th>Trimestre</th>
          <th>Estadias</th>
          <th>Extra 7 Noites</th>
          <th>Crianças</th>
          <th>Total</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${linhasAtuais.join('') || `<tr><td colspan="7" style="text-align:center;color:#666">Sem registos em ${anoAtual}</td></tr>`}
      </tbody>
    </table>

    ${linhasAntigas.length ? `
      <button class="toggle-antigos" style="margin-top:.75rem">Mostrar anos anteriores</button>
      <div class="bloco-antigos" style="display:none; margin-top:.5rem">
        <table class="tmt-table tmt-antigos">
          <tbody>${linhasAntigas.join('')}</tbody>
        </table>
      </div>
    ` : ``}
  `;
}

/* ========== Shared bits ========== */
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
    acc[apt][key].noitesExtra   += Number(f.noitesExtra  || 0);
    acc[apt][key].noitesCriancas+= Number(f.noitesCriancas || 0);
    acc[apt][key].detalhes.push(f);
    return acc;
  }, {});
}

function attachDelegation(root) {
  root.addEventListener('click', ev => {
    const btnDetalhes = ev.target.closest('.btn-detalhes');
    const btnToggle   = ev.target.closest('.toggle-antigos');
    if (btnDetalhes) {
      const detalhes = JSON.parse(decodeURIComponent(btnDetalhes.dataset.det || '[]'));
      toggleDetalhes(btnDetalhes, gerarHTMLDetalhesTMT(detalhes));
    } else if (btnToggle) {
      const bloco = btnToggle.nextElementSibling;
      const open = bloco.style.display !== 'none';
      bloco.style.display = open ? 'none' : 'block';
      btnToggle.textContent = open ? 'Mostrar anos anteriores' : 'Ocultar anos anteriores';
    }
  });
}

function toggleDetalhes(anchorBtn, html) {
  const td = anchorBtn.closest('td');
  let box = td.querySelector('.detalhes');
  if (box) {
    const open = box.style.display !== 'none';
    box.style.display = open ? 'none' : 'block';
    anchorBtn.textContent = open ? 'Ver Detalhes' : 'Ocultar Detalhes';
    return;
  }
  box = document.createElement('div');
  box.className = 'detalhes';
  box.style.marginTop = '.5rem';
  box.innerHTML = html;
  td.appendChild(box);
  anchorBtn.textContent = 'Ocultar Detalhes';
}

function gerarHTMLDetalhesTMT(items) {
  if (!items || !items.length) return '<p>Sem registos neste trimestre.</p>';
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const rows = items.sort((a,b)=>(a.ano-b.ano)||(a.mes-b.mes)).map(d => {
    const valOp = Number(d.valorOperador || 0);
    const valDir = Number(d.valorDireto  || 0);
    const valTmt = Number(d.valorTmt || 0);
    const base = valOp + valDir;
    const est  = valTmt > 0 ? Math.round(base / valTmt) : 0;
    return `
      <tr>
        <td>${d.ano}</td>
        <td>${meses[(d.mes|0)-1] || ''}</td>
        <td>${est}</td>
        <td>${Number(d.noitesExtra||0)}</td>
        <td>${Number(d.noitesCriancas||0)}</td>
        <td>€${base.toFixed(2)}</td>
        <td>€${valTmt.toFixed(2)}</td>
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
