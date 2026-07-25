/**
 * Global toast notification system
 * Types: success, error, warning, info
 */

export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = getIcon(type);
  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = String(message);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Fechar notificação');
  closeBtn.textContent = '×';
  toast.append(icon, text, closeBtn);

  document.body.appendChild(toast);

  closeBtn.addEventListener('click', () => dismissToast(toast));

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
  const previouslyFocused = document.activeElement;
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop';
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const text = document.createElement('div');
  text.id = `confirm-message-${Date.now()}`;
  text.className = 'confirm-message';
  text.textContent = String(message);
  dialog.setAttribute('aria-labelledby', text.id);
  const actions = document.createElement('div');
  actions.className = 'confirm-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-cancel';
  cancelBtn.textContent = 'Cancelar';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn-confirm';
  confirmBtn.textContent = 'Confirmar';
  actions.append(cancelBtn, confirmBtn);
  dialog.append(text, actions);
  modal.append(backdrop, dialog);

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('show'), 10);
  setTimeout(() => cancelBtn.focus(), 20);

  const close = callback => {
    document.removeEventListener('keydown', handleKeydown);
    modal.remove();
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    if (callback) callback();
  };
  const handleKeydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(onCancel);
    }
    if (event.key === 'Tab') {
      const target = document.activeElement === cancelBtn ? confirmBtn : cancelBtn;
      if (event.shiftKey || document.activeElement === confirmBtn) {
        event.preventDefault();
        target.focus();
      }
    }
  };
  document.addEventListener('keydown', handleKeydown);

  confirmBtn.addEventListener('click', () => close(onConfirm));
  cancelBtn.addEventListener('click', () => close(onCancel));
  backdrop.addEventListener('click', () => close(onCancel));
}
