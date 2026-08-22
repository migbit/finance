// A APP – script.js (adapted from main app)
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

import {
  filterNavigation,
  findModuleGroup,
  getModuleAccess,
  isFilipa,
  investmentsReleased
} from './access-control.js';

document.documentElement.classList.add('app-access-pending');
const accessStyle = document.createElement('style');
accessStyle.textContent = `
  html.app-access-pending body main { visibility: hidden; }
  .access-message { max-width: 680px; margin: 4rem auto; padding: 1.5rem; text-align: center; }
  .access-readonly-banner { margin: 0 0 1rem; padding: .75rem 1rem; border-radius: 10px; background: #fff4ce; color: #5f4700; }
`;
document.head.appendChild(accessStyle);

let currentUser = null;
let accessResolved = false;
let resolveAccessReady;
const accessReady = new Promise(resolve => { resolveAccessReady = resolve; });

const NAV_GROUPS = [
  {
    label: '🏠 Apartamentos',
    key: 'apartamentos',
    links: [
      { label: '📄 Faturas', key: 'faturas', slug: 'modules/faturas.html', module: true },
      { label: '📊 Análise', key: 'analisev4', slug: 'modules/analisev4.html', module: true },
      { label: '🛂 Boletins', key: 'boletins', slug: 'modules/boletins.html', module: true },
      { label: '🧳 Taxa Turística', key: 'tmt', slug: 'modules/tmt.html', module: true },
      { label: '📝 Questionário', key: 'questionario', slug: 'modules/questionario.html', module: true },
      { label: '🧹 Horas Limpeza', key: 'cleaning-hours', slug: 'modules/cleaning-hours.html', module: true },
      { label: '📋 Diversos', key: 'diversos', slug: 'modules/diversos.html', module: true },
      { label: '🛟 Backup', key: 'settings', slug: 'modules/settings.html', module: true }
    ]
  },
  {
    label: '💼 Contabilidade',
    key: 'contabilidade',
    links: [
      { label: '💰 Caixa', key: 'caixa', slug: 'modules/caixa.html', module: true },
      { label: '📑 IVA Estrangeiro', key: 'iva', slug: 'modules/iva.html', module: true },
      { label: '🏢 PALLCO', key: 'pallco', slug: 'modules/pallco.html', module: true },
      { label: '📭 Faturas em Falta', key: 'faturas-em-falta', slug: 'modules/faturas-em-falta.html', module: true },
      { label: '🧾 Carlos – Faturas', key: 'carlos', slug: 'modules/carlos.html', module: true }
    ]
  },
  {
    label: '📊 Investimentos',
    key: 'investimentos',
    links: [
      { label: '📈 DCA TR', key: 'dca', slug: 'modules/dca.html', module: true },
      { label: '📈 DCA Revolut', key: 'dca-revolut', slug: 'modules/dca-revolut.html', module: true },
      { label: '🚀 Cripto', key: 'crypto', slug: 'modules/crypto.html', module: true }
    ]
  },
  {
    label: '👩 Isabel',
    key: 'isabel',
    links: [
      { label: '📅 Datas', key: 'datas', slug: 'modules/datas.html', module: true }
    ]
  },
  {
    label: '👩 Filipa',
    key: 'filipa',
    links: [
      { label: '🏋️ Ginásio', key: 'filipa-ginasio', slug: 'modules/filipa-ginasio.html', module: true },
      { label: '🥗 Alimentação', key: 'filipa-alimentacao', slug: 'modules/filipa-alimentacao.html', module: true }
    ]
  },
  {
    label: '🙋 Miguel',
    key: 'miguel',
    links: [
      { label: '🏋️ Ginásio', key: 'ginasio', slug: 'modules/ginasio.html', module: true },
      { label: '🥗 Alimentação', key: 'alimentacao', slug: 'modules/alimentacao.html', module: true },
      { label: '🧘 Meditação', key: 'meditacao', slug: 'modules/meditacao.html', module: true }
    ]
  }
];

const ACTIVE_KEY_MATCHERS = [
  { key: 'filipa-ginasio', patterns: ['filipa-ginasio'] },
  { key: 'filipa-alimentacao', patterns: ['filipa-alimentacao'] },
  { key: 'dca-revolut', patterns: ['dca-revolut'] },
  { key: 'analisev4', patterns: ['analisev4'] },
  { key: 'boletins', patterns: ['boletins'] },
  { key: 'faturas-em-falta', patterns: ['faturas-em-falta'] },
  { key: 'faturas', patterns: ['faturas'] },
  { key: 'tmt', patterns: ['tmt'] },
  { key: 'diversos', patterns: ['diversos'] },
  { key: 'questionario', patterns: ['questionario'] },
  { key: 'cleaning-hours', patterns: ['cleaning-hours'] },
  { key: 'settings', patterns: ['settings'] },
  { key: 'caixa', patterns: ['caixa'] },
  { key: 'iva', patterns: ['iva'] },
  { key: 'pallco', patterns: ['pallco'] },
  { key: 'carlos', patterns: ['carlos'] },
  { key: 'datas', patterns: ['datas'] },
  { key: 'dca', patterns: ['dca'] },
  { key: 'crypto', patterns: ['crypto'] },
  { key: 'alimentacao', patterns: ['alimentacao'] },
  { key: 'meditacao', patterns: ['meditacao'] },
  { key: 'ginasio', patterns: ['ginasio'] }
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
  if (match) return match.key;
  if (!path.includes('/modules/')) return '';
  return path.split('/').pop()?.replace(/\.html$/, '') || '';
}

function buildGlobalNav(user = currentUser) {
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

  filterNavigation(NAV_GROUPS, user?.uid).forEach(group => {
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
  bindAuthControls(header);
  atualizarInterface(user);
}

function bindAuthControls(root = document) {
  const loginBtn = root.querySelector('#login-btn');
  const logoutBtn = root.querySelector('#logout-btn');
  if (loginBtn && !loginBtn.__authBound) {
    loginBtn.__authBound = true;
    loginBtn.addEventListener('click', (event) => {
      event.preventDefault();
      loginComGoogle();
    });
  }
  if (logoutBtn && !logoutBtn.__authBound) {
    logoutBtn.__authBound = true;
    logoutBtn.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }
}

function currentPageAccess(user = currentUser) {
  const moduleKey = detectActiveKey();
  const groupKey = findModuleGroup(NAV_GROUPS, moduleKey);
  return {
    moduleKey,
    groupKey,
    mode: moduleKey ? getModuleAccess(user?.uid, moduleKey, groupKey) : (user ? 'write' : 'none')
  };
}

function renderAccessMessage(message) {
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `<section class="card access-message"><h2>Acesso restrito</h2><p>${message}</p></section>`;
  }
}

function clearPortfolioBrowserCache() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith('portfolio_data_')) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch { /* storage can be unavailable */ }
}

function enforcePageAccess(user = currentUser) {
  if (isFilipa(user?.uid) && !investmentsReleased()) {
    try {
      clearPortfolioBrowserCache();
      localStorage.removeItem('dca_etf_qty_vwce');
      localStorage.removeItem('dca_etf_qty_aggh');
    } catch { /* storage can be unavailable */ }
  }

  const access = currentPageAccess(user);
  document.body.dataset.accessMode = access.mode;
  document.body.classList.toggle('is-readonly', access.mode === 'read');

  if (access.moduleKey && access.mode === 'none') {
    renderAccessMessage(user
      ? 'A tua conta não tem autorização para consultar esta área.'
      : 'Inicia sessão para consultar esta área.');
  } else if (access.mode === 'read') {
    const main = document.querySelector('main');
    if (main && !main.querySelector('.access-readonly-banner')) {
      const banner = document.createElement('p');
      banner.className = 'access-readonly-banner';
      banner.textContent = 'Modo de consulta: podes ver estes dados, mas não alterá-los.';
      main.prepend(banner);
    }
  }

  document.documentElement.classList.remove('app-access-pending');
  return access;
}

export function whenAccessResolved() {
  return accessReady;
}

export function getCurrentPageAccess() {
  return currentPageAccess(currentUser);
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
    menuBtn.addEventListener('click', () => {
      header.classList.toggle('active');
      document.body.classList.toggle('nav-open', header.classList.contains('active'));
    });
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
        document.body.classList.remove('nav-open');
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

  bindAuthControls();

  // Auth state
  onAuthStateChanged(auth, (user) => {
    const nextUid = user?.uid || null;
    const previousUid = currentUser?.uid || null;
    if (accessResolved && nextUid !== previousUid) {
      clearPortfolioBrowserCache();
      window.location.reload();
      return;
    }
    currentUser = user;
    accessResolved = true;
    buildGlobalNav(user);
    const access = enforcePageAccess(user);
    resolveAccessReady({ user, ...access });
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

export function isCurrentUserFilipa() {
  return isFilipa(currentUser?.uid);
}

export function areInvestmentsReleased() {
  return investmentsReleased();
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
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const manifestHref = manifestLink?.getAttribute('href') || null;
    const manifestUrl = manifestHref ? new URL(manifestHref, window.location.href) : null;
    const swBase = manifestUrl ? new URL('./', manifestUrl) : new URL('./', window.location.href);
    const swUrl = new URL('sw.js', swBase);
    navigator.serviceWorker.register(swUrl, { scope: swBase.pathname })
      .then(reg => console.log('SW registered', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// Exports for other modules
export { db, copiarMensagem, enviarEmailUrgencia };
window.enviarEmailUrgencia = enviarEmailUrgencia;
