async function mountFilipaGym() {
  const currentMain = document.querySelector('main');

  try {
    const sourceUrl = new URL('../modules/ginasio.html', import.meta.url);
    const response = await fetch(sourceUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const source = new DOMParser().parseFromString(await response.text(), 'text/html');
    const sourceStyle = source.querySelector('head style');
    const sourceMain = source.querySelector('main.ginasio-page');
    if (!sourceStyle || !sourceMain) throw new Error('Estrutura da página de referência incompleta.');

    const sharedStyle = sourceStyle.cloneNode(true);
    sharedStyle.dataset.gymSharedStyle = 'true';
    document.head.appendChild(sharedStyle);

    const gymMain = sourceMain.cloneNode(true);
    gymMain.setAttribute('aria-label', 'Ginásio da Filipa');
    const title = gymMain.querySelector('.page-title');
    if (title) title.textContent = 'Ginásio · Filipa';
    currentMain.replaceWith(gymMain);

    await import('./ginasio.js');
  } catch (error) {
    console.error('Erro ao preparar a página de ginásio da Filipa:', error);
    currentMain.innerHTML = `
      <section class="report-section">
        <div class="viz-card">
          <h2>Ginásio · Filipa</h2>
          <p>Não foi possível carregar a página. Atualiza e tenta novamente.</p>
        </div>
      </section>
    `;
  }
}

void mountFilipaGym();
