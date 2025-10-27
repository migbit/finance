// js/reparacoes.js

import { db, enviarEmailUrgencia } from './script.js';
import { collection, addDoc, getDocs, query, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Selecionar elementos do DOM
const reparacoesForm = document.getElementById('reparacoes-form');
const listaReparacoesDiv = document.getElementById('lista-reparacoes');

// Adicionar uma nova reparação
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

        // Enviar e-mail se a urgência for "alta"
        if (urgencia === 'alta') {
            console.log('Urgência alta detectada. Enviando e-mail...');

            // Enviar o e-mail com a descrição da reparação e o apartamento
            const templateParams = {
                to_name: "apartments.oporto@gmail.com",
                from_name: "Apartments Oporto",
                message: `Uma nova reparação urgente foi registrada no apartamento ${apartamento}: ${descricao}`
            };

            enviarEmailUrgencia(templateParams);
        }
    } catch (error) {
        console.error("Erro ao registrar reparação: ", error);
        alert('Ocorreu um erro ao registrar a reparação.');
    }
});

// Carregar e exibir as reparações
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

// Função para atualizar o status da reparação
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

// Carregar reparações ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    carregarReparacoes();
});
