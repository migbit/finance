// js/diversos.js - Consolidated file for all Diversos page functionality

// ========================================
// IMPORTS
// ========================================

if (window.__diversosInit) { /* já correu */ }
else { window.__diversosInit = true; /* segue init */ }

import { db, enviarEmailUrgencia } from './script.js';
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

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[m]));
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
            "Água 1.5l", "Água 5l", "Café", "Rolo de Cozinha", "Guardanapos", "Bolachas",
            "Chá", "Lava-Loiça", "Esfregões Verdes", "Esfregões Bravo",
            "Película Transparente", "Papel Alumínio", "Sacos congelação"
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
        await updateDoc(ref, {
            [`itens.${nome}`]: { quantidade, local },
            ultimaAtualizacao: Timestamp.now()
        });
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
                    await updateDoc(ref, {
                        [`itens.${nome}`]: deleteField(),
                        ultimaAtualizacao: Timestamp.now()
                    });
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

    ivaForm.addEventListener('submit', onAddIva);
    loadIvaEstrangeiro();

    async function onAddIva(e) {
        e.preventDefault();
        const dataStr = document.getElementById('iva-data').value;
        const valor = parseFloat(document.getElementById('iva-valor').value);

        if (!dataStr || isNaN(valor)) {
            alert('Preenche a Data e o Valor (sem IVA).');
            return;
        }

        const iva = +(valor * 0.23).toFixed(2);
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

    async function loadIvaEstrangeiro() {
        ivaBody.innerHTML = '<tr><td colspan="4">Carregando…</td></tr>';

        try {
            const snap = await _getDocs(_collection(db, 'ivaEstrangeiro'));
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
            renderNextPage();
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
            ivaBody.innerHTML = '<tr><td colspan="4">Erro ao carregar registos</td></tr>';
        }
    }

    function renderNextPage() {
        const slice = _ivaRowsAll.slice(_ivaVisible, _ivaVisible + IVA_PAGE);
        slice.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(r.data || '')}</td>
                <td>${euroInt(r.valor)}</td>
                <td>${euroInt(r.iva ?? (r.valor * 0.23))}</td>
                <td>${euroInt(r.total ?? (r.valor * 1.23))}</td>
            `;
            ivaBody.appendChild(tr);
        });
        _ivaVisible += slice.length;

        if (_ivaVisible === 0) {
            ivaBody.innerHTML = '<tr><td colspan="4">Sem registos</td></tr>';
        }
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
            const valor = +(+r.valor || 0);
            const iva = +(r.iva ?? (valor * 0.23));
            const total = +(r.total ?? (valor * 1.23));

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
                <td>${euroInt(r.valor)}</td>
                <td>${euroInt(r.iva)}</td>
                <td>${euroInt(r.total)}</td>
            `;
            triBody.appendChild(tr);
        });
    }
}
