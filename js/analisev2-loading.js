class LoadingManager {
  constructor() {
    this.activeLoaders = new Set();
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('skeleton-styles')) return;
    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
      .module-loading {
        position: relative;
        pointer-events: none;
        user-select: none;
      }

      .module-loading::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(2px);
        z-index: 10;
        animation: fadeIn 0.2s ease-out;
      }

      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 4px;
      }

      .skeleton-text { height: 16px; margin: 8px 0; }
      .skeleton-title { height: 24px; width: 60%; margin: 12px auto; }
      .skeleton-chart { height: 300px; margin: 20px 0; }

      .skeleton-table { width: 100%; }
      .skeleton-table-row { display: flex; gap: 10px; margin: 10px 0; }
      .skeleton-table-cell { flex: 1; height: 40px; }

      .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid rgba(82, 109, 130, 0.3);
        border-top-color: var(--p2);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .spinner-large {
        width: 48px;
        height: 48px;
        border-width: 4px;
      }

      .loading-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease-out;
      }

      .loading-content {
        background: white;
        padding: 2rem;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
        min-width: 220px;
      }

      .loading-progress {
        margin-top: 1rem;
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        overflow: hidden;
      }

      .loading-progress-bar {
        height: 100%;
        background: var(--p2);
        transition: width 0.3s ease;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  show(module, options = {}) {
    const { type = 'skeleton', message = 'A carregar...', progress = null } = options;
    const container = document.querySelector(`[data-module="${module}"]`);
    if (!container) return;

    this.activeLoaders.add(module);
    window.dispatchEvent(new CustomEvent('analisev2:module-loading', { detail: { module } }));

    switch (type) {
      case 'skeleton':
        this.showSkeleton(container, module);
        break;
      case 'spinner':
        this.showSpinner(container, message);
        break;
      case 'overlay':
        this.showOverlay(message, progress);
        break;
      default:
        container.classList.add('module-loading');
    }
  }

  hide(module) {
    const container = document.querySelector(`[data-module="${module}"]`);
    if (container) {
      container.classList.remove('module-loading');
      container.querySelectorAll('.skeleton-container, .spinner-container').forEach((el) => el.remove());
    }

    this.activeLoaders.delete(module);
    if (!this.activeLoaders.size) {
      document.getElementById('loading-overlay')?.remove();
    }

    window.dispatchEvent(new CustomEvent('analisev2:module-loaded', { detail: { module } }));
  }

  showSkeleton(container, module) {
    container.querySelector('.skeleton-container')?.remove();
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-container';

    if (module === 'progresso') {
      skeleton.innerHTML = `
        <div class="donut-grid">
          ${[1,2,3,4].map(() => `
            <div class="donut-card">
              <div class="skeleton skeleton-title"></div>
              <div class="skeleton" style="width:150px;height:150px;margin:1rem auto;border-radius:50%;"></div>
              <div class="skeleton skeleton-text" style="width:80%;margin:0 auto;"></div>
            </div>`).join('')}
        </div>
      `;
    } else if (module === 'faturacao' || module === 'valor-medio' || module === 'ocupacao' || module === 'checkins-semana') {
      skeleton.innerHTML = `
        <div class="skeleton skeleton-chart"></div>
        <div class="skeleton skeleton-text" style="width:70%;margin:0 auto;"></div>
      `;
    } else {
      skeleton.innerHTML = `
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
      `;
    }

    container.appendChild(skeleton);
  }

  showSpinner(container, message) {
    container.querySelector('.spinner-container')?.remove();
    const el = document.createElement('div');
    el.className = 'spinner-container';
    el.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;">
        <div class="loading-spinner spinner-large"></div>
        <p style="margin-top:1rem;color:var(--text-dim);font-weight:600;">${message}</p>
      </div>
    `;
    container.appendChild(el);
  }

  showOverlay(message, progress) {
    document.getElementById('loading-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner spinner-large"></div>
        <p style="margin:0;font-weight:600;color:var(--text);">${message}</p>
        ${progress !== null ? `
          <div class="loading-progress">
            <div class="loading-progress-bar" style="width:${progress}%"></div>
          </div>
          <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim);">${Math.round(progress)}%</p>
        ` : ''}
      </div>
    `;
    document.body.appendChild(overlay);
  }

  updateProgress(progress) {
    document.querySelector('.loading-progress-bar')?.style.setProperty('width', `${progress}%`);
  }

  isLoading(module = null) {
    return module ? this.activeLoaders.has(module) : this.activeLoaders.size > 0;
  }

  clearAll() {
    Array.from(this.activeLoaders).forEach((module) => this.hide(module));
  }
}

window.loadingManager = new LoadingManager();
export { LoadingManager };
