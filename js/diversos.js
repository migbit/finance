// js/cenas.js

import { db } from '../js/script.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    updateDoc, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Configuration
const CONFIG = {
    workerUrl: 'https://noisy-butterfly-af58.migbit84.workers.dev/',
    icalUrls: {
        '123': 'https://www.airbnb.pt/calendar/ical/1192674.ics?s=713a99e9483f6ed204d12be2acc1f940',
        '1248': 'https://www.airbnb.pt/calendar/ical/9776121.ics?s=20937949370c92092084c8f0e5a50bbb'
    },
    months: [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
};

// DOM
const invoiceForm   = document.getElementById('carlos-invoice-form');
const invoicesBody  = document.getElementById('carlos-invoices-body');

// State
const state = {
    reservedDates: new Set(),
    selectedDates: new Set(), // Track selected dates
    today: new Date(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// Calendar Functions
async function fetchIcalData(icalUrl) {
    try {
        const response = await fetch(`${CONFIG.workerUrl}?url=${encodeURIComponent(icalUrl)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        if (text.trim().startsWith('<')) {
            throw new Error('Received HTML instead of iCal data');
        }
        return text;
    } catch (error) {
        console.error('Error fetching iCal data:', error);
        throw error;
    }
}

function parseIcalData(icalData) {
    try {
        const jcalData = ICAL.parse(icalData);
        const comp = new ICAL.Component(jcalData);
        const events = comp.getAllSubcomponents('vevent');

        return events.map(event => ({
            summary: event.getFirstPropertyValue('summary'),
            startDate: event.getFirstPropertyValue('dtstart').toJSDate(),
            endDate: event.getFirstPropertyValue('dtend').toJSDate()
        }));
    } catch (error) {
        console.error('Error parsing iCal data:', error);
        throw error;
    }
}

async function loadIcalData(apartmentId) {
    try {
        const icalData = await fetchIcalData(CONFIG.icalUrls[apartmentId]);
        const reservations = parseIcalData(icalData);
        
        reservations.forEach(reservation => {
            const dateStr = reservation.startDate.toISOString().split('T')[0];
            state.reservedDates.add(dateStr);
        });
    } catch (error) {
        console.error(`Error loading iCal for Apartment ${apartmentId}:`, error);
    }
}

function renderCalendar(month, year) {
    const monthYear = document.getElementById('month-year');
    const calendarBody = document.getElementById('calendar-body');
    
    if (!monthYear || !calendarBody) {
        console.error('Required calendar elements not found');
        return;
    }

    // Clear previous content
    calendarBody.innerHTML = '';
    monthYear.textContent = `${CONFIG.months[month]} ${year}`;

    // Calculate calendar data
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let date = 1;

    // Create calendar grid
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('tr');

        for (let j = 0; j < 7; j++) {
            const cell = document.createElement('td');

            if (i === 0 && j < firstDay || date > daysInMonth) {
                cell.innerHTML = '';
            } else {
                const span = document.createElement('span');
                span.textContent = date;

                const dateObj = new Date(year, month, date);
                const dateStr = dateObj.toISOString().split('T')[0];

                // Check if the day is today
                if (date === state.today.getDate() && 
                    month === state.today.getMonth() && 
                    year === state.today.getFullYear()) {
                    span.classList.add('today');
                }

                // Apply reserved style if date is reserved
                if (state.reservedDates.has(dateStr)) {
                    span.classList.add('reserved');
                }

                // Apply selected style if date is selected
                if (state.selectedDates.has(dateStr)) {
                    span.classList.add('selected');
                }

                // Event listener for selecting/unselecting a date
                span.addEventListener('click', async () => {
                    if (span.classList.contains('selected')) {
                        // Unselect the date
                        span.classList.remove('selected');
                        state.selectedDates.delete(dateStr);
                        await removeSelectedDateFromFirebase(dateStr);
                    } else {
                        // Select the date
                        span.classList.add('selected');
                        state.selectedDates.add(dateStr);
                        await saveSelectedDateToFirebase(dateStr);
                    }
                });

                cell.appendChild(span);
                date++;
            }

            row.appendChild(cell);
        }

        calendarBody.appendChild(row);
        if (date > daysInMonth) break;
    }
}

// Firebase functions for saving and removing selected dates
async function saveSelectedDateToFirebase(dateStr) {
    try {
        await addDoc(collection(db, "selectedDates"), { date: dateStr });
        console.log(`Selected date ${dateStr} saved to Firebase`);
    } catch (error) {
        console.error("Error saving selected date:", error);
    }
}

async function removeSelectedDateFromFirebase(dateStr) {
    try {
        const q = query(collection(db, "selectedDates"), where("date", "==", dateStr));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
            console.log(`Unselected date ${dateStr} removed from Firebase`);
        });
    } catch (error) {
        console.error("Error removing selected date:", error);
    }
}

// Load selected dates from Firebase on page load
async function loadSelectedDates() {
    try {
        const querySnapshot = await getDocs(collection(db, "selectedDates"));
        querySnapshot.forEach((doc) => {
            const dateStr = doc.data().date;
            state.selectedDates.add(dateStr);
        });
        console.log("Selected dates loaded from Firebase");
    } catch (error) {
        console.error("Error loading selected dates:", error);
    }
}

// Todo List Functions
async function addTask(taskText) {
    try {
        const docRef = await addDoc(collection(db, "todos"), {
            text: taskText,
            timestamp: new Date()
        });
        console.log("Task added with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding task:", error);
        throw error;
    }
}

async function loadTasks() {
    const todoList = document.getElementById('todo-list');
    if (!todoList) return;

    todoList.innerHTML = '<li>Carregando tarefas...</li>';
    
    try {
        const q = query(collection(db, "todos"), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(q);
        
        todoList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const task = doc.data();
            const li = document.createElement('li');
            
            const taskText = document.createElement('span');
            taskText.textContent = task.text;
            li.appendChild(taskText);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Apagar';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => deleteTask(doc.id);
            li.appendChild(deleteBtn);
            
            todoList.appendChild(li);
        });
    } catch (error) {
        console.error("Error loading tasks:", error);
        todoList.innerHTML = '<li>Erro ao carregar tarefas</li>';
    }
}

async function deleteTask(taskId) {
    try {
        await deleteDoc(doc(db, "todos", taskId));
        await loadTasks();
    } catch (error) {
        console.error("Error deleting task:", error);
        alert('Erro ao apagar tarefa');
    }
}

// —— Secção Carlos (Faturas Pendentes) ——
// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadInvoices();
    invoiceForm.addEventListener('submit', addInvoice);
  });
  
  // 1) Adicionar nova fatura
  async function addInvoice(e) {
    e.preventDefault();
    const numero = document.getElementById('invoice-number').value.trim();
    const data   = document.getElementById('invoice-date').value;
    const total  = parseFloat(document.getElementById('invoice-total').value);
    if (!numero || !data || isNaN(total)) {
      alert('Preencha todos os campos da fatura');
      return;
    }
  
    try {
      await addDoc(collection(db, 'carlosInvoices'), { numero, data, total });
      invoiceForm.reset();
      loadInvoices();
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar fatura');
    }
  }
  
  // 2) Carregar e renderizar todas faturas + pagamentos
  async function loadInvoices() {
    invoicesBody.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';
    try {
      const snapInv = await getDocs(collection(db, 'carlosInvoices'));
      const invoices = snapInv.docs.map(d => ({ id: d.id, ...d.data() }));
      invoicesBody.innerHTML = '';
      await Promise.all(invoices.map(inv => renderInvoiceRow(inv)));
      if (invoices.length === 0) {
        invoicesBody.innerHTML = '<tr><td colspan="6">Nenhuma fatura cadastrada</td></tr>';
      }
    } catch (err) {
      console.error(err);
      invoicesBody.innerHTML = '<tr><td colspan="6">Erro ao carregar faturas</td></tr>';
    }
  }
  
  // 3) Renderizar cada linha de fatura + sub-tabela de pagamentos
  async function renderInvoiceRow(inv) {
    // 1) Puxa todos os pagamentos desta fatura
    const snapPay  = await getDocs(collection(db, 'carlosInvoices', inv.id, 'payments'));
    const payments = snapPay.docs.map(p => p.data());
    const paidSum  = payments.reduce((s,p) => s + p.valorPago, 0);
    const balance  = inv.total - paidSum;
  
    // 2) Linha principal da fatura
    const trInv = document.createElement('tr');
    if (paidSum >= inv.total) trInv.classList.add('text-muted');
    trInv.innerHTML = `
      <td>${inv.numero}</td>
      <td>${inv.data}</td>
      <td>€${inv.total.toFixed(2)}</td>
      <td>€${paidSum.toFixed(2)}</td>
      <td>€${balance.toFixed(2)}</td>
      <td>
        <button class="btn btn-sm btn-primary btn-add-payment">Adicionar Pag.</button>
      </td>
    `;
    invoicesBody.appendChild(trInv);
  
    // 3) Linhas de cada pagamento efetuado
    payments.forEach(pay => {
      const trPay = document.createElement('tr');
      trPay.classList.add('text-secondary');
      trPay.innerHTML = `
        <td></td>
        <td>${pay.dataPagamento}</td>
        <td></td>
        <td>€${pay.valorPago.toFixed(2)}</td>
        <td></td>
        <td></td>
      `;
      invoicesBody.appendChild(trPay);
    });
  
    // 4) Linha contendo o formulário, inicialmente escondido
    const trForm = document.createElement('tr');
    trForm.innerHTML = `
      <td colspan="6" style="display:none;">
        <form class="form-inline" id="payment-form-${inv.id}">
          <input type="date"   name="dataPagamento" required>
          <input type="number" name="valorPago" placeholder="Valor (€)" step="0.01" max="${balance.toFixed(2)}" required>
          <button type="submit" class="btn btn-success btn-sm ml-2">Registar</button>
        </form>
      </td>
    `;
    invoicesBody.appendChild(trForm);
  
    // 5) Toggle do form
    trInv.querySelector('.btn-add-payment').addEventListener('click', () => {
      const cell = trForm.firstElementChild;
      cell.style.display = cell.style.display === 'none' ? 'block' : 'none';
    });
  
    // 6) Submissão do formulário
    trForm.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const dataPagamento = f.dataPagamento.value;
      const valorPago     = parseFloat(f.valorPago.value);
      try {
        await addDoc(
          collection(db, 'carlosInvoices', inv.id, 'payments'),
          { dataPagamento, valorPago }
        );
        loadInvoices();
      } catch (err) {
        console.error(err);
        alert('Erro ao registar pagamento');
      }
    });
  }

// Event Listeners (extended to support comments)
function setupEventListeners() {
    document.getElementById('prev-month')?.addEventListener('click', () => {
        state.currentMonth--;
        if (state.currentMonth < 0) {
            state.currentMonth = 11;
            state.currentYear--;
        }
        renderCalendar(state.currentMonth, state.currentYear);
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
        state.currentMonth++;
        if (state.currentMonth > 11) {
            state.currentMonth = 0;
            state.currentYear++;
        }
        renderCalendar(state.currentMonth, state.currentYear);
    });

    // Todo form
    document.getElementById('todo-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('todo-input');
        if (!input) return;

        const taskText = input.value.trim();
        if (!taskText) {
            alert('Por favor, insira uma tarefa válida');
            return;
        }

        try {
            await addTask(taskText);
            input.value = '';
            await loadTasks();
        } catch (error) {
            alert('Erro ao adicionar tarefa');
        }
    });
}

// Initialization
async function init() {
    try {
        // Load reservations
        const loadPromises = Object.keys(CONFIG.icalUrls).map(loadIcalData);
        await Promise.allSettled(loadPromises);

        // Load selected dates
        await loadSelectedDates();

        // Initialize calendar
        renderCalendar(state.currentMonth, state.currentYear);
        
        // Load tasks
        await loadTasks();

        // Inicializar Carlos – Faturas Pendentes
invoiceForm.addEventListener('submit', addInvoice);
await loadInvoices();

        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Erro ao inicializar a aplicação');
    }
}

// Checklist Data
const checklists = {
    aulaRPM: [
        "Calções", "Camisola", "Meias Bike", "Fita Banda Cardíaca", "Banda Cardíaca", 
        "Sapatilhas Bike", "Chinelos", "Calções banho", "Toalha pequena", "Toalha grande", "Água", "Meias", "Boxers"
    ],
    bikeRide: [
        "Banda Cardíaca", "Óculos", "Luz", "Eletrólitos", "Dinheiro", "Capacete", "Energético", "H20", "GPS", "Luvas", "Saco tlmv", "Pressão 6 bar"
    ],
    Ginásio: [
        "Toalha Pequena", "Toalha Grande", "Calções", "T-Shirt", "Chinelos", "Sapatilhas"
    ]
};

// Function to load checklist items based on selection
function loadChecklist() {
    const checklistDropdown = document.getElementById("checklist-dropdown");
    const checklistItemsContainer = document.getElementById("checklist-items");

    // Clear previous checklist
    checklistItemsContainer.innerHTML = '';
    checklistItemsContainer.style.display = 'none';

    // Get selected checklist
    const selectedChecklist = checklistDropdown.value;
    if (selectedChecklist && checklists[selectedChecklist]) {
        checklists[selectedChecklist].forEach((item) => {
            // Create list item with color change on click
            const listItem = document.createElement("li");
            listItem.className = "list-group-item checklist-item";
            listItem.textContent = item;
            listItem.style.color = "red"; // Initial color

            // Event listener to toggle color on click
            listItem.addEventListener("click", () => {
                if (listItem.style.color === "red") {
                    listItem.style.color = "green";
                }
                
                // Check if all items are green
                const allGreen = [...checklistItemsContainer.querySelectorAll(".checklist-item")]
                    .every(item => item.style.color === "green");
                if (allGreen) {
                    checklistItemsContainer.style.display = 'none';
                }
            });

            checklistItemsContainer.appendChild(listItem);
        });

        // Show checklist
        checklistItemsContainer.style.display = 'block';
    }
}

// Event Listener for Dropdown Change
document.getElementById("checklist-dropdown").addEventListener("change", loadChecklist);



// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', init);
