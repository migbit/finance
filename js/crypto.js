import { CryptoPortfolioApp } from './crypto-ui.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

const app = new CryptoPortfolioApp();
window.cryptoApp = app;

let initPromise = null;

function ensureInitialized(){
  if (!initPromise){
    initPromise = app.init().catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

function handleAuthState(user){
  if (user){
    ensureInitialized();
  } else {
    initPromise = null;
    app.handleSignedOut();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  app.handleSignedOut('A verificar sessao...', { busy: true });
  try {
    const auth = getAuth();
    onAuthStateChanged(auth, handleAuthState);
  } catch (error) {
    console.error('Failed to initialise auth listener', error);
    app.handleSignedOut('Erro ao verificar sessao. Recarregue a pagina.');
  }
});
