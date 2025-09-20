// Finance repo – script.js (adapted from main app)
/*
  Key changes vs main app:
  - Keeps Firebase v9 modular imports from gstatic CDN
  - Works even if login/logout elements are absent (no-op)
  - Exposes db globally (window.db) and exports { db, copiarMensagem }
  - EmailJS calls are optional (skips if emailjs is not present)
  - Adds mobile menu toggle + current link highlighting
*/

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Firebase config (same project as main app)
const firebaseConfig = {
  apiKey: "AIzaSyBRx2EYDi3FpfmJjttO2wd9zeFVV3uH6Q0",
  authDomain: "apartments-a4b17.firebaseapp.com",
  projectId: "apartments-a4b17",
  storageBucket: "apartments-a4b17.appspot.com",
  messagingSenderId: "465612199373",
  appId: "1:465612199373:web:2b8e1eb14f453caa532084"
};

// Initialize (singleton-friendly)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized.");
} else {
  app = getApps()[0];
  console.log("Firebase app already initialized.");
}

// Firestore
const db = getFirestore(app);
window.db = db;

// Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function loginComGoogle() {
  console.log("Login with Google...");
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("User authenticated:", user.displayName, user.email);
      atualizarInterface(user);
    })
    .catch((error) => {
      console.error("Erro na autenticação com o Google:", error.message);
    });
}

function logout() {
  console.log("Logout...");
  signOut(auth)
    .then(() => {
      console.log("Saiu com sucesso.");
      atualizarInterface(null);
    })
    .catch((error) => {
      console.error("Erro ao sair:", error.message);
    });
}

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu + active link
  const menuIcon = document.getElementById('menu-icon');
  const navMenu  = document.getElementById('nav-menu');
  if (menuIcon && navMenu) {
    menuIcon.addEventListener('click', () => navMenu.classList.toggle('active'));
  }
  const here = location.pathname.replace(/\/+/g,'/');
  document.querySelectorAll('nav a[href]').forEach(a => {
    try {
      const href = new URL(a.getAttribute('href'), location.origin).pathname;
      if (href === here) a.classList.add('active');
    } catch(e){ /* ignore */ }
  });

  // Auth UI bindings if present
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  if (loginBtn) {
    console.log("Login button found, adding event listener");
    loginBtn.addEventListener('click', loginComGoogle);
  } else {
    console.log("Login button not found on this page.");
  }
  if (logoutBtn) {
    console.log("Logout button found, adding event listener");
    logoutBtn.addEventListener('click', logout);
  } else {
    console.log("Logout button not found on this page.");
  }

  // Auth state
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User is authenticated:", user.displayName);
      atualizarInterface(user);
    } else {
      console.log("No user is authenticated.");
      atualizarInterface(null);
    }
  });
});

function atualizarInterface(user) {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (userInfo) {
      userInfo.style.display = 'block';
      if (userName) userName.textContent = user.displayName || user.email || 'Utilizador';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
  }
}

// Utilities
function copiarMensagem(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    alert('Mensagem copiada para a área de transferência!');
  }).catch(err => {
    console.error('Erro ao copiar a mensagem: ', err);
  });
}

// Optional EmailJS (only if global emailjs exists)
function enviarEmailUrgencia(apartamento, descricao) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS não encontrado. Ignorando envio de email.');
    return;
  }
  emailjs.send('service_tuglp9h', 'template_l516egr', {
    to_name: "apartments.oporto@gmail.com",
    from_name: "Apartments Oporto",
    subject: "Reparação Urgente Necessária",
    message: `Uma nova reparação urgente foi registrada no apartamento ${apartamento}: ${descricao}`
  }).then((response) => {
    console.log('E-mail enviado com sucesso!', response.status, response.text);
  }).catch((error) => {
    console.error('Erro ao enviar e-mail:', error);
  });
}

// Exports for other modules
export { db, copiarMensagem, enviarEmailUrgencia };
window.enviarEmailUrgencia = enviarEmailUrgencia;
