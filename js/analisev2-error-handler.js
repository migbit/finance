class ErrorHandler {
  constructor() {
    this.errors = new Map();
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError('global', event.reason, 'Promise rejection');
      event.preventDefault();
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.handleError('global', event.error || event.message, 'Runtime error');
    });
  }

  handleError(module, error, context = '', retryFn = null) {
    const errorKey = `${module}-${context}`;
    if (!this.errors.has(errorKey)) {
      this.errors.set(errorKey, { count: 0, lastOccurred: Date.now() });
    }

    const info = this.errors.get(errorKey);
    info.count += 1;
    info.lastOccurred = Date.now();

    console.error(`[${module}] ${context}:`, error);

    this.showErrorMessage(module, error, info.count, retryFn);

    window.dispatchEvent(new CustomEvent('analisev2:module-error', {
      detail: {
        module,
        error: error?.message || String(error),
        context,
        canRetry: typeof retryFn === 'function',
        retryCount: info.count
      }
    }));

    if (typeof retryFn === 'function' && info.count <= this.maxRetries) {
      console.log(`Retrying ${module} (${info.count}/${this.maxRetries})...`);
      setTimeout(() => {
        Promise.resolve()
          .then(() => retryFn())
          .catch((err) => this.handleError(module, err, context, retryFn));
      }, this.retryDelay * info.count);
    }
  }

  showErrorMessage(module, error, retryCount, retryFn) {
    const container = document.querySelector(`[data-module="${module}"]`);
    if (!container) return;

    container.querySelector('.error-message')?.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';

    const { message, suggestion, icon } = this.getErrorCopy(error);
    const showRetry = typeof retryFn === 'function' && retryCount <= this.maxRetries;

    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">${icon}</span>
        <div class="error-text">
          <strong>${message}</strong>
          <p>${suggestion}</p>
          ${showRetry ? `<button class="btn-retry" data-retry-module="${module}">Tentar novamente</button>` : ''}
        </div>
      </div>
    `;

    if (showRetry) {
      errorDiv.querySelector('.btn-retry').addEventListener('click', () => this.retryModule(module));
    }

    container.prepend(errorDiv);
  }

  getErrorCopy(error) {
    const msg = error?.message || String(error || '');
    if (error?.code === 'permission-denied') {
      return {
        message: 'Sem permissão para aceder aos dados.',
        suggestion: 'Certifique-se de que está autenticado.',
        icon: '🔒'
      };
    }
    if (/network|fetch/i.test(msg)) {
      return {
        message: 'Erro de ligação.',
        suggestion: 'Verifique a sua ligação à internet.',
        icon: '🌐'
      };
    }
    if (/timeout/i.test(msg)) {
      return {
        message: 'Pedido expirou.',
        suggestion: 'O servidor está lento. Tente novamente.',
        icon: '⏱️'
      };
    }
    return {
      message: 'Ocorreu um erro ao carregar os dados.',
      suggestion: 'Por favor, tente recarregar a página.',
      icon: '⚠️'
    };
  }

  retryModule(module) {
    Array.from(this.errors.keys())
      .filter((key) => key.startsWith(module))
      .forEach((key) => this.errors.delete(key));

    document.querySelector(`[data-module="${module}"] .error-message`)?.remove();

    window.dispatchEvent(new CustomEvent('analisev2:retry', { detail: { module } }));
  }

  clearErrors() {
    this.errors.clear();
    document.querySelectorAll('.error-message').forEach((el) => el.remove());
  }

  getStats() {
    const stats = { totalErrors: 0, byModule: {} };
    this.errors.forEach((info, key) => {
      const [module] = key.split('-');
      stats.totalErrors += info.count;
      stats.byModule[module] = (stats.byModule[module] || 0) + info.count;
    });
    return stats;
  }
}

window.errorHandler = new ErrorHandler();
export { ErrorHandler };
