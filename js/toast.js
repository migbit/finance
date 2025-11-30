/**
 * Global toast notification system
 * Types: success, error, warning, info
 */

export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getIcon(type)}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Fechar">&times;</button>
  `;

  document.body.appendChild(toast);

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });

  // Auto-show animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto-dismiss
  const dismissTimeout = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  // Cancel auto-dismiss on hover
  toast.addEventListener('mouseenter', () => clearTimeout(dismissTimeout));
  toast.addEventListener('mouseleave', () => {
    setTimeout(() => dismissToast(toast), 1000);
  });
}

function dismissToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => toast.remove(), 300);
}

function getIcon(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

/**
 * Confirmation dialog (replaces confirm())
 */
export function showConfirm(message, onConfirm, onCancel = null) {
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.innerHTML = `
    <div class="confirm-backdrop"></div>
    <div class="confirm-dialog">
      <div class="confirm-message">${message}</div>
      <div class="confirm-actions">
        <button class="btn-cancel">Cancelar</button>
        <button class="btn-confirm">Confirmar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('show'), 10);

  modal.querySelector('.btn-confirm').addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });

  modal.querySelector('.btn-cancel').addEventListener('click', () => {
    modal.remove();
    if (onCancel) onCancel();
  });

  modal.querySelector('.confirm-backdrop').addEventListener('click', () => {
    modal.remove();
    if (onCancel) onCancel();
  });
}
