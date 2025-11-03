export const FORMATTERS = {
  quantity: new Intl.NumberFormat('en-PT', { maximumFractionDigits: 8 }),
  eur: new Intl.NumberFormat('en-PT', { style: 'currency', currency: 'EUR' }),
  usd: new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  percent: new Intl.NumberFormat('en-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
};

export class PerformanceUtils {
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  }
}

export class ValidationUtils {
  static isValidNumber(value, min = 0, max = Infinity) {
    const num = Number(value);
    return Number.isFinite(num) && num >= min && num <= max;
  }

  static isValidAssetSymbol(symbol) {
    return /^[A-Z0-9]{2,10}$/i.test(String(symbol || '').trim());
  }

  static sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  static sanitizeNumber(value, decimals = 8) {
    const num = Number(value);
    if (!this.isValidNumber(num)) return 0;
    return Number(num.toFixed(decimals));
  }
}

