const MODULES_TO_RELOAD = [
  'progresso',
  'seasonal',
  'faturacao',
  'ocupacao',
  'revpan',
  'valor-medio',
  'pricing-lab',
  'heatmap',
  'taxa-limpeza',
  'noites-hospedes',
  'checkins-semana',
  'leadtime',
  'weekpart',
  'gap-analysis'
];

function dispatchReload() {
  MODULES_TO_RELOAD.forEach((module) => {
    window.dispatchEvent(new CustomEvent('analisev2:retry', { detail: { module } }));
  });
}

function waitForModulesIdle(timeout = 5000) {
  return new Promise((resolve) => {
    const manager = window.loadingManager;
    if (!manager || !manager.isLoading()) {
      resolve();
      return;
    }

    let timeoutId = null;

    function cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      window.removeEventListener('analisev2:module-loaded', handleLoaded);
    }

    function handleLoaded() {
      if (!manager.isLoading()) {
        cleanup();
        resolve();
      }
    }

    window.addEventListener('analisev2:module-loaded', handleLoaded);
    timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, timeout);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const reloadBtn = document.getElementById('analisev2-reload');
  if (!reloadBtn) return;

  reloadBtn.addEventListener('click', async () => {
    if (reloadBtn.disabled) return;
    reloadBtn.disabled = true;
    reloadBtn.classList.add('is-rotating');
    dispatchReload();
    await waitForModulesIdle();
    reloadBtn.disabled = false;
    reloadBtn.classList.remove('is-rotating');
  });
});
