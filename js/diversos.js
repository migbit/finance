// js/diversos.js - Consolidated file for all Diversos page functionality

// ========================================
// IMPORTS
// ========================================

if (window.__diversosInit) { /* já correu */ }
else { window.__diversosInit = true; /* segue init */ }

import { db, enviarEmailUrgencia } from './script.js';
import { showToast } from './toast.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc, 
    deleteField,
    onSnapshot,
    Timestamp,
    orderBy,
    query
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Shorthand aliases for Firestore functions
const _collection = collection;
const _addDoc = addDoc;
const _getDocs = getDocs;

// ========================================
// MOBILE MENU TOGGLE & TAB NAVIGATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
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

    // Tab navigation functionality
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            const tabContent = document.getElementById('tab-' + tabName);
            if (tabContent) tabContent.classList.add('active');
        });
    });

    // Initialize all modules
    initMensagens();
    initCompras();
    initHospedes();
    initReparacoes();
    initCarlosFaturas();
    initIvaEstrangeiro();
    initPallco();
    initObras();
});

// ========================================
// UTILITY FUNCTIONS
// ========================================
function euroInt(v) {
    const num = Math.round(Number(v) || 0);
    return num.toLocaleString('pt-PT', {
        maximumFractionDigits: 0,
        useGrouping: true
    }).replace(/\./g, ' ') + ' €';
}

function euro2(v) {
    const num = Math.round((Number(v) || 0) * 100) / 100;
    return num.toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true
    }).replace(/\./g, ' ') + ' €';
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[m]));
}

function escapeAttr(s) {
    return escapeHtml(s);
}

// ========================================
// OBRAS (CHECKLISTS) MODULE
// ========================================
function initObras() {
    const tabRoot = document.getElementById('tab-obras');
    if (!tabRoot) return;

    const COLLECTION_NAME = 'obras_checklists';
    const SECTIONS = [
        'exterior',
        'escadas-exteriores',
        'hall-entrada',
        'corredor-rc',
        'quarto-rc',
        'dispensa',
        'wc-rc',
        'cozinha',
        'sala',
        'terraco',
        'escadaria-interior',
        'corredor-1',
        'quartos',
        'quarto-1-fr',
        'quarto-1-centro',
        'quarto-1-trazeiras',
        'wc-1-andar',
        'escritorio',
        'wc-pai',
        'sotao',
        'compras',
        'preparacao'
    ];

    const tabsWrap = tabRoot.querySelector('#obras-tabs');
    const contentsWrap = tabRoot.querySelector('#obras-contents');

    function activateSection(sectionKey) {
        if (!tabsWrap || !contentsWrap) return;

        tabsWrap.querySelectorAll('.obras-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-obras-tab') === sectionKey);
        });
        contentsWrap.querySelectorAll('.obras-tab-content').forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-obras-content') === sectionKey);
        });
    }

    if (tabsWrap) {
        tabsWrap.addEventListener('click', (e) => {
            const btn = e.target.closest('.obras-tab-btn');
            if (!btn) return;
            const sectionKey = btn.getAttribute('data-obras-tab');
            if (!sectionKey) return;
            activateSection(sectionKey);
        });
    }

    function renderSectionList(sectionKey, rows) {
        const ul = document.getElementById(`obras-list-${sectionKey}`);
        if (!ul) return;

        ul.innerHTML = '';

        if (!rows || rows.length === 0) {
            const li = document.createElement('li');
            li.className = 'obras-empty';
            li.textContent = 'Sem itens.';
            ul.appendChild(li);
            return;
        }

        rows.forEach(row => {
            const li = document.createElement('li');
            li.className = 'obras-item';

            const text = document.createElement('div');
            text.className = 'obras-item-text';
            text.textContent = row.text || '';

            const actions = document.createElement('div');
            actions.className = 'obras-item-actions';

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn obras-delete-btn';
            del.textContent = 'Apagar';
            del.setAttribute('data-obras-delete-id', row.id);

            actions.appendChild(del);
            li.append(text, actions);
            ul.appendChild(li);
        });
    }

    function renderAll(items) {
        SECTIONS.forEach(sectionKey => {
            renderSectionList(sectionKey, items[sectionKey] || []);
        });
        updateTabCounts(items);
    }

    function buildEmptySections() {
        const items = {};
        SECTIONS.forEach(sectionKey => (items[sectionKey] = []));
        return items;
    }

    // Add / delete handlers
    tabRoot.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('.obras-add-btn');
        if (addBtn) {
            const section = addBtn.getAttribute('data-obras-section');
            if (!section) return;

            const descricao = window.prompt('Descrição:');
            const text = (descricao || '').trim();
            if (!text) return;

            try {
                await addDoc(collection(db, COLLECTION_NAME), {
                    section,
                    text,
                    createdAt: Timestamp.now()
                });
                showToast('Adicionado.', 'success');
            } catch (error) {
                console.error('Erro ao adicionar item de obras', error);
                showToast('Erro ao adicionar.', 'error');
            }
            return;
        }

        const delBtn = e.target.closest('.obras-delete-btn');
        if (delBtn) {
            const id = delBtn.getAttribute('data-obras-delete-id');
            if (!id) return;

            try {
                await deleteDoc(doc(db, COLLECTION_NAME, id));
                showToast('Apagado.', 'info');
            } catch (error) {
                console.error('Erro ao apagar item de obras', error);
                showToast('Erro ao apagar.', 'error');
            }
        }
    });

    // Live sync (one listener for everything; grouped client-side)
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snap) => {
        const items = buildEmptySections();
        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const section = String(data.section || '').trim();
            if (!items[section]) return;
            items[section].push({
                id: docSnap.id,
                text: data.text || ''
            });
        });
        renderAll(items);
    }, (error) => {
        console.error('Erro no onSnapshot de obras', error);
        showToast('Erro ao sincronizar obras.', 'error');
    });

    // Default active section
    activateSection('exterior');

    function updateTabCounts(items) {
        if (!tabsWrap) return;
        tabsWrap.querySelectorAll('.obras-tab-btn').forEach(btn => {
            const sectionKey = btn.getAttribute('data-obras-tab');
            if (!sectionKey) return;
            const label = btn.getAttribute('data-obras-label') || btn.textContent.trim();
            if (!btn.getAttribute('data-obras-label')) btn.setAttribute('data-obras-label', label);
            const count = Array.isArray(items?.[sectionKey]) ? items[sectionKey].length : 0;
            btn.textContent = `${label} (${count})`;
        });
    }
}

// ========================================
// MENSAGENS MODULE
// ========================================
function initMensagens() {
    fetch('./mensagensData.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(initializeMessageSelectors)
        .catch(error => {
            console.error('Error fetching the JSON data:', error);
        });
}

function initializeMessageSelectors(mensagens) {
    const elements = {
        languageDropdown: document.getElementById('language-select'),
        categoriaDiv: document.getElementById('categoria-div'),
        categoriaDropdown: document.getElementById('categoria-select'),
        subcategoriaDiv: document.getElementById('subcategoria-div'),
        subcategoriaDropdown: document.getElementById('subcategoria-select'),
        nameInputContainer: document.getElementById('name-input-container'),
        guestNameInput: document.getElementById('guest-name'),
        weekdayDropdownContainer: document.getElementById('weekday-dropdown-container'),
        weekdayDropdown: document.getElementById('weekday-select'),
        mensagemSecao: document.getElementById('mensagem-secao'),
        mensagemContainer: document.getElementById('mensagem-container'),
        babyMessageContainer: document.getElementById('baby-message-container'),
        copyBabyMessageBtn: document.getElementById('copy-baby-message-btn'),
        copySMSMessageBtn: document.getElementById('copy-sms-message-btn')
    };

    if (!elements.languageDropdown) return;

    let selectedIdioma = "";
    let selectedCategoria = "";
    let selectedSubCategoria = "";
    let selectedWeekday = "";

    const babyMessages = {
        "Português": "Gostaria de saber se precisa de uma cama de bebé e/ou de uma cadeira de alimentação.",
        "Inglês": "Additionally, I'd like to know if you need a baby bed and/or a feeding chair.",
        "Espanhol": "Además, me gustaría saber si necesitas una cuna y/o una silla para bebé.",
        "Francês": "De plus, je voudrais savoir si vous avez besoin d'un lit bébé et/ou d'une chaise pour bébé."
    };

    const smsMessages = {
        "Português": "Sou Miguel, o seu anfitrião Airbnb no Porto.",
        "Inglês": "I'm Miguel, your Porto Airbnb host.",
        "Espanhol": "Soy Miguel, tu anfitrión de Airbnb en Porto.",
        "Francês": "Je suis Miguel, votre hôte Airbnb à Porto."
    };

    function resetDropdowns() {
        [elements.categoriaDiv, elements.subcategoriaDiv, elements.nameInputContainer,
         elements.weekdayDropdownContainer, elements.mensagemSecao, elements.babyMessageContainer]
         .forEach(el => el && (el.style.display = 'none'));
        if (elements.categoriaDropdown) elements.categoriaDropdown.innerHTML = '<option value="">Selecionar Categoria</option>';
        if (elements.subcategoriaDropdown) elements.subcategoriaDropdown.innerHTML = '<option value="">Selecionar Subcategoria</option>';
        selectedCategoria = "";
        selectedSubCategoria = "";
        selectedWeekday = "";
    }

    function populateDropdown(dropdown, options, defaultText) {
        dropdown.innerHTML = `<option value="">${defaultText}</option>`;
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            dropdown.appendChild(optionElement);
        });
    }

    function handleSubcategoryChange() {
        const isWhenArrive = selectedSubCategoria === 'Quando Chegam?';
        if (elements.nameInputContainer) elements.nameInputContainer.style.display = isWhenArrive ? 'block' : 'none';
        if (elements.weekdayDropdownContainer) elements.weekdayDropdownContainer.style.display = isWhenArrive ? 'block' : 'none';
        if (elements.babyMessageContainer) elements.babyMessageContainer.style.display = isWhenArrive ? 'block' : 'none';

        if (isWhenArrive) {
            if (selectedWeekday) {
                updateMessage();
            } else if (elements.mensagemSecao) {
                elements.mensagemSecao.style.display = 'none';
            }
        } else {
            updateMessage();
        }
    }

    function updateMessage() {
        if (!selectedIdioma || !selectedCategoria || !selectedSubCategoria) {
            if (elements.mensagemSecao) elements.mensagemSecao.style.display = 'none';
            return;
        }

        let messageObj = mensagens[selectedCategoria][selectedSubCategoria];
        if (selectedSubCategoria === 'Quando Chegam?' && selectedWeekday) {
            messageObj = messageObj[selectedWeekday];
        }

        const selectedMessage = messageObj[selectedIdioma];
        const guestName = elements.guestNameInput ? elements.guestNameInput.value.trim() : '';

        if (selectedMessage && elements.mensagemContainer) {
            const finalMessage = guestName ? selectedMessage.replace(/\[Hospede\]/g, guestName) : selectedMessage;
            elements.mensagemContainer.innerHTML = `<p>${finalMessage.replace(/\n/g, '</p><p>')}</p>`;
            elements.mensagemSecao.style.display = 'block';
            elements.mensagemContainer.onclick = () => copyMessageToClipboard();
        } else if (elements.mensagemContainer) {
            elements.mensagemContainer.innerHTML = 'Mensagem não disponível.';
            elements.mensagemSecao.style.display = 'block';
        }
    }

    function copyMessageToClipboard() {
        let messageText = elements.mensagemContainer.innerHTML;
        messageText = messageText
            .replace(/<\/li>/g, '\n')
            .replace(/<li>/g, '• ')
            .replace(/<\/?ul>/g, '')
            .replace(/<\/p>/g, '\n')
            .replace(/<p>/g, '')
            .replace(/<\/?strong>/g, '')
            .replace(/<\/?[^>]+(>|$)/g, '').trim()
            .replace(/\n\s*\n/g, '\n\n');

        const tempElement = document.createElement('textarea');
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        tempElement.value = messageText;
        document.body.appendChild(tempElement);
        tempElement.select();
        document.execCommand('copy');
        document.body.removeChild(tempElement);
    }

    function copyPlainTextToClipboard(text) {
        const tempElement = document.createElement('textarea');
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        tempElement.value = text.trim();
        document.body.appendChild(tempElement);
        tempElement.select();
        document.execCommand('copy');
        document.body.removeChild(tempElement);
    }

    if (elements.copyBabyMessageBtn) {
        elements.copyBabyMessageBtn.onclick = () => {
            const babyMessage = babyMessages[selectedIdioma] || babyMessages["Inglês"];
            copyPlainTextToClipboard(babyMessage);
        };
    }

    if (elements.copySMSMessageBtn) {
        elements.copySMSMessageBtn.onclick = () => {
            const smsMessage = smsMessages[selectedIdioma] || smsMessages["Inglês"];
            copyPlainTextToClipboard(smsMessage);
        };
    }

    if (elements.languageDropdown) {
        elements.languageDropdown.onchange = () => {
            selectedIdioma = elements.languageDropdown.value;
            if (selectedIdioma) {
                if (!selectedCategoria && mensagens) {
                    populateDropdown(elements.categoriaDropdown, Object.keys(mensagens), 'Selecionar Categoria');
                    elements.categoriaDiv.style.display = 'block';
                } else {
                    updateMessage();
                }
            } else {
                resetDropdowns();
            }
        };
    }

    if (elements.categoriaDropdown) {
        elements.categoriaDropdown.onchange = () => {
            selectedCategoria = elements.categoriaDropdown.value;
            if (selectedCategoria) {
                populateDropdown(elements.subcategoriaDropdown, Object.keys(mensagens[selectedCategoria]), 'Selecionar Subcategoria');
                elements.subcategoriaDiv.style.display = 'block';
                selectedSubCategoria = "";
                selectedWeekday = "";
            } else {
                elements.subcategoriaDiv.style.display = 'none';
                elements.mensagemSecao.style.display = 'none';
            }
            updateMessage();
        };
    }

    if (elements.subcategoriaDropdown) {
        elements.subcategoriaDropdown.onchange = () => {
            selectedSubCategoria = elements.subcategoriaDropdown.value;
            handleSubcategoryChange();
        };
    }

    if (elements.weekdayDropdown) {
        elements.weekdayDropdown.onchange = () => {
            selectedWeekday = elements.weekdayDropdown.value;
            updateMessage();
        };
    }

    if (elements.guestNameInput) {
        elements.guestNameInput.oninput = updateMessage;
    }
}

// ========================================
// COMPRAS MODULE
// ========================================
function initCompras() {
    const form = document.getElementById('compras-form');
    if (!form) return;

    const listaCompras = {
        "Produtos Limpeza": [
            "Lixívia tradicional", "Multiusos com Lixívia", "Gel com Lixívia", "CIF",
            "Limpeza Chão (Lava Tudo)", "Limpeza Chão (Madeira)", "Limpa Vidros",
            "Limpeza Potente", "Limpeza Placas", "Vinagre", "Álcool"
        ],
        "Roupa": [
            "Detergente Roupa", "Detergente Roupa Pastilhas", "Amaciador", "Lixívia Roupa Branca", "Tira Nódoas",
            "Tira Gorduras", "Oxi Active", "Branqueador", "Perfumador"
        ],
        "WC": [
            "Papel Higiénico", "Shampoo", "Gel WC Sanitas", "Toalhitas", "Toalhitas Desmaquilhantes",
            "Blocos Sanitários", "Anticalcário", "Limpeza Chuveiro",
            "Desentupidor de Canos", "Manutenção Canos", "Papel Higiénico Húmido",
            "Sabonete Líquido"
        ],
        "Cozinha": [
            "Água 1l","Água 1,5l", "Água 5l", "Café", "Rolo de Cozinha", "Guardanapos", "Bolachas",
            "Chá", "Lava-Loiça", "Esfregões Verdes", "Esfregões Bravo",
            "Película Transparente", "Papel Alumínio", "Papel Vegetal", "Sacos Lixo 50l","Sacos Lixo 10L","Sacos congelação"
        ],
        "Diversos": ["Varetas Difusoras (Ambientador)", "Limpa Óculos"]
    };

    function criarItemCompra(nome) {
        const div = document.createElement('div');
        div.className = 'item-compra';
        div.dataset.name = nome;
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

    function criarListaCompras() {
        form.innerHTML = '';

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

        const adicionaisDiv = document.createElement('div');
        adicionaisDiv.className = 'categoria';
        adicionaisDiv.innerHTML = `
            <h3>Itens Adicionais</h3>
            <div id="custom-items-container"></div>
            <button type="button" id="btn-adicionar-custom-item">Adicionar Item</button>
        `;
        form.appendChild(adicionaisDiv);
    }

    async function salvarItem(nome, quantidade, local) {
        const ref = doc(db, 'listas_compras', 'lista_atual');
        try {
            await updateDoc(ref, {
                [`itens.${nome}`]: { quantidade, local },
                ultimaAtualizacao: Timestamp.now()
            });
            showToast(`Guardado: ${nome} (${quantidade})`, 'success');
        } catch (error) {
            console.error('Erro ao guardar item', error);
            showToast('Erro ao guardar item', 'error');
            throw error;
        }
    }

    function populateComprasUI(itens) {
        criarListaCompras();

        Object.entries(itens || {}).forEach(([nome, { quantidade, local }]) => {
            const el = document.querySelector(`.item-compra[data-name="${nome}"]`);

            if (el) {
                el.querySelector('.item-quantidade').value = quantidade;
                el.dataset.local = local;
                el.querySelector('.btn-local-c').classList.toggle('active', local === 'C');
                el.classList.toggle('item-comprado', quantidade > 0);
            } else {
                const div = criarItemCompraEmBranco();
                div.dataset.name = nome;
                div.querySelector('.item-nome-custom').value = nome;
                div.querySelector('.item-quantidade').value = quantidade;
                div.dataset.local = local;
                div.querySelector('.btn-local-c').classList.toggle('active', local === 'C');
                div.classList.toggle('item-comprado', quantidade > 0);
                const container = document.getElementById('custom-items-container');
                if (container) container.appendChild(div);
            }
        });

        const filtro = document.getElementById('search-input');
        if (filtro) aplicarFiltro(filtro.value);
    }

    function monitorListaCompras() {
        const ref = doc(db, 'listas_compras', 'lista_atual');
        onSnapshot(ref, snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            populateComprasUI(data.itens);
        });
    }

    function attachEventListeners() {
        form.addEventListener('click', async (e) => {
            if (e.target.id === 'btn-adicionar-custom-item') {
                const container = document.getElementById('custom-items-container');
                if (container) container.appendChild(criarItemCompraEmBranco());
                return;
            }

            const div = e.target.closest('.item-compra');
            if (!div) return;

            const inp = div.querySelector('.item-quantidade');
            const nomeEl = div.querySelector('.item-nome, .item-nome-custom');
            const nome = (nomeEl.textContent || nomeEl.value).trim();
            let local = div.dataset.local || 'Não definido';

            if (e.target.classList.contains('btn-aumentar')) {
                inp.value = Math.min(+inp.value + 1, 99);
            } else if (e.target.classList.contains('btn-diminuir')) {
                inp.value = Math.max(+inp.value - 1, 0);
            } else if (e.target.classList.contains('btn-zero')) {
                inp.value = 0;
            } else if (e.target.classList.contains('btn-local-c')) {
                local = local === 'C' ? 'Não definido' : 'C';
                div.dataset.local = local;
                e.target.classList.toggle('active');
            } else if (e.target.classList.contains('btn-remover-custom-item')) {
                div.remove();
                if (nome) {
                    const ref = doc(db, 'listas_compras', 'lista_atual');
                    try {
                        await updateDoc(ref, {
                            [`itens.${nome}`]: deleteField(),
                            ultimaAtualizacao: Timestamp.now()
                        });
                        showToast(`Removido: ${nome}`, 'info');
                    } catch (error) {
                        console.error('Erro ao remover item', error);
                        showToast('Erro ao remover item', 'error');
                    }
                }
                return;
            }

            div.classList.toggle('item-comprado', +inp.value > 0);
            if (nome) await salvarItem(nome, +inp.value, local);
        });

        const btnRequisitar = document.getElementById('btn-requisitar');
        if (btnRequisitar) {
            btnRequisitar.addEventListener('click', async () => {
                const resumo = gerarResumo();
                const resumoConteudo = document.getElementById('resumo-conteudo');
                const resumoSection = document.getElementById('resumo');
                if (resumoConteudo) resumoConteudo.innerHTML = resumo.replace(/\n/g, '<br>');
                if (resumoSection) resumoSection.style.display = 'block';

                document.querySelectorAll('.item-compra').forEach(async (div) => {
                    const nomeEl = div.querySelector('.item-nome, .item-nome-custom');
                    const nome = (nomeEl.textContent || nomeEl.value).trim();
                    const qt = +div.querySelector('.item-quantidade').value;
                    const loc = div.dataset.local || 'Não definido';
                    if (nome && qt > 0) {
                        await salvarItem(nome, qt, loc);
                    }
                });
                showToast('Lista requisitada e guardada', 'success');
            });
        }

        const btnEnviarEmail = document.getElementById('btn-enviar-email');
        if (btnEnviarEmail) {
            btnEnviarEmail.addEventListener('click', () => enviarEmailListaCompras(gerarResumo()));
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => aplicarFiltro(e.target.value));
        }

        const clearSearch = document.getElementById('clear-search');
        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                aplicarFiltro('');
            });
        }
    }

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

    function enviarEmailListaCompras(resumo) {
        if (typeof emailjs !== 'undefined') {
            emailjs.send('service_tuglp9h', 'template_4micnki', {
                to_name: 'apartments.oporto@gmail.com',
                from_name: 'Apartments Oporto',
                subject: 'Lista de Compras',
                message: resumo
            });
        }
    }

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

    criarListaCompras();
    attachEventListeners();
    monitorListaCompras();
}

// ========================================
// HÓSPEDES MODULE
// ========================================
function initHospedes() {
    const commentForm = document.getElementById('comment-form');
    const commentList = document.getElementById('comment-list');
    
    if (!commentList) return;

    async function addComment(guestName) {
        try {
            const commentData = {
                guestName: guestName,
                ratingOption: "",
                faturaOption: "",
                sibaOption: "",
                notes: "",
                timestamp: new Date()
            };
            const docRef = await addDoc(collection(db, "comments"), commentData);
            console.log("Guest added with ID:", docRef.id);
            return docRef.id;
        } catch (error) {
            console.error("Error adding guest:", error);
            throw error;
        }
    }

    async function loadComments() {
        commentList.innerHTML = '<li>Carregando hóspedes...</li>';
        
        try {
            const q = query(collection(db, "comments"), orderBy("timestamp", "asc"));
            const querySnapshot = await getDocs(q);
            
            commentList.innerHTML = '';
            
            querySnapshot.forEach((docSnap) => {
                const guest = docSnap.data();
                const li = document.createElement('li');
                li.classList.add('comment-item');

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('details');

                const guestNameSpan = document.createElement('span');
                guestNameSpan.textContent = guest.guestName;
                guestNameSpan.classList.add('guest-name');

                const dropdownsDiv = document.createElement('div');
                dropdownsDiv.classList.add('dropdowns');

                const ratingDropdown = document.createElement('select');
                ratingDropdown.innerHTML = `
                    <option value="">Comentário</option>
                    <option value="Não sei" ${guest.ratingOption === 'Não sei' ? 'selected' : ''}>Não sei</option>
                    <option value="5 Estrelas" ${guest.ratingOption === '5 Estrelas' ? 'selected' : ''}>5 Estrelas</option>
                    <option value="Não escrever!" ${guest.ratingOption === 'Não escrever!' ? 'selected' : ''}>Não escrever!</option>
                `;
                ratingDropdown.title = "Comentários";

                const faturaDropdown = document.createElement('select');
                faturaDropdown.innerHTML = `
                    <option value="">Fatura</option>
                    <option value="Não Emitida" ${guest.faturaOption === 'Não Emitida' ? 'selected' : ''}>Não Emitida</option>
                    <option value="Emitida" ${guest.faturaOption === 'Emitida' ? 'selected' : ''}>Emitida</option>
                `;
                faturaDropdown.title = "Fatura";

                const sibaDropdown = document.createElement('select');
                sibaDropdown.innerHTML = `
                    <option value="">SIBA</option>
                    <option value="Não Enviado" ${guest.sibaOption === 'Não Enviado' ? 'selected' : ''}>Não Enviado</option>
                    <option value="Enviado" ${guest.sibaOption === 'Enviado' ? 'selected' : ''}>Enviado</option>
                `;
                sibaDropdown.title = "SIBA";

                dropdownsDiv.appendChild(ratingDropdown);
                dropdownsDiv.appendChild(faturaDropdown);
                dropdownsDiv.appendChild(sibaDropdown);

                const notesDiv = document.createElement('div');
                notesDiv.classList.add('notes-section');
                const notesTextarea = document.createElement('textarea');
                notesTextarea.value = guest.notes || "";
                notesTextarea.placeholder = "Notas sobre o hóspede...";
                notesDiv.appendChild(notesTextarea);

                detailsDiv.appendChild(guestNameSpan);
                detailsDiv.appendChild(dropdownsDiv);
                detailsDiv.appendChild(notesDiv);

                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('actions');

                const updateBtn = document.createElement('button');
                updateBtn.textContent = 'Atualizar';
                updateBtn.classList.add('update-btn');
                updateBtn.onclick = async () => {
                    try {
                        await updateComment(docSnap.id, {
                            ratingOption: ratingDropdown.value,
                            faturaOption: faturaDropdown.value,
                            sibaOption: sibaDropdown.value,
                            notes: notesTextarea.value.trim()
                        });
                        console.log('Guest updated successfully');
                    } catch (error) {
                        console.error('Error updating guest:', error);
                    }
                };

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Apagar';
                deleteBtn.classList.add('delete-btn');
                deleteBtn.onclick = () => deleteComment(docSnap.id);

                actionsDiv.appendChild(updateBtn);
                actionsDiv.appendChild(deleteBtn);

                li.appendChild(detailsDiv);
                li.appendChild(actionsDiv);

                commentList.appendChild(li);
            });
        } catch (error) {
            console.error("Error loading guests:", error);
            commentList.innerHTML = '<li>Erro ao carregar hóspedes</li>';
        }
    }

    async function updateComment(commentId, updatedFields) {
        try {
            const commentRef = doc(db, "comments", commentId);
            await updateDoc(commentRef, updatedFields);
        } catch (error) {
            console.error("Error updating guest:", error);
        }
    }

    async function deleteComment(commentId) {
        if (!confirm("Tem a certeza que deseja apagar este hóspede?")) return;
        try {
            await deleteDoc(doc(db, "comments", commentId));
            await loadComments();
        } catch (error) {
            console.error("Error deleting guest:", error);
            alert('Erro ao apagar hóspede');
        }
    }

    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const guestNameInput = document.getElementById('guest-name-hospedes');
            const guestName = guestNameInput ? guestNameInput.value.trim() : '';

            if (!guestName) {
                alert('Por favor, preencha o nome do hóspede.');
                return;
            }

            try {
                await addComment(guestName);
                guestNameInput.value = '';
                await loadComments();
            } catch (error) {
                alert('Erro ao adicionar hóspede');
            }
        });
    }

    loadComments();
}

// ========================================
// REPARAÇÕES MODULE
// ========================================
function initReparacoes() {
    const reparacoesForm = document.getElementById('reparacoes-form');
    const listaReparacoesDiv = document.getElementById('lista-reparacoes');
    
    if (!reparacoesForm || !listaReparacoesDiv) return;

    reparacoesForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const apartamento = document.getElementById('apartamento').value;
        const descricao = document.getElementById('descricao').value;
        const urgencia = document.getElementById('urgencia').value;

        if (!apartamento || !descricao || !urgencia) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const novaReparacao = {
                apartamento,
                descricao,
                urgencia,
                material_comprado: false,
                reparado: false,
                timestamp: new Date()
            };

            await addDoc(collection(db, "reparacoes"), novaReparacao);
            alert('Reparação registrada com sucesso!');
            reparacoesForm.reset();
            carregarReparacoes();

            if (urgencia === 'alta') {
                console.log('Urgência alta detectada. Enviando e-mail...');
                const templateParams = {
                    to_name: "apartments.oporto@gmail.com",
                    from_name: "Apartments Oporto",
                    message: `Uma nova reparação urgente foi registrada no apartamento ${apartamento}: ${descricao}`
                };
                if (typeof enviarEmailUrgencia === 'function') {
                    enviarEmailUrgencia(templateParams);
                }
            }
        } catch (error) {
            console.error("Erro ao registrar reparação: ", error);
            alert('Ocorreu um erro ao registrar a reparação.');
        }
    });

    async function carregarReparacoes() {
        listaReparacoesDiv.innerHTML = '<p>Carregando reparações...</p>';
        try {
            const q = query(collection(db, "reparacoes"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            let reparacoesPendentesHtml = '<h3>Reparações Pendentes</h3><table><thead><tr><th>Apartamento</th><th>Descrição</th><th>Urgência</th><th>Material Comprado</th><th>Reparado</th></tr></thead><tbody>';
            let reparacoesConcluidasHtml = '<h3>Reparações Concluídas</h3><table><thead><tr><th>Apartamento</th><th>Descrição</th><th>Urgência</th><th>Material Comprado</th><th>Reparado</th></tr></thead><tbody>';

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const id = doc.id;
                const isConcluido = data.reparado;
                const classReparado = isConcluido ? 'reparado' : '';
                const urgenciaClass = data.urgencia === 'alta' ? 'urgente' : '';

                const reparacaoHtml = `
                    <tr class="${classReparado} ${urgenciaClass}">
                        <td><strong>Apartamento ${data.apartamento}</strong></td>
                        <td>${data.descricao}</td>
                        <td>${data.urgencia}</td>
                        <td><input type="checkbox" ${data.material_comprado ? 'checked' : ''} onchange="atualizarStatus('${id}', 'material_comprado', this.checked)"></td>
                        <td><input type="checkbox" ${data.reparado ? 'checked' : ''} onchange="atualizarStatus('${id}', 'reparado', this.checked)"></td>
                    </tr>
                `;

                if (isConcluido) {
                    reparacoesConcluidasHtml += reparacaoHtml;
                } else {
                    reparacoesPendentesHtml += reparacaoHtml;
                }
            });

            reparacoesPendentesHtml += '</tbody></table>';
            reparacoesConcluidasHtml += '</tbody></table>';

            listaReparacoesDiv.innerHTML = reparacoesPendentesHtml + reparacoesConcluidasHtml;
        } catch (error) {
            console.error("Erro ao carregar reparações: ", error);
            listaReparacoesDiv.innerHTML = '<p>Ocorreu um erro ao carregar a lista de reparações.</p>';
        }
    }

    window.atualizarStatus = async (id, campo, valor) => {
        try {
            const reparacaoRef = doc(db, "reparacoes", id);
            await updateDoc(reparacaoRef, { [campo]: valor });
            carregarReparacoes();
        } catch (error) {
            console.error("Erro ao atualizar status da reparação: ", error);
            alert('Ocorreu um erro ao atualizar o status da reparação.');
        }
    };

    carregarReparacoes();
}

// ========================================
// CARLOS FATURAS MODULE
// ========================================
function initCarlosFaturas() {
    const invoiceForm = document.getElementById('carlos-invoice-form');
    const invoicesBody = document.getElementById('carlos-invoices-body');

    if (!invoiceForm || !invoicesBody) return;

    invoiceForm.addEventListener('submit', addInvoice);
    loadInvoices();

    async function addInvoice(e) {
        e.preventDefault();
        const numero = document.getElementById('invoice-number').value.trim();
        const data = document.getElementById('invoice-date').value;
        const total = parseFloat(document.getElementById('invoice-total').value);
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

    async function loadInvoices() {
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

    async function renderInvoiceRow(inv) {
        const snapPay = await getDocs(collection(db, 'carlosInvoices', inv.id, 'payments'));
        const payments = snapPay.docs.map(p => p.data());
        const paidSum = payments.reduce((s, p) => s + p.valorPago, 0);
        const balance = inv.total - paidSum;

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

        const trForm = document.createElement('tr');
        trForm.innerHTML = `
            <td colspan="6" style="display:none;">
                <form class="form-inline">
                    <input type="date" name="dataPagamento" required>
                    <input type="number" name="valorPago" placeholder="Valor (€)" step="0.01" max="${balance.toFixed(2)}" required>
                    <button type="submit" class="btn btn-success btn-sm ml-2">Registar</button>
                </form>
            </td>
        `;
        invoicesBody.appendChild(trForm);

        trInv.querySelector('.btn-add-payment').addEventListener('click', () => {
            const cell = trForm.firstElementChild;
            cell.style.display = cell.style.display === 'none' ? 'block' : 'none';
        });

        trForm.querySelector('form').addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.target;
            const dataPagamento = f.dataPagamento.value;
            const valorPago = parseFloat(f.valorPago.value);
            try {
                await addDoc(collection(db, 'carlosInvoices', inv.id, 'payments'), { dataPagamento, valorPago });
                await loadInvoices();
            } catch (err) {
                console.error(err);
                alert('Erro ao registar pagamento');
            }
        });
    }
}

// ========================================
// IVA ESTRANGEIRO MODULE
// ========================================
function initIvaEstrangeiro() {
    const ivaForm = document.getElementById('iva-estrangeiro-form');
    const ivaBody = document.getElementById('iva-estrangeiro-body');
    const triBody = document.getElementById('iva-estrangeiro-tri-body');
    const btnIvaMore = document.getElementById('iva-more-btn');

    if (!ivaForm || !ivaBody || !triBody) return;

    let _ivaRowsAll = [];
    let _ivaVisible = 0;
    const IVA_PAGE = 6;
    const IVA_COLLECTION = _collection(db, 'ivaEstrangeiro');

    ivaForm.addEventListener('submit', onAddIva);
    loadIvaEstrangeiro();

    async function onAddIva(e) {
        e.preventDefault();
        const dataStr = document.getElementById('iva-data').value;
        const descricaoEl = document.getElementById('iva-descricao');
        const descricao = descricaoEl ? descricaoEl.value.trim() : '';
        const valor = parseFloat(document.getElementById('iva-valor').value);

        if (!dataStr || !descricao || isNaN(valor)) {
            alert('Preenche a Data, a Descrição e o Valor (sem IVA).');
            return;
        }

        const iva = +(valor * 0.23).toFixed(2);
        const total = +(valor * 1.23).toFixed(2);

        try {
            await _addDoc(IVA_COLLECTION, {
                data: dataStr,
                descricao,
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

    const round2 = (value) => {
        if (typeof value === 'number' && isFinite(value)) {
            return Math.round(value * 100) / 100;
        }
        if (typeof value === 'string') {
            const parsed = parseFloat(value.replace(/\s+/g, '').replace(',', '.'));
            if (isFinite(parsed)) return Math.round(parsed * 100) / 100;
        }
        const fallback = Number(value);
        return isFinite(fallback) ? Math.round(fallback * 100) / 100 : NaN;
    };
    const safeRound2 = (value) => {
        const num = round2(value);
        return isNaN(num) ? 0 : num;
    };

    async function loadIvaEstrangeiro() {
        ivaBody.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';

        try {
            const snap = await _getDocs(IVA_COLLECTION);
            const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            itens.sort((a, b) => {
                const ad = (a.data || '').replaceAll('-', '');
                const bd = (b.data || '').replaceAll('-', '');
                const aa = ad ? parseInt(ad, 10) : (a.ts || 0);
                const bb = bd ? parseInt(bd, 10) : (b.ts || 0);
                return bb - aa;
            });

            _ivaRowsAll = itens;
            _ivaVisible = 0;
            ivaBody.innerHTML = '';
            if (_ivaRowsAll.length === 0) {
                ivaBody.innerHTML = '<tr><td colspan="6">Sem registos</td></tr>';
            } else {
                renderNextPage();
            }
            renderResumoTrimestres(itens);

            if (btnIvaMore) {
                btnIvaMore.style.display = (_ivaVisible < _ivaRowsAll.length) ? 'inline-block' : 'none';
                if (!btnIvaMore.dataset.bound) {
                    btnIvaMore.addEventListener('click', () => {
                        renderNextPage();
                        btnIvaMore.style.display = (_ivaVisible < _ivaRowsAll.length) ? 'inline-block' : 'none';
                    });
                    btnIvaMore.dataset.bound = '1';
                }
            }
        } catch (err) {
            console.error(err);
            ivaBody.innerHTML = '<tr><td colspan="6">Erro ao carregar registos</td></tr>';
        }
    }

    function renderNextPage() {
        if (_ivaVisible === 0) {
            ivaBody.innerHTML = '';
        }

        const slice = _ivaRowsAll.slice(_ivaVisible, _ivaVisible + IVA_PAGE);
        if (slice.length === 0 && _ivaVisible === 0) {
            ivaBody.innerHTML = '<tr><td colspan="6">Sem registos</td></tr>';
            return;
        }

        slice.forEach(r => {
            const tr = document.createElement('tr');
            tr.dataset.id = r.id;
            renderIvaRowView(tr, r);
            ivaBody.appendChild(tr);
        });
        _ivaVisible += slice.length;
    }

    function renderIvaRowView(tr, record) {
        const valor = safeRound2(record.valor ?? 0);
        const iva = safeRound2(record.iva ?? (valor * 0.23));
        const total = safeRound2(record.total ?? (valor * 1.23));

        tr.classList.remove('editing');
        tr.innerHTML = `
            <td>${escapeHtml(record.data || '')}</td>
            <td>${escapeHtml(record.descricao || '')}</td>
            <td>${euro2(valor)}</td>
            <td>${euro2(iva)}</td>
            <td>${euro2(total)}</td>
            <td>
                <button type="button" class="btn btn-edit" title="Editar" aria-label="Editar" data-id="${record.id}">&#9998;</button>
            </td>
        `;

        const editBtn = tr.querySelector('.btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', () => enterEditMode(tr, record));
        }
    }

    function enterEditMode(tr, record) {
        if (tr.classList.contains('editing')) return;
        tr.classList.add('editing');

        const dataValue = record.data || '';
        const descricaoValue = record.descricao || '';
        const valorValue = safeRound2(record.valor ?? 0);
        const ivaValue = safeRound2(record.iva ?? (valorValue * 0.23));
        const totalValue = safeRound2(record.total ?? (valorValue * 1.23));

        tr.innerHTML = `
            <td><input type="date" class="iva-edit-data" value="${escapeAttr(dataValue)}" required></td>
            <td><input type="text" class="iva-edit-descricao" value="${escapeAttr(descricaoValue)}" required></td>
            <td><input type="number" class="iva-edit-valor" step="0.01" value="${valorValue.toFixed(2)}" required></td>
            <td><input type="number" class="iva-edit-iva" step="0.01" value="${ivaValue.toFixed(2)}" required></td>
            <td><input type="number" class="iva-edit-total" step="0.01" value="${totalValue.toFixed(2)}" required></td>
            <td class="iva-actions">
                <button type="button" class="btn btn-save">Guardar</button>
                <button type="button" class="btn btn-cancel">Cancelar</button>
            </td>
        `;

        const cancelBtn = tr.querySelector('.btn-cancel');
        cancelBtn?.addEventListener('click', () => renderIvaRowView(tr, record));

        const saveBtn = tr.querySelector('.btn-save');
        saveBtn?.addEventListener('click', async () => {
            const dataInput = tr.querySelector('.iva-edit-data');
            const descInput = tr.querySelector('.iva-edit-descricao');
            const valorInput = tr.querySelector('.iva-edit-valor');
            const ivaInput = tr.querySelector('.iva-edit-iva');
            const totalInput = tr.querySelector('.iva-edit-total');

            const newData = dataInput?.value || '';
            const newDesc = descInput?.value.trim() || '';
            const newValor = round2(valorInput?.value ?? '');
            const newIva = round2(ivaInput?.value ?? '');
            const newTotal = round2(totalInput?.value ?? '');

            if (!newData || !newDesc || isNaN(newValor) || isNaN(newIva) || isNaN(newTotal)) {
                alert('Verifica os valores introduzidos.');
                return;
            }

            try {
                await updateDoc(doc(db, 'ivaEstrangeiro', record.id), {
                    data: newData,
                    descricao: newDesc,
                    valor: newValor,
                    iva: newIva,
                    total: newTotal,
                    ts: record.ts || Date.now()
                });
                await loadIvaEstrangeiro();
            } catch (err) {
                console.error(err);
                alert('Erro ao guardar alterações.');
            }
        });
    }

    function renderResumoTrimestres(items) {
        triBody.innerHTML = '';

        const acc = {};
        items.forEach(r => {
            const d = r.data ? new Date(r.data) : (r.ts ? new Date(r.ts) : null);
            if (!d || isNaN(d)) return;

            const y = d.getFullYear();
            const q = Math.floor(d.getMonth() / 3) + 1;
            const key = `${y}-Q${q}`;

            if (!acc[key]) acc[key] = { ano: y, tri: q, valor: 0, iva: 0, total: 0 };
            const valor = safeRound2(r.valor ?? 0);
            const iva = safeRound2(r.iva ?? (valor * 0.23));
            const total = safeRound2(r.total ?? (valor * 1.23));

            acc[key].valor += valor;
            acc[key].iva += iva;
            acc[key].total += total;
        });

        const rows = Object.values(acc).sort((a, b) => b.ano - a.ano || a.tri - b.tri);

        if (rows.length === 0) {
            triBody.innerHTML = '<tr><td colspan="5">Sem dados</td></tr>';
            return;
        }

        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.ano}</td>
                <td>Q${r.tri}</td>
                <td>${euro2(r.valor)}</td>
                <td>${euro2(r.iva)}</td>
                <td>${euro2(r.total)}</td>
            `;
            triBody.appendChild(tr);
        });
    }
}

// ========================================
// PALLCO MODULE
// ========================================
function initPallco() {
  const form = document.getElementById('pallco-form');
  const inpData = document.getElementById('pallco-data');
  const inpDesc = document.getElementById('pallco-descricao');
  const inpValor = document.getElementById('pallco-valor');
  const submitBtn = document.getElementById('pallco-submit');
  const cancelEditBtn = document.getElementById('pallco-cancel-edit');
  const editingHint = document.getElementById('pallco-editing-hint');
  const monthsWrap = document.getElementById('pallco-months');
  const olderWrap = document.getElementById('pallco-older-wrap');
  const toggleOlderBtn = document.getElementById('pallco-toggle-older');

  if (!form || !monthsWrap) return;

  const COLL = _collection(db, 'pallco');
  let editingRowId = null;
  let editingRow = null;

  function resetFormState() {
    editingRowId = null;
    editingRow = null;
    form.reset();
    if (submitBtn) submitBtn.textContent = 'Adicionar';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    if (editingHint) editingHint.style.display = 'none';
  }

  function enterEditMode(row) {
    editingRowId = row.id;
    editingRow = row;
    if (inpData) inpData.value = row.data || '';
    if (inpDesc) inpDesc.value = row.descricao || '';
    if (inpValor) inpValor.value = Number(row.valor || 0).toFixed(2);
    if (submitBtn) submitBtn.textContent = 'Guardar';
    if (cancelEditBtn) cancelEditBtn.style.display = '';
    if (editingHint) editingHint.style.display = '';
    inpData?.focus();
  }

  cancelEditBtn?.addEventListener('click', () => {
    resetFormState();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dataStr = inpData?.value || '';
    const descricao = (inpDesc?.value || '').trim();
    const valor = parseFloat(inpValor?.value || '');

    if (!dataStr || !descricao || isNaN(valor)) {
      alert('Preenche a Data, a Descrição e o Valor.');
      return;
    }

    const monthKey = dataStr.slice(0, 7); // YYYY-MM
    try {
      const payload = {
        data: dataStr,
        descricao,
        valor: Math.round(valor * 100) / 100,
        month: monthKey,
        ts: editingRow?.ts || Date.now()
      };

      if (editingRowId) {
        await updateDoc(doc(db, 'pallco', editingRowId), payload);
        showToast('Movimento atualizado.', 'success');
      } else {
        await _addDoc(COLL, payload);
        showToast('Movimento adicionado.', 'success');
      }

      resetFormState();
      await loadPallco();
    } catch (err) {
      console.error(err);
      alert(editingRowId ? 'Erro ao atualizar movimento.' : 'Erro ao adicionar movimento.');
    }
  });

  async function loadPallco() {
    monthsWrap.innerHTML = '<p>Carregando…</p>';
    try {
      const snap = await _getDocs(COLL);
      let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .map(r => ({
          ...r,
          _order: r.data ? r.data.replaceAll('-', '') : (r.ts || 0)
        }));

      rows.sort((a, b) => {
        const aa = typeof a._order === 'string' ? parseInt(a._order, 10) : a._order;
        const bb = typeof b._order === 'string' ? parseInt(b._order, 10) : b._order;
        return bb - aa;
      });

      renderPallco(rows);
    } catch (err) {
      console.error(err);
      monthsWrap.innerHTML = '<p>Erro ao carregar movimentos.</p>';
    }
  }

  function renderPallco(rows) {
    monthsWrap.__pallcoRows = rows;
    monthsWrap.innerHTML = '';

    if (!rows.length) {
      monthsWrap.innerHTML = '<p class="pallco-empty">Sem movimentos.</p>';
      if (olderWrap) olderWrap.style.display = 'none';
      return;
    }

    // "Novembro 2025"
    const formatMonthName = (ym) => {
      const [year, month] = ym.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      const txt = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      return txt.charAt(0).toUpperCase() + txt.slice(1);
    };

    const MAX_VISIBLE = 10;
    let visibleCount = 0;

    const byMonth = {};
    rows.forEach(r => {
      const mk = r.month || (r.data ? r.data.slice(0,7) : 'Sem Data');
      if (!byMonth[mk]) byMonth[mk] = [];
      byMonth[mk].push(r);
    });

    const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

    monthKeys.forEach(mk => {
      const list = byMonth[mk];
      const totalMonth = list.reduce((s, r) => s + (Number(r.valor) || 0), 0);
      const niceMonth = formatMonthName(mk);

      const monthDiv = document.createElement('div');
      monthDiv.className = 'pallco-month';

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-wrap';

      const table = document.createElement('table');
      table.className = 'table pallco-table';
      table.innerHTML = `
  <thead>
    <tr class="pallco-month-header-row">
      <th colspan="4" class="center">${niceMonth}</th>
    </tr>
    <tr>
      <th>Data</th>
      <th>Descrição</th>
      <th class="right">Valor (€)</th>
      <th class="center">Ações</th>
    </tr>
  </thead>
  <tbody></tbody>
  <tfoot>
    <tr class="pallco-total-row">
      <td colspan="3"></td>
      <td class="right"><strong>${euro2(totalMonth)}</strong></td>
    </tr>
  </tfoot>
`;
      tableWrap.appendChild(table);
      monthDiv.appendChild(tableWrap);

      const tbody = table.querySelector('tbody');

      list.forEach(r => {
        const tr = document.createElement('tr');
        const isHidden = visibleCount >= MAX_VISIBLE;
        if (isHidden) tr.classList.add('pallco-hidden');

        tr.innerHTML = `
          <td>${escapeHtml(r.data || '')}</td>
          <td>${escapeHtml(r.descricao || '')}</td>
          <td class="right">${euro2(r.valor || 0)}</td>
          <td class="center">
            <div class="pallco-actions">
              <button type="button" class="btn btn-edit" data-pallco-edit="${escapeAttr(r.id)}" title="Editar" aria-label="Editar">&#9998;</button>
              <button type="button" class="btn" data-pallco-delete="${escapeAttr(r.id)}" title="Apagar" aria-label="Apagar">Apagar</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);

        if (!isHidden) visibleCount++;
      });

      monthsWrap.appendChild(monthDiv);
    });

    // "Mostrar Movimentos Anteriores"
    const hasHidden = monthsWrap.querySelector('.pallco-hidden') != null;
    if (olderWrap && toggleOlderBtn) {
      if (hasHidden) {
        olderWrap.style.display = 'block';
        if (!toggleOlderBtn.dataset.bound) {
          toggleOlderBtn.addEventListener('click', () => {
            const hiddenRows = monthsWrap.querySelectorAll('.pallco-hidden');
            const isShowing = toggleOlderBtn.dataset.state === 'showing';
            hiddenRows.forEach(el => el.style.display = isShowing ? 'none' : '');
            toggleOlderBtn.textContent = isShowing
              ? 'Mostrar Movimentos Anteriores'
              : 'Esconder Movimentos Anteriores';
            toggleOlderBtn.dataset.state = isShowing ? '' : 'showing';
          });
          monthsWrap.querySelectorAll('.pallco-hidden').forEach(el => { el.style.display = 'none'; });
          toggleOlderBtn.dataset.bound = '1';
          toggleOlderBtn.dataset.state = '';
          toggleOlderBtn.textContent = 'Mostrar Movimentos Anteriores';
        } else {
          const isShowing = toggleOlderBtn.dataset.state === 'showing';
          monthsWrap.querySelectorAll('.pallco-hidden').forEach(el => {
            el.style.display = isShowing ? '' : 'none';
          });
        }
      } else {
        olderWrap.style.display = 'none';
      }
    }
  }

  monthsWrap.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-pallco-edit]');
    if (editBtn) {
      const rowId = editBtn.getAttribute('data-pallco-edit');
      if (!rowId) return;
      const targetRow = monthsWrap.__pallcoRows?.find(row => row.id === rowId);
      if (!targetRow) return;
      enterEditMode(targetRow);
      return;
    }

    const deleteBtn = event.target.closest('[data-pallco-delete]');
    if (!deleteBtn) return;

    const rowId = deleteBtn.getAttribute('data-pallco-delete');
    const targetRow = monthsWrap.__pallcoRows?.find(row => row.id === rowId);
    if (!rowId || !targetRow) return;

    const confirmed = window.confirm(`Apagar o movimento de ${targetRow.data || 'sem data'}?`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'pallco', rowId));
      if (editingRowId === rowId) resetFormState();
      showToast('Movimento apagado.', 'info');
      await loadPallco();
    } catch (err) {
      console.error(err);
      alert('Erro ao apagar movimento.');
    }
  });

  // primeira carga
  loadPallco();
}

