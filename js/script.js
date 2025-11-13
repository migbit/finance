// Finance repo – script.js (adapted from main app)
/*
  Key changes vs main app:
  - Keeps Firebase v9 modular imports from gstatic CDN
  - Works even if login/logout elements are absent (no-op)
  - Exposes db globally (window.db) and exports { db, copiarMensagem }
  - EmailJS calls are optional (skips if emailjs is not present)
  - Adds mobile menu toggle + current link highlighting
*/

// -------------------------------------------
// Global navigation builder
// -------------------------------------------

const NAV_GROUPS = [
  {
    label: '🏠 Apartamentos',
    key: 'apartamentos',
    links: [
      { label: '📄 Faturas', key: 'faturas', slug: 'modules/faturas.html', module: true },
      { label: '🆕 Análise V3', key: 'analisev3', slug: 'modules/analisev3.html', module: true },
      { label: '📊 Análise V2', key: 'analisev2', slug: 'modules/analisev2.html', module: true },
      { label: '🧳 Taxa Turística', key: 'tmt', slug: 'modules/tmt.html', module: true },
      { label: '📋 Diversos', key: 'diversos', slug: 'modules/diversos.html', module: true }
    ]
  },
  {
    label: '💼 Contabilidade',
    key: 'contabilidade',
    links: [
      { label: '💰 Caixa', key: 'caixa', slug: 'modules/caixa.html', module: true },
      { label: '📑 IVA Estrangeiro', key: 'iva', slug: 'modules/iva.html', module: true },
      { label: '🏢 PALLCO', key: 'pallco', slug: 'modules/pallco.html', module: true },
      { label: '🧾 Carlos – Faturas', key: 'carlos', slug: 'modules/carlos.html', module: true }
    ]
  },
  {
    label: '📊 Investimentos',
    key: 'investimentos',
    links: [
      { label: '📈 DCA', key: 'dca', slug: 'modules/dca.html', module: true },
      { label: '🚀 Cripto', key: 'crypto', slug: 'modules/crypto.html', module: true }
    ]
  }
];

const ACTIVE_KEY_MATCHERS = [
  { key: 'analisev3', patterns: ['analisev3'] },
  { key: 'analisev2', patterns: ['analisev2'] },
  { key: 'faturas', patterns: ['faturas'] },
  { key: 'tmt', patterns: ['tmt'] },
  { key: 'diversos', patterns: ['diversos'] },
  { key: 'caixa', patterns: ['caixa'] },
  { key: 'iva', patterns: ['iva'] },
  { key: 'pallco', patterns: ['pallco'] },
  { key: 'carlos', patterns: ['carlos'] },
  { key: 'dca', patterns: ['dca'] },
  { key: 'crypto', patterns: ['crypto'] }
];

function resolveHref(slug, isModulePage) {
  if (/^https?:\/\//.test(slug)) return slug;
  if (isModulePage) {
    return slug.replace(/^modules\//, '');
  }
  return slug;
}

function detectActiveKey() {
  const path = window.location.pathname.toLowerCase();
  const match = ACTIVE_KEY_MATCHERS.find(entry =>
    entry.patterns.some(pattern => path.includes(pattern))
  );
  return match ? match.key : '';
}

function buildGlobalNav() {
  const body = document.body;
  if (!body) return;

  const existingMenu = document.getElementById('menu-icon');
  if (existingMenu) existingMenu.remove();
  const existingNav = document.getElementById('nav-menu');
  if (existingNav) {
    const existingHeader = existingNav.closest('header');
    if (existingHeader) existingHeader.remove();
  }

  const header = document.createElement('header');
  header.innerHTML = `
    <button id="menu-icon" aria-label="Abrir menu" class="menu-icon">☰</button>
    <nav id="nav-menu">
      <div id="login-section" class="login-block">
        <a href="#" id="login-btn" class="login-visible">🔐 Login</a>
        <span id="user-info" class="user-visible" style="display:none;">
          <a href="#" id="user-name">👤 Username</a>
        </span>
      </div>
      <div class="nav-links"></div>
    </nav>
  `;

  body.prepend(header);

  const isModulePage = window.location.pathname.includes('/modules/');
  const activeKey = detectActiveKey();
  const linksWrap = header.querySelector('.nav-links');

  NAV_GROUPS.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'nav-group';
    groupEl.setAttribute('data-nav-group', '');

    const trigger = document.createElement('button');
    trigger.className = 'nav-link nav-link--trigger';
    trigger.setAttribute('data-nav-toggle', '');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.textContent = group.label;

    const dropdown = document.createElement('div');
    dropdown.className = 'nav-dropdown';
    dropdown.setAttribute('role', 'menu');

    group.links.forEach(link => {
      const anchor = document.createElement('a');
      anchor.href = resolveHref(link.slug, isModulePage);
      anchor.textContent = link.label;
      anchor.setAttribute('role', 'menuitem');
      if (link.key === activeKey) {
        anchor.classList.add('active');
      }
      dropdown.appendChild(anchor);
    });

    groupEl.append(trigger, dropdown);
    linksWrap.appendChild(groupEl);
  });

  setupNavInteractions(header);
}

function initNavWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGlobalNav);
  } else {
    buildGlobalNav();
  }
}

function setupNavInteractions(header) {
  const menuBtn = header.querySelector('#menu-icon');
  const nav = header.querySelector('#nav-menu');
  const groups = Array.from(header.querySelectorAll('[data-nav-group]'));

  const closeGroups = () => {
    groups.forEach(group => {
      group.classList.remove('is-open');
      const trigger = group.querySelector('[data-nav-toggle]');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  };

  if (menuBtn) {
    menuBtn.addEventListener('click', () => header.classList.toggle('active'));
  }

  groups.forEach(group => {
    const trigger = group.querySelector('[data-nav-toggle]');
    if (!trigger) return;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = group.classList.contains('is-open');
      closeGroups();
      if (!isOpen) {
        group.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-nav-group]')) {
      closeGroups();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGroups();
  });

  if (nav) {
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        header.classList.remove('active');
      }
    });
  }
}

initNavWhenReady();

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

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

// Garantir que a sessão se mantém entre reloads
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistência definida para browserLocalPersistence");
  })
  .catch((err) => {
    console.error("Erro a definir persistência:", err);
  });

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('SW registered', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// Exports for other modules
export { db, copiarMensagem, enviarEmailUrgencia };
window.enviarEmailUrgencia = enviarEmailUrgencia;
