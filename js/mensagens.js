// Load the JSON data
document.addEventListener('DOMContentLoaded', () => {
    fetch('./mensagensData.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(initializeMessageSelectors)
        .catch(error => {
            console.error('Error fetching the JSON data:', error);
        });
});

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
        babyMessageContainer: document.getElementById('baby-message-container'),  // Baby message section
        copyBabyMessageBtn: document.getElementById('copy-baby-message-btn'),  // Baby message button
        copySMSMessageBtn: document.getElementById('copy-sms-message-btn')  // SMS button
    };

    let selectedIdioma = "";
    let selectedCategoria = "";
    let selectedSubCategoria = "";
    let selectedWeekday = "";

    // Fixed baby message for all languages
    const babyMessages = {
        "Português": "Gostaria de saber se precisa de uma cama de bebé e/ou de uma cadeira de alimentação.",
        "Inglês": "Additionally, I’d like to know if you need a baby bed and/or a feeding chair.",
        "Espanhol": "Además, me gustaría saber si necesitas una cuna y/o una silla para bebé.",
        "Francês": "De plus, je voudrais savoir si vous avez besoin d'un lit bébé et/ou d'une chaise pour bébé."
    };

    // Fixed SMS message for all languages
    const smsMessages = {
        "Português": "Sou Miguel, o seu anfitrião Airbnb no Porto.",
        "Inglês": "I’m Miguel, your Porto Airbnb host.",
        "Espanhol": "Soy Miguel, tu anfitrión de Airbnb en Porto.",
        "Francês": "Je suis Miguel, votre hôte Airbnb à Porto."
    };

    // Reset function to hide elements
    function resetDropdowns() {
        [elements.categoriaDiv, elements.subcategoriaDiv, elements.nameInputContainer, 
         elements.weekdayDropdownContainer, elements.mensagemSecao, elements.babyMessageContainer]  // Baby message container included
         .forEach(el => el.style.display = 'none');
        elements.categoriaDropdown.innerHTML = '<option value="">Selecionar Categoria</option>';
        elements.subcategoriaDropdown.innerHTML = '<option value="">Selecionar Subcategoria</option>';
        selectedCategoria = "";
        selectedSubCategoria = "";
        selectedWeekday = "";
    }

    // Populate dropdowns
    function populateDropdown(dropdown, options, defaultText) {
        dropdown.innerHTML = `<option value="">${defaultText}</option>`;
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            dropdown.appendChild(optionElement);
        });
    }

    // Handle subcategory changes
    function handleSubcategoryChange() {
        const isWhenArrive = selectedSubCategoria === 'Quando Chegam?';
        elements.nameInputContainer.style.display = isWhenArrive ? 'block' : 'none';
        elements.weekdayDropdownContainer.style.display = isWhenArrive ? 'block' : 'none';
        elements.babyMessageContainer.style.display = isWhenArrive ? 'block' : 'none';  // Show baby message if "Quando Chegam?"

        if (isWhenArrive) {
            if (selectedWeekday) {
                updateMessage();
            } else {
                elements.mensagemSecao.style.display = 'none';
            }
        } else {
            updateMessage();
        }
    }

    // Update the main message
    function updateMessage() {
        if (!selectedIdioma || !selectedCategoria || !selectedSubCategoria) {
            elements.mensagemSecao.style.display = 'none';
            return;
        }
    
        let messageObj = mensagens[selectedCategoria][selectedSubCategoria];
        if (selectedSubCategoria === 'Quando Chegam?' && selectedWeekday) {
            messageObj = messageObj[selectedWeekday];
        }
    
        const selectedMessage = messageObj[selectedIdioma];
        const guestName = elements.guestNameInput.value.trim();
    
        if (selectedMessage) {
            const finalMessage = guestName ? selectedMessage.replace(/\[Hospede\]/g, guestName) : selectedMessage;
    
            // Display the message with <p> tags for formatting
            elements.mensagemContainer.innerHTML = `<p>${finalMessage.replace(/\n/g, '</p><p>')}</p>`;
            elements.mensagemSecao.style.display = 'block';
    
            // Copy only plain text (with newline formatting)
            elements.mensagemContainer.onclick = () => copyMessageToClipboard();
        } else {
            elements.mensagemContainer.innerHTML = 'Mensagem não disponível.';
            elements.mensagemSecao.style.display = 'block';
        }
    }

// Function to copy formatted plain text message to clipboard
function copyMessageToClipboard() {
    let messageText = elements.mensagemContainer.innerHTML;

    // Replace list items and paragraph tags with formatted text
    messageText = messageText
        .replace(/<\/li>/g, '\n')  // End of list item adds newline
        .replace(/<li>/g, '• ')    // Start of list item adds bullet point
        .replace(/<\/?ul>/g, '')   // Remove <ul> tags
        .replace(/<\/p>/g, '\n')   // End of paragraph adds newline
        .replace(/<p>/g, '')       // Remove start of paragraph
        .replace(/<\/?strong>/g, '') // Remove <strong> tags

    // Remove any remaining HTML tags
    messageText = messageText.replace(/<\/?[^>]+(>|$)/g, '').trim();

    // Remove multiple consecutive newlines (this prevents extra space)
    messageText = messageText.replace(/\n\s*\n/g, '\n\n');  // Two newlines for proper paragraph spacing

    // Copy formatted plain text to clipboard
    const tempElement = document.createElement('textarea');
    tempElement.style.position = 'absolute';
    tempElement.style.left = '-9999px';
    tempElement.value = messageText; // Copy formatted plain text

    document.body.appendChild(tempElement);
    tempElement.select();
    document.execCommand('copy');
    document.body.removeChild(tempElement);
}

// Handle baby message copy button click
elements.copyBabyMessageBtn.onclick = () => {
    const babyMessage = babyMessages[selectedIdioma] || babyMessages["Inglês"];  // Fallback to English if no match
    copyPlainTextToClipboard(babyMessage);
};

// Handle SMS message copy button click
elements.copySMSMessageBtn.onclick = () => {
    const smsMessage = smsMessages[selectedIdioma] || smsMessages["Inglês"];  // Fallback to English if no match
    copyPlainTextToClipboard(smsMessage);
};

// Function to copy plain text to clipboard (without extra formatting)
function copyPlainTextToClipboard(text) {
    const tempElement = document.createElement('textarea');
    tempElement.style.position = 'absolute';
    tempElement.style.left = '-9999px';
    tempElement.value = text.trim();  // Copy plain text

    document.body.appendChild(tempElement);
    tempElement.select();
    document.execCommand('copy');
    document.body.removeChild(tempElement);
}


    // Language dropdown changes
    elements.languageDropdown.onchange = () => {
        selectedIdioma = elements.languageDropdown.value;
        if (selectedIdioma) {
            if (!selectedCategoria) {
                populateDropdown(elements.categoriaDropdown, Object.keys(mensagens), 'Selecionar Categoria');
                elements.categoriaDiv.style.display = 'block';
            } else {
                updateMessage();
            }
        } else {
            resetDropdowns();
        }
    };

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

    elements.subcategoriaDropdown.onchange = () => {
        selectedSubCategoria = elements.subcategoriaDropdown.value;
        handleSubcategoryChange();
    };

    elements.weekdayDropdown.onchange = () => {
        selectedWeekday = elements.weekdayDropdown.value;
        updateMessage();
    };

    elements.guestNameInput.oninput = updateMessage;
}
