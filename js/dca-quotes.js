import { loadShareQuantities, saveShareQuantities } from './dca-core.js';

const ETF_CONFIG = [
  {
    key: 'vwce',
    label: 'VWCE',
    symbol: 'VWCE.DE',
    currency: 'EUR',
    exchange: 'XETRA',
    exchangeFullName: 'Deutsche Börse'
  },
  {
    key: 'aggh',
    label: 'AGGH',
    symbol: 'EUNA.DE',
    currency: 'EUR',
    exchange: 'XETRA',
    exchangeFullName: 'Deutsche Börse'
  }
];

// Alpha Vantage endpoint & key (provided by user)
const AV_API_URL = 'https://www.alphavantage.co/query';
const AV_API_KEY = '48DFSR9ON8Q0E8NU';

const quoteCacheKey = 'dca_etf_quotes_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const quoteState = new Map();
const investedTotals = new Map();
const quantityState = new Map();

const currencyFormatters = new Map();

// Load shares from Firebase
async function loadStoredQuantities() {
  try {
    return await loadShareQuantities();
  } catch (err) {
    console.error('Error loading share quantities:', err);
    return { vwce: 0, aggh: 0 };
  }
}

// Save shares to Firebase
async function persistQuantities() {
  try {
    const shares = {
      vwce: quantityState.get('vwce') || 0,
      aggh: quantityState.get('aggh') || 0
    };
    await saveShareQuantities(shares);

    // Dispatch event to notify dca-main.js
    window.dispatchEvent(new CustomEvent('dca:shares-updated', { detail: shares }));
  } catch (err) {
    console.error('Error saving share quantities:', err);
    throw err;
  }
}

function readQuoteCache() {
  try {
    const raw = localStorage.getItem(quoteCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.quotes) return null;
    return {
      timestamp: Number(parsed.timestamp) || 0,
      quotes: new Map(Object.entries(parsed.quotes))
    };
  } catch {
    return null;
  }
}

function persistQuoteCache(quotesMap) {
  try {
    const payload = {};
    quotesMap.forEach((value, key) => {
      payload[key] = value;
    });
    localStorage.setItem(
      quoteCacheKey,
      JSON.stringify({ timestamp: Date.now(), quotes: payload })
    );
  } catch {
    // ignore cache issues
  }
}

function formatCurrency(value, currency = 'EUR') {
  if (!Number.isFinite(value)) return '-';
  const key = `${currency}`;
  if (!currencyFormatters.has(key)) {
    currencyFormatters.set(
      key,
      new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      })
    );
  }
  return currencyFormatters.get(key).format(value);
}

function formatPct(value) {
  if (!Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatUpdatedLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Atualizado a —';
  const d = date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const t = date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `Atualizado a ${d} ${t}`;
}

function updateCardUI(key, data) {
  const priceEl = document.getElementById(`etf-${key}-price`);
  const changeEl = document.getElementById(`etf-${key}-change`);
  const extraEl = document.getElementById(`etf-${key}-extra`);

  if (!priceEl || !changeEl || !extraEl) return;

  if (!data) {
    priceEl.textContent = '-';
    changeEl.textContent = '-';
    changeEl.classList.remove('pos', 'neg');
    extraEl.textContent = 'Sem dados';
    return;
  }

  priceEl.textContent = formatCurrency(data.price, data.currency || 'EUR');

  const pctText = formatPct(data.changePct);
  const changeValue = Number.isFinite(data.changeValue)
    ? `${data.changeValue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(data.changeValue), data.currency || 'EUR')}`
    : null;

  changeEl.textContent = changeValue ? `${pctText} (${changeValue})` : pctText;
  changeEl.classList.remove('pos', 'neg');
  if (Number.isFinite(data.changePct)) {
    changeEl.classList.add(data.changePct >= 0 ? 'pos' : 'neg');
  }

  const parts = [];
  if (data.exchange) parts.push(data.exchange);
  if (data.currency) parts.push(`Moeda ${data.currency}`);
  extraEl.textContent = parts.length ? parts.join(' • ') : '—';
}

function updatePositionSummary(key) {
  const totalEl = document.getElementById(`etf-${key}-total`);
  const investedEl = document.getElementById(`etf-${key}-invested`);
  const resultEl = document.getElementById(`etf-${key}-result`);
  if (!totalEl || !investedEl || !resultEl) return;

  const quote = quoteState.get(key);
  const qty = quantityState.get(key) ?? 0;
  const invested = investedTotals.get(key) ?? 0;
  const currency = quote?.currency || 'EUR';

  const totalValue = (quote && Number.isFinite(quote.price) && Number.isFinite(qty))
    ? quote.price * qty
    : null;

  totalEl.textContent = Number.isFinite(totalValue) ? formatCurrency(totalValue, currency) : '-';
  investedEl.textContent = formatCurrency(invested, currency);

  if (Number.isFinite(totalValue)) {
    const result = totalValue - (invested || 0);
    resultEl.textContent = formatCurrency(result, currency);
    resultEl.classList.toggle('pos', result >= 0);
    resultEl.classList.toggle('neg', result < 0);
  } else {
    resultEl.textContent = '-';
    resultEl.classList.remove('pos', 'neg');
  }
}

window.addEventListener('dca:invested-totals', (event) => {
  const detail = event?.detail || {};
  ETF_CONFIG.forEach(({ key }) => {
    const raw = detail?.[key];
    if (raw != null) {
      investedTotals.set(key, Number(raw) || 0);
    }
    updatePositionSummary(key);
  });
});

function applyQuotes(quotesMap) {
  if (!quotesMap) return;

  // Build global quotes object
  const globalQuotes = {};

  ETF_CONFIG.forEach(({ key }) => {
    const data = quotesMap.get(key);
    if (data) {
      quoteState.set(key, data);
      globalQuotes[key] = data;
    }
    updateCardUI(key, data);
    updatePositionSummary(key);
  });

  // Expose quotes globally for dca-main.js to access
  window.dcaQuotes = globalQuotes;

  // Dispatch event to notify dca-main.js
  window.dispatchEvent(new CustomEvent('dca:quotes-updated', { detail: globalQuotes }));
}

async function fetchQuoteForSymbol(cfg) {
  const url = `${AV_API_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(cfg.symbol)}&apikey=${AV_API_KEY}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Alpha Vantage respondeu com ${response.status}`);
  }
  const data = await response.json();
  const quote = data?.['Global Quote'];
  if (!quote || Object.keys(quote).length === 0) {
    throw new Error(`Sem dados para ${cfg.symbol}`);
  }

  const parseNumber = (value) => {
    const num = typeof value === 'string' ? Number(value.replace('%','')) : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const price = parseNumber(quote['05. price']);
  const changeValue = parseNumber(quote['09. change']);
  const changePctRaw = quote['10. change percent'] || quote['10. change percent.'];
  const changePct = changePctRaw != null ? parseNumber(changePctRaw) : (price && changeValue ? (changeValue / (price - changeValue)) * 100 : null);

  return {
    price,
    changePct,
    changeValue,
    currency: cfg.currency,
    exchange: cfg.exchangeFullName || cfg.exchange
  };
}

async function fetchQuotes() {
  const map = new Map();

  for (const cfg of ETF_CONFIG) {
    const quote = await fetchQuoteForSymbol(cfg);
    map.set(cfg.key, quote);
  }

  return {
    updatedAt: new Date(),
    quotes: map
  };
}

export async function initEtfQuotes() {
  const section = document.getElementById('dca-etf-quotes');
  if (!section) return;

  const updatedEl = document.getElementById('dca-etf-updated');
  const refreshBtn = document.getElementById('dca-etf-refresh');
  const errorEl = document.getElementById('dca-etf-error');

  let isLoading = false;

  // Load shares from Firebase
  const storedShares = await loadStoredQuantities();

  // Initialize quantity inputs
  ETF_CONFIG.forEach(({ key }) => {
    const input = document.getElementById(`etf-${key}-qty`);
    if (!input) return;
    const stored = storedShares[key];
    if (stored != null) {
      quantityState.set(key, stored);
      input.value = stored;
    } else {
      quantityState.set(key, 0);
    }
    // Update the state on input change (for real-time calculations)
    input.addEventListener('input', () => {
      const raw = Number(input.value);
      const safe = Number.isFinite(raw) && raw >= 0 ? raw : 0;
      quantityState.set(key, safe);
      updatePositionSummary(key);
    });
  });

  // Add save button event listeners
  document.querySelectorAll('.btn-save-qty').forEach(button => {
    button.addEventListener('click', async () => {
      const etfKey = button.dataset.etf;
      const input = document.getElementById(`etf-${etfKey}-qty`);
      if (!input) return;

      const raw = Number(input.value);
      const safe = Number.isFinite(raw) && raw >= 0 ? raw : 0;
      quantityState.set(etfKey, safe);

      try {
        // Save to Firebase
        await persistQuantities();

        // Visual feedback
        button.textContent = '✓ Guardado';
        button.style.background = '#10b981';
        setTimeout(() => {
          button.textContent = 'Guardar';
          button.style.background = '';
        }, 2000);
      } catch (err) {
        // Error feedback
        button.textContent = '✗ Erro';
        button.style.background = '#ef4444';
        setTimeout(() => {
          button.textContent = 'Guardar';
          button.style.background = '';
        }, 2000);
        alert('Erro ao guardar quantidades. Tente novamente.');
      }
    });
  });

  // Ensure summaries render even before quotes load
  ETF_CONFIG.forEach(({ key }) => updatePositionSummary(key));

  function setUpdated(date) {
    if (updatedEl) {
      updatedEl.textContent = formatUpdatedLabel(date);
    }
  }

  function setLoading(loading) {
    isLoading = loading;
    if (refreshBtn) {
      refreshBtn.disabled = loading;
      refreshBtn.classList.toggle('is-rotating', loading);
    }
  }

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
  }

  async function loadQuotes(force = false) {
    if (isLoading) return;
    setError('');
    setLoading(true);
    try {
      const cached = readQuoteCache();
      const now = Date.now();
      if (cached?.quotes && cached.timestamp) {
        quoteState.clear();
        cached.quotes.forEach((value, key) => {
          quoteState.set(key, value);
        });
        applyQuotes(quoteState);
        setUpdated(new Date(cached.timestamp));
      }
      const cacheFresh = cached && (now - cached.timestamp) < CACHE_TTL_MS;
      if (cacheFresh && !force) {
        return;
      }
      if (cacheFresh && force) {
        setError('Última atualização foi há menos de 5 minutos. Aguarda para recarregar novamente.');
        return;
      }

      const { quotes, updatedAt } = await fetchQuotes();
      applyQuotes(quotes);
      setUpdated(updatedAt);
      persistQuoteCache(quotes);
    } catch (err) {
      console.error('Erro ao carregar cotações:', err);
      setError(err?.message || 'Não foi possível obter as cotações.');
    } finally {
      setLoading(false);
    }
  }

  refreshBtn?.addEventListener('click', () => loadQuotes(true));
  loadQuotes(false);
}
