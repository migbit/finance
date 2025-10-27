// compras.js

// 1) Import Firestore helpers as a module
import { doc, updateDoc, deleteField, onSnapshot, Timestamp } 
  from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// 2) Grab the same `db` you exposed on window in script.js
const db = window.db;

// 3) Predefined shopping categories
const listaCompras = {
  "Produtos Limpeza": [
    "Lixívia tradicional","Multiusos com Lixívia","Gel com Lixívia","CIF",
    "Limpeza Chão (Lava Tudo)","Limpeza Chão (Madeira)","Limpa Vidros",
    "Limpeza Potente","Limpeza Placas","Vinagre","Álcool"
  ],
  "Roupa": [
    "Detergente Roupa","Amaciador","Lixívia Roupa Branca","Tira Nódoas",
    "Tira Gorduras","Oxi Active","Branqueador","Perfumador"
  ],
  "WC": [
    "Papel Higiénico", "Shampoo", "Gel WC Sanitas","Toalhitas","Toalhitas Desmaquilhantes",
    "Blocos Sanitários","Anticalcário","Limpeza Chuveiro",
    "Desentupidor de Canos","Manutenção Canos","Papel Higiénico Húmido",
    "Sabonete Líquido"
  ],
  "Cozinha": [
    "Água 1.5l","Água 5l","Café","Rolo de Cozinha","Guardanapos","Bolachas",
    "Chá","Lava-Loiça","Esfregões Verdes","Esfregões Bravo",
    "Película Transparente","Papel Alumínio","Sacos congelação"
  ],
  "Diversos": ["Varetas Difusoras (Ambientador)","Limpa Óculos"]
};

// 4a) Create one predefined item row
function criarItemCompra(nome) {
  const div = document.createElement('div');
  div.className = 'item-compra';
  div.dataset.name = nome; // for lookup on updates
  div.innerHTML = `
    <div class="item-info">
      <span class="item-nome">${nome}</span>
      <input type="number" class="item-quantidade" value="0" readonly min="0" max="99" />
    </div>
    <div class="item-controles">
      <button type="button" class="btn-aumentar">+</button>
      <button type="button" class="btn-diminuir">-</button>
      <button type="button" class="btn-zero">0</button>
      <button type="button" class="btn-local-c">C</button>
    </div>
  `;
  return div;
}

// 4b) Create one blank “custom” item row
function criarItemCompraEmBranco() {
  const div = document.createElement('div');
  div.className = 'item-compra';
  div.innerHTML = `
    <div class="item-info">
      <input type="text" class="item-nome-custom" placeholder="Novo item" />
      <input type="number" class="item-quantidade" value="0" readonly min="0" max="99" />
    </div>
    <div class="item-controles">
      <button type="button" class="btn-aumentar">+</button>
      <button type="button" class="btn-diminuir">-</button>
      <button type="button" class="btn-zero">0</button>
      <button type="button" class="btn-local-c">C</button>
      <button type="button" class="btn-remover-custom-item">🗑️</button>
    </div>
  `;
  return div;
}

// 4c) Build the empty skeleton on the page
function criarListaCompras() {
  const form = document.getElementById('compras-form');
  form.innerHTML = '';

  // Predefined categories
  Object.entries(listaCompras).forEach(([categoria, itens]) => {
    const sec = document.createElement('div');
    sec.className = 'categoria';
    sec.innerHTML = `<h3>${categoria}</h3>`;

    itens.forEach(nome => {
      const itemDiv = criarItemCompra(nome);
      sec.appendChild(itemDiv);
    });

    form.appendChild(sec);
  });

  // Custom items placeholder + “Adicionar Item” button
  const adicionaisDiv = document.createElement('div');
  adicionaisDiv.className = 'categoria';
  adicionaisDiv.innerHTML = `
    <h3>Itens Adicionais</h3>
    <div id="custom-items-container"></div>
    <button type="button" id="btn-adicionar-custom-item">Adicionar Item</button>
  `;
  form.appendChild(adicionaisDiv);
}

// 5) Save exactly one item back to Firestore
async function salvarItem(nome, quantidade, local) {
  const ref = doc(db, 'listas_compras', 'lista_atual');
  await updateDoc(ref, {
    [`itens.${nome}`]: { quantidade, local },
    ultimaAtualizacao: Timestamp.now()
  });
}

// 6) Rebuild & populate UI (with yellow highlight)
function populateComprasUI(itens) {
  criarListaCompras();

  Object.entries(itens || {}).forEach(([nome, { quantidade, local }]) => {
    const el = document.querySelector(`.item-compra[data-name="${nome}"]`);

    if (el) {
      // Update predefined row if it already exists
      el.querySelector('.item-quantidade').value = quantidade;
      el.dataset.local = local;
      el.querySelector('.btn-local-c').classList.toggle('active', local === 'C');
      // Yellow highlight
      el.classList.toggle('item-comprado', quantidade > 0);
    } else {
      // New custom‐added item
      const div = criarItemCompraEmBranco();
      div.dataset.name = nome;
      div.querySelector('.item-nome-custom').value = nome;
      div.querySelector('.item-quantidade').value = quantidade;
      div.dataset.local = local;
      div.querySelector('.btn-local-c').classList.toggle('active', local === 'C');
      div.classList.toggle('item-comprado', quantidade > 0);
      document.getElementById('custom-items-container').appendChild(div);
    }
  });

  // Re-apply search filter if user had typed something
  const filtro = document.getElementById('search-input').value;
  aplicarFiltro(filtro);
}

// 7) Listen for real-time Firestore changes
function monitorListaCompras() {
  const ref = doc(db, 'listas_compras', 'lista_atual');
  onSnapshot(ref, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    populateComprasUI(data.itens);
  });
}

// 8) Event delegation for all buttons
function attachEventListeners() {
  const form = document.getElementById('compras-form');

  form.addEventListener('click', async (e) => {
    // 8a) “Adicionar Item” button
    if (e.target.id === 'btn-adicionar-custom-item') {
      document.getElementById('custom-items-container')
              .appendChild(criarItemCompraEmBranco());
      return;
    }

    // 8b) Everything else must originate from an .item-compra
    const div = e.target.closest('.item-compra');
    if (!div) return;

    const inp = div.querySelector('.item-quantidade');
    const nomeEl = div.querySelector('.item-nome, .item-nome-custom');
    const nome = (nomeEl.textContent || nomeEl.value).trim();
    let local = div.dataset.local || 'Não definido';

    // 8c) Handle each button type
    if (e.target.classList.contains('btn-aumentar')) {
      inp.value = Math.min(+inp.value + 1, 99);
    }
    else if (e.target.classList.contains('btn-diminuir')) {
      inp.value = Math.max(+inp.value - 1, 0);
    }
    else if (e.target.classList.contains('btn-zero')) {
      inp.value = 0;
    }
    else if (e.target.classList.contains('btn-local-c')) {
      // Toggle “Casa” vs “Não definido”
      local = local === 'C' ? 'Não definido' : 'C';
      div.dataset.local = local;
      e.target.classList.toggle('active');
    }
    else if (e.target.classList.contains('btn-remover-custom-item')) {
  // Remove a <div> da tela e deleta o item do Firestore
  div.remove();
  if (nome) {
    const ref = doc(db, 'listas_compras', 'lista_atual');
    await updateDoc(ref, {
      [`itens.${nome}`]: deleteField(),
      ultimaAtualizacao: Timestamp.now()
    });
  }
  return;
}

    // 8d) Yellow highlight if purchased (quantity > 0)
    div.classList.toggle('item-comprado', +inp.value > 0);

    // 8e) Save just this one item back to Firestore
    if (nome) await salvarItem(nome, +inp.value, local);
  });

  // 8f) “Requisitar” (summary + save all)
  document.getElementById('btn-requisitar')
    .addEventListener('click', async () => {
      const resumo = gerarResumo();
      document.getElementById('resumo-conteudo').innerHTML =
        resumo.replace(/\n/g, '<br>');
      document.getElementById('resumo').style.display = 'block';

      document.querySelectorAll('.item-compra').forEach(async (div) => {
        const nomeEl = div.querySelector('.item-nome, .item-nome-custom');
        const nome = (nomeEl.textContent || nomeEl.value).trim();
        const qt = +div.querySelector('.item-quantidade').value;
        const loc = div.dataset.local || 'Não definido';
        if (nome && qt > 0) {
          await salvarItem(nome, qt, loc);
        }
      });
    });

  // 8g) “Enviar Email” button
  document.getElementById('btn-enviar-email')
    .addEventListener('click', () => enviarEmailListaCompras(gerarResumo()));

  // 8h) Search bar + clear button
  document.getElementById('search-input')
    .addEventListener('input', (e) => aplicarFiltro(e.target.value));
  document.getElementById('clear-search')
    .addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      aplicarFiltro('');
    });
}

// 9) Helper to build a summary string
function gerarResumo() {
  let r = '';
  document.querySelectorAll('.item-compra').forEach((div) => {
    const nomeEl = div.querySelector('.item-nome, .item-nome-custom');
    const nome = (nomeEl.textContent || nomeEl.value).trim();
    const qt = +div.querySelector('.item-quantidade').value;
    const loc = div.dataset.local;
    if (nome && qt > 0) {
      r += `${nome}: ${qt}${loc === 'C' ? ' (Casa)' : ''}\n`;
    }
  });
  return r;
}

// 10) Send summary via EmailJS
function enviarEmailListaCompras(resumo) {
  emailjs.send('service_tuglp9h', 'template_4micnki', {
    to_name: 'apartments.oporto@gmail.com',
    from_name: 'Apartments Oporto',
    subject: 'Lista de Compras',
    message: resumo
  });
}

// 11) Apply a simple search filter in the UI
function aplicarFiltro(texto) {
  document.querySelectorAll('.item-compra').forEach((div) => {
    const nome = (
      div.querySelector('.item-nome')?.textContent ||
      div.querySelector('.item-nome-custom')?.value ||
      ''
    ).toLowerCase();
    div.style.display = texto && !nome.includes(texto.toLowerCase())
      ? 'none'
      : 'flex';
  });
}

// 12) Initialization on page load
window.addEventListener('DOMContentLoaded', () => {
  criarListaCompras();
  attachEventListeners();
  monitorListaCompras();
});
