// Importar as funções necessárias do Firebase e EmailJS
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBRx2EYDi3FpfmJjttO2wd9zeFVV3uH6Q0",
    authDomain: "apartments-a4b17.firebaseapp.com",
    projectId: "apartments-a4b17",
    storageBucket: "apartments-a4b17.appspot.com",
    messagingSenderId: "465612199373",
    appId: "1:465612199373:web:2b8e1eb14f453caa532084"
};

// Inicializar Firebase apenas se não estiver já inicializado
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized.");
} else {
    app = getApps()[0]; // Usa a instância já existente
    console.log("Firebase app already initialized.");
}

// Inicializar Firestore
const db = getFirestore(app);
window.db = db;  // <-- make db globally available

// Inicializar o Firebase Authentication e o provedor do Google
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Função de login com Google
function loginComGoogle() {
    console.log("Botão de login clicado. Tentando login com Google...");
    signInWithPopup(auth, provider)
    .then((result) => {
        // O utilizador autenticou-se com sucesso
        const user = result.user;
        console.log("Utilizador autenticado:", user.displayName, user.email);
        atualizarInterface(user);
    })
    .catch((error) => {
        // Tratar erros
        console.error("Erro na autenticação com o Google:", error.message);
    });
}

// Função de logout
function logout() {
    console.log("Tentando fazer logout...");
    signOut(auth)
    .then(() => {
        console.log("Utilizador saiu com sucesso.");
        atualizarInterface(null);
    })
    .catch((error) => {
        console.error("Erro ao sair:", error.message);
    });
}

// Garantir que o código só seja executado quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Verificar a existência dos elementos antes de acessá-los
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Verificar se o botão de login existe antes de tentar adicionar o event listener
    if (loginBtn) {
        console.log("Login button found, adding event listener");
        loginBtn.addEventListener('click', loginComGoogle);
    } else {
        console.log("Login button not found on this page.");
    }

    // Verificar se o botão de logout existe antes de tentar adicionar o event listener
    if (logoutBtn) {
        console.log("Logout button found, adding event listener");
        logoutBtn.addEventListener('click', logout);
    } else {
        console.log("Logout button not found on this page.");
    }

    // Estado de autenticação - Verificar se o utilizador está autenticado
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User is authenticated:", user.displayName);
            atualizarInterface(user);  // Atualizar a interface com as informações do utilizador
        } else {
            console.log("No user is authenticated.");
            atualizarInterface(null);  // Limpar a interface
        }
    });
});

// Atualizar a interface de acordo com o estado de autenticação
function atualizarInterface(user) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');

    if (user) {
        // Utilizador autenticado
        console.log("Updating interface to show user information");
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (userInfo) {
            userInfo.style.display = 'block';
            userName.textContent = user.displayName;
        }
    } else {
        // Nenhum utilizador autenticado
        console.log("Updating interface to show login button");
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
    }
}

// Função para copiar texto (mantida do código anterior)
function copiarMensagem(texto) {
    navigator.clipboard.writeText(texto).then(() => {
        alert('Mensagem copiada para a área de transferência!');
    }).catch(err => {
        console.error('Erro ao copiar a mensagem: ', err);
    });
}

// Exportar funções necessárias
export { db, copiarMensagem };

// Função para enviar um e-mail de urgência usando EmailJS (mantida do código anterior)
export function enviarEmailUrgencia(apartamento, descricao) {
    emailjs.send('service_tuglp9h', 'template_l516egr', {
        to_name: "apartments.oporto@gmail.com",
        from_name: "Apartments Oporto",
        subject: "Reparação Urgente Necessária",
        message: `Uma nova reparação urgente foi registrada no apartamento ${apartamento}: ${descricao}`
    })
    .then(function(response) {
        console.log('E-mail enviado com sucesso!', response.status, response.text);
    }, function(error) {
        console.error('Erro ao enviar e-mail:', error);
    });
}

// Attach the function to the window object if needed (for testing)
window.enviarEmailUrgencia = enviarEmailUrgencia;
