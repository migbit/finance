// hospedes.js

import { db } from './script.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Function to add a guest (comment)
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

// Function to load guests
async function loadComments() {
    const commentList = document.getElementById('comment-list');
    if (!commentList) return;

    commentList.innerHTML = '<li>Carregando hóspedes...</li>';
    
    try {
        const q = query(collection(db, "comments"), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(q);
        
        commentList.innerHTML = '';
        
        querySnapshot.forEach((docSnap) => {
            const guest = docSnap.data();
            const li = document.createElement('li');
            li.classList.add('comment-item');

            // Container for guest details
            const detailsDiv = document.createElement('div');
            detailsDiv.classList.add('details');

            // Guest Name Display
            const guestNameSpan = document.createElement('span');
            guestNameSpan.textContent = guest.guestName;
            guestNameSpan.classList.add('guest-name');

            // Dropdowns Container
            const dropdownsDiv = document.createElement('div');
            dropdownsDiv.classList.add('dropdowns');

            // Rating Dropdown
            const ratingDropdown = document.createElement('select');
            ratingDropdown.innerHTML = `
                <option value="">Comentário</option>
                <option value="Não sei" ${guest.ratingOption === 'Não sei' ? 'selected' : ''}>Não sei</option>
                <option value="5 Estrelas" ${guest.ratingOption === '5 Estrelas' ? 'selected' : ''}>5 Estrelas</option>
                <option value="Não escrever!" ${guest.ratingOption === 'Não escrever!' ? 'selected' : ''}>Não escrever!</option>
            `;
            ratingDropdown.title = "Comentários";

            // Fatura Dropdown
            const faturaDropdown = document.createElement('select');
            faturaDropdown.innerHTML = `
                <option value="">Fatura</option>
                <option value="Não Emitida" ${guest.faturaOption === 'Não Emitida' ? 'selected' : ''}>Não Emitida</option>
                <option value="Emitida" ${guest.faturaOption === 'Emitida' ? 'selected' : ''}>Emitida</option>
            `;
            faturaDropdown.title = "Fatura";

            // SIBA Dropdown
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

            // Notes Section
            const notesDiv = document.createElement('div');
            notesDiv.classList.add('notes-section');
            const notesLabel = document.createElement('label');
            const notesTextarea = document.createElement('textarea');
            notesTextarea.value = guest.notes || "";
            notesTextarea.placeholder = "Notas sobre o hóspede...";
            notesTextarea.addEventListener('input', () => {
                // Optional: Auto-save notes on input
            });
            notesDiv.appendChild(notesLabel);
            notesDiv.appendChild(notesTextarea);

            detailsDiv.appendChild(guestNameSpan);
            detailsDiv.appendChild(dropdownsDiv);
            detailsDiv.appendChild(notesDiv);

            // Actions Container
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('actions');

            // Update Button
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

            // Delete Button
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

// Function to update a guest
async function updateComment(commentId, updatedFields) {
    try {
        const commentRef = doc(db, "comments", commentId);
        await updateDoc(commentRef, {
            ratingOption: updatedFields.ratingOption,
            faturaOption: updatedFields.faturaOption,
            sibaOption: updatedFields.sibaOption,
            notes: updatedFields.notes
        });
        console.log('Guest updated successfully');
    } catch (error) {
        console.error("Error updating guest:", error);
    }
}

// Function to delete a guest
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

// Event listener for adding a new guest
document.getElementById('comment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const guestNameInput = document.getElementById('guest-name');
    const guestName = guestNameInput.value.trim();

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

// Load guests on page load
document.addEventListener('DOMContentLoaded', loadComments);
